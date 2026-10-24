import apiClient from './apiClient';

export const barApi = {
  getDetails: (config) =>
    apiClient.get('/owner/bar/details', config),

  updateDetails: (data) =>
    apiClient.patch('/owner/bar/details', data),

  // Owner acknowledged / dismissed the "Bar Approved" success banner — the
  // choice is stored on the bar so it stays hidden across reloads and logins.
  // Body must be a real object: Express' JSON parser rejects a literal `null`.
  dismissApprovalBanner: (config) =>
    apiClient.post('/owner/bar/details/approval-banner/dismiss', {}, config),

  uploadImage: (formData) =>
    apiClient.post('/owner/bar/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  uploadIcon: (formData) =>
    apiClient.post('/owner/bar/icon', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  deleteBar: (bar_id) =>
    apiClient.post('/owner/bar/delete', { bar_id }),

  toggleStatus: (bar_id, status) =>
    apiClient.post('/owner/bar/toggle-status', { bar_id, status }),

  updateSettings: (data) =>
    apiClient.patch('/owner/bar/settings', data),

  getDashboardSummary: (config) =>
    apiClient.get('/owner/bar/dashboard/summary', config),

  getCustomerInsights: () =>
    apiClient.get('/owner/bar/customer-insights', { silentError: true }),

  getStaffPerformance: () =>
    apiClient.get('/owner/bar/staff-performance', { silentError: true }),

  getFollowers: () =>
    apiClient.get('/owner/bar/followers', { silentError: true }),

  getPosts: () =>
    apiClient.get('/owner/bar/posts', { silentError: true }),

  getArchivedPosts: () =>
    apiClient.get('/owner/bar/posts/archived', { silentError: true }),

  getComments: (params) =>
    apiClient.get('/owner/bar/comments', { params, silentError: true }),

  createPost: (data, imageFile) => {
    const fd = new FormData();
    fd.append('content', data.content || '');
    if (imageFile) fd.append('image', imageFile);
    return apiClient.post('/social/bar-posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  updatePost: (postId, data, imageFile) => {
    const fd = new FormData();
    if (data.content !== undefined) fd.append('content', data.content);
    if (data.remove_image) fd.append('remove_image', 'true');
    if (imageFile) fd.append('image', imageFile);
    return apiClient.patch(`/social/bar-posts/${postId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  deletePost: (postId) =>
    apiClient.delete(`/owner/bar/posts/${postId}`),

  replyToPostComment: (commentId, reply) =>
    apiClient.post(`/owner/bar/comments/posts/${commentId}/replies`, { reply }),

  hidePostComment: (commentId, action = 'hide') =>
    apiClient.patch(`/owner/bar/comments/posts/${commentId}/hide`, { action }),

  deleteComment: (type, commentId) =>
    apiClient.delete(`/owner/bar/comments/${type}/${commentId}`),

  // Media comment moderation
  addMediaComment: (mediaId, content, parentId, mentionedUserId, mentionedUserName) =>
    apiClient.post(`/media/${mediaId}/comments`, {
      content,
      parent_comment_id: parentId,
      mentioned_user_id: mentionedUserId || null,
      mentioned_user_name: mentionedUserName || null,
    }),

  hideMediaComment: (commentId) =>
    apiClient.patch(`/media/comments/${commentId}/hide`),

  reportMediaComment: (commentId) =>
    apiClient.patch(`/media/comments/${commentId}/report`),

  deleteMediaComment: (mediaId, commentId) =>
    apiClient.delete(`/media/${mediaId}/comments/${commentId}`),

  getVideos: () =>
    apiClient.get('/owner/bar/videos', { silentError: true }),

  uploadVideo: (formData, onUploadProgress) =>
    apiClient.post('/owner/bar/videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),

  updateVideo: (videoId, data) =>
    apiClient.patch(`/owner/bar/videos/${videoId}`, data),

  deleteVideo: (videoId) =>
    apiClient.delete(`/owner/bar/videos/${videoId}`),

  uploadPhoto: (formData, onUploadProgress) =>
    apiClient.post('/owner/bar/photos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),

  deletePhoto: (photoId) =>
    apiClient.delete(`/owner/bar/videos/${photoId}`),

  updatePhoto: (photoId, data) =>
    apiClient.patch(`/owner/bar/videos/${photoId}`, data),

  getTaxConfig: () =>
    apiClient.get('/owner/tax-config', { silentError: true }),

  updateTaxConfig: (data) =>
    apiClient.put('/owner/tax-config', data),
};
