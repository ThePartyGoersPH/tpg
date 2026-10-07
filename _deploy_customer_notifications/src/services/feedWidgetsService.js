import { feedWidgetsApi } from '../api/feedWidgetsApi';

export const feedWidgetsService = {
  async getActiveBars(hours = 48) {
    const response = await feedWidgetsApi.activeBars(hours);
    return response.data?.data || [];
  },

  async getQuickStats() {
    const response = await feedWidgetsApi.quickStats();
    return response.data?.data || {};
  },

  async getHotTonight() {
    const response = await feedWidgetsApi.hotTonight();
    return response.data?.data || [];
  },

  async getGenreTags() {
    const response = await feedWidgetsApi.genreTags();
    return response.data?.data || [];
  },

  async getBarCities() {
    const response = await feedWidgetsApi.barCities();
    return response.data?.data || [];
  },
};
