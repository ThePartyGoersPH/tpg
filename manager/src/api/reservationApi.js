import apiClient from './apiClient';

export const reservationApi = {
  list: (params) =>
    apiClient.get('/owner/reservations', { params }),

  approve: (id) =>
    apiClient.patch(`/owner/reservations/${id}/status`, { action: 'approve' }),

  reject: (id) =>
    apiClient.patch(`/owner/reservations/${id}/status`, { action: 'reject' }),

  cancel: (id) =>
    apiClient.patch(`/owner/reservations/${id}/status`, { action: 'cancel' }),

  checkIn: (id) =>
    apiClient.patch(`/owner/reservations/${id}/status`, { action: 'check_in' }),

  complete: (id) =>
    apiClient.patch(`/owner/reservations/${id}/status`, { action: 'complete' }),

  noShow: (id) =>
    apiClient.patch(`/owner/reservations/${id}/status`, { action: 'no_show' }),

  lookup: (txn, config) =>
    apiClient.get(`/reservations/lookup/${encodeURIComponent(txn)}`, config),

  markBalancePaid: (id) =>
    apiClient.patch(`/owner/reservations/${id}/mark-balance-paid`),

  qrCheckIn: (transactionNumber) =>
    apiClient.post('/owner/reservations/qr-checkin', { transaction_number: transactionNumber }, { silentError: true }),
};
