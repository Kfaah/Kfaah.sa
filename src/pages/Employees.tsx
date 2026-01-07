import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Mail, Phone, Users, UserCheck, Clock, TrendingUp, Eye, EyeOff, Camera, Loader2, Upload, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
}

const initialEmployees: Employee[] = [];

const roles = [
  { value: "مسؤول السلات المتروكة", color: "bg-rose-500" },
  { value: "مسؤول الحملات وكبار الداعمين", color: "bg-emerald-500" },
  { value: "مسؤول الاستقطاع الدوري", color: "bg-accent" },
  { value: "مسؤول تطوير المتجر", color: "bg-violet-500" },
  { value: "المشرف العام", color: "bg-primary" },
];

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
  const [searchQuery, setSearchQuery] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    role: "",
    password: "",
    avatar: "",
    avatarFile: null as File | null,
  });
  const [showPassword, setShowPassword] = useState(false);

  // Fetch employees from database
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from("employees")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        
        setEmployees(data as Employee[] || []);
      } catch (error) {
        console.error("Error fetching employees:", error);
        toast.error("حدث خطأ أثناء جلب بيانات الموظفين");
      } finally {
        setIsFetching(false);
      }
    };

    fetchEmployees();
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
    if (!newEmployee.name || !newEmployee.username || !newEmployee.role || !newEmployee.password) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    if (newEmployee.password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
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

      const roleData = roles.find(r => r.value === newEmployee.role);

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
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      // Add the new employee to the list
      if (response.data?.employee) {
        setEmployees([response.data.employee, ...employees]);
      }

      setNewEmployee({ name: "", username: "", email: "", phone: "", role: "", password: "", avatar: "", avatarFile: null });
      setIsDialogOpen(false);
      toast.success("تم إضافة الموظف بنجاح");
    } catch (error: any) {
      console.error("Error adding employee:", error);
      toast.error(error.message || "حدث خطأ أثناء إضافة الموظف");
    } finally {
      setIsLoading(false);
    }
  };

  const stats = [
    { label: "إجمالي الموظفين", value: employees.length, icon: Users, iconBg: "bg-accent/10", iconColor: "text-accent" },
    { label: "نشطين", value: employees.filter(e => e.status === "active").length, icon: UserCheck, iconBg: "bg-emerald-100", iconColor: "text-emerald-500" },
    { label: "في إجازة", value: employees.filter(e => e.status === "on_leave").length, icon: Clock, iconBg: "bg-amber-100", iconColor: "text-amber-500" },
    { label: "متوسط الأداء", value: employees.length > 0 ? `${Math.round(employees.reduce((acc, e) => acc + e.performance, 0) / employees.length)}%` : "0%", icon: TrendingUp, iconBg: "bg-violet-100", iconColor: "text-violet-500" },
  ];

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الموظفين</h1>
          <p className="text-muted-foreground mt-1">إدارة فريق العمل</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-2xl bg-accent hover:bg-accent/90 text-accent-foreground shadow-md">
              <Plus className="w-4 h-4" />
              إضافة موظف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right">إضافة موظف جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
              {/* صورة الموظف */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30 overflow-hidden">
                    {isUploadingImage ? (
                      <Loader2 className="w-8 h-8 text-muted-foreground/50 animate-spin" />
                    ) : newEmployee.avatar ? (
                      <img src={newEmployee.avatar} alt="صورة الموظف" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>
                  {newEmployee.avatar && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:bg-destructive/90"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Label className="text-sm text-muted-foreground">صورة (شخصية/رمزية) - اختيارية</Label>
                <div className="flex gap-2 w-full">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-colors">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm font-medium">رفع صورة</span>
                    </div>
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
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">الاسم الكامل *</Label>
                <Input
                  id="name"
                  placeholder="أدخل اسم الموظف"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم *</Label>
                <Input
                  id="username"
                  placeholder="رمز أو رقم أو اسم (مثال: emp001)"
                  value={newEmployee.username}
                  onChange={(e) => setNewEmployee({ ...newEmployee, username: e.target.value })}
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">يستخدم لتسجيل الدخول</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                    className="pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني (اختياري)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@atef.org"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">رقم الجوال (اختياري)</Label>
                <Input
                  id="phone"
                  placeholder="+966 5x xxx xxxx"
                  value={newEmployee.phone}
                  onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label>الدور الوظيفي *</Label>
                <Select
                  value={newEmployee.role}
                  onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الدور الوظيفي" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleAddEmployee} 
                className="w-full bg-accent hover:bg-accent/90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الإضافة...
                  </>
                ) : (
                  "إضافة الموظف"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
                  <span className={cn("font-bold", getPerformanceColor(employee.performance))}>
                    {employee.performance}%
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
                  <span className="font-medium">{employee.tasks_completed}/{employee.tasks_total}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}
    </DashboardLayout>
  );
};

export default Employees;
