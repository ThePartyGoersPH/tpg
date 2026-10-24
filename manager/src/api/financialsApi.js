import apiClient from './apiClient';

export const financialsApi = {
  // Auto-payout computation
  getAutoPayout: (params) =>
    apiClient.get('/owner/financials/auto-payout', { params }),

  // Cashflow dashboard
  getCashflow: (params) =>
    apiClient.get('/owner/financials/cashflow', { params }),

  // Financial trends
  getTrends: (params) =>
    apiClient.get('/owner/financials/trends', { params }),

  // Payouts list + summary
  getPayouts: (params) =>
    apiClient.get('/owner/financials/payouts', { params }),
};
