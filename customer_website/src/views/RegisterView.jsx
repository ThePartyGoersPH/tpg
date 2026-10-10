import { useState, useEffect, useRef } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import apiClient from '../api/client';
import { isGoogleConfigured, googleSignInErrorText } from '../utils/googleAuth';
import { Mail, CheckCircle, Calendar, ShieldCheck, Eye, EyeOff } from 'lucide-react';

function useCountdown(initial = 0) {
  const [seconds, setSeconds] = useState(initial);
  const timerRef = useRef(null);

  const start = (s) => {
    setSeconds(s);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);
  return { seconds, start };
}

function ResendLink({ email }) {
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const { seconds, start } = useCountdown();

  const handleResend = async (e) => {
    e.preventDefault();
    if (seconds > 0 || sending) return;
    setSending(true);
    setMsg('');
    try {
      const res = await apiClient.post('/auth/resend-verification', { email });
      setMsg(res.data?.message || 'Email sent!');
      setMsgOk(true);
      start(60);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === 'RESEND_COOLDOWN' && data?.wait_seconds) {
        start(data.wait_seconds);
        setMsg(`Please wait ${data.wait_seconds}s before resending.`);
        setMsgOk(false);
      } else {
        setMsg(data?.message || 'Failed to resend.');
        setMsgOk(false);
      }
    } finally {
      setSending(false);
    }
  };

  const isDisabled = seconds > 0 || sending;

  return (
    <div style={{ textAlign: 'center' }}>
      {msg && <p style={{ fontSize: '0.78rem', color: msgOk ? '#22c55e' : '#f87171', marginBottom: '0.3rem' }}>{msg}</p>}
      <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
        Didn't receive it?{' '}
        <a
          href="#"
          onClick={handleResend}
          style={{ color: isDisabled ? 'var(--color-text-muted)' : 'var(--color-red-primary)', pointerEvents: isDisabled ? 'none' : 'auto', fontWeight: 600 }}
        >
          {sending ? 'Sending…' : seconds > 0 ? `Resend in ${seconds}s` : 'Resend email'}
        </a>
      </p>
    </div>
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

const NAME_REGEX = /^[A-Za-z][A-Za-z .'-]*$/;
const PHONE_ALLOWED_CHARS_REGEX = /^[0-9+\-\s()]+$/;

function validateName(value, label) {
  const input = String(value || '').trim();
  if (!input) return `${label} is required.`;
  if (input.length > 100) return `${label} is too long.`;
  if (!NAME_REGEX.test(input)) return `${label} has invalid characters.`;
  return '';
}

function validatePhone(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (input.length > 25) return 'Phone number is too long.';
  if (!PHONE_ALLOWED_CHARS_REGEX.test(input)) return 'Enter a valid phone number.';
  const digits = input.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return 'Enter a valid phone number.';
  return '';
}

function sanitizePhoneInput(value) {
  return String(value || '').replace(/[^0-9+\-\s()]/g, '').slice(0, 25);
}

function RegisterView() {
  const { register, loginWithGoogle } = useAuth();
  const { navigate, viewParams } = useView();
  const [googleError, setGoogleError] = useState('');
  const [googleNotice, setGoogleNotice] = useState('');
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleError('');
    setGoogleNotice('');
    setGoogleSubmitting(true);
    try {
      const res = await apiClient.post('/auth/google', { credential: credentialResponse.credential });
      const data = res.data;
      loginWithGoogle(data.data);
      navigate(VIEWS.HOME);
    } catch (err) {
      const data = err?.response?.data || {};
      if (data.code === 'ACCOUNT_NOT_FOUND') {
        // Already on the register page: prefill the verified details so the
        // user just completes the form instead of retyping.
        if (data.email) onChange('email', data.email);
        if (data.name) {
          const parts = String(data.name).split(' ');
          if (!form.first_name) onChange('first_name', parts[0] || '');
          if (!form.last_name) onChange('last_name', parts.slice(1).join(' ') || '');
        }
        setGoogleNotice(data.message || 'Account does not exist. Please create an account.');
        setGoogleError('');
      } else {
        setGoogleError(data.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    password: '', phone_number: '', date_of_birth: ''
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldsReadonly, setFieldsReadonly] = useState({
    first_name: true, last_name: true, email: true,
    password: true, confirm: true, phone: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const onChange = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // Arriving from a Google ACCOUNT_NOT_FOUND redirect: prefill the verified
  // details so only the remaining fields need filling in.
  useEffect(() => {
    if (!viewParams?.fromGoogle) return;
    setForm((p) => ({
      ...p,
      email: viewParams.email || p.email,
      first_name: viewParams.first_name || p.first_name,
      last_name: viewParams.last_name || p.last_name,
    }));
    setGoogleNotice('Account does not exist. Please create an account below.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewParams?.fromGoogle]);

  const age = calculateAge(form.date_of_birth);
  const dobError = form.date_of_birth && age < 18
    ? `You must be at least 18 years old. (You are ${age})`
    : '';
  const firstNameError = validateName(form.first_name, 'First name');
  const lastNameError = validateName(form.last_name, 'Last name');
  const phoneError = validatePhone(form.phone_number);
  const passwordMismatch = confirmPassword && form.password !== confirmPassword;
  const canSubmit =
    ageConfirmed &&
    !dobError &&
    !firstNameError &&
    !lastNameError &&
    !phoneError &&
    form.date_of_birth &&
    !submitting &&
    !passwordMismatch &&
    confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) {
      setError(firstNameError || lastNameError || phoneError || dobError || 'Please check your inputs.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await register({
        ...form,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
      });
      setStep(2);
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 2) {
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
                <span>ACCOUNT CREATED</span>
              </div>
              <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>CHECK YOUR <span style={{ color: 'var(--color-red-primary)' }}>EMAIL</span></h1>
            </div>
            <p className="text-muted" style={{ fontSize: '0.9rem', maxWidth: 320 }}>
              We sent a confirmation to <strong style={{ color: '#fff' }}>{form.email}</strong>.
              Please verify your email — then an admin will review your
              account before you can log in.
            </p>
            <div className="glass-card" style={{ width: '100%', padding: '1rem 1.25rem', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', textAlign: 'left' }}>
                <CheckCircle size={18} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: '0.82rem', color: '#fff', fontWeight: 600 }}>What to do next</p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', lineHeight: 1.6 }}>
                    Open the email from The Party Goers PH and click the confirmation link. Check your spam folder if you don't see it.
                  </p>
                </div>
              </div>
            </div>
            <button
              className="btn btn-red w-full btn-red-pulse"
              onClick={() => navigate(VIEWS.LOGIN)}
            >
              Go to Login
            </button>
            <ResendLink email={form.email} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-view">
      <form className="glass-card auth-card" onSubmit={handleSubmit} autoComplete="off">
        <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="land-live-badge" style={{ marginBottom: '0.25rem', alignSelf: 'flex-start' }}>
            <span className="land-live-dot" />
            <span>NEW CUSTOMER</span>
          </div>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>CREATE <span style={{ color: 'var(--color-red-primary)' }}>ACCOUNT</span></h1>

          <div className="g g-2">
            <input
              className="glass-input"
              placeholder="First name"
              value={form.first_name}
              onChange={e => onChange('first_name', e.target.value)}
              maxLength={100}
              onFocus={() => setFieldsReadonly(p => ({ ...p, first_name: false }))}
              readOnly={fieldsReadonly.first_name}
              autoComplete="off"
              required
            />
            <input
              className="glass-input"
              placeholder="Last name"
              value={form.last_name}
              onChange={e => onChange('last_name', e.target.value)}
              maxLength={100}
              onFocus={() => setFieldsReadonly(p => ({ ...p, last_name: false }))}
              readOnly={fieldsReadonly.last_name}
              autoComplete="off"
              required
            />
          </div>
          {(firstNameError || lastNameError) && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '-0.4rem' }}>
              {firstNameError || lastNameError}
            </p>
          )}
          <input
            className="glass-input"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => onChange('email', e.target.value)}
            onFocus={() => setFieldsReadonly(p => ({ ...p, email: false }))}
            readOnly={fieldsReadonly.email}
            autoComplete="off"
            required
          />
          <div className="password-input-wrapper">
            <input
              className="glass-input password-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min 6 chars)"
              minLength={6}
              value={form.password}
              onChange={e => onChange('password', e.target.value)}
              onFocus={() => setFieldsReadonly(p => ({ ...p, password: false }))}
              readOnly={fieldsReadonly.password}
              autoComplete="new-password"
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
          <div>
            <div className="password-input-wrapper">
              <input
                className="glass-input password-input"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onFocus={() => setFieldsReadonly(p => ({ ...p, confirm: false }))}
                readOnly={fieldsReadonly.confirm}
                autoComplete="new-password"
                required
                style={{ width: '100%', boxSizing: 'border-box', borderColor: passwordMismatch ? '#ef4444' : '' }}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordMismatch && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.3rem' }}>Passwords do not match.</p>
            )}
            {confirmPassword && !passwordMismatch && form.password && (
              <p style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.3rem' }}>Passwords match.</p>
            )}
          </div>
          <input
            className="glass-input"
            type="tel"
            inputMode="tel"
            placeholder="Phone number (optional)"
            value={form.phone_number}
            onChange={e => onChange('phone_number', sanitizePhoneInput(e.target.value))}
            maxLength={25}
            onFocus={() => setFieldsReadonly(p => ({ ...p, phone: false }))}
            readOnly={fieldsReadonly.phone}
            autoComplete="off"
          />
          {phoneError && (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '-0.4rem' }}>
              {phoneError}
            </p>
          )}

          {/* Birthday */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
              <Calendar size={13} /> Date of Birth
            </label>
            <input
              className="glass-input"
              type="date"
              value={form.date_of_birth}
              onChange={e => onChange('date_of_birth', e.target.value)}
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              required
            />
            {dobError && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.3rem' }}>{dobError}</p>
            )}
          </div>

          {/* 18+ notice + checkbox */}
          <div style={{ background: 'var(--color-bg-elevated)', border: '1px solid rgba(204,0,0,0.2)', borderRadius: 10, padding: '0.85rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.65rem' }}>
              <ShieldCheck size={16} color="#CC0000" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: '#fff' }}>18+ Only.</strong> The Party Goers PH is a nightlife platform exclusively for adults aged 18 and above. You must be of legal age to access bar services, reservations, and events.
              </p>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={e => setAgeConfirmed(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#CC0000', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.82rem', color: ageConfirmed ? '#fff' : 'var(--color-text-muted)', fontWeight: ageConfirmed ? 600 : 400, transition: 'color 0.2s' }}>
                I confirm that I am 18 years old or above
              </span>
              {ageConfirmed && <CheckCircle size={14} color="#22c55e" style={{ flexShrink: 0 }} />}
            </label>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button
            className="btn btn-red w-full"
            type="submit"
            disabled={!canSubmit}
            style={{ opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'opacity 0.2s' }}
          >
            {submitting ? 'Creating account...' : 'Create Account'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.1rem 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>OR SIGN UP WITH</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {googleError && <p className="error-text">{googleError}</p>}
          {googleNotice && <p style={{ fontSize: '0.82rem', color: '#22c55e' }}>{googleNotice}</p>}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {isGoogleConfigured() ? (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setGoogleError(googleSignInErrorText())}
                theme="filled_black"
                shape="pill"
                size="large"
                text="signup_with"
                width="320"
                useOneTap={false}
                disabled={googleSubmitting}
              />
            ) : (
              <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>
                Google sign-up is not configured for this site yet. Please register with email.
              </p>
            )}
          </div>

          <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>
            Already have an account?{' '}
            <a href="#" onClick={e => { e.preventDefault(); navigate(VIEWS.LOGIN); }}>Login</a>
          </p>
        </div>
      </form>
    </div>
  );
}

export default RegisterView;
