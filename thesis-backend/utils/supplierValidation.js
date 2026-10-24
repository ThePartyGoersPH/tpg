// Supplier self-registration guard: a supplier must be an external party,
// never the bar's own owner/staff/manager/finance account. Pure helpers +
// one DB check, shared by supplier create/update routes (and mirrored in
// the manager UI). No schema changes.

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// Philippine numbers: 09XXXXXXXXX (11) vs +639XXXXXXXXX (12+) share the
// same last 10 subscriber digits. Compare those; require 7+ digits so
// short/partial numbers never match.
function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length >= 7 ? digits.slice(-10) : digits;
}

function normalizeName(value) {
  const t = String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return t.length >= 3 ? t : '';
}

/**
 * Find a bar-linked account matching supplier details.
 * input: { email, phone, names: [] } (names = supplier name + contact person).
 * Checks EVERY account with users.bar_id = barId (any role) plus the
 * requester row itself. Returns { field, account } or null.
 */
async function findOwnAccountConflict(pool, barId, input = {}, requesterId = 0) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const names = [...new Set(
    (Array.isArray(input.names) ? input.names : [])
      .map(normalizeName)
      .filter(Boolean)
  )];
  if (!email && !phone && !names.length) return null;

  const [accounts] = await pool.query(
    `SELECT id, first_name, last_name, email, phone_number, role
       FROM users
      WHERE (bar_id = ? OR id = ?)
        AND status <> 'fully_deactivated'`,
    [barId, Number(requesterId) || 0]
  );
  for (const a of accounts) {
    if (email && normalizeEmail(a.email) === email) {
      return { field: 'email', account: pick(a) };
    }
    const ap = normalizePhone(a.phone_number);
    if (phone && ap && ap === phone) {
      return { field: 'phone', account: pick(a) };
    }
    const an = normalizeName(`${a.first_name || ''} ${a.last_name || ''}`);
    if (an && names.includes(an)) {
      return { field: 'name', account: pick(a) };
    }
  }
  return null;

  function pick(a) {
    return {
      id: a.id,
      name: `${a.first_name || ''} ${a.last_name || ''}`.trim(),
      role: a.role,
    };
  }
}

const SELF_SUPPLIER_MESSAGE =
  "You can't register yourself or your own staff as a supplier. Please use the external supplier's details.";

module.exports = {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  findOwnAccountConflict,
  SELF_SUPPLIER_MESSAGE,
};
