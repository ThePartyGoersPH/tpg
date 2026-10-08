import { createContext, useCallback, useMemo, useState } from 'react';

export const ViewContext = createContext(null);

export const VIEWS = {
  LANDING: 'landing',
  LOGIN: 'login',
  REGISTER: 'register',
  HOME: 'home',
  BARS: 'bars',
  BAR_DETAIL: 'bar_detail',
  MAP: 'map',
  EVENTS: 'events',
  RESERVATIONS: 'reservations',
  PAYMENTS: 'payments',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  NOTIFICATIONS: 'notifications',
  PROFILE: 'profile',
  VERIFY_EMAIL: 'verify_email',
  RESET_PASSWORD: 'reset_password',
};

const NO_PERSIST = [VIEWS.PAYMENT_SUCCESS, VIEWS.PAYMENT_FAILED, VIEWS.LANDING, VIEWS.LOGIN, VIEWS.REGISTER, VIEWS.RESET_PASSWORD];
const LAST_VIEW_STATE_KEY = 'lastViewState';

function readSavedViewState() {
  try {
    const raw = sessionStorage.getItem(LAST_VIEW_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.view || NO_PERSIST.includes(parsed.view)) return null;
    return {
      view: parsed.view,
      params: parsed.params && typeof parsed.params === 'object' ? parsed.params : {},
    };
  } catch (_) {
    return null;
  }
}

function saveViewState(view, params = {}) {
  if (NO_PERSIST.includes(view)) return;
  try {
    sessionStorage.setItem(LAST_VIEW_STATE_KEY, JSON.stringify({ view, params }));
  } catch (_) {
    // ignore persistence issues
  }
}

function detectInitialView() {
  const path = window.location.pathname;
  const search = window.location.search;
  const params = new URLSearchParams(search);
  const hasToken = Boolean(localStorage.getItem('token'));
  const saved = hasToken ? readSavedViewState() : null;

  if (path.startsWith('/payment/success')) {
    const ref = params.get('ref');
    const paymentSessionKey = ref ? `payment_success_${ref}` : null;
    const alreadyHandled = paymentSessionKey ? Boolean(sessionStorage.getItem(paymentSessionKey)) : false;
    
    // If no ref in URL or already handled, redirect away from success page
    if (!ref || alreadyHandled) {
      // Replace URL to prevent reload loop
      window.history.replaceState({}, '', '/');
      if (saved) return saved;
      if (hasToken) return { view: VIEWS.RESERVATIONS, params: {} };
      return { view: VIEWS.LANDING, params: {} };
    }
    
    return { view: VIEWS.PAYMENT_SUCCESS, params: { ref } };
  }

  if (path.startsWith('/payment/failed')) {
    const ref = params.get('ref');
    const paymentSessionKey = ref ? `payment_failed_${ref}` : null;
    const alreadyHandled = paymentSessionKey ? Boolean(sessionStorage.getItem(paymentSessionKey)) : false;
    
    // If no ref in URL or already handled, redirect away from failed page
    if (!ref || alreadyHandled) {
      window.history.replaceState({}, '', '/');
      if (saved) return saved;
      if (hasToken) return { view: VIEWS.RESERVATIONS, params: {} };
      return { view: VIEWS.LANDING, params: {} };
    }
    
    // Mark as handled immediately
    if (paymentSessionKey) {
      sessionStorage.setItem(paymentSessionKey, 'true');
    }
    
    return { view: VIEWS.PAYMENT_FAILED, params: { ref } };
  }

  if (path.startsWith('/login')) return { view: VIEWS.LOGIN, params: {} };
  if (path.startsWith('/register')) return { view: VIEWS.REGISTER, params: {} };
  if (path.startsWith('/map')) return { view: VIEWS.MAP, params: {} };
  if (path.startsWith('/verify-email')) {
    const token = params.get('token');
    return { view: VIEWS.VERIFY_EMAIL, params: { token } };
  }
  if (path.startsWith('/reset-password')) {
    const token = params.get('token');
    return { view: VIEWS.RESET_PASSWORD, params: { token } };
  }
  if (path.startsWith('/bars')) {
    const search = params.get('search') || params.get('q') || '';
    return { view: VIEWS.BARS, params: { search } };
  }

  // Deep-link: ?media=<id>&bar=<barId> opens BAR_DETAIL directly
  if (params.get('media')) {
    const mediaId = Number(params.get('media'));
    const barId = Number(params.get('bar'));
    const commentId = params.get('comment') ? Number(params.get('comment')) : null;
    if (mediaId > 0 && barId > 0) {
      return {
        view: VIEWS.BAR_DETAIL,
        params: {
          barId,
          openMediaId: mediaId,
          ...(commentId ? { highlightCommentId: commentId } : {}),
        },
      };
    }
  }

  if (hasToken) {
    if (saved) return saved;
    return { view: VIEWS.HOME, params: {} };
  }
  return { view: VIEWS.LANDING, params: {} };
}

const initial = detectInitialView();

export function ViewProvider({ children }) {
  const [currentView, setCurrentView] = useState(initial.view);
  const [viewParams, setViewParams] = useState(initial.params);
  const [viewHistory, setViewHistory] = useState([]);
  const [transitioning, setTransitioning] = useState(false);

  const navigate = useCallback((view, params = {}) => {
    saveViewState(view, params);
    setTransitioning(true);
    setViewHistory((prev) => [...prev.slice(-19), { view: currentView, params: viewParams }]);

    setTimeout(() => {
      setCurrentView(view);
      setViewParams(params);
      setTransitioning(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 150);
  }, [currentView, viewParams]);

  const goBack = useCallback(() => {
    if (!viewHistory.length) return;
    const last = viewHistory[viewHistory.length - 1];
    saveViewState(last.view, last.params);
    setTransitioning(true);
    setViewHistory((prev) => prev.slice(0, -1));

    setTimeout(() => {
      setCurrentView(last.view);
      setViewParams(last.params);
      setTransitioning(false);
    }, 150);
  }, [viewHistory]);

  const canGoBack = viewHistory.length > 0;

  const value = useMemo(
    () => ({
      currentView,
      viewParams,
      transitioning,
      canGoBack,
      navigate,
      goBack,
    }),
    [currentView, viewParams, transitioning, canGoBack, navigate, goBack]
  );

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}
