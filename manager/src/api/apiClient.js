import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.thepartygoers.fun';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Multi-branch: inject selected bar_id for data scoping
    const selectedBarId = localStorage.getItem('selectedBarId');
    if (selectedBarId) {
      config.headers['X-Bar-Id'] = selectedBarId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// React.StrictMode double-invokes effects, so a background GET that fails fires
// twice and would otherwise stack two identical toasts. Collapse repeats of the
// same message within a short window into one.
const recentToasts = new Map();
const TOAST_DEDUPE_MS = 2000;

function toastOnce(message) {
  const now = Date.now();
  for (const [key, at] of recentToasts) {
    if (now - at > TOAST_DEDUPE_MS) recentToasts.delete(key);
  }
  if (recentToasts.has(message)) return;
  recentToasts.set(message, now);
  toast.error(message);
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred';
    const status = error.response?.status;
    const silentError = Boolean(error.config?.silentError);

    if (status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (status === 402) {
      // Subscription plan limit reached — show server message
      toastOnce(message);
    } else if (!silentError && status === 403) {
      // Only surface the alarming permission toast for explicit user actions
      // (mutations like Save). Background/auto GET 403s are silenced so pages
      // can degrade gracefully (hide/disable that section) without alarming the user.
      const method = (error.config?.method || 'get').toLowerCase();
      if (method !== 'get') {
        toastOnce('You do not have permission to perform this action.');
      }
    } else if (!silentError && status !== 409) {
      toastOnce(message);
    }

    return Promise.reject(error);
  }
);

export const getUploadUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}/${path.replace(/^\//, '')}`;
};

export default apiClient;
