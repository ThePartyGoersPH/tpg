import { useState, useEffect, useRef } from 'react';
import '../styles/register-wizard.css';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { useAuth } from '../hooks/useAuth';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import apiClient from '../api/client';
import { validatePasswordStrength, STRENGTH_COLORS } from '../utils/passwordPolicy';
import { normalizeCustomerPhone, sanitizePhoneInput, isValidCustomerPhone } from '../utils/phonePolicy';
import { Mail, CheckCircle, Calendar, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { createWorker } from 'tesseract.js';

// Native URL step sync helper (no React Router needed)
function getStepFromUrl() {
  try {
    return parseInt(new URLSearchParams(window.location.search).get('step') || '1', 10);
  } catch {
    return 1;
  }
}

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

  // (popstate listener moved to RegisterView where wizardStep is in scope)

  // Focus first field of each step
  useEffect(() => {
    const timer = setTimeout(() => {
      const firstInput = document.querySelector('.glass-card input, .glass-card select, .glass-card button');
      if (firstInput) firstInput.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [wizardStep]);
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
  const initialStep = getStepFromUrl();
  // Clamp to 1-4 and never ahead of what the user has completed
  const clampedStep = Math.min(4, Math.max(1, initialStep));
  const [wizardStep, setWizardStep] = useState(clampedStep);
  const [submitted, setSubmitted] = useState(false);

  // Sync wizard step with URL ?step= param (browser back/forward)
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
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [nameMatchStatus, setNameMatchStatus] = useState(null); // null | 'matched' | 'mismatch'
  const [dobMatchStatus, setDobMatchStatus] = useState(null); // null | 'matched' | 'mismatch'
  const [ocrError, setOcrError] = useState(null);
  const [idValidationStatus, setIdValidationStatus] = useState(null); // 'valid', 'invalid', null
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
    
    // Run OCR on front image
    if (setFile === setFrontImage) {
      runOcrOnImage(file);
    }
    
    // Validate back image
    if (setFile === setBackImage) {
      validateBackId(file);
    }
  };

  // OCR function to extract text from ID image
  const runOcrOnImage = async (file) => {
    if (!file) return;
    setOcrScanning(true);
    setOcrError(null);
    setOcrResult(null);

    try {
      // Pre-process image: scale up to at least 1500px, convert to high-contrast grayscale
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const imageUrl = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Scale up to at least 1500px width
      const minWidth = 1500;
      const scale = img.width < minWidth ? minWidth / img.width : 1;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      // Draw image in grayscale with increased contrast
      ctx.filter = 'grayscale(100%) contrast(200%) brightness(110%)';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/png');
      
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(dataUrl);
      await worker.terminate();

      URL.revokeObjectURL(imageUrl);

      // Filter out header noise
      const noiseWords = [
        'REPUBLIC', 'PHILIPPINES', 'DRIVER', 'LICENSE', 'PHILIPPINE',
        'LAND', 'TRANSPORTATION', 'OFFICE', 'LTO', 'NATIONAL', 'ID',
        'PASSPORT', 'UMID', 'PRC', 'POSTAL', 'VOTER', 'PHILHEALTH',
        'SSS', 'SENIOR', 'CITIZEN', 'DATE', 'BIRTH', 'EXPIRY', 'EXPIRES'
      ];
      
      // Extract ID number - refined PH License format extraction
      function extractLicenseNumber(rawText) {
        if (!rawText) return "";

        // 1. Direct Regex Match for PH formats (e.g., N01-12-345678, DJE-10-001223, A01-19-123456)
        const exactRegex = /[A-Z0-9]{3}[\s\-\:\.\_]*[A-Z0-9]{2}[\s\-\:\.\_]*[0-9]{6}/i;
        const matchExact = rawText.match(exactRegex);
        if (matchExact) {
          // Clean up misread separators to produce standard format AAA-00-000000
          const rawMatch = matchExact[0].replace(/[^A-Z0-9]/gi, '');
          if (rawMatch.length === 11) {
            return `${rawMatch.slice(0, 3)}-${rawMatch.slice(3, 5)}-${rawMatch.slice(5)}`.toUpperCase();
          }
          return matchExact[0].toUpperCase();
        }

        // 2. Keyword Context Search: look for text following "License No", "License", "Agency Code"
        const lines = rawText.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (/license|agency\s*code|dl\s*no/i.test(line)) {
            // Find candidate alphanumeric words with 8 to 14 characters nearby
            const tokens = line.split(/\s+/);
            for (const token of tokens) {
              const cleanedToken = token.replace(/[^A-Z0-9]/gi, '');
              if (cleanedToken.length >= 9 && cleanedToken.length <= 12 && /\d/.test(cleanedToken)) {
                return token.toUpperCase();
              }
            }
          }
        }

        // 3. Fallback: Search the entire raw string for any token that looks like an ID code
        const tokens = rawText.replace(/[\n\r]/g, ' ').split(' ');
        for (const token of tokens) {
          const clean = token.replace(/[^A-Z0-9]/gi, '');
          if (clean.length === 11 && /[A-Z]/.test(clean) && /\d/.test(clean)) {
            return `${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5)}`.toUpperCase();
          }
        }

        return "";
      }

      const extractedIdNumber = extractLicenseNumber(text);

      // Extract date of birth (common formats)
      const dobMatch = text.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})|(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/);
      const extractedDob = dobMatch ? dobMatch[0] : null;

      // Extract name (look for capitalized words, filter out noise)
      const nameMatch = text.match(/[A-Z][a-z]+ [A-Z][a-z]+/);
      let extractedName = nameMatch ? nameMatch[0] : null;
      
      if (extractedName) {
        const nameParts = extractedName.split(' ');
        const filteredParts = nameParts.filter(part => 
          !noiseWords.some(noise => part.toUpperCase().includes(noise))
        );
        extractedName = filteredParts.length >= 2 ? filteredParts.join(' ') : null;
      }

      const result = {
        text: text.trim(),
        idNumber: extractedIdNumber,
        dob: extractedDob,
        name: extractedName,
      };

      setOcrResult(result);

      // ─── OCR DATA VERIFICATION ───
      // 1. Name Matching: check if entered first/last name appear in OCR text
      const enteredFirst = (form.first_name || '').trim().toUpperCase();
      const enteredLast = (form.last_name || '').trim().toUpperCase();
      const ocrUpper = text.toUpperCase();
      const nameMatched = enteredFirst && enteredLast &&
        ocrUpper.includes(enteredFirst) && ocrUpper.includes(enteredLast);
      setNameMatchStatus(nameMatched ? 'matched' : 'mismatch');

      // 2. DOB & Age Cross-Verification
      // Extract DOB from OCR text (formats: YYYY/MM/DD, YYYY-MM-DD, etc.)
      const dobRegex = /(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/;
      const idDobMatch = text.match(dobRegex);
      let idDob = null;
      if (idDobMatch) {
        const [, y, m, d] = idDobMatch;
        idDob = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      // Calculate age from ID DOB
      let idAge = null;
      if (idDob) {
        const birthDate = new Date(idDob + 'T00:00:00.000Z');
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const mDiff = today.getMonth() - birthDate.getMonth();
        if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        idAge = age;
      }
      // Compare ID DOB with entered DOB
      const enteredDob = form.date_of_birth;
      const dobMatched = idDob && enteredDob && idDob === enteredDob && idAge !== null && idAge >= 18;
      setDobMatchStatus(dobMatched ? 'matched' : 'mismatch');

      // Front ID validation - check for front-side keywords
      const frontKeywords = ['REPUBLIC', 'PHILIPPINES', 'DRIVER', 'LICENSE', 'NAME', 'DATE OF BIRTH', 'BIRTHDATE'];
      const upperText = text.toUpperCase();
      const hasFrontKeywords = frontKeywords.some(keyword => upperText.includes(keyword));
      
      if (!hasFrontKeywords) {
        setOcrError('Invalid Front ID. Please upload a clear photo of the front side of your ID.');
        setIdValidationStatus('invalid');
        // Reject the image
        setFrontImage(null);
        setFrontPreview(null);
        return;
      }
      
      setIdValidationStatus('valid');

      // Auto-fill ID number if found and field is empty
      if (extractedIdNumber && !idNumber) {
        setIdNumber(extractedIdNumber);
      }

      // Auto-fill name if found and fields are empty
      if (extractedName) {
        const nameParts = extractedName.split(' ');
        if (nameParts.length >= 2 && !form.first_name) {
          onChange('first_name', nameParts[0]);
        }
        if (nameParts.length >= 2 && !form.last_name) {
          onChange('last_name', nameParts.slice(1).join(' '));
        }
      }

      // Auto-fill DOB if found and field is empty
      if (extractedDob && !form.date_of_birth) {
        const date = new Date(extractedDob);
        if (!isNaN(date)) {
          onChange('date_of_birth', date.toISOString().split('T')[0]);
        }
      }
    } catch (error) {
      console.error('OCR Error:', error);
      setOcrError('Failed to scan ID. Please enter details manually.');
    } finally {
      setOcrScanning(false);
    }
  };

  const validateBackId = async (file) => {
    const backKeywords = ['restriction', 'condition', 'agency', 'code', 'blood', 'weight', 'height', 'signature', 'organ', 'donor', 'land transportation', 'lto', 'republic', 'philippines', 'serial', 'address'];
    
    try {
      const worker = await createWorker('eng');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      
      const upperText = text.toUpperCase();
      const hasBackKeywords = backKeywords.some(keyword => upperText.includes(keyword.toUpperCase()));
      
      // Fallback: check if text contains digits and has length > 10
      const hasSufficientText = text.trim().length > 10;
      const hasDigits = /\d/.test(text);
      
      // Relaxed validation: if image is present and exceeds minimum size, consider valid
      // Only reject if completely blank/unreadable/missing
      if (!hasBackKeywords && !hasSufficientText && !hasDigits) {
        setError('Invalid Back ID. Please upload a clear photo of the back side of your ID.');
        setBackImage(null);
        setBackPreview(null);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Back ID validation error:', error);
      // Relaxed fallback: if OCR fails but file exists and has reasonable size, allow it
      if (file && file.size > 1000) {
        return true;
      }
      setError('Failed to validate back ID. Please try again.');
      setBackImage(null);
      setBackPreview(null);
      return false;
    }
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

  // Auto-validate 18+ checkbox if age >= 18
  useEffect(() => {
    if (age >= 18) {
      setAgeConfirmed(true);
    } else {
      setAgeConfirmed(false);
    }
  }, [age]);
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
    privacyConsent &&
    nameMatchStatus === 'matched' &&
    dobMatchStatus === 'matched';

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
  const step3Valid = !!idType && !!frontImage && (!needsBack || !!backImage) && !!selfieImage && nameMatchStatus === 'matched' && dobMatchStatus === 'matched';
  const step4Valid = consent && privacyConsent;

  const goNext = () => {
    setSubmitAttempted(true);
    if (wizardStep === 1 && !step1Valid) return;
    if (wizardStep === 2 && !step2Valid) return;
    if (wizardStep === 3 && !step3Valid) return;
    const next = Math.min(4, wizardStep + 1);
    setWizardStep(next);
    const nextUrl = new URL(window.location);
    nextUrl.searchParams.set('step', String(next));
    history.replaceState(null, '', nextUrl);
  };
  const goBack = () => {
    const prev = Math.max(1, wizardStep - 1);
    setWizardStep(prev);
    const prevUrl = new URL(window.location);
    prevUrl.searchParams.set('step', String(prev));
    history.replaceState(null, '', prevUrl);
  };

  // Aliases for Step 4 button handlers
  const handleBack = goBack;
  const isConsentChecked = consent;
  const isAgeConfirmed = ageConfirmed;

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
    <div className="auth-view bg-zinc-950">
      <form className="glass-card auth-card register-card bg-[#1A1A1D] border border-[#2D2D30]" onSubmit={handleSubmit} autoComplete="off" onKeyDown={(e) => {
        if (e.key === 'Enter' && wizardStep < 4 && e.target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          goNext();
        }
      }}>
        <div className="glass-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 3.2vw, 40px)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px', textAlign: 'left' }}>Create your account</h1>
          <p style={{ textAlign: 'left', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>Complete all 4 steps to register.</p>

          {/* Stepper */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            {/* Continuous horizontal line behind circles */}
            <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', height: '2px', background: '#E8E4DF', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: '16px', left: '16px', height: '2px', background: '#C07C42', width: `calc(${(wizardStep - 1) / 3} * (100% - 32px))`, transition: 'width 0.3s ease', zIndex: 0 }} />

            {['Account', 'Age', 'Identity', 'Review'].map((label, i) => {
              const step = i + 1;
              const done = wizardStep > step;
              const current = wizardStep === step;
              return (
                <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: '0.85rem',
                    background: current ? '#C07C42' : (done ? '#C07C42' : '#fff'),
                    color: current || done ? '#fff' : '#8A827A',
                    border: done ? '2px solid #E8E4DF' : current ? 'none' : '2px solid #E8E4DF',
                    transition: 'all 0.2s ease',
                  }}>
                    {done ? '✓' : step}
                  </div>
                  <span style={{ fontSize: '0.875rem', color: current || done ? '#C07C42' : '#8A827A', fontWeight: current || done ? 700 : 400, whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: '0.875rem', color: '#8A827A', marginTop: '12px', textAlign: 'left' }}>Step {wizardStep} of 4</p>

          {wizardStep === 1 && (
            <>
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

            </>
          )}

          {/* Birthday */}
          {wizardStep === 2 && (
            <>
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
            {form.date_of_birth && (
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Calculated Age: {age} years old</p>
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

            </>
          )}

          {/* ID verification section */}
          {wizardStep === 3 && (
            <>
          <div style={{ marginTop: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Verify your age and identity</h3>
            <select className="glass-input" value={idType} onChange={e => setIdType(e.target.value)} onBlur={() => markTouched('id_type')} required>
              <option value="">Select ID type</option>
              {ID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="glass-input" placeholder="ID number (optional)" value={idNumber} onChange={e => setIdNumber(e.target.value)} style={{ marginTop: '0.5rem' }} />
            
            {/* Upload dropzones */}
            <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
              {/* ID Front Photo */}
              <div
                onClick={() => frontRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); handleImage(e.dataTransfer.files[0], setFrontImage, setFrontPreview); }}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  border: '2px dashed #6b7280',
                  borderRadius: '8px',
                  padding: '1rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(31, 41, 55, 0.5)',
                  transition: 'border-color 0.2s, background 0.2s'
                }}
                className="upload-dropzone"
              >
                <input ref={frontRef} type="file" accept="image/*" onChange={(e) => handleImage(e.target.files[0], setFrontImage, setFrontPreview)} style={{ display: 'none' }} />
                {frontPreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <img src={frontPreview} alt="ID front preview" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', objectFit: 'cover' }} />
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); frontRef.current?.click(); }} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 500, color: '#d1d5db', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        Change photo
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setFrontImage(null); setFrontPreview(null); }} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 500, color: '#f87171', backgroundColor: 'rgba(69, 10, 10, 0.4)', border: '1px solid rgba(127, 29, 29, 0.5)', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#9ca3af' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>Click or drag & drop to upload ID Front Photo</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>JPG, PNG or WEBP, max 5 MB</p>
                  </div>
                )}
              </div>

              {/* OCR Scanning Status */}
              {ocrScanning && (
                <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.875rem', color: '#3b82f6' }}>Scanning ID with OCR...</span>
                </div>
              )}
              {ocrError && (
                <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>{ocrError}</span>
                </div>
              )}
              {nameMatchStatus === 'mismatch' && (
                <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>Name mismatch: The name on the ID photo does not match the account details entered.</span>
                </div>
              )}
              {dobMatchStatus === 'mismatch' && (
                <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>Age verification failed: You must be 18+ and the Date of Birth must match your ID.</span>
                </div>
              )}
              {ocrResult && idValidationStatus === 'valid' && (
                <div style={{ padding: '0.75rem', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.875rem', color: '#22c55e', fontWeight: 500 }}>✓ Scan Completed Successfully</span>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: '#22c55e' }}>
                      Extracted License No: {ocrResult.idNumber || 'Processing/Manual Check Required'}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: nameMatchStatus === 'matched' ? '#22c55e' : '#ef4444' }}>
                      {nameMatchStatus === 'matched' ? '✓ Name Match: Verified' : '✗ Name mismatch: The name on the ID photo does not match the account details entered.'}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: dobMatchStatus === 'matched' ? '#22c55e' : '#ef4444' }}>
                      {dobMatchStatus === 'matched' ? `✓ DOB & Age Match: Verified` : '✗ Age verification failed: You must be 18+ and the Date of Birth must match your ID.'}
                    </span>
                  </div>
                </div>
              )}

              {/* ID Back Photo (conditional) */}
              {needsBack ? (
                <div
                  onClick={() => backRef.current?.click()}
                  onDrop={(e) => { e.preventDefault(); handleImage(e.dataTransfer.files[0], setBackImage, setBackPreview); }}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    border: '2px dashed #6b7280',
                    borderRadius: '8px',
                    padding: '1rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(31, 41, 55, 0.5)',
                    transition: 'border-color 0.2s, background 0.2s'
                  }}
                  className="upload-dropzone"
                >
                  <input ref={backRef} type="file" accept="image/*" onChange={(e) => handleImage(e.target.files[0], setBackImage, setBackPreview)} style={{ display: 'none' }} />
                  {backPreview ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <img src={backPreview} alt="ID back preview" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', objectFit: 'cover' }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button type="button" onClick={(e) => { e.stopPropagation(); backRef.current?.click(); }} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 500, color: '#d1d5db', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                          Change photo
                        </button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setBackImage(null); setBackPreview(null); }} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 500, color: '#f87171', backgroundColor: 'rgba(69, 10, 10, 0.4)', border: '1px solid rgba(127, 29, 29, 0.5)', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#9ca3af' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>Click or drag & drop to upload ID Back Photo</p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>JPG, PNG or WEBP, max 5 MB</p>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: '0.75rem', opacity: 0.5, fontSize: '0.85rem' }}>
                  <em>ID back photo not needed for this ID type.</em>
                </div>
              )}

              {/* Selfie holding ID */}
              <div
                onClick={() => selfieRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); handleImage(e.dataTransfer.files[0], setSelfieImage, setSelfiePreview); }}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  border: '2px dashed #6b7280',
                  borderRadius: '8px',
                  padding: '1rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: 'rgba(31, 41, 55, 0.5)',
                  transition: 'border-color 0.2s, background 0.2s'
                }}
                className="upload-dropzone"
              >
                <input ref={selfieRef} type="file" accept="image/*" onChange={(e) => handleImage(e.target.files[0], setSelfieImage, setSelfiePreview)} style={{ display: 'none' }} />
                {selfiePreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <img src={selfiePreview} alt="Selfie preview" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '8px', objectFit: 'cover' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button type="button" onClick={(e) => { e.stopPropagation(); selfieRef.current?.click(); }} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 500, color: '#d1d5db', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        Change photo
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setSelfieImage(null); setSelfiePreview(null); }} style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', fontWeight: 500, color: '#f87171', backgroundColor: 'rgba(69, 10, 10, 0.4)', border: '1px solid rgba(127, 29, 29, 0.5)', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#9ca3af' }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>Click or drag & drop to upload Selfie holding ID</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>JPG, PNG or WEBP, max 5 MB</p>
                  </div>
                )}
              </div>
            </div>

            <div className="tips" style={{ marginTop: '0.5rem' }}>
              <p><strong>Tips:</strong> All 4 corners visible, text readable, not expired, no glare, no screenshots.</p>
            </div>
          </div>

            </>
          )}

          {wizardStep === 4 && (
            <>
              <div className="bg-zinc-900/80 border border-zinc-800/80" style={{ borderRadius: 10, padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 600 }}>Review</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', minWidth: '120px' }}>Name</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{form.first_name} {form.last_name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', minWidth: '120px' }}>Email</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{form.email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', minWidth: '120px' }}>Phone</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{form.phone_number || 'Not provided'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', minWidth: '120px' }}>Date of Birth</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{form.date_of_birth} (age {calculateAge(form.date_of_birth)})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', minWidth: '120px' }}>ID Type</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{idType}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', minWidth: '120px' }}>ID Number</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                      {idNumber ? '••••' + idNumber.slice(-4) : (frontImage ? 'ID Front: Uploaded' : 'Not provided')}
                    </span>
                  </div>
                </div>
                {/* Photo previews */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                  {frontPreview && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>ID Front Photo</span>
                      <img src={frontPreview} alt="ID Front" style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--color-border)' }} />
                    </div>
                  )}
                  {selfiePreview && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Selfie holding ID</span>
                      <img src={selfiePreview} alt="Selfie" style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--color-border)' }} />
                    </div>
                  )}
                </div>
              </div>
              <label className="checkbox" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                I confirm I am 18+ and the ID provided is mine.
              </label>
              <label className="checkbox" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input type="checkbox" checked={privacyConsent} onChange={(e) => setPrivacyConsent(e.target.checked)} />
                I consent to the collection and processing of my ID for age and identity verification under the Data Privacy Act (RA 10173).
              </label>
            </>
          )}

          {uploadProgress > 0 && submitting && (
            <p style={{ fontSize: '0.8rem' }}>Uploading... {uploadProgress}%</p>
          )}



          {error && <p className="error-text">{error}</p>}

          {wizardStep < 4 && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', position: 'sticky', bottom: 0, background: 'var(--color-bg-card, var(--color-bg))', padding: '0.75rem 0', zIndex: 10 }}>
              {wizardStep > 1 && (
                <button type="button" onClick={goBack} style={{ flex: '0 0 auto', minWidth: 80, padding: '0.75rem 1rem', border: '1px solid #6b7280', borderRadius: '8px', background: 'transparent', color: '#d1d5db', cursor: 'pointer', transition: 'all 0.2s' }}>Back</button>
              )}
              <button type="button" className="btn btn-red" style={{ flex: 1 }} onClick={goNext} disabled={wizardStep===1?!step1Valid:wizardStep===2?!step2Valid:!step3Valid}>Next</button>
            </div>
          )}

          {wizardStep === 4 && (
            <div className="flex items-center justify-between gap-4 mt-8 w-full">
              <button
                type="button"
                onClick={handleBack}
                style={{
                  backgroundColor: 'rgba(17, 24, 39, 0.8)',
                  color: '#e5e7eb',
                  border: '1px solid #374151',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  width: '30%',
                  transition: 'all 0.2s'
                }}
                className="hover:bg-gray-800 hover:text-white"
              >
                Back
              </button>
              
              <button
                type="submit"
                disabled={!isConsentChecked || !isAgeConfirmed}
                style={{
                  background: (!isConsentChecked || !isAgeConfirmed)
                    ? '#4b5563'
                    : 'linear-gradient(to right, #dc2626, #d97706)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: (!isConsentChecked || !isAgeConfirmed) ? 'not-allowed' : 'pointer',
                  opacity: (!isConsentChecked || !isAgeConfirmed) ? 0.5 : 1,
                  width: '65%',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: '0.1rem 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>OR SIGN UP WITH</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {googleError && <p className="error-text">{googleError}</p>}
          {googleNotice && <p style={{ fontSize: '0.82rem', color: '#22c55e' }}>{googleNotice}</p>}
          <div className="flex flex-col items-center justify-center gap-3 my-4">
            <GoogleAuthButton
              onSuccess={handleGoogleSuccess}
              onError={(msg) => setGoogleError(msg)}
            />
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
