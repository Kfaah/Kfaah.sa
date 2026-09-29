import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PreviewModeProvider, usePreviewMode } from "@/contexts/PreviewModeContext";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getOrgPrivilegeFlags } from "@/lib/orgAuthorization";
// Eagerly-loaded shells (small + likely needed immediately)
import PublicLanding from "./pages/PublicLanding";

// Lazy-loaded route pages — split into separate chunks to make navigation snappy
const Toaster = lazyWithRetry(() => import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })));
const TooltipProvider = lazyWithRetry(() => import("@/components/ui/tooltip").then((m) => ({ default: m.TooltipProvider })));
const PreviewModeBanner = lazyWithRetry(() => import("@/components/preview/PreviewModeBanner").then((m) => ({ default: m.PreviewModeBanner })));
const OrgAuth = lazyWithRetry(() => import("./pages/OrgAuth"));
const ProtectedAppProviders = lazyWithRetry(() => import("@/components/ProtectedAppProviders"));
const AdminLayout = lazyWithRetry(() => import("@/components/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const AdminOverview = lazyWithRetry(() => import("./pages/admin/AdminOverview"));
const Index = lazyWithRetry(() => import("./pages/Index"));
const Employees = lazyWithRetry(() => import("./pages/Employees"));
const AddEmployee = lazyWithRetry(() => import("./pages/AddEmployee"));
const EditEmployee = lazyWithRetry(() => import("./pages/EditEmployee"));
const Roles = lazyWithRetry(() => import("./pages/Roles"));
const Tasks = lazyWithRetry(() => import("./pages/Tasks"));
const AddTask = lazyWithRetry(() => import("./pages/AddTask"));
const TaskDetails = lazyWithRetry(() => import("./pages/TaskDetails"));
const Plans = lazyWithRetry(() => import("./pages/Plans"));
const ExecutivePlans = lazyWithRetry(() => import("./pages/ExecutivePlans"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const OperationalPlans = lazyWithRetry(() => import("./pages/OperationalPlans"));
const AddOperationalPlan = lazyWithRetry(() => import("./pages/AddOperationalPlan"));
const OperationalPlanDetails = lazyWithRetry(() => import("./pages/OperationalPlanDetails"));
const UploadExcelPlan = lazyWithRetry(() => import("./pages/UploadExcelPlan"));
const AIGeneratePlan = lazyWithRetry(() => import("./pages/AIGeneratePlan"));
const UploadExecutiveExcel = lazyWithRetry(() => import("./pages/UploadExecutiveExcel"));
const AIGenerateExecutivePlan = lazyWithRetry(() => import("./pages/AIGenerateExecutivePlan"));
const AddExecutivePlan = lazyWithRetry(() => import("./pages/AddExecutivePlan"));
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const PlatformFeatures = lazyWithRetry(() => import("./pages/PlatformFeatures"));
const PlatformSubscribe = lazyWithRetry(() => import("./pages/PlatformSubscribe"));
const PlatformAbout = lazyWithRetry(() => import("./pages/PlatformAbout"));
const AboutCreator = lazyWithRetry(() => import("./pages/AboutCreator"));
const PlatformQuick = lazyWithRetry(() => import("./pages/PlatformQuick"));
const PlatformVisionMission = lazyWithRetry(() => import("./pages/PlatformVisionMission"));
const PlatformGoals = lazyWithRetry(() => import("./pages/PlatformGoals"));
const PlatformSupport = lazyWithRetry(() => import("./pages/PlatformSupport"));
const SupportInbox = lazyWithRetry(() => import("./pages/SupportInbox"));
const PlatformMail = lazyWithRetry(() => import("./pages/PlatformMail"));
const Messages = lazyWithRetry(() => import("./pages/Messages"));
const InternalInbox = lazyWithRetry(() => import("./pages/InternalInbox"));
const Unsubscribe = lazyWithRetry(() => import("./pages/Unsubscribe"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const BrandingSettings = lazyWithRetry(() => import("./pages/settings/BrandingSettings"));
const RolesPermissionsSettings = lazyWithRetry(() => import("./pages/settings/RolesPermissionsSettings"));
const NavigationSettings = lazyWithRetry(() => import("./pages/settings/NavigationSettings"));
const IntelligenceProfileSettings = lazyWithRetry(() => import("./pages/settings/IntelligenceProfileSettings"));
const WelcomeSettings = lazyWithRetry(() => import("./pages/settings/WelcomeSettings"));
const MembersSettings = lazyWithRetry(() => import("./pages/settings/MembersSettings"));
const MemberRolesSettings = lazyWithRetry(() => import("./pages/settings/MemberRolesSettings"));
const ExportsSettings = lazyWithRetry(() => import("./pages/settings/ExportsSettings"));
const ComingSoonSettings = lazyWithRetry(() => import("./pages/settings/ComingSoonSettings"));
const BackupSettings = lazyWithRetry(() => import("./pages/settings/BackupSettings"));
import SettingsAccessGuard from "./components/settings/SettingsAccessGuard";
const Uploads = lazyWithRetry(() => import("./pages/Uploads"));
const Organizations = lazyWithRetry(() => import("./pages/Organizations"));
const Intelligence = lazyWithRetry(() => import("./pages/Intelligence"));
const AdminCompare = lazyWithRetry(() => import("./pages/admin/AdminCompare"));
const AdminAnalytics = lazyWithRetry(() => import("./pages/admin/AdminAnalytics"));
const AdminReports = lazyWithRetry(() => import("./pages/admin/AdminReports"));
const AdminInnovation = lazyWithRetry(() => import("./pages/admin/AdminInnovation"));
const AdminActionPlans = lazyWithRetry(() => import("./pages/admin/AdminActionPlans"));
const AdminActionPlanDetails = lazyWithRetry(() => import("./pages/admin/AdminActionPlanDetails"));
const AdminOrganizations = lazyWithRetry(() => import("./pages/admin/AdminOrganizations"));
const AdminSettings = lazyWithRetry(() => import("./pages/admin/AdminSettings"));
const OrgInternalDashboard = lazyWithRetry(() => import("./pages/admin/OrgInternalDashboard"));
const SourcesRtlTest = lazyWithRetry(() => import("./pages/admin/SourcesRtlTest"));
const InternalDashboard = lazyWithRetry(() => import("./pages/InternalDashboard"));
const MyAccountability = lazyWithRetry(() => import("./pages/MyAccountability"));
const MyPerformance = lazyWithRetry(() => import("./pages/MyPerformance"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const OrganizationProfile = lazyWithRetry(() => import("./pages/OrganizationProfile"));
const EmployeeOnboarding = lazyWithRetry(() => import("./pages/EmployeeOnboarding"));
const StaffDutiesUpload = lazyWithRetry(() => import("./pages/StaffDutiesUpload"));
const MyAssistant = lazyWithRetry(() => import("./pages/MyAssistant"));
const PerformanceEvaluation = lazyWithRetry(() => import("./pages/PerformanceEvaluation"));
const AssistantFab = lazyWithRetry(() => import("@/components/assistant/AssistantFab").then((m) => ({ default: m.AssistantFab })));
const Demo = lazyWithRetry(() => import("./pages/Demo"));
const DemoModeShell = lazyWithRetry(() => import("@/components/demo/DemoModeShell").then((m) => ({ default: m.DemoModeShell })));
const LetterPage = lazyWithRetry(() => import("./pages/LetterPage"));

const PROTECTED_ROOTS = new Set([
  "admin", "app", "employees", "roles", "tasks", "plans", "executive-plans",
  "operational-plans", "profile", "settings", "uploads", "intelligence",
  "internal-dashboard", "my-accountability", "my-performance", "employee-onboarding",
  "staff-duties-upload", "my-assistant", "performance", "organizations",
  "messages", "inbox", "platform-mail", "internal-inbox",
]);

function isPublicEntryPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (pathname === "/" || pathname === "/auth" || segments[0] === "j") return true;
  if (segments[0] === "demo" && segments.length === 1) return true;
  return segments.length === 1 && !PROTECTED_ROOTS.has(segments[0]);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache aggressively so revisiting a page is near-instant.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { isPreviewMode } = usePreviewMode();
  const { currentOrg, loading: orgLoading } = useOrganization();
  const location = useLocation();

  // Onboarding gate: any non-admin user must complete the intelligence
  // onboarding survey before accessing any protected page.
  const [onboardingState, setOnboardingState] = useState<
    "checking" | "ok" | "needs_onboarding"
  >("checking");

  // Skip the gate for the onboarding page itself, embedded iframes, or preview.
  const isEmbedded =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embedded") === "1";
  const isOnboardingPath = location.pathname.includes("/employee-onboarding");
  const routeSegments = location.pathname.split("/").filter(Boolean);
  const routeOrgSlug = routeSegments[0] && !PROTECTED_ROOTS.has(routeSegments[0]) ? routeSegments[0] : null;
  const [routeOrgAccess, setRouteOrgAccess] = useState<"checking" | "ok" | "mismatch">("checking");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id || isPreviewMode || isEmbedded || !routeOrgSlug) {
        if (!cancelled) setRouteOrgAccess("ok");
        return;
      }

      setRouteOrgAccess("checking");
      const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      if (cancelled) return;
      if (isSuper) {
        setRouteOrgAccess("ok");
        return;
      }

      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", routeOrgSlug)
        .maybeSingle();
      if (cancelled) return;
      if (!org?.id) {
        setRouteOrgAccess("ok");
        return;
      }

      const { data: membership } = await supabase
        .from("user_organizations")
        .select("organization_id, approval_status")
        .eq("user_id", user.id)
        .eq("organization_id", org.id)
        .maybeSingle();
      if (cancelled) return;

      if (membership && membership.approval_status === "approved") {
        setRouteOrgAccess("ok");
      } else {
        await signOut();
        if (!cancelled) {
          setRouteOrgAccess(
            membership?.approval_status === "pending" ? "mismatch" : "mismatch"
          );
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [user?.id, isPreviewMode, isEmbedded, routeOrgSlug, signOut]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user?.id || isPreviewMode || isEmbedded || isOnboardingPath) {
        if (!cancelled) setOnboardingState("ok");
        return;
      }
      if (orgLoading) return;

      // Bypass onboarding only when the privilege belongs to the active org.
      const flags = await getOrgPrivilegeFlags(user.id, currentOrg?.id);
      const [{ data: employee }, { data: isViewer }, membershipResult] =
        await Promise.all([
          currentOrg?.id
            ? supabase
                .from("employees")
                .select("role_level")
                .eq("user_id", user.id)
                .eq("organization_id", currentOrg.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase.rpc("is_viewer", { _user_id: user.id }),
          currentOrg?.id
            ? supabase
                .from("user_organizations")
                .select("id")
                .eq("user_id", user.id)
                .eq("organization_id", currentOrg.id)
                .eq("approval_status", "approved")
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

      if (cancelled) return;
      const managerInOrg =
        employee?.role_level === "manager" ||
        employee?.role_level === "admin";
      const viewerInOrg = isViewer === true && !!membershipResult.data;

      if (
        flags.isSuperAdmin ||
        flags.isOrgAdmin ||
        managerInOrg ||
        viewerInOrg
      ) {
        setOnboardingState("ok");
        return;
      }
      const { data: profile } = await supabase
        .from("employee_intelligence_profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setOnboardingState(profile?.onboarding_completed ? "ok" : "needs_onboarding");
    };
    run();
    return () => { cancelled = true; };
  }, [
    user?.id,
    isPreviewMode,
    isEmbedded,
    isOnboardingPath,
    location.pathname,
    currentOrg?.id,
    orgLoading,
  ]);

  // في وضع المعاينة، نسمح بالوصول مباشرة
  if (isPreviewMode) {
    return (
      <>
        <PreviewModeBanner />
        <div className="pt-12">{children}</div>
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (routeOrgAccess === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (routeOrgAccess === "mismatch") {
    return <Navigate to={routeOrgSlug ? `/${routeOrgSlug}` : "/"} replace />;
  }

  if (onboardingState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (onboardingState === "needs_onboarding") {
    // Preserve the org slug if present in the current path: /:slug/...
    const segments = location.pathname.split("/").filter(Boolean);
    const slug = segments[0] && !["admin", "auth", "employee-onboarding"].includes(segments[0])
      ? segments[0]
      : null;
    const target = slug ? `/${slug}/employee-onboarding` : "/employee-onboarding";
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isPreviewMode } = usePreviewMode();
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (loading) return;
      if (!user?.id || isPreviewMode) {
        if (!cancelled) setAccess("denied");
        return;
      }

      setAccess("checking");
      const { data, error } = await supabase.rpc("is_super_admin", {
        _user_id: user.id,
      });

      if (cancelled) return;
      setAccess(!error && data === true ? "allowed" : "denied");
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, isPreviewMode]);

  if (loading || access === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (access !== "allowed") {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isPreviewMode } = usePreviewMode();

  // في وضع المعاينة، نعرض صفحة المصادقة بشكل عادي
  if (isPreviewMode) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* Public marketing/landing + system-admin login */}
      <Route path="/" element={<PublicLanding />} />

      {/* Per-organization auth via short link (legacy /j/:slug + new short /:slug) */}
      <Route path="/j/:slug" element={<OrgAuth />} />

      {/* Public demo organization — auto sign-in as read-only viewer */}
      <Route path="/demo" element={<Demo />} />

      {/* Public marketing pages */}
      <Route path="/features" element={<PlatformFeatures />} />
      <Route path="/subscribe" element={<PlatformSubscribe />} />
      <Route path="/about" element={<PlatformAbout />} />
      <Route path="/about/creator" element={<AboutCreator />} />
      <Route path="/about/quick" element={<PlatformQuick />} />
      <Route path="/about/vision-mission" element={<PlatformVisionMission />} />
      <Route path="/about/goals" element={<PlatformGoals />} />
      <Route path="/support" element={<PlatformSupport />} />
      <Route path="/inbox" element={<SuperAdminRoute><SupportInbox /></SuperAdminRoute>} />
      <Route path="/platform-mail" element={<SuperAdminRoute><PlatformMail /></SuperAdminRoute>} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/internal-inbox" element={<SuperAdminRoute><InternalInbox /></SuperAdminRoute>} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />
      <Route path="/letter-invitation" element={<LetterPage />} />

      {/* Legacy direct auth (kept for compatibility) */}
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        }
      />

      {/* Super-admin hub: لوحة تحكم متكاملة بـ sidebar */}
      <Route path="/admin" element={<SuperAdminRoute><AdminLayout><AdminOverview /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/organizations" element={<SuperAdminRoute><AdminLayout><AdminOrganizations /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/organizations/:orgId/profile" element={<SuperAdminRoute><AdminLayout><OrganizationProfile /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/organizations/:orgId/dashboard" element={<SuperAdminRoute><AdminLayout><OrgInternalDashboard /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/test/sources-rtl" element={<SuperAdminRoute><AdminLayout><SourcesRtlTest /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/compare" element={<SuperAdminRoute><AdminLayout><AdminCompare /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/analytics" element={<SuperAdminRoute><AdminLayout><AdminAnalytics /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/action-plans" element={<SuperAdminRoute><AdminLayout><AdminActionPlans /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/action-plans/:planId" element={<SuperAdminRoute><AdminLayout><AdminActionPlanDetails /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/reports" element={<SuperAdminRoute><AdminLayout><AdminReports /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/innovation" element={<SuperAdminRoute><AdminLayout><AdminInnovation /></AdminLayout></SuperAdminRoute>} />
      <Route path="/admin/settings" element={<SuperAdminRoute><AdminLayout><AdminSettings /></AdminLayout></SuperAdminRoute>} />
      {/* Org management (edit form etc) — kept inside an org's dashboard */}
      <Route
        path="/organizations"
        element={
          <ProtectedRoute>
            <Organizations />
          </ProtectedRoute>
        }
      />

      {/* Application (per-org workspace) */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        }
      />
      <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
      <Route path="/employees/add" element={<ProtectedRoute><AddEmployee /></ProtectedRoute>} />
      <Route path="/employees/:employeeId/edit" element={<ProtectedRoute><EditEmployee /></ProtectedRoute>} />
      <Route path="/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
      <Route path="/tasks/add" element={<ProtectedRoute><AddTask /></ProtectedRoute>} />
      <Route path="/tasks/:taskId" element={<ProtectedRoute><TaskDetails /></ProtectedRoute>} />
      <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
      <Route path="/executive-plans" element={<ProtectedRoute><ExecutivePlans /></ProtectedRoute>} />
      <Route path="/executive-plans/add" element={<ProtectedRoute><AddExecutivePlan /></ProtectedRoute>} />
      <Route path="/executive-plans/upload" element={<ProtectedRoute><UploadExecutiveExcel /></ProtectedRoute>} />
      <Route path="/executive-plans/ai-generate" element={<ProtectedRoute><AIGenerateExecutivePlan /></ProtectedRoute>} />
      <Route path="/operational-plans" element={<ProtectedRoute><OperationalPlans /></ProtectedRoute>} />
      <Route path="/operational-plans/add" element={<ProtectedRoute><AddOperationalPlan /></ProtectedRoute>} />
      <Route path="/operational-plans/upload" element={<ProtectedRoute><UploadExcelPlan /></ProtectedRoute>} />
      <Route path="/operational-plans/ai-generate" element={<ProtectedRoute><AIGeneratePlan /></ProtectedRoute>} />
      <Route path="/operational-plans/:id" element={<ProtectedRoute><OperationalPlanDetails /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsAccessGuard><Settings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/branding" element={<ProtectedRoute><SettingsAccessGuard><BrandingSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/roles-permissions" element={<ProtectedRoute><SettingsAccessGuard><RolesPermissionsSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/navigation" element={<ProtectedRoute><SettingsAccessGuard><NavigationSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/intelligence-profile" element={<ProtectedRoute><SettingsAccessGuard><IntelligenceProfileSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/welcome" element={<ProtectedRoute><SettingsAccessGuard><WelcomeSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/exports" element={<ProtectedRoute><SettingsAccessGuard><ExportsSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/backup" element={<ProtectedRoute><SettingsAccessGuard><BackupSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/notifications" element={<ProtectedRoute><SettingsAccessGuard><ComingSoonSettings title="الإشعارات" subtitle="تخصيص قواعد التنبيهات" /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/security" element={<ProtectedRoute><SettingsAccessGuard><ComingSoonSettings title="الأمان والخصوصية" /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/members" element={<ProtectedRoute><SettingsAccessGuard><MembersSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/member-roles" element={<ProtectedRoute><SettingsAccessGuard><MemberRolesSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/uploads" element={<ProtectedRoute><Uploads /></ProtectedRoute>} />
      <Route path="/intelligence" element={<ProtectedRoute><Intelligence /></ProtectedRoute>} />
      <Route path="/internal-dashboard" element={<ProtectedRoute><InternalDashboard /></ProtectedRoute>} />
      <Route path="/my-accountability" element={<ProtectedRoute><MyAccountability /></ProtectedRoute>} />
      <Route path="/my-performance" element={<ProtectedRoute><MyPerformance /></ProtectedRoute>} />
      <Route path="/employee-onboarding" element={<ProtectedRoute><EmployeeOnboarding /></ProtectedRoute>} />
      <Route path="/staff-duties-upload" element={<ProtectedRoute><StaffDutiesUpload /></ProtectedRoute>} />
      <Route path="/my-assistant" element={<ProtectedRoute><MyAssistant /></ProtectedRoute>} />
      <Route path="/performance" element={<ProtectedRoute><PerformanceEvaluation /></ProtectedRoute>} />
      <Route path="/:slug/performance" element={<ProtectedRoute><PerformanceEvaluation /></ProtectedRoute>} />

      {/* Org-scoped aliases: charity-crm.org/atff/app, /atff/tasks ... */}
      <Route path="/:slug/app" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/:slug/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
      <Route path="/:slug/employees/add" element={<ProtectedRoute><AddEmployee /></ProtectedRoute>} />
      <Route path="/:slug/employees/:employeeId/edit" element={<ProtectedRoute><EditEmployee /></ProtectedRoute>} />
      <Route path="/:slug/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
      <Route path="/:slug/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
      <Route path="/:slug/tasks/add" element={<ProtectedRoute><AddTask /></ProtectedRoute>} />
      <Route path="/:slug/tasks/:taskId" element={<ProtectedRoute><TaskDetails /></ProtectedRoute>} />
      <Route path="/:slug/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
      <Route path="/:slug/executive-plans" element={<ProtectedRoute><ExecutivePlans /></ProtectedRoute>} />
      <Route path="/:slug/executive-plans/add" element={<ProtectedRoute><AddExecutivePlan /></ProtectedRoute>} />
      <Route path="/:slug/executive-plans/upload" element={<ProtectedRoute><UploadExecutiveExcel /></ProtectedRoute>} />
      <Route path="/:slug/executive-plans/ai-generate" element={<ProtectedRoute><AIGenerateExecutivePlan /></ProtectedRoute>} />
      <Route path="/:slug/operational-plans" element={<ProtectedRoute><OperationalPlans /></ProtectedRoute>} />
      <Route path="/:slug/operational-plans/add" element={<ProtectedRoute><AddOperationalPlan /></ProtectedRoute>} />
      <Route path="/:slug/operational-plans/upload" element={<ProtectedRoute><UploadExcelPlan /></ProtectedRoute>} />
      <Route path="/:slug/operational-plans/ai-generate" element={<ProtectedRoute><AIGeneratePlan /></ProtectedRoute>} />
      <Route path="/:slug/operational-plans/:id" element={<ProtectedRoute><OperationalPlanDetails /></ProtectedRoute>} />
      <Route path="/:slug/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/:slug/settings" element={<ProtectedRoute><SettingsAccessGuard><Settings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/branding" element={<ProtectedRoute><SettingsAccessGuard><BrandingSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/roles-permissions" element={<ProtectedRoute><SettingsAccessGuard><RolesPermissionsSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/navigation" element={<ProtectedRoute><SettingsAccessGuard><NavigationSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/intelligence-profile" element={<ProtectedRoute><SettingsAccessGuard><IntelligenceProfileSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/welcome" element={<ProtectedRoute><SettingsAccessGuard><WelcomeSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/exports" element={<ProtectedRoute><SettingsAccessGuard><ExportsSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/backup" element={<ProtectedRoute><SettingsAccessGuard><BackupSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/notifications" element={<ProtectedRoute><SettingsAccessGuard><ComingSoonSettings title="الإشعارات" /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/security" element={<ProtectedRoute><SettingsAccessGuard><ComingSoonSettings title="الأمان والخصوصية" /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/members" element={<ProtectedRoute><SettingsAccessGuard><MembersSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/member-roles" element={<ProtectedRoute><SettingsAccessGuard><MemberRolesSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/uploads" element={<ProtectedRoute><Uploads /></ProtectedRoute>} />
      <Route path="/:slug/intelligence" element={<ProtectedRoute><Intelligence /></ProtectedRoute>} />
      <Route path="/:slug/internal-dashboard" element={<ProtectedRoute><InternalDashboard /></ProtectedRoute>} />
      <Route path="/:slug/my-accountability" element={<ProtectedRoute><MyAccountability /></ProtectedRoute>} />
      <Route path="/:slug/my-performance" element={<ProtectedRoute><MyPerformance /></ProtectedRoute>} />
      <Route path="/:slug/employee-onboarding" element={<ProtectedRoute><EmployeeOnboarding /></ProtectedRoute>} />
      <Route path="/:slug/staff-duties-upload" element={<ProtectedRoute><StaffDutiesUpload /></ProtectedRoute>} />
      <Route path="/:slug/my-assistant" element={<ProtectedRoute><MyAssistant /></ProtectedRoute>} />
      <Route path="/:slug/messages" element={<Messages />} />

      {/* Short org slug: charity-crm.org/atff → نفس صفحة /j/atff */}
      <Route path="/:slug" element={<OrgAuth />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}

function AppContent() {
  const location = useLocation();
  const isPublicEntry = isPublicEntryPath(location.pathname);

  if (isPublicEntry && location.pathname !== "/demo") {
    return (
      <PreviewModeProvider>
        <ConfirmDialogProvider>
          <Suspense fallback={null}>
            <Sonner />
            <AppRoutes />
          </Suspense>
        </ConfirmDialogProvider>
      </PreviewModeProvider>
    );
  }

  return (
    <PreviewModeProvider>
      <ConfirmDialogProvider>
        <Suspense fallback={<RouteFallback />}>
          <ProtectedAppProviders>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <DemoModeShell>
                  <AppRoutes />
                  <AssistantFab />
                </DemoModeShell>
              </TooltipProvider>
          </ProtectedAppProviders>
        </Suspense>
      </ConfirmDialogProvider>
    </PreviewModeProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
