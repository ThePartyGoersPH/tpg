import { VIEWS } from '../contexts/ViewContext';

// Views with no bar context that only make sense for real customers.
// Staff keep these tabs (they can book at OTHER bars); owners do not.
const CUSTOMER_ONLY_VIEWS = [VIEWS.RESERVATIONS, VIEWS.PAYMENTS];

// Roles treated as bar-attached workers (own-bar restriction applies).
const WORKER_ROLES = ['staff', 'manager', 'employee', 'cashier', 'hr', 'finance'];

export function getRoleKey(user) {
  return String(user?.role || user?.role_name || '').trim().toLowerCase();
}

export function isBarOwner(user) {
  return getRoleKey(user) === 'bar_owner';
}

export function isWorker(user) {
  return WORKER_ROLES.includes(getRoleKey(user));
}

export function isCustomer(user) {
  const role = getRoleKey(user);
  return role === '' || role === 'customer';
}

// Every bar id this user is attached to (single bar_id today; array fields
// supported if the API ever returns them). Numbers only, deduped.
export function userBarIds(user) {
  if (!user) return [];
  const raw = [
    user.bar_id,
    ...(Array.isArray(user.bar_ids) ? user.bar_ids : []),
    ...(Array.isArray(user.assigned_bar_ids) ? user.assigned_bar_ids : []),
    user.assigned_bar_id,
  ];
  const ids = raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(ids)];
}

function barIdOf(bar) {
  const n = Number(bar?.id ?? bar?.bar_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Core rule: can this user order/book/pay AT THIS bar?
// - bar owners: never (any bar)
// - workers: everywhere EXCEPT their attached bar(s)
// - customers (or unknown role): everywhere
// - any other non-customer role (super_admin, admin): never (preview-only)
export function canOrderAtBar(user, bar) {
  if (!user) return true;
  const role = getRoleKey(user);
  if (role === '' || role === 'customer') return true;
  if (role === 'bar_owner') return false;
  if (WORKER_ROLES.includes(role)) {
    const id = barIdOf(bar);
    if (id === null) return true;
    return !userBarIds(user).includes(id);
  }
  return false;
}

// Bar the person owns or works at (for hiding Follow + similar chrome).
// Owners: their own bar (plus its branches via parent_bar_id). Workers:
// any attached bar. Everyone else: never.
export function isOwnOrWorkBar(user, bar) {
  if (!user || !bar) return false;
  const role = getRoleKey(user);
  const id = barIdOf(bar);
  if (id === null) return false;
  const mine = userBarIds(user);
  if (role === 'bar_owner') {
    if (mine.includes(id)) return true;
    const parent = Number(bar?.parent_bar_id);
    return Number.isFinite(parent) && parent > 0 && mine.includes(parent);
  }
  if (WORKER_ROLES.includes(role)) return mine.includes(id);
  return false;
}

export function readOnlyReason(user, bar) {
  if (canOrderAtBar(user, bar)) return null;
  const role = getRoleKey(user);
  if (role === 'bar_owner') return 'owner';
  if (WORKER_ROLES.includes(role)) return 'own-bar';
  return 'preview';
}

export function readOnlyMessage(user, bar) {
  const reason = readOnlyReason(user, bar);
  if (reason === 'owner') return '👁 Owner Preview: ordering and booking are disabled for owner accounts.';
  if (reason === 'own-bar') return '👁 You work at this bar: ordering is disabled here.';
  if (reason === 'preview') return '👁 View-only mode: ordering is disabled.';
  return null;
}

// Sidebar/tabs have no bar context: owners (and other non-customer,
// non-worker roles) lose Reservations + Payments; staff keep the full menu.
export function hideCustomerTabs(user) {
  const role = getRoleKey(user);
  if (role === '' || role === 'customer') return false;
  if (WORKER_ROLES.includes(role)) return false;
  return true;
}

export function isCustomerOnlyView(view) {
  return CUSTOMER_ONLY_VIEWS.includes(view);
}

export function filterNavItems(items, user) {
  if (!hideCustomerTabs(user)) return items;
  return items.filter((item) => !isCustomerOnlyView(item.view));
}

// Backwards-compatible alias: previously true for every non-customer role.
// Now only true for roles that lose the customer tabs (owners, super admins).
export function isOwnerPreview(user) {
  return hideCustomerTabs(user);
}
