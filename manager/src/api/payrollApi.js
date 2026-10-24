import apiClient from './apiClient';

export const payrollApi = {
  preview: (params = {}) => {
    const previewParams = {
      from: params.from || params.period_start,
      to: params.to || params.period_end,
    };

    return apiClient.get('/hr/payroll/payroll', { params: previewParams });
  },

  createRun: (data) =>
    apiClient.post('/hr/payroll/run', data),

  listRuns: () =>
    apiClient.get('/hr/payroll/runs'),

  generateItems: (runId) =>
    apiClient.post(`/hr/payroll/runs/${runId}/generate`),

  getRunDetails: (runId) =>
    apiClient.get(`/hr/payroll/runs/${runId}/items`),

  getRunReport: (runId) =>
    apiClient.get(`/hr/payroll/runs/${runId}/report`),

  finalizeRun: (runId) =>
    apiClient.patch(`/hr/payroll/runs/${runId}/finalize`),

  cancelRun: (runId) =>
    apiClient.delete(`/hr/payroll/runs/${runId}`),

  myPayroll: () =>
    apiClient.get('/hr/payroll/my-payroll'),
};
