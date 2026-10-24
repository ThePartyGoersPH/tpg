import { orderApi } from '../api/orderApi';

export const orderService = {
  async getTaxConfig(barId) {
    const { data } = await orderApi.getTaxConfig(barId);
    return data.data || data;
  },

  async createOrder(payload) {
    const { data } = await orderApi.createOrder(payload);
    return data;
  },

  async myOrders(params) {
    const { data } = await orderApi.myOrders(params);
    return data.data || data;
  },

  async getReceipt(orderId) {
    const { data } = await orderApi.getReceipt(orderId);
    return data.data || data;
  },

  async salesReport(params) {
    const { data } = await orderApi.salesReport(params);
    return data.data || data;
  },
};
