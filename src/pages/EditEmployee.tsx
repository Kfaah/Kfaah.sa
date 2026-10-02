import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  Camera,
  X,
  Users,
  Save,
  BadgeCheck,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getArabicErrorMessage } from "@/lib/errors";

interface Department {
  id: string;
  name: string;
  color: string;
}

interface JobRole {
  id: string;
  name: string;
  color: string;
  department_id: string | null;
}

interface Employee {
  id: string;
  user_id: string | null;
  full_name: string;
  username: string;
  email: string | null;
  phone: string | null;
  job_role: string;
  role_color: string;
  avatar_url: string | null;
  status: "active" | "on_leave" | "inactive";
  direct_manager_id: string | null;
  executive_manager_id: string | null;
  title: string | null;
  role_level: "employee" | "manager" | "admin" | null;
}

interface EmployeeBasic {
  id: string;
  full_name: string;
  user_id: string | null;
  job_role: string;
}

const EditEmployee = () => {
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const { currentOrg } = useOrganization();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeBasic[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    phone: "",
    job_role: "",
    department: "",
    status: "active" as "active" | "on_leave" | "inactive",
    avatar_url: "",
    avatarFile: null as File | null,
    directManagerId: "",
    executiveManagerId: "",
    title: "",
    password: "",
    user_id: null as string | null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // جلب البيانات
  useEffect(() => {
    const fetchData = async () => {
      if (!employeeId) {
        navigate("/employees");
        return;
      }
      if (!currentOrg?.id) return;

      try {
        const employeeRes = await supabase
          .from("employees")
          .select("*")
          .eq("id", employeeId)
          .eq("organization_id", currentOrg.id)
          .single();
        if (employeeRes.error) throw employeeRes.error;
        const emp = employeeRes.data as Employee & { organization_id: string };

        const [deptsRes, rolesRes, allEmployeesRes] = await Promise.all([
          supabase.from("departments").select("*").eq("organization_id", emp.organization_id).order("name"),
          supabase.from("job_roles").select("*").eq("organization_id", emp.organization_id).order("name"),
          supabase
            .from("employees")
            .select("id, full_name, user_id, job_role")
            .eq("organization_id", emp.organization_id)
            .or("is_viewer_account.is.null,is_viewer_account.eq.false")
            .order("full_name"),
        ]);
        if (deptsRes.error) throw deptsRes.error;
        if (rolesRes.error) throw rolesRes.error;
        // تحديد القسم من الدور الوظيفي
        const roleData = rolesRes.data?.find(r => r.name === emp.job_role);
        const deptData = deptsRes.data?.find(d => d.id === roleData?.department_id);

        setForm({
          full_name: emp.full_name || "",
          username: emp.username || "",
          email: emp.email || "",
          phone: emp.phone || "",
          job_role: emp.job_role || "",
          department: deptData?.name || "",
          status: emp.status || "active",
          avatar_url: emp.avatar_url || "",
          avatarFile: null,
          directManagerId: emp.direct_manager_id || "",
          executiveManagerId: emp.executive_manager_id || "",
          title: emp.title || "",
          password: "",
          user_id: emp.user_id,
        });

        setDepartments(deptsRes.data || []);
        setJobRoles(rolesRes.data || []);
        setAllEmployees((allEmployeesRes.data || []).filter(e => e.id !== employeeId));
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("حدث خطأ أثناء جلب بيانات الموظف");
        navigate("/employees");
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [employeeId, navigate, currentOrg?.id]);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("يرجى اختيار ملف صورة صالح");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }

    setIsUploadingImage(true);
    try {
      const previewUrl = URL.createObjectURL(file);
      setForm((prev) => ({ ...prev, avatar_url: previewUrl, avatarFile: file }));
    } catch (error) {
      toast.error("حدث خطأ أثناء معالجة الصورة");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = () => {
    if (form.avatar_url && form.avatar_url.startsWith("blob:")) {
      URL.revokeObjectURL(form.avatar_url);
    }
    setForm((prev) => ({ ...prev, avatar_url: "", avatarFile: null }));
  };

  const uploadImageToStorage = async (file: File, id: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}-${Date.now()}.${fileExt}`;
      const orgFolder = currentOrg?.id;
      if (!orgFolder) throw new Error("تعذر تحديد الجمعية");
      const filePath = `employees/${orgFolder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const filteredRoles = form.department
    ? jobRoles.filter((r) => {
        const dept = departments.find((d) => d.name === form.department);
        return r.department_id === dept?.id || !r.department_id;
      })
    : jobRoles;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!form.full_name.trim()) newErrors.full_name = "الاسم مطلوب";
    if (!form.username.trim()) {
      newErrors.username = "رقم الهوية مطلوب";
    } else if (!/^\d{10}$/.test(form.username.trim())) {
      newErrors.username = "رقم الهوية يجب أن يتكون من 10 أرقام";
    }
    if (form.password && form.password.length < 8) {
      newErrors.password = "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
    }
    if (!form.email?.trim()) newErrors.email = "البريد الإلكتروني مطلوب";
    if (!form.phone?.trim()) newErrors.phone = "رقم الجوال مطلوب";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !employeeId) return;

    setIsLoading(true);
    try {
      let avatarUrl = form.avatar_url;

      // رفع الصورة الجديدة إذا وجدت
      if (form.avatarFile) {
        const uploadedUrl = await uploadImageToStorage(form.avatarFile, employeeId);
        if (uploadedUrl) {
          avatarUrl = uploadedUrl;
        }
      }

      const { error } = await supabase
        .from("employees")
        .update({
          full_name: form.full_name,
          username: form.username,
          email: form.email,
          phone: form.phone,
          job_role: form.job_role,
          status: form.status,
          avatar_url: avatarUrl,
          direct_manager_id: form.directManagerId && form.directManagerId !== "none" ? form.directManagerId : null,
          executive_manager_id: form.executiveManagerId && form.executiveManagerId !== "none" ? form.executiveManagerId : null,
          title: form.title.trim() || null,
        })
        .eq("id", employeeId);

      if (error) throw error;

      // ربط بيانات الدخول (رقم الهوية) مع حساب الدخول
      if (form.user_id) {
        const response = await supabase.functions.invoke("create-employee", {
          body: {
            action: "sync-login",
            userId: form.user_id,
            username: form.username,
          },
        });

        if (response.error || response.data?.success === false) {
          console.error("Error syncing login:", response.error || response.data);
        }
      }

      // تحديث كلمة المرور إذا تم إدخالها
      if (form.password && form.user_id) {
        const response = await supabase.functions.invoke("create-employee", {
          body: {
            action: "update-password",
            userId: form.user_id,
            password: form.password,
          },
        });

        if (response.error || response.data?.success === false) {
          console.error("Error updating password:", response.error || response.data);
          if (response.data?.fieldErrors) {
            setErrors((prev) => ({ ...prev, ...response.data.fieldErrors }));
            toast.error(response.data.fieldErrors.password || response.data?.error || "تعذر تحديث كلمة المرور");
            return;
          }
          throw new Error(response.data?.error || "تعذر تحديث كلمة المرور");
        }
      }

      toast.success("تم تحديث بيانات الموظف بنجاح");
      navigate("/employees");
    } catch (error: any) {
      toast.error(getArabicErrorMessage(error, "حدث خطأ أثناء تحديث البيانات"));
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto" dir="rtl">
        {/* رأس الصفحة */}
        <PageHeader
          icon={<BadgeCheck className="h-7 w-7" />}
          title="تعديل بيانات الموظف"
          subtitle="تحديث معلومات الموظف وصورته الشخصية"
          actions={
            <Button
              onClick={() => navigate("/employees")}
              className="gap-2 bg-white/15 text-white border border-white/30 hover:bg-white/25 backdrop-blur-sm"
            >
              <ArrowRight className="w-4 h-4" />
              العودة
            </Button>
          }
        />

        {/* البطاقة الرئيسية */}
        <Card className="border-[hsl(var(--primary)/0.2)] shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-l from-[hsl(var(--primary)/0.1)] to-transparent border-b">
            <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-[hsl(var(--primary))]" />
              بيانات الموظف
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* صورة الموظف */}
            <div className="flex justify-center">
              <div className="relative">
                <Avatar className="w-28 h-28 border-4 border-[hsl(var(--primary)/0.2)]">
                  <AvatarImage src={form.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))] text-white text-3xl">
                    {form.full_name ? form.full_name.charAt(0) : <User className="w-10 h-10" />}
                  </AvatarFallback>
                </Avatar>
                {form.avatar_url ? (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -left-2 w-8 h-8 rounded-full"
                    onClick={removeImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                ) : (
                  <label className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center cursor-pointer hover:bg-[hsl(var(--primary)/0.8)] transition-colors">
                    <Camera className="w-4 h-4 text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                  </label>
                )}
                {isUploadingImage && (
                  <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--primary))]" />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* الاسم الكامل والمسمى */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-[hsl(var(--primary))]" />
                    الاسم الكامل *
                  </Label>
                </div>
                <Input
                  value={form.full_name}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, full_name: e.target.value }));
                    if (errors.full_name) setErrors((prev) => ({ ...prev, full_name: "" }));
                  }}
                  placeholder="أدخل الاسم الكامل"
                  className={errors.full_name ? "border-destructive" : ""}
                />
                {errors.full_name && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors.full_name}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-[hsl(var(--primary))]" />
                    الدور
                  </Label>
                </div>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="مثال: أخصائي تسويق، مدير قسم..."
                />
                <p className="text-xs text-muted-foreground">
                  هذا الحقل للمسمى الوظيفي فقط. تغيير صلاحيات الدخول يتم من صفحة «صلاحيات الأعضاء» وفق صلاحيات مدير النظام والجمعية.
                </p>
              </div>
            </div>

            {/* رقم الهوية وكلمة المرور */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground">رقم الهوية (اسم المستخدم) *</Label>
                </div>
                <Input
                  value={form.username}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setForm((prev) => ({ ...prev, username: value }));
                    if (errors.username) setErrors((prev) => ({ ...prev, username: "" }));
                  }}
                  placeholder="أدخل رقم الهوية (10 أرقام)"
                  className={errors.username ? "border-destructive" : ""}
                  dir="ltr"
                />
                {errors.username && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors.username}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[hsl(var(--primary))]" />
                    كلمة المرور الجديدة
                  </Label>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, password: e.target.value }));
                      if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                    }}
                    placeholder="اتركه فارغاً للإبقاء على كلمة المرور الحالية"
                    className={errors.password ? "border-destructive pe-10" : "pe-10"}
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors.password}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">اتركه فارغاً إذا لم ترغب في تغيير كلمة المرور</p>
              </div>
            </div>

            <Separator />

            {/* البريد والجوال */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[hsl(var(--primary))]" />
                    البريد الإلكتروني *
                  </Label>
                </div>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, email: e.target.value }));
                    if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                  }}
                  placeholder="example@company.com"
                  className={errors.email ? "border-destructive" : ""}
                  dir="ltr"
                />
                {errors.email && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[hsl(var(--primary))]" />
                    رقم الجوال *
                  </Label>
                </div>
                <Input
                  value={form.phone}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, phone: e.target.value }));
                    if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
                  }}
                  placeholder="05xxxxxxxx"
                  className={errors.phone ? "border-destructive" : ""}
                  dir="ltr"
                />
                {errors.phone && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors.phone}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* الحالة */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground">الحالة</Label>
                </div>
                <Select
                  value={form.status}
                  onValueChange={(v: "active" | "on_leave" | "inactive") =>
                    setForm((prev) => ({ ...prev, status: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        نشط
                      </div>
                    </SelectItem>
                    <SelectItem value="on_leave">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        في إجازة
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-400" />
                        غير نشط
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* المديرين */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-[hsl(var(--primary))]" />
                    المدير المباشر
                  </Label>
                </div>
                <Select
                  value={form.directManagerId}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, directManagerId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المدير المباشر (اختياري)" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">بدون مدير مباشر</SelectItem>
                    {allEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} - {emp.job_role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-[hsl(var(--primary))]" />
                    المدير التنفيذي
                  </Label>
                </div>
                <Select
                  value={form.executiveManagerId}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, executiveManagerId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المدير التنفيذي (اختياري)" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="none">بدون مدير تنفيذي</SelectItem>
                    {allEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} - {emp.job_role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.directManagerId && form.executiveManagerId && 
                 form.directManagerId === form.executiveManagerId && 
                 form.directManagerId !== "none" && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>المدير المباشر والتنفيذي نفس الشخص</span>
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* مستوى الصلاحية الإدارية */}
            {/* أزرار الإجراءات */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/employees")}
                disabled={isLoading}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="gap-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] min-w-[120px]"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                حفظ التعديلات
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default EditEmployee;
