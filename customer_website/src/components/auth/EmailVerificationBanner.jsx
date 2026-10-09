import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useView } from '../../hooks/useView';
import { VIEWS } from '../../contexts/ViewContext';
import { isEmailUnverified } from '../../utils/constants';
import apiClient from '../../api/client';

const RESEND_COOLDOWN_SECONDS = 60;

// Persistent, non-blocking reminder for signed-in users whose email is still
// unverified. It never gates navigation or API access on its own — login and
// requireAuth remain the enforcement points — it only surfaces the state and
// offers a way forward (resend, or jump to the code entry screen).
function EmailVerificationBanner() {
  const { user, isAuthenticated, refreshUser } = useAuth() || {};
  const { navigate } = useView() || {};
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);
  const cooldownRef = useRef(null);

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  const unverified = Boolean(isAuthenticated) && isEmailUnverified(user);
  if (!unverified) return null;

  const email = String(user?.email || '').trim();

  const startCooldown = (seconds) => {
    const next = Number(seconds) > 0 ? Number(seconds) : RESEND_COOLDOWN_SECONDS;
    setCooldown(next);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (sending || cooldown > 0 || !email) return;
    setSending(true);
    setNotice('');
    try {
      // Same public endpoint the login and verify screens use; it carries its
      // own 60s cooldown, so this button can never spam the inbox either.
      const res = await apiClient.post('/auth/resend-verification', { email });
      const message = res.data?.message || 'Verification email sent! Check your inbox.';
      setNotice(message);
      setNoticeOk(true);
      startCooldown(RESEND_COOLDOWN_SECONDS);
      // If the backend says the address is already confirmed, sync the session
      // so the banner clears without a reload.
      if (/already verified/i.test(message) && typeof refreshUser === 'function') {
        try { await refreshUser(); } catch (_) { /* session stays as-is */ }
      }
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === 'RESEND_COOLDOWN' && data?.wait_seconds) {
        startCooldown(data.wait_seconds);
        setNotice(`Please wait ${data.wait_seconds}s before resending.`);
        setNoticeOk(false);
      } else {
        setNotice(data?.message || 'Failed to resend. Please try again.');
        setNoticeOk(false);
      }
    } finally {
      setSending(false);
    }
  };

  const handleEnterCode = () => {
    if (typeof navigate === 'function') {
      navigate(VIEWS.VERIFY_EMAIL, { email });
    }
  };

  return (
    <div className="email-verification-banner" role="status" aria-live="polite">
      <div className="email-verification-banner__inner">
        <span className="email-verification-banner__icon" aria-hidden="true">✉️</span>
        <div className="email-verification-banner__copy">
          <p className="email-verification-banner__text">
            Please verify your email address to unlock full account features.
          </p>
          {notice && (
            <p className={`email-verification-banner__notice ${noticeOk ? 'is-ok' : 'is-err'}`}>
              {notice}
            </p>
          )}
        </div>
        <div className="email-verification-banner__actions">
          <button
            type="button"
            className="evb-btn"
            onClick={handleResend}
            disabled={sending || cooldown > 0 || !email}
          >
            {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
          </button>
          <button
            type="button"
            className="evb-btn evb-btn--ghost"
            onClick={handleEnterCode}
          >
            Enter code
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailVerificationBanner;
