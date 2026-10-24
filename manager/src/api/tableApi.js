import apiClient from './apiClient';

export const tableApi = {
  list: () =>
    apiClient.get('/owner/bar/tables'),

  create: (data) =>
    apiClient.post('/owner/bar/tables', data),

  update: (id, data) =>
    apiClient.patch(`/owner/bar/tables/${id}`, data),

  uploadImage: (id, formData) =>
    apiClient.post(`/owner/bar/tables/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  getStatus: (date) =>
    apiClient.get('/owner/bar/tables/status', { params: { date } }),

  remove: (id) =>
    apiClient.delete(`/owner/bar/tables/${id}`),
};
