'use strict';
/**
 * scripts/check-env.js
 * Validates the current .env (or .env.local / .env.production based on NODE_ENV).
 * Prints missing/invalid names (never values). Exits non-zero on failure.
 */
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const NODE_ENV = process.env.NODE_ENV || 'development';

const candidates = NODE_ENV === 'production'
  ? ['.env.production', '.env']
  : ['.env.local', '.env.development', '.env'];

let loaded = null;
for (const f of candidates) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) { loaded = p; break; }
}

if (!loaded) {
  console.error(`[check-env] No env file found for NODE_ENV=${NODE_ENV}. Looked in: ${candidates.join(', ')}`);
  process.exit(1);
}

// Load dotenv if available
try { require('dotenv').config({ path: loaded, override: false }); } catch (e) {}

// Now require the config module — it validates and exits on failure
try {
  require(path.join(ROOT, 'config', 'env.js'));
  console.log(`[check-env] OK — env file: ${loaded}`);
  process.exit(0);
} catch (e) {
  console.error('[check-env] FAILED:', e.message);
  process.exit(1);
}