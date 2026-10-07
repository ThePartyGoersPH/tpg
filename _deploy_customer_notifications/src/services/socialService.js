import { socialApi } from '../api/socialApi';

export const socialService = {
  async follow(barId) {
    const response = await socialApi.follow(barId);
    return response.data;
  },

  async unfollow(barId) {
    const response = await socialApi.unfollow(barId);
    return response.data;
  },

  async followStatus(barId) {
    const response = await socialApi.followStatus(barId);
    return response.data;
  },

  async followings() {
    const response = await socialApi.followings();
    return response.data?.data || [];
  },

  async notifications(params = {}) {
    if (typeof params === 'number') params = { limit: params };
    const response = await socialApi.notifications(params);
    return response.data;
  },

  async notificationTarget(notificationId) {
    const response = await socialApi.notificationTarget(notificationId);
    return response.data;
  },

  async markNotificationRead(notificationId) {
    const response = await socialApi.markNotificationRead(notificationId);
    return response.data;
  },

  async clearNotifications() {
    const response = await socialApi.clearNotifications();
    return response.data;
  },

  async searchBars(query) {
    const response = await socialApi.searchBars(query);
    return response.data?.data || [];
  },

  async getUnifiedFeed(limit = 50) {
    const response = await socialApi.getUnifiedFeed(limit);
    const feed = response.data?.data || [];
    if (!Array.isArray(feed)) return [];

    // Normalize media keys so customer views can render both legacy and new payload shapes.
    return feed.map((item) => ({
      ...item,
      image_path: item?.image_path || item?.post_image_path || item?.image_url || null,
    }));
  },

  async likePost(postId) {
    const response = await socialApi.likePost(postId);
    return response.data;
  },

  async commentOnPost(postId, comment, parentCommentId = null) {
    const response = await socialApi.commentOnPost(postId, comment, parentCommentId);
    return response.data;
  },

  async getPostComments(postId) {
    const response = await socialApi.getPostComments(postId);
    return response.data?.comments || [];
  },

  // Feature 1: Report comments
  async reportComment(commentId, payload) {
    const response = await socialApi.reportComment(commentId, payload);
    return response.data;
  },

  async reportStatus(commentId, commentType) {
    const response = await socialApi.reportStatus(commentId, commentType);
    return response.data;
  },

  // Feature 2: Event tables
  async getEventTables(eventId) {
    const response = await socialApi.getEventTables(eventId);
    return response.data;
  },

  // Feature 4: Notification extras
  async unreadCount() {
    const response = await socialApi.unreadCount();
    return response.data;
  },

  async markAllRead() {
    const response = await socialApi.markAllRead();
    return response.data;
  },

  async markOneRead(id) {
    const response = await socialApi.markOneRead(id);
    return response.data;
  },
};
