import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const DEMO_ORG_ID = "00000000-0000-0000-0000-0000000000de";

/**
 * Returns true when the current session is the public demo viewer
 * (logged into the demo organization). Used to gate write UI, exports,
 * copy/right-click, and to render the demo banner + watermark.
 */
export function useIsDemo() {
  const { user } = useAuth();
  const location = useLocation();
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      // Fast path: the URL is under /demo
      const segs = location.pathname.split("/").filter(Boolean);
      if (segs[0] === "demo") {
        if (!cancelled) {
          setIsDemo(true);
          setLoading(false);
        }
        return;
      }
      if (!user) {
        if (!cancelled) {
          setIsDemo(false);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("user_organizations")
        .select("organization_id, approval_status")
        .eq("user_id", user.id)
        .eq("organization_id", DEMO_ORG_ID)
        .maybeSingle();
      if (!cancelled) {
        setIsDemo(!!data && data.approval_status === "approved");
        setLoading(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [user, location.pathname]);

  return { isDemo, loading };
}
