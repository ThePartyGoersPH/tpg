// Shared password rules: the single source of truth for register,
// reset-password (and change-password). The customer frontend mirrors this
// logic byte-for-byte in src/utils/passwordPolicy.js — keep them in sync.

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const BONUS_LENGTH = 12;

const COMMON_PASSWORDS = new Set(
  [
    "password",
    "password123",
    "password1",
    "12345678",
    "123456789",
    "1234567890",
    "1234567",
    "qwerty123",
    "qwerty",
    "abc123",
    "abc12345",
    "letmein",
    "letmein123",
    "welcome",
    "welcome123",
    "admin123",
    "changeme",
    "changeme123",
    "iloveyou",
    "monkey123",
    "dragon123",
    "football123",
    "partygoers",
    "thepartygoers",
    "partygoers123",
  ].map((s) => s.toLowerCase())
);

function containsPersonal(value, name, email) {
  const v = String(value || "").toLowerCase();
  const needles = [];
  if (name) {
    String(name)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 3)
      .forEach((p) => needles.push(p));
  }
  if (email) {
    String(email)
      .toLowerCase()
      .split("@")[0]
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 3)
      .forEach((p) => needles.push(p));
  }
  return needles.find((n) => v.includes(n)) || null;
}

// Returns { ok, score (0-6), label, failedRule, message, checks }.
// Submit is allowed only when ok === true (all minimum rules pass).
function validatePasswordStrength(value, { name = "", email = "" } = {}) {
  const v = String(value || "");
  const checks = {
    length: v.length >= MIN_LENGTH,
    upper: /[A-Z]/.test(v),
    lower: /[a-z]/.test(v),
    digit: /[0-9]/.test(v),
    special: /[^A-Za-z0-9]/.test(v),
    notCommon: !COMMON_PASSWORDS.has(v.toLowerCase()),
    notPersonal: !containsPersonal(v, name, email),
  };

  let failedRule = null;
  let message = "";
  if (v.length > MAX_LENGTH) {
    failedRule = "max_length";
    message = "Password must be 128 characters or less";
  } else if (!checks.length) {
    failedRule = "min_length";
    message = "Password must be at least 8 characters";
  } else if (!checks.upper) {
    failedRule = "uppercase";
    message = "Password must include an uppercase letter";
  } else if (!checks.lower) {
    failedRule = "lowercase";
    message = "Password must include a lowercase letter";
  } else if (!checks.digit) {
    failedRule = "number";
    message = "Password must include a number";
  } else if (!checks.notCommon) {
    failedRule = "common";
    message = "That password is too common — choose a less predictable one";
  } else if (!checks.notPersonal) {
    failedRule = "personal";
    message = "Password must not contain your name or email";
  }

  let score = 0;
  if (checks.length) score += 1;
  if (v.length >= BONUS_LENGTH) score += 1;
  if (checks.upper) score += 1;
  if (checks.lower) score += 1;
  if (checks.digit) score += 1;
  if (checks.special) score += 1;

  const label = score <= 2 ? "Weak" : score === 3 ? "Fair" : score === 4 ? "Good" : "Strong";
  return { ok: failedRule === null, score, label, failedRule, message, checks };
}

module.exports = { validatePasswordStrength, MIN_LENGTH, MAX_LENGTH, COMMON_PASSWORDS };
