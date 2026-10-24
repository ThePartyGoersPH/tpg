import apiClient from './apiClient';

export const promotionApi = {
  list: () =>
    apiClient.get('/promotions'),

  getDetail: (id) =>
    apiClient.get(`/promotions/${id}`),

  create: (formData) =>
    apiClient.post('/promotions', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  update: (id, formData) =>
    apiClient.patch(`/promotions/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  toggle: (id) =>
    apiClient.post(`/promotions/${id}/toggle`),

  remove: (id) =>
    apiClient.delete(`/promotions/${id}`),
};
