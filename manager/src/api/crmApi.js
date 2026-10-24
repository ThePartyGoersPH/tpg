import apiClient from './apiClient';

export const crmApi = {
  list: () => apiClient.get('/crm/customers', { silentError: true }),
  segments: () => apiClient.get('/crm/segments', { silentError: true }),
  loyalty: () => apiClient.get('/crm/loyalty', { silentError: true }),
  detail: (id) => apiClient.get(`/crm/customers/${id}`, { silentError: true }),
};
