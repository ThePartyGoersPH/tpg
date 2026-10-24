import { reservationApi } from '../api/reservationApi';

export const reservationService = {
  async create(payload) {
    const response = await reservationApi.create(payload);
    return response.data;
  },

  async myReservations() {
    const response = await reservationApi.myReservations();
    return response.data?.data || [];
  },

  async myReservationById(reservationId) {
    const response = await reservationApi.myReservationById(reservationId);
    return response.data?.data || null;
  },

  async myReviews() {
    const response = await reservationApi.myReviews();
    return response.data?.data || [];
  },

  async submitReview(reservationId, payload) {
    const response = await reservationApi.submitReview(reservationId, payload);
    return response.data;
  },

  async cancel(reservationId) {
    const response = await reservationApi.cancel(reservationId);
    return response.data;
  },

  async recheckPayment(reservationId) {
    const response = await reservationApi.recheckPayment(reservationId);
    return response.data;
  },

  async checkIn(reservationId) {
    const response = await reservationApi.checkIn(reservationId);
    return response.data;
  },
};
