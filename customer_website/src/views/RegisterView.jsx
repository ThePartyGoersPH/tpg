import { useState, useEffect, useRef } from 'react';
import '../styles/register-wizard.css';
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

  // Sync wizard step with URL ?step= param (browser back/forward)
  // Listen for browser back/forward button
  useEffect(() => {
    const handlePopState = () => {
      const step = getStepFromUrl();
      if (step !== wizardStep) {
        setWizardStep(step);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [wizardStep]);

  // Focus first field of each step
  useEffect(() => {
    const timer = setTimeout(() => {
      const firstInput = document.querySelector('.glass-card input, .glass-card select, .glass-card button');
      if (firstInput) firstInput.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [wizardStep]);
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
const ID_TYPES_WITH_BACK = ID_TYPES.filter(t => t !== 'Philippine Passport');

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
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    password: '', phone_number: '', date_of_birth: ''
  });
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [stepGuardMsg, setStepGuardMsg] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [selfieImage, setSelfieImage] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [ocrHints, setOcrHints] = useState(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrError, setOcrError] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const frontRef = useRef(null);
  const backRef = useRef(null);
  const selfieRef = useRef(null);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldsReadonly, setFieldsReadonly] = useState({
    first_name: true, last_name: true, email: true,
    password: true, confirm: true, phone: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailCheck, setEmailCheck] = useState({ status: 'idle' });
  const emailCheckAbort = useRef(null);
  const emailCheckTimer = useRef(null);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

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

  const getStepFromUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const step = parseInt(params.get('step') || '1', 10);
      return Math.min(4, Math.max(1, isNaN(step) ? 1 : step));
    } catch (e) {
      return 1;
    }
  };
  const [wizardStep, setWizardStep] = useState(getStepFromUrl());

  // Persist non-sensitive fields across refresh (never password or images)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('tpg_register_form');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.form) setForm(prev => ({ ...prev, ...parsed.form, password: '' }));
        if (parsed.idType) setIdType(parsed.idType);
        if (parsed.idNumber) setIdNumber(parsed.idNumber);
        if (parsed.consent !== undefined) setConsent(parsed.consent);
        if (parsed.privacyConsent !== undefined) setPrivacyConsent(parsed.privacyConsent);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('tpg_register_form', JSON.stringify({
        form: { first_name: form.first_name, last_name: form.last_name, email: form.email, phone_number: form.phone_number, date_of_birth: form.date_of_birth },
        idType,
        idNumber,
        consent,
        privacyConsent,
      }));
    } catch (e) {}
  }, [form.first_name, form.last_name, form.email, form.phone_number, form.date_of_birth, idType, idNumber, consent, privacyConsent]);

  const needsBack = ID_TYPES_WITH_BACK.includes(idType);
  const emailFormatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
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

  const step1Valid =
    !firstNameError &&
    !lastNameError &&
    emailFormatOk &&
    !emailBusy &&
    !emailTaken &&
    !phoneError &&
    pwCheck.ok &&
    !passwordMismatch &&
    confirmPassword;
  const step2Valid = !!form.date_of_birth && !dobError && ageConfirmed;
  const step3Valid = !!idType && !!frontImage && (!needsBack || !!backImage) && !!selfieImage;
  const step4Valid = consent && privacyConsent;

  // Step guard: redirect to first incomplete step if required data is missing
  useEffect(() => {
    let target = 1;
    if (step1Valid) target = 2;
    if (step1Valid && step2Valid) target = 3;
    if (step1Valid && step2Valid && step3Valid) target = 4;
    if (wizardStep > target) {
      setStepGuardMsg('Please complete the previous steps.');
      setWizardStep(target);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('step', String(target));
        window.history.replaceState({}, '', url.toString());
      } catch (e) {}
    } else {
      setStepGuardMsg('');
    }
  }, [wizardStep, step1Valid, step2Valid, step3Valid]);


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

  // OCR scan when front image changes (non-blocking)
  useEffect(() => {
    if (!frontImage || !idType) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setOcrScanning(true);
      setOcrError(null);
      setOcrHints(null);
      try {
        const formData = new FormData();
        formData.append('file', frontImage);
        formData.append('type', 'id');
        formData.append('id_type', idType);
        if (form.first_name) formData.append('name', `${form.first_name} ${form.last_name}`.trim());
        if (form.date_of_birth) formData.append('dob', form.date_of_birth);
        const res = await apiClient.post('/api/ocr/extract', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          signal: controller.signal,
          timeout: 20000,
        });
        if (cancelled) return;
        const data = res.data?.data || {};
        const fields = data.fields || {};
        const hints = data.hints || [];
        setOcrHints(hints);
        // Pre-fill empty fields only (suggestions)
        setForm((prev) => {
          const next = { ...prev };
          if (fields.fullName && !prev.first_name && !prev.last_name) {
            const parts = String(fields.fullName).trim().split(/\s+/);
            if (parts.length > 1) {
              next.first_name = parts.slice(0, -1).join(' ');
              next.last_name = parts[parts.length - 1];
            } else {
              next.first_name = parts[0] || prev.first_name;
            }
          }
          if (fields.birthdate && !prev.date_of_birth) next.date_of_birth = fields.birthdate;
          return next;
        });
        if (fields.idNumber && !idNumber) setIdNumber(fields.idNumber);
        if (data.lowConfidence) setOcrError(true); else setOcrError(false);
      } catch (err) {
        if (cancelled) return;
        if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
        setOcrError(true);
        setOcrHints(null);
      } finally {
        if (!cancelled) setOcrScanning(false);
      }
    }, 500); // debounce
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [frontImage, idType]);


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

  const updateUrlStep = (step) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('step', String(step));
      window.history.pushState({}, '', url.toString());
    } catch (e) {}
  };

  const goNext = () => {
    setSubmitAttempted(true);
    if (wizardStep === 1) {
      setTouched((t) => ({ ...t, first_name: true, last_name: true, email: true, phone_number: true, password: true }));
      if (!step1Valid) {
        if (firstNameError) firstNameRef.current?.focus();
        else if (lastNameError) lastNameRef.current?.focus();
        else if (!emailFormatOk || emailBusy || emailTaken) emailRef.current?.focus();
        else if (phoneError) phoneRef.current?.focus();
        else if (!pwCheck.ok) passwordRef.current?.focus();
        else if (passwordMismatch || !confirmPassword) confirmRef.current?.focus();
        return;
      }
    }
    if (wizardStep === 2 && !step2Valid) return;
    if (wizardStep === 3 && !step3Valid) return;
    const next = Math.min(4, wizardStep + 1);
    setWizardStep(next);
    updateUrlStep(next);
  };
  const goBack = () => {
    const prev = Math.max(1, wizardStep - 1);
    setWizardStep(prev);
    updateUrlStep(prev);
  };

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
      <form className="glass-card auth-card" onSubmit={handleSubmit} autoComplete="off" onKeyDown={(e) => {
        if (e.key === 'Enter' && wizardStep < 4 && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          goNext();
        }
      }}>
        <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px', textAlign: 'left' }}>Create your account</h1>
          <p style={{ textAlign: 'left', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Complete all 4 steps to register.</p>
          {stepGuardMsg && (
            <p style={{ fontSize: '0.85rem', color: '#f59e0b', textAlign: 'left', margin: '0.25rem 0' }}>{stepGuardMsg}</p>
          )}

          {/* Circle stepper */}
          <div className="wizard-stepper wizard-stepper-circles" aria-live="polite" style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '0.5rem' }}>
            {['Account', 'Age', 'Identity', 'Review'].map((label, i) => {
              const step = i + 1;
              const done = wizardStep > step;
              const current = wizardStep === step;
              return (
                <div key={step} style={{ display: 'flex', alignItems: 'center', flex: step < 4 ? 1 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: 48 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: '0.85rem',
                      background: done ? '#22c55e' : current ? 'var(--color-red-primary)' : 'var(--color-bg-elevated)',
                      color: done || current ? '#fff' : 'var(--color-text-muted)',
                      border: done || current ? 'none' : '2px solid var(--color-border)',
                      transition: 'all 0.2s ease',
                    }}>
                      {done ? '✓' : step}
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: current ? 700 : 400, color: current ? 'var(--color-red-primary)' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                  </div>
                  {step < 4 && (
                    <div style={{ flex: 1, height: 2, background: wizardStep > step ? '#22c55e' : 'var(--color-border)', margin: '0 0.5rem', marginBottom: '1.2rem', transition: 'background 0.3s ease' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile stepper text */}
          <p className="wizard-stepper-text" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: '0.25rem', display: 'none' }}>Step {wizardStep} of 4</p>

          {/* Full-width progress bar */}
          <div style={{ width: '100%', height: 8, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden', marginBottom: '0.25rem' }}>
            <div style={{ width: `${(wizardStep / 4) * 100}%`, height: '100%', borderRadius: 999, background: 'var(--color-red-primary)', transition: 'width 0.3s ease' }} />
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'left' }}>Step {wizardStep} of 4</p>

          {wizardStep === 1 && (
            <>
              <div className="g g-2">
            <input
              className="glass-input"
              ref={firstNameRef}
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
              ref={lastNameRef}
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
            ref={emailRef}
            placeholder="Email"
            value={form.email}
            onChange={e => onChange('email', e.target.value)}
            onFocus={() => setFieldsReadonly(p => ({ ...p, email: false }))}
            onBlur={() => markTouched('email')}
            readOnly={fieldsReadonly.email}
            autoComplete="off"
            required
          />
          <div>
            <input
              className="glass-input"
              type="tel"
              inputMode="numeric"
              placeholder="Phone number (optional)"
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
          </div>
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
              placeholder="Password"
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
            </>
          )}

          {/* Birthday */}
          {wizardStep === 2 && (
            <>
          <div className="g g-2">
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-elevated)', borderRadius: 10, padding: '0.85rem' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>Your age</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.25rem 0', color: form.date_of_birth && calculateAge(form.date_of_birth) >= 18 ? '#22c55e' : '#ef4444' }}>
                {form.date_of_birth ? calculateAge(form.date_of_birth) : '—'}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: 0 }}>
                {form.date_of_birth ? (calculateAge(form.date_of_birth) >= 18 ? '18+ ✓' : 'Under 18') : 'Enter DOB'}
              </p>
            </div>
          </div>
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

            </>
          )}

          {/* ID verification section */}
          {wizardStep === 3 && (
            <>
          <div className="g g-2">
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>ID type</label>
              <select className="glass-input" value={idType} onChange={e => setIdType(e.target.value)} onBlur={() => markTouched('id_type')} required>
                <option value="">Select ID type</option>
                {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>ID number (optional)</label>
              <input className="glass-input" placeholder="ID number" value={idNumber} onChange={e => setIdNumber(e.target.value)} />
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', marginBottom: 0 }}>Only the last 4 characters are stored.</p>
            </div>
          </div>

          <div className="g g-2">
            {/* ID Front upload box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>ID Front Photo</label>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}>Required</span>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => frontRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); frontRef.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-red-primary)'; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-border)'; if (e.dataTransfer.files[0]) handleImage(e.dataTransfer.files[0], setFrontImage, setFrontPreview); }}
                style={{
                  border: '2px dashed var(--color-border)',
                  borderRadius: 12,
                  minHeight: 160,
                  aspectRatio: '16/10',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'var(--color-bg-elevated)',
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'border-color 0.2s',
                }}
              >
                <input ref={frontRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleImage(e.target.files[0], setFrontImage, setFrontPreview)} style={{ display: 'none' }} />
                {frontPreview ? (
                  <>
                    <img src={frontPreview} alt="ID front" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 999, fontWeight: 600 }}>Uploaded</div>
                    <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); frontRef.current?.click(); }} style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Replace</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setFrontImage(null); setFrontPreview(null); }} style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem', background: 'rgba(239,68,68,0.8)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Remove</button>
                    </div>
                  </>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" style={{ marginBottom: '0.5rem' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, textAlign: 'center' }}>Tap to upload or take a photo</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0', opacity: 0.7 }}>JPG, PNG or WEBP, max 5 MB</p>
                  </>
                )}
              </div>
            </div>

            {/* ID Back upload box */}
            {needsBack ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>ID Back Photo</label>
                  <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}>Required</span>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => backRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); backRef.current?.click(); } }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-red-primary)'; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                  onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-border)'; if (e.dataTransfer.files[0]) handleImage(e.dataTransfer.files[0], setBackImage, setBackPreview); }}
                  style={{
                    border: '2px dashed var(--color-border)',
                    borderRadius: 12,
                    minHeight: 160,
                    aspectRatio: '16/10',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'var(--color-bg-elevated)',
                    overflow: 'hidden',
                    position: 'relative',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <input ref={backRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleImage(e.target.files[0], setBackImage, setBackPreview)} style={{ display: 'none' }} />
                  {backPreview ? (
                    <>
                      <img src={backPreview} alt="ID back" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                      <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 999, fontWeight: 600 }}>Uploaded</div>
                      <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        <button type="button" onClick={(e) => { e.stopPropagation(); backRef.current?.click(); }} style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Replace</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setBackImage(null); setBackPreview(null); }} style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem', background: 'rgba(239,68,68,0.8)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Remove</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" style={{ marginBottom: '0.5rem' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, textAlign: 'center' }}>Tap to upload or take a photo</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0', opacity: 0.7 }}>JPG, PNG or WEBP, max 5 MB</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.5 }}>ID Back Photo</label>
                </div>
                <div style={{
                  border: '2px dashed var(--color-border)',
                  borderRadius: 12,
                  minHeight: 160,
                  aspectRatio: '16/10',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--color-bg-elevated)',
                  opacity: 0.4,
                }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, textAlign: 'center' }}>ID Back (not needed for this ID)</p>
                </div>
              </div>
            )}

            {/* Selfie upload box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Selfie holding ID</label>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 999, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 600 }}>Required</span>
              </div>
              <div
                role="button"
                tabIndex={0}
                onClick={() => selfieRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selfieRef.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-red-primary)'; }}
                onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-border)'; if (e.dataTransfer.files[0]) handleImage(e.dataTransfer.files[0], setSelfieImage, setSelfiePreview); }}
                style={{
                  border: '2px dashed var(--color-border)',
                  borderRadius: 12,
                  minHeight: 160,
                  aspectRatio: '16/10',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'var(--color-bg-elevated)',
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'border-color 0.2s',
                }}
              >
                <input ref={selfieRef} type="file" accept="image/*" capture="user" onChange={(e) => handleImage(e.target.files[0], setSelfieImage, setSelfiePreview)} style={{ display: 'none' }} />
                {selfiePreview ? (
                  <>
                    <img src={selfiePreview} alt="Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(34,197,94,0.9)', color: '#fff', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 999, fontWeight: 600 }}>Uploaded</div>
                    <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); selfieRef.current?.click(); }} style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Replace</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setSelfieImage(null); setSelfiePreview(null); }} style={{ fontSize: '0.75rem', padding: '0.3rem 0.8rem', background: 'rgba(239,68,68,0.8)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Remove</button>
                    </div>
                  </>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" style={{ marginBottom: '0.5rem' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: 0, textAlign: 'center' }}>Tap to upload or take a photo</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', margin: '0.25rem 0 0', opacity: 0.7 }}>JPG, PNG or WEBP, max 5 MB</p>
                  </>
                )}
              </div>
            </div>

            {/* Tips card */}
            <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 10, padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Tips for a good photo</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
                <li>✓ All 4 corners visible</li>
                <li>✓ Text readable</li>
                <li>✓ Not expired</li>
                <li>✓ No glare</li>
                <li>✓ No screenshots</li>
              </ul>
            </div>
          </div>

          {/* Privacy note */}
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0.75rem', background: 'var(--color-bg-elevated)', borderRadius: 8, lineHeight: 1.6 }}>
            <strong>Privacy:</strong> Your ID is used only for age and identity verification, reviewed by authorized admins, read automatically on our own server to help fill in your details, and deleted after the retention period under RA 10173.
          </div>

          {/* Consent checkbox */}
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3, accentColor: '#f59e0b', transform: 'scale(1.35)', transformOrigin: 'top left' }} />
            <span style={{ fontSize: '0.85rem' }}>I consent to the collection and processing of my ID for age and identity verification under the Data Privacy Act (RA 10173).</span>
          </label>

          {/* Scan status (three states) */}
          {(ocrScanning || (ocrHints && ocrHints.length > 0) || ocrError) && (
            <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 10, padding: '1rem', borderLeft: '4px solid ' + (ocrScanning ? 'var(--color-border)' : ocrError ? '#f59e0b' : '#22c55e') }}>
              {ocrScanning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ width: 16, height: 16, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-red-primary)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /><p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>Scanning your ID...</p></div>
              )}
              {ocrError && !ocrScanning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#f59e0b', fontWeight: 700 }}>⚠</span><p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>We couldn't scan it now, you can still continue.</p></div>
              )}
              {!ocrScanning && ocrHints && ocrHints.length > 0 && (
                <>
                  {ocrHints.map((hint, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: hint.status === 'pass' ? '#22c55e' : hint.status === 'warn' ? '#f59e0b' : '#ef4444' }}>
                        {hint.status === 'pass' ? '✓' : hint.status === 'warn' ? '⚠' : '✗'}
                      </span>
                      <span>{hint.message}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

            </>
          )}

          {wizardStep === 4 && (
            <>
              <div className="g g-2">
                <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 10, padding: '1rem' }}>
                  <h3 style={{ marginBottom: '0.5rem' }}>Your details</h3>
                  <p style={{ margin: '0.25rem 0' }}><strong>Name:</strong> {form.first_name} {form.last_name}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Email:</strong> {form.email}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Phone:</strong> {form.phone_number || 'Not provided'}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>DOB:</strong> {form.date_of_birth} (age {calculateAge(form.date_of_birth)})</p>
                </div>
                <div style={{ background: 'var(--color-bg-elevated)', borderRadius: 10, padding: '1rem' }}>
                  <h3 style={{ marginBottom: '0.5rem' }}>Your ID</h3>
                  <p style={{ margin: '0.25rem 0' }}><strong>Type:</strong> {idType}</p>
                  <p style={{ margin: '0.25rem 0' }}><strong>Number:</strong> {idNumber ? '••••' + idNumber.slice(-4) : 'not provided'}</p>
                  {frontPreview && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <img src={frontPreview} alt="ID front" style={{ maxWidth: '120px', borderRadius: 8 }} />
                    </div>
                  )}
                </div>
              </div>
              <label className="checkbox" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ transform: 'scale(1.25)', transformOrigin: 'top left' }} />
                I confirm I am 18+ and the ID provided is mine.
              </label>
              <label className="checkbox" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input type="checkbox" checked={privacyConsent} onChange={(e) => setPrivacyConsent(e.target.checked)} style={{ transform: 'scale(1.25)', transformOrigin: 'top left' }} />
                I consent to the collection and processing of my ID for age and identity verification under the Data Privacy Act (RA 10173).
              </label>
            </>
          )}

          {uploadProgress > 0 && submitting && (
            <p style={{ fontSize: '0.8rem' }}>Uploading... {uploadProgress}%</p>
          )}



          {error && <p className="error-text">{error}</p>}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', position: 'sticky', bottom: 0, background: 'var(--color-bg-card, var(--color-bg))', padding: '0.75rem 0', zIndex: 10 }}>
            {wizardStep > 1 && (
              <button type="button" className="btn btn-outline" onClick={goBack} style={{ flex: '0 0 auto', minWidth: 80 }}>Back</button>
            )}
            {wizardStep < 4 && (
              <button type="button" className="btn btn-red" style={{ flex: 1 }} onClick={goNext} disabled={wizardStep===1?!step1Valid:wizardStep===2?!step2Valid:!step3Valid}>Next</button>
            )}
          </div>

          {wizardStep === 4 && (
            <button
              className="btn btn-red w-full"
              type="submit"
              disabled={!canSubmit}
              style={{ opacity: canSubmit ? 1 : 0.45, cursor: canSubmit ? 'pointer' : 'not-allowed', transition: 'opacity 0.2s' }}
            >
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>
          )}

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
