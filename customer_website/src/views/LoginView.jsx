import { useState, useEffect, useRef } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { Mail, ArrowLeft, KeyRound, ShieldCheck, CheckCircle, Eye, EyeOff } from 'lucide-react';
import apiClient from '../api/client';
import { isGoogleConfigured, googleSignInErrorText } from '../utils/googleAuth';
import {
  readPersistedLock, persistLock, clearPersistedLock,
  formatCountdown, isLockExpired, warningForRemaining,
} from '../utils/loginLockout';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M47.52 24.56c0-1.62-.15-3.18-.42-4.68H24v9.02h13.2a11.3 11.3 0 0 1-4.9 7.4v6.16h7.92c4.64-4.28 7.3-10.6 7.3-17.9z"/>
      <path fill="#34A853" d="M24 48c6.63 0 12.2-2.2 16.26-5.94l-7.92-6.16c-2.2 1.48-5.02 2.36-8.34 2.36-6.42 0-11.86-4.34-13.8-10.18H2.06v6.36A24 24 0 0 0 24 48z"/>
      <path fill="#FBBC05" d="M10.2 28.08A14.46 14.46 0 0 1 9.44 24c0-1.42.24-2.8.66-4.08v-6.36H2.06A24 24 0 0 0 0 24c0 3.88.92 7.54 2.06 10.44l8.14-6.36z"/>
      <path fill="#EA4335" d="M24 9.74c3.62 0 6.86 1.24 9.42 3.68l7.04-7.04C36.2 2.42 30.62 0 24 0A24 24 0 0 0 2.06 13.56l8.14 6.36C12.14 14.08 17.58 9.74 24 9.74z"/>
    </svg>
  );
}

function LoginView() {
  const { login, authError, setAuthError, loginWithGoogle } = useAuth();
  const { navigate } = useView();

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailReadonly, setEmailReadonly] = useState(true);
  const [passwordReadonly, setPasswordReadonly] = useState(true);

  // Google OAuth state
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [googleNotice, setGoogleNotice] = useState('');
  const [pendingNotice, setPendingNotice] = useState('');
  const [rejectedNotice, setRejectedNotice] = useState('');

  // Unverified-block state: notice + resend-code action on the login form.
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resendOk, setResendOk] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendCooldownRef = useRef(null);

  // Forgot password state
  const [step, setStep] = useState(1); // 1=login, 2=forgot form, 3=sent, 4=google age verify
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const forgotCooldownRef = useRef(null);
  const [barBanPopupOpen, setBarBanPopupOpen] = useState(false);
  const [barBanNotices, setBarBanNotices] = useState([]);

  // Brute-force lockout: server is the source of truth (lockedUntil); the
  // ticker below only re-renders the countdown, and the persisted copy keeps
  // it ticking across reloads.
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

  const startResendCooldown = (s) => {
    setResendCooldown(s);
    clearInterval(resendCooldownRef.current);
    resendCooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(resendCooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const startForgotCooldown = (s) => {
    setForgotCooldown(s);
    clearInterval(forgotCooldownRef.current);
    forgotCooldownRef.current = setInterval(() => {
      setForgotCooldown(prev => {
        if (prev <= 1) { clearInterval(forgotCooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => {
    clearInterval(forgotCooldownRef.current);
    clearInterval(resendCooldownRef.current);
  }, []);

  // Registration prefill is handled by RegisterView reading its own view params.
  const hasActiveBarBans = barBanNotices.length > 0;

  const handleGoogleSuccess = async (credential) => {
    setGoogleError('');
    setGoogleNotice('');
    setPendingNotice('');
    setRejectedNotice('');
    setGoogleSubmitting(true);
    try {
      const res = await apiClient.post('/auth/google', { credential });
      const data = res.data;
      loginWithGoogle(data.data);
      const notices = Array.isArray(data?.data?.bar_ban_notices) ? data.data.bar_ban_notices : [];
      if (notices.length > 0) {
        setBarBanNotices(notices);
        setBarBanPopupOpen(true);
      } else {
        navigate(VIEWS.HOME);
      }
    } catch (err) {
      const data = err?.response?.data || {};
      const code = data.code;
      const msg = data.message || 'Google sign-in failed. Please try again.';
      if (code === 'ACCOUNT_NOT_FOUND') {
        // Unregistered Google address: no account is created here. Show the
        // notice, then hand off to registration with the verified details.
        setGoogleNotice(msg);
        setGoogleError('');
        setTimeout(() => {
          navigate(VIEWS.REGISTER, {
            email: data.email || '',
            first_name: String(data.name || '').split(' ')[0] || '',
            last_name: String(data.name || '').split(' ').slice(1).join(' ') || '',
            fromGoogle: true,
          });
        }, 1500);
      } else if (code === 'ACCOUNT_LOCKED' && data.lockedUntil) {
        // IP-level brake on junk Google credentials: surface the same panel.
        const info = { email: '', lockedUntil: err.response.data.lockedUntil };
        setLockInfo(info);
        persistLock(info);
        setGoogleError('');
      } else if (code === 'ACCOUNT_PENDING_APPROVAL') {
        setPendingNotice(msg);
        setRejectedNotice('');
        setGoogleError('');
        setAuthError('');
      } else if (code === 'ACCOUNT_REJECTED') {
        setRejectedNotice(msg);
        setPendingNotice('');
        setGoogleError('');
        setAuthError('');
      } else {
        setGoogleError(msg);
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const onGoogleSuccess = (credentialResponse) => handleGoogleSuccess(credentialResponse.credential);
  const onGoogleError = () => setGoogleError(googleSignInErrorText());

  const lockMatchesEmail = (info, value) =>
    info && (!info.email || info.email.trim().toLowerCase() === String(value || '').trim().toLowerCase());
  const lockActive = lockInfo && !isLockExpired(lockInfo.lockedUntil) && lockMatchesEmail(lockInfo, email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lockActive || submitting) return;
    setSubmitting(true);
    setAuthError('');
    setPendingNotice('');
    setRejectedNotice('');
    setUnverifiedEmail('');
    setResendMsg('');
    try {
      const loginData = await login(email, password);
      clearPersistedLock();
      setLockInfo(null);
      const notices = Array.isArray(loginData?.bar_ban_notices) ? loginData.bar_ban_notices : [];
      if (notices.length > 0) {
        setBarBanNotices(notices);
        setBarBanPopupOpen(true);
      } else {
        navigate(VIEWS.HOME);
      }
    } catch (err) {
      const code = err?.code;
      const status = err?.status;
      if (code === 'ACCOUNT_LOCKED' && err?.lockedUntil) {
        const info = { email, lockedUntil: err.lockedUntil };
        setLockInfo(info);
        persistLock(info);
        setAuthError('');
      } else if (code === 'EMAIL_NOT_VERIFIED') {
        // Login stays blocked until the email is confirmed. Show the notice
        // with a resend-code action instead of whisking the user away.
        setUnverifiedEmail(err?.email || email);
        setAuthError('');
      } else if (code === 'GOOGLE_ACCOUNT') {
        setAuthError(err.message);
      } else if (status === 401) {
        setAuthError(warningForRemaining(err?.attemptsRemaining) || 'Invalid email or password.');
      } else if (code === 'MAINTENANCE_MODE') {
        setAuthError(err.message || 'Platform is currently under maintenance. Please try again later.');
      } else if (code === 'ACCOUNT_BANNED' || code === 'BAR_SUSPENDED') {
        setAuthError(err.message);
      } else if (code === 'ACCOUNT_PENDING_APPROVAL') {
        setPendingNotice(err.message || 'Your account is waiting for admin approval.');
        setRejectedNotice('');
      } else if (code === 'ACCOUNT_REJECTED') {
        setRejectedNotice(err.message || 'Your registration was not approved.');
        setPendingNotice('');
      } else {
        setAuthError(err?.message || 'Unable to login.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Resend a fresh code from the login form (cooldown-protected server-side).
  const handleResendCode = async () => {
    if (resending || resendCooldown > 0 || !unverifiedEmail) return;
    setResending(true);
    setResendMsg('');
    try {
      const res = await apiClient.post('/auth/resend-verification', { email: unverifiedEmail });
      setResendMsg(res.data?.message || 'Verification code sent! Check your inbox or the backend console.');
      setResendOk(true);
      startResendCooldown(60);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === 'RESEND_COOLDOWN' && data?.wait_seconds) {
        startResendCooldown(data.wait_seconds);
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

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (forgotSubmitting || forgotCooldown > 0) return;
    setForgotError('');
    setForgotSubmitting(true);
    try {
      const res = await apiClient.post('/auth/forgot-password', { email: forgotEmail });
      setStep(3);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === 'RESET_COOLDOWN' && data?.wait_seconds) {
        startForgotCooldown(data.wait_seconds);
        setForgotError(`Please wait ${data.wait_seconds}s before requesting another reset.`);
      } else {
        setForgotError(data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setForgotSubmitting(false);
    }
  };

  // ── Step 3: Email sent confirmation ──
  if (step === 3) {
    return (
      <div className="auth-view">
        <div className="glass-card auth-card animate-in">
          <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--color-red-subtle)', border: '1.5px solid rgba(204,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={28} color="#CC0000" />
            </div>
            <div>
              <div className="land-live-badge" style={{ marginBottom: '0.5rem' }}>
                <span className="land-live-dot" />
                <span>CHECK YOUR EMAIL</span>
              </div>
              <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>RESET LINK <span style={{ color: 'var(--color-red-primary)' }}>SENT</span></h1>
            </div>
            <p className="text-muted" style={{ fontSize: '0.9rem', maxWidth: 320 }}>
              We sent a password reset link to <strong style={{ color: '#fff' }}>{forgotEmail}</strong>. Check your inbox and follow the instructions.
            </p>
            <div className="glass-card" style={{ width: '100%', padding: '1rem 1.25rem', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>
                The link expires in <strong style={{ color: '#fff' }}>1 hour</strong>. Check your spam folder if you don't see it.
              </p>
            </div>
            <button className="btn btn-red w-full" onClick={() => { setStep(1); setForgotEmail(''); setForgotError(''); }}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Forgot password form ──
  if (step === 2) {
    return (
      <div className="auth-view">
        <form className="glass-card auth-card" onSubmit={handleForgotSubmit} autoComplete="off">
          <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => { setStep(1); setForgotError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: 0, alignSelf: 'flex-start' }}
            >
              <ArrowLeft size={14} /> Back to login
            </button>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-red-subtle)', border: '1.5px solid rgba(204,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={22} color="#CC0000" />
            </div>
            <div>
              <div className="land-live-badge" style={{ marginBottom: '0.25rem', alignSelf: 'flex-start' }}>
                <span className="land-live-dot" />
                <span>PASSWORD RECOVERY</span>
              </div>
              <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>FORGOT <span style={{ color: 'var(--color-red-primary)' }}>PASSWORD?</span></h1>
            </div>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Enter your email and we'll send you a reset link.</p>
            <input
              className="glass-input"
              type="email"
              placeholder="Your email address"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              autoComplete="off"
              required
            />
            {forgotError && <p className="error-text">{forgotError}</p>}
            <button
              className="btn btn-red w-full"
              type="submit"
              disabled={forgotSubmitting || forgotCooldown > 0}
            >
              {forgotSubmitting ? 'Sending…' : forgotCooldown > 0 ? `Wait ${forgotCooldown}s` : 'Send Reset Link'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Step 1: Login form ──
  return (
    <>
      <div className="auth-view">
        <form className="glass-card auth-card" onSubmit={handleSubmit} autoComplete="off">
          <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="land-live-badge" style={{ marginBottom: '0.25rem', alignSelf: 'flex-start' }}>
              <span className="land-live-dot" />
              <span>CUSTOMER ACCESS</span>
            </div>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>WELCOME <span style={{ color: 'var(--color-red-primary)' }}>BACK</span></h1>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>Sign in to discover bars and reserve your table.</p>

            <input
              className="glass-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setEmailReadonly(false)}
              readOnly={emailReadonly}
              autoComplete="off"
              required
              disabled={lockActive}
            />
            <div className="password-input-wrapper">
              <input
                className="glass-input password-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordReadonly(false)}
                readOnly={passwordReadonly}
                autoComplete="off"
                required
                disabled={lockActive}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
              <a
                href="#"
                onClick={e => { e.preventDefault(); setStep(2); setForgotEmail(email); setAuthError(''); }}
                style={{ fontSize: '0.82rem', color: 'var(--color-red-primary)', fontWeight: 600 }}
              >
                Forgot password?
              </a>
            </div>

            {pendingNotice && (
              <div style={{ marginTop: '0.6rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8, padding: '0.75rem 1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24', margin: '0 0 0.3rem' }}>⏳ Waiting for admin approval</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 0.6rem' }}>{pendingNotice}</p>
                <button type="submit" className="btn btn-red btn-sm" disabled={submitting}>
                  {submitting ? 'Checking…' : 'Try again'}
                </button>
              </div>
            )}
            {rejectedNotice && (
              <div style={{ marginTop: '0.6rem', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171', margin: '0 0 0.3rem' }}>Registration not approved</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 0.6rem' }}>{rejectedNotice}</p>
                <a href="mailto:support@thepartygoersph.com" style={{ fontSize: '0.78rem', color: 'var(--color-red-primary)', fontWeight: 600 }}>Contact support</a>
              </div>
            )}
            {authError && (
              <div>
                <p className="error-text">{authError}</p>
              </div>
            )}
            {unverifiedEmail && (
              <div style={{ marginTop: '0.6rem', background: 'var(--color-bg-elevated)', border: '1px solid rgba(204,0,0,0.2)', borderRadius: 8, padding: '0.75rem 1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', margin: '0 0 0.3rem' }}>Please verify your email before logging in.</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 0.6rem' }}>Enter the 6-digit code we sent to {unverifiedEmail}.</p>
                {resendMsg && (
                  <p style={{ fontSize: '0.75rem', color: resendOk ? '#22c55e' : '#f87171', margin: '0 0 0.5rem' }}>{resendMsg}</p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-red btn-sm"
                    onClick={() => navigate(VIEWS.VERIFY_EMAIL, { email: unverifiedEmail })}
                  >
                    Enter verification code
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleResendCode}
                    disabled={resending || resendCooldown > 0}
                  >
                    {resending ? 'Sending…' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                </div>
              </div>
            )}
            {lockActive && (
              <div style={{ marginTop: '0.6rem', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171', margin: '0 0 0.3rem' }}>Too many failed attempts. Try again in {formatCountdown(lockInfo.lockedUntil)}.</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  Locked for your protection. <a href="#" onClick={e => { e.preventDefault(); setForgotEmail(email); setStep(2); }} style={{ color: 'var(--color-red-primary)', fontWeight: 600 }}>Forgot password?</a>
                </p>
              </div>
            )}

            <button className="btn btn-red w-full" type="submit" disabled={submitting || lockActive}>
              {submitting ? 'Signing in...' : lockActive ? `Locked ${formatCountdown(lockInfo.lockedUntil)}` : 'Login'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.1rem 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {googleError && !authError && <p className="error-text" style={{ marginTop: '-0.25rem' }}>{googleError}</p>}
            {googleNotice && <p style={{ fontSize: '0.82rem', color: '#22c55e', marginTop: '-0.25rem' }}>{googleNotice} Redirecting to registration…</p>}

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {isGoogleConfigured() ? (
                <GoogleLogin
                  onSuccess={onGoogleSuccess}
                  onError={onGoogleError}
                  theme="filled_black"
                  shape="pill"
                  size="large"
                  text="signin_with"
                  width="320"
                  useOneTap={false}
                  disabled={googleSubmitting}
                />
              ) : (
                <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>
                  Google sign-in is not configured for this site yet. Please use email sign-in.
                </p>
              )}
            </div>

            <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>
              No account yet?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); navigate(VIEWS.REGISTER); }}>Register here</a>
            </p>
          </div>
        </form>
      </div>

      {barBanPopupOpen && hasActiveBarBans && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 560, border: '1px solid rgba(204,0,0,0.28)' }}>
            <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="#CC0000" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 700 }}>Bar Access Notice</h3>
              </div>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.86rem' }}>
                You can still use your account, but you are currently banned from the bar(s) below:
              </p>

              <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {barBanNotices.map((notice, idx) => (
                  <div
                    key={`${notice.bar_id || 'bar'}-${idx}`}
                    style={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      padding: '0.65rem 0.75rem'
                    }}
                  >
                    <p style={{ margin: 0, color: '#fff', fontWeight: 600, fontSize: '0.86rem' }}>{notice.bar_name || 'Unknown Bar'}</p>
                    <p style={{ margin: '0.2rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                      {notice.ban_reason || 'You are banned from this bar.'}
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-red w-full"
                onClick={() => {
                  setBarBanPopupOpen(false);
                  navigate(VIEWS.HOME);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default LoginView;
