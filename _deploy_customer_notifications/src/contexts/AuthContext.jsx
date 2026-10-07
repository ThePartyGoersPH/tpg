import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { setUnauthorizedHandler } from '../api/client';
import { CUSTOMER_ROLE, CUSTOMER_ROLE_BLOCK_MESSAGE } from '../utils/constants';

export const AuthContext = createContext(null);

function isCustomerUser(user) {
  return String(user?.role || user?.role_name || '').toLowerCase() === CUSTOMER_ROLE;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [accessDeniedMessage, setAccessDeniedMessage] = useState('');
  const [maintenance, setMaintenance] = useState({ active: false, message: '' });

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
      if (!isCustomerUser(me)) {
        clearAuth();
        setAccessDeniedMessage(CUSTOMER_ROLE_BLOCK_MESSAGE);
      } else {
        setUser(me);
      }
    } catch (_error) {
      clearAuth();
    } finally {
      setLoading(false);
    }
  }, [clearAuth]);

  useEffect(() => {
    checkMaintenance();
    refreshUser();
  }, [checkMaintenance, refreshUser]);

  const login = useCallback(async (email, password) => {
    setAuthError('');
    setAccessDeniedMessage('');

    const data = await authService.login({ email, password });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
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
      isAuthenticated: Boolean(token && user),
      login,
      register,
      loginWithGoogle,
      logout,
      refreshUser,
      checkMaintenance,
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
