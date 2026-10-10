import { useState, useEffect, useRef } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { Mail, ArrowLeft, KeyRound, Calendar, ShieldCheck, CheckCircle, Eye, EyeOff } from 'lucide-react';
import apiClient from '../api/client';
import { isGoogleConfigured, googleSignInErrorText } from '../utils/googleAuth';

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

function calculateAge(dob) {
  if (!dob) return 0;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function LoginView() {
  const { login, authError, setAuthError, loginWithGoogle } = useAuth();
  const { navigate, viewParams } = useView();

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
  const [googleProfile, setGoogleProfile] = useState(null); // set when new google user needs age verification
  const [googleDob, setGoogleDob] = useState('');
  const [googleAgeConfirmed, setGoogleAgeConfirmed] = useState(false);
  const [googleCompleting, setGoogleCompleting] = useState(false);
  const [pendingNotice, setPendingNotice] = useState('');
  const [rejectedNotice, setRejectedNotice] = useState('');

  // Forgot password state
  const [step, setStep] = useState(1); // 1=login, 2=forgot form, 3=sent, 4=google age verify
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const forgotCooldownRef = useRef(null);
  const [barBanPopupOpen, setBarBanPopupOpen] = useState(false);
  const [barBanNotices, setBarBanNotices] = useState([]);

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
  }, []);

  // If navigated here from RegisterView with a googleProfile, jump to age verification
  useEffect(() => {
    if (viewParams?.googleProfile) {
      setGoogleProfile(viewParams.googleProfile);
      setStep(4);
    }
  }, [viewParams?.googleProfile]);

  const googleAge = calculateAge(googleDob);
  const googleDobError = googleDob && googleAge < 18 ? `You must be at least 18 years old. (You are ${googleAge})` : '';
  const googleCanComplete = googleAgeConfirmed && googleDob && !googleDobError && !googleCompleting;
  const hasActiveBarBans = barBanNotices.length > 0;

  const handleGoogleSuccess = async (credential) => {
    setGoogleError('');
    setGoogleSubmitting(true);
    try {
      const res = await apiClient.post('/auth/google', { credential });
      const data = res.data;
      if (data.new_user) {
        setGoogleProfile(data.google_profile);
        setStep(4);
      } else {
        loginWithGoogle(data.data);
        const notices = Array.isArray(data?.data?.bar_ban_notices) ? data.data.bar_ban_notices : [];
        if (notices.length > 0) {
          setBarBanNotices(notices);
          setBarBanPopupOpen(true);
        } else {
          navigate(VIEWS.HOME);
        }
      }
    } catch (err) {
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.message || 'Google sign-in failed. Please try again.';
      if (code === 'ACCOUNT_PENDING_APPROVAL') {
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

  const handleGoogleComplete = async (e) => {
    e.preventDefault();
    if (!googleCanComplete) return;
    setGoogleCompleting(true);
    setGoogleError('');
    try {
      const res = await apiClient.post('/auth/google/complete', {
        credential: googleProfile.credential,
        date_of_birth: googleDob
      });
      loginWithGoogle(res.data.data);
      navigate(VIEWS.HOME);
    } catch (err) {
      const data = err?.response?.data;
      setGoogleError(data?.message || 'Registration failed. Please try again.');
      if (data?.code === 'UNDERAGE') {
        setGoogleAgeConfirmed(false);
      }
    } finally {
      setGoogleCompleting(false);
    }
  };

  const onGoogleSuccess = (credentialResponse) => handleGoogleSuccess(credentialResponse.credential);
  const onGoogleError = () => setGoogleError(googleSignInErrorText());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setAuthError('');
    setPendingNotice('');
    setRejectedNotice('');
    try {
      const loginData = await login(email, password);
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
      if (code === 'EMAIL_NOT_VERIFIED') {
        // Access is blocked until the email is confirmed. The backend re-sends
        // the link + OTP on demand, so only claim "email sent" when it did.
        navigate(VIEWS.VERIFY_EMAIL, { email: err?.email || email, sent: err?.verificationSent === true });
        return;
      } else if (code === 'GOOGLE_ACCOUNT') {
        setAuthError(err.message);
      } else if (status === 401) {
        setAuthError('Invalid email or password.');
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

  // ── Step 4: Google age verification (new Google user) ──
  if (step === 4 && googleProfile) {
    return (
      <div className="auth-view">
        <form className="glass-card auth-card" onSubmit={handleGoogleComplete} autoComplete="off">
          <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => { setStep(1); setGoogleProfile(null); setGoogleDob(''); setGoogleAgeConfirmed(false); setGoogleError(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: 0, alignSelf: 'flex-start' }}
            >
              <ArrowLeft size={14} /> Back
            </button>

            {googleProfile.picture && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'var(--color-bg-elevated)', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                <img src={googleProfile.picture} alt="" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>{googleProfile.first_name} {googleProfile.last_name}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{googleProfile.email}</p>
                </div>
              </div>
            )}

            <div>
              <div className="land-live-badge" style={{ marginBottom: '0.25rem', alignSelf: 'flex-start' }}>
                <span className="land-live-dot" />
                <span>ONE MORE STEP</span>
              </div>
              <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.3rem, 3vw, 1.7rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>VERIFY <span style={{ color: 'var(--color-red-primary)' }}>YOUR AGE</span></h1>
            </div>
            <p className="text-muted" style={{ fontSize: '0.88rem' }}>You must be <strong style={{ color: '#fff' }}>18 or older</strong> to use PartyGoers PH. Please enter your date of birth.</p>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                <Calendar size={13} /> Date of Birth
              </label>
              <input
                className="glass-input"
                type="date"
                value={googleDob}
                onChange={e => { setGoogleDob(e.target.value); setGoogleAgeConfirmed(false); }}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                required
                autoComplete="off"
              />
              {googleDobError && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.3rem' }}>{googleDobError}</p>}
              {googleDob && !googleDobError && <p style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.3rem' }}>Age confirmed: {googleAge} years old.</p>}
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={googleAgeConfirmed}
                onChange={e => setGoogleAgeConfirmed(e.target.checked)}
                disabled={Boolean(googleDobError) || !googleDob}
                style={{ marginTop: '0.1rem', flexShrink: 0, accentColor: '#CC0000' }}
              />
              I confirm I am 18 years old or older and agree to the terms.
            </label>

            {googleError && <p className="error-text">{googleError}</p>}

            <button
              className="btn btn-red w-full"
              type="submit"
              disabled={!googleCanComplete}
              style={{ opacity: googleCanComplete ? 1 : 0.45, cursor: googleCanComplete ? 'pointer' : 'not-allowed', transition: 'opacity 0.2s' }}
            >
              {googleCompleting ? 'Creating account…' : 'Continue with Google'}
            </button>
          </div>
        </form>
      </div>
    );
  }

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

            <button className="btn btn-red w-full" type="submit" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Login'}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.1rem 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {googleError && !authError && <p className="error-text" style={{ marginTop: '-0.25rem' }}>{googleError}</p>}

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
