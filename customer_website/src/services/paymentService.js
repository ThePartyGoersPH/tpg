import { paymentApi } from '../api/paymentApi';

export const paymentService = {
  async createPayment(payload) {
    const response = await paymentApi.create(payload);
    return response.data;
  },

  async getPaymentByReference(referenceId) {
    const response = await paymentApi.getByReference(referenceId);
    return response.data?.data;
  },

  async confirmPaymentByReference(referenceId) {
    const response = await paymentApi.confirmByReference(referenceId);
    return response.data?.data || null;
  },

  async cancelPaymentByReference(referenceId) {
    const response = await paymentApi.cancelByReference(referenceId);
    return response.data?.data || null;
  },

  async myHistory(params = {}) {
    const response = await paymentApi.myHistory(params);
    return response.data?.data || [];
  },
};
