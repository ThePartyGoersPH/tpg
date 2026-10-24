export const CUSTOMER_ROLE = 'customer';
export const CUSTOMER_ROLE_BLOCK_MESSAGE = 'You do not have permission to use the customer website.';

// Roles allowed to hold a customer-website session. Bar owners and managers
// can sign in to preview their own public bar page (and add products/tables)
// before their payment setup is finished.
export const CUSTOMER_PORTAL_ROLES = [CUSTOMER_ROLE, 'bar_owner', 'manager'];

export function isCustomerPortalUser(user) {
  const raw = String(user?.role || user?.role_name || '').trim().toLowerCase().replace(/\s+/g, '_');
  return CUSTOMER_PORTAL_ROLES.includes(raw);
}

/**
 * True when a signed-in user object explicitly reports an unverified email:
 * `isVerified === false`, `email_verified === false`, `is_verified` falsy,
 * or `verified === 'UNVERIFIED'`.
 * Missing flags mean "unknown", not "unverified", so this never nags by
 * default — callers render the reminder only on an explicit negative signal.
 */
export function isEmailUnverified(user) {
  if (!user || typeof user !== 'object') return false;

  if (user.isVerified === false) return true;
  if (user.email_verified === false) return true;
  if (user.is_verified === false || user.is_verified === 0) return true;
  if (String(user.verified || '').trim().toUpperCase() === 'UNVERIFIED') return true;

  return false;
}

// Roles that may see the owner/manager management view on a bar profile.
export const BAR_OWNER_PREVIEW_ROLES = ['bar_owner', 'manager'];

export const RESERVATION_STATUS_COLORS = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
};

export const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';
