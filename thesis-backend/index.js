require("dotenv").config();

// Use UTC for all timestamps to ensure consistency with frontend
// Frontend will handle timezone conversion for display
process.env.TZ = 'UTC';

// Startup env check
console.log('[ENV CHECK] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET ✅' : 'MISSING ❌');

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { sanitizeInput } = require("./middlewares/sanitize");
const { uploadFallback, ensureDefaults } = require("./middlewares/uploadFallback");

// Import routes
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");
const ownerRoutes = require("./routes/owner");
const hrRoutes = require("./routes/hr");
const hrPermissionsRoutes = require("./routes/hrPermissions");
const attendanceRoutes = require("./routes/attendance");
const leaveRoutes = require("./routes/leave");
const leaveBalanceRoutes = require("./routes/leaveBalance");
const hrDocumentsRoutes = require("./routes/hrDocuments");
const payrollRoutes = require("./routes/hrPayroll");
const deductionSettingsRoutes = require("./routes/deductionSettings");
const reservationRoutes = require("./routes/reservations");
const dssRoutes = require("./routes/dss");
const inventoryRoutes = require("./routes/inventory");
const superAdminRoutes = require("./routes/superAdmin");
const barRegistrationRoutes = require("./routes/barRegistration");
const tpsRoutes = require("./routes/tps");
const procurementRoutes = require("./routes/procurement");
const supplyChainRoutes = require("./routes/supplyChain");
const payrollFinanceRoutes = require("./routes/payrollFinance");
const publicBarsRoutes = require("./routes/publicBars");
const reviewsRoutes = require("./routes/reviews");
const posRoutes = require("./routes/pos");
const socialRoutes = require("./routes/social");
const mediaEngagementRoutes = require("./routes/mediaEngagement");
const promotionsRoutes = require("./routes/promotions");
const subscriptionsRoutes = require("./routes/subscriptions");
const analyticsRoutes = require("./routes/analytics");
const crmRoutes = require("./routes/crm");
const ownerReviewsRoutes = require("./routes/ownerReviews");
const branchesRoutes = require("./routes/branches");
const paymentsRoutes = require("./routes/payments");
const marketplaceRoutes = require("./routes/marketplace");
const subscriptionPaymentsRoutes = require("./routes/subscriptionPayments");
const paymongoWebhookRoutes = require("./routes/paymongoWebhook");
const stripeWebhookRoutes = require("./routes/stripeWebhook");
const posPaymentsRoutes = require("./routes/posPayments");
const posShiftCashRoutes = require("./routes/posShiftCash");
const payoutsRoutes = require("./routes/payouts");
const paymentCheckRoutes = require("./routes/paymentCheck");
const financialsRoutes = require("./routes/financials");
const superAdminPaymentsRoutes = require("./routes/superAdminPayments");
const feedWidgetsRoutes = require("./routes/feedWidgets");
const statsRoutes = require('./routes/stats');
const customerOrdersRoutes = require('./routes/customerOrders');
const permitMonitoringRoutes = require('./routes/permitMonitoring');

const app = express();
const server = http.createServer(app);
const isTestEnv = process.env.NODE_ENV === "test";
const isProdEnv = process.env.NODE_ENV === "production";

const BASE_PROD_ORIGINS = [
  'https://superadmin.thepartygoers.fun',
  'https://baroperations.thepartygoers.fun',
  'https://api.thepartygoers.fun',
  'https://thepartygoers.fun',
  'https://www.thepartygoers.fun',
  'https://customer.thepartygoers.fun',
  'https://pos.thepartygoers.fun',
];

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
];

const INSECURE_PROD_HTTP_ORIGINS = [
  'http://thepartygoers.fun',
  'http://www.thepartygoers.fun',
  'http://customer.thepartygoers.fun',
  'http://pos.thepartygoers.fun',
];

const allowInsecureHttpOrigins = String(process.env.ALLOW_INSECURE_HTTP_ORIGINS || '').toLowerCase() === 'true';
// Explicit allowlist from env (comma-separated, trimmed). This is the knob
// for new domains: CORS_ORIGINS=https://thepartygoers.partygoers.online
const envOrigins = String(process.env.CORS_ORIGINS || process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const extraOrigins = String(process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOriginList = [
  ...BASE_PROD_ORIGINS,
  ...LOCAL_DEV_ORIGINS,
  ...(allowInsecureHttpOrigins ? INSECURE_PROD_HTTP_ORIGINS : []),
  ...envOrigins,
  ...extraOrigins.filter((o) => !envOrigins.includes(o)),
];

const socketOriginList = [
  ...BASE_PROD_ORIGINS,
  ...LOCAL_DEV_ORIGINS,
  ...(allowInsecureHttpOrigins ? INSECURE_PROD_HTTP_ORIGINS : []),
  ...envOrigins,
  ...extraOrigins.filter((o) => !envOrigins.includes(o)),
];

// Behind nginx/Cloudflare in production, the first proxy must be trusted so
// rate limiting and req.ip use X-Forwarded-For. TRUST_PROXY=false (or 0)
// disables it for direct local runs; anything else (including unset) keeps
// the historical default of trusting one hop.
const trustProxyRaw = String(process.env.TRUST_PROXY ?? '1').trim().toLowerCase();
const trustProxyOn = !['false', '0', 'no', 'off', ''].includes(trustProxyRaw);
if (trustProxyOn) {
  app.set("trust proxy", Number.isFinite(Number(trustProxyRaw)) && Number(trustProxyRaw) > 1 ? Number(trustProxyRaw) : 1);
}

// Startup line: environment at a glance, values only — never secrets.
console.log(
  `[ENV] NODE_ENV=${process.env.NODE_ENV || 'development'} ` +
  `APP_URL=${process.env.APP_URL || '(default production)'} ` +
  `CORS_ORIGINS=${corsOriginList.length ? corsOriginList.join(',') : '(none)'} ` +
  `TRUST_PROXY=${trustProxyOn ? 'on' : 'off'} ` +
  `MAIL=${String(process.env.MAIL_ENABLED || '').toLowerCase() === 'true' ? 'enabled' : 'console-only'}`
);

// ── Security headers (helmet) ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow serving uploads cross-origin
  // GIS (Google button / One Tap) renders cross-origin popups and iframes:
  // disowning them with same-origin breaks the handshake, so allow popups.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'", 'https:', 'wss:'],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'", 'https:'],
      frameAncestors: ["'none'"],
      // Google Identity Services hosts (button iframe + script). These matter
      // when Express itself serves the SPA (local dev); nginx-served static
      // files carry no CSP header anyway.
      frameSrc: ["'self'", 'https://accounts.google.com'],
      imgSrc: ["'self'", 'https:', 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", 'https://accounts.google.com'],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      upgradeInsecureRequests: [],
    },
  },
}));

// ── CORS – allow local frontend origins ─────────────────────────────────────
app.use(cors({
  origin: [
    ...corsOriginList,
    // Flutter web dev server (dynamic ports)
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
  credentials: true,
}));

// ── Rate limiters ──────────────────────────────────────────────────────────
const authWindowMs = Number(process.env.AUTH_WINDOW_MS || 15 * 60 * 1000);
const authMaxAttempts = Number(process.env.AUTH_MAX_ATTEMPTS || 20);

function normalizeCredential(value) {
  return String(value || "").trim().toLowerCase();
}

const loginLimiter = rateLimit({
  windowMs: authWindowMs, // default 15 minutes
  max: authMaxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  // Shared NAT/public IPs (same Wi-Fi) should not block different accounts.
  keyGenerator: (req) => {
    const email = normalizeCredential(req.body?.email);
    return email || "unknown";
  },
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: authWindowMs, // default 15 minutes
  max: authMaxAttempts,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});

const authSessionLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 500,                  // generous limit for session checks (/me, /refresh, etc.)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

// Apply global API rate limit
app.use(apiLimiter);

// PayMongo webhook requires raw body for signature verification / event parsing.
// Mount it before express.json() so the payload is not pre-parsed.
app.use("/webhook/paymongo", paymongoWebhookRoutes);
// Stripe webhook likewise needs the raw body for signature verification.
app.use("/webhook/stripe", stripeWebhookRoutes);
app.use("/api/payments", posPaymentsRoutes);
app.use(express.json({ limit: '2mb' }));
app.use(sanitizeInput); // strip null bytes, trim strings, enforce length limits
app.use("/uploads", express.static("uploads"));
app.use(uploadFallback); // Serve default avatar for missing profile images (prevents 404 spam)

const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: {
    origin: socketOriginList,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

io.use((socket, next) => {
  try {
    const authToken = socket.handshake?.auth?.token || '';
    const token = authToken || String(socket.handshake?.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      return next(new Error('Unauthorized'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    if (decoded?.bar_id) {
      socket.join(`bar:${decoded.bar_id}`);
    }
    return next();
  } catch (_) {
    return next(new Error('Unauthorized'));
  }
});

app.set('io', io);

// Routes
app.use("/health", (req, res) => {
  res.json({
    ok: true,
    message: "API is running",
  });
});

// PayMongo payment callback pages (shown after redirect)
app.get("/payment/success", async (req, res) => {
  const referenceId = String(req.query?.ref || '').trim();
  const reservationId = String(req.query?.reservation_id || '').trim();
  const appParam = String(req.query?.app || '').trim().toLowerCase();
  const userAgent = String(req.headers['user-agent'] || '');
  const isMobileBrowser = /android|iphone|ipad|ipod/i.test(userAgent);
  const openInApp = appParam === '1' || (appParam !== '0' && isMobileBrowser);
  const webFallback = process.env.FRONTEND_URL || 'https://thepartygoers.fun';
  const callbackParams = new URLSearchParams();
  if (referenceId) callbackParams.set('ref', referenceId);
  if (reservationId) callbackParams.set('reservation_id', reservationId);
  const callbackQuery = callbackParams.toString();
  const appDeepLink = `tpgcustomer:///payment/success${callbackQuery ? `?${callbackQuery}` : ''}`;

  if (referenceId && referenceId.toUpperCase().startsWith('POS-') && typeof posPaymentsRoutes.reconcileByReference === 'function') {
    try {
      await posPaymentsRoutes.reconcileByReference(referenceId, app, 'redirect-success');
    } catch (err) {
      console.error('[PAYMENT SUCCESS REDIRECT] POS reconciliation failed:', err?.message || err);
    }
  }

  res.send(`<!DOCTYPE html><html><head><title>Payment Successful</title>
    <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A0A0A;font-family:system-ui,sans-serif;color:#fff}
    .card{text-align:center;padding:48px;border-radius:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1)}
    .icon{font-size:64px;margin-bottom:16px}h1{margin:0 0 8px;font-size:24px}p{color:#999;margin:0 0 24px;font-size:15px}
    .btn{display:inline-block;padding:12px 32px;background:#CC0000;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px}
    .btn2{display:inline-block;padding:10px 24px;background:transparent;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid rgba(255,255,255,0.25);margin-top:10px}
    </style>${openInApp ? `<script>
      setTimeout(function(){ window.location.href = ${JSON.stringify(appDeepLink)}; }, 80);
      setTimeout(function(){ window.location.href = ${JSON.stringify(appDeepLink)}; }, 650);
      setTimeout(function(){ window.location.href = ${JSON.stringify(webFallback)}; }, 3200);
    </script>` : ''}</head>
    <body><div class="card"><div class="icon">✅</div><h1>Payment Successful!</h1>
    <p>Your payment has been confirmed.<br>${openInApp ? 'Opening the mobile app...' : 'You can close this tab and return to the app.'}</p>
    <a href="${openInApp ? appDeepLink : webFallback}" class="btn">${openInApp ? 'Open App' : 'Back to Site'}</a>
    ${openInApp ? `<br/><a href="${webFallback}" class="btn2">Continue on Web</a>` : ''}
    </div></body></html>`);
});

app.get("/payment/failed", (req, res) => {
  const referenceId = String(req.query?.ref || '').trim();
  const reservationId = String(req.query?.reservation_id || '').trim();
  const appParam = String(req.query?.app || '').trim().toLowerCase();
  const userAgent = String(req.headers['user-agent'] || '');
  const isMobileBrowser = /android|iphone|ipad|ipod/i.test(userAgent);
  const openInApp = appParam === '1' || (appParam !== '0' && isMobileBrowser);
  const webFallback = process.env.FRONTEND_URL || 'https://thepartygoers.fun';
  const callbackParams = new URLSearchParams();
  if (referenceId) callbackParams.set('ref', referenceId);
  if (reservationId) callbackParams.set('reservation_id', reservationId);
  const callbackQuery = callbackParams.toString();
  const appDeepLink = `tpgcustomer:///payment/failed${callbackQuery ? `?${callbackQuery}` : ''}`;

  res.send(`<!DOCTYPE html><html><head><title>Payment Failed</title>
    <style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0A0A0A;font-family:system-ui,sans-serif;color:#fff}
    .card{text-align:center;padding:48px;border-radius:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1)}
    .icon{font-size:64px;margin-bottom:16px}h1{margin:0 0 8px;font-size:24px}p{color:#999;margin:0 0 24px;font-size:15px}
    .btn{display:inline-block;padding:12px 32px;background:#CC0000;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px}
    .btn2{display:inline-block;padding:10px 24px;background:transparent;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid rgba(255,255,255,0.25);margin-top:10px}
    </style>${openInApp ? `<script>
      setTimeout(function(){ window.location.href = ${JSON.stringify(appDeepLink)}; }, 80);
      setTimeout(function(){ window.location.href = ${JSON.stringify(appDeepLink)}; }, 650);
      setTimeout(function(){ window.location.href = ${JSON.stringify(webFallback)}; }, 3200);
    </script>` : ''}</head>
    <body><div class="card"><div class="icon">❌</div><h1>Payment Failed</h1>
    <p>Something went wrong with your payment.<br>${openInApp ? 'Opening the mobile app...' : 'You can close this tab and try again in the app.'}</p>
    <a href="${openInApp ? appDeepLink : webFallback}" class="btn">${openInApp ? 'Open App' : 'Back to Site'}</a>
    ${openInApp ? `<br/><a href="${webFallback}" class="btn2">Continue on Web</a>` : ''}
    </div></body></html>`);
});

const enableDbTestEndpoint =
  !isProdEnv ||
  String(process.env.ENABLE_DB_TEST_ENDPOINT || "").toLowerCase() === "true";

if (enableDbTestEndpoint) {
  app.use("/db-test", async (req, res) => {
    try {
      const pool = require("./config/database");
      const [rows] = await pool.query("SELECT 1 AS test");
      res.json({
        ok: true,
        rows,
      });
    } catch (err) {
      console.error("DB ERROR:", err.message);
      res.status(500).json({
        ok: false,
        message: "DB connection failed",
      });
    }
  });
}

// API Routes
app.use("/admin", adminRoutes);
app.use("/super-admin", superAdminRoutes);
app.use("/bar-registration", barRegistrationRoutes);
app.use("/tps", tpsRoutes);
app.use("/procurement", procurementRoutes);
app.use("/supply-chain", supplyChainRoutes);
app.use("/payroll-finance", payrollFinanceRoutes);
// Strict rate limit only on sensitive auth actions
app.use("/auth/login", loginLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth/forgot-password", authLimiter);
app.use("/auth/reset-password", authLimiter);
app.use("/auth/google", authLimiter);
// Session checks (/me, /verify-email, etc.) use the generous limiter
app.use("/auth", authSessionLimiter, authRoutes);
app.use("/owner", ownerRoutes);
app.use("/hr", hrRoutes);
app.use("/hr", hrPermissionsRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/leave-balance", leaveBalanceRoutes);
app.use("/", hrDocumentsRoutes);
app.use("/hr/payroll", payrollRoutes);
app.use("/hr/payroll", deductionSettingsRoutes);
// Public browse endpoints
app.use("/public", publicBarsRoutes);
app.use("/public", reviewsRoutes);
app.use("/public", reservationRoutes);
// Customer reservation actions + Owner reservation management share same file paths above
app.use("/", reservationRoutes);
app.use("/", dssRoutes);
app.use("/", inventoryRoutes);
app.use("/hr", require("./routes/hrAuditLogs"));
// POS system routes
app.use("/pos", posRoutes);
// POS cash shift management routes
app.use("/api", posShiftCashRoutes);
// Social / community routes (follows, likes, comments, notifications, etc.)
app.use("/social", socialRoutes);
app.use("/media", mediaEngagementRoutes);
// Platform feedback (customer reviews of the platform itself)
app.use("/platform-feedback", require("./routes/platformFeedback"));
// Promotions management (bar owners)
app.use("/promotions", promotionsRoutes);
// Subscription plans & management
app.use("/subscriptions", subscriptionsRoutes);
// Analytics & dashboard stats
app.use("/analytics", analyticsRoutes);
app.use("/crm", crmRoutes);
// Owner-side review management
app.use("/owner-reviews", ownerReviewsRoutes);
// Multi-branch management
app.use("/branches", branchesRoutes);
// Payment processing (customer orders/reservations)
app.use("/payments", paymentsRoutes);
// Marketplace (PayMongo Platforms child-merchant onboarding)
app.use("/marketplace", marketplaceRoutes);
// Subscription payment processing
app.use("/subscription-payments", subscriptionPaymentsRoutes);
// Payout management (bar owner earnings)
app.use("/payouts", payoutsRoutes);
// Payment verification (for local development)
app.use("/payment-check", paymentCheckRoutes);
// Financial analytics (auto-payout, cashflow)
app.use("/owner/financials", financialsRoutes);
// Super Admin payment control
app.use("/super-admin-payments", superAdminPaymentsRoutes);
// Feed widgets (sidebar data for customer app)
app.use("/feed-widgets", feedWidgetsRoutes);
// Platform statistics
app.use("/stats", statsRoutes);
// Customer web ordering (tax-aware)
app.use("/customer-orders", customerOrdersRoutes);
// Permit expiry monitoring (super admin)
app.use("/permit-monitoring", permitMonitoringRoutes);

// ── Serve customer website (built SPA) ──
const path = require('path');
const customerDist = path.join(__dirname, '..', 'customer_website', 'dist');
app.use(express.static(customerDist));
// SPA catch-all: return index.html for any non-API, non-upload route
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/webhook')) {
    return next();
  }
  res.sendFile(path.join(customerDist, 'index.html'));
});

// Create default avatar on startup
if (!isTestEnv) {
  ensureDefaults();

  // ── Reservation Reminder Scheduler ──
  // Send reminder notifications every 4 hours for reservations happening today
  const { sendTodayReservationReminders } = require('./utils/reservationReminders');
  const { processNoShowReservations } = require('./utils/reservationNoShow');
  const { startScheduler } = require('./jobs/scheduler');
  const { runSubscriptionExpiryCheck } = require('./jobs/subscriptionExpiry');

  // Run immediately on startup
  sendTodayReservationReminders().catch(err => {
    console.error('[STARTUP] Failed to send initial reservation reminders:', err);
  });

  // Schedule to run every 4 hours (14400000 ms)
  setInterval(() => {
    sendTodayReservationReminders().catch(err => {
      console.error('[SCHEDULER] Failed to send reservation reminders:', err);
    });
  }, 4 * 60 * 60 * 1000);

  console.log('✅ Reservation reminder scheduler initialized (runs every 4 hours)');

  // ── Permit Expiry Scheduler ──
  startScheduler();

  // ── Subscription Expiry Scheduler ──
  runSubscriptionExpiryCheck().catch((err) =>
    console.error('[STARTUP] Initial subscription expiry check failed:', err)
  );
  setInterval(() => {
    runSubscriptionExpiryCheck().catch((err) =>
      console.error('[SCHEDULER] Subscription expiry check failed:', err)
    );
  }, 60 * 60 * 1000); // hourly

  // ── Reservation No-Show Scheduler ──
  setInterval(() => {
    processNoShowReservations().catch(err => {
      console.error('[SCHEDULER] Failed to process no-show reservations:', err);
    });
  }, 60 * 1000);

  // Global error handlers
  process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  });
}

if (require.main === module && !isTestEnv) {
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`💥 Port ${PORT} is already in use. Stop the other process (lsof -ti:${PORT} | xargs kill) and retry.`);
      process.exit(1);
    }
    console.error('💥 Server error:', err);
    process.exit(1);
  });
  server.listen(PORT, () => console.log("Server running on port " + PORT));
}

module.exports = { app, server };
