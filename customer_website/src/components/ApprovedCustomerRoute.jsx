import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import apiClient from '../api/client';

/**
 * Route guard: redirects non-approved customers to the status page.
 * Admins/bar owners/staff are always allowed.
 */
export default function ApprovedCustomerRoute({ children }) {
  const location = useLocation();
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await apiClient.get('/auth/me');
        const user = res.data?.data || res.data;
        const role = String(user?.role || '').toLowerCase();
        if (role !== 'customer') {
          setAllowed(true);
          return;
        }
        const status = String(user?.id_verification_status || '').toLowerCase();
        if (status === 'approved') {
          setAllowed(true);
        } else {
          setAllowed(false);
        }
      } catch (err) {
        if (err?.response?.status === 401) {
          setAllowed('login');
        } else if (err?.response?.data?.code === 'ID_NOT_APPROVED' ||
                   err?.response?.data?.code === 'ID_PENDING_REVIEW' ||
                   err?.response?.data?.code === 'ID_REJECTED') {
          setAllowed(false);
        } else {
          setAllowed('login');
        }
      }
    };
    check();
  }, [location.pathname]);

  if (allowed === null) return <div>Loading...</div>;
  if (allowed === 'login') return <Navigate to="/login" replace />;
  if (allowed === false) return <Navigate to="/id-status" replace />;
  return children;
}