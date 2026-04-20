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
    grad: "from-violet-500 to-purple-600", desc: "ملخّص شامل لكل الجمعيات" },
  { to: "/admin/organizations", label: "الجمعيات", icon: Building2, end: false,
    grad: "from-cyan-400 to-blue-600", desc: "إدارة وتفاصيل الجمعيات" },
  { to: "/admin/compare", label: "المقارنة بين الجمعيات", icon: GitCompareArrows, end: false,
    grad: "from-emerald-400 to-teal-600", desc: "رادار · ترتيب · معايير متعددة" },
  { to: "/admin/analytics", label: "التحليل العميق", icon: Sparkles, end: false,
    grad: "from-fuchsia-500 to-pink-600", desc: "تحليل AI لكل جمعية" },
  { to: "/admin/reports", label: "التقارير", icon: FileBarChart2, end: false,
    grad: "from-amber-400 to-orange-500", desc: "تقارير دقيقة قابلة للتصدير" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const location = useLocation();

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Sidebar — يمين الشاشة (RTL) */}
      <aside className="fixed top-0 right-0 h-screen w-72 z-40 border-l border-white/10 bg-slate-900/80 backdrop-blur-xl flex flex-col">
        {/* Brand */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">مدير النظام</h1>
              <p className="text-slate-400 text-[11px]">CharityCRM Command Center</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
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
                    ? "bg-white/10 shadow-lg"
                    : "hover:bg-white/5"
                )}
              >
                {active && (
                  <span className={cn(
                    "absolute right-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-l-full bg-gradient-to-b",
                    item.grad
                  )} />
                )}
                <div className={cn(
                  "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-md flex-shrink-0",
                  item.grad
                )}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-sm font-semibold leading-tight",
                    active ? "text-white" : "text-slate-200"
                  )}>
                    {item.label}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">
                    {item.desc}
                  </div>
                </div>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-white/10 space-y-2">
          <Button
            onClick={() => navigate("/app")}
            variant="ghost"
            className="w-full justify-start gap-2 text-slate-200 hover:bg-white/10 hover:text-white"
            size="sm"
          >
            <ArrowLeftCircle className="w-4 h-4" />
            الانتقال إلى نظام جمعية
          </Button>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="w-full justify-start gap-2 text-slate-300 hover:bg-rose-500/20 hover:text-rose-200"
            size="sm"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="mr-72 relative z-10 min-h-screen">
        {children}
      </main>
    </div>
  );
}
