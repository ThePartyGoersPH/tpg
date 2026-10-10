process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { app } = require('../index');
const pool = require('../config/database');

let listener;
let baseUrl;
const fixtures = [];
let adminId = null;

function sign(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '10m' });
}

test.before(async () => {
  listener = app.listen(0);
  await new Promise((resolve, reject) => {
    listener.once('listening', resolve);
    listener.once('error', reject);
  });
  const address = listener.address();
  baseUrl = `http://127.0.0.1:${address.port}`;

  const [[admin]] = await pool.query(
    "SELECT id FROM users WHERE LOWER(role) = 'super_admin' AND is_active = 1 LIMIT 1"
  );
  assert.ok(admin, 'a super_admin user must exist for portal tests');
  adminId = admin.id;

  const hash = await bcrypt.hash('PortalTest1!', 4);
  const [bo] = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password, phone_number, date_of_birth,
                        role, role_id, is_verified, is_active, bar_id, approval_status, created_at, updated_at)
     VALUES ('Portal', 'Owner', 'portal.owner@tpg.test', ?, '09880001111', '1990-01-01',
             'bar_owner', NULL, 1, 1, NULL, 'approved', NOW(), NOW())`,
    [hash]
  );
  fixtures.push({ id: bo.insertId, email: 'portal.owner@tpg.test', password: 'PortalTest1!' });

  const [[barRow]] = await pool.query(
    "SELECT id FROM bars WHERE status = 'active' ORDER BY id LIMIT 1"
  );
  assert.ok(barRow, 'at least one active bar must exist for portal tests');
  const [bo2] = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password, phone_number, date_of_birth,
                        role, role_id, is_verified, is_active, bar_id, approval_status, created_at, updated_at)
     VALUES ('Portal', 'Owner2', 'portal.owner2@tpg.test', ?, '09880002222', '1990-01-01',
             'bar_owner', NULL, 1, 1, ?, 'approved', NOW(), NOW())`,
    [hash, barRow.id]
  );
  fixtures.push({ id: bo2.insertId, email: 'portal.owner2@tpg.test', password: 'PortalTest1!' });

  const [sa] = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password, phone_number, date_of_birth,
                        role, role_id, is_verified, is_active, bar_id, approval_status, created_at, updated_at)
     VALUES ('Portal', 'Admin', 'portal.super@tpg.test', ?, '09880003333', '1990-01-01',
             'super_admin', NULL, 1, 1, NULL, 'approved', NOW(), NOW())`,
    [hash]
  );
  fixtures.push({ id: sa.insertId, email: 'portal.super@tpg.test', password: 'PortalTest1!' });
});

test.after(async () => {
  try {
    const ids = fixtures.map((f) => f.id);
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      await pool.query(`DELETE FROM notifications WHERE user_id IN (${ph})`, ids);
      await pool.query(
        `DELETE FROM platform_audit_logs WHERE (entity = 'customer' AND entity_id IN (${ph})) OR actor_user_id IN (${ph})`,
        [...ids, ...ids]
      );
      await pool.query(`DELETE FROM login_attempts WHERE user_id IN (${ph})`, ids);
      await pool.query(`DELETE FROM users WHERE id IN (${ph})`, ids);
    }
  } catch (_) {}
  if (listener) await new Promise((resolve) => listener.close(resolve));
  await pool.end().catch(() => {});
});

async function api(path, { token, method = 'GET', body, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_) {}
  return { status: res.status, data };
}

test('super admin token is refused on bar owner routes', async () => {
  const token = sign(adminId);
  const details = await api('/owner/bar/details', { token });
  assert.equal(details.status, 403);
  assert.equal(details.data.code, 'FORBIDDEN_PORTAL');

  const branches = await api('/branches/my', { token });
  assert.equal(branches.status, 403);
  assert.equal(branches.data.code, 'FORBIDDEN_PORTAL');
});

test('bar owner without a bar gets a clear 403, not a vague error', async () => {
  const owner = fixtures.find((f) => f.email === 'portal.owner@tpg.test');
  const res = await api('/tps/transactions', { token: sign(owner.id) });
  assert.equal(res.status, 403);
  assert.match(res.data.message || '', /not linked to a bar/i);
});

test('bar owner with a bar still passes', async () => {
  const owner = fixtures.find((f) => f.email === 'portal.owner2@tpg.test');
  const res = await api('/branches/my', { token: sign(owner.id) });
  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
});

test('manager-portal login as super admin is rejected with no token', async () => {
  const owner = fixtures.find((f) => f.email === 'portal.super@tpg.test');
  const res = await api(
    '/auth/login',
    {
      method: 'POST',
      body: { email: owner.email, password: owner.password },
      headers: { 'X-App': 'manager' },
    }
  );
  assert.equal(res.status, 403);
  assert.equal(res.data.code, 'WRONG_PORTAL');
  assert.ok(!res.data.data?.token, 'no token may be issued');
});

test('customer-portal login as bar owner is rejected with no token', async () => {
  const owner = fixtures.find((f) => f.email === 'portal.owner@tpg.test');
  const res = await api(
    '/auth/login',
    {
      method: 'POST',
      body: { email: owner.email, password: owner.password },
      headers: { 'X-App': 'customer' },
    }
  );
  assert.equal(res.status, 403);
  assert.equal(res.data.code, 'WRONG_PORTAL');
  assert.ok(!res.data.data?.token, 'no token may be issued');
});

test('legacy logins without X-App keep working', async () => {
  const owner = fixtures.find((f) => f.email === 'portal.owner@tpg.test');
  const res = await api('/auth/login', {
    method: 'POST',
    body: { email: owner.email, password: owner.password },
  });
  assert.equal(res.status, 200);
  assert.ok(res.data.data?.token);
});
