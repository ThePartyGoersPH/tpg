import axios from 'axios';
import { absoluteHomeForRole } from '../utils/portalAccess';

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

function roleFromStoredToken() {
  try {
    const token = localStorage.getItem('pos_token');
    if (!token) return '';
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role || '';
  } catch {
    return '';
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Wrong-portal sessions are bounced to the role's own home. The backend
    // is the enforcer; this just saves the user from a dead screen.
    if (error.response?.status === 403 && error.response?.data?.code === 'FORBIDDEN_PORTAL') {
      const hasToken = !!localStorage.getItem('pos_token');
      if (hasToken) {
        window.location.href = absoluteHomeForRole(roleFromStoredToken());
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
