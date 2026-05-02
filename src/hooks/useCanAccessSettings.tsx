import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * صلاحية الوصول لصفحة الإعدادات.
 * مسموح فقط لـ:
 *  - مدير النظام (super_admin)
 *  - مدير الجمعية (admin)
 *  - مدير التسويق (moderator)
 *
 * ممنوع: رئيس القسم (manager) والموظف العادي (user) وبقية الأدوار.
 */
export function useCanAccessSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) {
        if (!cancelled) {
          setAllowed(false);
          setLoading(false);
        }
        return;
      }
      const checks = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "super_admin" }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user.id, _role: "moderator" }),
      ]);
      const ok = checks.some((r) => r.data === true);
      if (!cancelled) {
        setAllowed(ok);
        setLoading(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { allowed, loading };
}