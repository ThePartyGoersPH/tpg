import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, X, CheckCircle2 } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import useAuthStore from '../../stores/authStore';
import { barApi } from '../../api/barApi';
import { barRegistrationApi } from '../../api/barRegistrationApi';
import { evaluateChecklist, setRequiredPermits } from '../../utils/registrationChecklist';

// Bar visibility gate: a bar only appears to customers once compliance_status
// is 'approved', or while its 3-day review grace window is still open. Anything
// else keeps it hidden, so the owner must be told why — on every portal page.
const COMPLIANCE_BANNERS = {
  incomplete: {
    title: 'Government Requirements Incomplete',
    body: (labels) => (labels && labels.length
      ? `Your bar is hidden from customers until every required government permit document (${labels.join(', ')}) is submitted and approved. Open Complete Requirements to see exactly what is still missing.`
      : 'Your bar is hidden from customers until every required government permit document is submitted and approved. Open Complete Requirements to see exactly what is still missing.'),
    cta: 'Complete Requirements',
    tab: 'submit',
    accent: '#f59e0b',
    accentHover: '#d97706',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.3)',
  },
  pending_review: {
    title: 'Registration Pending Review',
    body: 'Your documents are being reviewed by our team. Your bar will become visible to customers once approved.',
    cta: 'View Submission',
    tab: 'my',
    accent: '#3b82f6',
    accentHover: '#2563eb',
    bg: 'rgba(59,130,246,0.1)',
    border: 'rgba(59,130,246,0.3)',
  },
  rejected: {
    title: 'Registration Not Approved',
    body: 'Your bar remains hidden from customers. Please update your submission and resubmit it for review.',
    cta: 'Update Registration',
    tab: 'submit',
    accent: '#CC0000',
    accentHover: '#a30000',
    bg: 'rgba(204,0,0,0.1)',
    border: 'rgba(204,0,0,0.35)',
  },
  hidden_incomplete: {
    title: 'Bar Auto-Hidden — Requirements Not Completed',
    body: 'Your bar was hidden from customers because the requirements were not completed within the 3-day review window. Submit your complete requirements to be reviewed again.',
    cta: 'Complete Requirements',
    tab: 'submit',
    accent: '#CC0000',
    accentHover: '#a30000',
    bg: 'rgba(204,0,0,0.1)',
    border: 'rgba(204,0,0,0.35)',
  },
  // Success state: once Super Admin approves the registration the review
  // banner and its 3-day countdown disappear and this takes their place.
  approved: {
    title: 'Bar Approved',
    body: '✅ Your bar is approved and fully visible to customers.',
    cta: 'View Submission',
    tab: 'my',
    accent: '#10b981',
    accentHover: '#059669',
    bg: 'rgba(16,185,129,0.1)',
    border: 'rgba(16,185,129,0.35)',
  },
};

function formatRemaining(target, reference) {
  if (!target) return null;
  const ms = new Date(target).getTime() - reference;
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const approvalStorageKey = (barId) => `approval_banner_dismissed:${barId}`;
// The stored value is the approval it was written for (compliance_reviewed_at).
// When the bar is approved again the stamp no longer matches, so a dismissed
// banner re-arms for the new approval instead of staying hidden forever.
function readLocalApprovalDismiss(barId, stamp) {
  if (!barId) return false;
  try {
    const stored = localStorage.getItem(approvalStorageKey(barId));
    return Boolean(stored) && (!stamp || stored === stamp);
  } catch (e) { return false; }
}
function writeLocalApprovalDismiss(barId, stamp) {
  if (!barId) return;
  try { localStorage.setItem(approvalStorageKey(barId), stamp || '1'); } catch (e) { /* storage unavailable */ }
}

const DashboardLayout = () => {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar.collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [showConfigAlert, setShowConfigAlert] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [barDetails, setBarDetails] = useState(null);
  // Live registration checklist (same evaluator as the Bar Registration page).
  const [requirements, setRequirements] = useState(null);
  // Labels of the required permit documents (from the backend config) so the
  // banner copy can name them without a second hardcoded list.
  const [permitLabels, setPermitLabels] = useState([]);
  // "Bar Approved" acknowledgement: hides the success banner for this session
  // immediately on dismiss, before the server round-trip confirms it.
  const [approvalBannerHidden, setApprovalBannerHidden] = useState(false);
  const approvalSeenRef = useRef(false);
  const { user, refreshSession } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isOwner = user?.role === 'bar_owner';

  // Keep permissions/role live: backend re-resolves per request, so refetching
  // here (on each route change) makes permission/role changes apply immediately
  // without a re-login.
  useEffect(() => {
    refreshSession();
  }, [location.pathname, refreshSession]);

  useEffect(() => {
    const checkBarConfig = async () => {
      if (!isOwner) return;
      try {
        // silentError: background config probe on mount — it only drives an
        // optional alert banner and already logs here, so it must not toast.
        const { data } = await barApi.getDetails({ silentError: true });
        const bar = data.data || data;
        setBarDetails(bar);
        
        // Check if payment methods are configured
        const hasGcashConfig = bar.gcash_number && bar.gcash_account_name;
        const hasOnlinePayment = bar.accept_online_payment === 1 || bar.accept_online_payment === true;
        const hasMinDeposit = bar.minimum_reservation_deposit !== null && bar.minimum_reservation_deposit !== undefined;
        
        // Show alert if any critical config is missing
        if (!hasGcashConfig || !hasOnlinePayment || !hasMinDeposit) {
          setShowConfigAlert(true);
        }
      } catch (err) {
        console.error('Failed to check bar config:', err);
      }
    };
    
    checkBarConfig();
  }, [isOwner]);

  // Portal-wide registration completeness check. Uses the same evaluator as
  // the Bar Registration checklist and re-reads the saved state on every
  // navigation, so finishing the requirements clears the alert immediately.
  useEffect(() => {
    if (!isOwner) return undefined;
    let alive = true;
    barRegistrationApi.current({ silentError: true })
      .then((r) => {
        const d = r.data?.data;
        if (!alive || !d) return;
        const permits = Array.isArray(d.required_permits) ? d.required_permits : [];
        setRequiredPermits(permits);
        setPermitLabels(permits.map((permit) => permit.label));
        setRequirements(evaluateChecklist({ saved: { fields: d.fields, documents: d.documents }, permits }));
      })
      .catch(() => { if (alive) setRequirements(null); });
    return () => { alive = false; };
  }, [isOwner, location.pathname]);

  const complianceStatus = isOwner ? barDetails?.compliance_status : null;
  const rejectionReason = barDetails?.compliance_rejection_reason;
  const graceExpiresAt = barDetails?.temp_visible_until;
  const remaining = formatRemaining(graceExpiresAt, now);
  const barId = barDetails?.id || null;
  const complianceReviewedAt = barDetails?.compliance_reviewed_at || null;
  // The owner has seen / dismissed the "Bar Approved" banner: server flag
  // (bars.approval_banner_dismissed), this session's dismiss, or the
  // local-storage fallback written when the save could not reach the server.
  // Applies ONLY to the positive approved state — the action banners
  // (pending review / incomplete / rejected / auto-hidden) stay permanent.
  const approvalAcknowledged = Boolean(
    approvalBannerHidden
    || Number(barDetails?.approval_banner_dismissed) === 1
    || readLocalApprovalDismiss(barId, complianceReviewedAt)
  );
  // Requirements still missing (fields and/or permit documents). An approved
  // bar is already published, so it never raises this alert.
  const registrationIncomplete = Boolean(requirements && !requirements.isComplete && complianceStatus !== 'approved');
  const complianceBanner =
    (complianceStatus === 'approved' && approvalAcknowledged)
      ? null
      : complianceStatus === 'rejected'
        ? {
            ...COMPLIANCE_BANNERS.rejected,
            body: rejectionReason
              ? `Reason: ${rejectionReason} Your bar remains hidden from customers. Please update your submission and resubmit it for review.`
              : COMPLIANCE_BANNERS.rejected.body,
          }
        // The portal-wide "registration incomplete" alert already covers this
        // case with the actionable copy — avoid stacking two warnings.
        : (complianceStatus === 'incomplete' && registrationIncomplete)
          ? null
          : COMPLIANCE_BANNERS[complianceStatus] || null;
  const pendingBody =
    complianceStatus === 'pending_review'
      ? (remaining && remaining !== '00:00:00'
          ? `Your documents are under review. Your bar is temporarily visible to customers while you wait — time left: ${remaining}. It will be hidden automatically if the requirements are not approved in time.`
          : 'Your documents are under review. Your bar is currently hidden from customers.')
      : null;
  const complianceBody = pendingBody
    || (typeof complianceBanner?.body === 'function' ? complianceBanner.body(permitLabels) : complianceBanner?.body);

  // Live countdown for the pending-review grace window.
  useEffect(() => {
    if (complianceStatus !== 'pending_review') return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [complianceStatus]);

  // Owner dismissed the success banner with the X: hide it immediately and
  // persist the choice (server flag; local storage covers a failed request).
  const dismissApprovalBanner = () => {
    setApprovalBannerHidden(true);
    writeLocalApprovalDismiss(barId, complianceReviewedAt);
    barApi.dismissApprovalBanner({ silentError: true }).catch(() => { /* fallback already stored */ });
  };

  // Auto "seen": the first visit after approval records the acknowledgement so
  // the banner is shown once instead of on every dashboard load. It stays on
  // screen for this visit — only the next one drops it.
  useEffect(() => {
    if (!isOwner || complianceStatus !== 'approved' || approvalAcknowledged) return;
    if (approvalSeenRef.current) return;
    approvalSeenRef.current = true;
    barApi.dismissApprovalBanner({ silentError: true }).catch(() => { writeLocalApprovalDismiss(barId, complianceReviewedAt); });
  }, [isOwner, complianceStatus, approvalAcknowledged, barId, complianceReviewedAt]);

  return (
    <div className="min-h-screen" style={{ background: '#0A0A0A' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(prev => {
        const next = !prev;
        try { localStorage.setItem('sidebar.collapsed', String(next)); } catch (e) { /* storage unavailable */ }
        return next;
      })} />
      <div
        className={`transition-all duration-300 ${
          collapsed ? 'ml-[68px]' : 'ml-[260px]'
        }`}
      >
        <Header />

        {/* Portal-wide registration completeness alert — lives in the app shell
            so it shows on every page (Dashboard, Bar Management, Menu, Packages,
            Inventory, HR, Customers, Compliance, …) while any required field or
            permit document is still missing. Non-dismissible by design. */}
        {registrationIncomplete && (
          <div
            data-testid="registration-incomplete-banner"
            className="mx-6 mt-4 mb-2 p-4 rounded-lg flex items-start gap-3"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(204,0,0,0.45)' }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
            <div className="flex-1">
              <p className="text-sm" style={{ color: '#ccc' }} data-testid="registration-incomplete-body">
                ⚠️ Your bar registration is incomplete. Please submit the missing requirements to avoid your bar being hidden from customers.
                {(requirements?.missingDocs || []).length > 0 && (
                  <> Missing: {(requirements.missingDocs || []).map((item) => item.label).join(', ')}.</>
                )}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigate('/bar-registration', { state: { tab: 'submit' } })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: '#CC0000', color: '#fff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#a30000'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#CC0000'; }}
                >
                  Complete Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Compliance (government requirements) banner — drives bar visibility
            for customers. The action banners (pending review / incomplete /
            rejected) are persistent and non-dismissible: the status cannot be
            ignored and the countdown must stay visible. Only the positive
            "Bar Approved" state carries the X in the top-right corner. */}
        {complianceBanner && (
          <div
            data-testid="compliance-banner"
            className="relative mx-6 mt-4 mb-2 p-4 rounded-lg flex items-start gap-3"
            style={{ background: complianceBanner.bg, border: `1px solid ${complianceBanner.border}` }}>
            {complianceStatus === 'approved'
              ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: complianceBanner.accent }} />
              : <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: complianceBanner.accent }} />}
            {complianceStatus === 'approved' && (
              <button
                type="button"
                onClick={dismissApprovalBanner}
                aria-label="Dismiss approval banner"
                title="Dismiss"
                data-testid="dismiss-approval-banner"
                className="absolute top-2 right-2 p-1 rounded transition-colors"
                style={{ color: complianceBanner.accent }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = complianceBanner.accent; }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <div className="flex-1">
              <h4 className="font-semibold text-white text-sm mb-1">{complianceBanner.title}</h4>
              <p className="text-sm mb-3" style={{ color: '#ccc' }} data-testid="compliance-banner-body">
                {complianceBody}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/bar-registration', { state: { tab: complianceBanner.tab } })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: complianceBanner.accent, color: '#fff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = complianceBanner.accentHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = complianceBanner.accent; }}
                >
                  {complianceBanner.cta}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Alert Banner */}
        {showConfigAlert && (
          <div className="mx-6 mt-4 mb-2 p-4 rounded-lg flex items-start gap-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
            <div className="flex-1">
              <h4 className="font-semibold text-white text-sm mb-1">Payment Configuration Required</h4>
              <p className="text-sm mb-3" style={{ color: '#ccc' }}>
                Please configure your payment settings to accept online reservations and payments from customers.
              </p>
              <div className="flex gap-2">
                <button 
                  onClick={() => { navigate('/bar-management'); setShowConfigAlert(false); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: '#f59e0b', color: '#fff' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#d97706'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#f59e0b'; }}
                >
                  Configure Now
                </button>
                <button 
                  onClick={() => setShowConfigAlert(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#888' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#888'; }}
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button 
              onClick={() => setShowConfigAlert(false)}
              className="p-1 rounded transition-colors flex-shrink-0"
              style={{ color: '#666' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
