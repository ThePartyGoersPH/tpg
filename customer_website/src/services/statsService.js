import apiClient from '../api/client';

export const statsService = {
  getPlatformStats: async () => {
    const response = await apiClient.get('/stats/platform');
    return response.data.data;
  },
};
