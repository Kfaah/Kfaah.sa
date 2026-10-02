import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/contexts/OrganizationContext";
import { canAccessOrgSettings } from "@/lib/orgAuthorization";

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
  const { currentOrg } = useOrganization();
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
      const ok = await canAccessOrgSettings(
        user.id,
        currentOrg?.id,
      );
      if (!cancelled) {
        setAllowed(ok);
        setLoading(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user, currentOrg?.id]);

  return { allowed, loading };
}