import { useState, useEffect, useRef } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import apiClient from '../api/client';
import { isGoogleConfigured, googleSignInErrorText } from '../utils/googleAuth';
import { validatePasswordStrength, STRENGTH_COLORS } from '../utils/passwordPolicy';
import { normalizeCustomerPhone, sanitizePhoneInput, isValidCustomerPhone } from '../utils/phonePolicy';
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

const ID_TYPES = ['Driver\'s License', 'PhilSys National ID', 'Philippine Passport', 'UMID', 'PRC ID', 'Postal ID', 'Voter\'s ID', 'PhilHealth ID', 'SSS ID', 'Senior Citizen ID'];
const ID_TYPES_WITH_BACK = ID_TYPES;

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

function validateName(value, label) {
  const input = String(value || '').trim();
  if (!input) return `${label} is required.`;
  if (input.length > 100) return `${label} is too long.`;
  if (!NAME_REGEX.test(input)) return `${label} has invalid characters.`;
  return '';
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
  const [wizardStep, setWizardStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    password: '', phone_number: '', date_of_birth: ''
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [selfieImage, setSelfieImage] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [consent, setConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const selfieRef = useRef(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldsReadonly, setFieldsReadonly] = useState({
    first_name: true, last_name: true, email: true,
    password: true, confirm: true, phone: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Live email availability: idle | invalid | checking | available | taken | taken-unverified | error
  const [emailCheck, setEmailCheck] = useState({ status: 'idle' });
  const emailCheckAbort = useRef(null);
  const emailCheckTimer = useRef(null);

  // Show field errors only after touch or a submit attempt.
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const markTouched = (key) => setTouched((p) => (p[key] ? p : { ...p, [key]: true }));

  const emailFormatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  useEffect(() => {
    if (!emailFormatOk) {
      if (emailCheckAbort.current) emailCheckAbort.current.abort();
      if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
      setEmailCheck({ status: form.email.trim() ? 'invalid' : 'idle' });
      return;
    }
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    emailCheckTimer.current = setTimeout(async () => {
      if (emailCheckAbort.current) emailCheckAbort.current.abort();
      const controller = new AbortController();
      emailCheckAbort.current = controller;
      setEmailCheck({ status: 'checking' });
      try {
        const res = await apiClient.get('/auth/check-email', {
          params: { email: form.email.trim() },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const data = res.data || {};
        if (data.available) {
          setEmailCheck({ status: 'available' });
        } else if (data.status === 'unverified') {
          setEmailCheck({ status: 'taken-unverified' });
        } else {
          setEmailCheck({ status: 'taken' });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setEmailCheck({ status: 'error' });
      }
    }, 500);
    return () => {
      if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.email, emailFormatOk]);

  useEffect(() => () => {
    if (emailCheckAbort.current) emailCheckAbort.current.abort();
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
  }, []);

  const onChange = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleImage = (file, setFile, setPreview) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, or WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Each image must be 5 MB or smaller.');
      return;
    }
    setFile(file);
    setPreview(URL.createObjectURL(file));
    setError('');
  };

  const needsBack = ID_TYPES_WITH_BACK.includes(idType);

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
  const phoneCheck = normalizeCustomerPhone(form.phone_number);
  const phoneError = form.phone_number.trim() ? (phoneCheck.error || '') : '';
  const pwCheck = validatePasswordStrength(form.password, {
    name: `${form.first_name} ${form.last_name}`,
    email: form.email,
  });
  const passwordMismatch = confirmPassword && form.password !== confirmPassword;
  const emailTaken = emailCheck.status === 'taken' || emailCheck.status === 'taken-unverified';
  const emailBusy = emailCheck.status === 'checking';
  const showEmailError = touched.email || submitAttempted;
  const showPasswordError = touched.password || submitAttempted;
  const showPhoneError = touched.phone_number || submitAttempted;
const showFirstNameError = touched.first_name || submitAttempted;
const showLastNameError = touched.last_name || submitAttempted;
  const canSubmit =
    ageConfirmed &&
    !dobError &&
    !firstNameError &&
    !lastNameError &&
    !phoneError &&
    form.date_of_birth &&
    !submitting &&
    !passwordMismatch &&
    confirmPassword &&
    pwCheck.ok &&
    emailFormatOk &&
    !emailBusy &&
    !emailTaken &&
    idType &&
    frontImage &&
    selfieImage &&
    (!needsBack || backImage) &&
    consent &&
    privacyConsent;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!canSubmit) {
      setError(firstNameError || lastNameError || phoneError || dobError || pwCheck.message || 'Please check your inputs.');
      return;
    }
    setError('');
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('first_name', form.first_name.trim());
      formData.append('last_name', form.last_name.trim());
      formData.append('email', form.email.trim());
      formData.append('password', form.password);
      if (form.phone_number) formData.append('phone_number', form.phone_number.trim());
      formData.append('date_of_birth', form.date_of_birth);
      formData.append('id_type', idType);
      if (idNumber) formData.append('id_number', idNumber);
      formData.append('id_front', frontImage);
      if (needsBack && backImage) formData.append('id_back', backImage);
      formData.append('id_selfie', selfieImage);
      formData.append('consent', String(consent));
      formData.append('privacy_consent', String(privacyConsent));

      await apiClient.post('/auth/register', formData, {
        timeout: 20000,
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setSubmitted(true);
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.message || err?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  if (submitted) {
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
              onBlur={() => markTouched('first_name')}
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
              onBlur={() => markTouched('last_name')}
              readOnly={fieldsReadonly.last_name}
              autoComplete="off"
              required
            />
          </div>
          {(showFirstNameError && firstNameError) || (showLastNameError && lastNameError) ? (
            <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '-0.4rem', marginBottom: 0 }}>
              {showFirstNameError && firstNameError ? firstNameError : lastNameError}
            </p>
          ) : null}
          <input
            className="glass-input"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => onChange('email', e.target.value)}
            onFocus={() => setFieldsReadonly(p => ({ ...p, email: false }))}
            onBlur={() => markTouched('email')}
            readOnly={fieldsReadonly.email}
            autoComplete="off"
            required
          />
          <div aria-live="polite">
            {showEmailError && emailCheck.status === 'checking' && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '-0.4rem', marginBottom: 0 }}>Checking…</p>
            )}
            {showEmailError && emailCheck.status === 'available' && form.email.trim() && (
              <p style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '-0.4rem', marginBottom: 0 }}>Email is available</p>
            )}
            {showEmailError && emailCheck.status === 'taken' && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '-0.4rem', marginBottom: 0 }}>
                This email is already registered. <a href="#" onClick={e => { e.preventDefault(); navigate(VIEWS.LOGIN); }} style={{ color: 'var(--color-red-primary)', fontWeight: 600 }}>Log in instead</a>
              </p>
            )}
            {showEmailError && emailCheck.status === 'taken-unverified' && (
              <p style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '-0.4rem', marginBottom: 0 }}>
                This email is waiting for verification.{' '}
                <a href="#" onClick={e => { e.preventDefault(); navigate(VIEWS.VERIFY_EMAIL, { email: form.email.trim() }); }} style={{ color: 'var(--color-red-primary)', fontWeight: 600 }}>Resend code</a>
              </p>
            )}
            {showEmailError && emailCheck.status === 'error' && (
              <p style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '-0.4rem', marginBottom: 0 }}>Couldn't check email, try again</p>
            )}
            {showEmailError && emailCheck.status === 'invalid' && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '-0.4rem', marginBottom: 0 }}>Enter a valid email address</p>
            )}
          </div>
          <div className="password-input-wrapper">
            <input
              className="glass-input password-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min 8 chars)"
              value={form.password}
              onChange={e => onChange('password', e.target.value)}
              onFocus={() => setFieldsReadonly(p => ({ ...p, password: false }))}
              onBlur={() => markTouched('password')}
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
          {/* Rendered only while there is a password to grade — the form stays
              compact and grows naturally as guidance appears. */}
          {form.password && (
            <div style={{ marginTop: '0.4rem' }} aria-live="polite">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.round((pwCheck.score / 6) * 100)}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: STRENGTH_COLORS[pwCheck.label],
                    transition: 'width 0.2s',
                  }} />
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: form.password ? STRENGTH_COLORS[pwCheck.label] : 'var(--color-text-muted)', minWidth: 44, textAlign: 'right' }}>
                  {form.password ? pwCheck.label : ''}
                </span>
              </div>
              {(form.password) && (
              <ul style={{ listStyle: 'none', margin: '0.45rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {[
                  ['At least 8 characters (12+ is stronger)', pwCheck.checks.length],
                  ['Uppercase letter', pwCheck.checks.upper],
                  ['Lowercase letter', pwCheck.checks.lower],
                  ['Number', pwCheck.checks.digit],
                  ['Special character', pwCheck.checks.special],
                  ['Not a common password', pwCheck.checks.notCommon],
                  ["Doesn't contain your name or email", pwCheck.checks.notPersonal],
                ].map(([label, met]) => (
                  <li key={label} style={{ fontSize: '0.72rem', color: met ? '#22c55e' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span aria-hidden="true">{met ? '✓' : '○'}</span> {label}
                  </li>
                ))}
              </ul>
              )}
              {showPasswordError && !pwCheck.ok && (
                <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.3rem' }}>{pwCheck.message}</p>
              )}
            </div>
          )}
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
            {confirmPassword ? (
              passwordMismatch ? (
                <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.3rem', marginBottom: 0 }}>Passwords do not match.</p>
              ) : (
                <p style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '0.3rem', marginBottom: 0 }}>Passwords match.</p>
              )
            ) : null}
          </div>
          <input
            className="glass-input"
            type="tel"
            inputMode="numeric"
            placeholder="Phone number (optional, 09xxxxxxxxx)"
            value={form.phone_number}
            onChange={e => onChange('phone_number', sanitizePhoneInput(e.target.value))}
            onBlur={() => markTouched('phone_number')}
            maxLength={11}
            onFocus={() => setFieldsReadonly(p => ({ ...p, phone: false }))}
            readOnly={fieldsReadonly.phone}
            autoComplete="off"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '-0.4rem' }} aria-live="polite">
            <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>
              {showPhoneError && phoneError ? phoneError : ''}
            </span>
            <span style={{ fontSize: '0.72rem', color: form.phone_number.length === 11 ? '#22c55e' : 'var(--color-text-muted)' }}>
              {form.phone_number.length}/11
            </span>
          </div>

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
              <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.3rem', marginBottom: 0 }}>{dobError}</p>
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

          {/* ID verification section */}
          <div style={{ marginTop: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Verify your age and identity</h3>
            <select className="glass-input" value={idType} onChange={e => setIdType(e.target.value)} onBlur={() => markTouched('id_type')} required>
              <option value="">Select ID type</option>
              {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="glass-input" placeholder="ID number (optional)" value={idNumber} onChange={e => setIdNumber(e.target.value)} style={{ marginTop: '0.5rem' }} />
            <div style={{ marginTop: '0.75rem' }}>
              <label>ID Front Photo (required)</label>
              <input ref={frontRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleImage(e.target.files[0], setFrontImage, setFrontPreview)} style={{ display: 'none' }} />
              {frontPreview ? (
                <div className="preview">
                  <img src={frontPreview} alt="ID front" style={{ maxWidth: '200px' }} />
                  <button type="button" onClick={() => frontRef.current?.click()}>Replace</button>
                </div>
              ) : (
                <button type="button" className="button secondary" onClick={() => frontRef.current?.click()}>Upload Front Photo</button>
              )}
            </div>
            {needsBack && (
              <div style={{ marginTop: '0.75rem' }}>
                <label>ID Back Photo (required)</label>
                <input ref={backRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleImage(e.target.files[0], setBackImage, setBackPreview)} style={{ display: 'none' }} />
                {backPreview ? (
                  <div className="preview">
                    <img src={backPreview} alt="ID back" style={{ maxWidth: '200px' }} />
                    <button type="button" onClick={() => backRef.current?.click()}>Replace</button>
                  </div>
                ) : (
                  <button type="button" className="button secondary" onClick={() => backRef.current?.click()}>Upload Back Photo</button>
                )}
              </div>
            )}
            <div style={{ marginTop: '0.75rem' }}>
              <label>Selfie holding ID (required)</label>
              <input ref={selfieRef} type="file" accept="image/*" capture="user" onChange={(e) => handleImage(e.target.files[0], setSelfieImage, setSelfiePreview)} style={{ display: 'none' }} />
              {selfiePreview ? (
                <div className="preview">
                  <img src={selfiePreview} alt="Selfie" style={{ maxWidth: '200px' }} />
                  <button type="button" onClick={() => selfieRef.current?.click()}>Replace</button>
                </div>
              ) : (
                <button type="button" className="button secondary" onClick={() => selfieRef.current?.click()}>Upload Selfie</button>
              )}
            </div>
            <div className="tips" style={{ marginTop: '0.5rem' }}>
              <p><strong>Tips:</strong> All 4 corners visible, text readable, not expired, no glare, no screenshots.</p>
            </div>
            <label className="checkbox" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              I confirm I am 18+ and the ID provided is mine.
            </label>
            <label className="checkbox" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={privacyConsent} onChange={(e) => setPrivacyConsent(e.target.checked)} />
              I consent to the collection and processing of my ID for age and identity verification under the Data Privacy Act (RA 10173).
            </label>
          </div>

          {uploadProgress > 0 && submitting && (
            <p style={{ fontSize: '0.8rem' }}>Uploading... {uploadProgress}%</p>
          )}



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
