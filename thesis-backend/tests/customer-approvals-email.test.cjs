process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { app } = require('../index');
const pool = require('../config/database');
const emailService = require('../utils/emailService');

let listener;
let baseUrl;
const fixtures = [];

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
  assert.ok(admin, 'a super_admin user must exist for approval tests');
  global.__ADMIN_TOKEN = jwt.sign(
    { id: admin.id },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
});

test.after(async () => {
  try {
    const ids = fixtures.map((f) => f.id);
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      await pool.query(`DELETE FROM notifications WHERE user_id IN (${ph})`, ids);
      await pool.query(
        `DELETE FROM platform_audit_logs WHERE entity = 'customer' AND entity_id IN (${ph})`,
        ids
      );
      await pool.query(`DELETE FROM users WHERE id IN (${ph})`, ids);
    }
  } catch (_) {}
  if (listener) await new Promise((resolve) => listener.close(resolve));
  await pool.end().catch(() => {});
});

async function api(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_) {}
  return { status: res.status, data };
}

let phoneSeq = 800000101; // 9-digit tail -> 09 + tail is always a valid 11-digit PH mobile

async function makeCustomer({ email, approval = 'pending', verified = 0, password = 'Test1234!' }) {
  const hash = await bcrypt.hash(password, 4);
  const phone = `09${String(phoneSeq++)}`;
  const [r] = await pool.query(
    `INSERT INTO users (first_name, last_name, email, password, phone_number, date_of_birth,
                        role, role_id, is_verified, is_active, approval_status, created_at, updated_at)
     VALUES ('Approval', 'Test', ?, ?, ?, '2000-01-01', 'customer', NULL, ?, 1, ?, NOW(), NOW())`,
    [email, hash, phone, verified, approval]
  );
  fixtures.push({ id: r.insertId, email });
  return { id: r.insertId, email, password };
}

async function auditEvents(customerId) {
  const [rows] = await pool.query(
    `SELECT action, details FROM platform_audit_logs
     WHERE entity = 'customer' AND entity_id = ? ORDER BY id ASC`,
    [customerId]
  );
  return rows.map((r) => {
    let details = {};
    try {
      details = JSON.parse(r.details || '{}');
    } catch (_) {}
    return { action: r.action, details };
  });
}

test('approve sends one email and stamps verification', async () => {
  const u = await makeCustomer({ email: 'appr-one@tpg.test' });
  const res = await api(`/super-admin/customer-approvals/${u.id}/approve`, {
    token: global.__ADMIN_TOKEN,
    method: 'POST',
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.emailSent, true);

  const [[row]] = await pool.query(
    'SELECT approval_status, is_verified FROM users WHERE id = ?',
    [u.id]
  );
  assert.equal(row.approval_status, 'approved');
  assert.equal(Number(row.is_verified), 1);

  const events = await auditEvents(u.id);
  assert.ok(events.some((e) => e.action === 'APPROVE_CUSTOMER'));
  const mail = events.find(
    (e) => e.action === 'EMAIL_SENT' && e.details.event === 'customer_approved'
  );
  assert.ok(mail, 'expected an EMAIL_SENT audit for customer_approved');
  assert.equal(mail.details.success, true);
});

test('reject and revoke require a 5-300 character reason', async () => {
  const u = await makeCustomer({ email: 'appr-two@tpg.test' });
  for (const bad of [undefined, '', 'abc', 'x'.repeat(301)]) {
    const res = bad === undefined
      ? await api(`/super-admin/customer-approvals/${u.id}/reject`, {
        token: global.__ADMIN_TOKEN,
        method: 'POST',
        body: {},
      })
      : await api(`/super-admin/customer-approvals/${u.id}/reject`, {
        token: global.__ADMIN_TOKEN,
        method: 'POST',
        body: { reason: bad },
      });
    assert.equal(res.status, 400, `reason ${JSON.stringify(String(bad).slice(0, 8))} must 400`);
  }
});

test('revoke (reject from approved) emails the revoked kind', async () => {
  const u = await makeCustomer({ email: 'appr-revoke@tpg.test', approval: 'approved', verified: 1 });
  const res = await api(`/super-admin/customer-approvals/${u.id}/reject`, {
    token: global.__ADMIN_TOKEN,
    method: 'POST',
    body: { reason: 'Test revoke with a proper reason' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.emailSent, true);

  const events = await auditEvents(u.id);
  const mail = events.find((e) => e.action === 'EMAIL_SENT');
  assert.ok(mail);
  assert.equal(mail.details.event, 'customer_revoked');
});

test('a failed email never rolls back the status', async () => {
  const u = await makeCustomer({ email: 'appr-fail@tpg.test' });
  const orig = emailService.sendMail;
  emailService.sendMail = async () => {
    const err = new Error('simulated SMTP outage');
    err.code = 'ESIMULATED';
    throw err;
  };
  try {
    const res = await api(`/super-admin/customer-approvals/${u.id}/approve`, {
      token: global.__ADMIN_TOKEN,
      method: 'POST',
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.emailSent, false);
  } finally {
    emailService.sendMail = orig;
  }

  const [[row]] = await pool.query(
    'SELECT approval_status, is_verified FROM users WHERE id = ?',
    [u.id]
  );
  assert.equal(row.approval_status, 'approved');
  assert.equal(Number(row.is_verified), 1);

  const events = await auditEvents(u.id);
  const mail = events.find((e) => e.action === 'EMAIL_SENT');
  assert.ok(mail, 'failure must still be audited');
  assert.equal(mail.details.success, false);
});

test('bulk approve sends one email per user', async () => {
  const a = await makeCustomer({ email: 'appr-bulk-a@tpg.test' });
  const b = await makeCustomer({ email: 'appr-bulk-b@tpg.test' });
  const res = await api('/super-admin/customer-approvals/bulk', {
    token: global.__ADMIN_TOKEN,
    method: 'POST',
    body: { action: 'approve', ids: [a.id, b.id] },
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.data.length, 2);
  for (const item of res.data.data) {
    assert.equal(item.error || null, null);
    assert.equal(item.emailSent, true);
  }
});

test('a revoked customer cannot log in', async () => {
  const u = await makeCustomer({
    email: 'appr-blocked@tpg.test',
    approval: 'rejected',
    verified: 1,
    password: 'RightPass1!',
  });
  const portalRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-login-portal': 'customer' },
    body: JSON.stringify({ email: u.email, password: 'RightPass1!' }),
  });
  assert.equal(portalRes.status, 403);
  const body = await portalRes.json();
  assert.ok(!body.data?.token, 'no token may be issued to a rejected customer');
});

test('resend endpoint replays the last status email', async () => {
  const u = await makeCustomer({ email: 'appr-resend@tpg.test' });
  const rej = await api(`/super-admin/customer-approvals/${u.id}/reject`, {
    token: global.__ADMIN_TOKEN,
    method: 'POST',
    body: { reason: 'Resend path check reason here' },
  });
  assert.equal(rej.status, 200);
  const res = await api(`/super-admin/customer-approvals/${u.id}/resend-email`, {
    token: global.__ADMIN_TOKEN,
    method: 'POST',
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.emailSent, true);
});
