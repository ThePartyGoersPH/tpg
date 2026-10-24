import apiClient from './client';

export const barApi = {
  list: (params = {}) => apiClient.get('/public/bars', { params }),
  trending: (limit = 12) => apiClient.get('/public/bars/trending', { params: { limit } }),
  detail: (barId) => apiClient.get(`/public/bars/${barId}`),
  menu: (barId) => apiClient.get(`/public/bars/${barId}/menu`),
  menuWithBestSellers: (barId) => apiClient.get(`/public/bars/${barId}/menu-with-bestsellers`),
  events: (barId) => apiClient.get(`/public/bars/${barId}/events`),
  tables: (barId) => apiClient.get(`/public/bars/${barId}/tables`),
  availableTables: (barId, params) => apiClient.get(`/public/bars/${barId}/available-tables`, { params }),
  reviews: (barId) => apiClient.get(`/public/bars/${barId}/reviews`),
  myReview: (barId) => apiClient.get(`/public/bars/${barId}/reviews/mine`),
  reviewEligibility: (barId) => apiClient.get(`/public/bars/${barId}/reviews/eligibility`),
  submitReview: (barId, payload) => apiClient.post(`/public/bars/${barId}/reviews`, payload),
  deleteReview: (barId) => apiClient.delete(`/public/bars/${barId}/reviews`),
  videos: (barId) => apiClient.get(`/public/bars/${barId}/videos`),

  // Media engagement (likes & comments)
  mediaEngagement: (mediaId) => apiClient.get(`/media/${mediaId}/engagement`, { silentError: true }),
  toggleMediaLike: (mediaId) => apiClient.post(`/media/${mediaId}/like`),
  mediaComments: (mediaId) => apiClient.get(`/media/${mediaId}/comments`),
  addMediaComment: (mediaId, content, parentId, mentionedUserId, mentionedUserName) =>
    apiClient.post(`/media/${mediaId}/comments`, {
      content,
      parent_comment_id: parentId,
      mentioned_user_id: mentionedUserId || null,
      mentioned_user_name: mentionedUserName || null,
    }),
  toggleCommentLike: (commentId) =>
    apiClient.post(`/media/comments/${commentId}/like`),
  deleteMediaComment: (mediaId, commentId) =>
    apiClient.delete(`/media/${mediaId}/comments/${commentId}`),
};
