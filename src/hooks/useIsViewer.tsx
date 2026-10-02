import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns true when the currently authenticated user is a read-only
 * "viewer" account (one of the per-organization viewer accounts).
 * Used to hide create/edit/delete UI across the app.
 */
export function useIsViewer() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const [isViewer, setIsViewer] = useState(true);
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
      setIsViewer(true); setLoading(true);
      if (!currentOrg?.id) { setLoading(false); return; }
      const { data, error } = await supabase.rpc("organization_member_can_write", { _user: user.id, _org: currentOrg.id });
      if (!cancelled) {
        setIsViewer(!!error || data !== true);
        setLoading(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user, currentOrg?.id]);

  return { isViewer, loading };
}