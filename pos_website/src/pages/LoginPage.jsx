import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';

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
    setError('');
    setLoading(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      const code = String(err?.code || err?.response?.data?.code || '').toUpperCase();
      const message = err?.response?.data?.message || err?.message || 'Login failed.';
      const status = Number(err?.response?.status || 0);

      if (ACCESS_DENIED_CODES.has(code) || status === 403) {
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
          />
        </label>

        {error ? <p className="error-msg">{error}</p> : null}

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
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
