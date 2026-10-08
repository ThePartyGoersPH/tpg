import apiClient from './apiClient';

export const eventApi = {
  list: (params) =>
    apiClient.get('/owner/bar/events', { params, silentError: true }),

  getDetails: (id) =>
    apiClient.get(`/owner/bar/events/${id}/details`),

  listArchived: () =>
    apiClient.get('/owner/bar/events/archived'),

  create: (data) =>
    apiClient.post('/owner/bar/events', data),

  update: (id, data) =>
    apiClient.patch(`/owner/bar/events/${id}`, data),

  cancelOrArchive: (id, mode = 'cancel') =>
    apiClient.delete(`/owner/bar/events/${id}`, { params: { mode } }),

  uploadImage: (id, formData) =>
    apiClient.post(`/owner/bar/events/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  getAnalytics: () =>
    apiClient.get('/owner/bar/events/analytics'),

  replyToComment: (commentId, reply) =>
    apiClient.post(`/owner/bar/comments/events/${commentId}/replies`, { reply }),

  deleteComment: (commentId) =>
    apiClient.delete(`/owner/bar/comments/events/${commentId}`),
};
