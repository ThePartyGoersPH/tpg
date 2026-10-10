import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';

// One stable toast ID so rapid retries replace the toast instead of stacking.
const LOGIN_TOAST_ID = 'sa-login-error';

function readPersistedLock() {
  try {
    const raw = sessionStorage.getItem('tpg_login_lock');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.lockedUntil) return null;
    if (new Date(parsed.lockedUntil).getTime() <= Date.now()) {
      sessionStorage.removeItem('tpg_login_lock');
      return null;
    }
    return { email: parsed.email || '', lockedUntil: parsed.lockedUntil };
  } catch (_) {
    return null;
  }
}

function formatCountdown(lockedUntil) {
  const total = Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function isLockExpired(lockedUntil) {
  return new Date(lockedUntil).getTime() <= Date.now();
}

function warningForRemaining(n) {
  if (n === 1) {
    return 'Incorrect email or password. 1 attempt left before your account is temporarily locked.';
  }
  if (n === 2) {
    return 'Incorrect email or password. 2 attempts remaining before your account is locked for 5 minutes.';
  }
  return null;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockInfo, setLockInfo] = useState(null);
  const [, setLockTick] = useState(0);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    setLockInfo(readPersistedLock());
  }, []);

  useEffect(() => {
    if (!lockInfo) return;
    if (isLockExpired(lockInfo.lockedUntil)) {
      setLockInfo(null);
      try { sessionStorage.removeItem('tpg_login_lock'); } catch (_) {}
      return;
    }
    const iv = setInterval(() => setLockTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [lockInfo?.lockedUntil]);

  const lockMatchesEmail = (info, value) =>
    info && (!info.email || info.email.trim().toLowerCase() === String(value || '').trim().toLowerCase());
  const lockActive = lockInfo && !isLockExpired(lockInfo.lockedUntil) && lockMatchesEmail(lockInfo, email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please enter email and password', { id: LOGIN_TOAST_ID }); return; }
    if (lockActive || loading) return;

    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data.success) {
        const { user, token } = response.data.data;
        const userRole = String(user.role || '').toUpperCase();
        if (userRole !== 'SUPER_ADMIN') { toast.error('Access denied. Super Admin permissions required.', { id: LOGIN_TOAST_ID }); setLoading(false); return; }
        try { sessionStorage.removeItem('tpg_login_lock'); } catch (_) {}
        setLockInfo(null);
        login(user, token);
        toast.success('Login successful!');
        navigate('/');
      } else { toast.error(response.data.message || 'Login failed', { id: LOGIN_TOAST_ID }); }
    } catch (error) {
      const data = error.response?.data || {};
      if (data.code === 'ACCOUNT_LOCKED' && data.lockedUntil) {
        const info = { email, lockedUntil: data.lockedUntil };
        setLockInfo(info);
        try { sessionStorage.setItem('tpg_login_lock', JSON.stringify(info)); } catch (_) {}
      } else if (error.response?.status === 401 && typeof data.attemptsRemaining === 'number' && warningForRemaining(data.attemptsRemaining)) {
        toast.error(warningForRemaining(data.attemptsRemaining), { id: LOGIN_TOAST_ID });
      } else {
        toast.error(data.message || 'Login failed', { id: LOGIN_TOAST_ID });
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a0a0a] via-[#2d0a0a] to-[#0d0d0d] relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-red-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-red-800/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-900/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full mx-4 relative z-10">
        <div className="backdrop-blur-xl bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-2xl mb-4 shadow-lg shadow-red-900/30">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Super Admin Portal</h1>
            <p className="text-white/30 text-sm mt-2">Platform Bar Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {lockActive && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
                <p className="text-sm font-bold text-red-300">
                  Too many failed attempts. Try again in {formatCountdown(lockInfo.lockedUntil)}.
                </p>
                <p className="text-xs text-white/40 mt-1">Locked for your protection.</p>
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-white/50 mb-2">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/30 transition text-sm"
                placeholder="admin@platform.com"
                disabled={loading || lockActive}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-white/50 mb-2">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/30 transition text-sm"
                placeholder="Enter password"
                disabled={loading || lockActive}
              />
            </div>

            <button
              type="submit"
              disabled={loading || lockActive}
              className="w-full py-3 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 focus:ring-4 focus:ring-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-red-900/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                  Logging in...
                </span>
              ) : lockActive ? `Locked ${formatCountdown(lockInfo.lockedUntil)}` : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[11px] text-white/20">Super Admin access only</p>
          </div>
        </div>
      </div>
    </div>
  );
}
