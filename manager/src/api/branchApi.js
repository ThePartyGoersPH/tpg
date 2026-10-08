import apiClient from './apiClient';

export const branchApi = {
  getMyBranches: () =>
    apiClient.get('/branches/my'),

  createBranch: (data) =>
    apiClient.post('/branches/create', data),

  switchBranch: (bar_id) =>
    apiClient.post('/branches/switch', { bar_id }),

  updateBranch: (id, data) =>
    apiClient.patch(`/branches/${id}`, data),

  getSubscriptionInfo: () =>
    apiClient.get('/branches/subscription-info'),
};
