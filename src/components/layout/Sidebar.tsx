import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCog,
  CalendarCheck,
  MessageSquare,
  FileText,
  User,
  LogOut,
  Target,
  TrendingUp,
  Eye,
  EyeOff,
  Bell,
  Clock,
  Briefcase,
  Upload,
  Brain,
} from "lucide-react";
import { cn, formatNumberPlain } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/hooks/useAuth";
import { useOrgBranding } from "@/contexts/OrgBrandingContext";
import { supabase } from "@/integrations/supabase/client";
import atefLogoIcon from "@/assets/atef-logo-icon-white.png";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  iconBg: string;
}

// قائمة مدير النظام (Admin) — يرى بيانات الجمعية فقط، بدون "خططي" الشخصية
const adminNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/app", icon: LayoutDashboard, iconBg: "bg-gradient-to-br from-violet-500 to-purple-600" },
  { title: "الموظفين", href: "/employees", icon: Users, iconBg: "bg-gradient-to-br from-indigo-400 to-indigo-500" },
  { title: "الخطط التشغيلية", href: "/operational-plans", icon: Target, iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-500" },
  { title: "الخطط التنفيذية", href: "/executive-plans", icon: CalendarCheck, iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-500" },
  { title: "المهام", href: "/tasks", icon: ClipboardList, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { title: "رفع البيانات", href: "/uploads", icon: Upload, iconBg: "bg-gradient-to-br from-rose-400 to-pink-500" },
  { title: "التحليل الذكي", href: "/intelligence", icon: Brain, iconBg: "bg-gradient-to-br from-fuchsia-500 to-pink-600" },
  { title: "تقييم الأداء", href: "/performance", icon: FileText, iconBg: "bg-gradient-to-br from-amber-300 to-yellow-500" },
];

// قائمة المدير المتوسط (Manager) — له خططه الشخصية + يرى فريقه عبر Toggle داخل كل صفحة
const managerNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/app", icon: LayoutDashboard, iconBg: "bg-gradient-to-br from-violet-500 to-purple-600" },
  { title: "الخطط التشغيلية", href: "/operational-plans", icon: Target, iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-500" },
  { title: "الخطط التنفيذية", href: "/executive-plans", icon: CalendarCheck, iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-500" },
  { title: "المهام", href: "/tasks", icon: ClipboardList, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { title: "تقييم الأداء", href: "/performance", icon: FileText, iconBg: "bg-gradient-to-br from-amber-300 to-yellow-500" },
];

// قائمة الموظف العادي
const employeeNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/app", icon: TrendingUp, iconBg: "bg-gradient-to-br from-violet-500 to-purple-600" },
  { title: "الخطة التشغيلية", href: "/operational-plans", icon: Target, iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-500" },
  { title: "الخطة التنفيذية", href: "/executive-plans", icon: CalendarCheck, iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-500" },
  { title: "مهامي اليومية", href: "/tasks", icon: ClipboardList, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { title: "تقييم أدائي", href: "/performance", icon: FileText, iconBg: "bg-gradient-to-br from-amber-300 to-yellow-500" },
];

const settingsNavItem: NavItem = {
  title: "الإعدادات",
  href: "/settings",
  icon: Settings,
  iconBg: "bg-gradient-to-br from-slate-400 to-slate-500"
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, previewAsEmployee, setPreviewAsEmployee, previewingEmployee } = useUser();
  const { signOut, user: authUser } = useAuth();
  const branding = useOrgBranding();
  const [roleLevel, setRoleLevel] = useState<"admin" | "manager" | "employee">("employee");

  // Build a gradient from the org's brand colors; fall back to default teal palette.
  const sidebarBgStyle = branding.primary
    ? {
        backgroundImage: `linear-gradient(to bottom, ${branding.primary} 0%, ${branding.secondary || branding.primary} 50%, ${branding.primary} 100%)`,
      }
    : undefined;

  // Check if user is actually an admin (not in preview mode)
  const isActuallyAdmin = !previewAsEmployee && user.role === "مدير النظام";

  // Resolve role_level from employees table to know which menu to show
  useEffect(() => {
    const fetchRoleLevel = async () => {
      if (!authUser) return;

      // 1) Check global user_roles first — admin/super_admin always wins
      const { data: userRole } = await supabase.rpc("get_user_role", {
        _user_id: authUser.id,
      });
      if (userRole === "admin" || userRole === "super_admin") {
        setRoleLevel("admin");
        return;
      }

      // 2) Otherwise read role_level from employees
      const { data } = await supabase
        .from("employees")
        .select("role_level")
        .eq("user_id", authUser.id)
        .maybeSingle();
      if (data?.role_level) {
        setRoleLevel(data.role_level as any);
      } else {
        setRoleLevel("employee");
      }
    };
    fetchRoleLevel();
  }, [authUser, isActuallyAdmin]);

  // جلب عدد الإشعارات غير المقروءة
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!authUser) return;

      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);

      if (!error && count !== null) {
        setUnreadCount(count);
      }
    };

    fetchUnreadCount();

    // الاستماع للإشعارات الجديدة
    const channel = supabase
      .channel('sidebar-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser]);

  // جلب عدد الرسائل غير المقروءة
  useEffect(() => {
    const fetchUnreadMessages = async () => {
      if (!authUser) return;

      try {
        // جلب المحادثات الخاصة بالمستخدم
        const { data: convRows } = await supabase.rpc(
          "get_conversations_for_user",
          { _user_id: authUser.id }
        );

        if (!convRows || convRows.length === 0) {
          setUnreadMessagesCount(0);
          return;
        }

        const conversationIds = (convRows as any[]).map((row) => row.conversation_id);

        // جلب آخر وقت قراءة للمستخدم
        const { data: myParticipations } = await supabase
          .from("conversation_participants")
          .select("conversation_id, last_read_at")
          .eq("user_id", authUser.id)
          .in("conversation_id", conversationIds);

        const lastReadMap = new Map(
          (myParticipations || []).map((p) => [p.conversation_id, p.last_read_at])
        );

        // جلب الرسائل غير المقروءة
        let totalUnread = 0;
        for (const convId of conversationIds) {
          const lastRead = lastReadMap.get(convId);

          let query = supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", convId)
            .eq("is_deleted", false)
            .neq("sender_id", authUser.id);

          if (lastRead) {
            query = query.gt("created_at", lastRead);
          }

          const { count } = await query;
          if (count) totalUnread += count;
        }

        setUnreadMessagesCount(totalUnread);
      } catch (error) {
        console.error("Error fetching unread messages:", error);
      }
    };

    fetchUnreadMessages();

    // الاستماع للرسائل الجديدة + تحديثات last_read_at (عند قراءة المحادثة)
    const messagesChannel = supabase
      .channel('sidebar-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchUnreadMessages();
        }
      )
      .subscribe();

    const participantsChannel = supabase
      .channel('sidebar-conversation-participants')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${authUser.id}`,
        },
        () => {
          fetchUnreadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [authUser]);

  const handleSignOut = async () => {
    setPreviewAsEmployee(false);
    await signOut();
    navigate("/", { replace: true });
  };

  const NavLink = ({ item, index = 0 }: { item: NavItem; index?: number }) => {
    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
    const badgeCount = item.badge;

    // جميع الروابط تضيف state لإخفاء شاشة الترحيب
    const linkState = { fromNavigation: true };

    const brandPrimary = branding.primary;
    const brandAccent = branding.accent || branding.primary;

    // Build icon background from brand colors when available — alternate between primary (green) and accent (orange)
    const useBrandIcon = !!brandPrimary;
    const iconColor1 = index % 2 === 0 ? brandPrimary : (brandAccent || brandPrimary);
    const iconColor2 = index % 2 === 0 ? (brandAccent || brandPrimary) : brandPrimary;

    return (
      <Link
        to={item.href}
        state={linkState}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-l-xl rounded-r-none transition-colors",
          isActive
            ? "text-white shadow-lg ring-2 ring-white"
            : "bg-white text-slate-700 hover:bg-white/90"
        )}
        style={
          isActive && brandPrimary
            ? { backgroundImage: `linear-gradient(to right, ${brandPrimary}, ${brandAccent})` }
            : isActive
              ? undefined
              : undefined
        }
      >
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shadow-md",
          isActive ? "bg-white/20" : (useBrandIcon ? "" : item.iconBg)
        )}
        style={
          !isActive && useBrandIcon
            ? { backgroundImage: `linear-gradient(135deg, ${iconColor1}, ${iconColor2})` }
            : undefined
        }
        >
          <item.icon className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <>
            <span className={cn(
              "font-bold text-base flex-1 text-right",
              isActive ? "text-white" : "text-slate-700"
            )}>
              {item.title}
            </span>
            {badgeCount && badgeCount > 0 && (
              <span className={cn(
                "text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center",
                isActive ? "bg-white/25 text-white" : "bg-amber-400 text-white"
              )} style={{ fontFamily: 'Arial, sans-serif' }}>
                {badgeCount > 9 ? '9+' : formatNumberPlain(badgeCount)}
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 h-screen flex flex-col transition-all duration-300 z-50 overflow-hidden",
        collapsed ? "w-20" : "w-72"
      )}
    >
      {/* Modern 3D Gradient Background with Geometric Pattern */}
      <div
        className={cn(
          "absolute inset-0",
          !branding.primary && "bg-gradient-to-b from-[#3d9aa8] via-[#4A9BA8] to-[#2d7a85]"
        )}
        style={sidebarBgStyle}
      />

      {/* Animated Gradient Overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20"
        style={{ animation: 'gradientShift 8s ease-in-out infinite alternate' }}
      />

      {/* Geometric Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* 3D Light Effect - Top Highlight */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/15 to-transparent" />

      {/* 3D Depth Effect - Bottom Shadow */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/20 to-transparent" />

      {/* Floating Orbs for Modern Effect */}
      <div
        className="absolute top-1/4 right-4 w-32 h-32 rounded-full bg-white/5 blur-2xl"
        style={{ animation: 'float 6s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-1/3 left-4 w-24 h-24 rounded-full bg-cyan-300/10 blur-xl"
        style={{ animation: 'float 8s ease-in-out infinite reverse' }}
      />

      {/* Shimmer Line Effect */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full"
        style={{ animation: 'shimmer 4s ease-in-out infinite' }}
      />

      {/* White Header Section with Logo */}
      <div className="relative z-10">
        {/* Circular border around logo area */}
        <div className="absolute inset-4 border-4 border-dashed border-cyan-300/50 rounded-full pointer-events-none" style={{ top: '10px', left: '10%', right: '10%', height: '200px' }} />

        {/* White curved background for logo */}
        <div className="bg-white rounded-b-[3rem] relative mx-4 shadow-lg">
          <div className="p-4 pb-6 flex flex-col items-center relative z-10">
            {/* Logo with zoom animation - قابل للنقر للعودة للصفحة الرئيسية */}
            <Link
              to="/"
              className="relative mb-3 group cursor-pointer"
              title="العودة للصفحة الرئيسية"
            >
              {/* Outer rotating ring */}
              <div
                className="absolute inset-[-8px] w-[160px] h-[160px] rounded-full border-4 border-accent/30 border-t-accent animate-spin"
                style={{ animationDuration: '8s' }}
              />

              {/* Inner glow circle */}
              <div
                className="absolute inset-2 w-[136px] h-[136px] rounded-full bg-gradient-to-br from-accent/20 to-primary/10 animate-pulse"
                style={{ animationDuration: '3s' }}
              />

              {/* Logo container with zoom animation and shimmer */}
              <div className="relative w-36 h-36 rounded-full bg-white border-4 border-white flex items-center justify-center shadow-xl overflow-hidden group-hover:scale-105 transition-transform">
                <img
                  src={branding.logoUrl || atefLogoIcon}
                  alt={branding.orgName || "الجمعية"}
                  className="w-28 h-28 object-contain"
                  style={{ animation: 'zoomPulse 4s ease-in-out infinite' }}
                />
                {/* Shimmer/Glow effect */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full"
                  style={{ animation: 'shimmer 3s ease-in-out infinite' }}
                />
              </div>

              {/* Decorative dot */}
              <div
                className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-lg animate-bounce"
                style={{ animationDuration: '2s' }}
              />
            </Link>

            {/* Text under logo */}
            {!collapsed && (
              <div className="text-center space-y-1">
                <h1 className="text-xl font-bold text-slate-800 whitespace-nowrap tracking-wide">
                  {branding.orgName || "الجمعية"}
                </h1>
                <div className="relative">
                  <p
                    className="text-sm font-semibold text-transparent bg-clip-text bg-gradient-to-l from-cyan-600 via-teal-500 to-cyan-600"
                    style={
                      branding.primary
                        ? {
                            backgroundImage: `linear-gradient(to left, ${branding.primary}, ${branding.accent || branding.primary}, ${branding.primary})`,
                          }
                        : undefined
                    }
                  >
                    نظام إدارة التسويق الإلكتروني
                  </p>
                  <div
                    className="mt-2 mx-auto w-24 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full"
                    style={
                      branding.primary
                        ? { backgroundImage: `linear-gradient(to right, transparent, ${branding.accent || branding.primary}, transparent)` }
                        : undefined
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cyan Navigation Section */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10 pt-6">
        {/* User Profile Card - SEPARATED from logo */}
        {!collapsed && (
          <div className="mx-4 mb-4 flex-shrink-0 space-y-2">
            {/* Main Profile Card - Matching design */}
            <div className="bg-white rounded-2xl p-3 shadow-lg relative z-20">
              <div className="flex items-center gap-3">
                {/* Avatar - Left side, larger with cyan border */}
                <div
                  className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-cyan-400 shadow-lg flex-shrink-0"
                  style={branding.primary ? { borderColor: branding.accent || branding.primary } : undefined}
                >
                  {user.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt="صورة المستخدم"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-xl font-bold text-white"
                      style={
                        branding.primary
                          ? { backgroundImage: `linear-gradient(135deg, ${branding.primary}, ${branding.accent || branding.primary})` }
                          : undefined
                      }
                    >
                      {user.firstName.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Name and Role - Right side, centered vertically */}
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <h3 className="font-bold text-slate-800 text-base">{user.firstName} {user.lastName}</h3>
                  <span className="text-xs text-cyan-600 font-semibold bg-cyan-50 rounded-full px-3 py-1 border border-cyan-200">
                    {user.role}
                  </span>
                </div>
              </div>
              </div>

            {/* Profile Icon Button */}
            <Link
              to="/profile"
              className="w-full bg-white/90 hover:bg-white rounded-xl p-3 shadow-md flex items-center gap-3 group relative"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform relative">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-right">
                <span className="text-sm font-semibold text-slate-700">الملف الشخصي</span>
                <p className="text-xs text-slate-500">إدارة معلوماتك وصورتك</p>
              </div>
              {/* أيقونة الإشعارات مع العداد (إشعارات + رسائل) */}
              <div className="relative">
                <Bell className="w-5 h-5 text-slate-400 group-hover:text-cyan-500 transition-colors" />
                {(unreadCount + unreadMessagesCount) > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-pulse" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {(unreadCount + unreadMessagesCount) > 9 ? '9+' : formatNumberPlain(unreadCount + unreadMessagesCount)}
                  </span>
                )}
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
            </Link>

          </div>
        )}

        {/* Navigation Items - Scrollable with Settings inside */}
        <nav
          className="flex-1 pr-4 pl-4 space-y-2.5 py-3 min-h-0 overflow-y-auto scrollbar-none"
          dir="ltr"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <div className="space-y-2.5" dir="rtl">
            {/* عرض القائمة حسب مستوى الصلاحية (admin/manager/employee) أو وضع المعاينة */}
            {(previewAsEmployee
              ? employeeNavItems
              : roleLevel === "admin"
                ? adminNavItems
                : roleLevel === "manager"
                  ? managerNavItems
                  : employeeNavItems
            ).map((item, idx) => (
              <div key={item.href}>
                <NavLink item={item} index={idx} />
              </div>
            ))}

            {/* Settings inside scroll */}
            <div className="pt-3 mt-3 border-t border-white/20">
              <NavLink item={settingsNavItem} />
            </div>

            {/* زر معاينة كموظف - يظهر فقط للمدير أو عند المعاينة */}
            {(isActuallyAdmin || previewAsEmployee) && (
              <div className="pt-3 mt-3 border-t border-white/20">
                {previewAsEmployee ? (
                  <>
                    <button
                      onClick={() => setPreviewAsEmployee(false)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-l-xl rounded-r-none transition-colors text-sm bg-amber-500 text-white hover:bg-amber-600"
                    >
                      <EyeOff className="w-4 h-4" />
                      {!collapsed && <span className="font-medium">إلغاء المعاينة</span>}
                    </button>
                    {!collapsed && (
                      <p className="text-xs text-amber-200 text-center mt-1">
                        {previewingEmployee
                          ? `معاينة: ${previewingEmployee.full_name}`
                          : "أنت في وضع المعاينة"
                        }
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setPreviewAsEmployee(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-l-xl rounded-r-none transition-colors text-sm bg-white/20 text-white hover:bg-white/30"
                  >
                    <Eye className="w-4 h-4" />
                    {!collapsed && <span className="font-medium">معاينة كموظف</span>}
                  </button>
                )}
              </div>
            )}

            {/* Logout and Collapse Buttons - داخل التمرير */}
            <div className="pt-6 mt-6 border-t border-white/20 space-y-2">
              {/* Logout Button */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-l-xl rounded-r-none bg-red-500/80 text-white hover:bg-red-500 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                {!collapsed && <span className="font-medium">تسجيل الخروج</span>}
              </button>

              {/* Collapse Button */}
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-l-xl rounded-r-none bg-white/20 text-white hover:bg-white/30 transition-colors text-sm backdrop-blur-sm"
              >
                {collapsed ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    <span className="font-medium">طي القائمة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
}
