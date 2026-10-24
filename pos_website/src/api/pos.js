import apiClient from './client';

export const posApi = {
  getDashboard: () => apiClient.get('/pos/dashboard'),
  getMenu: () => apiClient.get('/pos/menu'),
  getPackages: () => apiClient.get('/pos/packages'),
  getTables: () => apiClient.get('/pos/tables'),
  updateTableStatus: (tableId, payload) => apiClient.patch(`/pos/tables/${tableId}/status`, payload),
  createOrder: (payload) => apiClient.post('/pos/orders', payload),
  listOrders: (params) => apiClient.get('/pos/orders', { params }),
  getOrder: (id) => apiClient.get(`/pos/orders/${id}`),
  payOrder: (id, payload) => apiClient.post(`/pos/orders/${id}/pay`, payload),
  createCheckout: (payload) => apiClient.post('/api/payments/create-checkout', payload),
  reconcileOrderPayment: (payload) => apiClient.post('/api/payments/reconcile-order', payload),
  startShift: (payload) => apiClient.post('/api/shifts/start', payload),
  getCurrentShift: () => apiClient.get('/api/shifts/current'),
  endShift: (payload) => apiClient.post('/api/shifts/end', payload),
  cashIn: (payload) => apiClient.post('/api/cash/in', payload),
  cashOut: (payload) => apiClient.post('/api/cash/out', payload),
  listShiftReport: (params) => apiClient.get('/api/shifts/report', { params }),
  cancelOrder: (id) => apiClient.post(`/pos/orders/${id}/cancel`),
  lookupReservationByTransaction: (transactionNumber) =>
    apiClient.get(`/pos/reservations/by-transaction/${encodeURIComponent(transactionNumber)}`),
  payReservationBalance: (reservationId, payload) =>
    apiClient.patch(`/pos/reservations/${reservationId}/pay-balance`, payload),
};
