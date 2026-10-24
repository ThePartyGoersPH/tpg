import apiClient from './client';

export const reservationApi = {
  create: (payload) => apiClient.post('/reservations', payload),
  myReservations: () => apiClient.get('/reservations/my'),
  cancel: (reservationId) => apiClient.patch(`/reservations/${reservationId}/cancel`),
  recheckPayment: (reservationId) => apiClient.post(`/reservations/${reservationId}/recheck-payment`),
  checkIn: (reservationId) => apiClient.post(`/reservations/${reservationId}/check-in`),
};
