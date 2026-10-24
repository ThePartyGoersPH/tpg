import apiClient from './apiClient';

export const registrationReviewApi = {
  list: (params) => apiClient.get('/super-admin/registrations', { params }),
  approve: (id) => apiClient.post(`/super-admin/registrations/${id}/approve`),
  reject: (id, reason) => apiClient.post(`/super-admin/registrations/${id}/reject`, { reason }),
};
