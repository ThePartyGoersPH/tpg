import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { authApi } from '../api/authApi';
import logoImg from '../../logo.png';

const VerifyBarOwnerEmail = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Missing verification token.');
        return;
      }
      try {
        const { data } = await authApi.verifyBarOwnerEmail(token);
        setStatus('success');
        setMessage(data?.message || 'Your account is under review. You will be notified once approved.');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed.');
      }
    };
    run();
  }, [token]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0A0A0A', backgroundImage: 'radial-gradient(ellipse at 50% 30%, rgba(204,0,0,0.1) 0%, transparent 60%)' }}
    >
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <img src={logoImg} alt="The Party Goers PH" className="w-16 h-16 object-contain" />
        </div>

        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{
            background: status === 'success' ? 'rgba(34,197,94,0.12)' : status === 'error' ? 'rgba(204,0,0,0.12)' : 'rgba(204,0,0,0.1)',
            border: status === 'success' ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(204,0,0,0.3)',
            boxShadow: '0 0 30px rgba(204,0,0,0.15)'
          }}
        >
          {status === 'loading' ? (
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#CC0000' }} />
          ) : status === 'success' ? (
            <CheckCircle className="w-10 h-10" style={{ color: '#22c55e' }} />
          ) : (
            <XCircle className="w-10 h-10" style={{ color: '#ff6666' }} />
          )}
        </div>

        <h2
          className="text-white mb-3"
          style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '2.2rem', letterSpacing: '0.05em' }}
        >
          {status === 'loading' ? 'VERIFYING...' : status === 'success' ? 'EMAIL VERIFIED' : 'VERIFICATION FAILED'}
        </h2>

        <p className="text-base leading-relaxed mb-8" style={{ color: '#888', fontFamily: "'DM Sans', Inter, sans-serif" }}>
          {message}
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
};

export default VerifyBarOwnerEmail;
