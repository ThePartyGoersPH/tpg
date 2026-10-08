import apiClient from './apiClient';

export const packageApi = {
  list: () =>
    apiClient.get('/owner/bar/packages'),

  create: (data) =>
    apiClient.post('/owner/bar/packages', data),

  update: (id, data) =>
    apiClient.patch(`/owner/bar/packages/${id}`, data),

  remove: (id) =>
    apiClient.delete(`/owner/bar/packages/${id}`),
};
