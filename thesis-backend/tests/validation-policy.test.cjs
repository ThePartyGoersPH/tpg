process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../index');
const pool = require('../config/database');
const { validatePasswordStrength } = require('../utils/passwordPolicy');
const { normalizeCustomerPhone } = require('../utils/phonePolicy');

let listener;
let baseUrl;

test.before(async () => {
  listener = app.listen(0);
  await new Promise((resolve, reject) => {
    listener.once('listening', resolve);
    listener.once('error', reject);
  });
  const address = listener.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (listener) await new Promise((resolve) => listener.close(resolve));
  // DB pool sockets outlive the listener; without this the runner never exits.
  await pool.end().catch(() => {});
});

async function http(path, options = {}, testIp) {
  const headers = { ...(options.headers || {}) };
  // Unique IP per test: rate limits key on client IP, so tests never
  // consume each other's budgets (and reruns stay green inside any window).
  if (testIp) headers['X-Forwarded-For'] = testIp;
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

// ── password rules ──
test('password policy: weak, common, personal rejected; strong accepted', () => {
  assert.equal(validatePasswordStrength('abc').ok, false);
  assert.equal(validatePasswordStrength('abc').label, 'Weak');
  assert.equal(validatePasswordStrength('Password123', {}).ok, false);
  assert.equal(validatePasswordStrength('Password123', {}).failedRule, 'common');
  assert.equal(
    validatePasswordStrength('Asley2024!', { name: 'Asley', email: 'a@b.c' }).failedRule,
    'personal'
  );
  const strong = validatePasswordStrength('Str0ng!Pass12', { name: 'Asley', email: 'asley@x.ph' });
  assert.equal(strong.ok, true);
  assert.equal(strong.label, 'Strong');
});

// ── phone rule ──
test('customer phone: 11-digit 09 form only, +63 folds in', () => {
  assert.equal(normalizeCustomerPhone('09569370220').value, '09569370220');
  assert.equal(normalizeCustomerPhone('+63 956 937 0220').value, '09569370220');
  assert.ok(normalizeCustomerPhone('0956937022').error);
  assert.ok(normalizeCustomerPhone('095693702200').error);
  assert.ok(normalizeCustomerPhone('09abc567890').error);
  assert.equal(normalizeCustomerPhone('').value, null);
});

// ── check-email endpoint ──
test('GET check-email rejects invalid format', async () => {
  const res = await http('/auth/check-email?email=not-an-email', {}, '203.0.113.201');
  assert.equal(res.status, 400);
});

test('GET check-email reports taken for existing address regardless of case', async () => {
  const res = await http('/auth/check-email?email=DEMO.CUSTOMER@tpg.test', {}, '203.0.113.202');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.available, false);
});

test('GET check-email reports available for fresh address', async () => {
  const res = await http('/auth/check-email?email=fresh-addr-xyz@tpg.test', {}, '203.0.113.203');
  const body = await res.json();
  assert.equal(body.available, true);
  assert.equal(body.status, 'available');
});

// ── register duplicate hardening ──
test('register rejects duplicate email with different casing and spaces', async () => {
  const res = await http('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.204' },
    body: JSON.stringify({
      first_name: 'Dup',
      last_name: 'Test',
      email: '  DEMO.CUSTOMER@tpg.test ',
      password: 'Str0ng!Pass12',
      phone_number: '09500000001',
      date_of_birth: '2000-01-01',
    }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.match(body.message || '', /already exists|already registered/i);
});

test('register rejects duplicate phone', async () => {
  const res = await http('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.205' },
    body: JSON.stringify({
      first_name: 'Dup',
      last_name: 'Phone',
      email: 'dup-phone-xyz@tpg.test',
      password: 'Str0ng!Pass12',
      phone_number: '09900001111',
      date_of_birth: '2000-01-01',
    }),
  });
  assert.equal(res.status, 409);
});

test('register rejects weak password with the failing rule', async () => {
  const res = await http('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.206' },
    body: JSON.stringify({
      first_name: 'Weak',
      last_name: 'Pass',
      email: 'weak-pass-xyz@tpg.test',
      password: 'password123',
      phone_number: '09500000002',
      date_of_birth: '2000-01-01',
    }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'WEAK_PASSWORD');
});

test('check-email rate limit kicks in after 10 requests per minute', async () => {
  const ip = '203.0.113.210';
  let lastStatus = 0;
  for (let i = 0; i < 11; i++) {
    const res = await http(`/auth/check-email?email=rate${i}@tpg.test`, {}, ip);
    lastStatus = res.status;
    await res.text().catch(() => {});
  }
  assert.equal(lastStatus, 429);
});
