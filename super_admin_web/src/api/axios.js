import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.thepartygoers.fun';

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
      // Basename-aware: never leave the portal root, and never redirect for
      // auth-endpoint failures (a failed login must stay on the page).
      const base = import.meta.env.BASE_URL || '/';
      const appRoot = base === '/' ? '' : base.replace(/\/$/, '');
      const onLoginPage = window.location.pathname.endsWith('/login');
      const isAuthCall = String(error.config?.url || '').includes('/auth/');
      if (!onLoginPage && !isAuthCall) {
        window.location.href = `${appRoot}/login`;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
