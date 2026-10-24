import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { CUSTOMER_ROLE } from '../../utils/constants';

function ProtectedRoute({ children }) {
  const { loading, user, token, accessDeniedMessage } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="card">Loading your account...</div>
      </div>
    );
  }

  if (accessDeniedMessage) {
    return <Navigate to="/unauthorized" replace state={{ message: accessDeniedMessage }} />;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname || '/dashboard' }} />;
  }

  if (user.role !== CUSTOMER_ROLE) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

export default ProtectedRoute;
