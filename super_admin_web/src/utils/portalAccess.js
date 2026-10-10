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

// Cross-portal redirects leave this app's subpath, so build an absolute URL
// from the current origin (same domain, different subpath in every env).
export function absoluteHomeForRole(role) {
  return `${window.location.origin}${homeForRole(role)}`;
}

export function roleAllowed(roles, role) {
  return roles.map(norm).includes(norm(role));
}
