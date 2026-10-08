import apiClient from './apiClient';

export const reviewApi = {
  list: () =>
    apiClient.get('/owner-reviews'),

  getDetail: (id) =>
    apiClient.get(`/owner-reviews/${id}`),

  respond: (id, response) =>
    apiClient.post(`/owner-reviews/${id}/respond`, { response }),

  stats: () =>
    apiClient.get('/owner-reviews/stats/summary'),
};
