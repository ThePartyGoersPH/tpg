import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';
import { authApi } from '../api/authApi';
import logoImg from '../../logo.png';

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('form');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This reset link is missing or invalid. Please request a new one.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setStatus('success');
    } catch (requestError) {
      setStatus('error');
      setError(requestError.response?.data?.message || 'This reset link is invalid or expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0A0A0A', backgroundImage: 'radial-gradient(ellipse at 60% 20%, rgba(204,0,0,0.1) 0%, transparent 60%)' }}>
      <div className="relative w-full max-w-md">
        <div className="flex justify-center mb-8"><img src={logoImg} alt="The Party Goers PH" className="w-20 h-20 object-contain" /></div>
        <div className="rounded-2xl p-8" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 0 60px rgba(204,0,0,0.08), 0 30px 60px rgba(0,0,0,0.5)' }}>
          {status === 'success' ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#22c55e' }} />
              <h1 className="text-white mb-3" style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '2rem', letterSpacing: '0.05em' }}>PASSWORD UPDATED</h1>
              <p className="text-sm mb-6" style={{ color: '#888' }}>Your password has been changed successfully.</p>
              <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#CC0000' }}>Go to login</Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                {status === 'error' ? <XCircle className="w-10 h-10 mx-auto mb-4" style={{ color: '#ff6666' }} /> : null}
                <h1 className="text-white mb-1" style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '2rem', letterSpacing: '0.05em' }}>CREATE NEW PASSWORD</h1>
                <p className="text-sm" style={{ color: '#888' }}>Choose a new password for your manager account.</p>
              </div>
              {error && <div className="mb-5 text-sm rounded-lg px-4 py-3" style={{ background: 'rgba(204,0,0,0.1)', border: '1px solid rgba(204,0,0,0.3)', color: '#ff6666' }}>{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-5">
                <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: '#666' }}>
                  New Password
                  <div className="relative mt-2"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} minLength={6} required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#777' }}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                </label>
                <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: '#666' }}>
                  Confirm Password
                  <div className="relative mt-2"><input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-white outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }} minLength={6} required /><button type="button" onClick={() => setShowConfirm((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#777' }}>{showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                </label>
                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-white text-sm disabled:opacity-60" style={{ background: '#CC0000', boxShadow: '0 0 25px rgba(204,0,0,0.35)' }}>{loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Update Password'}</button>
              </form>
              <div className="mt-6 text-center"><Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#CC0000' }}><ArrowLeft className="w-4 h-4" /> Back to login</Link></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
