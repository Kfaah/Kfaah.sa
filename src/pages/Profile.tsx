import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Camera, Save, User, Mail, Phone, Building, MapPin, Pencil, X, 
  Briefcase, AtSign, Bell, CheckCircle, Trash2, ClipboardList, 
  MessageSquare, ExternalLink, PenTool, FileText, FolderOpen 
} from "lucide-react";
import { MessagingSection } from "@/components/messaging/MessagingSection";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SignatureUpload } from "@/components/hr/SignatureUpload";
import { useQuery } from "@tanstack/react-query";

import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileSidebar, ProfileSection } from "@/components/profile/ProfileSidebar";
import { ProfileInfoSection } from "@/components/profile/ProfileInfoSection";
import { ProfileFilesSection } from "@/components/profile/ProfileFilesSection";
import { cn } from "@/lib/utils";


interface Department {
  id: string;
  name: string;
}

interface JobRole {
  id: string;
  name: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_task_id: string | null;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { user, loading, updateUser, updateProfileImage, uploadAvatar } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ ...user });
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [notificationFilter, setNotificationFilter] = useState<"all" | "tasks" | "messages" | "general">("all");
  const [currentSignature, setCurrentSignature] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("info");

  // جلب بيانات الموظف بما فيها التوقيع واللقب
  const { data: employeeData, refetch: refetchEmployee } = useQuery({
    queryKey: ["employee-data", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("id, signature_url, title")
        .eq("user_id", authUser.id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as { id: string; signature_url: string | null; title: string | null } | null;
    },
    enabled: !!authUser?.id,
  });

  // عدد الإشعارات غير المقروءة
  const unreadCount = notifications.filter(n => !n.is_read && !(n.type === "message" && !n.related_task_id)).length;

  // الأقسام
  const sections: ProfileSection[] = [
    { id: "info", label: "البيانات الشخصية", icon: User },
    { id: "signature", label: "التوقيع", icon: PenTool },
    { id: "messages", label: "الرسائل", icon: MessageSquare },
    { id: "notifications", label: "الإشعارات", icon: Bell, badge: unreadCount },
    { id: "files", label: "الملفات", icon: FolderOpen },
  ];

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

  // جلب الإشعارات
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!authUser) return;
      setLoadingNotifications(true);
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setNotifications(data || []);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoadingNotifications(false);
      }
    };
    fetchNotifications();

    const channel = supabase
      .channel('notifications-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
        toast.info("لديك إشعار جديد!");
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [authUser]);


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

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
        setNotifications(prev => prev.map(n => (n.id === notification.id ? { ...n, is_read: true } : n)));
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }
    if (notification.related_task_id) {
      if (notification.type === "message" || notification.type === "task_message") {
        navigate(`/tasks?task=${notification.related_task_id}&openChat=true`);
      } else {
        navigate(`/tasks?task=${notification.related_task_id}`);
      }
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
      setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n)));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await supabase.from("notifications").delete().eq("id", notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success("تم حذف الإشعار");
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success("تم تحديد جميع الإشعارات كمقروءة");
    } catch (error) {
      console.error("Error marking all as read:", error);
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

  const getNotificationStyle = (notification: Notification) => {
    const isTaskMessage = notification.type === "message" && !!notification.related_task_id;
    if (isTaskMessage) {
      return { icon: MessageSquare, bgColor: notification.is_read ? "bg-emerald-50" : "bg-emerald-100", iconColor: notification.is_read ? "text-emerald-400" : "text-emerald-600", badgeColor: "bg-emerald-500", badgeLabel: "رسالة مهمة" };
    }
    if (["status_update", "rating_update", "employee_update", "new_task", "task_assigned"].includes(notification.type)) {
      return { icon: ClipboardList, bgColor: notification.is_read ? "bg-blue-50" : "bg-blue-100", iconColor: notification.is_read ? "text-blue-400" : "text-blue-600", badgeColor: "bg-blue-500", badgeLabel: "مهمة" };
    }
    return { icon: Bell, bgColor: notification.is_read ? "bg-amber-50" : "bg-amber-100", iconColor: notification.is_read ? "text-amber-400" : "text-amber-600", badgeColor: "bg-amber-500", badgeLabel: "عامة" };
  };

  const filteredNotifications = notifications.filter((notification) => {
    const isDirectMessage = notification.type === "message" && !notification.related_task_id;
    if (isDirectMessage) return false;
    if (notificationFilter === "all") return true;
    const isTaskMessage = notification.type === "message" && !!notification.related_task_id;
    if (notificationFilter === "messages") return isTaskMessage;
    if (notificationFilter === "tasks") return ["status_update", "rating_update", "employee_update", "new_task", "task_assigned"].includes(notification.type);
    return !isTaskMessage && !["status_update", "rating_update", "employee_update", "new_task", "task_assigned"].includes(notification.type);
  });

  // Render Section Content
  const renderSectionContent = () => {
    switch (activeSection) {
      case "info":
        return <ProfileInfoSection user={user} />;
      
      case "signature":
        return authUser && employeeData ? (
          <SignatureUpload
            currentSignature={employeeData.signature_url}
            userId={authUser.id}
            onSignatureUpdate={() => refetchEmployee()}
            isEmployee={true}
          />
        ) : (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
          </div>
        );
      
      case "messages":
        return authUser ? <MessagingSection currentUserId={authUser.id} isAdmin={isAdmin} /> : null;
      
      case "notifications":
        return (
          <Card>
            <CardHeader className="flex flex-col gap-4">
              <div className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-accent" />
                  </div>
                  الإشعارات
                  {unreadCount > 0 && <Badge className="bg-red-500 text-white">{unreadCount}</Badge>}
                </CardTitle>
                {notifications.some(n => !n.is_read) && (
                  <Button variant="outline" size="sm" onClick={markAllAsRead}>
                    <CheckCircle className="w-4 h-4 ml-1" />
                    تحديد الكل كمقروء
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "الكل", icon: Bell },
                  { key: "tasks", label: "المهام", icon: ClipboardList },
                  { key: "messages", label: "الرسائل", icon: MessageSquare },
                  { key: "general", label: "عامة", icon: Bell },
                ].map((filter) => {
                  const Icon = filter.icon;
                  return (
                    <Button
                      key={filter.key}
                      variant={notificationFilter === filter.key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNotificationFilter(filter.key as typeof notificationFilter)}
                      className="gap-2"
                    >
                      <Icon className="w-4 h-4" />
                      {filter.label}
                    </Button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent>
              {loadingNotifications ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">لا توجد إشعارات</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {filteredNotifications.map((notification) => {
                    const style = getNotificationStyle(notification);
                    const NotificationIcon = style.icon;
                    return (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-xl transition-colors cursor-pointer border",
                          notification.is_read 
                            ? "bg-muted/30 hover:bg-muted/50 border-transparent" 
                            : `${style.bgColor} border-accent/20 hover:opacity-90`
                        )}
                      >
                        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", style.bgColor)}>
                          <NotificationIcon className={cn("w-5 h-5", style.iconColor)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn(style.badgeColor, "text-white text-[10px] px-2 py-0")}>{style.badgeLabel}</Badge>
                            <h4 className={cn("font-semibold", notification.is_read ? "text-muted-foreground" : "text-foreground")}>{notification.title}</h4>
                            {!notification.is_read && <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
                            {notification.related_task_id && <ExternalLink className="w-3 h-3 text-accent" />}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-2" style={{ fontFamily: 'Arial, sans-serif' }}>{formatDateTime(notification.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {!notification.is_read && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-accent hover:bg-accent/10" onClick={() => markAsRead(notification.id)}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => deleteNotification(notification.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      
      case "files":
        return authUser ? <ProfileFilesSection userId={authUser.id} /> : null;
      
      default:
        return null;
    }
  };

  // Edit Mode
  const renderEditMode = () => (
    <div className="space-y-6">
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
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Camera className="w-4 h-4" />
                تغيير الصورة
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
              <Input id="firstName" value={editData.firstName} onChange={(e) => handleInputChange("firstName", e.target.value)} className="text-base h-12" disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-base">اسم العائلة</Label>
              <Input id="lastName" value={editData.lastName} onChange={(e) => handleInputChange("lastName", e.target.value)} className="text-base h-12" disabled={!isAdmin} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-base flex items-center gap-2">
                <AtSign className="w-4 h-4 text-muted-foreground" />
                رقم الهوية
              </Label>
              <Input id="username" value={editData.username || ""} onChange={(e) => handleInputChange("username", e.target.value)} className="text-base h-12" dir="ltr" disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                البريد الإلكتروني
              </Label>
              <Input id="email" type="email" value={editData.email} onChange={(e) => handleInputChange("email", e.target.value)} className="text-base h-12" dir="ltr" disabled={!isAdmin} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                رقم الهاتف
              </Label>
              <Input id="phone" type="tel" value={editData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} className="text-base h-12" dir="ltr" disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department" className="text-base flex items-center gap-2">
                <Building className="w-4 h-4 text-muted-foreground" />
                القسم
              </Label>
              <Select value={editData.department || ""} onValueChange={(value) => handleInputChange("department", value)} disabled={!isAdmin}>
                <SelectTrigger className="text-base h-12"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (<SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="jobRole" className="text-base flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                الدور الوظيفي
              </Label>
              <Select value={editData.jobRole || ""} onValueChange={(value) => handleInputChange("jobRole", value)} disabled={!isAdmin}>
                <SelectTrigger className="text-base h-12"><SelectValue placeholder="اختر الدور الوظيفي" /></SelectTrigger>
                <SelectContent>
                  {jobRoles.map((role) => (<SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location" className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                الموقع
              </Label>
              <Input id="location" value={editData.location} onChange={(e) => handleInputChange("location", e.target.value)} className="text-base h-12" disabled={!isAdmin} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" size="lg" onClick={handleCancel}>إلغاء</Button>
        <Button type="button" onClick={handleSave} size="lg" className="gap-2 bg-gradient-to-l from-accent to-primary hover:opacity-90">
          <Save className="w-4 h-4" />
          حفظ التغييرات
        </Button>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="w-full max-w-screen-2xl mx-auto space-y-6" dir="rtl">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

        {isEditing ? renderEditMode() : (
          <>
            {/* Profile Header */}
            <ProfileHeader
              user={user}
              employeeTitle={employeeData?.title}
              isAdmin={isAdmin}
              onEditClick={handleEdit}
              onImageClick={() => fileInputRef.current?.click()}
            />



            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Content - اليسار */}
              <div className="lg:col-span-3 order-2 lg:order-1">
                {renderSectionContent()}
              </div>

              {/* Sidebar - اليمين */}
              <div className="lg:col-span-1 order-1 lg:order-2">
                <ProfileSidebar
                  sections={sections}
                  activeSection={activeSection}
                  onSectionChange={setActiveSection}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
