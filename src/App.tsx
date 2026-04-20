import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate, BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { UserProvider } from "@/contexts/UserContext";
import { PreviewModeProvider, usePreviewMode } from "@/contexts/PreviewModeContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
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
import NotFound from "./pages/NotFound";

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

      {/* Super-admin hub: independent page, lists all orgs as cards */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminHub />
          </ProtectedRoute>
        }
      />
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
        <UserProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppRoutes />
          </TooltipProvider>
        </UserProvider>
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
