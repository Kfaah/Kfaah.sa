import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, GitCompareArrows, Sparkles, FileBarChart2,
  Building2, LogOut, ArrowLeftCircle, ListChecks, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
  { to: "/admin/action-plans", label: "الخطط من التوصيات", icon: ListChecks, end: false,
    desc: "تحويل التحليل إلى خطة وتكليف",
    color: "text-fuchsia-600", bg: "bg-fuchsia-100", activeBg: "bg-fuchsia-500", activeText: "text-white" },
  { to: "/admin/reports", label: "التقارير", icon: FileBarChart2, end: false,
    desc: "تقارير موضوعية وتنفيذية سردية",
    color: "text-rose-600", bg: "bg-rose-100", activeBg: "bg-rose-500", activeText: "text-white" },
  { to: "/admin/innovation", label: "الابتكار والتحديث", icon: Lightbulb, end: false,
    desc: "أفكار AI ابتكارية ونقاش تفاعلي",
    color: "text-amber-600", bg: "bg-amber-100", activeBg: "bg-amber-500", activeText: "text-white" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState<{ name: string; avatar: string | null }>({
    name: "مدير النظام",
    avatar: null,
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const fullName =
        [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() ||
        user.email ||
        "مدير النظام";
      setProfile({ name: fullName, avatar: data?.avatar_url ?? null });
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  const initials = profile.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase() || "م";

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  return (
    <div
      className="min-h-screen"
      dir="rtl"
      style={{
        background:
          "linear-gradient(135deg, hsl(190 50% 28%) 0%, hsl(192 55% 24%) 50%, hsl(195 60% 20%) 100%)",
      }}
    >
      {/* Sidebar — أبيض كلاسيكي يمين الشاشة (RTL) */}
      <aside className="fixed top-0 right-0 h-screen w-72 z-40 border-l border-border bg-white flex flex-col shadow-card">
        {/* Brand */}
        <div className="p-6 border-b border-border">
          <div className="flex flex-col items-center text-center gap-2">
            <Avatar className="w-16 h-16 ring-2 ring-primary/20 shadow-md">
              {profile.avatar && <AvatarImage src={profile.avatar} alt={profile.name} />}
              <AvatarFallback
                className="text-white font-bold text-lg"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(190 50% 28%) 0%, hsl(195 60% 20%) 100%)",
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-foreground font-bold text-sm leading-tight">{profile.name}</h1>
              <p className="text-muted-foreground text-[11px] mt-0.5">مدير النظام</p>
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
                  active ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                {active && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-l-full bg-primary" />
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
                  <div className="text-sm font-semibold leading-tight text-foreground">
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
        <div className="p-3 border-t border-border">
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full justify-center gap-2 font-semibold hover:bg-muted"
            size="default"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Main content - تدرّج تركوازي بترولي داكن */}
      <main
        className="mr-72 relative min-h-screen"
        style={{
          background:
            "linear-gradient(135deg, hsl(190 50% 28%) 0%, hsl(192 55% 24%) 50%, hsl(195 60% 20%) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative z-10 admin-soft-surface">{children}</div>
      </main>
    </div>
  );
}
