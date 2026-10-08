import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { CUSTOMER_ROLE_BLOCK_MESSAGE } from '../utils/constants';

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authError, setAuthError, setAccessDeniedMessage } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setAuthError('');
    setAccessDeniedMessage('');

    try {
      await login(email, password);
      const redirectPath = location.state?.from || '/dashboard';
      navigate(redirectPath, { replace: true });
    } catch (error) {
      const message = error?.message || 'Unable to login.';
      if (message === CUSTOMER_ROLE_BLOCK_MESSAGE) {
        setAccessDeniedMessage(message);
        navigate('/unauthorized', { replace: true, state: { message } });
      }
      setAuthError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <p className="badge">Customer Access</p>
        <h1 className="section-title">Welcome back</h1>
        <p className="section-subtitle">Sign in to discover bars and reserve your table.</p>

        <div className="grid">
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {authError ? <p className="error">{authError}</p> : null}
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </div>

        <p className="section-subtitle">
          No account yet? <Link to="/register">Register here</Link>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
