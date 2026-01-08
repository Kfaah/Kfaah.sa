import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, User, Mail, Phone, Building, MapPin, Pencil, X, Briefcase, AtSign } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const positiveMessages = [
  "أهلاً بك! يومك سعيد 🌟",
  "نتمنى لك يوماً مليئاً بالإنجازات ✨",
  "رائع! استمر في العمل المميز 💪",
  "بارك الله في جهودك 🙏",
  "معاً نحو النجاح 🚀",
  "أنت مميز في عملك! ⭐",
  "عملك يصنع الفرق 🌈",
  "استمر في التميز والإبداع 🎯",
  "نقدر جهودك الرائعة 💎",
  "أنت جزء مهم من فريقنا 🤝",
  "يوم جديد فرص جديدة 🌅",
  "ثقتك بنفسك مفتاح النجاح 🔑",
  "كل خطوة صغيرة تصنع فرقاً كبيراً 👣",
  "إيجابيتك تلهم الآخرين ☀️",
  "عملك له أثر عظيم 🏆",
  "أنت تصنع المستحيل ممكناً 💫",
  "جودة عملك تتحدث عنك 📈",
  "إبداعك لا حدود له 🎨",
  "أنت مصدر إلهام للجميع 🌻",
  "نجاحك نجاح لنا جميعاً 🎉",
  "تفانيك في العمل محل تقدير 🙌",
  "أنت تجعل بيئة العمل أفضل 🏡",
  "طاقتك الإيجابية معدية 😊",
  "عطاؤك لا ينضب 💝",
  "مستقبل مشرق ينتظرك 🔮",
  "أنت قائد بالفطرة 👑",
  "إصرارك يستحق الإعجاب 🦁",
  "كل يوم أنت أفضل من الأمس 📊",
  "شغفك واضح في كل ما تفعله 🔥",
  "نفخر بوجودك معنا 🌟",
];

interface Department {
  id: string;
  name: string;
}

interface JobRole {
  id: string;
  name: string;
}

export default function Profile() {
  const { user: authUser } = useAuth();
  const { user, loading, updateUser, updateProfileImage, uploadAvatar } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ ...user });
  const [currentMessage, setCurrentMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user is admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!authUser) return;
      
      const { data } = await supabase.rpc("has_role", {
        _user_id: authUser.id,
        _role: "admin",
      });
      
      setIsAdmin(data === true);
    };
    
    checkAdminRole();
  }, [authUser]);

  // Fetch departments and job roles
  useEffect(() => {
    const fetchData = async () => {
      const [deptRes, rolesRes] = await Promise.all([
        supabase.from("departments").select("id, name"),
        supabase.from("job_roles").select("id, name"),
      ]);
      
      if (deptRes.data) setDepartments(deptRes.data);
      if (rolesRes.data) setJobRoles(rolesRes.data);
    };
    
    fetchData();
  }, []);

  useEffect(() => {
    // Use day of year to show a different message each day
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - startOfYear.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const messageIndex = dayOfYear % positiveMessages.length;
    setCurrentMessage(positiveMessages[messageIndex]);
  }, []);

  // Sync editData when user data loads
  useEffect(() => {
    setEditData({ ...user });
  }, [user]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
      return;
    }

    try {
      toast.loading("جاري رفع الصورة...");
      const avatarUrl = await uploadAvatar(file);
      if (avatarUrl) {
        await updateProfileImage(avatarUrl);
        setEditData((prev) => ({ ...prev, profileImage: avatarUrl }));
        toast.dismiss();
        toast.success("تم تحديث الصورة بنجاح");
      }
    } catch (error) {
      toast.dismiss();
      toast.error("حدث خطأ أثناء رفع الصورة");
    }
  };

  const handleEdit = () => {
    if (!isAdmin) {
      toast.error("ليس لديك صلاحية تعديل الملف الشخصي");
      return;
    }
    setEditData({ ...user });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditData({ ...user });
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error("ليس لديك صلاحية تعديل الملف الشخصي");
      setIsEditing(false);
      return;
    }
    
    setSaving(true);
    try {
      await updateUser({
        firstName: editData.firstName,
        lastName: editData.lastName,
        email: editData.email,
        phone: editData.phone,
        department: editData.department,
        location: editData.location,
        username: editData.username,
        jobRole: editData.jobRole,
      });
      setIsEditing(false);
      toast.success("تم حفظ التغييرات بنجاح");
    } catch (error) {
      toast.error("حدث خطأ أثناء حفظ البيانات");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  // View Mode Render
  const renderViewMode = () => (
    <div className="space-y-6">
      {/* Profile Header Card */}
      <Card className="overflow-hidden">
        <div className="h-40 bg-gradient-to-l from-accent via-primary to-accent/80 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOC0xOHoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjIiLz48L2c+PC9zdmc+')] opacity-30" />
        </div>
        <CardContent className="relative pt-0 pb-8">
          <div className="flex flex-col sm:flex-row items-center gap-6 -mt-20">
            {/* Avatar */}
            <div className="relative group">
              <Avatar className="w-36 h-36 border-4 border-white shadow-2xl bg-white">
                <AvatarImage src={user.profileImage || undefined} alt="صورة الملف الشخصي" />
                <AvatarFallback className="text-4xl bg-white text-accent">
                  {user.firstName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                <Camera className="w-8 h-8 text-white" />
              </button>
            </div>
            
            <div className="text-center sm:text-right flex-1">
              <h2 className="text-3xl font-bold text-foreground">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-lg text-white mt-1 font-medium">{user.role}</p>
              <div className="mt-4 flex flex-wrap gap-3 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  متصل الآن
                </span>
                {user.department && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium">
                    <Building className="w-4 h-4" />
                    {user.department}
                  </span>
                )}
                {user.jobRole && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-medium">
                    <Briefcase className="w-4 h-4" />
                    {user.jobRole}
                  </span>
                )}
                {user.username && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                    <AtSign className="w-4 h-4" />
                    هوية: {user.username}
                  </span>
                )}
              </div>
            </div>

            {isAdmin && (
              <Button onClick={handleEdit} size="lg" className="gap-2">
                <Pencil className="w-4 h-4" />
                تعديل الملف الشخصي
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="w-5 h-5 text-accent" />
              معلومات التواصل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                <p className="font-medium text-foreground" dir="ltr">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">رقم الهاتف</p>
                <p className="font-medium text-foreground" dir="ltr">{user.phone}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Work Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building className="w-5 h-5 text-accent" />
              معلومات العمل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.department && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <Building className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">القسم</p>
                  <p className="font-medium text-foreground">{user.department}</p>
                </div>
              </div>
            )}
            {user.jobRole && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الدور الوظيفي</p>
                  <p className="font-medium text-foreground">{user.jobRole}</p>
                </div>
              </div>
            )}
            {user.location && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الموقع</p>
                  <p className="font-medium text-foreground">{user.location}</p>
                </div>
              </div>
            )}
            {user.username && (
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <AtSign className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">اسم المستخدم</p>
                  <p className="font-medium text-foreground" dir="ltr">{user.username}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Positive Message at Bottom */}
      {currentMessage && !isEditing && (
        <div className="bg-gradient-to-r from-cyan-50 to-teal-50 rounded-2xl py-4 px-6 border border-cyan-200 animate-fade-in text-center">
          <span className="text-lg font-medium text-cyan-700">{currentMessage}</span>
        </div>
      )}
    </div>
  );

  // Edit Mode Render
  const renderEditMode = () => (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Pencil className="w-5 h-5 text-accent" />
            تعديل الملف الشخصي
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
      </Card>

      {/* Profile Picture */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="w-24 h-24 border-4 border-accent/20">
                <AvatarImage src={user.profileImage || undefined} alt="صورة الملف الشخصي" />
                <AvatarFallback className="text-2xl bg-gradient-to-br from-accent to-primary text-white">
                  {editData.firstName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                <Camera className="w-6 h-6 text-white" />
              </button>
            </div>
            <div>
              <h3 className="font-semibold text-lg">صورة الملف الشخصي</h3>
              <p className="text-sm text-muted-foreground mb-3">اضغط على الصورة لتغييرها</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Camera className="w-4 h-4" />
                تغيير الصورة
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <User className="w-5 h-5 text-accent" />
            المعلومات الشخصية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-base">الاسم الأول</Label>
              <Input
                id="firstName"
                value={editData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                className="text-base h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-base">اسم العائلة</Label>
              <Input
                id="lastName"
                value={editData.lastName}
                onChange={(e) => handleInputChange("lastName", e.target.value)}
                className="text-base h-12"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                البريد الإلكتروني
              </Label>
              <Input
                id="email"
                type="email"
                value={editData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="text-base h-12"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                رقم الهاتف
              </Label>
              <Input
                id="phone"
                type="tel"
                value={editData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className="text-base h-12"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="department" className="text-base flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                القسم
              </Label>
              <Select
                value={editData.department || ""}
                onValueChange={(value) => handleInputChange("department", value)}
              >
                <SelectTrigger className="text-base h-12">
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobRole" className="text-base flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                الدور الوظيفي
              </Label>
              <Select
                value={editData.jobRole || ""}
                onValueChange={(value) => handleInputChange("jobRole", value)}
              >
                <SelectTrigger className="text-base h-12">
                  <SelectValue placeholder="اختر الدور الوظيفي" />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-base flex items-center gap-2">
                <AtSign className="w-4 h-4 text-muted-foreground" />
                اسم المستخدم - رقم الهوية (ID)
              </Label>
              <Input
                id="username"
                value={editData.username || ""}
                onChange={(e) => handleInputChange("username", e.target.value)}
                className="text-base h-12"
                dir="ltr"
                placeholder="أدخل رقم الهوية الوطنية"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location" className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                الموقع
              </Label>
              <Input
                id="location"
                value={editData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                className="text-base h-12"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" size="lg" onClick={handleCancel}>
          إلغاء
        </Button>
        <Button type="button" onClick={handleSave} size="lg" className="gap-2 bg-gradient-to-l from-accent to-primary hover:opacity-90">
          <Save className="w-4 h-4" />
          حفظ التغييرات
        </Button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">الملف الشخصي</h1>
            <p className="text-muted-foreground mt-1">
              {isEditing ? "تعديل معلوماتك الشخصية" : "عرض وإدارة معلوماتك الشخصية"}
            </p>
          </div>
        </div>

        {/* Single shared file input for both View/Edit mode */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        {isEditing ? renderEditMode() : renderViewMode()}
      </div>
    </DashboardLayout>
  );
}
