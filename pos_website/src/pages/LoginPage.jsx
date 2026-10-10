import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import {
  readPersistedLock, persistLock, clearPersistedLock,
  formatCountdown, isLockExpired, warningForRemaining,
} from '../utils/loginLockout';

const ACCESS_DENIED_CODES = new Set([
  'POS_PERMISSION_REQUIRED',
  'POS_NOT_ACCEPTED',
  'ROLE_NOT_ALLOWED',
  'ACCOUNT_BANNED',
  'BAR_ACCESS_BANNED',
  'BAR_SUSPENDED',
]);

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessModal, setAccessModal] = useState(null);

  // Brute-force lockout: server-driven countdown, persisted across reloads.
  const [lockInfo, setLockInfo] = useState(null);
  const [, setLockTick] = useState(0);

  useEffect(() => {
    setLockInfo(readPersistedLock());
  }, []);

  useEffect(() => {
    if (!lockInfo) return;
    if (isLockExpired(lockInfo.lockedUntil)) {
      setLockInfo(null);
      clearPersistedLock();
      return;
    }
    const iv = setInterval(() => setLockTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [lockInfo?.lockedUntil]);

  const lockMatchesEmail = (info, value) =>
    info && (!info.email || info.email.trim().toLowerCase() === String(value || '').trim().toLowerCase());
  const lockActive = lockInfo && !isLockExpired(lockInfo.lockedUntil) && lockMatchesEmail(lockInfo, email);

  useEffect(() => {
    const raw = localStorage.getItem('pos_login_block_reason');
    if (!raw) return;

    localStorage.removeItem('pos_login_block_reason');
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.message) {
        setAccessModal({
          title: 'POS Access Denied',
          message: parsed.message,
        });
      }
    } catch {
      // Ignore parse errors from stale values.
    }
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (lockActive || loading) return;
    setError('');
    setLoading(true);

    try {
      await login(email.trim(), password);
      clearPersistedLock();
      setLockInfo(null);
    } catch (err) {
      const data = err?.response?.data || {};
      const code = String(err?.code || data.code || '').toUpperCase();
      const message = data.message || err?.message || 'Login failed.';
      const status = Number(err?.response?.status || 0);

      if (code === 'ACCOUNT_LOCKED' && data.lockedUntil) {
        const info = { email: email.trim(), lockedUntil: data.lockedUntil };
        setLockInfo(info);
        persistLock(info);
        setError('');
      } else if (status === 401 && typeof data.attemptsRemaining === 'number') {
        setError(warningForRemaining(data.attemptsRemaining) || message);
      } else if (ACCESS_DENIED_CODES.has(code) || status === 403) {
        setAccessModal({
          title: 'POS Access Denied',
          message,
        });
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand-row">
          <ShieldCheck size={24} />
          <h1>POS Portal</h1>
        </div>

        <p className="subtext">Sign in with your staff or manager account.</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@bar.com"
            required
            disabled={loading || lockActive}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            disabled={loading || lockActive}
          />
        </label>

        {error ? <p className="error-msg">{error}</p> : null}

        {lockActive ? (
          <p className="error-msg" role="status">
            Too many failed attempts. Try again in {formatCountdown(lockInfo.lockedUntil)}.
          </p>
        ) : null}

        <button type="submit" disabled={loading || lockActive}>
          {loading ? 'Signing in...' : lockActive ? `Locked ${formatCountdown(lockInfo.lockedUntil)}` : 'Sign In'}
        </button>
      </form>

      {accessModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="POS access denied">
          <div className="modal-panel auth-access-modal">
            <h3>{accessModal.title}</h3>
            <p>{accessModal.message}</p>
            <div className="payment-actions-row">
              <button type="button" onClick={() => setAccessModal(null)}>OK</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
