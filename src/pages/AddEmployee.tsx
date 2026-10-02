import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Plus,
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
  Upload,
  X,
  Users,
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
  full_name: string;
  user_id: string | null;
  job_role: string;
}

const AddEmployee = () => {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();

  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    role: "",
    department: "",
    password: "",
    avatar: "",
    avatarFile: null as File | null,
    directManagerId: "",
    executiveManagerId: "",
    roleLevel: "employee" as "employee" | "manager" | "admin",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // جلب البيانات
  useEffect(() => {
    const fetchData = async () => {
      if (!currentOrg?.id) {
        setLoadingData(false);
        return;
      }

      try {
        const [deptsRes, rolesRes, employeesRes] = await Promise.all([
          supabase.from("departments").select("*").eq("organization_id", currentOrg.id).order("name"),
          supabase.from("job_roles").select("*").eq("organization_id", currentOrg.id).order("name"),
          supabase.from("employees").select("id, full_name, user_id, job_role").eq("organization_id", currentOrg.id).order("full_name"),
        ]);

        if (deptsRes.error) throw deptsRes.error;
        if (rolesRes.error) throw rolesRes.error;
        if (employeesRes.error) throw employeesRes.error;

        setDepartments(deptsRes.data || []);
        setJobRoles(rolesRes.data || []);
        setEmployees(employeesRes.data || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [currentOrg?.id]);

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
      setForm((prev) => ({ ...prev, avatar: previewUrl, avatarFile: file }));
    } catch (error) {
      toast.error("حدث خطأ أثناء معالجة الصورة");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeImage = () => {
    if (form.avatar && form.avatar.startsWith("blob:")) {
      URL.revokeObjectURL(form.avatar);
    }
    setForm((prev) => ({ ...prev, avatar: "", avatarFile: null }));
  };

  const uploadImageToStorage = async (file: File, tempId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${tempId}-${Date.now()}.${fileExt}`;
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

    if (!form.name.trim()) newErrors.name = "الاسم مطلوب";
    if (!form.username.trim()) {
      newErrors.username = "رقم الهوية مطلوب";
    } else if (!/^\d{10}$/.test(form.username.trim())) {
      newErrors.username = "رقم الهوية يجب أن يتكون من 10 أرقام";
    }
    if (!form.password) newErrors.password = "كلمة المرور مطلوبة";
    if (form.password && form.password.length < 8) {
      newErrors.password = "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
    }
    if (!form.email.trim()) newErrors.email = "البريد الإلكتروني مطلوب";
    if (!form.phone.trim()) newErrors.phone = "رقم الجوال مطلوب";
    if (!form.department) newErrors.department = "القسم مطلوب";
    if (!form.role) newErrors.role = "الدور الوظيفي مطلوب";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!currentOrg?.id) {
      toast.error("تعذر تحديد الجمعية الحالية");
      return;
    }

    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();

      if (!session?.session?.access_token) {
        toast.error("يرجى تسجيل الدخول أولاً");
        setIsLoading(false);
        return;
      }

      const roleData = jobRoles.find((r) => r.name === form.role);

      let avatarUrl = null;
      if (form.avatarFile) {
        const tempId = Date.now().toString();
        avatarUrl = await uploadImageToStorage(form.avatarFile, tempId);
      }

      const response = await supabase.functions.invoke("create-employee", {
        body: {
          organizationId: currentOrg.id,
          fullName: form.name,
          username: form.username,
          password: form.password,
          email: form.email || null,
          phone: form.phone || null,
          jobRole: form.role,
          roleColor: roleData?.color || "bg-primary",
          avatarUrl: avatarUrl,
          directManagerId:
            form.directManagerId && form.directManagerId !== "none"
              ? form.directManagerId
              : null,
          executiveManagerId:
            form.executiveManagerId && form.executiveManagerId !== "none"
              ? form.executiveManagerId
              : null,
          roleLevel: form.roleLevel,
        },
      });

      if (response.error) {
        toast.error(getArabicErrorMessage(response.error, "حدث خطأ أثناء إضافة الموظف"));
        return;
      }

      if (response.data?.fieldErrors) {
        setErrors(response.data.fieldErrors);
        return;
      }

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      toast.success("تم إضافة الموظف بنجاح");
      navigate("/employees");
    } catch (error: any) {
      toast.error(getArabicErrorMessage(error, "حدث خطأ أثناء إضافة الموظف"));
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingData) {
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
          icon={<Plus className="h-7 w-7" />}
          title="إضافة موظف جديد"
          subtitle="إنشاء بيانات موظف جديد ضمن الجمعية"
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
                  <AvatarImage src={form.avatar} />
                  <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--primary))] text-white text-3xl">
                    {form.name ? form.name.charAt(0) : <User className="w-10 h-10" />}
                  </AvatarFallback>
                </Avatar>
                {form.avatar ? (
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

            {/* الاسم الكامل */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                <Label className="font-semibold text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-[hsl(var(--primary))]" />
                  الاسم الكامل *
                </Label>
              </div>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                  if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                }}
                placeholder="أدخل الاسم الكامل"
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
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
                  dir="rtl"
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
                    كلمة المرور *
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
                    placeholder="أدخل كلمة المرور"
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

            {/* القسم والدور */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Building className="w-4 h-4 text-[hsl(var(--primary))]" />
                    القسم *
                  </Label>
                </div>
                <Select
                  value={form.department}
                  onValueChange={(v) => {
                    setForm((prev) => ({ ...prev, department: v, role: "" }));
                    if (errors.department) setErrors((prev) => ({ ...prev, department: "" }));
                  }}
                  dir="rtl"
                >
                  <SelectTrigger dir="rtl" className={`text-right ${errors.department ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent dir="rtl" className="bg-background z-50 text-right">
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.department && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors.department}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                  <Label className="font-semibold text-foreground flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[hsl(var(--primary))]" />
                    الدور الوظيفي *
                  </Label>
                </div>
                <Select
                  value={form.role}
                  onValueChange={(v) => {
                    setForm((prev) => ({ ...prev, role: v }));
                    if (errors.role) setErrors((prev) => ({ ...prev, role: "" }));
                  }}
                  dir="rtl"
                >
                  <SelectTrigger dir="rtl" className={`text-right ${errors.role ? "border-destructive" : ""}`}>
                    <SelectValue placeholder="اختر الدور الوظيفي" />
                  </SelectTrigger>
                  <SelectContent dir="rtl" className="bg-background z-50 text-right">
                    {filteredRoles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors.role}
                  </p>
                )}
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
                  dir="rtl"
                >
                  <SelectTrigger dir="rtl" className="text-right">
                    <SelectValue placeholder="اختر المدير المباشر (اختياري)" />
                  </SelectTrigger>
                  <SelectContent dir="rtl" className="bg-background z-50 text-right">
                    <SelectItem value="none">بدون مدير مباشر</SelectItem>
                    {employees.map((emp) => (
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
                  dir="rtl"
                >
                  <SelectTrigger dir="rtl" className="text-right">
                    <SelectValue placeholder="اختر المدير التنفيذي (اختياري)" />
                  </SelectTrigger>
                  <SelectContent dir="rtl" className="bg-background z-50 text-right">
                    <SelectItem value="none">بدون مدير تنفيذي</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} - {emp.job_role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* مستوى الصلاحية */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 bg-[hsl(var(--primary))] rounded-full" />
                <Label className="font-semibold text-foreground flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[hsl(var(--primary))]" />
                  مستوى الصلاحية الإدارية *
                </Label>
              </div>
              <Select
                value={form.roleLevel}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, roleLevel: v as any }))
                }
                dir="rtl"
              >
                <SelectTrigger dir="rtl" className="text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl" className="bg-background z-50 text-right">
                  <SelectItem value="employee">
                    👤 موظف عادي — يرى بياناته فقط
                  </SelectItem>
                  <SelectItem value="manager">
                    👥 مدير قسم — يرى بياناته + بيانات فريقه
                  </SelectItem>
                  <SelectItem value="admin">
                    🛡️ مدير نظام — يرى كل بيانات الجمعية
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                يمكن تغيير هذا لاحقاً من صفحة تعديل الموظف.
              </p>
            </div>

            <Separator />

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
                  <Plus className="w-4 h-4" />
                )}
                إضافة الموظف
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AddEmployee;
