import { useEffect, useRef, useState } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../api/client';
import { CheckCircle, XCircle, Loader, Mail, ShieldCheck } from 'lucide-react';

const RESEND_COOLDOWN = 60;

function VerifyEmailView() {
  const { viewParams, navigate } = useView();
  const { clearNeedsVerification, loginWithGoogle } = useAuth();

  const token = viewParams?.token;
  const paramEmail = viewParams?.email || '';
  const autoSent = Boolean(viewParams?.sent);

  // status: loading (link flow) | success | entry (OTP form) | invalid | expired
  const [status, setStatus] = useState(token ? 'loading' : 'entry');
  const [message, setMessage] = useState('');

  const [formEmail, setFormEmail] = useState(paramEmail);
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [resendMsg, setResendMsg] = useState('');
  const [resendOk, setResendOk] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const startCooldown = (seconds) => {
    setCooldown(seconds);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // Verification is where the session starts: store it, then head home.
  // A short beat lets the user read the confirmation first.
  const storeSession = (data) => {
    try {
      if (data?.token && data?.user && typeof loginWithGoogle === 'function') {
        loginWithGoogle(data);
        setTimeout(() => navigate(VIEWS.HOME), 1200);
      }
    } catch (_) {
      // Session UI stays on the success panel with its continue button.
    }
  };

  const markVerified = (resMessage, data) => {
    storeSession(data);
    setStatus('success');
    setMessage(resMessage || 'Email verified successfully!');
    clearNeedsVerification();
  };

  // ── Emailed link flow: the ?token= itself is the verification ──
  useEffect(() => {
    if (!token) return;

    apiClient.get(`/auth/verify-email?token=${token}`)
      .then(res => {
        markVerified(res.data?.message, res.data?.data);
        if (window.location.search) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch(err => {
        const data = err?.response?.data;
        const code = err?.response?.status;
        setStatus(code === 410 ? 'expired' : 'invalid');
        setMessage(data?.message || 'Verification failed.');
        if (window.location.search) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      });
  }, [token, clearNeedsVerification]);

  // Arriving straight from a blocked login: the backend has already re-sent
  // the link + OTP, so open the resend cooldown instead of letting it spam.
  useEffect(() => {
    if (!autoSent) return;
    setResendOk(true);
    setResendMsg('We sent a verification email with a 6-digit code to your inbox.');
    startCooldown(RESEND_COOLDOWN);
    return () => clearInterval(cooldownRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSent]);

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  // ── OTP flow ──
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');

    const emailNorm = formEmail.trim();
    const codeNorm = otp.trim();

    if (!emailNorm) {
      setFormError('Enter the email address you registered with.');
      return;
    }
    if (!/^\d{6}$/.test(codeNorm)) {
      setFormError('Enter the 6-digit code from your email.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/auth/verify-otp', { email: emailNorm, code: codeNorm });
      markVerified(res.data?.message, res.data?.data);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === 'OTP_EXPIRED' || data?.code === 'LINK_EXPIRED') {
        setFormError(`${data?.message || 'That code has expired.'} Use “Resend code” below to get a fresh one.`);
      } else if (data?.code === 'OTP_INVALID') {
        setFormError(data?.message || 'Incorrect code. Please try again.');
        setOtp('');
      } else if (err?.response?.status === 404) {
        setFormError(data?.message || 'No account found for that email.');
      } else {
        setFormError(data?.message || 'Verification failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    const emailNorm = formEmail.trim();
    if (!emailNorm) {
      setFormError('Enter your email address first, then resend.');
      return;
    }
    setFormError('');
    setResending(true);
    setResendMsg('');
    try {
      const res = await apiClient.post('/auth/resend-verification', { email: emailNorm });
      setResendMsg(res.data?.message || 'Verification email sent! Check your inbox.');
      setResendOk(true);
      startCooldown(RESEND_COOLDOWN);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === 'RESEND_COOLDOWN' && data?.wait_seconds) {
        startCooldown(data.wait_seconds);
        setResendMsg(`Please wait ${data.wait_seconds}s before resending.`);
        setResendOk(false);
      } else {
        setResendMsg(data?.message || 'Failed to resend. Please try again.');
        setResendOk(false);
      }
    } finally {
      setResending(false);
    }
  };

  const icons = {
    loading: <Loader size={32} color="#CC0000" style={{ animation: 'spin 1s linear infinite' }} />,
    success: <CheckCircle size={32} color="#22c55e" />,
    expired: <XCircle size={32} color="#f59e0b" />,
    invalid: <XCircle size={32} color="#ef4444" />,
    entry: <ShieldCheck size={32} color="#CC0000" />,
  };

  const titles = {
    loading: 'Verifying your email…',
    success: 'Email Verified!',
    expired: 'Link Expired',
    invalid: 'Invalid Link',
    entry: 'Verify your email',
  };

  const subtitleColors = {
    loading: 'var(--color-text-muted)',
    success: '#22c55e',
    expired: '#f59e0b',
    invalid: '#ef4444',
    entry: 'var(--color-text-muted)',
  };

  // ── Expired / invalid link: offer the code route instead of a dead end ──
  const entryHint = status === 'expired'
    ? 'That link expired — request a fresh email and enter the 6-digit code below.'
    : status === 'invalid'
      ? 'That link is no longer valid. Enter the 6-digit code from your latest email instead.'
      : autoSent
        ? 'Your verification email is on its way. Enter the 6-digit code below, or click the link in the email.'
        : 'Enter the 6-digit code we emailed you, or click the verification link in that email.';

  const showEntryForm = status === 'entry' || status === 'expired' || status === 'invalid';

  return (
    <div className="auth-view">
      <div className="glass-card auth-card animate-in">
        <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center' }}>

          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-bg-elevated)', border: '1.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icons[status] || icons.entry}
          </div>

          <div>
            <div className="land-live-badge" style={{ marginBottom: '0.25rem' }}>
              <span className="land-live-dot" />
              <span>EMAIL VERIFICATION</span>
            </div>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginTop: '0.5rem' }}>{titles[status] || titles.entry}</h1>
            {(status === 'loading' || status === 'success') && (
              <p style={{ fontSize: '0.88rem', color: subtitleColors[status], marginTop: '0.5rem', lineHeight: 1.6 }}>
                {message}
              </p>
            )}
          </div>

          {status === 'loading' && (
            <p className="text-muted" style={{ fontSize: '0.82rem' }}>
              Please wait while we confirm your email address…
            </p>
          )}

          {status === 'success' && (
            <button
              className="btn btn-red w-full btn-red-pulse"
              onClick={() => { clearNeedsVerification(); navigate(VIEWS.HOME); }}
            >
              Continue to dashboard
            </button>
          )}

          {showEntryForm && (
            <form onSubmit={handleVerifyOtp} style={{ width: '100%', textAlign: 'left' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '0 0 0.9rem', lineHeight: 1.6 }}>
                {entryHint}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <input
                  className="glass-input"
                  type="email"
                  placeholder="Your registered email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <input
                  className="glass-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                  style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.5em' }}
                  required
                />
              </div>

              {formError && (
                <p style={{ fontSize: '0.78rem', color: '#f87171', margin: '0.6rem 0 0' }}>{formError}</p>
              )}

              <button
                className="btn btn-red w-full"
                type="submit"
                disabled={submitting || otp.length !== 6}
                style={{ marginTop: '0.9rem' }}
              >
                {submitting ? 'Verifying…' : 'Verify Email'}
              </button>

              <div style={{ marginTop: '1rem', background: 'var(--color-bg-elevated)', border: '1px solid rgba(204,0,0,0.15)', borderRadius: 10, padding: '0.85rem 1rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <Mail size={14} color="#CC0000" />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>Didn't get the email?</span>
                </div>
                {resendMsg && (
                  <p style={{ fontSize: '0.75rem', color: resendOk ? '#22c55e' : '#f87171', margin: '0 0 0.4rem' }}>{resendMsg}</p>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                  style={{ pointerEvents: (cooldown > 0 || resending) ? 'none' : 'auto' }}
                >
                  {resending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
                </button>
              </div>
            </form>
          )}

          <button
            className="btn btn-ghost w-full"
            style={{ marginTop: '0.25rem' }}
            onClick={() => { clearNeedsVerification(); navigate(VIEWS.LOGIN); }}
          >
            Back to Login
          </button>

        </div>
      </div>
    </div>
  );
}

export default VerifyEmailView;
