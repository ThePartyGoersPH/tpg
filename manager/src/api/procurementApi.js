import apiClient from './apiClient';

// Procurement module
export const procurementApi = {
  listSuppliers: () => apiClient.get('/procurement/suppliers'),
  createSupplier: (data) => apiClient.post('/procurement/suppliers', data),
  updateSupplier: (id, data) => apiClient.put(`/procurement/suppliers/${id}`, data),
  deleteSupplier: (id) => apiClient.delete(`/procurement/suppliers/${id}`),

  listPOs: () => apiClient.get('/procurement/purchase-orders'),
  createPO: (data) => apiClient.post('/procurement/purchase-orders', data),
  getPO: (id) => apiClient.get(`/procurement/purchase-orders/${id}`),
  approvePO: (id) => apiClient.post(`/procurement/purchase-orders/${id}/approve`),
  rejectPO: (id, reason) => apiClient.post(`/procurement/purchase-orders/${id}/reject`, { reason }),
  notifyPO: (id) => apiClient.post(`/procurement/purchase-orders/${id}/notify`),

  // Source inventory requests for the "Add to Procurement" pre-fill
  getRequests: (ids) => apiClient.get('/procurement/requests', { params: { ids: ids.join(',') } }),

  getSettings: () => apiClient.get('/procurement/settings'),
  updateSettings: (data) => apiClient.put('/procurement/settings', data),
};

export default procurementApi;
