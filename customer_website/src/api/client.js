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
let onForbiddenUnverified = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// Fires when a signed-in but unverified customer attempts a state-changing
// request: the backend answers 403 EMAIL_NOT_VERIFIED while safe reads keep
// working. The app uses it to route them to the code entry screen instead of
// leaving a bare error on screen.
export function setForbiddenUnverifiedHandler(handler) {
  onForbiddenUnverified = handler;
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
    const method = String(error.config?.method || 'get').toUpperCase();
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === 'EMAIL_NOT_VERIFIED' &&
      method !== 'GET' &&
      hasToken &&
      typeof onForbiddenUnverified === 'function'
    ) {
      onForbiddenUnverified(error.response.data);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
