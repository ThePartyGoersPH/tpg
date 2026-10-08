// Google Identity Services (GIS) credential flow — single source of truth.
//
// NOTE: this flow uses NO redirect URIs. Google authorizes the page by its
// *origin* (Authorized JavaScript origins in Cloud Console). If sign-in fails
// with "Error 400: invalid_request" or "Access blocked", the current origin
// (window.location.origin) is almost certainly missing from that allowlist.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function isGoogleConfigured() {
  return GOOGLE_CLIENT_ID.trim().length > 0;
}

// Shown when Google reports a failure. onError carries no detail, so give
// the user (and support) the actionable checklist instead of a dead end.
export function googleSignInErrorText() {
  return (
    'Google sign-in failed. If this keeps happening, the site address ' +
    `(${window.location.origin}) may not be authorized yet — ` +
    'please try again in a few minutes or use email sign-in.'
  );
}
