import apiClient from './apiClient';

export const menuApi = {
  list: () =>
    apiClient.get('/owner/menu'),

  create: (data) =>
    apiClient.post('/owner/menu', data),

  update: (id, data) =>
    apiClient.patch(`/owner/menu/${id}`, data),

  remove: (id) =>
    apiClient.delete(`/owner/menu/${id}`),
};
