import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import apiClient from '../api/client';

const ID_TYPES = [
  'Driver\'s License (LTO)',
  'PhilSys National ID / ePhilID',
  'Philippine Passport',
  'UMID',
  'PRC ID',
  'Postal ID',
  'Voter\'s ID',
  'PhilHealth ID',
  'SSS ID',
  'Senior Citizen ID',
];

const ID_TYPES_WITH_BACK = ['Driver\'s License (LTO)', 'PhilSys National ID / ePhilID', 'Philippine Passport', 'UMID', 'PRC ID', 'Postal ID', 'Voter\'s ID', 'PhilHealth ID', 'SSS ID', 'Senior Citizen ID'];

function validatePhone(phone) {
  if (!phone) return true;
  return /^09\d{9}$/.test(phone);
}

function validateAge(dob) {
  if (!dob) return false;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 18;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: '',
    date_of_birth: '',
  });

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
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const frontRef = useRef(null);
  const backRef = useRef(null);
  const selfieRef = useRef(null);

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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

  const isValid = form.first_name && form.last_name && form.email && form.password &&
    form.date_of_birth && validateAge(form.date_of_birth) &&
    validatePhone(form.phone_number) &&
    idType && frontImage && selfieImage && (!needsBack || backImage) &&
    consent && privacyConsent;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid) return;
    setError('');
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('first_name', form.first_name);
      formData.append('last_name', form.last_name);
      formData.append('email', form.email);
      formData.append('password', form.password);
      if (form.phone_number) formData.append('phone_number', form.phone_number);
      formData.append('date_of_birth', form.date_of_birth);
      formData.append('id_type', idType);
      if (idNumber) formData.append('id_number', idNumber);
      formData.append('id_front', frontImage);
      if (backImage) formData.append('id_back', backImage);
      formData.append('id_selfie', selfieImage);

      await apiClient.post('/auth/register', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // No token saved — go to email verification screen
      navigate('/verify-email', { state: { email: form.email } });
    } catch (err) {
      setError(err?.response?.data?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <p className="badge">New Customer</p>
        <h1 className="section-title">Create account</h1>

        <div className="grid two-col">
          <input className="input" placeholder="First name" value={form.first_name} onChange={(e) => onChange('first_name', e.target.value)} required />
          <input className="input" placeholder="Last name" value={form.last_name} onChange={(e) => onChange('last_name', e.target.value)} required />
        </div>

        <div className="grid">
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => onChange('email', e.target.value)} required />
          <input className="input" type="password" placeholder="Password (min 6 chars)" minLength={6} value={form.password} onChange={(e) => onChange('password', e.target.value)} required />
          <input className="input" placeholder="Phone number (optional, 09XXXXXXXXX)" value={form.phone_number} onChange={(e) => onChange('phone_number', e.target.value)} />
          <input className="input" type="date" placeholder="Date of birth" value={form.date_of_birth} onChange={(e) => onChange('date_of_birth', e.target.value)} required />
          {!validateAge(form.date_of_birth) && form.date_of_birth && (
            <p className="error">You must be at least 18 years old.</p>
          )}
          {!validatePhone(form.phone_number) && form.phone_number && (
            <p className="error">Phone must be in 09XXXXXXXXX format.</p>
          )}
        </div>

        {/* ID Verification Section */}
        <div className="id-verification-section">
          <h2 className="section-subtitle">Verify your age and identity</h2>

          <select className="input" value={idType} onChange={(e) => setIdType(e.target.value)} required>
            <option value="">Select ID type</option>
            {ID_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <input className="input" placeholder="ID number (optional)" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />

          {/* Front photo */}
          <div className="image-upload">
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

          {/* Back photo */}
          {needsBack && (
            <div className="image-upload">
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

          {/* Selfie */}
          <div className="image-upload">
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

          <div className="tips">
            <p><strong>Tips:</strong> All 4 corners visible, text readable, not expired, no glare, no screenshots.</p>
          </div>

          <label className="checkbox">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            I confirm I am 18+ and the ID provided is mine.
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={privacyConsent} onChange={(e) => setPrivacyConsent(e.target.checked)} required />
            I consent to the collection and processing of my ID for age and identity verification under the Data Privacy Act (RA 10173). My ID will be reviewed by authorized admins, processed by Google Cloud Vision for text reading, and deleted after the retention period.
          </label>
        </div>

        {error ? <p className="error">{error}</p> : null}
        <button className="button" type="submit" disabled={!isValid || submitting}>
          {submitting ? 'Creating...' : 'Create Account'}
        </button>

        <p className="section-subtitle">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}