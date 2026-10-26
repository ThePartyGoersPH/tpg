import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import ErrorBoundary from './components/ErrorBoundary';

// ── DevTools security warning ──────────────────────────────────────────────
if (typeof window !== 'undefined') {
  // Global error capture — logs exact error to console for debugging
  window.addEventListener('error', (e) => {
    console.error('[GLOBAL ERROR]', e.message, '\n  at', e.filename, ':', e.lineno, ':', e.colno, '\n', e.error);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[UNHANDLED REJECTION]', e.reason);
  });

  console.log('%c⛔ STOP!', 'color:#CC0000;font-size:48px;font-weight:900;');
  console.log(
    '%cThis is a browser feature intended for developers. If someone told you to paste or type anything here, it is a scam and will give them access to your account.',
    'color:#fff;font-size:16px;background:#1a1a1a;padding:8px 12px;border-radius:4px;'
  );
  // Suppress all console output in production to avoid leaking info
  if (import.meta.env.PROD) {
    console.log = () => {};
    console.warn = () => {};
    console.debug = () => {};
    console.info = () => {};
  }
}

import '@fontsource/sora/400.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import '@fontsource/sora/800.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext';
import { ViewProvider } from './contexts/ViewContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './glass.css';
import './styles/enhancements.css';
import './styles/feedSidebar.css';

import { GOOGLE_CLIENT_ID } from './utils/googleAuth';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <React.StrictMode>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <ThemeProvider>
          <AuthProvider>
            <ViewProvider>
              <App />
            </ViewProvider>
          </AuthProvider>
        </ThemeProvider>
      </GoogleOAuthProvider>
    </React.StrictMode>
  </ErrorBoundary>
);
