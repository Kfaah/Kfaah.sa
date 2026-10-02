import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { notificationPreferences } from "@/lib/notificationPreferences";

export function NotificationListener() {
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const enabled = notificationPreferences(user).in_app_alerts;
  useEffect(() => {
    if (!user?.id || !enabled) return;
    const channel = supabase.channel(`notification-alerts-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, ({ new: row }) => {
        if (row.user_id !== user.id || row.is_read || (currentOrg?.id && row.organization_id !== currentOrg.id)) return;
        toast.info(row.title || "إشعار جديد", { id: `notification-${row.id}`, description: row.message || undefined, duration: 6000 });
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, currentOrg?.id, enabled]);
  return null;
}
