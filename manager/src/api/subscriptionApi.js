import apiClient from './apiClient';

export const subscriptionApi = {
  getPlans: () =>
    apiClient.get('/subscriptions/plans'),

  getMySubscription: () =>
    apiClient.get('/subscriptions/my'),

  subscribe: (plan_id, payment_method, payment_reference) =>
    apiClient.post('/subscriptions/subscribe', { plan_id, payment_method, payment_reference }),

  cancel: () =>
    apiClient.post('/subscriptions/cancel'),

  // Super Admin endpoints
  getPending: () =>
    apiClient.get('/subscriptions/admin/pending'),

  getAll: (status) =>
    apiClient.get('/subscriptions/admin/all', { params: status ? { status } : {} }),

  approve: (id) =>
    apiClient.post(`/subscriptions/admin/approve/${id}`),

  reject: (id, reason) =>
    apiClient.post(`/subscriptions/admin/reject/${id}`, { reason }),
};
