import { useEffect, useState } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import apiClient from '../api/client';
import { CheckCircle, XCircle, Loader, Mail } from 'lucide-react';

function VerifyEmailView() {
  const { viewParams, navigate } = useView();
  const token = viewParams?.token;

  const [status, setStatus] = useState('loading'); // loading | success | expired | invalid
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setMessage('No verification token found in the link.');
      return;
    }

    apiClient.get(`/auth/verify-email?token=${token}`)
      .then(res => {
        setStatus('success');
        setMessage(res.data?.message || 'Email verified successfully!');
        // Clear URL params to prevent reload loop
        if (window.location.search) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch(err => {
        const msg = err?.response?.data?.message || 'Verification failed.';
        const code = err?.response?.status;
        setStatus(code === 410 ? 'expired' : 'invalid');
        setMessage(msg);
        // Clear URL params to prevent reload loop
        if (window.location.search) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
  }, [token]);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResending(true);
    setResendMsg('');
    try {
      const res = await apiClient.post('/auth/resend-verification', { email: resendEmail.trim() });
      setResendMsg(res.data?.message || 'Verification email sent!');
    } catch (err) {
      setResendMsg(err?.response?.data?.message || 'Failed to resend. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const icons = {
    loading: <Loader size={32} color="#CC0000" style={{ animation: 'spin 1s linear infinite' }} />,
    success: <CheckCircle size={32} color="#22c55e" />,
    expired: <XCircle size={32} color="#f59e0b" />,
    invalid: <XCircle size={32} color="#ef4444" />,
  };

  const titles = {
    loading: 'Verifying your email…',
    success: 'Email Verified!',
    expired: 'Link Expired',
    invalid: 'Invalid Link',
  };

  const subtitleColors = {
    loading: 'var(--color-text-muted)',
    success: '#22c55e',
    expired: '#f59e0b',
    invalid: '#ef4444',
  };

  return (
    <div className="auth-view">
      <div className="glass-card auth-card animate-in">
        <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center' }}>

          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-bg-elevated)', border: '1.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icons[status]}
          </div>

          <div>
            <div className="land-live-badge" style={{ marginBottom: '0.25rem' }}>
              <span className="land-live-dot" />
              <span>EMAIL VERIFICATION</span>
            </div>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginTop: '0.5rem' }}>{titles[status]}</h1>
            <p style={{ fontSize: '0.88rem', color: subtitleColors[status], marginTop: '0.5rem', lineHeight: 1.6 }}>
              {message}
            </p>
          </div>

          {status === 'success' && (
            <button
              className="btn btn-red w-full btn-red-pulse"
              onClick={() => navigate(VIEWS.LOGIN)}
            >
              Go to Login
            </button>
          )}

          {(status === 'expired' || status === 'invalid') && (
            <div style={{ width: '100%' }}>
              <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid rgba(204,0,0,0.15)', borderRadius: 10, padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Mail size={15} color="#CC0000" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>Resend verification email</span>
                </div>
                <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <input
                    className="glass-input"
                    type="email"
                    placeholder="Enter your registered email"
                    value={resendEmail}
                    onChange={e => setResendEmail(e.target.value)}
                    required
                  />
                  {resendMsg && (
                    <p style={{ fontSize: '0.78rem', color: resendMsg.includes('sent') ? '#22c55e' : '#ef4444' }}>
                      {resendMsg}
                    </p>
                  )}
                  <button className="btn btn-red w-full" type="submit" disabled={resending}>
                    {resending ? 'Sending…' : 'Resend Email'}
                  </button>
                </form>
              </div>
              <button
                className="btn btn-ghost w-full"
                style={{ marginTop: '0.75rem' }}
                onClick={() => navigate(VIEWS.LOGIN)}
              >
                Back to Login
              </button>
            </div>
          )}

          {status === 'loading' && (
            <p className="text-muted" style={{ fontSize: '0.82rem' }}>
              Please wait while we confirm your email address…
            </p>
          )}

        </div>
      </div>
    </div>
  );
}

export default VerifyEmailView;
