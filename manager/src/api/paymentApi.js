import apiClient from './apiClient';

export const paymentApi = {
  // Customer payments (orders/reservations)
  createPayment: (data) =>
    apiClient.post('/payments/create', data),

  getPaymentByReference: (reference) =>
    apiClient.get(`/payments/${reference}`),

  getPaymentHistory: (params) =>
    apiClient.get('/payments/my/history', { params }),

  // Payment verification (checks PayMongo and auto-activates)
  verifyPayment: (reference) =>
    apiClient.post(`/payment-check/verify/${reference}`),

  // Subscription payments
  subscribeWithPayment: (data) =>
    apiClient.post('/subscription-payments/subscribe', data),

  renewSubscriptionWithPayment: (data) =>
    apiClient.post('/subscription-payments/renew', data),

  getSubscriptionPaymentStatus: (reference) =>
    apiClient.get(`/subscription-payments/status/${reference}`),

  // Payouts (bar owner)
  getMyPayouts: (params) =>
    apiClient.get('/payouts/my', { params }),

  getPayoutSummary: () =>
    apiClient.get('/payouts/my/summary'),

  // Admin payout management
  getAllPayouts: (params) =>
    apiClient.get('/payouts/admin/all', { params }),

  processPayout: (id, data) =>
    apiClient.post(`/payouts/admin/process/${id}`, data),

  bulkProcessPayouts: (data) =>
    apiClient.post('/payouts/admin/bulk-process', data),
};
