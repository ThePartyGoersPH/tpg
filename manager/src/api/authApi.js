import apiClient from './apiClient';

export const authApi = {
  login: (email, password) =>
    apiClient.post('/auth/login', { email, password }, {
      headers: { 'x-login-portal': 'bar_management', 'X-App': 'manager' },
      // The Login screen renders its own inline error + lock panel; letting
      // the interceptor toast too would show every failure twice.
      silentError: true,
    }),

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
