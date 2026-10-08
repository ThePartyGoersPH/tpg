import { orderApi } from '../api/orderApi';

export const orderService = {
  async getTaxConfig(barId) {
    const res = await orderApi.getTaxConfig(barId);
    return res.data?.data;
  },

  async createOrder(payload) {
    const res = await orderApi.create(payload);
    return res.data;
  },

  async myOrders(params = {}) {
    const res = await orderApi.myOrders(params);
    return res.data?.data || [];
  },

  async getReceipt(orderId) {
    const res = await orderApi.receipt(orderId);
    return res.data?.data;
  },

  async salesReport(params = {}) {
    const res = await orderApi.salesReport(params);
    return res.data?.data;
  },
};
