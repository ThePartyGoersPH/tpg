import apiClient from './client';

export const authApi = {
  register: (payload) => apiClient.post('/auth/register', payload),
  login: (payload) =>
    apiClient.post('/auth/login', payload, {
      headers: { 'x-login-portal': 'customer' },
    }),
  me: () => apiClient.get('/auth/me'),
  updateProfile: (payload) => apiClient.patch('/auth/me/profile', payload),
  changePassword: (payload) => apiClient.post('/auth/me/change-password', payload),
  uploadProfilePicture: (formData) =>
    apiClient.post('/auth/me/profile-picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  maintenanceStatus: () => apiClient.get('/auth/platform/maintenance'),
  announcements: (limit = 5) => apiClient.get(`/auth/platform/announcements?limit=${limit}`),
};
