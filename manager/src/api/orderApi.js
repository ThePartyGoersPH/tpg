import apiClient from './apiClient';

export const orderApi = {
  getTaxConfig: (barId) =>
    apiClient.get(`/customer-orders/bars/${barId}/tax-config`),

  taxPreview: (barId, subtotal) =>
    apiClient.get(`/customer-orders/bars/${barId}/tax-preview`, { params: { subtotal } }),

  createOrder: (data) =>
    apiClient.post('/customer-orders', data),

  myOrders: (params) =>
    apiClient.get('/customer-orders/my', { params }),

  getReceipt: (orderId) =>
    apiClient.get(`/customer-orders/${orderId}/receipt`),

  salesReport: (params) =>
    apiClient.get('/customer-orders/reports/sales', { params }),
};
