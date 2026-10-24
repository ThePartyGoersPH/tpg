import apiClient from './client';

export const socialApi = {
  follow: (barId) => apiClient.post(`/social/bars/${barId}/follow`),
  unfollow: (barId) => apiClient.delete(`/social/bars/${barId}/follow`),
  followStatus: (barId) => apiClient.get(`/social/bars/${barId}/follow-status`),
  followings: () => apiClient.get('/social/followings'),
  notifications: (params = {}) => apiClient.get('/social/notifications', { params }),
  notificationTarget: (notificationId) => apiClient.get(`/social/notifications/${notificationId}/target`),
  markNotificationRead: (notificationId) =>
    apiClient.post('/social/notifications/read', notificationId ? { notification_id: notificationId } : {}),
  clearNotifications: () => apiClient.delete('/social/notifications'),
  searchBars: (query) => apiClient.get('/social/search', { params: { q: query } }),
  getUnifiedFeed: (params = 50) => {
    const normalizedParams = typeof params === 'number' ? { limit: params } : (params || {});
    return apiClient.get('/social/unified-feed', { params: normalizedParams });
  },
  likePost: (postId) => apiClient.post('/social/like-post', { post_id: postId }),
  commentOnPost: (postId, comment, parentCommentId = null) => apiClient.post('/social/comments', { post_id: postId, comment, parent_comment_id: parentCommentId }),
  getPostComments: (postId) => apiClient.get(`/social/comments/${postId}`),
  getEventComments: (eventId) => apiClient.get(`/social/events/${eventId}/comments`),
  commentOnEvent: (eventId, comment, parentCommentId = null) =>
    apiClient.post(`/social/events/${eventId}/comments`, { comment, parent_comment_id: parentCommentId }),
  // Feature 1: Report comments
  reportComment: (commentId, payload) => apiClient.post(`/social/comments/${commentId}/report`, payload),
  reportStatus: (commentId, commentType) => apiClient.get(`/social/comments/${commentId}/report-status`, { params: { comment_type: commentType } }),
  // Feature 2: Event tables
  getEventTables: (eventId) => apiClient.get(`/social/events/${eventId}/tables`),
  // Feature 4: Notification extras
  unreadCount: () => apiClient.get('/social/notifications/unread-count'),
  markAllRead: () => apiClient.patch('/social/notifications/read-all'),
  markOneRead: (id) => apiClient.patch(`/social/notifications/${id}/read`),
};
