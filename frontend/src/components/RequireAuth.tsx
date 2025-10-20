import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface RequireAuthProps {
  children: React.ReactNode;
  allowGuest?: boolean;
}

/**
 * Route guard component that protects routes based on authentication status
 *
 * @param allowGuest - If true, allows guest mode users to access the route (default: true)
 * @param children - The protected content to render if authorized
 *
 * Behavior:
 * - Shows loading state while auth is being checked (prevents flash of login page)
 * - Redirects to /login if user is not authenticated (no currentPlayer and not guest)
 * - Redirects to / if guest mode user tries to access a protected route (allowGuest=false)
 * - Preserves the intended destination in location state for post-login redirect
 */
export function RequireAuth({ children, allowGuest = true }: RequireAuthProps) {
  const { currentPlayer, loading, isGuest } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth (prevents flash of login page)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // Not authenticated at all - redirect to login
  if (!currentPlayer && !isGuest) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Guest mode user trying to access protected route - redirect home
  if (isGuest && !allowGuest) {
    return <Navigate to="/" replace />;
  }

  // Authorized - render protected content
  return <>{children}</>;
}
