import apiClient from './apiClient';

export const customerApi = {
  list: () =>
    apiClient.get('/owner/bar/customers'),

  ban: (id) =>
    apiClient.post(`/owner/bar/customers/${id}/ban`),

  unban: (id) =>
    apiClient.delete(`/owner/bar/customers/${id}/ban`),
};
