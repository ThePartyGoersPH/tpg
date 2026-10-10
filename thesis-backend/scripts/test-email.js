// SMTP probe: sends ONE test email and reports the exact result.
//   npm run test:email -- --to=you@example.com
// Prints host/port/user(only), never the password. Exit 0 on accept,
// non-zero with the SMTP reply (535 = bad credentials, 534 = app password
// required, ETIMEDOUT/ECONNREFUSED = port or network blocked).
// Forces production sending even in development so local runs prove the
// real path; dev-mode console printing is tested separately via the app.

const nodemailer = require("nodemailer");
require("dotenv").config();

function arg(name) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  const eq = hit.indexOf("=");
  return eq === -1 ? "" : hit.slice(eq + 1);
}

function mask(value) {
  const s = String(value || "");
  if (s.length <= 4) return "****";
  return `${s.slice(0, 2)}****${s.slice(-2)}`;
}

async function main() {
  const to = arg("to");
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Usage: npm run test:email -- --to=you@example.com");
    process.exitCode = 2;
    return;
  }

  const host = process.env.MAIL_HOST || process.env.SMTP_HOST;
  const port = parseInt(process.env.MAIL_PORT || process.env.SMTP_PORT || "587", 10);
  const user = process.env.MAIL_USER || process.env.SMTP_USER;
  const pass = process.env.MAIL_PASS || process.env.SMTP_PASSWORD;
  const from =
    process.env.MAIL_FROM ||
    (user ? `"The Party Goers PH" <${user}>` : "The Party Goers PH <noreply@thepartygoersph.com>");

  console.log(`SMTP probe -> host=${host || "(missing)"} port=${port} user=${mask(user)}`);
  if (!host || !user || !pass) {
    console.error("MISSING: set MAIL_HOST/MAIL_PORT/MAIL_USER/MAIL_PASS (or SMTP_* fallback) first.");
    process.exitCode = 2;
    return;
  }

  const secure = port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(secure ? {} : { requireTLS: true }),
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });

  try {
    await transporter.verify();
    console.log("SMTP handshake OK (server accepted the credentials).");
  } catch (err) {
    console.error(`VERIFY FAILED [${err.code || "no-code"}]: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: "PartyGoers SMTP probe — ignore this email",
      text: "If you received this, outbound mail works from this machine.",
    });
    console.log(`SENT accepted (message id ${info.messageId || "unknown"}). Check inbox AND spam.`);
  } catch (err) {
    console.error(`SEND FAILED [${err.code || "no-code"}]: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
