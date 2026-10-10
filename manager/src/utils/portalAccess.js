// Mirror of thesis-backend/config/portalAccess.js — the single source of
// truth lives in the backend; keep these role lists in sync with it.
// No role may access another portal's routes.
const norm = (r) => String(r || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

export const ADMIN_PORTAL_ROLES = ['super_admin', 'admin'];
export const MANAGER_PORTAL_ROLES = [
  'bar_owner', 'manager', 'staff', 'employee', 'cashier', 'hr', 'finance',
  'crm', 'executive', 'operations', 'procurement', 'supply_chain',
];
export const CUSTOMER_PORTAL_ROLES = ['customer'];

export function homeForRole(role) {
  const r = norm(role);
  if (ADMIN_PORTAL_ROLES.includes(r)) return '/admin';
  if (MANAGER_PORTAL_ROLES.includes(r)) return '/manager';
  return '/';
}

// Cross-portal redirects leave this app's subpath, so build an absolute URL.
// Production: same domain, different subpath (/admin, /manager, /).
// Local dev: each app is a separate origin (plain localhost:PORT, no
// subpath), so map to the dev ports instead — otherwise the redirect lands
// on a subpath the dev server does not serve.
const DEV_PORTS = { admin: '5175', manager: '5174', customer: '5173', pos: '4173' };

export function absoluteHomeForRole(role) {
  const path = homeForRole(role);
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    const key = path === '/admin' ? 'admin' : path === '/manager' ? 'manager' : 'customer';
    return `http://${host}:${DEV_PORTS[key] || DEV_PORTS.customer}/`;
  }
  return `${window.location.origin}${path}`;
}

export function roleAllowed(roles, role) {
  return roles.map(norm).includes(norm(role));
}
