import api from './axios';

// ─── SESSION ─────────────────────────────────────────────────────────
// Single lightweight session check used once at app boot.
export const authAPI = {
  me: () => api.get('/super-admin/me'),
};

// ─── DASHBOARD ───────────────────────────────────────────────────────
export const dashboardAPI = {
  getSummary: () => api.get('/super-admin/dashboard/summary'),
  getRecentActivity: (limit = 30) => api.get(`/super-admin/dashboard/recent-activity?limit=${limit}`),
  getNotifications: (limit = 20) => api.get('/super-admin/notifications', { params: { limit } }),
  markNotificationRead: (key) => api.post('/super-admin/notifications/read', { key }),
  markAllNotificationsRead: () => api.post('/super-admin/notifications/read', { all: true }),
};

// ─── BARS ────────────────────────────────────────────────────────────
export const barsAPI = {
  list: (params) => api.get('/super-admin/bars', { params }),
  get: (id) => api.get(`/super-admin/bars/${id}`),
  update: (id, data) => api.patch(`/super-admin/bars/${id}`, data),
  create: (data) => api.post('/super-admin/bars', data),
  approve: (id) => api.post(`/super-admin/bars/${id}/approve`),
  suspend: (id, data) => api.post(`/super-admin/bars/${id}/suspend`, data),
  reactivate: (id) => api.post(`/super-admin/bars/${id}/reactivate`),
  getTables: (barId) => api.get(`/super-admin/bars/${barId}/tables`),
};

// ─── BAR OWNERS ──────────────────────────────────────────────────────
export const ownersAPI = {
  list: (params) => api.get('/super-admin/bar-owners', { params }),
  listLegacy: (params) => api.get('/super-admin/owners', { params }),
  create: (data) => api.post('/super-admin/owners', data),
  resetPassword: (userId, data) => api.post(`/super-admin/owners/${userId}/reset-password`, data),
  disable: (userId) => api.post(`/super-admin/owners/${userId}/disable`),
  enable: (userId) => api.post(`/super-admin/owners/${userId}/enable`),
  transfer: (userId, data) => api.post(`/super-admin/owners/${userId}/transfer`, data),
};

// ─── BUSINESS REGISTRATIONS ─────────────────────────────────────────
export const registrationsAPI = {
  list: (params) => api.get('/super-admin/registrations', { params }),
  get: (id) => api.get(`/super-admin/registrations/${id}`),
  documentChecks: (id) => api.get(`/super-admin/registrations/${id}/document-checks`),
  automaticDocumentCheck: (id) => api.post(`/super-admin/registrations/${id}/automatic-document-check`),
  checkDocument: (id, documentType, data) => api.post(`/super-admin/registrations/${id}/document-checks/${documentType}`, data),
  approve: (id) => api.post(`/super-admin/registrations/${id}/approve`),
  reject: (id, data) => api.post(`/super-admin/registrations/${id}/reject`, data),
};

// ─── BAR COMPLIANCE (visibility gating) ──────────────────────────────
export const complianceAPI = {
  queue: (params) => api.get('/super-admin/compliance/queue', { params }),
  approve: (id) => api.post(`/super-admin/compliance/${id}/approve`),
  reject: (id, data) => api.post(`/super-admin/compliance/${id}/reject`, data),
};

// ─── USERS ───────────────────────────────────────────────────────────
export const usersAPI = {
  list: (params) => api.get('/super-admin/users', { params }),
  get: (id) => api.get(`/super-admin/users/${id}`),
  create: (data) => api.post('/super-admin/users', data),
  update: (id, data) => api.patch(`/super-admin/users/${id}`, data),
  toggleStatus: (id) => api.post(`/super-admin/users/${id}/toggle-status`),
  resetPassword: (id, data) => api.post(`/super-admin/users/${id}/reset-password`, data),
  delete: (id) => api.delete(`/super-admin/users/${id}`),
  getPermissions: (id) => api.get(`/super-admin/users/${id}/permissions`),
  updatePermissions: (id, data) => api.patch(`/super-admin/users/${id}/permissions`, data),
};

// ─── CUSTOMER APPROVALS ──────────────────────────────────────────────
export const customerApprovalsAPI = {
  list: (params) => api.get('/super-admin/customer-approvals', { params }),
  stats: () => api.get('/super-admin/customer-approvals/stats'),
  approve: (id, data) => api.post(`/super-admin/customer-approvals/${id}/approve`, data),
  reject: (id, data) => api.post(`/super-admin/customer-approvals/${id}/reject`, data),
  bulk: (data) => api.post('/super-admin/customer-approvals/bulk', data),
  resend: (id) => api.post(`/super-admin/customer-approvals/${id}/resend-email`),
};

// ─── CUSTOMER BANNING ────────────────────────────────────────────────
export const banningAPI = {
  getGlobalBans: (params) => api.get('/super-admin/customer-bans/global', { params }),
  banGlobal: (customerId, data) => api.post(`/super-admin/customer-bans/global/${customerId}`, data),
  unbanGlobal: (customerId) => api.delete(`/super-admin/customer-bans/global/${customerId}`),
  getBarBans: (params) => api.get('/super-admin/customer-bans', { params }),
  banAtBar: (barId, customerId, data) => api.post(`/super-admin/customer-bans/${barId}/${customerId}`, data),
  unbanAtBar: (barId, customerId) => api.delete(`/super-admin/customer-bans/${barId}/${customerId}`),
};

// ─── PAYMENTS ────────────────────────────────────────────────────────
export const paymentsAPI = {
  dashboard: (params) => api.get('/super-admin-payments/dashboard', { params }),
  payouts: (params) => api.get('/super-admin-payments/payouts', { params }),
  markPayoutSent: (id, data) => api.post(`/super-admin-payments/payouts/${id}/mark-sent`, data),
  completePayout: (id) => api.post(`/super-admin-payments/payouts/${id}/complete`),
  bulkMarkSent: (data) => api.post('/super-admin-payments/payouts/bulk-mark-sent', data),
  bulkComplete: (data) => api.post('/super-admin-payments/payouts/bulk-complete', data),
  barConfigs: (params) => api.get('/super-admin-payments/bar-configs', { params }),
  updateBarConfig: (barId, data) => api.put(`/super-admin-payments/bar-configs/${barId}`, data),
  disablePayout: (barId, data) => api.post(`/super-admin-payments/bar-configs/${barId}/disable-payout`, data),
  getSettings: () => api.get('/super-admin-payments/settings'),
  updateSettings: (data) => api.put('/super-admin-payments/settings', data),
};

// ─── SUBSCRIPTIONS ───────────────────────────────────────────────────
export const subscriptionsAPI = {
  getPlans: () => api.get('/subscriptions/plans'),
  getPending: () => api.get('/subscriptions/admin/pending'),
  listAll: (params) => api.get('/subscriptions/admin/all', { params }),
  approve: (id, data) => api.post(`/subscriptions/admin/approve/${id}`, data),
  reject: (id, data) => api.post(`/subscriptions/admin/reject/${id}`, data),
  updatePlanPrice: (id, data) => api.put(`/subscriptions/admin/plans/${id}`, data),
};

// ─── AUDIT LOGS ──────────────────────────────────────────────────────
export const auditAPI = {
  getBarLogs: (params) => api.get('/super-admin/audit-logs', { params }),
  getPlatformLogs: (params) => api.get('/super-admin/platform-audit-logs', { params }),
  getLoginActivity: (params) => api.get('/super-admin/login-activity', { params }),
  getSuspiciousLogins: (params) => api.get('/super-admin/platform/suspicious-logins', { params }),
};

// ─── PLATFORM SETTINGS ──────────────────────────────────────────────
export const platformAPI = {
  getMaintenance: () => api.get('/super-admin/platform/maintenance'),
  setMaintenance: (data) => api.patch('/super-admin/platform/maintenance', data),
  getAnnouncements: (params) => api.get('/super-admin/platform/announcements', { params }),
  createAnnouncement: (data) => api.post('/super-admin/platform/announcements', data),
  updateAnnouncement: (id, data) => api.patch(`/super-admin/platform/announcements/${id}`, data),
  deleteAnnouncement: (id) => api.delete(`/super-admin/platform/announcements/${id}`),
};

// ─── RBAC ────────────────────────────────────────────────────────────
export const rbacAPI = {
  getRoles: () => api.get('/super-admin/roles'),
  getRoleUsers: (roleId) => api.get(`/super-admin/roles/${roleId}/users`),
  getPermissions: () => api.get('/super-admin/permissions'),
  getRolePermissions: (roleId) => api.get(`/super-admin/roles/${roleId}/permissions`),
  updateRolePermissions: (roleId, data) => api.patch(`/super-admin/roles/${roleId}/permissions`, data),
  forceResetRole: (roleId) => api.post(`/super-admin/roles/${roleId}/force-reset`),
};

// ─── EVENTS ──────────────────────────────────────────────────────────
export const eventsAPI = {
  getFeed: (params) => api.get('/super-admin/events/feed', { params }),
  getComments: (eventId) => api.get(`/super-admin/events/${eventId}/comments`),
  flagComment: (commentId, data) => api.post(`/super-admin/events/comments/${commentId}/flag`, data),
  deleteComment: (commentId) => api.delete(`/super-admin/events/comments/${commentId}`),
  archive: (id, data) => api.post(`/super-admin/events/${id}/archive`, data),
};

// ─── POS & RESERVATIONS ─────────────────────────────────────────────
export const posAPI = {
  getOverview: (params) => api.get('/super-admin/pos/overview', { params }),
  getOrders: (params) => api.get('/super-admin/pos-orders', { params }),
};

export const reservationsAPI = {
  getOversight: (params) => api.get('/super-admin/reservations/oversight', { params }),
  getDetail: (id) => api.get(`/super-admin/reservations/detail/${id}`),
};

// ─── BAR POSTS ──────────────────────────────────────────────────────
export const barPostsAPI = {
  list: (params) => api.get('/super-admin/bar-posts', { params }),
  toggleStatus: (id) => api.post(`/super-admin/bar-posts/${id}/toggle-status`),
};

// ─── SOCIAL MODERATION ──────────────────────────────────────────────
export const socialAPI = {
  getPosts: (params) => api.get('/super-admin/social/posts', { params }),
  getPostComments: (postId) => api.get(`/super-admin/social/posts/${postId}/comments`),
  updatePostStatus: (postId, data) => api.patch(`/super-admin/social/posts/${postId}`, data),
  deleteComment: (commentId) => api.delete(`/super-admin/social/comments/${commentId}`),
  getCommentReports: (params) => api.get('/super-admin/social/comment-reports', { params }),
  updateCommentReport: (reportId, data) => api.patch(`/super-admin/social/comment-reports/${reportId}`, data),
  getEventComments: (params) => api.get('/super-admin/social/event-comments', { params }),
  getEventCommentsByEvent: (eventId) => api.get(`/super-admin/social/events/${eventId}/comments`),
  updateEventCommentStatus: (commentId, data) => api.patch(`/super-admin/social/event-comments/${commentId}`, data),
  getEvents: (params) => api.get('/super-admin/social/events', { params }),
  updateEventStatus: (eventId, data) => api.patch(`/super-admin/social/events/${eventId}`, data),
};

// ─── PLATFORM FEEDBACK ──────────────────────────────────────────────
export const feedbackAPI = {
  getAll: (params) => api.get('/platform-feedback/admin/all', { params }),
  updateStatus: (id, data) => api.patch(`/platform-feedback/admin/${id}/status`, data),
  reply: (id, data) => api.patch(`/platform-feedback/admin/${id}/reply`, data),
  getStats: () => api.get('/platform-feedback/stats'),
};
