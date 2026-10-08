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
