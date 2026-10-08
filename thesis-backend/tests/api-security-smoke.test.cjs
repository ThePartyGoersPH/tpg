process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('../index');

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
  if (!listener) return;
  await new Promise((resolve) => listener.close(resolve));
});

async function http(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

test('health endpoint responds with security headers', async () => {
  const response = await http('/health', {
    headers: { Origin: 'https://thepartygoers.fun' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://thepartygoers.fun');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');

  const csp = response.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'self'/);

  const body = await response.json();
  assert.equal(body.ok, true);
});

test('insecure production HTTP origin is not allowed by default', async () => {
  const response = await http('/health', {
    headers: { Origin: 'http://thepartygoers.fun' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('protected owner endpoint rejects missing bearer token', async () => {
  const response = await http('/owner/bar/users');
  assert.equal(response.status, 401);

  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.message, 'Missing token');
});

test('admin reset endpoint rejects missing bearer token', async () => {
  const response = await http('/admin/reset-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', newPassword: 'StrongPass123!' }),
  });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.message, 'Missing token');
});

test('payment verify endpoint rejects missing bearer token', async () => {
  const response = await http('/payment-check/verify/TEST-REF-123', {
    method: 'POST',
  });

  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.message, 'Missing token');
});

test('payment success page avoids javascript URL links', async () => {
  const response = await http('/payment/success');

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Payment Successful!/);
  assert.equal(html.includes('javascript:'), false);
});

test('payment failed page avoids javascript URL links', async () => {
  const response = await http('/payment/failed');

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Payment Failed/);
  assert.equal(html.includes('javascript:'), false);
});
