import apiClient from './apiClient';

export const authApi = {
  // Login gets its own hard 15s cap (AbortController) so the "Signing in…"
  // spinner can never outlive it — axios' 30s default is too generous here.
  login: (email, password) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    return apiClient
      .post('/auth/login', { email, password }, {
        headers: { 'x-login-portal': 'bar_management', 'X-App': 'manager' },
        // The Login screen renders its own inline error + lock panel; letting
        // the interceptor toast too would show every failure twice.
        silentError: true,
        signal: controller.signal,
      })
      .finally(() => clearTimeout(timer))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.name === 'AbortError') {
          const timeoutErr = new Error('timeout');
          timeoutErr.isTimeout = true;
          throw timeoutErr;
        }
        throw err;
      });
  },

  getMe: () =>
    apiClient.get('/auth/me'),

  getPermissions: () =>
    apiClient.get('/auth/me/permissions'),

  registerBarOwner: (formData) =>
    apiClient.post('/auth/register-bar-owner', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  verifyBarOwnerEmail: (token) =>
    apiClient.get('/auth/verify-bar-owner-email', { params: { token } }),

  checkEmail: ({ email }) =>
    apiClient.post('/auth/check-email', { email }, { silentError: true }),

  requestPasswordReset: (email) =>
    apiClient.post('/auth/forgot-password', { email }, {
      headers: { 'x-login-portal': 'bar_management' },
      silentError: true,
    }),

  resetPassword: (token, newPassword) =>
    apiClient.post('/auth/reset-password', { token, new_password: newPassword }, { silentError: true }),
};
