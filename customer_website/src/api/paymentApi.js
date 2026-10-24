import apiClient from './client';

export const paymentApi = {
  create: (payload) => apiClient.post('/payments/create', payload),
  getByReference: (referenceId) => apiClient.get(`/payments/${referenceId}`),
  confirmByReference: (referenceId) => apiClient.post(`/payments/${referenceId}/confirm`),
  cancelByReference: (referenceId) => apiClient.post(`/payments/cancel/${referenceId}`),
  myHistory: (params = {}) => apiClient.get('/payments/my/history', { params }),
};
