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
  async (error) => {
    if (error.response?.status === 401) {
      // Hand session teardown to the store (single source of truth) instead
      // of wiping storage + hard-reloading here — that combination caused
      // full-page reload loops against the async persist rehydration.
      // The route guard reacts to the store change with ONE React-side
      // redirect to /login. Lazy import avoids a module cycle (the store
      // imports the api layer for its session check).
      try {
        const { useAuthStore } = await import('../stores/authStore');
        useAuthStore.getState().logout();
      } catch {
        // store unavailable — fall through; caller still gets the rejection
      }
    }
    return Promise.reject(error);
  }
);

export default api;
