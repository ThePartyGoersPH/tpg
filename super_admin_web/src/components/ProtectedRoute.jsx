import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { ADMIN_PORTAL_ROLES, roleAllowed, absoluteHomeForRole } from '../utils/portalAccess';
import FullScreenLoader from './common/FullScreenLoader';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, user, status } = useAuthStore();

  // Portal gate: sessions from other portals never render admin pages and
  // never fire their API calls. Redirects to the role's own home with a
  // toast instead of stranding the user on an access-denied page.
  const portalOk = !user || roleAllowed(ADMIN_PORTAL_ROLES, user?.role || user?.role_name);
  useEffect(() => {
    if (isAuthenticated && user && !portalOk) {
      toast.error("You don't have access to that portal");
      window.location.href = absoluteHomeForRole(user?.role || user?.role_name);
    }
  }, [isAuthenticated, user, portalOk]);

  // While the saved session is being validated, show ONE loader and
  // redirect NOWHERE — this is what stops the login/layout ping-pong.
  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!portalOk) {
    return <FullScreenLoader />;
  }

  return children;
}
