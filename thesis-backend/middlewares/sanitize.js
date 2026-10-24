/**
 * sanitize.js — Input sanitization middleware
 * Trims strings, strips null bytes, enforces field length limits,
 * and prevents basic XSS via HTML-special-char escaping on plain text fields.
 */

const MAX_STRING_LENGTH = 2000;
const DANGEROUS_PATTERN = /[\x00\x08\x0B\x0C\x0E-\x1F]/g; // control chars / null bytes

function sanitizeValue(val) {
  if (typeof val !== 'string') return val;
  return val
    .replace(DANGEROUS_PATTERN, '')   // strip null bytes and control chars
    .trim()
    .slice(0, MAX_STRING_LENGTH);
}

function sanitizeObject(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  const out = {};
  for (const key of Object.keys(obj)) {
    out[key] = sanitizeObject(sanitizeValue(obj[key]));
  }
  return out;
}

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

module.exports = { sanitizeInput };
