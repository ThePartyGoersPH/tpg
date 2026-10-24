// Supplier self-registration guard (browser mirror of backend
// utils/supplierValidation.js). Best-effort pre-check only — the server
// re-validates authoritatively on create/update.

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length >= 7 ? digits.slice(-10) : digits;
}

export function normalizeName(value) {
  const t = String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return t.length >= 3 ? t : '';
}

/**
 * Check supplier details against a roster of own accounts.
 * accounts: [{ first_name, last_name, email, phone_number, role }]
 * candidate: { email, phone, names: [] }
 * Returns { field: 'email'|'phone'|'name' } or null.
 */
export function checkOwnAccountConflict(accounts, candidate = {}) {
  const email = normalizeEmail(candidate.email);
  const phone = normalizePhone(candidate.phone);
  const names = [...new Set(
    (Array.isArray(candidate.names) ? candidate.names : [])
      .map(normalizeName)
      .filter(Boolean)
  )];
  if (!email && !phone && !names.length) return null;
  for (const a of accounts || []) {
    if (email && normalizeEmail(a.email) === email) return { field: 'email' };
    const ap = normalizePhone(a.phone_number || a.phone);
    if (phone && ap && ap === phone) return { field: 'phone' };
    const an = normalizeName(`${a.first_name || ''} ${a.last_name || ''}`);
    if (an && names.includes(an)) return { field: 'name' };
  }
  return null;
}

export const SELF_SUPPLIER_MESSAGE =
  "You can't register yourself or your own staff as a supplier. Please use the external supplier's details.";
