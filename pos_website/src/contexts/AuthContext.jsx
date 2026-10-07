import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

function createAccessError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertPosAccess(user, permissionList) {
  const role = String(user?.role || user?.role_name || '').toUpperCase();
  const isPrivileged = role === 'BAR_OWNER' || role === 'SUPER_ADMIN';
  const isActive = Number(user?.is_active ?? 1) === 1;
  const hasAssignedBar = Boolean(user?.bar_id);
  const hasMenuView = Array.isArray(permissionList) && permissionList.includes('menu_view');

  if (!isActive) {
    throw createAccessError('POS_NOT_ACCEPTED', 'Your account is not accepted for POS access. Please contact your administrator.');
  }

  if (!isPrivileged && !hasAssignedBar) {
    throw createAccessError('POS_NOT_ACCEPTED', 'Your account is not yet assigned to an active bar for POS.');
  }

  if (!isPrivileged && !hasMenuView) {
    throw createAccessError('POS_PERMISSION_REQUIRED', 'You do not have permission for POS. Please contact your administrator.');
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('pos_token'));
  const [initialized, setInitialized] = useState(false);

  const loadSession = useCallback(async () => {
    const storedToken = localStorage.getItem('pos_token');
    if (!storedToken) {
      setInitialized(true);
      return;
    }

    try {
      const [{ data: meRes }, { data: permRes }] = await Promise.all([
        authApi.getMe(),
        authApi.getPermissions(),
      ]);

      const meData = meRes?.data || meRes;
      const permData = permRes?.data || permRes;
      const nextPermissions = permData?.permissions || permData || [];

      assertPosAccess(meData, nextPermissions);

      setUser(meData);
      setPermissions(nextPermissions);
      setToken(storedToken);

      if (meData?.bar_id) {
        localStorage.setItem('pos_selected_bar_id', String(meData.bar_id));
      }
    } catch (error) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_selected_bar_id');
      if (error?.code === 'POS_PERMISSION_REQUIRED' || error?.code === 'POS_NOT_ACCEPTED') {
        localStorage.setItem('pos_login_block_reason', JSON.stringify({
          code: error.code,
          message: error.message,
        }));
      }
      setToken(null);
      setUser(null);
      setPermissions([]);
    } finally {
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await authApi.login(email, password);
      const payload = data?.data || data;
      const nextToken = payload?.token;
      const nextUser = payload?.user;

      if (!nextToken) {
        throw new Error('No token received from server.');
      }

      localStorage.setItem('pos_token', nextToken);
      if (nextUser?.bar_id) {
        localStorage.setItem('pos_selected_bar_id', String(nextUser.bar_id));
      } else {
        localStorage.removeItem('pos_selected_bar_id');
      }

      const { data: permRes } = await authApi.getPermissions();
      const permData = permRes?.data || permRes;
      const nextPermissions = permData?.permissions || permData || [];

      assertPosAccess(nextUser, nextPermissions);

      setToken(nextToken);
      setUser(nextUser || null);
      setPermissions(nextPermissions);
    } catch (error) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_selected_bar_id');
      setToken(null);
      setUser(null);
      setPermissions([]);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_selected_bar_id');
    setToken(null);
    setUser(null);
    setPermissions([]);
  }, []);

  const can = useCallback(
    (required) => {
      const role = String(user?.role || user?.role_name || '').toUpperCase();
      if (role === 'BAR_OWNER' || role === 'SUPER_ADMIN') {
        return true;
      }

      const need = Array.isArray(required) ? required : [required];
      if (!need.length) return true;
      return need.some((code) => permissions.includes(code));
    },
    [permissions, user]
  );

  const value = useMemo(
    () => ({
      user,
      permissions,
      token,
      initialized,
      isAuthenticated: Boolean(token),
      login,
      logout,
      can,
    }),
    [can, initialized, login, logout, permissions, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
