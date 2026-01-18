import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Mail, Phone, Users, UserCheck, Clock, TrendingUp, Eye, EyeOff, Camera, Loader2, Upload, X, Pencil, LogIn, Building, Briefcase, ClipboardList } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getArabicErrorMessage } from "@/lib/errors";
import { useUser } from "@/contexts/UserContext";

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
  join_date: string;
  tasks_completed: number;
  tasks_total: number;
  performance: number;
  direct_manager_id: string | null;
  executive_manager_id: string | null;
  title: string | null;
}

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

const initialEmployees: Employee[] = [];

const statusConfig = {
  active: { label: "نشط", className: "bg-emerald-100 text-emerald-600 border-emerald-200" },
  on_leave: { label: "في إجازة", className: "bg-amber-100 text-amber-600 border-amber-200" },
  inactive: { label: "غير نشط", className: "bg-muted text-muted-foreground border-border" },
};

const getPerformanceColor = (performance: number) => {
  if (performance >= 90) return "text-emerald-500";
  if (performance >= 75) return "text-amber-500";
  return "text-rose-500";
};

const getPerformanceBarColor = (performance: number) => {
  if (performance >= 90) return "bg-emerald-500";
  if (performance >= 75) return "bg-amber-500";
  return "bg-rose-500";
};

const Employees = () => {
  const navigate = useNavigate();
  const { setPreviewingEmployee } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [newEmployee, setNewEmployee] = useState({
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
  });

  type AddEmployeeField = "name" | "username" | "password" | "email" | "phone" | "department" | "role";
  const [addErrors, setAddErrors] = useState<Partial<Record<AddEmployeeField, string>>>({});

  const clearAddError = (field: AddEmployeeField) => {
    setAddErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editSelectedDepartment, setEditSelectedDepartment] = useState<string>("");
  const [editDirectManagerId, setEditDirectManagerId] = useState<string>("");
  const [editExecutiveManagerId, setEditExecutiveManagerId] = useState<string>("");
  const [editTitle, setEditTitle] = useState<string>("");
  type EditEmployeeField = "full_name" | "username" | "email" | "phone" | "job_role" | "password" | "department" | "status" | "direct_manager" | "executive_manager" | "title";
  const [editErrors, setEditErrors] = useState<Partial<Record<EditEmployeeField, string>>>({});
  const [newDepartment, setNewDepartment] = useState({ name: "", color: "bg-primary" });
  const [newRole, setNewRole] = useState({ name: "", color: "bg-primary", department_id: "" });
  const [showPassword, setShowPassword] = useState(false);

  // Fetch employees, departments, and job roles
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employeesRes, deptsRes, rolesRes] = await Promise.all([
          supabase.from("employees").select("*").order("created_at", { ascending: false }),
          supabase.from("departments").select("*").order("name"),
          supabase.from("job_roles").select("*").order("name"),
        ]);

        if (employeesRes.error) throw employeesRes.error;
        if (deptsRes.error) throw deptsRes.error;
        if (rolesRes.error) throw rolesRes.error;
        
        setEmployees(employeesRes.data as Employee[] || []);
        setDepartments(deptsRes.data as Department[] || []);
        setJobRoles(rolesRes.data as JobRole[] || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("حدث خطأ أثناء جلب البيانات");
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, []);

  const filteredEmployees = employees.filter((employee) =>
    employee.full_name.includes(searchQuery) || employee.job_role.includes(searchQuery)
  );

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
      // Create a preview URL
      const previewUrl = URL.createObjectURL(file);
      setNewEmployee(prev => ({ ...prev, avatar: previewUrl, avatarFile: file }));
    } catch (error) {
      console.error("Error handling image:", error);
      toast.error("حدث خطأ أثناء معالجة الصورة");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const uploadImageToStorage = async (file: File, userId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `employees/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    }
  };

  const removeImage = () => {
    if (newEmployee.avatar && newEmployee.avatar.startsWith("blob:")) {
      URL.revokeObjectURL(newEmployee.avatar);
    }
    setNewEmployee(prev => ({ ...prev, avatar: "", avatarFile: null }));
  };

  const handleAddEmployee = async () => {
    const nextErrors: Partial<Record<AddEmployeeField, string>> = {};

    if (!newEmployee.name.trim()) nextErrors.name = "الاسم مطلوب";
    if (!newEmployee.username.trim()) {
      nextErrors.username = "رقم الهوية مطلوب";
    } else if (!/^\d{10}$/.test(newEmployee.username.trim())) {
      nextErrors.username = "رقم الهوية يجب أن يتكون من 10 أرقام فقط";
    }
    if (!newEmployee.password) nextErrors.password = "كلمة المرور مطلوبة";
    if (newEmployee.password && newEmployee.password.length < 6)
      nextErrors.password = "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    if (!newEmployee.email.trim()) nextErrors.email = "البريد الإلكتروني مطلوب";
    if (!newEmployee.phone.trim()) nextErrors.phone = "رقم الجوال مطلوب";
    if (!newEmployee.department) nextErrors.department = "القسم مطلوب";
    if (!newEmployee.role) nextErrors.role = "الدور الوظيفي مطلوب";

    if (Object.keys(nextErrors).length > 0) {
      setAddErrors(nextErrors);
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

      const roleData = jobRoles.find(r => r.name === newEmployee.role);

      // Upload image if file exists
      let avatarUrl = null;
      if (newEmployee.avatarFile) {
        const tempId = Date.now().toString();
        avatarUrl = await uploadImageToStorage(newEmployee.avatarFile, tempId);
      }

      const response = await supabase.functions.invoke("create-employee", {
        body: {
          fullName: newEmployee.name,
          username: newEmployee.username,
          password: newEmployee.password,
          email: newEmployee.email || null,
          phone: newEmployee.phone || null,
          jobRole: newEmployee.role,
          roleColor: roleData?.color || "bg-primary",
          avatarUrl: avatarUrl,
          directManagerId: newEmployee.directManagerId && newEmployee.directManagerId !== "none" ? newEmployee.directManagerId : null,
          executiveManagerId: newEmployee.executiveManagerId && newEmployee.executiveManagerId !== "none" ? newEmployee.executiveManagerId : null,
        },
      });

      if (response.error) {
        toast.error(getArabicErrorMessage(response.error, "حدث خطأ أثناء إضافة الموظف"));
        return;
      }

      if (response.data?.fieldErrors) {
        setAddErrors(response.data.fieldErrors as Partial<Record<AddEmployeeField, string>>);
        return;
      }

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      // Add the new employee to the list
      if (response.data?.employee) {
        setEmployees([response.data.employee, ...employees]);
      }

      setNewEmployee({ name: "", username: "", email: "", phone: "", role: "", department: "", password: "", avatar: "", avatarFile: null, directManagerId: "", executiveManagerId: "" });
      setAddErrors({});
      setIsDialogOpen(false);
      toast.success("تم إضافة الموظف بنجاح");
    } catch (error: any) {
      console.error("Error adding employee:", error);
      toast.error(getArabicErrorMessage(error, "حدث خطأ أثناء إضافة الموظف"));
    } finally {
      setIsLoading(false);
    }
  };

  // Add Department
  const handleAddDepartment = async () => {
    if (!newDepartment.name) {
      toast.error("يرجى إدخال اسم القسم");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("departments")
        .insert({ name: newDepartment.name, color: newDepartment.color })
        .select()
        .single();
      
      if (error) throw error;
      setDepartments([...departments, data as Department]);
      setNewDepartment({ name: "", color: "bg-primary" });
      setIsDeptDialogOpen(false);
      toast.success("تم إضافة القسم بنجاح");
    } catch (error: any) {
      toast.error(getArabicErrorMessage(error, "حدث خطأ"));
    } finally {
      setIsLoading(false);
    }
  };

  // Add Job Role
  const handleAddRole = async () => {
    if (!newRole.name) {
      toast.error("يرجى إدخال اسم الدور");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("job_roles")
        .insert({ 
          name: newRole.name, 
          color: newRole.color,
          department_id: newRole.department_id || null 
        })
        .select()
        .single();
      
      if (error) throw error;
      setJobRoles([...jobRoles, data as JobRole]);
      setNewRole({ name: "", color: "bg-primary", department_id: "" });
      setIsRoleDialogOpen(false);
      toast.success("تم إضافة الدور بنجاح");
    } catch (error: any) {
      toast.error(getArabicErrorMessage(error, "حدث خطأ"));
    } finally {
      setIsLoading(false);
    }
  };

  // Edit Employee
  const handleEditEmployee = async () => {
    if (!editingEmployee) return;
    
    // Validation
    const nextErrors: Partial<Record<EditEmployeeField, string>> = {};
    if (!editingEmployee.full_name.trim()) nextErrors.full_name = "الاسم مطلوب";
    if (!editingEmployee.username?.trim()) {
      nextErrors.username = "رقم الهوية مطلوب";
    } else if (!/^\d{10}$/.test(editingEmployee.username.trim())) {
      nextErrors.username = "رقم الهوية يجب أن يتكون من 10 أرقام فقط";
    }
    if (!editingEmployee.email?.trim()) nextErrors.email = "البريد الإلكتروني مطلوب";
    if (!editingEmployee.phone?.trim()) nextErrors.phone = "رقم الجوال مطلوب";
    
    // التحقق من القسم
    if (!editSelectedDepartment) nextErrors.department = "القسم مطلوب";
    
    if (!editingEmployee.job_role?.trim()) nextErrors.job_role = "الدور الوظيفي مطلوب";
    if (!editingEmployee.status?.trim()) nextErrors.status = "الحالة مطلوبة";
    if (editPassword && editPassword.length < 6) nextErrors.password = "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
    
    if (Object.keys(nextErrors).length > 0) {
      setEditErrors(nextErrors);
      return;
    }
    
    setIsLoading(true);
    try {
      let avatarUrl = editingEmployee.avatar_url;
      
      // Upload new avatar if selected
      if (editAvatarFile) {
        const uploadedUrl = await uploadImageToStorage(editAvatarFile, editingEmployee.id);
        if (uploadedUrl) {
          avatarUrl = uploadedUrl;
        }
      }

      const { error } = await supabase
        .from("employees")
        .update({
          full_name: editingEmployee.full_name,
          username: editingEmployee.username,
          email: editingEmployee.email,
          phone: editingEmployee.phone,
          job_role: editingEmployee.job_role,
          status: editingEmployee.status,
          avatar_url: avatarUrl,
          direct_manager_id: editDirectManagerId && editDirectManagerId !== "none" ? editDirectManagerId : null,
          executive_manager_id: editExecutiveManagerId && editExecutiveManagerId !== "none" ? editExecutiveManagerId : null,
          title: editTitle.trim() || null,
        })
        .eq("id", editingEmployee.id);
      
      if (error) throw error;
      
      // ربط بيانات الدخول (رقم الهوية) مع حساب الدخول
      if (editingEmployee.user_id) {
        const response = await supabase.functions.invoke("create-employee", {
          body: {
            action: "sync-login",
            userId: editingEmployee.user_id,
            username: editingEmployee.username,
          },
        });

        if (response.error || response.data?.success === false) {
          console.error("Error syncing login:", response.error || response.data);
          throw new Error(response.data?.error || "تعذر ربط بيانات الدخول");
        }
      }

      // Update password if provided
      if (editPassword && editingEmployee.user_id) {
        const response = await supabase.functions.invoke("create-employee", {
          body: {
            action: "update-password",
            userId: editingEmployee.user_id,
            password: editPassword,
          },
        });

        if (response.error || response.data?.success === false) {
          console.error("Error updating password:", response.error || response.data);
          throw new Error(response.data?.error || "تعذر تحديث كلمة المرور");
        }
      }
      const updatedEmployee = { 
        ...editingEmployee, 
        avatar_url: avatarUrl,
        direct_manager_id: editDirectManagerId && editDirectManagerId !== "none" ? editDirectManagerId : null,
        executive_manager_id: editExecutiveManagerId && editExecutiveManagerId !== "none" ? editExecutiveManagerId : null,
        title: editTitle.trim() || null,
      };
      setEmployees(employees.map(e => e.id === editingEmployee.id ? updatedEmployee : e));
      setIsEditDialogOpen(false);
      setEditingEmployee(null);
      setEditAvatarFile(null);
      setEditPassword("");
      setEditDirectManagerId("");
      setEditExecutiveManagerId("");
      setEditTitle("");
      setEditErrors({});
      toast.success("تم تحديث بيانات الموظف");
    } catch (error: any) {
      toast.error(getArabicErrorMessage(error, "حدث خطأ"));
    } finally {
      setIsLoading(false);
    }
  };

  // Impersonate User - Login as employee using edge function
  const [isImpersonating, setIsImpersonating] = useState(false);
  
  const handleImpersonate = async (employee: Employee) => {
    if (!employee.user_id) {
      toast.error("هذا الموظف ليس له حساب مستخدم");
      return;
    }
    
    setIsImpersonating(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("impersonate-user", {
        body: { userId: employee.user_id },
      });
      
      if (response.error) {
        throw new Error(response.error.message || "حدث خطأ أثناء الدخول");
      }
      
      if (response.data?.actionLink) {
        // Save original admin session info
        localStorage.setItem("adminReturnSession", JSON.stringify({
          returnUrl: window.location.pathname,
          adminName: "المدير",
        }));
        
        toast.success(`جاري الدخول كـ ${employee.full_name}...`);
        
        // Redirect to the magic link with cache bust to ensure latest version
        const actionUrl = new URL(response.data.actionLink);
        actionUrl.searchParams.set("_t", Date.now().toString());
        window.location.href = actionUrl.toString();
      } else {
        throw new Error("لم يتم إنشاء رابط الدخول");
      }
    } catch (error: any) {
      console.error("Impersonate error:", error);
      toast.error(error.message || "حدث خطأ أثناء الدخول على حساب الموظف");
    } finally {
      setIsImpersonating(false);
    }
  };

  const handleImpersonateToApprovals = async (employee: Employee) => {
    if (!employee.user_id) {
      toast.error("هذا الموظف ليس له حساب مستخدم");
      return;
    }
    
    setIsImpersonating(true);
    
    try {
      const response = await supabase.functions.invoke("impersonate-user", {
        body: { userId: employee.user_id },
      });
      
      if (response.error) {
        throw new Error(response.error.message || "حدث خطأ أثناء الدخول");
      }
      
      if (response.data?.actionLink) {
        // Save original admin session info with redirect to approvals history
        localStorage.setItem("adminReturnSession", JSON.stringify({
          returnUrl: window.location.pathname,
          adminName: "المدير",
        }));
        
        toast.success(`جاري فتح سجل موافقات ${employee.full_name}...`);
        
        // Redirect to the magic link with a redirect param to approvals history + cache bust
        const actionUrl = new URL(response.data.actionLink);
        actionUrl.searchParams.set("redirect_to", "/hr-requests?section=my-approvals-history");
        actionUrl.searchParams.set("_t", Date.now().toString());
        window.location.href = actionUrl.toString();
      } else {
        throw new Error("لم يتم إنشاء رابط الدخول");
      }
    } catch (error: any) {
      console.error("Impersonate error:", error);
      toast.error(error.message || "حدث خطأ أثناء الدخول على حساب الموظف");
    } finally {
      setIsImpersonating(false);
    }
  };

  const stats = [
    { label: "إجمالي الموظفين", value: formatNumber(employees.length), icon: Users, iconBg: "bg-accent/10", iconColor: "text-accent" },
    { label: "نشطين", value: formatNumber(employees.filter(e => e.status === "active").length), icon: UserCheck, iconBg: "bg-emerald-100", iconColor: "text-emerald-500" },
    { label: "في إجازة", value: formatNumber(employees.filter(e => e.status === "on_leave").length), icon: Clock, iconBg: "bg-amber-100", iconColor: "text-amber-500" },
    { label: "متوسط الأداء", value: employees.length > 0 ? formatPercent(Math.round(employees.reduce((acc, e) => acc + e.performance, 0) / employees.length)) : formatPercent(0), icon: TrendingUp, iconBg: "bg-violet-100", iconColor: "text-violet-500" },
  ];

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الموظفين</h1>
          <p className="text-muted-foreground mt-1">إدارة فريق العمل</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Add Department Dialog */}
          <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-2xl">
                <Building className="w-4 h-4" />
                إضافة قسم
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right">إضافة قسم جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم القسم *</Label>
                  <Input
                    placeholder="أدخل اسم القسم"
                    value={newDepartment.name}
                    onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                  />
                </div>
                <Button onClick={handleAddDepartment} className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  إضافة القسم
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Role Dialog */}
          <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-2xl">
                <Briefcase className="w-4 h-4" />
                إضافة دور
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-right">إضافة دور وظيفي جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم الدور *</Label>
                  <Input
                    placeholder="أدخل اسم الدور الوظيفي"
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>القسم (اختياري)</Label>
                  <Select
                    value={newRole.department_id}
                    onValueChange={(value) => setNewRole({ ...newRole, department_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر القسم" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddRole} className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  إضافة الدور
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Employee Button - Navigate to new page */}
          <Button 
            className="gap-2 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground shadow-md"
            onClick={() => navigate("/employees/add")}
          >
            <Plus className="w-4 h-4" />
            إضافة موظف
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <Card
            key={stat.label}
            className="bg-card rounded-3xl shadow-card animate-slide-up border-border"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.iconBg)}>
                <stat.icon className={cn("w-6 h-6", stat.iconColor)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن موظف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-12 rounded-2xl bg-card border-border"
          />
        </div>
      </div>

      {/* Employees Grid */}
      {isFetching ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">لا يوجد موظفين حالياً</p>
          <p className="text-sm text-muted-foreground mt-1">اضغط على "إضافة موظف" لإضافة موظف جديد</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((employee, index) => (
          <Card
            key={employee.id}
            className="bg-card rounded-3xl shadow-card hover:shadow-card-hover transition-all duration-300 animate-slide-up border-border overflow-hidden"
            style={{ animationDelay: `${250 + index * 50}ms` }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {employee.avatar_url ? (
                    <img 
                      src={employee.avatar_url} 
                      alt={employee.full_name}
                      className="w-14 h-14 rounded-full object-cover shadow-md"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-lg font-bold text-primary-foreground shadow-md">
                      {employee.full_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-foreground">{employee.full_name}</h3>
                    <p className={cn("text-xs mt-1", employee.role_color.replace("bg-", "text-"))}>
                      {employee.job_role}
                    </p>
                  </div>
                </div>
                <Badge className={cn("text-xs rounded-full border", statusConfig[employee.status].className)}>
                  {statusConfig[employee.status].label}
                </Badge>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  {employee.email}
                </div>
                {employee.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    {employee.phone}
                  </div>
                )}
              </div>

              {/* Performance Section */}
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">الأداء</span>
                  <span className={cn("font-bold", getPerformanceColor(employee.performance))} style={{ fontFamily: 'Arial, sans-serif' }}>
                    {formatPercent(employee.performance)}
                  </span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", getPerformanceBarColor(employee.performance))}
                    style={{ width: `${employee.performance}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-3 text-sm">
                  <span className="text-muted-foreground">المهام المنجزة</span>
                  <span className="font-medium" style={{ fontFamily: 'Arial, sans-serif' }}>{formatNumber(employee.tasks_completed)}/{formatNumber(employee.tasks_total)}</span>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      setEditingEmployee(employee);
                      // تعيين القسم المختار بناءً على الدور الوظيفي الحالي
                      const currentRole = jobRoles.find(r => r.name === employee.job_role);
                      setEditSelectedDepartment(currentRole?.department_id || "");
                      // تعيين المدير المباشر والتنفيذي
                      setEditDirectManagerId(employee.direct_manager_id || "");
                      setEditExecutiveManagerId(employee.executive_manager_id || "");
                      // تعيين اللقب
                      setEditTitle(employee.title || "");
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                    تعديل
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-primary hover:bg-primary hover:text-primary-foreground"
                    onClick={() => handleImpersonate(employee)}
                    disabled={!employee.user_id || isImpersonating}
                  >
                    {isImpersonating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <LogIn className="w-3 h-3" />
                    )}
                    دخول
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-accent hover:bg-accent hover:text-accent-foreground"
                    onClick={() => handleImpersonateToApprovals(employee)}
                    disabled={!employee.user_id || isImpersonating}
                    title="عرض سجل موافقات الموظف"
                  >
                    {isImpersonating ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ClipboardList className="w-3 h-3" />
                    )}
                    الموافقات
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {/* Edit Employee Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل بيانات الموظف</DialogTitle>
          </DialogHeader>
          {editingEmployee && (
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
              {/* صورة الموظف */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30 overflow-hidden">
                    {editAvatarFile ? (
                      <img src={URL.createObjectURL(editAvatarFile)} alt="صورة الموظف" className="w-full h-full object-cover" />
                    ) : editingEmployee.avatar_url ? (
                      <img src={editingEmployee.avatar_url} alt="صورة الموظف" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>
                  {(editAvatarFile || editingEmployee.avatar_url) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditAvatarFile(null);
                        setEditingEmployee({ ...editingEmployee, avatar_url: null });
                      }}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:bg-destructive/90"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <label className="cursor-pointer">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">تغيير الصورة</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setEditAvatarFile(file);
                    }}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <Label>الاسم <span className="text-destructive">*</span></Label>
                <Input
                  value={editingEmployee.full_name}
                  onChange={(e) => {
                    setEditingEmployee({ ...editingEmployee, full_name: e.target.value });
                    if (editErrors.full_name) setEditErrors(prev => ({ ...prev, full_name: undefined }));
                  }}
                  className={editErrors.full_name ? "border-destructive" : ""}
                />
                {editErrors.full_name && <p className="text-xs text-destructive">{editErrors.full_name}</p>}
              </div>

              <div className="space-y-2">
                <Label>اسم المستخدم - رقم الهوية (ID) <span className="text-destructive">*</span></Label>
                <Input
                  value={editingEmployee.username || ""}
                  onChange={(e) => {
                    setEditingEmployee({ ...editingEmployee, username: e.target.value });
                    if (editErrors.username) setEditErrors(prev => ({ ...prev, username: undefined }));
                  }}
                  dir="ltr"
                  placeholder="أدخل رقم الهوية الوطنية"
                  className={editErrors.username ? "border-destructive" : ""}
                />
                {editErrors.username && <p className="text-xs text-destructive">{editErrors.username}</p>}
              </div>

              <div className="space-y-2">
                <Label>كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => {
                      setEditPassword(e.target.value);
                      if (editErrors.password) setEditErrors(prev => ({ ...prev, password: undefined }));
                    }}
                    dir="ltr"
                    placeholder="اترك فارغاً للإبقاء على كلمة المرور الحالية"
                    className={editErrors.password ? "border-destructive pl-10" : "pl-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {editErrors.password && <p className="text-xs text-destructive">{editErrors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label>البريد الإلكتروني <span className="text-destructive">*</span></Label>
                <Input
                  type="email"
                  value={editingEmployee.email || ""}
                  onChange={(e) => {
                    setEditingEmployee({ ...editingEmployee, email: e.target.value });
                    if (editErrors.email) setEditErrors(prev => ({ ...prev, email: undefined }));
                  }}
                  dir="ltr"
                  className={editErrors.email ? "border-destructive" : ""}
                />
                {editErrors.email && <p className="text-xs text-destructive">{editErrors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label>رقم الجوال <span className="text-destructive">*</span></Label>
                <Input
                  value={editingEmployee.phone || ""}
                  onChange={(e) => {
                    setEditingEmployee({ ...editingEmployee, phone: e.target.value });
                    if (editErrors.phone) setEditErrors(prev => ({ ...prev, phone: undefined }));
                  }}
                  dir="ltr"
                  className={editErrors.phone ? "border-destructive" : ""}
                />
                {editErrors.phone && <p className="text-xs text-destructive">{editErrors.phone}</p>}
              </div>

              <div className="space-y-2">
                <Label>القسم <span className="text-destructive">*</span></Label>
                <Select
                  value={editSelectedDepartment}
                  onValueChange={(value) => {
                    setEditSelectedDepartment(value);
                    // عند تغيير القسم، نعيد تعيين الدور الوظيفي
                    setEditingEmployee({ ...editingEmployee, job_role: "" });
                    if (editErrors.department) setEditErrors(prev => ({ ...prev, department: undefined }));
                  }}
                >
                  <SelectTrigger className={editErrors.department ? "border-destructive" : ""}>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editErrors.department && <p className="text-xs text-destructive">{editErrors.department}</p>}
              </div>

              <div className="space-y-2">
                <Label>الدور الوظيفي <span className="text-destructive">*</span></Label>
                <Select
                  value={editingEmployee.job_role}
                  onValueChange={(value) => {
                    setEditingEmployee({ ...editingEmployee, job_role: value });
                    if (editErrors.job_role) setEditErrors(prev => ({ ...prev, job_role: undefined }));
                    if (editErrors.department) setEditErrors(prev => ({ ...prev, department: undefined }));
                  }}
                >
                  <SelectTrigger className={editErrors.job_role ? "border-destructive" : ""}>
                    <SelectValue placeholder="اختر الدور الوظيفي" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobRoles
                      .filter(role => role.department_id === editSelectedDepartment)
                      .map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          {role.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {editErrors.job_role && <p className="text-xs text-destructive">{editErrors.job_role}</p>}
              </div>

              <div className="space-y-2">
                <Label>الحالة <span className="text-destructive">*</span></Label>
                <Select
                  value={editingEmployee.status}
                  onValueChange={(value: "active" | "on_leave" | "inactive") => {
                    setEditingEmployee({ ...editingEmployee, status: value });
                    if (editErrors.status) setEditErrors(prev => ({ ...prev, status: undefined }));
                  }}
                >
                  <SelectTrigger className={editErrors.status ? "border-destructive" : ""}>
                    <SelectValue placeholder="اختر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="on_leave">في إجازة</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
                {editErrors.status && <p className="text-xs text-destructive">{editErrors.status}</p>}
              </div>

              {/* المدير المباشر */}
              <div className="space-y-2">
                <Label>المدير المباشر</Label>
                <Select
                  value={editDirectManagerId}
                  onValueChange={(value) => {
                    setEditDirectManagerId(value);
                    if (editErrors.direct_manager) setEditErrors(prev => ({ ...prev, direct_manager: undefined }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المدير المباشر" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون مدير مباشر</SelectItem>
                    {employees
                      .filter(emp => emp.id !== editingEmployee.id)
                      .map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name} - {emp.job_role}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {editErrors.direct_manager && <p className="text-xs text-destructive">{editErrors.direct_manager}</p>}
              </div>

              {/* المدير التنفيذي */}
              <div className="space-y-2">
                <Label>المدير التنفيذي</Label>
                <Select
                  value={editExecutiveManagerId}
                  onValueChange={(value) => {
                    setEditExecutiveManagerId(value);
                    if (editErrors.executive_manager) setEditErrors(prev => ({ ...prev, executive_manager: undefined }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المدير التنفيذي" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">بدون مدير تنفيذي</SelectItem>
                    {employees
                      .filter(emp => emp.id !== editingEmployee.id)
                      .map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name} - {emp.job_role}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {editDirectManagerId && editExecutiveManagerId && editDirectManagerId === editExecutiveManagerId && editDirectManagerId !== "none" && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>المدير المباشر والتنفيذي نفس الشخص - سيوافق مرة واحدة كمدير تنفيذي</span>
                  </p>
                )}
                {editErrors.executive_manager && <p className="text-xs text-destructive">{editErrors.executive_manager}</p>}
              </div>

              {/* اللقب المميز */}
              <div className="space-y-2">
                <Label>اللقب المميز</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="مثال: ضابط إيقاع الجمعية، العقل المفكر..."
                />
                <p className="text-xs text-muted-foreground">يظهر في الملف الشخصي للموظف</p>
              </div>

              <Button onClick={handleEditEmployee} className="w-full bg-accent hover:bg-accent/90" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                حفظ التغييرات
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Employees;
