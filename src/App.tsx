import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { UserProvider } from "@/contexts/UserContext";
import Index from "./pages/Index";
import Employees from "./pages/Employees";
import Roles from "./pages/Roles";
import Tasks from "./pages/Tasks";
import Plans from "./pages/Plans";
import ExecutivePlans from "./pages/ExecutivePlans";
import Profile from "./pages/Profile";
import OperationalPlans from "./pages/OperationalPlans";
import OperationalPlanDetails from "./pages/OperationalPlanDetails";
import Attendance from "./pages/Attendance";
import AttendanceManagement from "./pages/AttendanceManagement";
import HR from "./pages/HR";
import HRRequests from "./pages/HRRequests";
import HRTemplates from "./pages/HRTemplates";
import PendingApprovals from "./pages/PendingApprovals";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Index />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employees"
        element={
          <ProtectedRoute>
            <Employees />
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles"
        element={
          <ProtectedRoute>
            <Roles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <Tasks />
          </ProtectedRoute>
        }
      />
      <Route
        path="/plans"
        element={
          <ProtectedRoute>
            <Plans />
          </ProtectedRoute>
        }
      />
      <Route
        path="/executive-plans"
        element={
          <ProtectedRoute>
            <ExecutivePlans />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operational-plans"
        element={
          <ProtectedRoute>
            <OperationalPlans />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operational-plans/:id"
        element={
          <ProtectedRoute>
            <OperationalPlanDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <Attendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/attendance-management"
        element={
          <ProtectedRoute>
            <AttendanceManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr"
        element={
          <ProtectedRoute>
            <HR />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr-requests"
        element={
          <ProtectedRoute>
            <HRRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr-templates"
        element={
          <ProtectedRoute>
            <HRTemplates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pending-approvals"
        element={
          <ProtectedRoute>
            <PendingApprovals />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <UserProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </UserProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
