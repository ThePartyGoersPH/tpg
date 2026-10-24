import apiClient from './apiClient';

export const socialApi = {
  likeEvent: (eventId) => apiClient.post(`/social/events/${eventId}/like`),
  unlikeEvent: (eventId) => apiClient.delete(`/social/events/${eventId}/like`),
  getEventComments: (eventId) => apiClient.get(`/social/events/${eventId}/comments`, { silentError: true }),
  addEventComment: (eventId, comment) => apiClient.post(`/social/events/${eventId}/comments`, { comment }),

  followBar: (barId) => apiClient.post(`/social/bars/${barId}/follow`),
  unfollowBar: (barId) => apiClient.delete(`/social/bars/${barId}/follow`),
  getFollowStatus: (barId) => apiClient.get(`/social/bars/${barId}/follow-status`, { silentError: true }),

  listPublicBarPosts: (barId) =>
    apiClient.get('/social/bar-posts', { params: barId ? { bar_id: barId } : undefined, silentError: true }),

  // Notifications
  getNotifications: (params) => {
    const { silentError, ...queryParams } = params || {};
    return apiClient.get('/social/notifications', { params: queryParams, silentError });
  },
  markNotificationRead: (notificationId) => apiClient.post('/social/notifications/read', { notification_id: notificationId }),
  markAllNotificationsRead: () => apiClient.post('/social/notifications/read'),
};
