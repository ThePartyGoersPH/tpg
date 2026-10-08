import { useState } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';
import apiClient from '../api/client';

function ResetPasswordView() {
  const { viewParams, navigate } = useView();
  const token = viewParams?.token || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const passwordMismatch = confirmPassword && newPassword !== confirmPassword;
  const canSubmit = newPassword.length >= 6 && confirmPassword && !passwordMismatch && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (!token) {
      setError('Invalid or missing reset token. Please request a new reset link.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', { token, new_password: newPassword });
      setDone(true);
      // Clear URL params to prevent reload loop
      if (window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-view">
        <div className="glass-card auth-card">
          <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={28} color="#ef4444" />
            </div>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, color: 'var(--text-primary)' }}>INVALID <span style={{ color: '#ef4444' }}>LINK</span></h1>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>This reset link is invalid or has already been used.</p>
            <button className="btn btn-red w-full" onClick={() => navigate(VIEWS.LOGIN)}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-view">
        <div className="glass-card auth-card animate-in">
          <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '1.5px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={28} color="#22c55e" />
            </div>
            <div>
              <div className="land-live-badge" style={{ marginBottom: '0.5rem' }}>
                <span className="land-live-dot" />
                <span>SUCCESS</span>
              </div>
              <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>PASSWORD <span style={{ color: 'var(--color-red-primary)' }}>UPDATED</span></h1>
            </div>
            <p className="text-muted" style={{ fontSize: '0.9rem', maxWidth: 300 }}>
              Your password has been reset successfully. You can now log in with your new password.
            </p>
            <button className="btn btn-red w-full btn-red-pulse" onClick={() => navigate(VIEWS.LOGIN)}>
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-view">
      <form className="glass-card auth-card" onSubmit={handleSubmit} autoComplete="off">
        <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-red-subtle)', border: '1.5px solid rgba(204,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <KeyRound size={22} color="#CC0000" />
          </div>
          <div>
            <div className="land-live-badge" style={{ marginBottom: '0.25rem', alignSelf: 'flex-start' }}>
              <span className="land-live-dot" />
              <span>SET NEW PASSWORD</span>
            </div>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>RESET <span style={{ color: 'var(--color-red-primary)' }}>PASSWORD</span></h1>
          </div>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Enter your new password below. Must be at least 6 characters.</p>

          <div style={{ position: 'relative' }}>
            <input
              className="glass-input"
              type={showNew ? 'text' : 'password'}
              placeholder="New password (min 6 chars)"
              minLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              style={{ width: '100%', boxSizing: 'border-box', paddingRight: '2.75rem' }}
            />
            <button
              type="button"
              onClick={() => setShowNew(p => !p)}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              className="glass-input"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              style={{ width: '100%', boxSizing: 'border-box', paddingRight: '2.75rem', borderColor: passwordMismatch ? '#ef4444' : '' }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(p => !p)}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {passwordMismatch && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '-0.5rem' }}>Passwords do not match.</p>
          )}
          {confirmPassword && !passwordMismatch && newPassword && (
            <p style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '-0.5rem' }}>Passwords match.</p>
          )}

          {error && <p className="error-text">{error}</p>}

          <button
            className="btn btn-red w-full"
            type="submit"
            disabled={!canSubmit}
            style={{ opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'opacity 0.2s' }}
          >
            {submitting ? 'Resetting…' : 'Reset Password'}
          </button>

          <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>
            <a href="#" onClick={e => { e.preventDefault(); navigate(VIEWS.LOGIN); }}>Back to Login</a>
          </p>
        </div>
      </form>
    </div>
  );
}

export default ResetPasswordView;
