import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { FirebaseProvider } from "@/contexts/FirebaseContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FirebaseConnectionStatus } from "@/components/FirebaseConnectionStatus";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import GuestEntry from "./pages/GuestEntry";
import Dashboard from "./pages/Dashboard";
import RoverConsole from "./pages/RoverConsole";
import SolutionPage from "./pages/SolutionPage";
import AlertsPage from "./pages/AlertsPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import CameraTest from "./pages/CameraTest";
import FaceRecognitionPage from "./pages/FaceRecognitionPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FirebaseProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <FirebaseConnectionStatus />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/signin" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/guest" element={<GuestEntry />} />

              {/* Protected Application Routes (Accessible by Authenticated Users or Guest Mode) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rover"
                element={
                  <ProtectedRoute>
                    <RoverConsole />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/solution"
                element={
                  <ProtectedRoute>
                    <SolutionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/alerts"
                element={
                  <ProtectedRoute>
                    <AlertsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/camera-test"
                element={
                  <ProtectedRoute>
                    <CameraTest />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/face-recognition"
                element={
                  <ProtectedRoute>
                    <FaceRecognitionPage />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all Not Found Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </FirebaseProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
