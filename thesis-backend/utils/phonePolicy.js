// Strict Philippine mobile rule shared by every customer-facing phone field:
// exactly 11 digits starting with 09. The customer frontend mirrors this in
// src/utils/phonePolicy.js — keep them in sync.

function normalizeCustomerPhone(value, { required = false, fieldLabel = "Phone number" } = {}) {
  const raw = value === undefined || value === null ? "" : String(value).trim();
  if (!raw) {
    if (required) return { error: `${fieldLabel} is required` };
    return { value: null };
  }

  let digits = raw.replace(/\D/g, "");
  // Accept +63/63 country-code form and fold it to the local 09 form:
  // "+63 9xx xxx xxxx" (or "639xxxxxxxxx") -> "09xxxxxxxxx".
  if (/^63\d{10}$/.test(digits)) {
    digits = `0${digits.slice(2)}`;
  }

  if (!/^09\d{9}$/.test(digits)) {
    return { error: `${fieldLabel} must be an 11-digit mobile number starting with 09` };
  }
  return { value: digits };
}

module.exports = { normalizeCustomerPhone };
