import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const SKIP_LOGOUT_URLS = ['/payments/', '/payment-check/'];

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const skipLogout = SKIP_LOGOUT_URLS.some((path) => url.includes(path));
    const hasToken = !!localStorage.getItem('token');
    if (error.response?.status === 401 && !skipLogout && hasToken && typeof onUnauthorized === 'function') {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
