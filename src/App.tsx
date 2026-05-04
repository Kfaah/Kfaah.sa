import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PreviewModeProvider, usePreviewMode } from "@/contexts/PreviewModeContext";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
// Eagerly-loaded shells (small + likely needed immediately)
import PublicLanding from "./pages/PublicLanding";

// Lazy-loaded route pages — split into separate chunks to make navigation snappy
const Toaster = lazy(() => import("@/components/ui/toaster").then((m) => ({ default: m.Toaster })));
const TooltipProvider = lazy(() => import("@/components/ui/tooltip").then((m) => ({ default: m.TooltipProvider })));
const PreviewModeBanner = lazy(() => import("@/components/preview/PreviewModeBanner").then((m) => ({ default: m.PreviewModeBanner })));
const OrgAuth = lazy(() => import("./pages/OrgAuth"));
const ProtectedAppProviders = lazy(() => import("@/components/ProtectedAppProviders"));
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const Index = lazy(() => import("./pages/Index"));
const Employees = lazy(() => import("./pages/Employees"));
const AddEmployee = lazy(() => import("./pages/AddEmployee"));
const EditEmployee = lazy(() => import("./pages/EditEmployee"));
const Roles = lazy(() => import("./pages/Roles"));
const Tasks = lazy(() => import("./pages/Tasks"));
const AddTask = lazy(() => import("./pages/AddTask"));
const TaskDetails = lazy(() => import("./pages/TaskDetails"));
const Plans = lazy(() => import("./pages/Plans"));
const ExecutivePlans = lazy(() => import("./pages/ExecutivePlans"));
const Profile = lazy(() => import("./pages/Profile"));
const OperationalPlans = lazy(() => import("./pages/OperationalPlans"));
const AddOperationalPlan = lazy(() => import("./pages/AddOperationalPlan"));
const OperationalPlanDetails = lazy(() => import("./pages/OperationalPlanDetails"));
const UploadExcelPlan = lazy(() => import("./pages/UploadExcelPlan"));
const AIGeneratePlan = lazy(() => import("./pages/AIGeneratePlan"));
const UploadExecutiveExcel = lazy(() => import("./pages/UploadExecutiveExcel"));
const AIGenerateExecutivePlan = lazy(() => import("./pages/AIGenerateExecutivePlan"));
const AddExecutivePlan = lazy(() => import("./pages/AddExecutivePlan"));
const Auth = lazy(() => import("./pages/Auth"));
const PlatformFeatures = lazy(() => import("./pages/PlatformFeatures"));
const PlatformSubscribe = lazy(() => import("./pages/PlatformSubscribe"));
const PlatformAbout = lazy(() => import("./pages/PlatformAbout"));
const AboutCreator = lazy(() => import("./pages/AboutCreator"));
const PlatformQuick = lazy(() => import("./pages/PlatformQuick"));
const Settings = lazy(() => import("./pages/Settings"));
const BrandingSettings = lazy(() => import("./pages/settings/BrandingSettings"));
const RolesPermissionsSettings = lazy(() => import("./pages/settings/RolesPermissionsSettings"));
const NavigationSettings = lazy(() => import("./pages/settings/NavigationSettings"));
const IntelligenceProfileSettings = lazy(() => import("./pages/settings/IntelligenceProfileSettings"));
const WelcomeSettings = lazy(() => import("./pages/settings/WelcomeSettings"));
const MembersSettings = lazy(() => import("./pages/settings/MembersSettings"));
const ExportsSettings = lazy(() => import("./pages/settings/ExportsSettings"));
const ComingSoonSettings = lazy(() => import("./pages/settings/ComingSoonSettings"));
import SettingsAccessGuard from "./components/settings/SettingsAccessGuard";
const Uploads = lazy(() => import("./pages/Uploads"));
const Organizations = lazy(() => import("./pages/Organizations"));
const Intelligence = lazy(() => import("./pages/Intelligence"));
const AdminCompare = lazy(() => import("./pages/admin/AdminCompare"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminInnovation = lazy(() => import("./pages/admin/AdminInnovation"));
const AdminActionPlans = lazy(() => import("./pages/admin/AdminActionPlans"));
const AdminActionPlanDetails = lazy(() => import("./pages/admin/AdminActionPlanDetails"));
const AdminOrganizations = lazy(() => import("./pages/admin/AdminOrganizations"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const OrgInternalDashboard = lazy(() => import("./pages/admin/OrgInternalDashboard"));
const SourcesRtlTest = lazy(() => import("./pages/admin/SourcesRtlTest"));
const InternalDashboard = lazy(() => import("./pages/InternalDashboard"));
const MyAccountability = lazy(() => import("./pages/MyAccountability"));
const MyPerformance = lazy(() => import("./pages/MyPerformance"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OrganizationProfile = lazy(() => import("./pages/OrganizationProfile"));
const EmployeeOnboarding = lazy(() => import("./pages/EmployeeOnboarding"));
const StaffDutiesUpload = lazy(() => import("./pages/StaffDutiesUpload"));
const MyAssistant = lazy(() => import("./pages/MyAssistant"));
const PerformanceEvaluation = lazy(() => import("./pages/PerformanceEvaluation"));
const AssistantFab = lazy(() => import("@/components/assistant/AssistantFab").then((m) => ({ default: m.AssistantFab })));
const Demo = lazy(() => import("./pages/Demo"));
const DemoModeShell = lazy(() => import("@/components/demo/DemoModeShell").then((m) => ({ default: m.DemoModeShell })));

const PROTECTED_ROOTS = new Set([
  "admin", "app", "employees", "roles", "tasks", "plans", "executive-plans",
  "operational-plans", "profile", "settings", "uploads", "intelligence",
  "internal-dashboard", "my-accountability", "my-performance", "employee-onboarding",
  "staff-duties-upload", "my-assistant", "performance", "organizations",
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
      // Admins / super admins / managers / viewers bypass the onboarding requirement.
      const [{ data: isAdmin }, { data: isSuper }, { data: isMgr }, { data: isViewer }] =
        await Promise.all([
          supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
          supabase.rpc("is_super_admin", { _user_id: user.id }),
          supabase.rpc("is_manager", { _user_id: user.id }),
          supabase.rpc("is_viewer", { _user_id: user.id }),
        ]);
      if (cancelled) return;
      if (isAdmin || isSuper || isMgr || isViewer) {
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
  }, [user?.id, isPreviewMode, isEmbedded, isOnboardingPath, location.pathname]);

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
      <Route path="/admin" element={<ProtectedRoute><AdminLayout><AdminOverview /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/organizations" element={<ProtectedRoute><AdminLayout><AdminOrganizations /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/organizations/:orgId/profile" element={<ProtectedRoute><AdminLayout><OrganizationProfile /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/organizations/:orgId/dashboard" element={<ProtectedRoute><AdminLayout><OrgInternalDashboard /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/test/sources-rtl" element={<ProtectedRoute><AdminLayout><SourcesRtlTest /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/compare" element={<ProtectedRoute><AdminLayout><AdminCompare /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute><AdminLayout><AdminAnalytics /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/action-plans" element={<ProtectedRoute><AdminLayout><AdminActionPlans /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/action-plans/:planId" element={<ProtectedRoute><AdminLayout><AdminActionPlanDetails /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute><AdminLayout><AdminReports /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/innovation" element={<ProtectedRoute><AdminLayout><AdminInnovation /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><AdminLayout><AdminSettings /></AdminLayout></ProtectedRoute>} />
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
      <Route path="/settings/notifications" element={<ProtectedRoute><SettingsAccessGuard><ComingSoonSettings title="الإشعارات" subtitle="تخصيص قواعد التنبيهات" /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/security" element={<ProtectedRoute><SettingsAccessGuard><ComingSoonSettings title="الأمان والخصوصية" /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/settings/members" element={<ProtectedRoute><SettingsAccessGuard><MembersSettings /></SettingsAccessGuard></ProtectedRoute>} />
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
      <Route path="/:slug/settings/notifications" element={<ProtectedRoute><SettingsAccessGuard><ComingSoonSettings title="الإشعارات" /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/security" element={<ProtectedRoute><SettingsAccessGuard><ComingSoonSettings title="الأمان والخصوصية" /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/settings/members" element={<ProtectedRoute><SettingsAccessGuard><MembersSettings /></SettingsAccessGuard></ProtectedRoute>} />
      <Route path="/:slug/uploads" element={<ProtectedRoute><Uploads /></ProtectedRoute>} />
      <Route path="/:slug/intelligence" element={<ProtectedRoute><Intelligence /></ProtectedRoute>} />
      <Route path="/:slug/internal-dashboard" element={<ProtectedRoute><InternalDashboard /></ProtectedRoute>} />
      <Route path="/:slug/my-accountability" element={<ProtectedRoute><MyAccountability /></ProtectedRoute>} />
      <Route path="/:slug/my-performance" element={<ProtectedRoute><MyPerformance /></ProtectedRoute>} />
      <Route path="/:slug/employee-onboarding" element={<ProtectedRoute><EmployeeOnboarding /></ProtectedRoute>} />
      <Route path="/:slug/staff-duties-upload" element={<ProtectedRoute><StaffDutiesUpload /></ProtectedRoute>} />
      <Route path="/:slug/my-assistant" element={<ProtectedRoute><MyAssistant /></ProtectedRoute>} />

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
