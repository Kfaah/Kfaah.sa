import { useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import OrgInternalDashboard from "@/pages/admin/OrgInternalDashboard";

/**
 * Wrapper around OrgInternalDashboard for org-side access.
 * Resolves orgId from:
 *   1) route slug (/:slug/internal-dashboard) → organizations.slug
 *   2) current user's default organization
 * Then injects it into the URL via a client redirect-free render.
 */
export default function InternalDashboard() {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? undefined;
  const isSectionRoute = Boolean(tab);
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setLoading(false); return; }

      // 1) resolve org id
      let resolvedOrgId: string | null = null;
      if (slug) {
        const { data } = await supabase
          .from("organizations")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();
        resolvedOrgId = data?.id ?? null;
      }
      if (!resolvedOrgId) {
        const { data } = await supabase.rpc("get_user_organization_id", { _user_id: user.id });
        resolvedOrgId = (data as string | null) ?? null;
      }

      // 2) check role: admin / super_admin / employees.role_level=admin
      const { data: roleRow } = await supabase.rpc("get_user_role", { _user_id: user.id });
      let canSee = roleRow === "admin" || roleRow === "super_admin";
      if (!canSee) {
        const { data: emp } = await supabase
          .from("employees")
          .select("role_level")
          .eq("user_id", user.id)
          .maybeSingle();
        canSee = emp?.role_level === "admin";
      }

      if (cancelled) return;
      setOrgId(resolvedOrgId);
      setAllowed(canSee);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, slug]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24" dir="rtl">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!allowed) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto mt-20 text-center p-8 rounded-2xl border border-border bg-card">
          <h2 className="text-2xl font-bold mb-2">صلاحية غير كافية</h2>
          <p className="text-muted-foreground">
            اللوحة الداخلية الشاملة متاحة فقط لمدير الجمعية أو من يملك صلاحية المدير.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (!orgId) return <Navigate to="/app" replace />;

  return (
    <DashboardLayout>
      <OrgInternalDashboard orgIdProp={orgId} initialTab={tab} standaloneTab={isSectionRoute} />
    </DashboardLayout>
  );
}