import { barApi } from '../api/barApi';

export const barService = {
  async list(params = {}) {
    const response = await barApi.list(params);
    return response.data?.data || [];
  },

  async trending(limit = 12) {
    const response = await barApi.trending(limit);
    return response.data?.data || [];
  },

  async detail(barId) {
    const response = await barApi.detail(barId);
    return response.data?.data;
  },

  async menu(barId) {
    const response = await barApi.menu(barId);
    return response.data?.data || [];
  },

  async menuWithBestSellers(barId) {
    const response = await barApi.menuWithBestSellers(barId);
    return response.data?.data || [];
  },

  async events(barId) {
    const response = await barApi.events(barId);
    return response.data?.data || [];
  },

  async tables(barId) {
    const response = await barApi.tables(barId);
    return response.data?.data || [];
  },

  async availableTables(barId, params) {
    const response = await barApi.availableTables(barId, params);
    return response.data?.data || [];
  },

  async reviews(barId) {
    const response = await barApi.reviews(barId);
    return response.data?.data;
  },

  async myReview(barId) {
    const response = await barApi.myReview(barId);
    return response.data?.data;
  },

  async reviewEligibility(barId) {
    const response = await barApi.reviewEligibility(barId);
    return response.data?.data;
  },

  async submitReview(barId, payload) {
    const response = await barApi.submitReview(barId, payload);
    return response.data;
  },

  async deleteReview(barId) {
    const response = await barApi.deleteReview(barId);
    return response.data;
  },

  async videos(barId) {
    const response = await barApi.videos(barId);
    return response.data?.data || [];
  },
};
