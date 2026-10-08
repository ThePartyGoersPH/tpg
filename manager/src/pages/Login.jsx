import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import logoImg from '../../logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setError('');
    setLoading(true);
    console.log('🔑 Attempting login with:', email);
    
    try {
      const result = await login(email, password);
      console.log('📝 Login result:', result);
      setLoading(false);
      if (result.success) {
        console.log('✅ Login successful, navigating to dashboard');
        navigate('/dashboard');
      } else {
        console.log('❌ Login failed:', result.message);
        setError(result.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('💥 Login error:', error);
      setLoading(false);
      setError('Connection problem. Please try again in a moment.');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: '#0A0A0A',
        backgroundImage: 'radial-gradient(ellipse at 60% 20%, rgba(204,0,0,0.1) 0%, transparent 60%)',
      }}
    >
      {/* Noise grain overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '150px',
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={logoImg} alt="The Party Goers PH" className="w-20 h-20 object-contain" />
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: '#111111',
            border: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 0 60px rgba(204,0,0,0.08), 0 30px 60px rgba(0,0,0,0.5)',
          }}
        >
          <div className="text-center mb-8">
            <h1
              className="text-white mb-1"
              style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '2rem', letterSpacing: '0.05em' }}
            >
              WELCOME BACK
            </h1>
            <p style={{ color: '#888', fontSize: '0.875rem', fontFamily: "'DM Sans', Inter, sans-serif" }}>
              Sign in to your bar owner account
            </p>
          </div>

          {error && (
            <div
              className="mb-6 text-sm rounded-lg px-4 py-3"
              style={{ background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.3)', color: '#ff6666', fontFamily: "'DM Sans', Inter, sans-serif" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}
              >
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontFamily: "'DM Sans', Inter, sans-serif",
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(204,0,0,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: '#666', fontFamily: "'DM Sans', Inter, sans-serif" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontFamily: "'DM Sans', Inter, sans-serif",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(204,0,0,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(204,0,0,0.08)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
                  style={{ color: '#555' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-sm transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{
                background: loading ? '#991500' : '#CC0000',
                boxShadow: loading ? 'none' : '0 0 25px rgba(204,0,0,0.35)',
                fontFamily: "'DM Sans', Inter, sans-serif",
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Log In'
              )}
            </button>

            <div className="text-right -mt-3">
              <Link
                to="/forgot-password"
                className="text-xs font-semibold transition-colors duration-200"
                style={{ color: '#CC0000' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FF1A1A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#CC0000'; }}
              >
                Forgot password?
              </Link>
            </div>
          </form>

          <div
            className="mt-6 pt-6 text-center text-sm"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontFamily: "'DM Sans', Inter, sans-serif" }}
          >
            <span style={{ color: '#555' }}>Don't have an account? </span>
            <Link
              to="/register"
              className="font-semibold transition-colors duration-200"
              style={{ color: '#CC0000' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#FF1A1A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#CC0000'; }}
            >
              Register your bar →
            </Link>
          </div>
        </div>

        <p
          className="text-center text-xs mt-6"
          style={{ color: '#444', fontFamily: "'DM Sans', Inter, sans-serif" }}
        >
          The Party Goers PH © {new Date().getFullYear()}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
