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

// كل أيقونة بلونها المميز — vector art ملوّن جميل.
// مهم: لون الأيقونة ثابت دائماً (لا يتغيّر عند active) → لا اهتزاز ولا تبديل.
const adminNavItems: NavItem[] = [
  { title: "رفع الملفات", href: "/uploads", icon: Upload, iconBg: "bg-gradient-to-br from-rose-400 to-pink-500" },
  { title: "التحليل الذكي", href: "/internal-dashboard?tab=analysis", icon: Sparkles, iconBg: "bg-gradient-to-br from-fuchsia-500 to-pink-600" },
  { title: "نظرة عامة", href: "/internal-dashboard?tab=overview", icon: LayoutDashboard, iconBg: "bg-gradient-to-br from-violet-500 to-purple-600" },
  { title: "الموظفون", href: "/internal-dashboard?tab=employees", icon: Users, iconBg: "bg-gradient-to-br from-indigo-400 to-indigo-500" },
  { title: "الخطط التشغيلية", href: "/internal-dashboard?tab=operational-plans-main", icon: Target, iconBg: "bg-gradient-to-br from-teal-400 to-cyan-600" },
  { title: "الخطط التنفيذية", href: "/internal-dashboard?tab=executive-plans", icon: CalendarCheck, iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-500" },
  { title: "المهام", href: "/internal-dashboard?tab=tasks", icon: ClipboardList, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { title: "تقييم الأداء", href: "/internal-dashboard?tab=performance", icon: FileText, iconBg: "bg-gradient-to-br from-amber-300 to-yellow-500" },
  { title: "الخطط من التوصيات", href: "/internal-dashboard?tab=operational-plans", icon: ListChecks, iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-500" },
  { title: "تحليل المساءلات", href: "/internal-dashboard?tab=accountability", icon: ShieldAlert, iconBg: "bg-gradient-to-br from-red-400 to-rose-500" },
  { title: "التقارير", href: "/internal-dashboard?tab=reports", icon: FileBarChart2, iconBg: "bg-gradient-to-br from-rose-400 to-pink-600" },
  { title: "الابتكار والتحديث", href: "/internal-dashboard?tab=innovation", icon: Lightbulb, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { title: "المتبرعون", href: "/internal-dashboard?tab=donors", icon: HeartHandshake, iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500" },
];

const managerNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/app", icon: LayoutDashboard, iconBg: "bg-gradient-to-br from-violet-500 to-purple-600" },
  { title: "الخطط التشغيلية", href: "/operational-plans", icon: Target, iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-500" },
  { title: "الخطط التنفيذية", href: "/executive-plans", icon: CalendarCheck, iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-500" },
  { title: "المهام", href: "/tasks", icon: ClipboardList, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { title: "مساءلاتي", href: "/my-accountability", icon: ShieldAlert, iconBg: "bg-gradient-to-br from-fuchsia-500 to-pink-600" },
  { title: "أدائي", href: "/my-performance", icon: Award, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { title: "تقييم الأداء", href: "/performance", icon: FileText, iconBg: "bg-gradient-to-br from-amber-300 to-yellow-500" },
];

const employeeNavItems: NavItem[] = [
  { title: "التحليل الذكي", href: "/intelligence", icon: Sparkles, iconBg: "bg-gradient-to-br from-fuchsia-500 to-pink-600" },
  { title: "نظرة عامة", href: "/app", icon: TrendingUp, iconBg: "bg-gradient-to-br from-violet-500 to-purple-600" },
  { title: "الخطة التشغيلية", href: "/operational-plans", icon: Target, iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-500" },
  { title: "الخطة التنفيذية", href: "/executive-plans", icon: CalendarCheck, iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-500" },
  { title: "مهامي اليومية", href: "/tasks", icon: ClipboardList, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
  { title: "تقييم أدائي", href: "/my-performance", icon: Award, iconBg: "bg-gradient-to-br from-amber-300 to-yellow-500" },
  { title: "المساءلات وتحليلها", href: "/my-accountability", icon: ShieldAlert, iconBg: "bg-gradient-to-br from-fuchsia-500 to-pink-600" },
  { title: "التقارير", href: "/reports", icon: FileBarChart2, iconBg: "bg-gradient-to-br from-rose-400 to-pink-600" },
  { title: "الابتكار والتحديث", href: "/innovation", icon: Lightbulb, iconBg: "bg-gradient-to-br from-amber-400 to-orange-500" },
];

const settingsNavItem: NavItem = {
  title: "الإعدادات",
  href: "/settings",
  icon: Settings,
  iconBg: "bg-gradient-to-br from-slate-400 to-slate-500",
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

    const brandPrimary = branding.primary;
    const brandAccent = branding.accent || branding.primary;

    return (
      <Link
        to={scopedHref}
        state={linkState}
        className={cn(
          // ثابت دائمًا: نفس البنية والأبعاد، فقط الإطار يتغيّر برفق → لا اهتزاز.
          "flex items-center gap-3 px-3 py-2 rounded-l-xl rounded-r-none bg-white text-slate-700 transition-shadow duration-200",
          isActive
            ? "shadow-lg ring-2 ring-white"
            : "hover:shadow-md"
        )}
      >
        {/* الأيقونة تحتفظ بلونها الجميل دائمًا — لا تتبدّل عند active */}
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shadow-md flex-shrink-0",
          item.iconBg
        )}>
          <item.icon className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <>
            <span className={cn(
              "font-bold text-base flex-1 text-right transition-colors",
              isActive ? "text-[hsl(var(--primary))]" : "text-slate-700"
            )}>
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
      {/* خلفية القائمة — هوية الجمعية ثابتة وأنيقة */}
      <div
        className={cn(
          "absolute inset-0",
          !branding.primary && "bg-gradient-to-b from-[hsl(var(--primary))] via-[hsl(var(--primary))] to-[hsl(var(--primary))]"
        )}
        style={sidebarBgStyle}
      />

      {/* لمسة عمق علوية ناعمة */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

      {/* ظل سفلي ناعم */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/15 to-transparent pointer-events-none" />

      {/* Header Section with Logo — بدون خلفية مربعة */}
      <div className="relative z-10">
        <div className="relative pt-6 pb-4 flex flex-col items-center">
          {/* الشعار — قابل للنقر، مع نبض هادئ وحلقة متوهجة */}
          <Link
            to="/"
            className="relative mb-3 group cursor-pointer animate-scale-in"
            title="العودة للصفحة الرئيسية"
          >
            {/* توهّج خلفي ناعم — يعطي عمقًا بدون مربع */}
            <div className="absolute inset-0 w-36 h-36 rounded-full bg-white/30 blur-2xl pointer-events-none scale-110" />

            {/* حاوية الشعار — شفافة تمامًا، الشعار يظهر مباشرة على هوية الجمعية */}
            <div className="relative w-36 h-36 rounded-full flex items-center justify-center transition-transform duration-500 group-hover:scale-105">
              {branding.loading ? (
                <div className="w-28 h-28 rounded-full bg-slate-100 animate-pulse" />
              ) : branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={branding.orgName || "الجمعية"}
                  className="w-32 h-32 object-contain drop-shadow-2xl"
                />
              ) : (
                <img
                  src={atefLogoIcon}
                  alt={branding.orgName || "الجمعية"}
                  className="w-32 h-32 object-contain drop-shadow-2xl"
                />
              )}
            </div>
          </Link>

          {/* Text under logo */}
          {!collapsed && (
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold text-white whitespace-nowrap tracking-wide drop-shadow">
                {branding.orgName || "الجمعية"}
              </h1>
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
                <div
                  className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-[hsl(var(--accent))] shadow-md flex-shrink-0"
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
                      className="w-full h-full bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center text-xl font-bold text-white"
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
                  <span
                    className="text-xs font-semibold rounded-full px-3 py-1 border"
                    style={{
                      color: branding.primary || 'hsl(var(--primary))',
                      backgroundColor: `${branding.primary || 'hsl(var(--primary))'}14`,
                      borderColor: `${branding.primary || 'hsl(var(--primary))'}33`,
                    }}
                  >
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
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-[1.04] relative"
                style={{
                  backgroundImage: branding.primary
                    ? `linear-gradient(135deg, ${branding.primary}, ${branding.accent || branding.primary})`
                    : 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
                }}
              >
                <User className="w-5 h-5 text-white" />
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
            {/* عرض القائمة حسب مستوى الصلاحية (admin/manager/employee) أو وضع المعاينة */}
            {(previewAsEmployee
              ? employeeNavItems
              : roleLevel === "admin"
                ? adminNavItems
                : roleLevel === "manager"
                  ? managerNavItems
                  : employeeNavItems
            ).map((item) => (
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
