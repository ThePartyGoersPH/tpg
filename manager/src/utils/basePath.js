// Helpers for running under a sub-path in production (e.g. /manager/).
// Vite bakes the `base` config into `import.meta.env.BASE_URL`
// ('/manager/' in prod builds, '/' in local dev), so raw
// window.location redirects must be prefixed to keep working.
export const BASE = import.meta.env.BASE_URL || '/';

export function withBase(path = '/') {
  const base = BASE.endsWith('/') ? BASE : `${BASE}/`;
  const clean = String(path).replace(/^\//, '');
  return `${base}${clean}`;
}
