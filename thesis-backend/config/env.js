'use strict';

/**
 * config/env.js
 *
 * Single source of truth for ALL configuration.
 * This is the ONLY module that reads process.env.
 * It loads, validates, and freezes the config at startup.
 *
 * If anything required is missing or invalid, it prints a clear list of
 * problems (names only, never values) and exits with code 1.
 *
 * Usage:
 *   const config = require('./config/env');
 *   config.APP_URL   // etc.
 *
 * Select environment file with NODE_ENV:
 *   NODE_ENV=development  -> .env.local  (or .env)
 *   NODE_ENV=production   -> .env.production (or .env)
 */

const fs = require('fs');
const path = require('path');

// ---- Pick the env file ----
const NODE_ENV = process.env.NODE_ENV || 'development';
const ROOT = path.resolve(__dirname, '..');

const envFileCandidates =
  NODE_ENV === 'production'
    ? ['.env.production', '.env']
    : ['.env.local', '.env.development', '.env'];

let loadedFrom = null;
for (const f of envFileCandidates) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) {
    // dotenv is optional; if not present we just rely on process.env
    try {
      require('dotenv').config({ path: p, override: false });
    } catch (e) {
      // dotenv not installed - fine, process.env must be set externally
    }
    loadedFrom = p;
    break;
  }
}

// ---- Helper: parse bytes from key strings ----
function parseKeyHexOrBase64(raw, label, expectedBytes) {
  if (!raw) return null;
  let buf = null;
  // Try hex first
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === expectedBytes * 2) {
    buf = Buffer.from(raw, 'hex');
  } else {
    // Try base64
    try {
      buf = Buffer.from(raw, 'base64');
    } catch (e) {
      buf = null;
    }
  }
  if (!buf || buf.length !== expectedBytes) return null;
  return buf;
}

// ---- Collect raw env values ----
const raw = process.env;

// ---- Validation accumulators ----
const errors = [];
function requireVar(name, validate) {
  const v = raw[name];
  if (v === undefined || v === null || String(v).trim() === '') {
    errors.push(`${name}: missing`);
    return undefined;
  }
  if (validate) {
    const r = validate(v);
    if (r !== true) errors.push(`${name}: ${r}`);
  }
  return v;
}
function optionalVar(name, validate, fallback) {
  const v = raw[name];
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  if (validate) {
    const r = validate(v);
    if (r !== true) errors.push(`${name}: ${r}`);
  }
  return v;
}

// ---- Boolean coercion ----
function toBool(v, fallback = false) {
  if (v === undefined || v === null || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

// ---- Number coercion ----
function toInt(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

// ---- Validate ----
const APP_URL = requireVar('APP_URL', (v) => {
  try { new URL(v); return true; } catch (e) { return 'not a valid URL'; }
});

const CORS_ORIGINS_RAW = requireVar('CORS_ORIGINS', (v) => true);
const CORS_ORIGINS = CORS_ORIGINS_RAW
  ? CORS_ORIGINS_RAW.split(',').map((s) => s.trim()).filter(Boolean)
  : [];
if (CORS_ORIGINS.length === 0) errors.push('CORS_ORIGINS: empty');

const DB_HOST = requireVar('DB_HOST');
const DB_USER = requireVar('DB_USER');
const DB_PASS = optionalVar('DB_PASS', () => true, '');
const DB_NAME = requireVar('DB_NAME');
const DB_PORT = toInt(raw.DB_PORT, 3306);

const JWT_SECRET = requireVar('JWT_SECRET', (v) => {
  if (v.length < 32) return 'must be at least 32 characters';
  return true;
});

const ID_STORAGE_PATH_RAW = requireVar('ID_STORAGE_PATH');
const ID_ENCRYPTION_KEY_RAW = requireVar('ID_ENCRYPTION_KEY', (v) => {
  const buf = parseKeyHexOrBase64(v, 'ID_ENCRYPTION_KEY', 32);
  if (!buf) return 'must be 32 bytes (hex of 64 chars or base64 of 32 bytes)';
  return true;
});
const ID_HASH_KEY_RAW = requireVar('ID_HASH_KEY', (v) => {
  if (!v || v.length < 16) return 'must be at least 16 characters';
  return true;
});

const OCR_PROVIDER = requireVar('OCR_PROVIDER', (v) => {
  if (!['google_vision', 'none', 'mock'].includes(v)) return 'must be google_vision, none, or mock';
  return true;
});

const GOOGLE_APPLICATION_CREDENTIALS = optionalVar('GOOGLE_APPLICATION_CREDENTIALS', (v) => {
  if (OCR_PROVIDER === 'google_vision') {
    if (!fs.existsSync(v)) return 'file does not exist';
    return true;
  }
  return true;
});

const MAIL_ENABLED = toBool(raw.MAIL_ENABLED, false);
const MAIL_HOST = optionalVar('MAIL_HOST', (v) => (MAIL_ENABLED ? true : true), '');
const MAIL_PORT = toInt(raw.MAIL_PORT, 587);
const MAIL_USER = optionalVar('MAIL_USER', () => true, '');
const MAIL_PASS = optionalVar('MAIL_PASS', () => true, '');
const MAIL_FROM = optionalVar('MAIL_FROM', () => true, '');
const MAIL_SECURE = toBool(raw.MAIL_SECURE, false);

const OCR_MONTHLY_HARD_LIMIT = toInt(raw.OCR_MONTHLY_HARD_LIMIT, 50);
const ID_MAX_ATTEMPTS = toInt(raw.ID_MAX_ATTEMPTS, 3);
const ID_RETENTION_DAYS_APPROVED = toInt(raw.ID_RETENTION_DAYS_APPROVED, 365);
const ID_RETENTION_DAYS_REJECTED = toInt(raw.ID_RETENTION_DAYS_REJECTED, 30);
const OCR_MAX_FILE_SIZE_MB = toInt(raw.OCR_MAX_FILE_SIZE_MB, 10);
const OCR_MAX_PAGES = toInt(raw.OCR_MAX_PAGES, 10);

const SUPPORT_EMAIL = requireVar('SUPPORT_EMAIL', (v) => {
  if (!v.includes('@')) return 'must be a valid email';
  return true;
});

const TRUST_PROXY = toBool(raw.TRUST_PROXY, false);

const CRON_ENABLED = toBool(raw.CRON_ENABLED, false);
const PORT = toInt(raw.PORT, 3000);
const NODE_ENV_VAL = NODE_ENV;

// ---- Resolve ID_STORAGE_PATH to absolute ----
const ID_STORAGE_PATH = path.resolve(ROOT, ID_STORAGE_PATH_RAW || './private-uploads');

// ---- Refuse if storage path is inside public/static/dist ----
const forbidden = ['public', 'static', 'dist', 'client', 'frontend', 'assets'];
const rel = path.relative(ROOT, ID_STORAGE_PATH);
const segments = rel.split(path.sep).filter(Boolean);
if (segments.some((s) => forbidden.includes(s.toLowerCase()))) {
  errors.push('ID_STORAGE_PATH: must not be inside public/static/dist/frontend directories');
}

// ---- Validate encryption key bytes ----
const ID_ENCRYPTION_KEY = parseKeyHexOrBase64(ID_ENCRYPTION_KEY_RAW, 'ID_ENCRYPTION_KEY', 32);
if (!ID_ENCRYPTION_KEY) errors.push('ID_ENCRYPTION_KEY: must decode to exactly 32 bytes');

// ---- Check storage path writable (async check deferred to startup) ----
// We'll validate writability in the startup summary.

// ---- OCR provider credentials check ----
let visionCredentialsOk = false;
let visionCredentialsError = null;
if (OCR_PROVIDER === 'google_vision') {
  if (!GOOGLE_APPLICATION_CREDENTIALS) {
    visionCredentialsError = 'GOOGLE_APPLICATION_CREDENTIALS is required when OCR_PROVIDER=google_vision';
    errors.push('GOOGLE_APPLICATION_CREDENTIALS: required for google_vision');
  } else {
    try {
      const credPath = path.resolve(ROOT, GOOGLE_APPLICATION_CREDENTIALS);
      if (!fs.existsSync(credPath)) {
        visionCredentialsError = 'credentials file not found: ' + credPath;
        errors.push('GOOGLE_APPLICATION_CREDENTIALS: file does not exist');
      } else {
        const stat = fs.statSync(credPath);
        const json = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        if (!json.project_id || !json.private_key || !json.client_email) {
          visionCredentialsError = 'credentials file missing required fields';
          errors.push('GOOGLE_APPLICATION_CREDENTIALS: invalid service account JSON');
        } else {
          visionCredentialsOk = true;
          // Production permission check
          if (NODE_ENV === 'production') {
            const mode = (stat.mode & 0o777).toString(8);
            if (stat.mode & 0o077) {
              console.warn(`[CONFIG] WARNING: GOOGLE_APPLICATION_CREDENTIALS file is group/world readable (mode ${mode}). Recommend chmod 600.`);
            }
          }
        }
      }
    } catch (e) {
      visionCredentialsError = 'failed to parse credentials: ' + e.message;
      errors.push('GOOGLE_APPLICATION_CREDENTIALS: ' + e.message);
    }
  }
} else if (OCR_PROVIDER === 'mock') {
  visionCredentialsOk = true;
} else {
  visionCredentialsOk = true; // 'none'
}

// ---- If errors, print and exit ----
if (errors.length > 0) {
  console.error('\n[CONFIG] ❌ Environment validation FAILED. Fix the following:\n');
  for (const e of errors) console.error('  - ' + e);
  console.error('\n[CONFIG] See .env.local.example / .env.production.example for required variables.\n');
  process.exit(1);
}

// ---- Create storage subfolders ----
const subfolders = ['ids', 'keys', 'tmp'];
for (const sub of subfolders) {
  const dir = path.join(ID_STORAGE_PATH, sub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  try { fs.chmodSync(dir, 0o700); } catch (e) { /* best effort */ }
}
// Clean tmp on startup
const tmpDir = path.join(ID_STORAGE_PATH, 'tmp');
try {
  for (const f of fs.readdirSync(tmpDir)) {
    const fp = path.join(tmpDir, f);
    const stat = fs.statSync(fp);
    if (stat.isFile()) fs.unlinkSync(fp);
  }
} catch (e) { /* ignore */ }

// Ensure top-level storage path is 700
if (!fs.existsSync(ID_STORAGE_PATH)) {
  fs.mkdirSync(ID_STORAGE_PATH, { recursive: true, mode: 0o700 });
}
try { fs.chmodSync(ID_STORAGE_PATH, 0o700); } catch (e) { /* best effort */ }

// Check writability
let storageWritable = false;
try {
  const testFile = path.join(ID_STORAGE_PATH, '.write-test');
  fs.writeFileSync(testFile, 'ok');
  fs.unlinkSync(testFile);
  storageWritable = true;
} catch (e) {
  storageWritable = false;
  console.error(`[CONFIG] ID_STORAGE_PATH is not writable: ${ID_STORAGE_PATH}`);
  process.exit(1);
}

// ---- Final frozen config object ----
const config = Object.freeze({
  NODE_ENV: NODE_ENV_VAL,
  IS_PRODUCTION: NODE_ENV_VAL === 'production',
  IS_DEVELOPMENT: NODE_ENV_VAL !== 'production',

  PORT,
  APP_URL,
  CORS_ORIGINS,

  DB: Object.freeze({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
  }),

  JWT_SECRET,

  ID_STORAGE_PATH,
  ID_STORAGE_ABSOLUTE: ID_STORAGE_PATH,
  ID_ENCRYPTION_KEY,   // Buffer (32 bytes)
  ID_HASH_KEY: ID_HASH_KEY_RAW,

  OCR_PROVIDER,
  GOOGLE_APPLICATION_CREDENTIALS: GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(ROOT, GOOGLE_APPLICATION_CREDENTIALS)
    : null,
  VISION_CREDENTIALS_OK: visionCredentialsOk,

  MAIL_ENABLED,
  MAIL: Object.freeze({
    host: MAIL_HOST,
    port: MAIL_PORT,
    user: MAIL_USER,
    pass: MAIL_PASS,
    from: MAIL_FROM,
    secure: MAIL_SECURE,
  }),

  OCR_MONTHLY_HARD_LIMIT,
  ID_MAX_ATTEMPTS,
  ID_RETENTION_DAYS_APPROVED,
  ID_RETENTION_DAYS_REJECTED,
  OCR_MAX_FILE_SIZE_MB,
  OCR_MAX_PAGES,

  SUPPORT_EMAIL,
  TRUST_PROXY,
  CRON_ENABLED,

  // Runtime flags
  MAIL_PRINT_TO_CONSOLE: !MAIL_ENABLED, // when mail disabled, print codes/links to console
});

// ---- Startup summary (no secrets) ----
console.log('\n========== CONFIG SUMMARY ==========');
console.log(`NODE_ENV:              ${config.NODE_ENV}`);
console.log(`APP_URL:               ${config.APP_URL}`);
console.log(`CORS origins:          ${config.CORS_ORIGINS.join(', ')}`);
console.log(`Trust proxy:           ${config.TRUST_PROXY}`);
console.log(`Mail enabled:          ${config.MAIL_ENABLED}${config.MAIL_PRINT_TO_CONSOLE ? ' (printing codes/links to console)' : ''}`);
console.log(`ID storage path:       ${config.ID_STORAGE_PATH} (exists=${fs.existsSync(config.ID_STORAGE_PATH)}, writable=${storageWritable})`);
console.log(`Encryption key valid:  ${!!config.ID_ENCRYPTION_KEY} (32 bytes)`);
console.log(`OCR provider:          ${config.OCR_PROVIDER} (credentials ${config.VISION_CREDENTIALS_OK ? 'OK' : 'MISSING/INVALID'})`);
console.log(`OCR monthly limit:     ${config.OCR_MONTHLY_HARD_LIMIT}`);
console.log(`Cron enabled:          ${config.CRON_ENABLED}`);
console.log(`Loaded env from:       ${loadedFrom || '(process.env only)'}`);
console.log('====================================\n');

module.exports = Object.assign({}, config, { parseKeyHexOrBase64 });