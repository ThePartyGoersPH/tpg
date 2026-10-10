import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { setUnauthorizedHandler } from '../api/client';
import { CUSTOMER_ROLE_BLOCK_MESSAGE } from '../utils/constants';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('');
  const [maintenance, setMaintenance] = useState({ active: false, message: '' });
  // Set when a customer's token is refused because the email was never
  // confirmed. The App shell watches this and routes them to the verify screen
  // instead of dumping them on the landing page.
  const [needsVerificationEmail, setNeedsVerificationEmail] = useState('');

  const clearAuth = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearAuth();
    setAuthError('Your session has expired. Please log in again.');
  }, [clearAuth]);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
  }, [handleUnauthorized]);

  const checkMaintenance = useCallback(async () => {
    try {
      const result = await authService.maintenanceStatus();
      const isActive = result?.maintenance_mode === 1 || result?.maintenance_mode === true;
      setMaintenance({
        active: isActive,
        message: result?.maintenance_message || 'Platform is currently under maintenance. Please try again later.',
      });
      return isActive;
    } catch (_err) {
      return false;
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      setLoading(false);
      return;
    }

    try {
      const me = await authService.me();
      // Strict portal separation: only the customer role may hold a
      // customer-website session. (Bar-owner preview was removed; owners use
      // the manager portal, admins the admin portal.)
      const role = String(me?.role || me?.role_name || '').trim().toLowerCase().replace(/\s+/g, '_');
      if (role !== 'customer') {
        clearAuth();
        setAccessDeniedMessage(CUSTOMER_ROLE_BLOCK_MESSAGE);
      } else {
        setUser(me);
      }
    } catch (error) {
      const code = error?.response?.data?.code;
      const email = error?.response?.data?.email || '';

      // Unverified customers are refused platform access everywhere, so drop
      // the session but remember the address for the verify screen.
      if (code === 'EMAIL_NOT_VERIFIED') {
        clearAuth();
        setNeedsVerificationEmail(email);
      } else {
        clearAuth();
      }
    } finally {
      setLoading(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    checkMaintenance();
    refreshUser();
  }, [checkMaintenance, refreshUser]);

  // Multi-tab sync: another tab logging in (possibly as a different role),
  // logging out, or clearing a stale session immediately reflects here, so
  // no tab is ever left in a broken half-authenticated state.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== 'token') return;
      if (!e.newValue) {
        clearAuth();
      } else {
        refreshUser();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [clearAuth, refreshUser]);

  const clearNeedsVerification = useCallback(() => setNeedsVerificationEmail(''), []);

  const login = useCallback(async (email, password) => {
    setAuthError('');
    setAccessDeniedMessage('');
    setNeedsVerificationEmail('');

    const data = await authService.login({ email, password });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    setAuthError('');
    return authService.register(payload);
  }, []);

  const loginWithGoogle = useCallback((data) => {
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const updateProfile = useCallback(async (payload) => {
    const result = await authService.updateProfile(payload);
    if (result?.data) {
      setUser(result.data);
    }
    return result;
  }, []);

  const changePassword = useCallback((payload) => authService.changePassword(payload), []);

  const uploadProfilePicture = useCallback(async (file) => {
    const result = await authService.uploadProfilePicture(file);
    await refreshUser();
    return result;
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      authError,
      accessDeniedMessage,
      maintenance,
      needsVerificationEmail,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      loginWithGoogle,
      logout,
      refreshUser,
      checkMaintenance,
      clearNeedsVerification,
      updateProfile,
      changePassword,
      uploadProfilePicture,
      setAuthError,
      setAccessDeniedMessage,
    }),
    [
      user,
      token,
      loading,
      authError,
      accessDeniedMessage,
      maintenance,
      login,
      register,
      loginWithGoogle,
      logout,
      refreshUser,
      checkMaintenance,
      updateProfile,
      changePassword,
      uploadProfilePicture,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
