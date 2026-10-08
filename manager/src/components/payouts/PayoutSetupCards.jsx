import React, { useState, useEffect } from 'react';
import { Wallet, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { marketplaceApi } from '../../api/marketplaceApi';
import ConfirmModal from '../common/ConfirmModal';
import toast from 'react-hot-toast';

const PAYMONGO_DASHBOARD_URL = 'https://dashboard.paymongo.com';
const PAYMONGO_SIGNUP_URL = 'https://dashboard.paymongo.com/signup';
const PAYMONGO_LOGIN_URL = 'https://dashboard.paymongo.com/login';

/**
 * PayMongo payout setup (Test/Live modes). Stripe has been removed from the UI.
 * variant="full"     → collapsible card with mode toggle + status + connect.
 * variant="reminder" → one-line nudge only when payouts aren't connected.
 */
const PayoutSetupCards = ({ variant = 'full' }) => {
  const [payouts, setPayouts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [liveModal, setLiveModal] = useState(false);
  const [redirected, setRedirected] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [liveSecret, setLiveSecret] = useState('');
  const [livePublic, setLivePublic] = useState('');
  const [connectError, setConnectError] = useState('');
  const [testConnectError, setTestConnectError] = useState('');

  useEffect(() => { loadStatus(); }, []);

  const loadStatus = async () => {
    try {
      const { data } = await marketplaceApi.status();
      setPayouts(data.data || null);
    } catch {
      setPayouts(null);
    }
  };

  const switchMode = async (mode) => {
    if (!payouts || payouts.paymongo_mode === mode) return;
    // Going Live without verification opens the redirect flow instead of
    // posting a switch that would only 403.
    if (mode === 'live' && payouts.onboarding_status !== 'verified') {
      setLiveModal(true);
      return;
    }
    setBusy(true);
    try {
      const { data } = await marketplaceApi.setMode(mode);
      toast.success(data.message || `Switched to ${mode} mode`);
      // The live-redirect panel (and both key forms) belong to an in-progress
      // live activation — never carry them over into the other mode.
      setRedirected(false);
      setLiveSecret(''); setLivePublic(''); setConnectError('');
      setTestConnectError('');
      loadStatus();
    } catch (e) {
      // Safety net: funnel back into the self-serve redirect flow instead of
      // showing a dead-end error. (The old "Verification Pending" toast is
      // intentionally gone — Live activation happens via key validation.)
      if (e?.response?.data?.code === 'LIVE_VERIFICATION_PENDING') {
        setLiveModal(true);
      } else {
        toast.error(e?.response?.data?.message || 'Mode switch failed');
      }
    } finally {
      setBusy(false);
    }
  };

  // Confirm-modal → redirect to PayMongo signup. Pure redirect for now (our
  // Platforms activation is still pending, so no backend call fires here).
  const confirmLiveRedirect = () => {
    window.open(PAYMONGO_SIGNUP_URL, '_blank', 'noopener');
    setLiveModal(false);
    setRedirected(true);
  };

  // Owner pasted their own live keys → backend validates directly with PayMongo.
  const submitLiveKeys = async () => {
    if (claimBusy) return;
    if (!liveSecret.trim()) {
      setConnectError('Paste your PayMongo live secret key first.');
      return;
    }
    setClaimBusy(true);
    setConnectError('');
    try {
      const { data } = await marketplaceApi.connectLive({
        live_secret_key: liveSecret.trim(),
        live_public_key: livePublic.trim() || undefined,
      });
      toast.success(data.message || 'Live Mode is now active.');
      setRedirected(false);
      setLiveSecret(''); setLivePublic('');
      loadStatus();
    } catch (e) {
      // Friendly invalid-credentials message; technical detail stays server-side.
      setConnectError(e?.response?.data?.message || "We couldn't verify these PayMongo credentials. Please check and try again.");
    } finally {
      setClaimBusy(false);
    }
  };

  const connectTestAuto = async () => {
    if (busy) return;
    setBusy(true);
    setTestConnectError('');
    try {
      const { data } = await marketplaceApi.testConnectAuto();
      toast.success(data.message || 'Test Mode enabled');
      loadStatus();
    } catch (e) {
      // Friendly error message; technical detail stays server-side.
      setTestConnectError(e?.response?.data?.message || "Couldn't enable Test Mode. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const disconnectTest = async () => {
    if (busy) return;
    setBusy(true);
    setTestConnectError('');
    try {
      const { data } = await marketplaceApi.testDisconnect();
      toast.success(data.message || 'Test Mode disconnected');
      loadStatus();
    } catch (e) {
      setTestConnectError(e?.response?.data?.message || "Couldn't disconnect Test Mode. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const startLiveOnboarding = () => {
    // Route through the confirmation modal so owners always see the redirect notice.
    setLiveModal(true);
  };

  if (variant === 'reminder') {
    if (!payouts || payouts.can_sell) return null;
    return (
      <div className="card flex items-center gap-2" style={{ borderColor: 'rgba(251,191,36,0.35)', background: 'rgba(251,191,36,0.06)' }}>
        <span style={{ color: '#fbbf24' }}>⚠️</span>
        <p className="text-xs" style={{ color: '#ccc' }}>
          Connect a payout method in <strong style={{ color: '#fff' }}>Bar Management</strong> before publishing packages — new packages stay Inactive until then.
        </p>
      </div>
    );
  }

  const mode = payouts?.paymongo_mode || 'test';
  const connected = Boolean(payouts?.paymongo_test_connected);
  const verified = payouts?.onboarding_status === 'verified';
  const pendingLive = payouts?.onboarding_status === 'pending';
  const rejected = payouts?.onboarding_status === 'rejected';
  const ownerName = payouts?.owner_name || null;
  const fee = payouts?.platform_fee_percentage;
  const childId = payouts?.child_merchant_id || null;
  // Backend readiness flag. Falls back to the test-connect state for payloads
  // that predate it, so a connected bar never shows a false warning.
  const paymentsReady = payouts ? Boolean(payouts.payments_ready ?? payouts.paymongo_test_connected) : false;

  const sub = !payouts
    ? 'Loading…'
    : pendingLive
      ? 'Verification In Progress'
      : rejected
        ? 'Verification Not Approved'
        : mode === 'test'
          ? (connected ? `Connected (Test Sandbox Enabled)${ownerName ? ` — Bar Owner: ${ownerName}` : ''}` : 'Not Connected')
          : (verified ? `Active${ownerName ? ` — Bar Owner: ${ownerName}` : ''}` : 'Not Connected');
  const subColor = ((connected || verified) && !pendingLive && !rejected) ? '#4ade80' : '#fbbf24';

  const summary = !payouts
    ? 'Payouts'
    : pendingLive
      ? 'PayMongo — Live · Verification In Progress'
      : `PayMongo — ${mode === 'test' ? 'Test' : 'Live'} · ${(connected || verified) && !rejected ? (ownerName || (mode === 'test' ? 'Test Sandbox Enabled' : 'Connected')) : 'Not Connected'}`;

  return (
    <div className="card" style={{ borderColor: 'rgba(201,118,47,0.35)', background: 'rgba(201,118,47,0.05)' }}>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-2"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Wallet className="w-5 h-5" style={{ color: '#C9762F' }} />
          Payouts &amp; Payment Setup
          <span className="text-xs font-normal" style={{ color: '#888' }}>{summary}</span>
        </span>
        {collapsed ? <ChevronDown className="w-4 h-4" style={{ color: '#888' }} /> : <ChevronUp className="w-4 h-4" style={{ color: '#888' }} />}
      </button>

      {/* Always visible, even while the card is collapsed: the owner must not
          miss that the customer-facing menu is hidden until setup is done. */}
      {payouts && !paymentsReady && (
        <div
          role="alert"
          className="flex items-start gap-2"
          style={{
            marginTop: '0.7rem',
            padding: '0.7rem 0.85rem',
            border: '1px solid rgba(251,191,36,0.35)',
            background: 'rgba(251,191,36,0.06)',
            borderRadius: '10px',
            color: '#fbbf24',
            fontSize: '0.82rem',
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '0.95rem', lineHeight: 1.3 }}>⚠️</span>
          <span>Your bar menu is hidden from customers until you connect a payment method.</span>
        </div>
      )}

      {!collapsed && (
        <div className="mt-3 space-y-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#888' }}>Mode:</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              {['test', 'live'].map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  disabled={busy || !payouts || mode === m}
                  className="text-xs font-semibold px-3 py-1.5"
                  style={{
                    background: mode === m ? (m === 'live' ? 'rgba(204,0,0,0.25)' : 'rgba(201,118,47,0.25)') : 'transparent',
                    color: mode === m ? '#fff' : '#888',
                    border: 'none', cursor: mode === m ? 'default' : 'pointer',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {m === 'test' ? 'Test Mode' : 'Live Mode'}
                </button>
              ))}
            </div>
            {fee != null && (
              <span className="text-xs" style={{ color: '#888' }}>Platform fee {Number(fee)}%</span>
            )}
          </div>

          {/* Status */}
          <p className="text-sm font-semibold text-white">
            {pendingLive ? 'PayMongo — Live Mode' : (mode === 'test' ? 'PayMongo — Test Mode' : 'PayMongo — Live Mode')}
            <span className="ml-2 font-normal" style={{ color: subColor }}>{sub}</span>
          </p>
          {/* Live redirect panel: only ever relevant while Live Mode is
              actually selected. Gated on mode (not just `redirected`) so a
              stale redirect can never render under the Test Mode toggle. */}
          {mode === 'live' && redirected && !verified ? (
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <p className="text-sm font-semibold text-white">PayMongo — Live Mode: Redirected to PayMongo</p>
              <p className="text-xs" style={{ color: '#ccc' }}>
                We&apos;ve opened PayMongo in a new tab. Once you&apos;ve created and verified your business account there, paste your <strong style={{ color: '#fff' }}>live API keys</strong> below (find them in your PayMongo dashboard under Developers → API Keys) and we&apos;ll connect Live Mode instantly.
              </p>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#888' }}>Live Secret Key (sk_live_…)</label>
                  <input
                    type="password"
                    className="glass-input w-full text-xs"
                    style={{ fontFamily: 'monospace' }}
                    placeholder="sk_live_..."
                    value={liveSecret}
                    onChange={(e) => setLiveSecret(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#888' }}>Live Public Key (pk_live_… — optional)</label>
                  <input
                    type="text"
                    className="glass-input w-full text-xs"
                    style={{ fontFamily: 'monospace' }}
                    placeholder="pk_live_..."
                    value={livePublic}
                    onChange={(e) => setLivePublic(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
              {connectError && (
                <div className="rounded-lg p-2.5" style={{ background: 'rgba(204,0,0,0.08)', border: '1px solid rgba(204,0,0,0.3)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#ff8080' }}>PayMongo — Live Mode: Connection Failed</p>
                  <p className="text-xs mt-0.5" style={{ color: '#ccc' }}>{connectError}</p>
                </div>
              )}
              <button
                onClick={submitLiveKeys}
                disabled={claimBusy}
                className="btn-primary flex items-center gap-2 text-xs"
              >
                {claimBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Connect Live Account
              </button>
            </div>
          ) : null}
          {pendingLive ? (
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <p className="text-xs" style={{ color: '#ccc' }}>
                Your business is under review by PayMongo. <strong style={{ color: '#fff' }}>We&apos;ll notify you once PayMongo approves your account.</strong>
              </p>
              {childId && (
                <p className="text-xs" style={{ color: '#888' }}>
                  Merchant ref: <span style={{ color: '#ccc', fontFamily: 'monospace' }}>{childId}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => window.open(PAYMONGO_DASHBOARD_URL, '_blank', 'noopener')}
                  className="btn-primary flex items-center gap-2 text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open PayMongo Dashboard
                </button>
                <button
                  onClick={() => { setLiveModal(true); }}
                  className="btn-ghost flex items-center gap-2 text-xs"
                >
                  Retry Verification
                </button>
              </div>
            </div>
          ) : rejected ? (
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(204,0,0,0.07)', border: '1px solid rgba(204,0,0,0.3)' }}>
              <p className="text-xs" style={{ color: '#ccc' }}>
                PayMongo verification was not approved. Please review your submitted details or contact PayMongo support.
              </p>
              <button
                onClick={() => { setLiveModal(true); }}
                className="btn-primary flex items-center gap-2 text-xs"
              >
                Retry Verification
              </button>
            </div>
          ) : (
          <p className="text-xs -mt-2" style={{ color: '#888' }}>
            {mode === 'test'
              ? (connected
                ? `Test transactions use PayMongo test keys — no real money moves.${ownerName ? ` Active account: ${ownerName}.` : ''}`
                : 'Connect Test Mode to simulate payouts under your registered owner account. No real money moves.')
              : (verified
                ? 'Live payments settle directly to your verified PayMongo account via split settlement.'
                : 'Live Mode requires a verified PayMongo child merchant. Start onboarding below.')}
          </p>
          )}

          {/* Action */}
          {mode === 'test' && !connected && (
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(201,118,47,0.06)', border: '1px solid rgba(201,118,47,0.25)' }}>
              <p className="text-xs" style={{ color: '#ccc' }}>
                Test Mode uses platform sandbox credentials to simulate customer checkout and payouts without real money. Click below to enable test mode for this bar.
              </p>
              {testConnectError && (
                <div className="rounded-lg p-2.5" style={{ background: 'rgba(204,0,0,0.08)', border: '1px solid rgba(204,0,0,0.3)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#ff8080' }}>PayMongo — Test Mode: Connection Failed</p>
                  <p className="text-xs mt-0.5" style={{ color: '#ccc' }}>{testConnectError}</p>
                </div>
              )}
              <button onClick={connectTestAuto} disabled={busy || !payouts} className="btn-primary flex items-center gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Enable Test Mode
              </button>
            </div>
          )}
          {mode === 'test' && connected && (
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(201,118,47,0.06)', border: '1px solid rgba(201,118,47,0.25)' }}>
              <p className="text-xs" style={{ color: '#4ade80' }}>Test Mode is active. Transactions use platform sandbox credentials (no real money).</p>
              <button onClick={disconnectTest} disabled={busy} className="btn-ghost flex items-center gap-2 text-xs">
                Disconnect Test Mode
              </button>
            </div>
          )}
          {mode === 'live' && !verified && (
            <button onClick={startLiveOnboarding} disabled={busy} className="btn-primary flex items-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              Start Live Verification
            </button>
          )}
          {(connected || verified) && !pendingLive && !rejected && (
            <p className="text-xs" style={{ color: '#4ade80' }}>✓ Ready to publish packages{mode === 'test' ? ' (labeled Test)' : ''}.</p>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={liveModal}
        onClose={() => setLiveModal(false)}
        onConfirm={confirmLiveRedirect}
        type="warning"
        title="Continue to PayMongo?"
        message="You'll be redirected to PayMongo to verify your business account (new to PayMongo? You'll create one there — already have an account? Just log in). Once approved, come back here to activate Live Mode."
        confirmText="Continue to PayMongo"
      />
    </div>
  );
};

export default PayoutSetupCards;
