import apiClient from './apiClient';

export const inventoryRequestApi = {
  // Staff - Submit new request
  submit: (data) =>
    apiClient.post('/owner/inventory/requests', data),

  // Staff - Get own requests
  myRequests: () =>
    apiClient.get('/owner/inventory/requests/my'),

  // Owner - Get all requests (with optional status filter)
  list: (status = null) =>
    apiClient.get('/owner/inventory/requests', { params: status ? { status } : {} }),

  // Owner - Approve request
  approve: (id) =>
    apiClient.post(`/owner/inventory/requests/${id}/approve`),

  // Owner - Reject request
  reject: (id, rejection_note) =>
    apiClient.post(`/owner/inventory/requests/${id}/reject`, { rejection_note }),
};
