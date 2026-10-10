import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import FullScreenLoader from './components/common/FullScreenLoader';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Payouts from './pages/Payouts';
import Bars from './pages/Bars';
import Subscriptions from './pages/Subscriptions';
import Users from './pages/Users';
import CustomerApprovals from './pages/CustomerApprovals';
import Banning from './pages/Banning';
import AuditLogs from './pages/AuditLogs';
import Registrations from './pages/Registrations';
import Settings from './pages/Settings';
import Revenue from './pages/Revenue';
import PlatformFeedback from './pages/PlatformFeedback';
import SocialModeration from './pages/SocialModeration';
import PermitMonitoring from './pages/PermitMonitoring';
import { useAuthStore } from './stores/authStore';

// Multi-tab sync: a login, logout, or role change in another tab immediately
// reflects here instead of leaving this tab in a broken session state.
function StorageSync() {
  const navigate = useNavigate();
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== 'token') return;
      useAuthStore.getState().logout();
      navigate('/login', { replace: true });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [navigate]);
  return null;
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const status = useAuthStore((state) => state.status);

  // Session still resolving: one loader, no routes, no redirects.
  // Authenticated users also stay on their current URL — no forced
  // bounce to the dashboard.
  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  return (
    <Router basename={import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Toaster position="top-right" />
      <StorageSync />
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="revenue" element={<Revenue />} />
          <Route path="bars" element={<Bars />} />
          <Route path="payouts" element={<Payouts />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="users" element={<Users />} />
          <Route path="customer-approvals" element={<CustomerApprovals />} />
          <Route path="banning" element={<Banning />} />
          <Route path="feedback" element={<PlatformFeedback />} />
          <Route path="social" element={<SocialModeration />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="registrations" element={<Registrations />} />
          <Route path="permit-monitoring" element={<PermitMonitoring />} />
          <Route path="settings" element={<Settings />} />
          {/* Unknown paths (e.g. bookmarks to the removed /payments page) land on the dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
