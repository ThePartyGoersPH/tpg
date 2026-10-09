import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../api/services';

// Module-level single-flight guard: initialize() runs once per page load,
// even under React StrictMode's double-effect invocation.
let initializePromise = null;

function readStoredSession() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    let user = null;
    try {
      const raw = localStorage.getItem('user');
      user = raw ? JSON.parse(raw) : null;
    } catch {
      user = null;
    }
    return { token, user };
  } catch {
    return null;
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {
    // storage unavailable — in-memory state is still cleared below
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      // 'loading' until initialize() resolves. Never persisted — every fresh
      // page load starts here so guards never see a false "logged out".
      status: 'loading',

      login: (user, token) => {
        try {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
        } catch {
          // private mode etc. — session lasts for this tab only
        }
        set({ user, token, isAuthenticated: true, status: 'authenticated' });
      },

      logout: () => {
        clearStoredSession();
        set({ user: null, token: null, isAuthenticated: false, status: 'unauthenticated' });
      },

      updateUser: (userData) => {
        set((state) => {
          const updatedUser = { ...state.user, ...userData };
          try {
            localStorage.setItem('user', JSON.stringify(updatedUser));
          } catch {
            // ignore
          }
          return { user: updatedUser };
        });
      },

      // Runs once per page load (call it from main.jsx, NOT from effects).
      // Resolves the stored token against the server exactly one time.
      initialize: () => {
        if (initializePromise) return initializePromise;
        initializePromise = (async () => {
          const stored = readStoredSession();
          if (!stored) {
            set({ user: null, token: null, isAuthenticated: false, status: 'unauthenticated' });
            return;
          }
          try {
            const res = await authAPI.me();
            if (res.data?.success) {
              const me = res.data.data || {};
              set((state) => {
                const user = { ...(state.user || {}), ...me };
                try {
                  localStorage.setItem('token', stored.token);
                  localStorage.setItem('user', JSON.stringify(user));
                } catch {
                  // ignore
                }
                return { user, token: stored.token, isAuthenticated: true, status: 'authenticated' };
              });
              return;
            }
            throw new Error('invalid session');
          } catch (err) {
            if (!err?.response) {
              // Transient network failure (server down, offline): do NOT log
              // out. Trust the stored session; API calls will re-validate.
              const user = stored.user || get().user;
              if (!user) {
                clearStoredSession();
                set({ user: null, token: null, isAuthenticated: false, status: 'unauthenticated' });
                return;
              }
              set({ user, token: stored.token, isAuthenticated: true, status: 'authenticated' });
              return;
            }
            // Real rejection (401/403): session is dead.
            clearStoredSession();
            set({ user: null, token: null, isAuthenticated: false, status: 'unauthenticated' });
          }
        })();
        return initializePromise;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
