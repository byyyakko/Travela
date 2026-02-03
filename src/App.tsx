import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useOnboardingCheck } from "@/hooks/useOnboardingCheck";
import RoleSelect from "./pages/RoleSelect";
import Auth from "./pages/Auth";
import MerchantAuth from "./pages/MerchantAuth";
import MerchantDashboard from "./pages/merchant/MerchantDashboard";
import MerchantHome from "./pages/merchant/MerchantHome";
import MerchantProducts from "./pages/merchant/MerchantProducts";
import MerchantInsights from "./pages/merchant/MerchantInsights";
import MerchantPlan from "./pages/merchant/MerchantPlan";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Match from "./pages/Match";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Planner from "./pages/Planner";
import NotFound from "./pages/NotFound";
import MerchantSetupHandler from "./components/MerchantSetupHandler";

const queryClient = new QueryClient();

// Protected route wrapper with onboarding check
const ProtectedRoute = ({ children, skipOnboardingCheck = false }: { children: React.ReactNode; skipOnboardingCheck?: boolean }) => {
  const { user, loading } = useAuth();
  const { needsOnboarding, isLoading: onboardingLoading } = useOnboardingCheck();

  if (loading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Redirect to onboarding if needed (unless we're skipping the check)
  if (needsOnboarding && !skipOnboardingCheck) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

// Public route wrapper (redirect if authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><RoleSelect /></PublicRoute>} />
      <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
      <Route path="/merchant-auth" element={<PublicRoute><MerchantAuth /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<ProtectedRoute skipOnboardingCheck><Onboarding /></ProtectedRoute>} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/match" element={<ProtectedRoute><Match /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/planner" element={<ProtectedRoute><Planner /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      {/* Merchant Dashboard Routes */}
      <Route path="/merchant-dashboard" element={<ProtectedRoute skipOnboardingCheck><MerchantDashboard /></ProtectedRoute>}>
        <Route index element={<MerchantHome />} />
        <Route path="products" element={<MerchantProducts />} />
        <Route path="insights" element={<MerchantInsights />} />
        <Route path="plan" element={<MerchantPlan />} />
      </Route>
      {/* Redirect old theme route to home */}
      <Route path="/theme" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <MerchantSetupHandler>
              <AppRoutes />
            </MerchantSetupHandler>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
