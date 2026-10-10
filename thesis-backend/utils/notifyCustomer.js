// One helper for every customer-facing email, so status changes that already
// produce an in-app notification also land in the inbox with the same story.
//
//   notifyCustomer(userRef, eventType, data)
//     userRef: a user row/object ({ id, email, first_name }) or a user id.
//     eventType: one of the EVENT builders below.
//     data: event-specific fields (reason, barName, dates, ...).
//
// Guarantees (the reason every call site is a one-liner):
// - never throws and never fails the request (try/catch + real error log),
// - links are built from APP_URL only,
// - every attempt is recorded in platform_audit_logs (action EMAIL_SENT)
//   so support can see exactly what went out.

const pool = require("../config/database");
const { sendMail, appUrl } = require("./emailService");

function shell({ eyebrow, title, greeting, bodyHtml, note }) {
  const safeGreeting = String(greeting || "there");
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#1a0000 0%,#111111 100%);padding:36px 40px 28px;border-bottom:1px solid rgba(204,0,0,0.2);">
          <span style="font-size:1.4rem;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Party<span style="color:#CC0000;">Goers</span> PH</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#CC0000;">${eyebrow}</p>
          <h1 style="margin:0 0 16px;font-size:1.6rem;font-weight:800;color:#ffffff;line-height:1.2;">Hey ${safeGreeting}, ${title}</h1>
          <div style="margin:0 0 28px;font-size:0.95rem;color:#888888;line-height:1.7;">${bodyHtml}</div>
          ${
            note
              ? `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:#161616;border:1px solid rgba(255,255,255,0.06);border-left:3px solid #CC0000;border-radius:8px;padding:12px 16px;"><p style="margin:0;font-size:0.78rem;color:#888888;line-height:1.6;">${note}</p></td></tr></table>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:0.72rem;color:#444444;text-align:center;">© ${new Date().getFullYear()} The Party Goers PH · Cavite, Philippines</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EVENTS = {
  welcome: () => ({
    subject: "Welcome to The Party Goers PH — email confirmed",
    eyebrow: "Email Verified",
    title: "you're in! 🎉",
    body: () =>
      `<p style="margin:0;">Your email is confirmed and your account is fully unlocked. Discover bars, book tables, and join events — see you out there.</p>
       <p style="margin:16px 0 0;"><a href="${appUrl()}" style="color:#CC0000;">Open The Party Goers PH</a></p>`,
  }),
  password_changed: () => ({
    subject: "Your Party Goers password was changed",
    eyebrow: "Security Notice",
    title: "password updated.",
    body: () =>
      `<p style="margin:0;">Your account password was just changed. If that wasn't you, reset it right away from the login page and contact support.</p>`,
  }),
  banned: ({ reason } = {}) => ({
    subject: "Your Party Goers account has been suspended",
    eyebrow: "Account Suspended",
    title: "account suspended.",
    body: () =>
      `<p style="margin:0;">Your account has been suspended${
        reason ? ` for the following reason: <strong style="color:#ffffff;">${esc(reason)}</strong>` : "."
      }</p>
       <p style="margin:16px 0 0;">If you think this is a mistake, please contact our support team.</p>`,
  }),
  unbanned: () => ({
    subject: "Your Party Goers account is active again",
    eyebrow: "Account Restored",
    title: "welcome back!",
    body: () =>
      `<p style="margin:0;">Your account suspension has been lifted. You can log in and use the platform normally again.</p>
       <p style="margin:16px 0 0;"><a href="${appUrl()}" style="color:#CC0000;">Open The Party Goers PH</a></p>`,
  }),
  reservation_submitted: ({ barName, when, status } = {}) => ({
    subject: `Reservation received at ${barName || "the bar"}`,
    eyebrow: "Reservation Received",
    title: "we got it!",
    body: () =>
      `<p style="margin:0;">Your table reservation${barName ? ` at <strong style="color:#ffffff;">${esc(barName)}</strong>` : ""}${
        when ? ` (${esc(when)})` : ""
      } was received${status ? ` and is currently <strong style="color:#ffffff;">${esc(status)}</strong>` : ""}. We'll email you the moment its status changes.</p>`,
  }),
  reservation_status: ({ barName, status, when, reason } = {}) => {
    const pretty = String(status || "").toLowerCase();
    const titles = {
      approved: "reservation approved!",
      rejected: "reservation update.",
      cancelled: "reservation cancelled.",
      completed: "thanks for coming!",
      checked_in: "you're checked in!",
      no_show: "we missed you.",
    };
    return {
      subject: `Reservation ${pretty || "update"} at ${barName || "the bar"}`,
      eyebrow: "Reservation Update",
      title: titles[pretty] || "status update.",
      body: () =>
        `<p style="margin:0;">Your reservation${barName ? ` at <strong style="color:#ffffff;">${esc(barName)}</strong>` : ""}${
          when ? ` (${esc(when)})` : ""
        } is now <strong style="color:#ffffff;">${esc(pretty || "updated")}</strong>.${
          reason ? ` Reason: <strong style="color:#ffffff;">${esc(reason)}</strong>` : ""
        }</p>`,
    };
  },
  reservation_cancelled: ({ barName, when } = {}) => ({
    subject: `Reservation cancelled at ${barName || "the bar"}`,
    eyebrow: "Reservation Cancelled",
    title: "cancelled.",
    body: () =>
      `<p style="margin:0;">Your reservation${barName ? ` at <strong style="color:#ffffff;">${esc(barName)}</strong>` : ""}${
        when ? ` (${esc(when)})` : ""
      } has been cancelled. Book again any time — we'd love to host you.</p>`,
  }),
  reservation_reminder: ({ barName, when } = {}) => ({
    subject: `Reminder: reservation at ${barName || "the bar"}${when ? ` ${when}` : " today"}`,
    eyebrow: "Reservation Reminder",
    title: "see you soon!",
    body: () =>
      `<p style="margin:0;">Just a reminder about your upcoming reservation${
        barName ? ` at <strong style="color:#ffffff;">${esc(barName)}</strong>` : ""
      }${when ? ` (${esc(when)})` : ""}. Reply to this email if your plans change.</p>`,
  }),
  payment_status: ({ barName, when, status } = {}) => ({
    subject: `Payment ${String(status || "update").toLowerCase()} for your reservation`,
    eyebrow: "Payment Update",
    title: "payment update.",
    body: () =>
      `<p style="margin:0;">Your payment${barName ? ` for the reservation at <strong style="color:#ffffff;">${esc(barName)}</strong>` : ""}${
        when ? ` (${esc(when)})` : ""
      } is now <strong style="color:#ffffff;">${esc(String(status || "updated"))}</strong>.</p>`,
  }),
};

// Lightweight audit row so support can see every customer email in Audit Logs.
async function auditEmail(userId, email, event, subject, extra = {}) {
  try {
    if (!userId) return;
    await pool.query(
      `INSERT INTO platform_audit_logs
       (actor_user_id, action, entity, entity_id, target_bar_id, details, ip_address, user_agent)
       VALUES (?, 'EMAIL_SENT', 'user', ?, NULL, ?, NULL, 'notifyCustomer')`,
      [userId, userId, JSON.stringify({ email, event, subject, ...extra })]
    );
  } catch (_) {
    // Audit must never break the request.
  }
}

async function resolveUser(userRef) {
  try {
    if (userRef && typeof userRef === "object" && (userRef.email || userRef.id)) {
      if (userRef.email) {
        return {
          id: userRef.id || null,
          email: String(userRef.email).trim(),
          first_name: userRef.first_name || userRef.firstName || "",
        };
      }
      const [[row]] = await pool.query(
        "SELECT id, email, first_name FROM users WHERE id = ? LIMIT 1",
        [userRef.id]
      );
      if (!row) return null;
      return { id: row.id, email: String(row.email || "").trim(), first_name: row.first_name || "" };
    }
    if (userRef) {
      const [[row]] = await pool.query(
        "SELECT id, email, first_name FROM users WHERE id = ? LIMIT 1",
        [userRef]
      );
      if (!row) return null;
      return { id: row.id, email: String(row.email || "").trim(), first_name: row.first_name || "" };
    }
  } catch (_) {
    return null;
  }
  return null;
}

async function notifyCustomer(userRef, eventType, data = {}) {
  try {
    const build = EVENTS[eventType];
    if (!build) return { ok: false, reason: "unknown-event" };
    const user = await resolveUser(userRef);
    if (!user || !user.email) return { ok: false, reason: "no-email" };
    const { subject, eyebrow, title, body } = build(data);
    const html = shell({ eyebrow, title, greeting: user.first_name || "there", bodyHtml: body() });
    const result = await sendMail(user.email, subject, html);
    await auditEmail(user.id, user.email, eventType, subject, { dev: Boolean(result && result.dev) });
    return { ok: Boolean(result && result.ok), dev: Boolean(result && result.dev) };
  } catch (err) {
    console.error(`NOTIFY CUSTOMER ERROR [${eventType}]:`, err?.code || "", err?.message || err);
    return { ok: false, reason: "send-failed" };
  }
}

module.exports = { notifyCustomer, auditEmail, EVENTS };
