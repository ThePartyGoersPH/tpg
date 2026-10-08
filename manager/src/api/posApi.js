import apiClient from './apiClient';

export const posApi = {
  getMenu: () =>
    apiClient.get('/pos/menu'),

  getTables: () =>
    apiClient.get('/pos/tables'),

  createOrder: (data) =>
    apiClient.post('/pos/orders', data),

  payOrder: (id, data) =>
    apiClient.post(`/pos/orders/${id}/pay`, data),

  cancelOrder: (id) =>
    apiClient.post(`/pos/orders/${id}/cancel`),

  listOrders: (params) =>
    apiClient.get('/pos/orders', { params }),

  getOrder: (id) =>
    apiClient.get(`/pos/orders/${id}`),

  getDashboard: () =>
    apiClient.get('/pos/dashboard'),

  getOrderHistory: (params) =>
    apiClient.get('/pos/orders', { params }),

  getOrderDetails: (orderId) =>
    apiClient.get(`/pos/orders/${orderId}`),
};
