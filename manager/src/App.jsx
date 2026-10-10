import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Register from './pages/Register';
import VerifyBarOwnerEmail from './pages/VerifyBarOwnerEmail';
import Dashboard from './pages/Dashboard';
import BarManagement from './pages/BarManagement';
import Inventory from './pages/Inventory';
import Menu from './pages/Menu';
import Tables from './pages/Tables';
import Reservations from './pages/Reservations';
import Events from './pages/Events';
import Staff from './pages/Staff';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Payroll from './pages/Payroll';
import DeductionSettings from './pages/DeductionSettings';
import PayrollSettings from './pages/PayrollSettings';
import Documents from './pages/Documents';
import Customers from './pages/Customers';
import Reviews from './pages/Reviews';
import Promotions from './pages/Promotions';
import Packages from './pages/Packages';
import InventoryRequests from './pages/InventoryRequests';
import Analytics from './pages/Analytics';
import Dss from './pages/Dss';
import Crm from './pages/Crm';
import Financials from './pages/Financials';
import AuditLogs from './pages/AuditLogs';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Branches from './pages/Branches';
import Subscription from './pages/Subscription';
import SubscriptionApprovals from './pages/SubscriptionApprovals';
import BarRegistration from './pages/BarRegistration';
import Tps from './pages/Tps';
import Procurement from './pages/Procurement';
import SupplyChain from './pages/SupplyChain';
import PayrollFinance from './pages/PayrollFinance';
import Social from './pages/Social';
import PermitMonitoring from './pages/PermitMonitoring';
import QRCheckin from './pages/QRCheckin';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentFailed from './pages/PaymentFailed';

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

const App = () => {
  return (
    <>
    <StorageSync />
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-bar-owner-email" element={<VerifyBarOwnerEmail />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/bar-management" element={<ProtectedRoute permissions={['bar_details_view']}><BarManagement /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute permissions={['menu_view']}><Inventory /></ProtectedRoute>} />
        <Route path="/menu" element={<ProtectedRoute permissions={['menu_view']}><Menu /></ProtectedRoute>} />
        <Route path="/tables" element={<ProtectedRoute permissions={['table_view']}><Tables /></ProtectedRoute>} />
        <Route path="/reservations" element={<ProtectedRoute permissions={['reservation_view']}><Reservations /></ProtectedRoute>} />
        <Route path="/qr-checkin" element={<ProtectedRoute permissions={['qr_scan']}><QRCheckin /></ProtectedRoute>} />
        <Route path="/events" element={<ProtectedRoute permissions={['events_view']}><Events /></ProtectedRoute>} />
        <Route path="/staff" element={<ProtectedRoute permissions={['staff_view']}><Staff /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute permissions={['attendance_view_own', 'attendance_view_all']}><Attendance /></ProtectedRoute>} />
        <Route path="/leaves" element={<ProtectedRoute permissions={['leave_view_own', 'leave_view_all']}><Leaves /></ProtectedRoute>} />
        <Route path="/payroll" element={<ProtectedRoute permissions={['payroll_view_own', 'payroll_view_all']}><Payroll /></ProtectedRoute>} />
        <Route path="/deduction-settings" element={<ProtectedRoute permissions={['payroll_create']}><DeductionSettings /></ProtectedRoute>} />
        <Route path="/payroll-settings" element={<ProtectedRoute permissions={['payroll_create']}><PayrollSettings /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute permissions={['documents_view_own', 'documents_view_all']}><Documents /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute permissions={['ban_view']}><Customers /></ProtectedRoute>} />
        <Route path="/reviews" element={<ProtectedRoute permissions={['reviews_view']}><Reviews /></ProtectedRoute>} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/packages" element={<ProtectedRoute permissions={['menu_view']}><Packages /></ProtectedRoute>} />
        <Route path="/inventory-requests" element={<InventoryRequests />} />
        <Route path="/analytics" element={<ProtectedRoute permissions={['analytics_bar_view']}><Analytics /></ProtectedRoute>} />
        <Route path="/dss" element={<ProtectedRoute permissions={['dss_diagnostic_view']}><Dss /></ProtectedRoute>} />
        <Route path="/crm" element={<ProtectedRoute permissions={['crm_view']}><Crm /></ProtectedRoute>} />
        <Route path="/financials" element={<ProtectedRoute permissions={['financials_view']}><Financials /></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute permissions={['logs_view']}><AuditLogs /></ProtectedRoute>} />
        <Route path="/bar-registration" element={<ProtectedRoute permissions={['bar_registration_view']}><BarRegistration /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute permissions={['tps_view']}><Tps /></ProtectedRoute>} />
        <Route path="/procurement" element={<ProtectedRoute permissions={['procurement_view']}><Procurement /></ProtectedRoute>} />
        <Route path="/supply-chain" element={<ProtectedRoute permissions={['supply_chain_view']}><SupplyChain /></ProtectedRoute>} />
        <Route path="/payroll-finance" element={<ProtectedRoute permissions={['finance_payroll_approve', 'procurement_finance_approve']}><PayrollFinance /></ProtectedRoute>} />
        <Route path="/social" element={<Social />} />
        <Route path="/permit-monitoring" element={<ProtectedRoute permissions={['super_admin_access']}><PermitMonitoring /></ProtectedRoute>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/branches" element={<ProtectedRoute ownerOnly><Branches /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute ownerOnly><Subscription /></ProtectedRoute>} />
        <Route path="/subscription-approvals" element={<SubscriptionApprovals />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/failed" element={<PaymentFailed />} />
        <Route path="/subscription/success" element={<PaymentSuccess />} />
        <Route path="/subscription/failed" element={<PaymentFailed />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
};

export default App;
