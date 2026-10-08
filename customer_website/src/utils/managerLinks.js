// Base URL of the Bar Management portal (separate SPA). Used so a bar
// owner/manager previewing their public page can jump straight into the
// existing add-product / add-table / payment-setup screens instead of the
// customer app duplicating those forms.
export function managerPortalUrl(path = '') {
  const base = (
    import.meta.env.VITE_MANAGER_URL
    || (import.meta.env.DEV ? 'http://localhost:5174' : window.location.origin)
  ).replace(/\/+$/, '');
  const suffix = String(path || '');
  if (!suffix) return base;
  return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}
