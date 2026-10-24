import apiClient from './apiClient';

export const auditApi = {
  list: (params) =>
    apiClient.get('/hr/audit-logs', { params }),
};
