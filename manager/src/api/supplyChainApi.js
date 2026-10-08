import apiClient from './apiClient';

// Supply Chain module
export const supplyChainApi = {
  listReceivablePOs: () => apiClient.get('/supply-chain/purchase-orders'),
  getPO: (id) => apiClient.get(`/supply-chain/purchase-orders/${id}`),
  receive: (id, data) => apiClient.post(`/supply-chain/purchase-orders/${id}/receive`, data),

  listGRN: () => apiClient.get('/supply-chain/goods-received'),
  getGRN: (id) => apiClient.get(`/supply-chain/goods-received/${id}`),
};

export default supplyChainApi;
