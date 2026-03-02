import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { useOnboardingCheck } from "@/hooks/useOnboardingCheck";
import RoleSelect from "./pages/RoleSelect";
import Auth from "./pages/Auth";
import MerchantAuth from "./pages/MerchantAuth";
import MerchantDashboard from "./pages/merchant/MerchantDashboard";
import MerchantHome from "./pages/merchant/MerchantHome";
import MerchantProducts from "./pages/merchant/MerchantProducts";
import MerchantInsights from "./pages/merchant/MerchantInsights";
import MerchantPlan from "./pages/merchant/MerchantPlan";
import MerchantSettings from "./pages/merchant/MerchantSettings";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Match from "./pages/Match";
import AskLocal from "./pages/AskLocal";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Planner from "./pages/Planner";
import Subscription from "./pages/Subscription";
import MapView from "./pages/MapView";
import StoreView from "./pages/StoreView";
import CommonPhrases from "./pages/CommonPhrases";
import SmartItinerary from "./pages/SmartItinerary";
import Feedback from "./pages/Feedback";
import ToiletFinder from "./pages/ToiletFinder";
import Circles from "./pages/Circles";
import CircleDetail from "./pages/CircleDetail";
import MeetupDetail from "./pages/MeetupDetail";
import Experiences from "./pages/Experiences";
import ExperienceDetail from "./pages/ExperienceDetail";
import CreateExperience from "./pages/CreateExperience";
import ExperienceRequests from "./pages/ExperienceRequests";
import NotFound from "./pages/NotFound";
import UserProfile from "./pages/UserProfile";
import MerchantSetupHandler from "./components/MerchantSetupHandler";
import { useKeepAlive } from "@/hooks/useKeepAlive";

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
  useKeepAlive();
  return (
    <Routes>
      <Route path="/" element={<PublicRoute><RoleSelect /></PublicRoute>} />
      <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
      <Route path="/merchant-auth" element={<PublicRoute><MerchantAuth /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/onboarding" element={<ProtectedRoute skipOnboardingCheck><Onboarding /></ProtectedRoute>} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/match" element={<ProtectedRoute><Match /></ProtectedRoute>} />
      <Route path="/ask-local" element={<ProtectedRoute><AskLocal /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
      <Route path="/planner" element={<ProtectedRoute><Planner /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
      <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
      <Route path="/store/:storeId" element={<ProtectedRoute><StoreView /></ProtectedRoute>} />
      <Route path="/common-phrases" element={<ProtectedRoute><CommonPhrases /></ProtectedRoute>} />
      <Route path="/smart-itinerary" element={<ProtectedRoute><SmartItinerary /></ProtectedRoute>} />
      <Route path="/feedback" element={<ProtectedRoute><Feedback /></ProtectedRoute>} />
      <Route path="/toilet-finder" element={<ProtectedRoute><ToiletFinder /></ProtectedRoute>} />
      <Route path="/circles" element={<ProtectedRoute><Circles /></ProtectedRoute>} />
      <Route path="/circles/:circleId" element={<ProtectedRoute><CircleDetail /></ProtectedRoute>} />
      <Route path="/circles/:circleId/meetup/:meetupId" element={<ProtectedRoute><MeetupDetail /></ProtectedRoute>} />
      <Route path="/experiences" element={<ProtectedRoute><Experiences /></ProtectedRoute>} />
      <Route path="/experiences/create" element={<ProtectedRoute><CreateExperience /></ProtectedRoute>} />
      <Route path="/experiences/my-requests" element={<ProtectedRoute><ExperienceRequests /></ProtectedRoute>} />
      <Route path="/experiences/:experienceId" element={<ProtectedRoute><ExperienceDetail /></ProtectedRoute>} />
      {/* Merchant Dashboard Routes */}
      <Route path="/merchant-dashboard" element={<ProtectedRoute skipOnboardingCheck><MerchantDashboard /></ProtectedRoute>}>
        <Route index element={<MerchantHome />} />
        <Route path="products" element={<MerchantProducts />} />
        <Route path="insights" element={<MerchantInsights />} />
        <Route path="plan" element={<MerchantPlan />} />
        <Route path="settings" element={<MerchantSettings />} />
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
            <LanguageProvider>
              <MerchantSetupHandler>
                <AppRoutes />
              </MerchantSetupHandler>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
