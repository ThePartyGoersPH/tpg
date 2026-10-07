import apiClient from './client';

export const authApi = {
  login: (email, password) =>
    apiClient.post(
      '/auth/login',
      { email, password },
      { headers: { 'x-login-portal': 'bar_management' } }
    ),
  getMe: () => apiClient.get('/auth/me'),
  getPermissions: () => apiClient.get('/auth/me/permissions'),
};
