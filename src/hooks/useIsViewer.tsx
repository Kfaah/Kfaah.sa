import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns true when the currently authenticated user is a read-only
 * "viewer" account (one of the per-organization viewer accounts).
 * Used to hide create/edit/delete UI across the app.
 */
export function useIsViewer() {
  const { user } = useAuth();
  const [isViewer, setIsViewer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) {
        if (!cancelled) {
          setIsViewer(false);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase.rpc("is_viewer", { _user_id: user.id });
      if (!cancelled) {
        setIsViewer(!!data);
        setLoading(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isViewer, loading };
}