import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import FullScreenLoader from './common/FullScreenLoader';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, user, status } = useAuthStore();

  // While the saved session is being validated, show ONE loader and
  // redirect NOWHERE — this is what stops the login/layout ping-pong.
  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRole = String(user?.role || '').toUpperCase();
  if (userRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You do not have Super Admin permissions to access this portal.
          </p>
          <button
            onClick={() => {
              useAuthStore.getState().logout();
              window.location.href = `${(import.meta.env.BASE_URL || '/') === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '')}/login`;
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return children;
}
