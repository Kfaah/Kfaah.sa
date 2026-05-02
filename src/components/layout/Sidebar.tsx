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
import { useCanAccessSettings } from "@/hooks/useCanAccessSettings";
import { supabase } from "@/integrations/supabase/client";
import atefLogoIcon from "@/assets/atef-logo-icon-white.png";

const SAWAB_SIDEBAR_LOGO = "/sawab-sidebar-logo-v10.png";

// اسم الجمعية المختصر (سطران × 3-4 كلمات) للعرض في الشريط الجانبي
// المطابقة تتم بمقاطع من الاسم الرسمي الكامل المخزن في DB
const ORG_SHORT_NAME_BY_KEYWORD: Array<{ match: RegExp; lines: [string, string] }> = [
  { match: /سكينة/, lines: ["جمعية سكينة لبناء", "وترميم المساجد بجازان"] },
  { match: /عطاء/, lines: ["جمعية عطاء الخيرية", "بجبال العارضة بجازان"] },
  { match: /عطف/, lines: ["جمعية عطف لرعاية", "الأيتام بمحافظة العارضة"] },
  { match: /نجباء/, lines: ["جمعية نجباء لرعاية", "الأيتام بالفرشة"] },
  { match: /صواب/, lines: ["جمعية صواب لتأهيل", "المتعافين من الإدمان"] },
  { match: /مآثر/, lines: ["جمعية مآثر للدعوة والإرشاد", "وتوعية الجاليات بمحافظة العارضة"] },
  { match: /القصبة/, lines: ["جمعية الدعوة والإرشاد", "وتوعية الجاليات بمركز القصبة"] },
  { match: /حرف/, lines: ["جمعية حرف التعليمية", ""] },
];

function getShortOrgName(fullName: string): [string, string] | null {
  if (!fullName) return null;
  for (const entry of ORG_SHORT_NAME_BY_KEYWORD) {
    if (entry.match.test(fullName)) return entry.lines;
  }
  return null;
}

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
  const { allowed: canAccessSettings } = useCanAccessSettings();
  const isAdminArea = location.pathname.includes("/uploads") || location.pathname.includes("/internal-dashboard");
  const isActuallyAdmin = !previewAsEmployee && user.role === "مدير النظام";
  const [roleLevel, setRoleLevel] = useState<"admin" | "manager" | "employee">(
    isActuallyAdmin || isAdminArea ? "admin" : "employee"
  );
  const [roleReady, setRoleReady] = useState(isActuallyAdmin || isAdminArea);

  // خلفية واحدة ثابتة من أعلى القائمة إلى أسفلها بدون أي تدرج.
  // ملاحظة: لجمعية صواب نفرض خلفية بيضاء بحسب طلب المستخدم.
  const sidebarBgStyle = undefined as React.CSSProperties | undefined;
  const visibleNavItems = previewAsEmployee
    ? employeeNavItems
    : !roleReady
      ? []
      : roleLevel === "admin"
        ? adminNavItems
        : roleLevel === "manager"
          ? managerNavItems
          : employeeNavItems;
  const isSawabOrg = /sawab|صواب/i.test(
    `${currentOrg?.slug ?? ""} ${currentOrg?.name ?? ""} ${branding.orgName ?? ""}`
  );
  const isAtefOrg = /atef|عطف/i.test(
    `${currentOrg?.slug ?? ""} ${currentOrg?.name ?? ""} ${branding.orgName ?? ""}`
  );

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

    if (isActuallyAdmin || isAdminArea) {
      navigate("/admin/organizations", { replace: true });
      return;
    }

    const redirectTo = currentOrg?.slug ? `/${currentOrg.slug}` : "/";
    await signOut();
    navigate(redirectTo, { replace: true });
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
          "group/nav flex h-14 items-center rounded-2xl bg-sidebar-item py-2 ml-3 mr-2 shadow-[0_5px_12px_hsl(var(--sidebar-item-shadow))] transition-all duration-150",
          collapsed ? "justify-center px-0" : "gap-3 pr-4 pl-4",
          isActive ? "shadow-[0_7px_16px_hsl(var(--sidebar-item-shadow))]" : "hover:shadow-[0_7px_16px_hsl(var(--sidebar-item-shadow))]"
        )}
      >
        <div
          className="sidebar-reference-icon flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sidebar-primary-foreground"
        >
          <item.icon className="w-5 h-5" />
        </div>
        {!collapsed && (
          <span
            className="flex-1 text-right text-base font-bold text-sidebar-item-foreground transition-colors duration-150"
          >
            {item.title}
          </span>
        )}
        {!collapsed && badgeCount && badgeCount > 0 && (
          <span
            className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center bg-amber-400 text-white"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            {badgeCount > 9 ? '9+' : formatNumberPlain(badgeCount)}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 h-screen flex flex-col transition-all duration-300 z-50 overflow-hidden",
        collapsed ? "w-20" : "w-[284px]"
      )}
    >
      {/* خلفية القائمة — لون واحد ثابت بهوية الجمعية */}
      <div
        className={cn(
          "absolute inset-0",
          isSawabOrg
            ? ""
            : !branding.primary && "bg-[hsl(var(--primary))]"
        )}
        style={
          isSawabOrg
            ? { backgroundColor: "#00b3c7" }
            : branding.primary
              ? { backgroundColor: branding.primary }
              : undefined
        }
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
            <div className="relative w-52 h-52 rounded-full bg-white flex flex-col items-center justify-center text-center shadow-2xl overflow-hidden ring-4 ring-white/35 transition-transform duration-500 group-hover:scale-105 shrink-0">
              {branding.loading ? (
                <div className="w-44 h-44 rounded-full bg-slate-100 animate-pulse" />
              ) : branding.logoUrl ? (
                <img
                  src={isSawabOrg ? SAWAB_SIDEBAR_LOGO : isAtefOrg ? atefLogoIcon : branding.logoUrl}
                  alt={branding.orgName || "الجمعية"}
                  className={cn(
                    "object-contain drop-shadow-xl",
                    isSawabOrg
                      ? "h-[108px] w-[174px] scale-100 translate-x-0 translate-y-0"
                      : isAtefOrg
                        ? "h-[180px] w-[180px] scale-100"
                        : "h-[210px] w-[210px] scale-125"
                  )}
                />
              ) : (
                <img
                  src={atefLogoIcon}
                  alt={branding.orgName || "الجمعية"}
                  className="h-[200px] w-[200px] object-contain drop-shadow-xl scale-110"
                />
              )}
            </div>
          </Link>

          {/* Text under logo */}
          {!collapsed && (
            <div className="text-center space-y-1 mt-2">
              <div className="relative">
                {branding.orgName && (() => {
                  const short = getShortOrgName(branding.orgName);
                  if (short) {
                    return (
                       <div className={cn("drop-shadow-sm leading-tight", "text-white")}>
                        <p className={cn("font-bold whitespace-nowrap", isSawabOrg ? "text-base" : short[1] ? "text-base" : "text-lg")}>{short[0]}</p>
                        {short[1] && (
                          <p className={cn("font-semibold opacity-95", isSawabOrg ? "text-sm" : "text-sm")}>{short[1]}</p>
                        )}
                        {isSawabOrg && (
                          <p className="mt-1 text-[10px] font-semibold leading-none text-white/80">
                            Sawab Association
                          </p>
                        )}
                      </div>
                    );
                  }
                  return (
                    <p className="text-base font-bold drop-shadow-sm text-white">
                      {branding.orgName}
                    </p>
                  );
                })()}
                <div className="my-2 mx-auto w-24 h-0.5 bg-gradient-to-r from-transparent rounded-full via-white/70" />
                <p className="text-sm font-semibold text-white">
                  نظام إدارة التسويق الإلكتروني
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cyan Navigation Section */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10 pt-6">
        {/* User Profile Card - SEPARATED from logo */}
        {!collapsed && (
          <div className="mb-4 flex-shrink-0 space-y-2">
            {/* Main Profile Card - Matching design */}
            <div className="relative z-20 ml-3 mr-2 rounded-2xl bg-sidebar-item p-3 shadow-[0_5px_14px_hsl(var(--sidebar-item-shadow))]">
              <div className="flex items-center gap-3">
                {/* Avatar - Left side, larger with cyan border */}
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[hsl(var(--sidebar-icon-start))] shadow-[0_0_0_1.5px_hsl(var(--sidebar-item)),0_6px_14px_hsl(var(--sidebar-item-shadow))] ring-1 ring-[hsl(var(--sidebar-icon-end))] flex-shrink-0">
                  {user.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt="صورة المستخدم"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary text-xl font-bold text-primary-foreground">
                      {user.firstName.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Name and Role - Right side, centered vertically */}
                <div className="flex-1 flex min-w-0 flex-col items-stretch justify-center gap-2">
                  <h3 className="w-full rounded-full border border-white/35 bg-[hsl(107_46%_55%)] px-4 py-2 text-center text-base font-bold leading-tight text-white shadow-sm">
                    {user.firstName} {user.lastName}
                  </h3>
                  <span className="w-full rounded-full border border-white/30 bg-[hsl(186_81%_44%)] px-3 py-1.5 text-center text-xs font-bold leading-tight text-white shadow-sm">
                    {user.role}
                  </span>
                </div>
              </div>
              </div>

            {/* Profile Icon Button */}
            <Link
              to="/profile"
              className="group relative flex items-center gap-3 ml-3 mr-2 rounded-2xl bg-sidebar-item p-3 shadow-[0_5px_12px_hsl(var(--sidebar-item-shadow))] hover:shadow-[0_7px_16px_hsl(var(--sidebar-item-shadow))]"
            >
              <div className="sidebar-reference-icon relative flex h-10 w-10 items-center justify-center rounded-full text-sidebar-primary-foreground transition-transform duration-200 group-hover:scale-[1.04]">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 text-right">
                <span className="text-sm font-semibold text-sidebar-item-foreground">الملف الشخصي</span>
                <p className="text-xs text-muted-foreground">إدارة معلوماتك وصورتك</p>
              </div>
              {/* أيقونة الإشعارات مع العداد (إشعارات + رسائل) */}
              <div className="relative">
                <Bell className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
                {(unreadCount + unreadMessagesCount) > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {(unreadCount + unreadMessagesCount) > 9 ? '9+' : formatNumberPlain(unreadCount + unreadMessagesCount)}
                  </span>
                )}
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </Link>

          </div>
        )}

        {/* Navigation Items - Scrollable with Settings inside */}
        <nav
          className="scrollbar-none min-h-0 flex-1 space-y-2.5 overflow-y-auto py-3 pr-0 pl-0"
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
            {canAccessSettings && (
              <div className="pt-3 mt-3 border-t border-white/20">
                <NavLink item={settingsNavItem} />
              </div>
            )}

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
