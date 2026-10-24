import apiClient from './client';

export const orderApi = {
  getTaxConfig: (barId) => apiClient.get(`/customer-orders/bars/${barId}/tax-config`),
  create: (payload) => apiClient.post('/customer-orders', payload),
  myOrders: (params = {}) => apiClient.get('/customer-orders/my', { params }),
  receipt: (orderId) => apiClient.get(`/customer-orders/${orderId}/receipt`),
  salesReport: (params = {}) => apiClient.get('/customer-orders/reports/sales', { params }),
};
