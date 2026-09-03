import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuthOnly?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAuthOnly = false }) => {
  const { currentUser, isGuest, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullScreen message="Checking authorization..." />;
  }

  // If this route strictly requires a real authenticated account and user is guest
  if (requireAuthOnly && !currentUser) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // Standard protection: user must be authenticated or in guest mode
  if (!currentUser && !isGuest) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
