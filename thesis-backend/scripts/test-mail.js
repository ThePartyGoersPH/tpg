// End-to-end mail probe through the app's ONE shared wrapper.
//   node scripts/test-mail.js someone@gmail.com
// Loads .env, prints the effective config (host/port/provider/from — never
// secrets), verifies the connection, sends one test email, and prints the
// exact success or error. Honors MAIL_ENABLED like the app does: with it
// off, the message is printed to console instead of sent.

require("dotenv").config();

async function main() {
  const to = String(process.argv[2] || "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Usage: node scripts/test-mail.js someone@gmail.com");
    process.exitCode = 2;
    return;
  }

  const { sendMail, isMailEnabled, appUrl } = require("../utils/emailService");
  const provider = String(process.env.MAIL_PROVIDER || "smtp").trim().toLowerCase();
  const host = process.env.MAIL_HOST || process.env.SMTP_HOST;
  const port = process.env.MAIL_PORT || process.env.SMTP_PORT || "587";
  const from = process.env.MAIL_FROM || process.env.MAIL_USER || process.env.SMTP_USER || "(unset)";

  console.log(`Mail probe -> enabled=${isMailEnabled()} provider=${provider} host=${host || "(unset)"} port=${port} from=${from}`);
  console.log(`Mail probe -> APP_URL=${appUrl()}`);
  if (!isMailEnabled()) {
    console.log("MAIL_ENABLED is not \"true\": the message below is PRINTED, not sent.");
  }

  try {
    const result = await sendMail(
      to,
      "PartyGoers mail probe — ignore this email",
      "<p>If you received this, outbound mail works from this machine.</p>"
    );
    if (result && result.dev) {
      console.log("DONE (dev print mode — no real send). Check inbox AND spam for real sends.");
    } else {
      console.log("DONE: accepted. Check inbox AND spam.");
    }
  } catch (err) {
    console.error(`FAILED [${err.code || "no-code"}]: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
