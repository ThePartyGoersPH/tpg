import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, CheckCircle } from 'lucide-react';
import { authApi } from '../api/authApi';
import logoImg from '../../logo.png';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--m-bg)', backgroundImage: 'radial-gradient(ellipse at 60% 20%, rgba(204,0,0,0.1) 0%, transparent 60%)' }}>
      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img src={logoImg} alt="The Party Goers PH" className="w-20 h-20 object-contain" />
        </div>
        <div className="rounded-2xl p-8" style={{ background: 'var(--m-surface)', border: '1px solid var(--m-border)', boxShadow: '0 0 60px rgba(204,0,0,0.08), 0 30px 60px rgba(0,0,0,0.5)' }}>
          {sent ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#22c55e' }} />
              <h1 className="text-white mb-3" style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '2rem', letterSpacing: '0.05em' }}>CHECK YOUR EMAIL</h1>
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#888' }}>
                If an account exists for <strong className="text-white">{email}</strong>, we sent a link to reset your password. The link expires in one hour.
              </p>
              <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#CC0000' }}>
                <ArrowLeft className="w-4 h-4" /> Back to login
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <Mail className="w-10 h-10 mx-auto mb-4" style={{ color: '#CC0000' }} />
                <h1 className="text-white mb-1" style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '2rem', letterSpacing: '0.05em' }}>FORGOT PASSWORD?</h1>
                <p className="text-sm" style={{ color: '#888' }}>Enter your email and we will send you a reset link.</p>
              </div>
              {error && <div className="mb-5 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.3)', color: '#ff6666' }}>{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: '#666' }}>
                  Email Address
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none" style={{ background: 'var(--m-active-bg)', border: '1px solid var(--m-border)' }} placeholder="you@example.com" required autoFocus />
                </label>
                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-sm disabled:opacity-60" style={{ background: '#CC0000', boxShadow: '0 0 25px rgba(204,0,0,0.35)' }}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : 'Send Reset Link'}
                </button>
              </form>
              <div className="mt-6 text-center">
                <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#CC0000' }}><ArrowLeft className="w-4 h-4" /> Back to login</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
