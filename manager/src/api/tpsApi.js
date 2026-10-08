import apiClient from './apiClient';

// Transaction Processing System (TPS)
export const tpsApi = {
  listTransactions: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/tps/transactions${qs ? `?${qs}` : ''}`);
  },
  recordTransaction: (payload) => apiClient.post('/tps/transactions', payload),
  getWastage: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/tps/wastage${qs ? `?${qs}` : ''}`);
  },
  recordWastage: (payload) => apiClient.post('/tps/wastage', payload),
  getSummary: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.get(`/tps/summary${qs ? `?${qs}` : ''}`);
  },
};

export default tpsApi;
