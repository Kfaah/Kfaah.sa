import { ReactNode } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, GitCompareArrows, Sparkles, FileBarChart2,
  Building2, LogOut, Crown, ArrowLeftCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", label: "نظرة عامة موحّدة", icon: LayoutDashboard, end: true,
    desc: "ملخّص شامل لكل الجمعيات",
    color: "text-sky-600", bg: "bg-sky-100", activeBg: "bg-sky-500", activeText: "text-white" },
  { to: "/admin/organizations", label: "الجمعيات", icon: Building2, end: false,
    desc: "إدارة وتفاصيل الجمعيات",
    color: "text-emerald-600", bg: "bg-emerald-100", activeBg: "bg-emerald-500", activeText: "text-white" },
  { to: "/admin/compare", label: "المقارنة بين الجمعيات", icon: GitCompareArrows, end: false,
    desc: "رادار · ترتيب · معايير متعددة",
    color: "text-violet-600", bg: "bg-violet-100", activeBg: "bg-violet-500", activeText: "text-white" },
  { to: "/admin/analytics", label: "التحليل العميق", icon: Sparkles, end: false,
    desc: "تحليل AI لكل جمعية",
    color: "text-amber-600", bg: "bg-amber-100", activeBg: "bg-amber-500", activeText: "text-white" },
  { to: "/admin/reports", label: "التقارير", icon: FileBarChart2, end: false,
    desc: "تقارير دقيقة قابلة للتصدير",
    color: "text-rose-600", bg: "bg-rose-100", activeBg: "bg-rose-500", activeText: "text-white" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Sidebar — يمين الشاشة (RTL) */}
      <aside className="fixed top-0 right-0 h-screen w-72 z-40 border-l border-sidebar-border bg-sidebar flex flex-col shadow-card">
        {/* Brand */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-md">
              <Crown className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sidebar-foreground font-bold text-base leading-tight">مدير النظام</h1>
              <p className="text-muted-foreground text-[11px]">مركز قيادة عطف</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={cn(
                  "group relative flex items-start gap-3 rounded-xl p-3 transition-all",
                  active
                    ? "bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/60"
                )}
              >
                {active && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-l-full bg-accent" />
                )}
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors shadow-sm",
                  active
                    ? `${item.activeBg} ${item.activeText}`
                    : `${item.bg} ${item.color} group-hover:scale-105`
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-semibold leading-tight",
                    active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground"
                  )}>
                    {item.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                    {item.desc}
                  </div>
                </div>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-sidebar-border space-y-1">
          <Button
            onClick={() => navigate("/app")}
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
            size="sm"
          >
            <ArrowLeftCircle className="w-4 h-4" />
            الانتقال إلى نظام جمعية
          </Button>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            size="sm"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main content - خلفية داكنة أخف موحّدة لكل صفحات الـ Admin */}
      <main className="mr-72 relative min-h-screen bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700">
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 admin-dark-surface">{children}</div>
      </main>
    </div>
  );
}
