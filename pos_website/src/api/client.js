import axios from 'axios';

// Production: the site and the API share one domain, with nginx proxying
// the /api/ prefix to the backend (prefix stripped). Local dev talks to
// the backend directly at its root.
function resolveApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:3000';
    return `${origin}/api`;
  }
  return 'https://thepartygoers.partygoers.online/api';
}

const API_BASE_URL = resolveApiBaseUrl();

export { API_BASE_URL };

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
