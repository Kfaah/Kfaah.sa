import { ReactNode, useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, GitCompareArrows, Sparkles,
  Building2, LogOut, ArrowLeftCircle, Settings,
  MessagesSquare, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";


// Distinctive icon colors per nav item — vibrant gradients
const ICON_COLOR = "text-white";

const navItems = [
  { to: "/admin", label: "نظرة عامة موحّدة", icon: LayoutDashboard, end: true,
    desc: "ملخّص شامل لكل الجمعيات",
    color: ICON_COLOR, bg: "bg-gradient-to-br from-violet-500 to-purple-600", ring: "ring-violet-400/40" },
  { to: "/admin/organizations", label: "الجمعيات", icon: Building2, end: false,
    desc: "إدارة وتفاصيل الجمعيات",
    color: ICON_COLOR, bg: "bg-gradient-to-br from-indigo-400 to-indigo-600", ring: "ring-indigo-400/40" },
  { to: "/admin/compare", label: "المقارنة بين الجمعيات", icon: GitCompareArrows, end: false,
    desc: "رادار · ترتيب · معايير متعددة",
    color: ICON_COLOR, bg: "bg-gradient-to-br from-cyan-400 to-cyan-600", ring: "ring-cyan-400/40" },
  { to: "/admin/analytics", label: "التحليل الذكي", icon: Sparkles, end: false,
    desc: "تحليل AI لكل جمعية",
    color: ICON_COLOR, bg: "bg-gradient-to-br from-fuchsia-500 to-pink-600", ring: "ring-fuchsia-400/40" },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const location = useLocation();
  // Embedded mode: when this admin page is rendered inside an iframe of the
  // org internal dashboard, hide the admin sidebar so only the page content
  // shows (no double sidebars).
  const isEmbedded =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embedded") === "1";
  const orgSlug =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("org")
      : null;
  const [orgBgStyle, setOrgBgStyle] = useState<string | null>(null);

  // When embedded inside an organization dashboard, derive the page
  // background from that organization's brand identity so the inner
  // pages (innovation, action plans, reports, ...) feel native to the org.
  useEffect(() => {
    if (!isEmbedded || !orgSlug) return;
    let cancelled = false;
    (async () => {
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", orgSlug)
        .maybeSingle();
      if (!org?.id || cancelled) return;
      const { data: profile } = await supabase
        .from("organization_profiles")
        .select("primary_color, secondary_color")
        .eq("organization_id", org.id)
        .maybeSingle();
      if (cancelled) return;
      const primary = (profile as Record<string, string | null> | null)?.primary_color;
      if (primary) {
        // Solid, professional brand surface so white headers/text on the
        // inner pages remain crisp and fully readable.
        setOrgBgStyle(primary);
      }
    })();
    return () => { cancelled = true; };
  }, [isEmbedded, orgSlug]);

  const [profile, setProfile] = useState<{ name: string; avatar: string | null }>({
    name: "مدير النظام",
    avatar: null,
  });

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = async () => {
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
    };
    load();

    // Realtime: refresh sidebar identity when profile changes
    const channel = supabase
      .channel(`admin-profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    // Cross-tab/page refresh signal (fired after avatar updates)
    const onProfileUpdated = () => load();
    window.addEventListener("admin-profile-updated", onProfileUpdated);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("admin-profile-updated", onProfileUpdated);
    };
  }, [user?.id, user?.email]);

  const initials = profile.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase() || "م";

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  if (isEmbedded) {
    return (
      <div
        className="min-h-screen bg-transparent"
        dir="rtl"
      >
        <div className="relative z-10 admin-soft-surface">{children}</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      dir="rtl"
      style={{
        background:
          "linear-gradient(135deg, hsl(190 50% 28%) 0%, hsl(192 55% 24%) 50%, hsl(195 60% 20%) 100%)",
      }}
    >
      {/* Subtle cosmic touches — twinkling stars + nebula glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 28% 62%, rgba(255,255,255,0.5), transparent), radial-gradient(1.5px 1.5px at 47% 24%, rgba(255,236,170,0.7), transparent), radial-gradient(1px 1px at 63% 78%, rgba(255,255,255,0.55), transparent), radial-gradient(1px 1px at 82% 32%, rgba(255,255,255,0.6), transparent), radial-gradient(1.5px 1.5px at 91% 70%, rgba(255,236,170,0.6), transparent), radial-gradient(1px 1px at 35% 88%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 70% 12%, rgba(255,255,255,0.55), transparent)",
          backgroundSize: "100% 100%",
        }}
      />
      <div
        className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(44 92% 55% / 0.5), transparent 70%)" }}
      />
      <div
        className="absolute bottom-0 right-1/3 w-[520px] h-[520px] rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(168 76% 45% / 0.6), transparent 70%)" }}
      />

      {/* Sidebar — أبيض كلاسيكي يمين الشاشة (RTL) */}
      <aside
        className="fixed top-0 right-0 h-screen w-72 z-40 border-l border-amber-300/15 flex flex-col shadow-2xl overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, #2f8e8c 0%, #2f8e8c 50%, #2f8e8c 100%)",
        }}
      >
        {/* Subtle radial vignette + noise overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 0%, rgba(61,181,176,0.18) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 60%)",
          }}
        />
        {/* Soft floating orb */}
        <div className="absolute -top-12 -left-10 w-40 h-40 rounded-full bg-teal-300/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-24 -right-12 w-44 h-44 rounded-full bg-amber-300/[0.06] blur-3xl pointer-events-none" />

        <div className="relative flex flex-col h-full">
        {/* Brand — Executive identity card */}
        <div
          className="relative px-5 py-6 border-b border-amber-300/20 overflow-hidden"
        >
          {/* Subtle ornamental pattern */}
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 0%, rgba(255,255,255,0.4) 0%, transparent 40%), radial-gradient(circle at 80% 100%, rgba(255,255,255,0.25) 0%, transparent 40%)",
            }}
          />
          {/* Gold corner accent */}
          <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-amber-300/60 rounded-tl-md" />
          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-amber-300/60 rounded-br-md" />

          <div className="relative flex flex-col items-center text-center gap-3">
            {/* Avatar with double ring */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 blur-sm opacity-60" />
              <Avatar className="relative w-28 h-28 ring-2 ring-amber-300/80 ring-offset-2 ring-offset-transparent shadow-2xl">
                {profile.avatar && (
                  <AvatarImage
                    src={profile.avatar}
                    alt={profile.name}
                    className="object-cover"
                    style={{ imageRendering: "auto" as React.CSSProperties["imageRendering"] }}
                    loading="eager"
                    decoding="sync"
                  />
                )}
                <AvatarFallback
                  className="text-white font-bold text-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(190 50% 35%) 0%, hsl(195 60% 25%) 100%)",
                  }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <h1 className="text-white font-bold text-base leading-tight tracking-wide">
                {profile.name}
              </h1>

              {/* Decorative divider with diamond */}
              <div className="flex items-center justify-center gap-2 px-2">
                <span className="h-px w-8 bg-gradient-to-l from-transparent via-amber-300/60 to-amber-300/60" />
                <span className="w-1.5 h-1.5 rotate-45 bg-amber-300/80" />
                <span className="h-px w-8 bg-gradient-to-r from-transparent via-amber-300/60 to-amber-300/60" />
              </div>

              {/* Title badge */}
              <p className="text-amber-200 text-[11px] font-semibold tracking-[0.25em] uppercase">
                مدير النظام
              </p>
            </div>

            {/* Quick access: نظام التواصل + بريد المنصة */}
            <div className="grid grid-cols-2 gap-2 w-full pt-1">
              <NavLink
                to="/internal-inbox"
                className="group flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 bg-white/10 hover:bg-white/20 border border-amber-300/40 hover:border-amber-300/70 ring-1 ring-amber-300/20 text-white text-[11px] font-bold backdrop-blur-sm transition-all"
              >
                <MessagesSquare className="w-3.5 h-3.5 text-amber-200" />
                نظام التواصل
              </NavLink>
              <NavLink
                to="/inbox"
                className="group flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 bg-white/10 hover:bg-white/20 border border-amber-300/40 hover:border-amber-300/70 ring-1 ring-amber-300/20 text-white text-[11px] font-bold backdrop-blur-sm transition-all"
              >
                <Inbox className="w-3.5 h-3.5 text-amber-200" />
                بريد المنصة
              </NavLink>
            </div>
          </div>
        </div>

        {/* Nav — white surface */}
        <nav className="flex-1 overflow-hidden px-2 py-3 bg-white space-y-1.5">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const active = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <div key={item.to} className="animate-fade-in" style={{ animationDelay: `${idx * 60}ms`, animationFillMode: "both" }}>
              <NavLink
                to={item.to}
                end={item.end}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg pr-3 pl-2 py-2 transition-all duration-300 overflow-hidden",
                  active
                    ? "bg-gradient-to-l from-amber-50 to-white shadow-md ring-1 ring-amber-300/70 -translate-x-0.5"
                    : "bg-white hover:bg-amber-50/60 ring-1 ring-slate-200/70 hover:ring-amber-300/50 hover:-translate-x-0.5 hover:shadow-sm"
                )}
              >
                {/* Shimmer sweep on hover */}
                <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1100ms] ease-out bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />
                {/* Right vertical gold accent bar */}
                <span
                  className={cn(
                    "absolute right-0 top-0 bottom-0 w-[3px] transition-all duration-300",
                    active
                      ? "bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.7)]"
                      : "bg-transparent group-hover:bg-amber-300/60"
                  )}
                />
                <div
                  className={cn(
                    "relative w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 border border-white shadow-sm",
                    active
                      ? `${item.bg} ${item.color} ring-2 ring-amber-300/70`
                      : `${item.bg} ${item.color} ring-1 ${item.ring} group-hover:shadow-md group-hover:scale-110 group-hover:rotate-3`
                  )}
                >
                  <Icon className="w-[22px] h-[22px]" strokeWidth={2.4} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-[12.5px] font-bold leading-tight truncate tracking-tight transition-colors",
                    active ? "text-primary" : "text-slate-800 group-hover:text-primary"
                  )}>
                    {item.label}
                  </div>
                  <div className={cn(
                    "text-[10px] leading-tight mt-0.5 truncate transition-colors",
                    active ? "text-amber-700" : "text-slate-500 group-hover:text-amber-700/80"
                  )}>
                    {item.desc}
                  </div>
                </div>
                {/* Decorative diamond on active */}
                {active && (
                  <span className="w-1.5 h-1.5 rotate-45 bg-amber-300/90 shadow-[0_0_8px_rgba(251,191,36,0.8)] flex-shrink-0" />
                )}
              </NavLink>
              </div>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div
          className="p-3 border-t border-amber-300/20 relative overflow-hidden"
        >
          {/* Gold corner accents to match brand header */}
          <div className="absolute top-1.5 left-1.5 w-5 h-5 border-t-2 border-l-2 border-amber-300/60 rounded-tl-md pointer-events-none" />
          <div className="absolute bottom-1.5 right-1.5 w-5 h-5 border-b-2 border-r-2 border-amber-300/60 rounded-br-md pointer-events-none" />
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              cn(
                "relative w-full flex items-center justify-center gap-2 font-semibold rounded-md px-3 py-2 mb-2 text-white border transition-all backdrop-blur-sm",
                isActive
                  ? "bg-amber-300/20 border-amber-300/70 ring-1 ring-amber-300/40 shadow-lg"
                  : "bg-white/5 hover:bg-white/15 border-amber-300/40 hover:border-amber-300/70 ring-1 ring-amber-300/20 shadow-lg"
              )
            }
          >
            <Settings className="w-4 h-4 text-amber-200" />
            الإعدادات
          </NavLink>
          <Button
            onClick={handleSignOut}
            className="relative w-full justify-center gap-2 font-semibold text-white bg-white/5 hover:bg-white/15 border border-amber-300/40 hover:border-amber-300/70 ring-1 ring-amber-300/20 shadow-lg backdrop-blur-sm transition-all"
            size="default"
          >
            <LogOut className="w-4 h-4 text-amber-200" />
            تسجيل الخروج
          </Button>
        </div>
        </div>
      </aside>

      {/* Main content - تدرّج تركوازي بترولي داكن */}
      <main
        className="mr-72 relative min-h-screen z-10"
        style={{
          background:
            "linear-gradient(135deg, hsl(190 50% 28% / 0.92) 0%, hsl(192 55% 24% / 0.92) 50%, hsl(195 60% 20% / 0.92) 100%)",
        }}
      >
        {/* faint stars overlay on main for unified cosmic feel */}
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 18% 22%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 42% 68%, rgba(255,236,170,0.55), transparent), radial-gradient(1px 1px at 73% 18%, rgba(255,255,255,0.5), transparent), radial-gradient(1.5px 1.5px at 88% 56%, rgba(255,236,170,0.6), transparent), radial-gradient(1px 1px at 30% 84%, rgba(255,255,255,0.55), transparent)",
          }}
        />
        <div className="relative z-10 admin-soft-surface">{children}</div>
      </main>
    </div>
  );
}
