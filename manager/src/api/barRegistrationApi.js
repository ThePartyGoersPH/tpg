import apiClient from './apiClient';

// Bar Registration & Verification (Compliance Module)
export const barRegistrationApi = {
  submit: (formData) =>
    apiClient.post('/bar-registration/submit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  my: () => apiClient.get('/bar-registration/my'),
  current: (config) => apiClient.get('/bar-registration/current', config),
  pending: () => apiClient.get('/bar-registration/pending'),
  detail: (id) => apiClient.get(`/bar-registration/${id}`),
  autoVerify: (id) => apiClient.post(`/bar-registration/${id}/auto-verify`),
  autoVerifyDoc: (id, docType) =>
    apiClient.post(`/bar-registration/${id}/documents/${docType}/auto-verify`),
  review: (id, payload) => apiClient.post(`/bar-registration/${id}/review`, payload),
  getConfig: () => apiClient.get('/bar-registration/config/verification'),
  updateConfig: (payload) => apiClient.post('/bar-registration/config/verification', payload),
};

export default barRegistrationApi;
