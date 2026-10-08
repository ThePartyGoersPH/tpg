import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ children, permissions = [], ownerOnly = false }) => {
  const { isAuthenticated, isLoading, hasInitialized, initialize, hasPermission, user } = useAuthStore();

  useEffect(() => {
    if (!hasInitialized) {
      initialize();
    }
  }, [hasInitialized, initialize]);

  if (isLoading || !hasInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" text="Loading your session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (ownerOnly && user?.role !== 'bar_owner') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-500">This section is only available to the bar owner.</p>
      </div>
    );
  }

  if (permissions.length > 0 && !hasPermission(permissions)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
