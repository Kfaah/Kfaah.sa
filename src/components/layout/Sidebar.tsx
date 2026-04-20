import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Settings,
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  FileText,
  User,
  LogOut,
  Target,
  TrendingUp,
  Eye,
  EyeOff,
  Bell,
  Upload,
  Brain,
} from "lucide-react";
import { cn, formatNumberPlain } from "@/lib/utils";
import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import atefLogoIcon from "@/assets/atef-logo-icon-white.png";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  desc?: string;
  // ألوان مستوحاة من نمط الـ Admin
  color: string;       // لون الأيقونة في الحالة العادية
  bg: string;          // خلفية الأيقونة في الحالة العادية
  activeBg: string;    // خلفية الأيقونة عند التفعيل
  activeText: string;  // لون الأيقونة عند التفعيل
}

// ===== قوائم التنقل بهوية Admin (ألوان pastel + activeBg مشبع) =====
const adminNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/app", icon: LayoutDashboard, desc: "ملخّص الأداء العام",
    color: "text-sky-600", bg: "bg-sky-100", activeBg: "bg-sky-500", activeText: "text-white" },
  { title: "الموظفين", href: "/employees", icon: Users, desc: "إدارة فريق العمل",
    color: "text-indigo-600", bg: "bg-indigo-100", activeBg: "bg-indigo-500", activeText: "text-white" },
  { title: "الخطط التشغيلية", href: "/operational-plans", icon: Target, desc: "أهداف ومبادرات سنوية",
    color: "text-cyan-600", bg: "bg-cyan-100", activeBg: "bg-cyan-500", activeText: "text-white" },
  { title: "الخطط التنفيذية", href: "/executive-plans", icon: CalendarCheck, desc: "متابعة شهرية ويومية",
    color: "text-emerald-600", bg: "bg-emerald-100", activeBg: "bg-emerald-500", activeText: "text-white" },
  { title: "المهام", href: "/tasks", icon: ClipboardList, desc: "المهام والتسليمات",
    color: "text-amber-600", bg: "bg-amber-100", activeBg: "bg-amber-500", activeText: "text-white" },
  { title: "رفع البيانات", href: "/uploads", icon: Upload, desc: "استيراد ملفات الجمعية",
    color: "text-rose-600", bg: "bg-rose-100", activeBg: "bg-rose-500", activeText: "text-white" },
  { title: "التحليل الذكي", href: "/intelligence", icon: Brain, desc: "رؤى وتوصيات ذكية",
    color: "text-fuchsia-600", bg: "bg-fuchsia-100", activeBg: "bg-fuchsia-500", activeText: "text-white" },
  { title: "تقييم الأداء", href: "/performance", icon: FileText, desc: "تقارير الأداء",
    color: "text-yellow-600", bg: "bg-yellow-100", activeBg: "bg-yellow-500", activeText: "text-white" },
];

const managerNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/app", icon: LayoutDashboard, desc: "ملخّص الأداء العام",
    color: "text-sky-600", bg: "bg-sky-100", activeBg: "bg-sky-500", activeText: "text-white" },
  { title: "الخطط التشغيلية", href: "/operational-plans", icon: Target, desc: "أهداف ومبادرات",
    color: "text-cyan-600", bg: "bg-cyan-100", activeBg: "bg-cyan-500", activeText: "text-white" },
  { title: "الخطط التنفيذية", href: "/executive-plans", icon: CalendarCheck, desc: "متابعة شهرية",
    color: "text-emerald-600", bg: "bg-emerald-100", activeBg: "bg-emerald-500", activeText: "text-white" },
  { title: "المهام", href: "/tasks", icon: ClipboardList, desc: "مهامك ومهام الفريق",
    color: "text-amber-600", bg: "bg-amber-100", activeBg: "bg-amber-500", activeText: "text-white" },
  { title: "تقييم الأداء", href: "/performance", icon: FileText, desc: "تقارير أدائك",
    color: "text-yellow-600", bg: "bg-yellow-100", activeBg: "bg-yellow-500", activeText: "text-white" },
];

const employeeNavItems: NavItem[] = [
  { title: "نظرة عامة", href: "/app", icon: TrendingUp, desc: "ملخّص يومك",
    color: "text-sky-600", bg: "bg-sky-100", activeBg: "bg-sky-500", activeText: "text-white" },
  { title: "الخطة التشغيلية", href: "/operational-plans", icon: Target, desc: "أهدافك السنوية",
    color: "text-cyan-600", bg: "bg-cyan-100", activeBg: "bg-cyan-500", activeText: "text-white" },
  { title: "الخطة التنفيذية", href: "/executive-plans", icon: CalendarCheck, desc: "متابعة شهرية",
    color: "text-emerald-600", bg: "bg-emerald-100", activeBg: "bg-emerald-500", activeText: "text-white" },
  { title: "مهامي اليومية", href: "/tasks", icon: ClipboardList, desc: "ما يجب إنجازه اليوم",
    color: "text-amber-600", bg: "bg-amber-100", activeBg: "bg-amber-500", activeText: "text-white" },
  { title: "تقييم أدائي", href: "/performance", icon: FileText, desc: "تقاريرك الشخصية",
    color: "text-yellow-600", bg: "bg-yellow-100", activeBg: "bg-yellow-500", activeText: "text-white" },
];

const settingsNavItem: NavItem = {
  title: "الإعدادات",
  href: "/settings",
  icon: Settings,
  desc: "تفضيلات الحساب",
  color: "text-slate-600",
  bg: "bg-slate-100",
  activeBg: "bg-slate-600",
  activeText: "text-white",
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, previewAsEmployee, setPreviewAsEmployee, previewingEmployee } = useUser();
  const { signOut, user: authUser } = useAuth();
  const [roleLevel, setRoleLevel] = useState<"admin" | "manager" | "employee">("employee");

  const isActuallyAdmin = !previewAsEmployee && user.role === "مدير النظام";

  useEffect(() => {
    const fetchRoleLevel = async () => {
      if (!authUser) return;
      const { data: userRole } = await supabase.rpc("get_user_role", { _user_id: authUser.id });
      if (userRole === "admin" || userRole === "super_admin") {
        setRoleLevel("admin");
        return;
      }
      const { data } = await supabase
        .from("employees")
        .select("role_level")
        .eq("user_id", authUser.id)
        .maybeSingle();
      setRoleLevel((data?.role_level as any) || "employee");
    };
    fetchRoleLevel();
  }, [authUser, isActuallyAdmin]);

  // Notifications
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!authUser) return;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      if (count !== null) setUnreadCount(count);
    };
    fetchUnreadCount();
    const channel = supabase
      .channel("sidebar-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, fetchUnreadCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [authUser]);

  // Unread messages
  useEffect(() => {
    const fetchUnreadMessages = async () => {
      if (!authUser) return;
      try {
        const { data: convRows } = await supabase.rpc("get_conversations_for_user", { _user_id: authUser.id });
        if (!convRows || convRows.length === 0) { setUnreadMessagesCount(0); return; }
        const conversationIds = (convRows as any[]).map((row) => row.conversation_id);
        const { data: myParticipations } = await supabase
          .from("conversation_participants")
          .select("conversation_id, last_read_at")
          .eq("user_id", authUser.id)
          .in("conversation_id", conversationIds);
        const lastReadMap = new Map((myParticipations || []).map((p) => [p.conversation_id, p.last_read_at]));
        let totalUnread = 0;
        for (const convId of conversationIds) {
          const lastRead = lastReadMap.get(convId);
          let query = supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", convId)
            .eq("is_deleted", false)
            .neq("sender_id", authUser.id);
          if (lastRead) query = query.gt("created_at", lastRead);
          const { count } = await query;
          if (count) totalUnread += count;
        }
        setUnreadMessagesCount(totalUnread);
      } catch (error) {
        console.error("Error fetching unread messages:", error);
      }
    };
    fetchUnreadMessages();
    const messagesChannel = supabase
      .channel("sidebar-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, fetchUnreadMessages)
      .subscribe();
    const participantsChannel = supabase
      .channel("sidebar-conversation-participants")
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversation_participants", filter: `user_id=eq.${authUser.id}` },
        fetchUnreadMessages)
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
    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + "/");
    const badgeCount = item.badge;
    return (
      <Link
        to={item.href}
        state={{ fromNavigation: true }}
        className={cn(
          "group relative flex items-start gap-3 rounded-xl p-3 transition-all",
          isActive ? "bg-muted" : "hover:bg-muted/60"
        )}
      >
        {isActive && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-l-full bg-primary" />
        )}
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors shadow-sm",
          isActive
            ? `${item.activeBg} ${item.activeText}`
            : `${item.bg} ${item.color} group-hover:scale-105`
        )}>
          <item.icon className="w-5 h-5" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold leading-tight text-foreground flex-1">
                {item.title}
              </span>
              {badgeCount && badgeCount > 0 && (
                <span
                  className="text-[10px] font-bold min-w-5 h-5 px-1 rounded-full flex items-center justify-center bg-amber-500 text-white"
                  style={{ fontFamily: "Arial, sans-serif" }}
                >
                  {badgeCount > 9 ? "9+" : formatNumberPlain(badgeCount)}
                </span>
              )}
            </div>
            {item.desc && (
              <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                {item.desc}
              </div>
            )}
          </div>
        )}
      </Link>
    );
  };

  const navItems = previewAsEmployee
    ? employeeNavItems
    : roleLevel === "admin"
      ? adminNavItems
      : roleLevel === "manager"
        ? managerNavItems
        : employeeNavItems;

  const totalUnread = unreadCount + unreadMessagesCount;

  return (
    <aside
      className={cn(
        "fixed top-0 right-0 h-screen z-40 border-l border-border bg-white flex flex-col shadow-card transition-all duration-300",
        collapsed ? "w-20" : "w-72"
      )}
    >
      {/* Brand — شعار الجمعية */}
      <div className="px-4 pt-5 pb-3 border-b border-border">
        <Link to="/" className="flex flex-col items-center gap-2" title="العودة للصفحة الرئيسية">
          <div className="relative">
            <div
              className="absolute inset-[-6px] rounded-full border-2 border-dashed border-accent/40 animate-spin"
              style={{ animationDuration: "12s" }}
            />
            <div className={cn(
              "relative rounded-full bg-white border-2 border-border flex items-center justify-center shadow-md overflow-hidden",
              collapsed ? "w-12 h-12" : "w-20 h-20"
            )}>
              <img src={atefLogoIcon} alt="جمعية عطف" className="w-3/4 h-3/4 object-contain" />
            </div>
          </div>
          {!collapsed && (
            <div className="text-center">
              <h1 className="text-sm font-bold text-foreground leading-tight">جمعية عطف</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">نظام إدارة التسويق</p>
            </div>
          )}
        </Link>
      </div>

      {/* Profile Card — بنفس الحجم تقريبًا */}
      {!collapsed && (
        <div className="p-4 border-b border-border">
          <div className="rounded-2xl bg-muted/40 p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full overflow-hidden border-[3px] border-accent shadow-sm flex-shrink-0">
                {user.profileImage ? (
                  <img src={user.profileImage} alt="صورة المستخدم" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-xl font-bold text-white">
                    {user.firstName.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-foreground text-sm truncate">
                  {user.firstName} {user.lastName}
                </h3>
                <span className="inline-block mt-1 text-[10px] text-accent font-semibold bg-accent/10 rounded-full px-2 py-0.5 border border-accent/20">
                  {user.role}
                </span>
              </div>
            </div>

            <Link
              to="/profile"
              className="mt-2 flex items-center gap-2 rounded-lg bg-white hover:bg-muted px-2.5 py-2 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center shadow-sm">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-semibold text-foreground flex-1">الملف الشخصي</span>
              <div className="relative">
                <Bell className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                {totalUnread > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center"
                    style={{ fontFamily: "Arial, sans-serif" }}
                  >
                    {totalUnread > 9 ? "9+" : formatNumberPlain(totalUnread)}
                  </span>
                )}
              </div>
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}

        <div className="pt-3 mt-3 border-t border-border">
          <NavLink item={settingsNavItem} />
        </div>

        {(isActuallyAdmin || previewAsEmployee) && (
          <div className="pt-3 mt-3 border-t border-border">
            {previewAsEmployee ? (
              <>
                <button
                  onClick={() => setPreviewAsEmployee(false)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors text-sm font-medium"
                >
                  <EyeOff className="w-4 h-4" />
                  {!collapsed && <span>إلغاء المعاينة</span>}
                </button>
                {!collapsed && (
                  <p className="text-[11px] text-amber-600 text-center mt-1">
                    {previewingEmployee ? `معاينة: ${previewingEmployee.full_name}` : "أنت في وضع المعاينة"}
                  </p>
                )}
              </>
            ) : (
              <button
                onClick={() => setPreviewAsEmployee(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-muted text-foreground hover:bg-muted/70 transition-colors text-sm font-medium"
              >
                <Eye className="w-4 h-4" />
                {!collapsed && <span>معاينة كموظف</span>}
              </button>
            )}
          </div>
        )}
      </nav>

      {/* Footer actions */}
      <div className="p-3 border-t border-border space-y-2">
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full justify-center gap-2 font-semibold hover:bg-muted"
          size="default"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </Button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted transition-colors text-xs"
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
    </aside>
  );
}
