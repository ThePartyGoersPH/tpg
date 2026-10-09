import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { useAuthStore } from './stores/authStore'

// Resolve the saved session exactly once per page load, before first
// paint. Module scope (not an effect) so StrictMode can't double-run it;
// the store itself single-flights as a second guard.
useAuthStore.getState().initialize()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
