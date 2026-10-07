import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { registrationsAPI, complianceAPI } from '../api/services';
import { formatDateTime } from '../utils/formatters';
import { Eye, FileText, Download, Loader2, CheckCircle, XCircle, RefreshCw, ShieldCheck, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Registrations() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('registrations');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionModal, setActionModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedReg, setSelectedReg] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => { fetchRegistrations(); }, [statusFilter, pagination.page]);

  // Deep-link from notifications: /registrations?open=<id> opens that
  // specific bar's registration review modal directly.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId) {
      openRegistrationById(openId);
      searchParams.delete('open');
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: pagination.limit, status: statusFilter };
      const res = await registrationsAPI.list(params);
      if (res.data.success) { setRegistrations(res.data.data?.registrations || []); setPagination(p => ({ ...p, ...res.data.data?.pagination })); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id) => {
    try { const r = await registrationsAPI.approve(id); if (r.data.success) { toast.success('Registration approved!'); setActionModal(null); fetchRegistrations(); } }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };
  const handleReject = async (id) => {
    if (!rejectReason.trim()) { toast.error('Provide a reason'); return; }
    try { const r = await registrationsAPI.reject(id, { reason: rejectReason }); if (r.data.success) { toast.success('Registration rejected'); setActionModal(null); setRejectReason(''); fetchRegistrations(); } }
    catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const openRegistration = (registration) => setSelectedReg(registration);

  // Used by the Compliance Queue: jump into the full registration review modal
  // (the same one with Permit Checking) for the bar's linked submission.
  const openRegistrationById = async (registrationId) => {
    try {
      const response = await registrationsAPI.get(registrationId);
      const registration = response.data.data?.registration;
      if (!registration) { toast.error('Linked registration not found'); return; }
      setView('registrations');
      setSelectedReg(registration);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load registration');
    }
  };

  const statusColors = {
    pending:'bg-amber-500/20 text-amber-400',
    pending_email_verification:'bg-amber-500/20 text-amber-400',
    pending_admin_approval:'bg-orange-500/20 text-orange-400',
    approved:'bg-green-500/20 text-green-400',
    rejected:'bg-red-500/20 text-red-400',
  };

  const statusLabel = (s) => {
    if (s === 'pending_email_verification') return 'EMAIL VERIFICATION';
    if (s === 'pending_admin_approval') return 'PENDING REVIEW';
    return s?.toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Business Registrations</h1>
        <p className="text-white/40 text-sm mt-1">Review and process new bar owner applications</p>
      </div>

      <div className="flex gap-2">
        {[['registrations', 'Business Registrations', ClipboardList], ['compliance', 'Compliance Queue', ShieldCheck]].map((tab) => {
          const [k, label, Icon] = tab;
          return (
            <button key={k} onClick={() => setView(k)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${view === k ? 'bg-red-600 text-white' : 'bg-white/[0.06] text-white/50 hover:text-white/80 border border-white/[0.08]'}`}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          );
        })}
      </div>

      {view === 'compliance' && <ComplianceQueue onOpenRegistration={openRegistrationById} />}

      {view === 'registrations' && (
      <>
      <div className="flex gap-2">
        {['pending','approved','rejected','all'].map(s=>(
          <button key={s} onClick={()=>{setStatusFilter(s);setPagination(p=>({...p,page:1}))}} className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${statusFilter===s?'bg-red-600 text-white':'bg-white/[0.06] text-white/50 hover:text-white/80 border border-white/[0.08]'}`}>{s}</button>
        ))}
      </div>

      <div className="glass-table">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="border-b border-white/[0.06]">
              {['Business','Owner','Contact','Status','Submitted','Actions'].map(h=>(
                <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/30 uppercase ${h==='Actions'?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
              ) : registrations.length === 0 ? (
                <tr><td colSpan="6" className="px-5 py-12 text-center text-white/30">No registrations found</td></tr>
              ) : registrations.map(reg=>(
                <tr key={reg.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium text-white">{reg.business_name}</div>
                    <div className="text-[10px] text-white/30">{reg.business_category || 'N/A'}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-xs text-white/70">{reg.owner_first_name} {reg.owner_last_name}</div>
                    <div className="text-[10px] text-white/30">{reg.owner_email}</div>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/50">{reg.business_phone||reg.owner_phone||'N/A'}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[reg.status]||'bg-gray-500/20 text-gray-400'}`}>{statusLabel(reg.status)}</span></td>
                  <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(reg.created_at)}</td>
                  <td className="px-5 py-3 text-right flex items-center justify-end gap-1">
                    <button onClick={()=>openRegistration(reg)} className="text-white/30 hover:text-white/70 p-1"><Eye className="h-3.5 w-3.5"/></button>
                    {['pending','pending_email_verification','pending_admin_approval'].includes(reg.status)&&(
                      <>
                        <button onClick={()=>setActionModal({type:'approve',reg})} className="text-xs font-medium px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition">Approve</button>
                        <button onClick={()=>setActionModal({type:'reject',reg})} className="text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.total_pages > 1 && (
          <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
            <p className="text-xs text-white/40">Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)</p>
            <div className="flex gap-2">
              <button disabled={pagination.page<=1} onClick={()=>setPagination(p=>({...p,page:p.page-1}))} className="btn-ghost text-xs px-3 py-1 disabled:opacity-30">Prev</button>
              <button disabled={pagination.page>=pagination.total_pages} onClick={()=>setPagination(p=>({...p,page:p.page+1}))} className="btn-ghost text-xs px-3 py-1 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>

      {selectedReg && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Registration Details</h3>
              <button onClick={()=>setSelectedReg(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Business Name', selectedReg.business_name],
                ['Category', selectedReg.business_category],
                ['Address', selectedReg.business_address],
                ['City', selectedReg.business_city],
                ['Phone', selectedReg.business_phone],
                ['Email', selectedReg.business_email],
                ['Owner', `${selectedReg.owner_first_name} ${selectedReg.owner_last_name}`],
                ['Owner Email', selectedReg.owner_email],
                ['Owner Phone', selectedReg.owner_phone],
                ['Status', selectedReg.status],
                ['Submitted', formatDateTime(selectedReg.created_at)],
                ...(selectedReg.reviewed_at ? [['Reviewed', formatDateTime(selectedReg.reviewed_at)]] : []),
                ...(selectedReg.rejection_reason ? [['Rejection Reason', selectedReg.rejection_reason]] : []),
              ].map(([k,v])=>(
                <div key={k} className="flex justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-white/40">{k}</span>
                  <span className="text-white/80 font-medium capitalize text-right">{v || 'N/A'}</span>
                </div>
              ))}
            </div>
            
            <PermitCheckingPanel registrationId={selectedReg.id} />
            <button onClick={()=>setSelectedReg(null)} className="btn-ghost w-full mt-4 text-sm">Close</button>
          </div>
        </div>
      )}

      {actionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">{actionModal.type==='approve'?'Approve Registration':'Reject Registration'}</h3>
            <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs space-y-1">
              <div className="flex justify-between"><span className="text-white/40">Business</span><span className="text-white/80">{actionModal.reg.business_name}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Owner</span><span className="text-white/80">{actionModal.reg.owner_first_name} {actionModal.reg.owner_last_name}</span></div>
            </div>
            {actionModal.type==='approve'&&(
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">This will create a new bar owner account and bar.</div>
            )}
            {actionModal.type==='reject'&&(
              <div className="mb-4"><label className="block text-xs font-medium text-white/50 mb-1">Rejection Reason *</label><textarea rows="3" className="glass-input w-full text-sm" placeholder="Reason..." value={rejectReason} onChange={e=>setRejectReason(e.target.value)}/></div>
            )}
            <div className="flex gap-3">
              <button onClick={()=>{setActionModal(null);setRejectReason('')}} className="btn-ghost flex-1 text-sm">Cancel</button>
              <button onClick={()=>actionModal.type==='approve'?handleApprove(actionModal.reg.id):handleReject(actionModal.reg.id)} className={`flex-1 text-sm rounded-lg py-2 font-medium text-white ${actionModal.type==='approve'?'bg-green-600 hover:bg-green-700':'bg-red-600 hover:bg-red-700'}`}>{actionModal.type==='approve'?'Approve':'Reject'}</button>
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

// ─── Shared document review panel ────────────────────────────────────────────
// Submitted Documents + Permit Checking for one registration. Used by the
// registration detail modal AND the compliance queue modal so admins always
// review the same file-first statuses (missing / pending / approved / rejected).
function PermitCheckingPanel({ registrationId }) {
  const [documentChecks, setDocumentChecks] = useState([]);
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [checkingDocuments, setCheckingDocuments] = useState(false);
  // In-app review-note dialog. Replaces the old native window.prompt so every
  // Approve / Reject action in this panel opens a styled modal instead of the
  // browser's "localhost:5175 says…" box.
  const [noteModal, setNoteModal] = useState(null); // { documentType, label, decision }
  const [reviewNote, setReviewNote] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  const loadChecks = async () => {
    setLoadingChecks(true);
    try {
      const response = await registrationsAPI.documentChecks(registrationId);
      setDocumentChecks(response.data.data?.documents || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load permit checks');
    } finally {
      setLoadingChecks(false);
    }
  };

  useEffect(() => { loadChecks(); }, [registrationId]);

  const runAutomaticCheck = async () => {
    setCheckingDocuments(true);
    try {
      const response = await registrationsAPI.automaticDocumentCheck(registrationId);
      setDocumentChecks(response.data.data?.documents || []);
      toast.success('Automatic permit check completed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Automatic check failed');
    } finally {
      setCheckingDocuments(false);
    }
  };

  // Opens the styled confirm dialog for one permit row. Kept as the single
  // entry point so the ✓ and ✗ buttons of every permit behave identically.
  const openReviewModal = (document, decision) => {
    if (!document.file_present || !document.file_exists) {
      toast.error('No viewable file is on record for this permit — it cannot be reviewed.');
      return;
    }
    setReviewNote('');
    setNoteModal({
      documentType: document.document_type,
      label: document.label || document.document_type.replaceAll('_', ' '),
      decision,
    });
  };

  const updateDocumentCheck = async (documentType, decision, notes = '') => {
    try {
      const response = await registrationsAPI.checkDocument(registrationId, documentType, { decision, notes });
      const saved = response.data.data?.document;
      if (saved) {
        setDocumentChecks((prev) => prev.map((document) => (document.document_type === documentType ? saved : document)));
      }
      const refreshed = await registrationsAPI.documentChecks(registrationId);
      setDocumentChecks(refreshed.data.data?.documents || []);
      toast.success(decision === 'approved' ? 'Permit approved' : decision === 'rejected' ? 'Permit rejected' : 'Permit flagged for review');
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Permit review failed');
      try {
        const refreshed = await registrationsAPI.documentChecks(registrationId);
        setDocumentChecks(refreshed.data.data?.documents || []);
      } catch { /* keep last known state */ }
      return false;
    }
  };

  const confirmReview = async (decisionOverride) => {
    if (!noteModal || savingDecision) return;
    const decision = decisionOverride || noteModal.decision;
    if (!decision) return;
    setSavingDecision(true);
    try {
      const saved = await updateDocumentCheck(noteModal.documentType, decision, reviewNote.trim());
      if (saved) {
        setNoteModal(null);
        setReviewNote('');
      }
    } finally {
      setSavingDecision(false);
    }
  };

  return (
    <>
      {documentChecks.some((document) => document.file_present && document.file_url) && (
        <div className="mt-4 pt-4 border-t border-white/[0.08]">
          <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Submitted Documents</h4>
          <div className="space-y-2">
            {documentChecks.filter((document) => document.file_present && document.file_url).map((document) => (
              <a key={document.document_type} href={docUrl(document.file_url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition group">
                <FileText className="h-4 w-4 text-blue-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/80">{document.label}</p>
                  <p className="text-[10px] text-white/40 truncate">{document.file_name}</p>
                </div>
                <Download className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60" />
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-white/[0.08]">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">Permit Checking</h4>
          <button onClick={runAutomaticCheck} disabled={checkingDocuments} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-300 text-[11px] font-semibold disabled:opacity-50">
            {checkingDocuments ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Automatic Check
          </button>
        </div>
        {documentChecks.length === 0 ? (
          <p className="text-xs text-white/40">{loadingChecks ? 'Loading permits…' : 'Run an automatic check or review each permit manually.'}</p>
        ) : (
          <div className="space-y-2">
            {documentChecks.map((document) => {
              const canReview = Boolean(document.file_present && document.file_exists);
              const status = (document.status || 'pending').toLowerCase();
              // Once a permit has a final decision its review actions are gone —
              // only PENDING rows keep the ✓ / ✗ buttons.
              const decided = status === 'approved' || status === 'rejected';
              const statusClass = status === 'approved' ? 'text-green-400'
                : status === 'rejected' ? 'text-red-400'
                : status === 'missing' ? 'text-gray-400'
                : 'text-amber-400';
              const detail = canReview
                ? `${document.check_method || 'not checked'} · ${document.file_name || 'file on record'}`
                : document.file_present
                  ? 'file missing from storage'
                  : 'not checked · no file uploaded';
              return (
                <div key={document.document_type} className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-2.5" data-testid={`permit-${document.document_type}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-white/80">{document.label || document.document_type.replaceAll('_', ' ')}</span>
                    <span className={`text-[10px] uppercase font-bold ${statusClass}`}>{status}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {canReview ? (
                        <>
                          <a href={docUrl(document.file_url)} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-300 hover:text-blue-200 hover:underline"
                            title={`View ${document.label}`}>
                            <Eye className="h-3 w-3" /> View Document
                          </a>
                          <span className="text-[10px] text-white/30 truncate">{detail}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-white/40">{document.file_present ? 'File missing from storage' : 'No file uploaded'}</span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {decided ? (
                        <button onClick={() => openReviewModal(document, null)}
                          className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-semibold text-white/45 hover:text-white/80 hover:bg-white/[0.06]"
                          title={`Decision: ${status.toUpperCase()} — open the review dialog to change it.`}
                          data-testid={`change-${document.document_type}`}>
                          <RefreshCw className="h-3 w-3" /> Change
                        </button>
                      ) : (
                        <>
                          <button onClick={() => openReviewModal(document, 'approved')} disabled={!canReview}
                            className={`p-1 rounded ${canReview ? 'text-green-400 hover:bg-green-500/15' : 'text-white/20 cursor-not-allowed'}`}
                            title={canReview ? 'Approve document' : 'No viewable file — approval blocked'}
                            data-testid={`approve-${document.document_type}`}>
                            <CheckCircle className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => openReviewModal(document, 'rejected')} disabled={!canReview}
                            className={`p-1 rounded ${canReview ? 'text-red-400 hover:bg-red-500/15' : 'text-white/20 cursor-not-allowed'}`}
                            title={canReview ? 'Reject document' : 'No viewable file to reject'}
                            data-testid={`reject-${document.document_type}`}>
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {document.notes && <p className="text-[10px] text-white/40 mt-1">{document.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Portaled to <body>: .glass-modal uses backdrop-filter, which would
          otherwise become the containing block for this position:fixed dialog
          and push it off-screen when the permit list is scrolled. */}
      {noteModal && createPortal((
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => { if (!savingDecision) setNoteModal(null); }} data-testid="review-note-modal-backdrop">
          <div className="glass-modal p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()} data-testid="review-note-modal">
            <div className="flex items-start justify-between gap-4 mb-1">
              <h3 className="text-lg font-bold text-white" data-testid="review-note-title">
                {noteModal.decision === null
                  ? `Change decision — ${noteModal.label}`
                  : `${noteModal.decision === 'approved' ? 'Approve' : 'Reject'} ${noteModal.label}?`}
              </h3>
              <button onClick={() => { if (!savingDecision) setNoteModal(null); }} disabled={savingDecision}
                aria-label="Close" className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>
            <p className="text-xs text-white/40 mb-4">
              {noteModal.decision === null
                ? 'This permit already has a decision. Picking a new one below replaces the previous review.'
                : noteModal.decision === 'approved'
                  ? 'This marks the permit as reviewed and accepted for this registration.'
                  : 'This marks the permit as rejected for this registration.'}
            </p>
            <div className="mb-4">
              <label htmlFor="permit-review-note" className="block text-xs font-medium text-white/50 mb-1">Review note (optional)</label>
              <textarea id="permit-review-note" data-testid="review-note-input" rows="3"
                className="glass-input w-full text-sm"
                placeholder="Add a note for this decision..."
                value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { if (!savingDecision) { setNoteModal(null); setReviewNote(''); } }}
                disabled={savingDecision} className="btn-ghost flex-1 text-sm" data-testid="review-note-cancel">Cancel</button>
              {noteModal.decision === null ? (
                <>
                  <button onClick={() => confirmReview('approved')} disabled={savingDecision} data-testid="review-note-approve"
                    className="flex-1 text-sm rounded-lg py-2 font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                    {savingDecision ? 'Saving…' : 'Approve'}
                  </button>
                  <button onClick={() => confirmReview('rejected')} disabled={savingDecision} data-testid="review-note-reject"
                    className="flex-1 text-sm rounded-lg py-2 font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                    {savingDecision ? 'Saving…' : 'Reject'}
                  </button>
                </>
              ) : (
                <button onClick={() => confirmReview()} disabled={savingDecision} data-testid="review-note-confirm"
                  className={`flex-1 text-sm rounded-lg py-2 font-medium text-white disabled:opacity-50 ${noteModal.decision === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  {savingDecision ? 'Saving…' : (noteModal.decision === 'approved' ? 'Approve' : 'Reject')}
                </button>
              )}
            </div>
          </div>
        </div>
      ), document.body)}
    </>
  );
}

// ─── Compliance Queue: bars hidden from customers until approved ─────────────
const COMPLIANCE_COLORS = {
  incomplete: 'bg-amber-500/20 text-amber-400',
  pending_review: 'bg-blue-500/20 text-blue-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
};

const COMPLIANCE_LABELS = {
  incomplete: 'INCOMPLETE',
  pending_review: 'PENDING REVIEW',
  approved: 'APPROVED',
  rejected: 'REJECTED',
};

const docUrl = (p) =>
  !p ? null : p.startsWith('http') ? p : `${import.meta.env.VITE_API_BASE_URL || 'https://api.thepartygoers.fun'}/${p}`;

// Required-document count comes from the backend (config/requiredPermits.js,
// the same list the Bar Owner form renders) — never hardcode it here.
const requiredCount = (row) =>
  typeof row?.required_count === 'number'
    ? row.required_count
    : (row?.documents || []).length;

const uploadedCount = (bar) =>
  typeof bar?.uploaded_count === 'number'
    ? bar.uploaded_count
    : (bar?.documents || []).filter((d) => d.uploaded).length;

const incompleteDocumentsMessage = (uploaded, required) =>
  `Cannot approve — only ${uploaded} of ${required} required documents have been submitted.`;

const isApprovable = (bar) => uploadedCount(bar) >= requiredCount(bar);

function ComplianceQueue({ onOpenRegistration }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending_review');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 0 });
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null); // { type: 'approve' | 'reject', bar }
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await complianceAPI.queue({ status, page, limit: pagination.limit });
      if (res.data.success) {
        setRows(res.data.data?.bars || []);
        setPagination(p => ({ ...p, ...res.data.data?.pagination }));
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Unable to load compliance queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, [status]);

  const decide = async () => {
    if (!confirm) return;
    const bar = confirm.bar;
    const revoking = confirm.type === 'reject' && bar.compliance_status === 'approved';
    if (confirm.type === 'approve' && !isApprovable(bar)) {
      toast.error(incompleteDocumentsMessage(uploadedCount(bar), requiredCount(bar)));
      return;
    }
    if (confirm.type === 'reject' && !reason.trim()) { toast.error(revoking ? 'Revocation reason is required' : 'Rejection reason is required'); return; }
    setBusy(true);
    try {
      if (confirm.type === 'approve') {
        const r = await complianceAPI.approve(bar.id);
        if (r.data.success) toast.success(`${bar.name} approved and published`);
      } else {
        const r = await complianceAPI.reject(bar.id, { reason: reason.trim() });
        if (r.data.success) toast.success(revoking ? `${bar.name} approval revoked` : `${bar.name} rejected`);
      }
      setConfirm(null); setReason(''); setDetail(null);
      load(pagination.page);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {['pending_review', 'approved', 'rejected', 'incomplete', 'all'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPagination(p => ({ ...p, page: 1 })); }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${status === s ? 'bg-red-600 text-white' : 'bg-white/[0.06] text-white/50 hover:text-white/80 border border-white/[0.08]'}`}>{s.replace('_', ' ')}</button>
        ))}
      </div>

      <div className="glass-table">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="border-b border-white/[0.06]">
              {['Bar', 'Owner', 'Submitted', 'Status', 'Documents', 'Actions'].map(h => (
                <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-white/30 uppercase ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="6" className="px-5 py-12 text-center text-white/30">No bars with this compliance status</td></tr>
              ) : rows.map(bar => {
                const uploaded = uploadedCount(bar);
                const required = requiredCount(bar);
                const complete = uploaded >= required;
                const revoked = bar.compliance_status === 'approved';
                return (
                  <tr key={bar.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-white">{bar.name}</div>
                      <div className="text-[10px] text-white/30">{bar.city || bar.address || 'N/A'}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-white/70">{bar.owner_name || 'N/A'}</div>
                      <div className="text-[10px] text-white/30">{bar.owner_email || ''}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(bar.submitted_at)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${COMPLIANCE_COLORS[bar.compliance_status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {COMPLIANCE_LABELS[bar.compliance_status] || bar.compliance_status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-white/50" title={complete ? 'All required documents submitted' : incompleteDocumentsMessage(uploaded, required)}>
                      {uploaded} / {required} uploaded
                    </td>
                    <td className="px-5 py-3 text-right flex items-center justify-end gap-1">
                      <button onClick={() => setDetail(bar)} className="text-white/30 hover:text-white/70 p-1" title="View documents"><Eye className="h-3.5 w-3.5" /></button>
                      {bar.compliance_status !== 'approved' && (
                        <button onClick={() => { setConfirm({ type: 'approve', bar }); setReason(''); }}
                          title={complete ? 'Approve compliance' : incompleteDocumentsMessage(uploaded, required)}
                          className={`text-xs font-medium px-2 py-1 rounded transition ${complete ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-green-500/10 text-green-400/60'}`}>Approve</button>
                      )}
                      {bar.compliance_status !== 'rejected' && (
                        <button onClick={() => { setConfirm({ type: 'reject', bar }); setReason(''); }}
                          title={revoked ? 'Revoke compliance approval' : 'Reject compliance'}
                          className="text-xs font-medium px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">{revoked ? 'Revoke' : 'Reject'}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pagination.total_pages > 1 && (
          <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
            <p className="text-xs text-white/40">Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)</p>
            <div className="flex gap-2">
              <button disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)} className="btn-ghost text-xs px-3 py-1 disabled:opacity-30">Prev</button>
              <button disabled={pagination.page >= pagination.total_pages} onClick={() => load(pagination.page + 1)} className="btn-ghost text-xs px-3 py-1 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="glass-modal p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{detail.name} — Compliance</h3>
              <button onClick={() => setDetail(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Status', COMPLIANCE_LABELS[detail.compliance_status] || detail.compliance_status],
                ['Documents', `${uploadedCount(detail)} / ${requiredCount(detail)} uploaded`],
                ['Owner', detail.owner_name || 'N/A'],
                ['Owner Email', detail.owner_email],
                ['Address', [detail.address, detail.city].filter(Boolean).join(', ')],
                ['Submitted', formatDateTime(detail.submitted_at)],
                ['Reviewed', formatDateTime(detail.compliance_reviewed_at)],
                ['Reviewed By', detail.reviewer_name],
                ['Bar Status', `${detail.status}${detail.lifecycle_status ? ` / ${detail.lifecycle_status}` : ''}`],
                ['Linked Registration', detail.registration_id ? `#${detail.registration_id}` : 'None on record'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-white/[0.04]">
                  <span className="text-white/40">{k}</span>
                  <span className="text-white/80 font-medium text-right">{v || 'N/A'}</span>
                </div>
              ))}
            </div>
            {detail.compliance_rejection_reason && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                <span className="font-semibold">Rejection reason:</span> {detail.compliance_rejection_reason}
              </div>
            )}

            {detail.registration_id ? (
              <PermitCheckingPanel registrationId={detail.registration_id} />
            ) : (
              <>
                <div className="mt-4 pt-4 border-t border-white/[0.08]">
                  <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Permit Documents</h4>
                  <div className="space-y-2">
                    {(detail.documents || []).map(doc => {
                      const url = docUrl(doc.file_path);
                      return (
                        <div key={doc.document_type} className={`flex items-center gap-2 p-2.5 rounded-lg border transition ${url ? 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.08] group' : 'bg-white/[0.02] border-white/[0.04] opacity-60'}`}>
                          <FileText className={`h-4 w-4 ${doc.verification_status === 'approved' ? 'text-green-400' : doc.verification_status === 'rejected' ? 'text-red-400' : 'text-amber-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white/80">{doc.label}</p>
                            <p className="text-[10px] text-white/40 truncate">{url ? String(doc.file_path).split('/').pop() : 'Not uploaded'}{doc.uploaded_at ? ` · ${formatDateTime(doc.uploaded_at)}` : ''}</p>
                          </div>
                          {url && (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-white/30 group-hover:text-white/60" title="Open document">
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-white/40">No linked registration record — permit checking is unavailable for this bar.</p>
              </>
            )}

            {detail.registration_id && onOpenRegistration && (
              <button onClick={() => { const registrationId = detail.registration_id; setDetail(null); onOpenRegistration(registrationId); }}
                className="w-full mt-4 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 text-xs font-semibold transition"
                title="Open the full registration detail and document review modal">
                <ClipboardList className="h-3.5 w-3.5" /> Open full registration review
              </button>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setDetail(null)} className="btn-ghost flex-1 text-sm">Close</button>
              {detail.compliance_status !== 'approved' && (
                <button onClick={() => { setConfirm({ type: 'approve', bar: detail }); setReason(''); }}
                  title={isApprovable(detail) ? 'Approve compliance' : incompleteDocumentsMessage(uploadedCount(detail), requiredCount(detail))}
                  className="flex-1 text-sm rounded-lg py-2 font-medium text-white bg-green-600 hover:bg-green-700">Approve</button>
              )}
              {detail.compliance_status !== 'rejected' && (
                <button onClick={() => { setConfirm({ type: 'reject', bar: detail }); setReason(''); }}
                  title={detail.compliance_status === 'approved' ? 'Revoke compliance approval' : 'Reject compliance'}
                  className="flex-1 text-sm rounded-lg py-2 font-medium text-white bg-red-600 hover:bg-red-700">
                  {detail.compliance_status === 'approved' ? 'Revoke' : 'Reject'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirm && (() => {
        const bar = confirm.bar;
        const revoking = confirm.type === 'reject' && bar.compliance_status === 'approved';
        const uploaded = uploadedCount(bar);
        const required = requiredCount(bar);
        const complete = uploaded >= required;
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="glass-modal p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-white mb-4">
                {confirm.type === 'approve' ? 'Approve Compliance' : revoking ? 'Revoke Compliance Approval' : 'Reject Compliance'}
              </h3>
              <div className="mb-4 p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs space-y-1">
                <div className="flex justify-between"><span className="text-white/40">Bar</span><span className="text-white/80">{bar.name}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Owner</span><span className="text-white/80">{bar.owner_name || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Documents</span><span className="text-white/80">{uploaded} / {required} uploaded</span></div>
              </div>
              {confirm.type === 'approve' ? (
                complete ? (
                  <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-400">
                    The bar becomes visible to customers immediately.
                  </div>
                ) : (
                  <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300" data-testid="approve-blocked">
                    {incompleteDocumentsMessage(uploaded, required)}
                  </div>
                )
              ) : (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-white/50 mb-1">{revoking ? 'Revocation Reason *' : 'Rejection Reason *'}</label>
                  <textarea rows="3" className="glass-input w-full text-sm" placeholder="Reason..." value={reason} onChange={e => setReason(e.target.value)} />
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setConfirm(null); setReason(''); }} className="btn-ghost flex-1 text-sm">Cancel</button>
                <button disabled={busy || (confirm.type === 'approve' && !complete)} onClick={decide}
                  className={`flex-1 text-sm rounded-lg py-2 font-medium text-white disabled:opacity-50 ${confirm.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  {busy ? 'Working…' : confirm.type === 'approve' ? 'Approve' : revoking ? 'Revoke' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
