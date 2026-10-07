import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.thepartygoers.fun';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export function getUploadUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}/${String(path).replace(/^\//, '')}`;
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const selectedBarId = localStorage.getItem('pos_selected_bar_id');
  if (selectedBarId) {
    config.headers['X-Bar-Id'] = selectedBarId;
  }
  return config;
});

export default apiClient;
