import { useEffect, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import OrgInternalDashboard from "@/pages/admin/OrgInternalDashboard";
import { WelcomeScreen } from "@/components/welcome/WelcomeScreen";
import { useIsDemo } from "@/hooks/useIsDemo";
import { getOrgPrivilegeFlags } from "@/lib/orgAuthorization";
import AdminActionPlanDetails from "@/pages/admin/AdminActionPlanDetails";

/**
 * Wrapper around OrgInternalDashboard for org-side access.
 * Resolves orgId from:
 *   1) route slug (/:slug/internal-dashboard) → organizations.slug
 *   2) current user's default organization
 * Then injects it into the URL via a client redirect-free render.
 */
export default function InternalDashboard() {
  const { slug, planId } = useParams<{ slug?: string; planId?: string }>();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? undefined;
  const isSectionRoute = Boolean(tab || planId);
  const { user } = useAuth();
  const { isDemo, loading: demoLoading } = useIsDemo();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  // عرض شاشة الترحيب لمستخدمي النموذج التجريبي عند أول دخول في الجلسة
  useEffect(() => {
    if (demoLoading) return;
    if (!isDemo) return;
    if (isSectionRoute) return; // لا نعرضها في صفحات التبويبات المستقلة
    try {
      const seen = sessionStorage.getItem("demo_welcome_seen");
      if (!seen) {
        setShowWelcome(true);
        sessionStorage.setItem("demo_welcome_seen", "1");
      }
    } catch {
      setShowWelcome(true);
    }
  }, [isDemo, demoLoading, isSectionRoute]);

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
      // A requested slug must never silently fall back to another organization.
      if (!slug && !resolvedOrgId) {
        const { data } = await supabase.rpc("get_user_organization_id", { _user_id: user.id });
        resolvedOrgId = (data as string | null) ?? null;
      }

      // 2) authorize against the organization being opened.
      let canSee = false;
      if (resolvedOrgId) {
        const flags = await getOrgPrivilegeFlags(user.id, resolvedOrgId);
        canSee = flags.isSuperAdmin || flags.isOrgAdmin;

        if (!canSee) {
          const [{ data: viewer }, { data: membership }, { data: emp }] =
            await Promise.all([
              supabase.rpc("is_viewer", { _user_id: user.id }),
              supabase
                .from("user_organizations")
                .select("id")
                .eq("user_id", user.id)
                .eq("organization_id", resolvedOrgId)
                .eq("approval_status", "approved")
                .maybeSingle(),
              supabase
                .from("employees")
                .select("role_level")
                .eq("user_id", user.id)
                .eq("organization_id", resolvedOrgId)
                .maybeSingle(),
            ]);

          canSee =
            (!!viewer && !!membership) ||
            emp?.role_level === "admin";
        }
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
      {showWelcome && <WelcomeScreen />}
      {planId ? <AdminActionPlanDetails orgIdProp={orgId} /> :
        <OrgInternalDashboard orgIdProp={orgId} initialTab={tab} standaloneTab={isSectionRoute} />}
    </DashboardLayout>
  );
}
