// Mirrors thesis-backend/utils/phonePolicy.js — keep them in sync.
// Philippine mobile: exactly 11 digits starting with 09.

export function normalizeCustomerPhone(value) {
  const raw = value === undefined || value === null ? '' : String(value).trim();
  if (!raw) return { value: null };
  let digits = raw.replace(/\D/g, '');
  if (/^63\d{10}$/.test(digits)) {
    digits = `0${digits.slice(2)}`;
  }
  if (!/^09\d{9}$/.test(digits)) {
    return { error: 'Phone number must be an 11-digit mobile number starting with 09' };
  }
  return { value: digits };
}

// Input handler shared by every phone field: strips non-digits, folds a
// +63/63 country prefix into the local 09 form, and hard-caps at 11 chars.
// Works for typing AND paste ("+63 9xx xxx xxxx" -> "09xxxxxxxxx").
export function sanitizePhoneInput(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (/^63\d{10}$/.test(digits)) {
    digits = `0${digits.slice(2)}`;
  }
  return digits.slice(0, 11);
}

export function isValidCustomerPhone(value) {
  return /^09\d{9}$/.test(String(value || ''));
}
