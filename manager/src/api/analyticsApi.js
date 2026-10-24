import apiClient from './apiClient';

export const analyticsApi = {
  dashboard: () =>
    apiClient.get('/analytics/dashboard', { silentError: true }),

  visits: () =>
    apiClient.get('/analytics/visits', { silentError: true }),

  reviews: () =>
    apiClient.get('/analytics/reviews', { silentError: true }),

  followers: () =>
    apiClient.get('/analytics/followers', { silentError: true }),
};
