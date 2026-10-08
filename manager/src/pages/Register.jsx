import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Upload, X, FileText, CheckCircle, Shield } from 'lucide-react';
import FileDropZone from '../components/FileDropZone';
import OCRDocumentScanner from '../components/OCRDocumentScanner';
import useAuthStore from '../stores/authStore';
import { authApi } from '../api/authApi';
import logoImg from '../../logo.png';
import { CAVITE_CITIES, getBarangaysForCity } from '../utils/caviteLocations';

const NAME_REGEX = /^[A-Za-z][A-Za-z .'-]*$/;
const PHONE_REGEX = /^09\d{9}$/;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const STEPS = ['Owner Account', 'Bar Details', 'Documents', 'Confirm'];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const BAR_TYPE_OPTIONS = ['Bar', 'Restobar', 'Cocktail Bar', 'KTV Lounge', 'Live Music', 'Comedy Bar', 'Beer Garden'];

const TIMES = (() => {
  const list = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hour = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      list.push(`${hour}:${m === 0 ? '00' : '30'} ${ampm}`);
    }
  }
  return list;
})();

// Helper function to convert 12-hour time to minutes for comparison
const convertTo24Hour = (time12h) => {
  if (!time12h) return 0;
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours !== 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Best-effort normalizer for OCR-extracted dates ("07/29/28", "07/29/2028",
// "2028-07-29", "29-07-2028" → "2028-07-29"). Never throws and never blocks:
// unrecognized input passes through unchanged.
const normalizeExtractedDate = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = `${Number(y) >= 70 ? '19' : '20'}${y}`;
    const mm = String(a).padStart(2, '0');
    const dd = String(b).padStart(2, '0');
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${y}-${mm}-${dd}`;
    }
    return s;
  }
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const [, dd, mm, y] = m;
    if (Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31) {
      return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  return s;
};

// ─── Reusable dark input ───
const DarkInput = ({ label, error, ...props }) => (
  <div>
    <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}>
      {label}
    </label>
    <input
      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all duration-200"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${error ? 'rgba(204,0,0,0.5)' : 'rgba(255,255,255,0.08)'}`, fontFamily: "'DM Sans', Inter, sans-serif" }}
      onFocus={(e) => { e.target.style.borderColor = 'rgba(204,0,0,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)'; }}
      onBlur={(e) => { e.target.style.borderColor = error ? 'rgba(204,0,0,0.5)' : 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
      {...props}
    />
    {error && <p className="mt-1 text-xs" style={{ color: '#ff6666', fontFamily: "'DM Sans', Inter, sans-serif" }}>{error}</p>}
  </div>
);

const DarkSelect = ({ label, error, children, ...props }) => (
  <div>
    {label && (
      <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}>
        {label}
      </label>
    )}
    <select
      className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all duration-200"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${error ? 'rgba(204,0,0,0.5)' : 'rgba(255,255,255,0.08)'}`, fontFamily: "'DM Sans', Inter, sans-serif'", colorScheme: 'dark' }}
      onFocus={(e) => { e.target.style.borderColor = 'rgba(204,0,0,0.5)'; }}
      onBlur={(e) => { e.target.style.borderColor = error ? 'rgba(204,0,0,0.5)' : 'rgba(255,255,255,0.08)'; }}
      {...props}
    >
      {children}
    </select>
    {error && <p className="mt-1 text-xs" style={{ color: '#ff6666', fontFamily: "'DM Sans', Inter, sans-serif" }}>{error}</p>}
  </div>
);

const DarkTextarea = ({ label, error, ...props }) => (
  <div>
    <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}>
      {label}
    </label>
    <textarea
      rows={3}
      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all duration-200 resize-none"
      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${error ? 'rgba(204,0,0,0.5)' : 'rgba(255,255,255,0.08)'}`, fontFamily: "'DM Sans', Inter, sans-serif" }}
      onFocus={(e) => { e.target.style.borderColor = 'rgba(204,0,0,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)'; }}
      onBlur={(e) => { e.target.style.borderColor = error ? 'rgba(204,0,0,0.5)' : 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
      {...props}
    />
    {error && <p className="mt-1 text-xs" style={{ color: '#ff6666', fontFamily: "'DM Sans', Inter, sans-serif" }}>{error}</p>}
  </div>
);

// ─── Step indicator ───
const StepIndicator = ({ current }) => (
  <div className="flex items-center justify-center gap-0 mb-8">
    {STEPS.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <React.Fragment key={label}>
          <div className="flex flex-col items-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
              style={{
                background: done ? '#CC0000' : active ? 'rgba(204,0,0,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${done || active ? '#CC0000' : 'rgba(255,255,255,0.1)'}`,
                color: done || active ? '#fff' : '#555',
                fontFamily: "'DM Sans', Inter, sans-serif",
              }}
            >
              {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap"
              style={{ color: active ? '#CC0000' : done ? '#888' : '#444', fontFamily: "'DM Sans', Inter, sans-serif" }}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="h-[1.5px] w-12 sm:w-20 mx-2 mb-5 transition-all duration-300"
              style={{ background: i < current ? '#CC0000' : 'rgba(255,255,255,0.08)' }}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Main component ───
const Register = () => {
  const { isAuthenticated } = useAuthStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // Step 1
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailDuplicate, setEmailDuplicate] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Step 2
  const [barName, setBarName] = useState('');
  const [barAddress, setBarAddress] = useState('');
  const [barCity, setBarCity] = useState('');
  const [barBarangay, setBarBarangay] = useState('');
  const [barDesc, setBarDesc] = useState('');
  const [barTypes, setBarTypes] = useState([]);
  const [gcashNumber, setGcashNumber] = useState('');
  const [gcashName, setGcashName] = useState('');
  const [barContactNumber, setBarContactNumber] = useState('');
  const [operatingHours, setOperatingHours] = useState([{ day: 'Monday', open: '', close: '' }]);

  // Step 3
  const [birFile, setBirFile] = useState(null);
  const [permitFile, setPermitFile] = useState(null);
  const [mayorsPermitFile, setMayorsPermitFile] = useState(null);
  const [sanitaryPermitFile, setSanitaryPermitFile] = useState(null);
  const [fireSafetyFile, setFireSafetyFile] = useState(null);
  const [liquorLicenseFile, setLiquorLicenseFile] = useState(null);
  const [selfieWithIdFile, setSelfieWithIdFile] = useState(null);
  const [dtiSecFile, setDtiSecFile] = useState(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // OCR extracted data
  const [birNumber, setBirNumber] = useState('');
  const [birExpiry, setBirExpiry] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [permitExpiry, setPermitExpiry] = useState('');

  // Field errors
  const [errors, setErrors] = useState({});

  // Email duplicate check with debounce
  const emailCheckTimer = useRef(null);
  useEffect(() => {
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailDuplicate('');
      return;
    }
    setEmailChecking(true);
    emailCheckTimer.current = setTimeout(async () => {
      try {
        const res = await authApi.checkEmail({ email: email.trim().toLowerCase() });
        if (res.data?.exists) {
          setEmailDuplicate('This email is already registered');
        } else {
          setEmailDuplicate('');
        }
      } catch {
        setEmailDuplicate("Couldn't verify email right now — please try again");
      } finally {
        setEmailChecking(false);
      }
    }, 500);
    return () => { if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current); };
  }, [email]);

  // Safety: clear firstName error when value becomes valid
  useEffect(() => {
    if (firstName.trim() && NAME_REGEX.test(firstName.trim()) && firstName.trim().length >= 2 && firstName.trim().length <= 50) {
      setErrors((prev) => ({ ...prev, firstName: '' }));
    }
  }, [firstName]);

  // Password strength
  useEffect(() => {
    let s = 0;
    if (password.length >= 8) s += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s += 1;
    if (/\d/.test(password)) s += 1;
    if (/[^A-Za-z0-9]/.test(password)) s += 1;
    setPasswordStrength(s);
  }, [password]);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const validateStep1 = () => {
    const e = {};
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn) e.firstName = 'First name is required';
    else if (fn.length < 2 || fn.length > 50) e.firstName = 'Must be 2–50 characters';
    else if (!NAME_REGEX.test(fn)) e.firstName = 'Letters, spaces and hyphens only';

    if (middleName.trim() && !NAME_REGEX.test(middleName.trim())) {
      e.middleName = 'Letters, spaces and hyphens only';
    }

    if (!ln) e.lastName = 'Last name is required';
    else if (ln.length < 2 || ln.length > 50) e.lastName = 'Must be 2–50 characters';
    else if (!NAME_REGEX.test(ln)) e.lastName = 'Letters, spaces and hyphens only';

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      e.email = 'Valid email is required';
    } else if (emailDuplicate) {
      e.email = emailDuplicate;
    }

    if (!phone.trim() || !PHONE_REGEX.test(phone.trim())) {
      e.phone = 'Phone must be 11 digits starting with 09';
    }

    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Min. 6 characters';
    if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    else if (!confirmPassword) e.confirmPassword = 'Please confirm your password';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateField = (name, value) => {
    switch (name) {
      case 'firstName': {
        const v = value.trim();
        if (!v) return 'First name is required';
        if (v.length < 2 || v.length > 50) return 'Must be 2–50 characters';
        if (!NAME_REGEX.test(v)) return 'Letters, spaces and hyphens only';
        return '';
      }
      case 'middleName': {
        if (!value.trim()) return '';
        return NAME_REGEX.test(value.trim()) ? '' : 'Letters, spaces and hyphens only';
      }
      case 'lastName': {
        const v = value.trim();
        if (!v) return 'Last name is required';
        if (v.length < 2 || v.length > 50) return 'Must be 2–50 characters';
        if (!NAME_REGEX.test(v)) return 'Letters, spaces and hyphens only';
        return '';
      }
      case 'email': {
        if (!value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Valid email is required';
        return emailDuplicate ? emailDuplicate : '';
      }
      case 'phone': {
        if (!value.trim() || !PHONE_REGEX.test(value.trim())) return 'Phone must be 11 digits starting with 09';
        return '';
      }
      case 'password': {
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Min. 6 characters';
        return '';
      }
      case 'confirmPassword': {
        if (!value) return 'Please confirm your password';
        if (password !== value) return 'Passwords do not match';
        return '';
      }
      default: return '';
    }
  };

  const handleFieldBlur = (name, value) => {
    const err = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleFieldChange = (name, value, setter) => {
    setter(value);
    const err = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const validateStep2 = () => {
    const e = {};
    const bn = barName.trim();
    if (!bn) e.barName = 'Bar name is required';
    else if (bn.length < 2 || bn.length > 100) e.barName = 'Must be 2–100 characters';
    if (!barAddress.trim()) e.barAddress = 'Bar address is required';
    else if (barAddress.trim().length < 5) e.barAddress = 'Enter a full address';
    if (!barCity) e.barCity = 'City is required';
    if (!barBarangay) e.barBarangay = 'Barangay is required';
    if (!barDesc.trim()) e.barDesc = 'Bar description is required';
    else if (barDesc.trim().length < 10) e.barDesc = 'Min. 10 characters';
    if (barTypes.length === 0) e.barTypes = 'Select at least one bar type';

    if (!gcashNumber.trim()) e.gcashNumber = 'GCash number is required for payouts';
    else if (!/^\d+$/.test(gcashNumber.trim())) e.gcashNumber = 'GCash number must contain only numbers';
    else if (!/^09\d{9}$/.test(gcashNumber.trim())) e.gcashNumber = 'Must be a valid 09XXXXXXXXX number';

    if (!gcashName.trim()) e.gcashName = 'GCash account name is required';

    if (!barContactNumber.trim() || !PHONE_REGEX.test(barContactNumber.trim())) {
      e.barContactNumber = 'Bar contact must be 11 digits starting with 09';
    }

    const validHours = operatingHours.filter(h => h.day && h.open && h.close);
    if (validHours.length === 0) e.operatingHours = 'Add at least one operating day with open and close times';
    const daysUsed = new Set();
    validHours.forEach((h, idx) => {
      if (daysUsed.has(h.day)) {
        e.operatingHours = `Duplicate day: ${h.day}`;
      }
      daysUsed.add(h.day);
      const openTime = convertTo24Hour(h.open);
      const closeTime = convertTo24Hour(h.close);
      if (closeTime === openTime) {
        e.operatingHours = `${h.day}: Opening and closing times cannot be the same`;
      }
      // Overnight schedules (e.g. 7:00 PM → 5:00 AM, where close is
      // chronologically before open) are valid for nightlife venues —
      // the close simply falls on the next calendar day.
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => {
    const e = {};
    // NOTE: dtiSecFile is intentionally OPTIONAL (label says so, and the
    // backend required-permits list excludes it) — never block on it here.
    if (!birFile) e.birFile = 'BIR Certificate is required';
    if (!permitFile) e.permitFile = 'Business Permit is required';
    if (!mayorsPermitFile) e.mayorsPermitFile = "Mayor's Permit is required";
    if (!sanitaryPermitFile) e.sanitaryPermitFile = 'Sanitary Permit is required';
    if (!fireSafetyFile) e.fireSafetyFile = 'Fire Safety Inspection Certificate is required';
    if (!liquorLicenseFile) e.liquorLicenseFile = 'Liquor License is required for bars';
    if (!selfieWithIdFile) e.selfieWithIdFile = 'Photo holding your ID is required';
    if (birFile && birFile.size > MAX_FILE_SIZE) e.birFile = 'File must be under 10 MB';
    if (permitFile && permitFile.size > MAX_FILE_SIZE) e.permitFile = 'File must be under 10 MB';
    if (mayorsPermitFile && mayorsPermitFile.size > MAX_FILE_SIZE) e.mayorsPermitFile = 'File must be under 10 MB';
    if (sanitaryPermitFile && sanitaryPermitFile.size > MAX_FILE_SIZE) e.sanitaryPermitFile = 'File must be under 10 MB';
    if (fireSafetyFile && fireSafetyFile.size > MAX_FILE_SIZE) e.fireSafetyFile = 'File must be under 10 MB';
    if (liquorLicenseFile && liquorLicenseFile.size > MAX_FILE_SIZE) e.liquorLicenseFile = 'File must be under 10 MB';
    if (selfieWithIdFile && selfieWithIdFile.size > MAX_FILE_SIZE) e.selfieWithIdFile = 'File must be under 10 MB';
    if (selfieWithIdFile && !/image\/(jpeg|png)/.test(selfieWithIdFile.type)) e.selfieWithIdFile = 'Only JPG and PNG images are allowed';
    setErrors(e);
    const ok = Object.keys(e).length === 0;
    if (!ok) console.debug('[register] Step 3 (Documents) validation failed:', e);
    return ok;
  };

  const handleNext = () => {
    setGlobalError('');
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    if (step === 2 && !validateStep3()) return;
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setGlobalError('');
    setTermsAccepted(false);
    setStep((s) => s - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep3()) {
      console.debug('[register] Submit blocked by Step 3 validation — see errors above.');
      return;
    }
    if (!termsAccepted) { setGlobalError('You must accept the terms to submit'); return; }
    setSubmitting(true);
    setGlobalError('');
    try {
      const fd = new FormData();
      fd.append('first_name', firstName.trim());
      if (middleName.trim()) fd.append('middle_name', middleName.trim());
      fd.append('last_name', lastName.trim());
      fd.append('email', email.trim().toLowerCase());
      fd.append('password', password);
      fd.append('phone_number', phone.trim());
      const hoursStr = operatingHours
        .filter(h => h.day && h.open && h.close)
        .map(h => `${h.day}: ${h.open} – ${h.close}`)
        .join(', ');
      fd.append('bar_name', barName.trim());
      fd.append('bar_address', barAddress.trim());
      fd.append('bar_city', barCity);
      fd.append('bar_barangay', barBarangay);
      fd.append('bar_description', barDesc.trim());
      fd.append('bar_types', JSON.stringify(barTypes));
      fd.append('opening_time', hoursStr);
      fd.append('closing_time', '');
      fd.append('gcash_number', gcashNumber.trim());
      fd.append('gcash_name', gcashName.trim());
      fd.append('bar_contact_number', barContactNumber.trim());
      if (dtiSecFile) fd.append('dti_sec_registration', dtiSecFile);
      fd.append('bir_certificate', birFile);
      fd.append('business_permit', permitFile);
      fd.append('mayors_permit', mayorsPermitFile);
      fd.append('sanitary_permit', sanitaryPermitFile);
      fd.append('fire_safety_certificate', fireSafetyFile);
      fd.append('liquor_license', liquorLicenseFile);
      fd.append('selfie_with_id', selfieWithIdFile);
      // Add permit expiry date if extracted from OCR (normalized to ISO;
      // the normalizer never blocks on unrecognized formats)
      if (permitExpiry) {
        fd.append('permit_expiry_date', normalizeExtractedDate(permitExpiry));
      }

      await authApi.registerBarOwner(fd);
      setSubmitted(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      console.debug('[register] Submit failed:', { message: msg, status: err.response?.status, data: err.response?.data });
      setGlobalError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Success screen ───
  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#0A0A0A', backgroundImage: 'radial-gradient(ellipse at 50% 30%, rgba(204,0,0,0.1) 0%, transparent 60%)' }}
      >
        <div className="w-full max-w-md text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.3)', boxShadow: '0 0 30px rgba(204,0,0,0.15)' }}
          >
            <CheckCircle className="w-10 h-10" style={{ color: '#CC0000' }} />
          </div>
          <h2
            className="text-white mb-4"
            style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '2.2rem', letterSpacing: '0.05em' }}
          >
            YOUR APPLICATION IS UNDER REVIEW
          </h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: '#888', fontFamily: "'DM Sans', Inter, sans-serif" }}>
            Your bar registration has been submitted. Our team will review your documents and contact you once approved. Please check your email for updates.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white text-sm transition-all duration-300"
            style={{ background: '#CC0000', boxShadow: '0 0 25px rgba(204,0,0,0.35)', fontFamily: "'DM Sans', Inter, sans-serif" }}
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{
        background: '#0A0A0A',
        backgroundImage: 'radial-gradient(ellipse at 60% 10%, rgba(204,0,0,0.08) 0%, transparent 60%)',
      }}
    >
      {/* Grain overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '150px',
        }}
      />

      <div className="relative w-full max-w-xl">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img src={logoImg} alt="The Party Goers PH" className="w-16 h-16 object-contain" />
        </div>

        {/* Header */}
        <div className="text-center mb-6">
          <h1
            className="text-white"
            style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '2rem', letterSpacing: '0.05em' }}
          >
            REGISTER YOUR BAR
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem', fontFamily: "'DM Sans', Inter, sans-serif" }}>
            Join the Platform Bar System
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: '#111111',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 0 60px rgba(204,0,0,0.06), 0 30px 60px rgba(0,0,0,0.5)',
          }}
        >
          <StepIndicator current={step} />

          <div
            className="mb-6 text-sm rounded-xl px-4 py-3"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.28)', color: '#fbbf24', fontFamily: "'DM Sans', Inter, sans-serif" }}
          >
            <span className="font-semibold">IMPORTANT:</span> Illegal bars, adult entertainment establishments, and bars without complete business permits are NOT accepted on this platform. Submitting false information will result in rejection.
          </div>

          {globalError && (
            <div
              className="mb-6 text-sm rounded-lg px-4 py-3"
              style={{ background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.3)', color: '#ff6666', fontFamily: "'DM Sans', Inter, sans-serif" }}
            >
              {globalError}
            </div>
          )}

          <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
            {/* ─── STEP 1: Owner Account ─── */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <DarkInput label="First Name *" value={firstName} onChange={(e) => handleFieldChange('firstName', e.target.value, setFirstName)} placeholder="Juan" error={errors.firstName} onBlur={() => handleFieldBlur('firstName', firstName)} />
                  <DarkInput label="Middle Name (Optional)" value={middleName} onChange={(e) => handleFieldChange('middleName', e.target.value, setMiddleName)} placeholder="Santos" error={errors.middleName} onBlur={() => handleFieldBlur('middleName', middleName)} />
                  <DarkInput label="Last Name *" value={lastName} onChange={(e) => handleFieldChange('lastName', e.target.value, setLastName)} placeholder="dela Cruz" error={errors.lastName} onBlur={() => handleFieldBlur('lastName', lastName)} />
                </div>
                <DarkInput label="Email Address *" type="email" value={email} onChange={(e) => handleFieldChange('email', e.target.value, setEmail)} placeholder="you@example.com" error={errors.email} onBlur={() => handleFieldBlur('email', email)} />
                {emailChecking && <p className="mt-1 text-xs" style={{ color: '#fbbf24' }}>Checking availability…</p>}
                {!emailChecking && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !emailDuplicate && <p className="mt-1 text-xs" style={{ color: '#4ade80' }}>✓ Email available</p>}
                {!emailChecking && emailDuplicate && <p className="mt-1 text-xs" style={{ color: emailDuplicate.includes("Couldn't") ? '#fbbf24' : '#ff6666' }}>{emailDuplicate}</p>}
                <DarkInput label="Phone Number *" type="tel" value={phone} onChange={(e) => handleFieldChange('phone', e.target.value, setPhone)} placeholder="09XXXXXXXXX" error={errors.phone} onBlur={() => handleFieldBlur('phone', phone)} />
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}>Password *</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => handleFieldChange('password', e.target.value, setPassword)}
                      placeholder="Min. 6 characters"
                      className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all duration-200"
                      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${errors.password ? 'rgba(204,0,0,0.5)' : 'rgba(255,255,255,0.08)'}`, fontFamily: "'DM Sans', Inter, sans-serif" }}
                      onFocus={(e) => { e.target.style.borderColor = 'rgba(204,0,0,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)'; }}
                      onBlur={(e) => { e.target.style.borderColor = errors.password ? 'rgba(204,0,0,0.5)' : 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; handleFieldBlur('password', password); }}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#555' }}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="flex gap-1 mt-1.5">
                      {[1,2,3,4].map((i) => (
                        <div key={i} className="h-1 flex-1 rounded-full" style={{ background: i <= passwordStrength ? (passwordStrength <= 1 ? '#ff6666' : passwordStrength <= 2 ? '#fbbf24' : '#4ade80') : 'rgba(255,255,255,0.08)' }} />
                      ))}
                    </div>
                  )}
                  {errors.password && <p className="mt-1 text-xs" style={{ color: '#ff6666', fontFamily: "'DM Sans', Inter, sans-serif" }}>{errors.password}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}>Confirm Password *</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => handleFieldChange('confirmPassword', e.target.value, setConfirmPassword)}
                      placeholder="Re-enter password"
                      className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all duration-200"
                      style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${errors.confirmPassword ? 'rgba(204,0,0,0.5)' : 'rgba(255,255,255,0.08)'}`, fontFamily: "'DM Sans', Inter, sans-serif" }}
                      onFocus={(e) => { e.target.style.borderColor = 'rgba(204,0,0,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)'; }}
                      onBlur={(e) => { e.target.style.borderColor = errors.confirmPassword ? 'rgba(204,0,0,0.5)' : 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; handleFieldBlur('confirmPassword', confirmPassword); }}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#555' }}>
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="mt-1 text-xs" style={{ color: '#ff6666', fontFamily: "'DM Sans', Inter, sans-serif" }}>{errors.confirmPassword}</p>}
                </div>
              </div>
            )}

            {/* ─── STEP 2: Bar Details ─── */}
            {step === 1 && (
              <div className="space-y-4">
                <DarkInput label="Bar Name" value={barName} onChange={(e) => setBarName(e.target.value)} placeholder="e.g. Eclipse Bar" error={errors.barName} />
                <DarkInput label="Bar Address" value={barAddress} onChange={(e) => setBarAddress(e.target.value)} placeholder="Street / Building / Unit" error={errors.barAddress} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <DarkSelect
                    label="City"
                    value={barCity}
                    onChange={(e) => {
                      setBarCity(e.target.value);
                      setBarBarangay('');
                      setErrors((prev) => ({ ...prev, barCity: undefined, barBarangay: undefined }));
                    }}
                    error={errors.barCity}
                  >
                    <option value="">Select city...</option>
                    {CAVITE_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </DarkSelect>

                  <DarkSelect
                    label="Barangay"
                    value={barBarangay}
                    onChange={(e) => { setBarBarangay(e.target.value); setErrors((prev) => ({ ...prev, barBarangay: undefined })); }}
                    disabled={!barCity}
                    error={errors.barBarangay}
                  >
                    <option value="">{barCity ? 'Select barangay...' : 'Select city first...'}</option>
                    {getBarangaysForCity(barCity).map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </DarkSelect>
                </div>

                <div className="text-xs px-3 py-2 rounded-xl" style={{ background: 'rgba(204,0,0,0.06)', border: '1px solid rgba(204,0,0,0.12)', color: '#888', fontFamily: "'DM Sans', Inter, sans-serif" }}>
                  Platform available in Cavite only
                </div>

                <DarkTextarea label="Bar Description" value={barDesc} onChange={(e) => setBarDesc(e.target.value)} placeholder="Describe your bar briefly..." error={errors.barDesc} />

                <div className="pt-2">
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}>
                    Bar Type <span style={{ color: '#CC0000' }}>*</span>
                  </label>
                  {errors.barTypes && <p className="text-xs mb-2" style={{ color: '#ff6666' }}>{errors.barTypes}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {BAR_TYPE_OPTIONS.map((opt) => {
                      const checked = barTypes.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm cursor-pointer select-none transition-colors"
                          style={{
                            background: checked ? 'rgba(204,0,0,0.10)' : 'rgba(255,255,255,0.03)',
                            border: checked ? '1px solid rgba(204,0,0,0.35)' : '1px solid rgba(255,255,255,0.06)',
                            color: checked ? '#fff' : '#bbb',
                            fontFamily: "'DM Sans', Inter, sans-serif"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setBarTypes((prev) => checked ? prev.filter((x) => x !== opt) : [...prev, opt]);
                            }}
                            className="accent-[#CC0000]"
                          />
                          <span className="text-sm">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Operating Hours */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}>
                      Operating Hours <span style={{ color: '#CC0000' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setOperatingHours(prev => prev.length >= 7 ? prev : [...prev, { day: '', open: '', close: '' }])}
                      disabled={operatingHours.length >= 7}
                      title={operatingHours.length >= 7 ? 'Maximum of 7 days (Monday–Sunday)' : 'Add another day'}
                      className="text-xs font-semibold px-3 py-1 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'rgba(204,0,0,0.1)', color: '#CC0000', border: '1px solid rgba(204,0,0,0.2)' }}
                    >+ Add Day</button>
                  </div>
                  {errors.operatingHours && <p className="text-xs mb-2" style={{ color: '#ff6666' }}>{errors.operatingHours}</p>}
                  <div className="space-y-2">
                    {operatingHours.map((row, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                        <DarkSelect
                          value={row.day}
                          onChange={(e) => setOperatingHours(prev => prev.map((r, idx) => idx === i ? { ...r, day: e.target.value } : r))}
                        >
                          <option value="">Day...</option>
                          {DAYS_OF_WEEK.map(d => {
                            const takenElsewhere = operatingHours.some((r, idx) => idx !== i && r.day === d);
                            return <option key={d} value={d} disabled={takenElsewhere}>{d}{takenElsewhere ? ' ✓' : ''}</option>;
                          })}
                        </DarkSelect>
                        <DarkSelect
                          value={row.open}
                          onChange={(e) => setOperatingHours(prev => prev.map((r, idx) => idx === i ? { ...r, open: e.target.value } : r))}
                        >
                          <option value="">Opens...</option>
                          {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                        </DarkSelect>
                        <DarkSelect
                          value={row.close}
                          onChange={(e) => setOperatingHours(prev => prev.map((r, idx) => idx === i ? { ...r, close: e.target.value } : r))}
                        >
                          <option value="">Closes...</option>
                          {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                        </DarkSelect>
                        {operatingHours.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setOperatingHours(prev => prev.filter((_, idx) => idx !== i))}
                            className="w-9 h-[46px] rounded-xl flex items-center justify-center transition-colors"
                            style={{ background: 'rgba(204,0,0,0.08)', color: '#ff6666', border: '1px solid rgba(204,0,0,0.15)' }}
                          ><X className="w-4 h-4" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* GCash — Required */}
                <div className="pt-4 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#CC0000', fontFamily: "'DM Sans', Inter, sans-serif" }}>GCash Details</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(204,0,0,0.1)', color: '#CC0000', border: '1px solid rgba(204,0,0,0.2)' }}>Required for Payouts</span>
                  </div>
                  <p className="text-xs mb-4" style={{ color: '#555', fontFamily: "'DM Sans', Inter, sans-serif" }}>GCash details are required so we can process your payouts.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <DarkInput label="GCash Number *" value={gcashNumber} onChange={(e) => setGcashNumber(e.target.value)} placeholder="09XXXXXXXXX" error={errors.gcashNumber} />
                    <DarkInput label="GCash Account Name *" value={gcashName} onChange={(e) => setGcashName(e.target.value)} placeholder="Registered name" error={errors.gcashName} />
                  </div>
                </div>
                <DarkInput label="Bar Contact Number *" type="tel" value={barContactNumber} onChange={(e) => setBarContactNumber(e.target.value)} placeholder="09XXXXXXXXX" error={errors.barContactNumber} />
              </div>
            )}

            {/* ─── STEP 3: Documents ─── */}
            {step === 2 && (
              <div className="space-y-6">
                <div
                  className="rounded-xl p-4 mb-2"
                  style={{ background: 'rgba(204,0,0,0.04)', border: '1px solid rgba(204,0,0,0.12)' }}
                >
                  <p className="text-xs leading-relaxed" style={{ color: '#888', fontFamily: "'DM Sans', Inter, sans-serif" }}>
                    Upload the required BIR, business, safety, sanitation, and liquor permits, plus a photo holding your ID. DTI/SEC registration is optional but recommended.
                  </p>
                </div>
                <OCRDocumentScanner
                  label="BIR Certificate"
                  accept=".jpg,.jpeg,.png,.pdf"
                  file={birFile}
                  onFile={(f) => { setBirFile(f); setErrors((e) => ({ ...e, birFile: undefined })); }}
                  onRemove={() => { setBirFile(null); setBirNumber(''); setBirExpiry(''); }}
                  onOCRExtract={(data) => {
                    if (data.permitNumber) setBirNumber(data.permitNumber);
                    if (data.expiryDate) setBirExpiry(data.expiryDate);
                  }}
                  error={errors.birFile}
                  documentType="bir"
                />
                {birFile && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">BIR Number (Extracted)</label>
                      <input
                        type="text"
                        value={birNumber}
                        onChange={(e) => setBirNumber(e.target.value)}
                        placeholder="Verify/correct if needed"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Expiry Date (Extracted)</label>
                      <input
                        type="text"
                        value={birExpiry}
                        onChange={(e) => setBirExpiry(e.target.value)}
                        placeholder="Verify/correct if needed"
                        className="input-field"
                      />
                    </div>
                  </div>
                )}
                <OCRDocumentScanner
                  label="Business Permit"
                  accept=".jpg,.jpeg,.png,.pdf"
                  file={permitFile}
                  onFile={(f) => { setPermitFile(f); setErrors((e) => ({ ...e, permitFile: undefined })); }}
                  onRemove={() => { setPermitFile(null); setPermitNumber(''); setPermitExpiry(''); }}
                  onOCRExtract={(data) => {
                    if (data.permitNumber) setPermitNumber(data.permitNumber);
                    if (data.expiryDate) setPermitExpiry(data.expiryDate);
                  }}
                  error={errors.permitFile}
                  documentType="permit"
                />
                {permitFile && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Permit Number (Extracted)</label>
                      <input
                        type="text"
                        value={permitNumber}
                        onChange={(e) => setPermitNumber(e.target.value)}
                        placeholder="Verify/correct if needed"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label">Expiry Date (Extracted)</label>
                      <input
                        type="text"
                        value={permitExpiry}
                        onChange={(e) => setPermitExpiry(e.target.value)}
                        placeholder="Verify/correct if needed"
                        className="input-field"
                      />
                    </div>
                  </div>
                )}
                 <FileDropZone
                   label="Mayor's Permit"
                   helpText="Current Mayor's/Business Permit for the establishment."
                   hintText="PDF, JPG or PNG — max 10 MB"
                   accept=".pdf,.jpg,.jpeg,.png"
                   file={mayorsPermitFile}
                   onFile={(f) => { setMayorsPermitFile(f); setErrors((e) => ({ ...e, mayorsPermitFile: undefined })); }}
                   onRemove={() => setMayorsPermitFile(null)}
                   error={errors.mayorsPermitFile}
                 />
                 <FileDropZone
                   label="Sanitary Permit"
                   helpText="Current sanitary permit for the bar or food service area."
                   hintText="PDF, JPG or PNG — max 10 MB"
                   accept=".pdf,.jpg,.jpeg,.png"
                   file={sanitaryPermitFile}
                   onFile={(f) => { setSanitaryPermitFile(f); setErrors((e) => ({ ...e, sanitaryPermitFile: undefined })); }}
                   onRemove={() => setSanitaryPermitFile(null)}
                   error={errors.sanitaryPermitFile}
                 />
                 <FileDropZone
                   label="Fire Safety Inspection Certificate"
                   helpText="Current fire safety certificate or inspection clearance."
                   hintText="PDF, JPG or PNG — max 10 MB"
                   accept=".pdf,.jpg,.jpeg,.png"
                   file={fireSafetyFile}
                   onFile={(f) => { setFireSafetyFile(f); setErrors((e) => ({ ...e, fireSafetyFile: undefined })); }}
                   onRemove={() => setFireSafetyFile(null)}
                   error={errors.fireSafetyFile}
                 />
                 <FileDropZone
                   label="Liquor License"
                   helpText="Required because this platform is for bars serving alcoholic drinks."
                   hintText="PDF, JPG or PNG — max 10 MB"
                   accept=".pdf,.jpg,.jpeg,.png"
                   file={liquorLicenseFile}
                   onFile={(f) => { setLiquorLicenseFile(f); setErrors((e) => ({ ...e, liquorLicenseFile: undefined })); }}
                   onRemove={() => setLiquorLicenseFile(null)}
                   error={errors.liquorLicenseFile}
                 />
                 <FileDropZone
                   label="Photo holding your ID"
                   helpText="Take a clear photo of yourself holding your valid government ID. This is required for identity verification."
                   hintText="JPG or PNG — max 10 MB"
                   accept=".jpg,.jpeg,.png"
                   file={selfieWithIdFile}
                   onFile={(f) => { setSelfieWithIdFile(f); setErrors((e) => ({ ...e, selfieWithIdFile: undefined })); }}
                   onRemove={() => setSelfieWithIdFile(null)}
                   error={errors.selfieWithIdFile}
                 />
                 <FileDropZone
                   label="DTI / SEC Registration (Optional)"
                   helpText="DTI registration or SEC certificate. Optional but recommended for faster review."
                   hintText="PDF, JPG or PNG — max 10 MB"
                   accept=".pdf,.jpg,.jpeg,.png"
                   file={dtiSecFile}
                   onFile={(f) => { setDtiSecFile(f); setErrors((e) => ({ ...e, dtiSecFile: undefined })); }}
                   onRemove={() => setDtiSecFile(null)}
                   error={errors.dtiSecFile}
                 />
               </div>
             )}

             {step === 3 && (
               <div className="space-y-6">
                 <div
                   className="rounded-xl p-4"
                   style={{ background: 'rgba(204,0,0,0.06)', border: '1px solid rgba(204,0,0,0.18)' }}
                 >
                    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#CC0000', fontFamily: "'DM Sans', Inter, sans-serif" }}>
                      Review Your Application
                    </p>
                   <div className="space-y-3">
                     <div>
                       <p className="text-xs" style={{ color: '#666' }}>Owner Account</p>
                       <p className="text-sm text-white">{firstName} {middleName} {lastName}</p>
                       <p className="text-xs" style={{ color: '#888' }}>{email} · {phone}</p>
                     </div>
                     <div>
                       <p className="text-xs" style={{ color: '#666' }}>Bar Details</p>
                       <p className="text-sm text-white">{barName} · {barTypes.join(', ')}</p>
                       <p className="text-xs" style={{ color: '#888' }}>{barAddress}, {barBarangay}, {barCity}</p>
                       <p className="text-xs" style={{ color: '#888' }}>Hours: {operatingHours.filter(h => h.day && h.open && h.close).map(h => `${h.day} ${h.open}–${h.close}`).join(', ')}</p>
                     </div>
                     <div>
                       <p className="text-xs" style={{ color: '#666' }}>Documents</p>
                       <p className="text-xs" style={{ color: '#888' }}>BIR: {birFile?.name || '—'} · Business: {permitFile?.name || '—'} · Mayor's: {mayorsPermitFile?.name || '—'}</p>
                       <p className="text-xs" style={{ color: '#888' }}>Sanitary: {sanitaryPermitFile?.name || '—'} · Fire Safety: {fireSafetyFile?.name || '—'} · Liquor: {liquorLicenseFile?.name || '—'}</p>
                       <p className="text-xs" style={{ color: '#888' }}>ID Photo: {selfieWithIdFile?.name || '—'}</p>
                       {dtiSecFile && <p className="text-xs" style={{ color: '#888' }}>DTI/SEC: {dtiSecFile?.name || '—'}</p>}
                     </div>
                   </div>
                 </div>
                 <div
                   className="rounded-xl p-4"
                   style={{ background: 'rgba(204,0,0,0.04)', border: '1px solid rgba(245,158,11,0.28)' }}
                 >
                   <p className="text-xs leading-relaxed" style={{ color: '#fbbf24', fontFamily: "'DM Sans', Inter, sans-serif" }}>
                     <span className="font-semibold">IMPORTANT:</span> Illegal bars, adult entertainment establishments, and bars without complete business permits are NOT accepted on this platform. Submitting false information will result in rejection.
                   </p>
                 </div>
                 <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontFamily: "'DM Sans', Inter, sans-serif" }}>
                   <input
                     type="checkbox"
                     checked={termsAccepted}
                     onChange={(e) => setTermsAccepted(e.target.checked)}
                     style={{ marginTop: '0.1rem', flexShrink: 0, accentColor: '#CC0000' }}
                   />
                   <span className="text-sm" style={{ color: termsAccepted ? '#fff' : '#888' }}>
                     I confirm that all information provided is true and that my bar has complete business permits. I understand that false information will result in rejection.
                   </span>
                 </label>
               </div>
             )}

            {/* ─── Navigation buttons ─── */}
            <div className={`flex gap-3 mt-8 ${step === 0 ? 'justify-end' : 'justify-between'}`}>
              {step > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#aaa', fontFamily: "'DM Sans', Inter, sans-serif" }}
                >
                  ← Back
                </button>
              )}
               <button
                 type="submit"
                 disabled={submitting || (step === 3 && !termsAccepted)}
                 className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-300 disabled:opacity-60"
                 style={{
                   background: '#CC0000',
                   boxShadow: '0 0 20px rgba(204,0,0,0.3)',
                   fontFamily: "'DM Sans', Inter, sans-serif",
                   maxWidth: step === 0 ? '160px' : undefined,
                 }}
               >
                 {submitting ? (
                   <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                 ) : step === 3 ? (
                   'Confirm & Submit'
                 ) : (
                   'Continue →'
                 )}
               </button>
            </div>
          </form>
        </div>

        {/* Login link */}
        <p className="text-center text-sm mt-6" style={{ color: '#555', fontFamily: "'DM Sans', Inter, sans-serif" }}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold" style={{ color: '#CC0000' }}>
            Log in →
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
