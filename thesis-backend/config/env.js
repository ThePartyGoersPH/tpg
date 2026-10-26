'use strict';

const fs = require('fs');
const path = require('path');

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
    try { require('dotenv').config({ path: p, override: false }); } catch (e) {}
    loadedFrom = p;
    break;
  }
}

function parseKeyHexOrBase64(raw, expectedBytes) {
  if (!raw) return null;
  let buf = null;
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === expectedBytes * 2) {
    buf = Buffer.from(raw, 'hex');
  } else {
    try { buf = Buffer.from(raw, 'base64'); } catch (e) { buf = null; }
  }
  if (!buf || buf.length !== expectedBytes) return null;
  return buf;
}

const raw = process.env;
const errors = [];

function requireVar(name) {
  const v = raw[name];
  if (v === undefined || v === null || String(v).trim() === '') {
    errors.push(`${name}: missing`);
    return undefined;
  }
  return v;
}

function optionalVar(name, fallback) {
  const v = raw[name];
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  return v;
}

function toBool(v, fallback = false) {
  if (v === undefined || v === null || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function toInt(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

const APP_URL = requireVar('APP_URL');
const CORS_ORIGINS_RAW = requireVar('CORS_ORIGINS') || optionalVar('CORS_EXTRA_ORIGINS', '');
const CORS_ORIGINS = (CORS_ORIGINS_RAW || '').split(',').map(s => s.trim()).filter(Boolean);

const DB_HOST = requireVar('DB_HOST');
const DB_USER = requireVar('DB_USER');
const DB_PASS = optionalVar('DB_PASS', '');
const DB_NAME = requireVar('DB_NAME');
const DB_PORT = toInt(raw.DB_PORT, 3306);

const JWT_SECRET = requireVar('JWT_SECRET');
const ID_STORAGE_PATH_RAW = requireVar('ID_STORAGE_PATH');
const ID_ENCRYPTION_KEY_RAW = requireVar('ID_ENCRYPTION_KEY');
const ID_HASH_KEY_RAW = requireVar('ID_HASH_KEY');

const OCR_PROVIDER = requireVar('OCR_PROVIDER');
const GOOGLE_APPLICATION_CREDENTIALS = optionalVar('GOOGLE_APPLICATION_CREDENTIALS', null);

const MAIL_ENABLED = toBool(raw.MAIL_ENABLED, false);
const MAIL_HOST = optionalVar('MAIL_HOST', '');
const MAIL_PORT = toInt(raw.MAIL_PORT, 587);
const MAIL_USER = optionalVar('MAIL_USER', '');
const MAIL_PASS = optionalVar('MAIL_PASS', '');
const MAIL_FROM = optionalVar('MAIL_FROM', '');
const MAIL_SECURE = toBool(raw.MAIL_SECURE, false);

const OCR_MONTHLY_HARD_LIMIT = toInt(raw.OCR_MONTHLY_HARD_LIMIT, 50);
const ID_MAX_ATTEMPTS = toInt(raw.ID_MAX_ATTEMPTS, 3);
const ID_RETENTION_DAYS_APPROVED = toInt(raw.ID_RETENTION_DAYS_APPROVED, 365);
const ID_RETENTION_DAYS_REJECTED = toInt(raw.ID_RETENTION_DAYS_REJECTED, 30);
const OCR_MAX_FILE_SIZE_MB = toInt(raw.OCR_MAX_FILE_SIZE_MB, 10);
const OCR_MAX_PAGES = toInt(raw.OCR_MAX_PAGES, 10);

const SUPPORT_EMAIL = requireVar('SUPPORT_EMAIL');
const TRUST_PROXY = toBool(raw.TRUST_PROXY, false);
const CRON_ENABLED = toBool(raw.CRON_ENABLED, false);
const PORT = toInt(raw.PORT, 3000);

const ID_STORAGE_PATH = path.resolve(ROOT, ID_STORAGE_PATH_RAW || './private-uploads');

// Refuse if storage path is inside public/static/dist
const forbidden = ['public', 'static', 'dist', 'client', 'frontend', 'assets'];
const rel = path.relative(ROOT, ID_STORAGE_PATH);
const segments = rel.split(path.sep).filter(Boolean);
if (segments.some((s) => forbidden.includes(s.toLowerCase()))) {
  errors.push('ID_STORAGE_PATH: must not be inside public/static/dist/frontend directories');
}

const ID_ENCRYPTION_KEY = parseKeyHexOrBase64(ID_ENCRYPTION_KEY_RAW, 32);
if (!ID_ENCRYPTION_KEY) errors.push('ID_ENCRYPTION_KEY: must decode to exactly 32 bytes');

// Vision credentials check
let visionCredentialsOk = false;
if (OCR_PROVIDER === 'google_vision') {
  if (GOOGLE_APPLICATION_CREDENTIALS) {
    const credPath = path.resolve(ROOT, GOOGLE_APPLICATION_CREDENTIALS);
    if (fs.existsSync(credPath)) {
      try {
        const json = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        if (json.project_id && json.private_key && json.client_email) {
          visionCredentialsOk = true;
        } else {
          errors.push('GOOGLE_APPLICATION_CREDENTIALS: invalid service account JSON');
        }
      } catch (e) {
        errors.push('GOOGLE_APPLICATION_CREDENTIALS: ' + e.message);
      }
    } else {
      errors.push('GOOGLE_APPLICATION_CREDENTIALS: file does not exist');
    }
  } else {
    errors.push('GOOGLE_APPLICATION_CREDENTIALS: required for google_vision');
  }
} else {
  visionCredentialsOk = true;
}

if (errors.length > 0) {
  console.error('\n[CONFIG] Environment validation FAILED. Fix the following:\n');
  for (const e of errors) console.error('  - ' + e);
  console.error('\n');
  process.exit(1);
}

// Create storage subfolders
const subfolders = ['ids', 'keys', 'tmp'];
for (const sub of subfolders) {
  const dir = path.join(ID_STORAGE_PATH, sub);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  try { fs.chmodSync(dir, 0o700); } catch (e) {}
}
// Clean tmp
const tmpDir = path.join(ID_STORAGE_PATH, 'tmp');
try {
  for (const f of fs.readdirSync(tmpDir)) {
    const fp = path.join(tmpDir, f);
    if (fs.statSync(fp).isFile()) fs.unlinkSync(fp);
  }
} catch (e) {}

if (!fs.existsSync(ID_STORAGE_PATH)) {
  fs.mkdirSync(ID_STORAGE_PATH, { recursive: true, mode: 0o700 });
}
try { fs.chmodSync(ID_STORAGE_PATH, 0o700); } catch (e) {}

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

const config = {
  NODE_ENV,
  IS_PRODUCTION: NODE_ENV === 'production',
  IS_DEVELOPMENT: NODE_ENV !== 'production',
  PORT,
  APP_URL,
  CORS_ORIGINS,
  DB: { host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASS, database: DB_NAME },
  JWT_SECRET,
  ID_STORAGE_PATH,
  ID_STORAGE_ABSOLUTE: ID_STORAGE_PATH,
  ID_ENCRYPTION_KEY,
  ID_HASH_KEY: ID_HASH_KEY_RAW,
  OCR_PROVIDER,
  GOOGLE_APPLICATION_CREDENTIALS: GOOGLE_APPLICATION_CREDENTIALS ? path.resolve(ROOT, GOOGLE_APPLICATION_CREDENTIALS) : null,
  VISION_CREDENTIALS_OK: visionCredentialsOk,
  MAIL_ENABLED,
  MAIL: { host: MAIL_HOST, port: MAIL_PORT, user: MAIL_USER, pass: MAIL_PASS, from: MAIL_FROM, secure: MAIL_SECURE },
  OCR_MONTHLY_HARD_LIMIT,
  ID_MAX_ATTEMPTS,
  ID_RETENTION_DAYS_APPROVED,
  ID_RETENTION_DAYS_REJECTED,
  OCR_MAX_FILE_SIZE_MB,
  OCR_MAX_PAGES,
  SUPPORT_EMAIL,
  TRUST_PROXY,
  CRON_ENABLED,
  MAIL_PRINT_TO_CONSOLE: !MAIL_ENABLED,
};

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

module.exports = Object.assign(config, { parseKeyHexOrBase64 });