import apiClient from './apiClient';

// HR <-> Finance Payroll Bridge
export const payrollFinanceApi = {
  listRuns: () => apiClient.get('/payroll-finance/runs'),
  getRun: (id) => apiClient.get(`/payroll-finance/runs/${id}`),
  approve: (id) => apiClient.post(`/payroll-finance/runs/${id}/approve`),
  reject: (id, notes) => apiClient.post(`/payroll-finance/runs/${id}/reject`, { notes }),
  summary: () => apiClient.get('/payroll-finance/bridge-summary'),
  listPOs: () => apiClient.get('/payroll-finance/purchase-orders'),
};

export default payrollFinanceApi;
