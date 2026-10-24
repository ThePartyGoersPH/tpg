import apiClient from './apiClient';

export const dssApi = {
  // DIKW tiers
  data: () => apiClient.get('/owner/dss/data', { silentError: true }),
  information: () => apiClient.get('/owner/dss/information', { silentError: true }),
  knowledge: () => apiClient.get('/owner/dss/knowledge', { silentError: true }),
  wisdom: () => apiClient.get('/owner/dss/wisdom', { silentError: true }),
  recommendations: (force = false) =>
    apiClient.get('/owner/dss/recommendations', { params: { force: force ? 1 : 0 }, silentError: true }),
};
