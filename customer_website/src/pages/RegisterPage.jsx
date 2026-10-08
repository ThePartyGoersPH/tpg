import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone_number: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await register(form);
      navigate('/login');
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
          <input className="input" type="password" placeholder="Password" minLength={6} value={form.password} onChange={(e) => onChange('password', e.target.value)} required />
          <input className="input" placeholder="Phone number (optional)" value={form.phone_number} onChange={(e) => onChange('phone_number', e.target.value)} />
          {error ? <p className="error">{error}</p> : null}
          <button className="button" type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Account'}</button>
        </div>

        <p className="section-subtitle">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

export default RegisterPage;
