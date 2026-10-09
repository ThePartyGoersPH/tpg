const nodemailer = require('nodemailer');

const _fromEmail = process.env.SMTP_USER || 'noreply@thepartygoersph.com';
const _fromName = 'The Party Goers PH';

let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  console.log('✅ SMTP email service initialized');
} else {
  console.warn('⚠️  SMTP credentials not set — emails will be logged to console only.');
}

async function _send(to, subject, html) {
  if (!transporter) {
    console.log(`📧 [EMAIL SKIPPED] To: ${to} | Subject: ${subject}`);
    return;
  }
  
  try {
    await transporter.sendMail({
      from: `"${_fromName}" <${_fromEmail}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.warn(`⚠️  Failed to send email to ${to}: ${error.message}`);
    console.log(`📧 [EMAIL SKIPPED] To: ${to} | Subject: ${subject}`);
  }
}

async function sendVerificationEmail(toEmail, firstName, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyLink = `${frontendUrl}/verify-email?token=${token}`;

  await _send(toEmail, 'Confirm your Party Goers account', `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a0000 0%,#111111 100%);padding:36px 40px 28px;border-bottom:1px solid rgba(204,0,0,0.2);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:1.4rem;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Party<span style="color:#CC0000;">Goers</span> PH</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#CC0000;">Verify Your Account</p>
              <h1 style="margin:0 0 16px;font-size:1.6rem;font-weight:800;color:#ffffff;line-height:1.2;">Hey ${firstName}, you're almost in! 🎉</h1>
              <p style="margin:0 0 28px;font-size:0.95rem;color:#888888;line-height:1.7;">
                Thanks for joining The Party Goers PH. Click the button below to confirm your email address and activate your account.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${verifyLink}" target="_blank"
                       style="display:inline-block;padding:14px 36px;background:#CC0000;color:#ffffff;text-decoration:none;border-radius:100px;font-size:0.95rem;font-weight:700;letter-spacing:0.5px;">
                      Verify My Email
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Fallback link -->
              <p style="margin:0 0 24px;font-size:0.78rem;color:#555555;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${verifyLink}" style="color:#CC0000;word-break:break-all;">${verifyLink}</a>
              </p>
              <!-- Note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#161616;border:1px solid rgba(255,255,255,0.06);border-left:3px solid #CC0000;border-radius:8px;padding:12px 16px;">
                    <p style="margin:0;font-size:0.78rem;color:#888888;line-height:1.6;">
                      ⏱️ This link expires in <strong style="color:#ffffff;">24 hours</strong>. If you did not create an account, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:0.72rem;color:#444444;text-align:center;">
                © ${new Date().getFullYear()} The Party Goers PH · Cavite, Philippines<br/>
                You're receiving this because you registered on our platform.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim());
}

async function sendBarOwnerVerificationEmail(toEmail, firstName, token) {
  const frontendUrl = process.env.BAR_OWNER_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyLink = `${frontendUrl}/verify-bar-owner-email?token=${token}`;

  await _send(toEmail, 'Verify your business registration email', `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;max-width:560px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#1a0000 0%,#111111 100%);padding:36px 40px 28px;border-bottom:1px solid rgba(204,0,0,0.2);">
              <span style="font-size:1.4rem;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Party<span style="color:#CC0000;">Goers</span> PH</span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#CC0000;">Verify Your Email</p>
              <h1 style="margin:0 0 16px;font-size:1.6rem;font-weight:800;color:#ffffff;line-height:1.2;">Hi ${firstName}, confirm your email</h1>
              <p style="margin:0 0 28px;font-size:0.95rem;color:#888888;line-height:1.7;">
                Please verify this email to continue with admin review of your business registration.
              </p>
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${verifyLink}" target="_blank"
                       style="display:inline-block;padding:14px 36px;background:#CC0000;color:#ffffff;text-decoration:none;border-radius:100px;font-size:0.95rem;font-weight:700;letter-spacing:0.5px;">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:0.78rem;color:#555555;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${verifyLink}" style="color:#CC0000;word-break:break-all;">${verifyLink}</a>
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#161616;border:1px solid rgba(255,255,255,0.06);border-left:3px solid #CC0000;border-radius:8px;padding:12px 16px;">
                    <p style="margin:0;font-size:0.78rem;color:#888888;line-height:1.6;">
                      ⏱️ This link expires in <strong style="color:#ffffff;">24 hours</strong>. If you did not submit a registration, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:0.72rem;color:#444444;text-align:center;">
                © ${new Date().getFullYear()} The Party Goers PH · Cavite, Philippines
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim());
}

async function sendBarApprovalEmail(toEmail, ownerName, businessName) {
  const loginUrl = process.env.BAR_OWNER_URL || 'https://barowner.thepartygoersph.com/login';

  await _send(toEmail, '🎉 Your Business Registration is Approved!', `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Registration Approved</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a0000 0%,#111111 100%);padding:36px 40px 28px;border-bottom:1px solid rgba(204,0,0,0.2);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:1.4rem;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Party<span style="color:#CC0000;">Goers</span> PH</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#22c55e;">✓ Registration Approved</p>
              <h1 style="margin:0 0 16px;font-size:1.6rem;font-weight:800;color:#ffffff;line-height:1.2;">Congratulations, ${ownerName}! 🎉</h1>
              <p style="margin:0 0 28px;font-size:0.95rem;color:#888888;line-height:1.7;">
                Great news! Your business registration for <strong style="color:#ffffff;">${businessName}</strong> has been approved by our team.
              </p>
              <p style="margin:0 0 28px;font-size:0.95rem;color:#888888;line-height:1.7;">
                You can now access the <strong style="color:#ffffff;">Bar Operations Platform</strong> to manage your business, events, promotions, and more.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${loginUrl}" target="_blank"
                       style="display:inline-block;padding:14px 36px;background:#CC0000;color:#ffffff;text-decoration:none;border-radius:100px;font-size:0.95rem;font-weight:700;letter-spacing:0.5px;">
                      Login to Bar Platform
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Login Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#161616;border:1px solid rgba(255,255,255,0.06);border-left:3px solid #22c55e;border-radius:8px;padding:16px;">
                    <p style="margin:0 0 12px;font-size:0.85rem;font-weight:700;color:#ffffff;">📧 Your Login Credentials</p>
                    <p style="margin:0 0 8px;font-size:0.78rem;color:#888888;line-height:1.6;">
                      <strong style="color:#ffffff;">Email:</strong> ${toEmail}<br/>
                      <strong style="color:#ffffff;">Password:</strong> The password you set during registration
                    </p>
                  </td>
                </tr>
              </table>
              <!-- Next Steps -->
              <p style="margin:0 0 12px;font-size:0.85rem;font-weight:700;color:#ffffff;">What's Next?</p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:0.85rem;color:#888888;line-height:1.8;">
                <li>Complete your bar profile and upload photos</li>
                <li>Set up your menu and pricing</li>
                <li>Create events and promotions</li>
                <li>Start accepting reservations</li>
              </ul>
              <!-- Support Note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#161616;border:1px solid rgba(255,255,255,0.06);border-left:3px solid #CC0000;border-radius:8px;padding:12px 16px;">
                    <p style="margin:0;font-size:0.78rem;color:#888888;line-height:1.6;">
                      💬 Need help? Contact our support team or check the platform documentation for guidance.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:0.72rem;color:#444444;text-align:center;">
                © ${new Date().getFullYear()} The Party Goers PH · Cavite, Philippines<br/>
                Welcome to our platform! We're excited to have you onboard.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim());
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteUploadUrl(path) {
  if (!path) return null;
  const trimmed = String(path).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = (process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/${trimmed.replace(/^\//, '')}`;
}

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Branded purchase-order email to a supplier.
 * opts: { bar: {name, logo_path, phone, address, email}, supplier: {name, contact_person},
 *         po: {id, items: [{item_name, quantity_ordered, unit_cost}], expected_delivery, notes, total_amount} }
 * Returns { sent: true } or throws on transport failure (caller decides UX).
 * Throws when no transporter is configured so failures are explicit, never silent.
 */
async function sendPurchaseOrderEmail(toEmail, opts = {}) {
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(toEmail))) {
    throw new Error('Supplier email is missing or invalid');
  }
  if (!transporter) {
    throw new Error('Email service is not configured (SMTP credentials missing)');
  }
  const { bar = {}, supplier = {}, po = {} } = opts;
  const barName = bar.name || 'Our bar';
  const contactName = supplier.contact_person || supplier.name || 'Supplier Partner';
  const logoUrl = absoluteUploadUrl(bar.logo_path || bar.image_path);
  const items = Array.isArray(po.items) ? po.items : [];
  const itemRows = items.map((it, i) => `
                <tr>
                  <td style="padding:10px 12px;font-size:0.85rem;color:#cccccc;border-bottom:1px solid rgba(255,255,255,0.06);">${i + 1}. ${escapeHtml(it.item_name)}</td>
                  <td align="center" style="padding:10px 12px;font-size:0.85rem;color:#cccccc;border-bottom:1px solid rgba(255,255,255,0.06);">${escapeHtml(it.quantity_ordered)}</td>
                  <td align="right" style="padding:10px 12px;font-size:0.85rem;color:#cccccc;border-bottom:1px solid rgba(255,255,255,0.06);">${peso(it.unit_cost)}</td>
                  <td align="right" style="padding:10px 12px;font-size:0.85rem;color:#ffffff;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.06);">${peso(Number(it.quantity_ordered || 0) * Number(it.unit_cost || 0))}</td>
                </tr>`).join('');
  const total = peso(po.total_amount ?? items.reduce((s, it) => s + Number(it.quantity_ordered || 0) * Number(it.unit_cost || 0), 0));
  const delivery = po.expected_delivery ? escapeHtml(po.expected_delivery) : '—';
  const notes = po.notes ? escapeHtml(po.notes) : '—';
  const barContact = [bar.phone, bar.address, bar.email].filter(Boolean).map(escapeHtml).join(' &nbsp;·&nbsp; ');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Purchase Order #${escapeHtml(po.id ?? '')} from ${escapeHtml(barName)}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);max-width:600px;width:100%;">
          <!-- Header: bar logo + name -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a0000 0%,#111111 100%);padding:28px 36px;border-bottom:2px solid #C9762F;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${logoUrl ? `<td width="64" valign="middle"><img src="${logoUrl}" alt="${escapeHtml(barName)}" width="52" height="52" style="display:block;border-radius:10px;object-fit:cover;" /></td><td width="12"></td>` : ''}
                  <td valign="middle">
                    <div style="font-size:1.25rem;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">${escapeHtml(barName)}</div>
                    <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#C9762F;margin-top:4px;">Purchase Order Request</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              <p style="margin:0 0 16px;font-size:0.95rem;color:#cccccc;line-height:1.7;">Dear ${escapeHtml(contactName)},</p>
              <p style="margin:0 0 8px;font-size:0.95rem;color:#cccccc;line-height:1.7;">
                Warm greetings from <strong style="color:#ffffff;">${escapeHtml(barName)}</strong>! We would like to place the following order
                (PO <strong style="color:#ffffff;">#${escapeHtml(po.id ?? '')}</strong>):
              </p>
              <!-- Order table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;background:#161616;border:1px solid rgba(255,255,255,0.06);border-radius:10px;">
                <tr>
                  <td style="padding:10px 12px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9762F;border-bottom:1px solid rgba(201,118,47,0.3);">Item</td>
                  <td align="center" style="padding:10px 12px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9762F;border-bottom:1px solid rgba(201,118,47,0.3);">Qty</td>
                  <td align="right" style="padding:10px 12px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9762F;border-bottom:1px solid rgba(201,118,47,0.3);">Unit</td>
                  <td align="right" style="padding:10px 12px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#C9762F;border-bottom:1px solid rgba(201,118,47,0.3);">Amount</td>
                </tr>
                ${itemRows}
                <tr>
                  <td colspan="3" align="right" style="padding:12px;font-size:0.85rem;font-weight:700;color:#888888;">Estimated Total</td>
                  <td align="right" style="padding:12px;font-size:1rem;font-weight:800;color:#C9762F;">${total}</td>
                </tr>
              </table>
              <!-- Meta -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 4px;">
                <tr>
                  <td style="padding:6px 0;font-size:0.85rem;color:#888888;">Requested delivery date: <strong style="color:#ffffff;">${delivery}</strong></td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:0.85rem;color:#888888;">Notes: <span style="color:#cccccc;">${notes}</span></td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:0.9rem;color:#cccccc;line-height:1.7;">
                Kindly confirm availability at your earliest convenience. You may reach us directly at:<br/>
                <span style="color:#ffffff;">${barContact || 'See our Bar Management profile for contact details.'}</span>
              </p>
              <p style="margin:16px 0 0;font-size:0.9rem;color:#cccccc;">Thank you for your continued partnership!</p>
              <p style="margin:8px 0 0;font-size:0.9rem;color:#ffffff;font-weight:700;">— The ${escapeHtml(barName)} Team</p>
            </td>
          </tr>
          <!-- Footer: platform watermark -->
          <tr>
            <td style="padding:18px 36px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:0.7rem;color:#555555;text-align:center;letter-spacing:0.3px;">
                Powered by <span style="font-weight:800;color:#777777;">The Party <span style="color:#C9762F;">Goers</span></span> · Cavite, Philippines
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  await transporter.sendMail({
    from: `"${barName} via ${_fromName}" <${_fromEmail}>`,
    to: toEmail,
    subject: `Purchase Order #${po.id ?? ''} from ${barName}`,
    html,
  });
  console.log(`✅ PO email sent to ${toEmail} (PO #${po.id ?? '?'})`);
  return { sent: true };
}

async function sendPasswordResetEmail(toEmail, firstName, token, portal = 'customer') {
  const frontendUrl = portal === 'manager'
    ? (process.env.BAR_OWNER_APP_URL || (process.env.NODE_ENV === 'production' ? 'https://baroperations.thepartygoers.fun' : 'http://localhost:5174'))
    : (process.env.FRONTEND_URL || 'http://localhost:5173');
  const resetLink = `${frontendUrl}/reset-password?token=${token}`;

  await _send(toEmail, 'Reset your Party Goers password', `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a0000 0%,#111111 100%);padding:36px 40px 28px;border-bottom:1px solid rgba(204,0,0,0.2);">
              <span style="font-size:1.4rem;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Party<span style="color:#CC0000;">Goers</span> PH</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#CC0000;">Password Reset</p>
              <h1 style="margin:0 0 16px;font-size:1.6rem;font-weight:800;color:#ffffff;line-height:1.2;">Hey ${firstName}, reset your password</h1>
              <p style="margin:0 0 28px;font-size:0.95rem;color:#888888;line-height:1.7;">
                We received a request to reset your password. Click the button below to choose a new one. If you didn't request this, you can safely ignore this email.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${resetLink}" target="_blank"
                       style="display:inline-block;padding:14px 36px;background:#CC0000;color:#ffffff;text-decoration:none;border-radius:100px;font-size:0.95rem;font-weight:700;letter-spacing:0.5px;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Fallback link -->
              <p style="margin:0 0 24px;font-size:0.78rem;color:#555555;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${resetLink}" style="color:#CC0000;word-break:break-all;">${resetLink}</a>
              </p>
              <!-- Note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#161616;border:1px solid rgba(255,255,255,0.06);border-left:3px solid #CC0000;border-radius:8px;padding:12px 16px;">
                    <p style="margin:0;font-size:0.78rem;color:#888888;line-height:1.6;">
                      This link expires in <strong style="color:#ffffff;">1 hour</strong>. If you did not request a password reset, no action is needed.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:0.72rem;color:#444444;text-align:center;">
                © ${new Date().getFullYear()} The Party Goers PH · Cavite, Philippines<br/>
                You're receiving this because a password reset was requested for your account.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim());
}

/**
 * Staff onboarding email with login credentials.
 * opts: { firstName, barName, role, email, defaultPassword, isDefaultPassword }
 * Never throws — delivery failures are logged inside _send so callers can
 * fire-and-forget without risking the staff-creation request.
 */
async function sendStaffOnboardingEmail(toEmail, opts = {}) {
  const firstName = String(opts.firstName || 'there').trim() || 'there';
  const barName = String(opts.barName || 'your bar').trim() || 'your bar';
  const roleRaw = String(opts.role || 'staff').toLowerCase();
  const roleLabels = { staff: 'Staff', hr: 'HR', finance: 'Finance', cashier: 'Cashier', manager: 'Manager' };
  const roleLabel = roleLabels[roleRaw] || 'Staff';
  const portalUrl = (process.env.BAR_OWNER_APP_URL || 'http://localhost:5174').replace(/\/$/, '');
  const passwordLabel = opts.isDefaultPassword === false ? 'Temporary Password' : 'Default Password';

  await _send(toEmail, `Welcome to ${barName} - Your Staff Account Credentials`, `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to ${escapeHtml(barName)}</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a0000 0%,#111111 100%);padding:36px 40px 28px;border-bottom:1px solid rgba(204,0,0,0.2);">
              <span style="font-size:1.4rem;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Party<span style="color:#CC0000;">Goers</span> PH</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#CC0000;">Staff Onboarding</p>
              <h1 style="margin:0 0 16px;font-size:1.6rem;font-weight:800;color:#ffffff;line-height:1.2;">Hello ${escapeHtml(firstName)}, welcome aboard! 🎉</h1>
              <p style="margin:0 0 28px;font-size:0.95rem;color:#888888;line-height:1.7;">
                You have been registered as a staff member for <strong style="color:#ffffff;">${escapeHtml(barName)}</strong>. Below are your login credentials to access the portal:
              </p>
              <!-- Credentials Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#161616;border:1px solid rgba(255,255,255,0.06);border-left:3px solid #CC0000;border-radius:8px;padding:16px;">
                    <p style="margin:0 0 12px;font-size:0.85rem;font-weight:700;color:#ffffff;">🔑 Your Login Credentials</p>
                    <p style="margin:0 0 8px;font-size:0.82rem;color:#888888;line-height:1.8;">
                      <strong style="color:#ffffff;">Portal URL:</strong> <a href="${escapeHtml(portalUrl)}" style="color:#CC0000;">${escapeHtml(portalUrl)}</a><br/>
                      <strong style="color:#ffffff;">Role:</strong> ${escapeHtml(roleLabel)}<br/>
                      <strong style="color:#ffffff;">Email:</strong> ${escapeHtml(toEmail)}<br/>
                      <strong style="color:#ffffff;">${passwordLabel}:</strong> <code style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:2px 8px;color:#ffffff;font-size:0.85rem;">${escapeHtml(opts.defaultPassword || '')}</code>
                    </p>
                  </td>
                </tr>
              </table>
              <!-- Security Advice -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#161616;border:1px solid rgba(255,255,255,0.06);border-left:3px solid #fbbf24;border-radius:8px;padding:12px 16px;">
                    <p style="margin:0;font-size:0.78rem;color:#888888;line-height:1.6;">
                      🔒 <strong style="color:#ffffff;">Security advice:</strong> Please log in and update your password immediately after your first login.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:0.72rem;color:#444444;text-align:center;">
                © ${new Date().getFullYear()} The Party Goers PH · Cavite, Philippines<br/>
                You're receiving this because a staff account was created for you at ${escapeHtml(barName)}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim());
}

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@thepartygoersph.com';

async function sendCustomerApprovalEmail(toEmail, firstName) {
  const safeName = String(firstName || 'there');
  await _send(toEmail, 'Your Party Goers account is approved', `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Account approved</title></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#1a0000 0%,#111111 100%);padding:36px 40px 28px;border-bottom:1px solid rgba(204,0,0,0.2);">
          <span style="font-size:1.4rem;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Party<span style="color:#CC0000;">Goers</span> PH</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#CC0000;">Account Approved</p>
          <h1 style="margin:0 0 16px;font-size:1.6rem;font-weight:800;color:#ffffff;line-height:1.2;">Hey ${safeName}, you're in!</h1>
          <p style="margin:0 0 28px;font-size:0.95rem;color:#888888;line-height:1.7;">
            Your account has been approved. You can now log in and start discovering bars, booking tables, and joining events.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`);
}

async function sendCustomerRejectionEmail(toEmail, firstName, reason) {
  const safeName = String(firstName || 'there');
  const safeReason = String(reason || '').trim();
  await _send(toEmail, 'Update on your Party Goers registration', `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Registration update</title></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid rgba(255,255,255,0.06);max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#1a0000 0%,#111111 100%);padding:36px 40px 28px;border-bottom:1px solid rgba(204,0,0,0.2);">
          <span style="font-size:1.4rem;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Party<span style="color:#CC0000;">Goers</span> PH</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#CC0000;">Registration Update</p>
          <h1 style="margin:0 0 16px;font-size:1.6rem;font-weight:800;color:#ffffff;line-height:1.2;">Hey ${safeName}, an update on your registration</h1>
          <p style="margin:0 0 16px;font-size:0.95rem;color:#888888;line-height:1.7;">
            Your registration was not approved at this time${safeReason ? ` for the following reason: <strong style="color:#ffffff;">${safeReason}</strong>` : '.'}
          </p>
          <p style="margin:0;font-size:0.95rem;color:#888888;line-height:1.7;">
            If you think this is a mistake, please contact our support team at ${SUPPORT_EMAIL}.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`);
}

module.exports = { sendVerificationEmail, sendBarOwnerVerificationEmail, sendBarApprovalEmail, sendPasswordResetEmail, sendPurchaseOrderEmail, sendStaffOnboardingEmail, sendCustomerApprovalEmail, sendCustomerRejectionEmail };
