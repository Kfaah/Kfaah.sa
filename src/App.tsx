import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { UserProvider } from "@/contexts/UserContext";
import { PreviewModeProvider, usePreviewMode } from "@/contexts/PreviewModeContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { OrgBrandingProvider } from "@/contexts/OrgBrandingContext";
import { PreviewModeBanner } from "@/components/preview/PreviewModeBanner";
import Index from "./pages/Index";
import Employees from "./pages/Employees";
import AddEmployee from "./pages/AddEmployee";
import EditEmployee from "./pages/EditEmployee";
import Roles from "./pages/Roles";
import Tasks from "./pages/Tasks";
import AddTask from "./pages/AddTask";
import TaskDetails from "./pages/TaskDetails";
import Plans from "./pages/Plans";
import ExecutivePlans from "./pages/ExecutivePlans";
import Profile from "./pages/Profile";
import OperationalPlans from "./pages/OperationalPlans";
import AddOperationalPlan from "./pages/AddOperationalPlan";
import OperationalPlanDetails from "./pages/OperationalPlanDetails";
import Auth from "./pages/Auth";
import PublicLanding from "./pages/PublicLanding";
import OrgAuth from "./pages/OrgAuth";
import Settings from "./pages/Settings";
import Uploads from "./pages/Uploads";
import Organizations from "./pages/Organizations";
import AdminHub from "./pages/AdminHub";
import Intelligence from "./pages/Intelligence";
import { AdminLayout } from "@/components/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminCompare from "./pages/admin/AdminCompare";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminReports from "./pages/admin/AdminReports";
import AdminInnovation from "./pages/admin/AdminInnovation";
import AdminActionPlans from "./pages/admin/AdminActionPlans";
import AdminActionPlanDetails from "./pages/admin/AdminActionPlanDetails";
import AdminOrganizations from "./pages/admin/AdminOrganizations";
import AdminSettings from "./pages/admin/AdminSettings";
import OrgInternalDashboard from "./pages/admin/OrgInternalDashboard";
import SourcesRtlTest from "./pages/admin/SourcesRtlTest";
import InternalDashboard from "./pages/InternalDashboard";
import MyAccountability from "./pages/MyAccountability";
import MyPerformance from "./pages/MyPerformance";
import NotFound from "./pages/NotFound";
import OrganizationProfile from "./pages/OrganizationProfile";
import EmployeeOnboarding from "./pages/EmployeeOnboarding";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isPreviewMode } = usePreviewMode();

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
    <Routes>
      {/* Public marketing/landing + system-admin login */}
      <Route path="/" element={<PublicLanding />} />

      {/* Per-organization auth via short link (legacy /j/:slug + new short /:slug) */}
      <Route path="/j/:slug" element={<OrgAuth />} />

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
      <Route path="/operational-plans" element={<ProtectedRoute><OperationalPlans /></ProtectedRoute>} />
      <Route path="/operational-plans/add" element={<ProtectedRoute><AddOperationalPlan /></ProtectedRoute>} />
      <Route path="/operational-plans/:id" element={<ProtectedRoute><OperationalPlanDetails /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/uploads" element={<ProtectedRoute><Uploads /></ProtectedRoute>} />
      <Route path="/intelligence" element={<ProtectedRoute><Intelligence /></ProtectedRoute>} />
      <Route path="/internal-dashboard" element={<ProtectedRoute><InternalDashboard /></ProtectedRoute>} />
      <Route path="/my-accountability" element={<ProtectedRoute><MyAccountability /></ProtectedRoute>} />
      <Route path="/my-performance" element={<ProtectedRoute><MyPerformance /></ProtectedRoute>} />
      <Route path="/employee-onboarding" element={<ProtectedRoute><EmployeeOnboarding /></ProtectedRoute>} />

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
      <Route path="/:slug/operational-plans" element={<ProtectedRoute><OperationalPlans /></ProtectedRoute>} />
      <Route path="/:slug/operational-plans/add" element={<ProtectedRoute><AddOperationalPlan /></ProtectedRoute>} />
      <Route path="/:slug/operational-plans/:id" element={<ProtectedRoute><OperationalPlanDetails /></ProtectedRoute>} />
      <Route path="/:slug/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/:slug/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/:slug/uploads" element={<ProtectedRoute><Uploads /></ProtectedRoute>} />
      <Route path="/:slug/intelligence" element={<ProtectedRoute><Intelligence /></ProtectedRoute>} />
      <Route path="/:slug/internal-dashboard" element={<ProtectedRoute><InternalDashboard /></ProtectedRoute>} />
      <Route path="/:slug/my-accountability" element={<ProtectedRoute><MyAccountability /></ProtectedRoute>} />
      <Route path="/:slug/my-performance" element={<ProtectedRoute><MyPerformance /></ProtectedRoute>} />
      <Route path="/:slug/employee-onboarding" element={<ProtectedRoute><EmployeeOnboarding /></ProtectedRoute>} />

      {/* Short org slug: charity-crm.org/atff → نفس صفحة /j/atff */}
      <Route path="/:slug" element={<OrgAuth />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AppContent() {
  return (
    <PreviewModeProvider>
      <OrganizationProvider>
        <OrgBrandingProvider>
          <UserProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AppRoutes />
            </TooltipProvider>
          </UserProvider>
        </OrgBrandingProvider>
      </OrganizationProvider>
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
