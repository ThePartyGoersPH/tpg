import apiClient from './apiClient';

export const staffApi = {
  list: () =>
    apiClient.get('/owner/bar/users'),

  getMeta: () =>
    apiClient.get('/owner/bar/users/meta'),

  create: (data) =>
    apiClient.post('/owner/bar/users', data),

  update: (id, data) =>
    apiClient.patch(`/owner/bar/users/${id}`, data),

  toggle: (id) =>
    apiClient.post(`/owner/bar/users/${id}/toggle`),

  archive: (id) =>
    apiClient.delete(`/owner/bar/users/${id}`),

  listArchived: () =>
    apiClient.get('/owner/bar/users/archived'),

  listFullyDeactivated: () =>
    apiClient.get('/owner/bar/users/fully-deactivated'),

  fullyDeactivate: (id) =>
    apiClient.post(`/owner/bar/users/${id}/fully-deactivate`),

  restore: (id) =>
    apiClient.post(`/owner/bar/users/${id}/restore`),

  permanentDelete: (id) =>
    apiClient.post(`/owner/bar/users/${id}/permanent-delete`),

  resetPassword: (id, new_password) =>
    apiClient.post(`/owner/bar/users/${id}/reset-password`, { new_password }),

  // HR Employee endpoints
  listEmployees: () =>
    apiClient.get('/hr/employees'),

  createEmployee: (data) =>
    apiClient.post('/hr/hr/employees', data),

  updateEmployeeProfile: (userId, data) =>
    apiClient.put(`/hr/employees/${userId}/profile`, data),

  deleteEmployee: (id) =>
    apiClient.delete(`/hr/employees/${id}`),

  // RBAC
  getRoles: () =>
    apiClient.get('/owner/rbac/roles'),

  getPermissions: () =>
    apiClient.get('/owner/rbac/permissions'),

  getUserPermissions: (id) =>
    apiClient.get(`/owner/rbac/users/${id}/permissions`),

  updateUserRole: (id, role_id) =>
    apiClient.patch(`/owner/rbac/users/${id}/role`, { role_id }),

  updateUserPermissions: (id, permission_ids) =>
    apiClient.patch(`/owner/rbac/users/${id}/permissions`, { permission_ids }),
};
