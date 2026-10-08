import apiClient from './apiClient';

export const inventoryApi = {
  list: () =>
    apiClient.get('/owner/inventory'),

  create: (data) =>
    apiClient.post('/owner/inventory', data),

  update: (id, data) =>
    apiClient.patch(`/owner/inventory/${id}`, data),

  uploadImage: (id, formData) =>
    apiClient.post(`/owner/inventory/${id}/image`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  deactivate: (id) =>
    apiClient.delete(`/owner/inventory/${id}`),

  recordSale: (data) =>
    apiClient.post('/owner/sales', data),

  listSales: (params) =>
    apiClient.get('/owner/sales', { params }),

  salesSummary: () =>
    apiClient.get('/owner/bar/sales/summary'),

  listNearExpiry: () =>
    apiClient.get('/inventory/near-expiry'),

  listSpoiled: () =>
    apiClient.get('/inventory/spoiled'),

  markWasted: (data) =>
    apiClient.post('/inventory/mark-wasted', data),

  getWastageSummary: () =>
    apiClient.get('/inventory/wastage-summary'),
};
