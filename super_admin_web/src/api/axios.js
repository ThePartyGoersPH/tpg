import axios from 'axios';
import toast from 'react-hot-toast';
import { withBase } from '../utils/basePath';

// Production: the site and the API share one domain, with nginx proxying
// the /api/ prefix to the backend (prefix stripped). Local dev talks to
// the backend directly at its root.
function resolveApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
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

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== withBase('/login')) {
        window.location.href = withBase('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
