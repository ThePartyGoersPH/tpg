import apiClient from './apiClient';

export const documentApi = {
  upload: (formData) =>
    apiClient.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  list: (params) =>
    apiClient.get('/documents', { params }),

  myDocuments: () =>
    apiClient.get('/documents/my'),

  view: (id) =>
    apiClient.get(`/documents/${id}/view`, { responseType: 'blob' }),

  send: (id, recipient_user_ids) =>
    apiClient.post(`/documents/${id}/send`, { recipient_user_ids }),

  getRecipients: (id) =>
    apiClient.get(`/documents/${id}/recipients`),

  getReceived: () =>
    apiClient.get('/documents/received'),

  markRead: (id) =>
    apiClient.patch(`/documents/${id}/mark-read`),
};
