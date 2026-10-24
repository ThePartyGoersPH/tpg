'use strict';
/**
 * scripts/smoke-test.js <base-url>
 * Runs against http://localhost:<port> or https://thepartygoers.partygoers.online
 * Checks: /api/health, CORS preflight, register validation (bad phone rejected),
 *         unapproved-user block, private file URL 404, admin ID endpoint 401/403 without token.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

const BASE = process.argv[2];
if (!BASE) {
  console.error('Usage: node scripts/smoke-test.js <base-url>');
  process.exit(1);
}

const base = BASE.replace(/\/+$/, '');
const isHttps = base.startsWith('https');
const lib = isHttps ? https : http;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve) => {
    const url = new URL(path, base);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: { ...headers },
      timeout: 15000,
    };
    if (body) {
      const b = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(b);
    }
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message, body: '' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout', body: '' }); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function main() {
  console.log(`\nSmoke testing ${base}\n`);

  // 1. Health
  const health = await request('GET', '/api/health');
  check('GET /api/health returns 200', health.status === 200, `got ${health.status}`);

  // 2. CORS preflight
  const origin = base.includes('localhost') ? 'http://localhost:5173' : 'https://thepartygoers.partygoers.online';
  const preflight = await request('OPTIONS', '/api/health', {
    'Origin': origin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type,Authorization',
  });
  const acao = preflight.headers['access-control-allow-origin'];
  check('CORS preflight allows origin', acao === origin || acao === '*', `acao=${acao}`);

  // 3. Register validation (bad phone rejected)
  const reg = await request('POST', '/api/auth/register', {}, {
    email: 'smoke-test@example.com',
    password: 'TestPass123!',
    phone: '123', // invalid
    name: 'Smoke Test',
  });
  check('Register with bad phone rejected (4xx)', reg.status >= 400 && reg.status < 500, `got ${reg.status}`);

  // 4. Unapproved user block (login with nonexistent user)
  const login = await request('POST', '/api/auth/login', {}, {
    email: 'nonexistent-smoke@example.com',
    password: 'WrongPass123!',
  });
  check('Login with bad credentials rejected (4xx)', login.status >= 400 && login.status < 500, `got ${login.status}`);

  // 5. Private file URL returns 404
  const priv = await request('GET', '/private-uploads/ids/test.jpg');
  check('Private file URL returns 404', priv.status === 404, `got ${priv.status}`);

  // 6. Admin ID endpoint returns 401/403 without token
  const admin = await request('GET', '/api/admin/id-verifications');
  check('Admin ID endpoint requires auth (401/403)', admin.status === 401 || admin.status === 403, `got ${admin.status}`);

  // 7. Readiness endpoint requires auth
  const ready = await request('GET', '/api/admin/system/readiness');
  check('Readiness endpoint requires auth (401/403)', ready.status === 401 || ready.status === 403, `got ${ready.status}`);

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });