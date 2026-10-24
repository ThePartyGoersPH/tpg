// Shared brute-force UX for the login screens: server-driven lock countdowns
// (persisted so a reload keeps ticking from `lockedUntil`, never a client
// timer) plus the remaining-attempts warnings. One module, no dependencies.

const LOCK_STORAGE_KEY = 'tpg_login_lock';

export function readPersistedLock() {
  try {
    const raw = sessionStorage.getItem(LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.lockedUntil) return null;
    if (new Date(parsed.lockedUntil).getTime() <= Date.now()) {
      sessionStorage.removeItem(LOCK_STORAGE_KEY);
      return null;
    }
    return { email: parsed.email || '', lockedUntil: parsed.lockedUntil };
  } catch (_) {
    return null;
  }
}

export function persistLock({ email, lockedUntil }) {
  try {
    sessionStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify({ email: email || '', lockedUntil }));
  } catch (_) {
    // Private mode etc. — the in-memory state still works for this session.
  }
}

export function clearPersistedLock() {
  try {
    sessionStorage.removeItem(LOCK_STORAGE_KEY);
  } catch (_) {}
}

export function formatCountdown(lockedUntil) {
  const total = Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function isLockExpired(lockedUntil) {
  return new Date(lockedUntil).getTime() <= Date.now();
}

// Shown after a wrong password while attempts remain. Only the last two
// counts warn; earlier failures keep the plain message.
export function warningForRemaining(n) {
  if (n === 1) {
    return 'Incorrect email or password. 1 attempt left before your account is temporarily locked.';
  }
  if (n === 2) {
    return 'Incorrect email or password. 2 attempts remaining before your account is locked for 5 minutes.';
  }
  return null;
}
