import apiClient from '../api/client';

export const packageService = {
  getBarPackages: async (barId) => {
    const response = await apiClient.get(`/public/bars/${barId}/packages`);
    return response.data.data || [];
  },
};
