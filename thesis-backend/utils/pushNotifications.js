const fs = require('fs');
const path = require('path');

let admin = null;
try {
  admin = require('firebase-admin');
} catch (_) {
  admin = null;
}

let initialized = false;
let warnedMissingConfig = false;

function parseJsonCandidate(raw, label) {
  const value = String(raw || '').trim();
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (_) {
    // Fallback for env values that are base64-encoded JSON.
  }

  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err) {
    console.error(`[PUSH] Invalid ${label}:`, err.message || err);
    return null;
  }
}

function loadServiceAccountFromFile(filePath, label) {
  const rawPath = String(filePath || '').trim();
  if (!rawPath) return null;

  const resolved = path.isAbsolute(rawPath)
    ? rawPath
    : path.join(process.cwd(), rawPath);

  try {
    const raw = fs.readFileSync(resolved, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[PUSH] Failed to read ${label}:`, err.message || err);
    return null;
  }
}

function loadServiceAccountFromEnvKeys() {
  const projectId = String(
    process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || ''
  ).trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKeyRaw = String(process.env.FIREBASE_PRIVATE_KEY || '').trim();
  if (!projectId || !clientEmail || !privateKeyRaw) return null;

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKeyRaw.replace(/\\n/g, '\n'),
  };
}

function loadServiceAccount() {
  const fromJsonEnv = parseJsonCandidate(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    'FIREBASE_SERVICE_ACCOUNT_JSON'
  );
  if (fromJsonEnv) return fromJsonEnv;

  const fromServiceAccountPath = loadServiceAccountFromFile(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    'FIREBASE_SERVICE_ACCOUNT_PATH'
  );
  if (fromServiceAccountPath) return fromServiceAccountPath;

  const fromGoogleCredentialsPath = loadServiceAccountFromFile(
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    'GOOGLE_APPLICATION_CREDENTIALS'
  );
  if (fromGoogleCredentialsPath) return fromGoogleCredentialsPath;

  const fromDiscreteEnv = loadServiceAccountFromEnvKeys();
  if (fromDiscreteEnv) return fromDiscreteEnv;

  return null;
}

function ensureInitialized() {
  if (initialized) return true;

  if (!admin) {
    if (!warnedMissingConfig) {
      console.warn('[PUSH] firebase-admin is not installed. Push delivery is disabled.');
      warnedMissingConfig = true;
    }
    return false;
  }

  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    if (!warnedMissingConfig) {
      console.warn(
        '[PUSH] Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.'
      );
      warnedMissingConfig = true;
    }
    return false;
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    initialized = true;
    console.log('[PUSH] Firebase Admin initialized.');
    return true;
  } catch (err) {
    console.error('[PUSH] Firebase initialization failed:', err.message || err);
    return false;
  }
}

function isPushEnabled() {
  return ensureInitialized();
}

function normalizeDataMap(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === null || value === undefined) continue;
    out[key] = String(value);
  }
  return out;
}

function isTokenInvalidError(err) {
  const code = String(err?.code || '');
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}

async function sendPushToToken(token, { title, body, data = {} }) {
  if (!ensureInitialized()) {
    return {
      success: false,
      skipped: true,
      invalidToken: false,
      errorCode: 'push/not-configured',
      errorMessage: 'Push service not configured',
    };
  }

  const trimmed = String(token || '').trim();
  if (!trimmed) {
    return {
      success: false,
      skipped: true,
      invalidToken: true,
      errorCode: 'push/empty-token',
      errorMessage: 'Empty token',
    };
  }

  const message = {
    token: trimmed,
    notification: {
      title: String(title || 'Notification'),
      body: String(body || ''),
    },
    android: {
      priority: 'high',
      notification: {
        priority: 'max',
        visibility: 'public',
      },
    },
    data: normalizeDataMap(data),
  };

  try {
    const messageId = await admin.messaging().send(message);
    return {
      success: true,
      skipped: false,
      invalidToken: false,
      messageId,
    };
  } catch (err) {
    return {
      success: false,
      skipped: false,
      invalidToken: isTokenInvalidError(err),
      errorCode: String(err?.code || 'push/send-failed'),
      errorMessage: String(err?.message || 'Push send failed'),
    };
  }
}

module.exports = {
  isPushEnabled,
  sendPushToToken,
};
