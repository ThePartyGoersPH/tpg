// Central lockout policy for every password login (customer, manager/bar
// owner, POS, super admin share POST /auth/login) plus Google-verify and
// forgot/register rate limits. Everything reads env with the defaults below.
//
//   LOGIN_MAX_ATTEMPTS=4        wrong passwords before an account locks
//   LOGIN_LOCK_BASE_MINUTES=5   first lock length; doubles per level:
//                               5 -> 10 -> 20 -> 40 -> 60 ...
//   LOGIN_LOCK_MAX_MINUTES=60   cap; locks never exceed this
//   LOGIN_QUIET_RESET_HOURS=24  no failures for this long resets level+count
//   LOGIN_IP_MAX_FAILURES=20    per-IP failures ...
//   LOGIN_IP_WINDOW_MINUTES=15  ... inside this window ...
//   LOGIN_IP_LOCK_MINUTES=5     ... trigger this IP cooldown
//   LOGIN_ROUTE_MAX=5           forgot-password / register attempts ...
//   LOGIN_ROUTE_WINDOW_MINUTES=15 ... per IP inside this window

function num(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

module.exports = {
  MAX_FAILED_ATTEMPTS: Math.floor(num("LOGIN_MAX_ATTEMPTS", 4)),
  LOCK_BASE_MINUTES: num("LOGIN_LOCK_BASE_MINUTES", 5),
  LOCK_MAX_MINUTES: num("LOGIN_LOCK_MAX_MINUTES", 60),
  QUIET_RESET_HOURS: num("LOGIN_QUIET_RESET_HOURS", 24),
  IP_MAX_FAILURES: Math.floor(num("LOGIN_IP_MAX_FAILURES", 20)),
  IP_WINDOW_MINUTES: num("LOGIN_IP_WINDOW_MINUTES", 15),
  IP_LOCK_MINUTES: num("LOGIN_IP_LOCK_MINUTES", 5),
  ROUTE_MAX: Math.floor(num("LOGIN_ROUTE_MAX", 5)),
  ROUTE_WINDOW_MINUTES: num("LOGIN_ROUTE_WINDOW_MINUTES", 15),
  // Address for "your account was locked" mail. Falls back to MAIL_FROM, then
  // the platform support address. Never printed — only used as a recipient.
  alertEmail() {
    return (
      process.env.SECURITY_ALERT_EMAIL ||
      process.env.MAIL_FROM ||
      process.env.SUPPORT_EMAIL ||
      "support@thepartygoersph.com"
    );
  },
};
