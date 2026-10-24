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
