import apiClient from './apiClient';

export const leaveApi = {
  apply: (data) =>
    apiClient.post('/api/leaves', data),

  myLeaves: () =>
    apiClient.get('/api/leaves/my'),

  list: (params) =>
    apiClient.get('/api/leaves', { params }),

  decide: (id, action) =>
    apiClient.patch(`/api/leaves/${id}/decision`, { action }),

  getBalance: (params) =>
    apiClient.get('/api/leave-balance', { params }),

  balanceEmployees: () =>
    apiClient.get('/api/leave-balance/employees'),

  conversions: (params) =>
    apiClient.get('/api/leave-balance/conversions', { params }),

  createConversion: (data) =>
    apiClient.post('/api/leave-balance/conversions', data),

  decideConversion: (id, action) =>
    apiClient.patch(`/api/leave-balance/conversions/${id}/decision`, { action }),

  conversionSettings: () =>
    apiClient.get('/api/leave-balance/settings'),

  saveConversionSettings: (data) =>
    apiClient.put('/api/leave-balance/settings', data),
};
