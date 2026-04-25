import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Floating Action Button that opens the employee AI assistant.
 * Shown only for authenticated, non-admin employees on standard pages.
 */
export function AssistantFab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user?.id) return setShow(false);
      // Hide on admin/auth/onboarding/assistant pages and embedded iframes
      const path = location.pathname;
      const search = new URLSearchParams(location.search);
      if (
        search.get("embedded") === "1" ||
        path.startsWith("/admin") ||
        path === "/" ||
        path.startsWith("/auth") ||
        path.includes("employee-onboarding") ||
        path.includes("my-assistant")
      ) {
        setShow(false);
        return;
      }
      // Only employees (non-admins) — keep it personal
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!cancelled) setShow(!isAdmin);
    };
    check();
    return () => { cancelled = true; };
  }, [user?.id, location.pathname, location.search]);

  if (!show) return null;

  // Preserve org slug if present in current path
  const segments = location.pathname.split("/").filter(Boolean);
  const slug = segments[0] && !["admin", "auth"].includes(segments[0])
    ? segments[0]
    : null;
  const target = slug ? `/${slug}/my-assistant` : "/my-assistant";

  return (
    <button
      onClick={() => navigate(target)}
      aria-label="المساعد الذكي"
      className={cn(
        "fixed bottom-6 left-6 z-50 group",
        "flex items-center gap-2 rounded-full",
        "bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600",
        "text-white shadow-2xl shadow-fuchsia-500/40",
        "px-5 py-3 transition-all hover:scale-105 hover:shadow-fuchsia-500/60",
        "ring-2 ring-white/30 hover:ring-white/60",
      )}
    >
      <span className="relative">
        <Sparkles className="h-5 w-5" />
        <span className="absolute -inset-1 rounded-full bg-white/30 blur opacity-0 group-hover:opacity-100 transition" />
      </span>
      <span className="font-bold text-sm">المساعد الذكي</span>
    </button>
  );
}