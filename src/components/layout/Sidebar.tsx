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
  ShieldCheck,
  ListChecks,
  FileSpreadsheet,
} from "lucide-react";
import {
  Sparkles,
  ShieldAlert,
  Lightbulb,
  FileBarChart2,
  HeartHandshake,
  Award,
} from "lucide-react";
import { cn, formatNumberPlain } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/hooks/useAuth";
import { useOrgBranding } from "@/contexts/OrgBrandingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import atefLogoIcon from "@/assets/atef-logo-icon-white.png";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  iconBg: string;
}

// كل أيقونة بلونها المميز — ثابت دائمًا لتجنب تبدّل الألوان أو اهتزاز القائمة عند التنقل.
const adminNavItems: NavItem[] = [
  { title: "رفع الملفات", href: "/uploads", icon: Upload, iconBg: "nav-icon-upload" },
  { title: "التحليل الذكي", href: "/internal-dashboard?tab=analysis", icon: Sparkles, iconBg: "nav-icon-analysis" },
  { title: "نظرة عامة", href: "/internal-dashboard?tab=overview", icon: LayoutDashboard, iconBg: "nav-icon-overview" },
  { title: "الموظفون", href: "/internal-dashboard?tab=employees", icon: Users, iconBg: "nav-icon-people" },
  { title: "الخطط التشغيلية", href: "/internal-dashboard?tab=operational-plans-main", icon: Target, iconBg: "nav-icon-plans" },
  { title: "الخطط التنفيذية", href: "/internal-dashboard?tab=executive-plans", icon: CalendarCheck, iconBg: "nav-icon-executive" },
  { title: "المهام", href: "/internal-dashboard?tab=tasks", icon: ClipboardList, iconBg: "nav-icon-tasks" },
  { title: "تقييم الأداء", href: "/internal-dashboard?tab=performance", icon: FileText, iconBg: "nav-icon-performance" },
  { title: "الخطط من التوصيات", href: "/internal-dashboard?tab=operational-plans", icon: ListChecks, iconBg: "nav-icon-recommendations" },
  { title: "تحليل المساءلات", href: "/internal-dashboard?tab=accountability", icon: ShieldAlert, iconBg: "nav-icon-accountability" },
  { title: "التقارير", href: "/internal-dashboard?tab=reports", icon: FileBarChart2, iconBg: "nav-icon-reports" },
  { title: "الابتكار والتحديث", href: "/internal-dashboard?tab=innovation", icon: Lightbulb, iconBg: "nav-icon-innovation" },
  { title: "المتبرعون", href: "/internal-dashboard?tab=donors", icon: HeartHandshake, iconBg: "nav-icon-donors" },
];

const managerNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/app", icon: LayoutDashboard, iconBg: "nav-icon-overview" },
  { title: "الخطط التشغيلية", href: "/operational-plans", icon: Target, iconBg: "nav-icon-plans" },
  { title: "الخطط التنفيذية", href: "/executive-plans", icon: CalendarCheck, iconBg: "nav-icon-executive" },
  { title: "المهام", href: "/tasks", icon: ClipboardList, iconBg: "nav-icon-tasks" },
  { title: "مساءلاتي", href: "/my-accountability", icon: ShieldAlert, iconBg: "nav-icon-analysis" },
  { title: "أدائي", href: "/my-performance", icon: Award, iconBg: "nav-icon-innovation" },
  { title: "تقييم الأداء", href: "/performance", icon: FileText, iconBg: "nav-icon-performance" },
];

const employeeNavItems: NavItem[] = [
  { title: "التحليل الذكي", href: "/intelligence", icon: Sparkles, iconBg: "nav-icon-analysis" },
  { title: "نظرة عامة", href: "/app", icon: TrendingUp, iconBg: "nav-icon-overview" },
  { title: "الخطة التشغيلية", href: "/operational-plans", icon: Target, iconBg: "nav-icon-plans" },
  { title: "الخطة التنفيذية", href: "/executive-plans", icon: CalendarCheck, iconBg: "nav-icon-executive" },
  { title: "مهامي اليومية", href: "/tasks", icon: ClipboardList, iconBg: "nav-icon-tasks" },
  { title: "تقييم أدائي", href: "/my-performance", icon: Award, iconBg: "nav-icon-performance" },
  { title: "المساءلات وتحليلها", href: "/my-accountability", icon: ShieldAlert, iconBg: "nav-icon-analysis" },
  { title: "التقارير", href: "/reports", icon: FileBarChart2, iconBg: "nav-icon-reports" },
  { title: "الابتكار والتحديث", href: "/innovation", icon: Lightbulb, iconBg: "nav-icon-innovation" },
];

const settingsNavItem: NavItem = {
  title: "الإعدادات",
  href: "/settings",
  icon: Settings,
  iconBg: "nav-icon-settings",
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
  const { currentOrg } = useOrganization();
  const isAdminArea = location.pathname.includes("/uploads") || location.pathname.includes("/internal-dashboard");
  const isActuallyAdmin = !previewAsEmployee && user.role === "مدير النظام";
  const [roleLevel, setRoleLevel] = useState<"admin" | "manager" | "employee">(
    isActuallyAdmin || isAdminArea ? "admin" : "employee"
  );
  const [roleReady, setRoleReady] = useState(isActuallyAdmin || isAdminArea);

  // خلفية واحدة ثابتة من أعلى القائمة إلى أسفلها بدون أي تدرج.
  const sidebarBgStyle = branding.primary
    ? {
        backgroundColor: branding.primary,
      }
    : undefined;
  const visibleNavItems = previewAsEmployee
    ? employeeNavItems
    : !roleReady
      ? []
      : roleLevel === "admin"
        ? adminNavItems
        : roleLevel === "manager"
          ? managerNavItems
          : employeeNavItems;

  // Resolve role_level from employees table to know which menu to show
  useEffect(() => {
    const fetchRoleLevel = async () => {
      if (!authUser) {
        setRoleLevel("employee");
        setRoleReady(true);
        return;
      }

      setRoleReady(false);

      if (isActuallyAdmin || isAdminArea) {
        setRoleLevel("admin");
        setRoleReady(true);
        return;
      }

      // 1) Check global user_roles first — admin/super_admin always wins
      const { data: userRole } = await supabase.rpc("get_user_role", {
        _user_id: authUser.id,
      });
      if (userRole === "admin" || userRole === "super_admin") {
        setRoleLevel("admin");
        setRoleReady(true);
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
      setRoleReady(true);
    };
    fetchRoleLevel();
  }, [authUser, isActuallyAdmin, isAdminArea]);

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

  const NavLink = ({ item }: { item: NavItem }) => {
    const scopedHref = (() => {
      if (!currentOrg?.slug || !item.href.startsWith("/")) return item.href;

      const [path, query] = item.href.split("?");
      if (path === "/" || path.startsWith("/admin") || path.startsWith("/auth") || path.startsWith("/j/")) {
        return item.href;
      }

      const prefixedPath = path.startsWith(`/${currentOrg.slug}`) ? path : `/${currentOrg.slug}${path}`;
      return query ? `${prefixedPath}?${query}` : prefixedPath;
    })();

    const [targetPath, targetQuery] = scopedHref.split("?");
    const targetParams = new URLSearchParams(targetQuery ?? "");
    const targetTab = targetParams.get("tab");
    const currentTab = new URLSearchParams(location.search).get("tab");
    const isActive = targetTab
      ? location.pathname === targetPath && currentTab === targetTab
      : location.pathname === targetPath || location.pathname.startsWith(targetPath + '/');
    const badgeCount = item.badge;

    // جميع الروابط تضيف state لإخفاء شاشة الترحيب
    const linkState = { fromNavigation: true };

    return (
      <Link
        to={scopedHref}
        state={linkState}
        className={cn(
          "group/nav flex h-14 items-center gap-3 rounded-l-[28px] rounded-r-none pr-5 pl-2 py-2 shadow-md transition-all duration-150",
          isActive
            ? "bg-white shadow-lg scale-[1.02]"
            : "bg-white hover:shadow-lg"
        )}
      >
        {!collapsed && (
          <>
            <span
              className="font-bold text-base flex-1 text-right transition-colors duration-150 text-slate-800"
            >
              {item.title}
            </span>
            {badgeCount && badgeCount > 0 && (
              <span
                className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center bg-amber-400 text-white"
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                {badgeCount > 9 ? '9+' : formatNumberPlain(badgeCount)}
              </span>
            )}
          </>
        )}
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
            "text-white shadow-sm bg-[hsl(155,55%,28%)]"
          )}
        >
          <item.icon className="w-5 h-5" />
        </div>
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
      {/* خلفية القائمة — لون واحد ثابت بهوية الجمعية */}
      <div
        className={cn(
          "absolute inset-0",
          !branding.primary && "bg-[hsl(var(--primary))]"
        )}
        style={sidebarBgStyle}
      />

      {/* Header Section with Logo */}
      <div className="relative z-10">
        <div className="relative pt-6 pb-4 flex flex-col items-center">
          {/* الشعار — بدائرة واضحة وحركة الدخول السابقة */}
          <Link
            to="/"
            className="relative mb-3 group cursor-pointer animate-scale-in"
            title="العودة للصفحة الرئيسية"
          >
            <div className="absolute inset-[-12px] rounded-full border-2 border-white/45 pointer-events-none animate-pulse" />
            <div className="absolute inset-[-24px] rounded-full bg-white/20 blur-2xl pointer-events-none" />
            <div className="relative w-44 h-44 rounded-full bg-white flex flex-col items-center justify-center gap-1 px-3 py-5 text-center shadow-2xl overflow-hidden ring-4 ring-white/35 transition-transform duration-500 group-hover:scale-105 shrink-0">
              {branding.loading ? (
                <div className="w-28 h-28 rounded-full bg-slate-100 animate-pulse" />
              ) : branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.orgName || "الجمعية"}
                  className="h-40 w-40 object-contain drop-shadow-xl"
                />
              ) : (
                <img
                  src={atefLogoIcon}
                  alt={branding.orgName || "الجمعية"}
                  className="h-40 w-40 object-contain drop-shadow-xl"
                />
              )}
            </div>
          </Link>

          {/* Text under logo */}
          {!collapsed && (
            <div className="text-center space-y-1">
              <div className="relative">
                <p className="text-sm font-semibold text-white/90">
                  نظام إدارة التسويق الإلكتروني
                </p>
                <div className="mt-2 mx-auto w-24 h-0.5 bg-gradient-to-r from-transparent via-white/70 to-transparent rounded-full" />
              </div>
            </div>
          )}
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
                <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-slate-200 shadow-md flex-shrink-0">
                  {user.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt="صورة المستخدم"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center text-xl font-bold text-white">
                      {user.firstName.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Name and Role - Right side, centered vertically */}
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                  <h3 className="font-bold text-slate-800 text-base">{user.firstName} {user.lastName}</h3>
                  <span className="text-xs font-semibold rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
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
              <div className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition-transform duration-200 group-hover:scale-[1.04] relative">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 text-right">
                <span className="text-sm font-semibold text-slate-700">الملف الشخصي</span>
                <p className="text-xs text-slate-500">إدارة معلوماتك وصورتك</p>
              </div>
              {/* أيقونة الإشعارات مع العداد (إشعارات + رسائل) */}
              <div className="relative">
                <Bell className="w-5 h-5 text-slate-400 group-hover:text-[hsl(var(--primary))] transition-colors" />
                {(unreadCount + unreadMessagesCount) > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {(unreadCount + unreadMessagesCount) > 9 ? '9+' : formatNumberPlain(unreadCount + unreadMessagesCount)}
                  </span>
                )}
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-[hsl(var(--primary))] transition-colors" />
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
            {visibleNavItems.map((item) => (
              <div key={item.href}>
                <NavLink item={item} />
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
