import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import { barRegistrationApi } from '../api/barRegistrationApi';
import {
  REQUIRED_FIELDS,
  docLabel,
  evaluateChecklist,
  setRequiredPermits,
} from '../utils/registrationChecklist';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const CLASSIFICATIONS = ['Bar', 'Resto-Bar', 'Pub', 'Nightclub', 'Sports Bar', 'Cocktail Bar', 'Other'];

const docUrl = (p) => (p ? `${API_URL}/${String(p).replace(/\\/g, '/')}` : null);

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white text-sm focus:outline-none focus:border-[#CC0000]';
const btnCls = 'px-4 py-2 rounded-lg text-sm font-semibold transition';

export default function BarRegistration() {
  const permissions = useAuthStore((s) => s.permissions) || [];
  const location = useLocation();
  const canReview = permissions.includes('bar_registration_review');
  const [tab, setTab] = useState(location.state?.tab || (canReview ? 'review' : 'submit'));

  useEffect(() => {
    if (location.state?.tab) setTab(location.state.tab);
  }, [location.state]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Bar Registration &amp; Verification</h1>
      <p className="text-sm text-gray-400 mb-5">
        Compliance module — classify the establishment, submit required permits, run automated verification, and complete manual admin review.
      </p>

      <div className="flex gap-2 mb-6">
        {['submit', 'my'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`${btnCls} ${tab === t ? 'bg-[#CC0000] text-white' : 'bg-[#222] text-gray-300'}`}>
            {t === 'submit' ? 'Submit Registration' : 'My Submissions'}
          </button>
        ))}
        {canReview && (
          <button onClick={() => setTab('review')}
            className={`${btnCls} ${tab === 'review' ? 'bg-[#CC0000] text-white' : 'bg-[#222] text-gray-300'}`}>
            Review Queue
          </button>
        )}
      </div>

      {tab === 'submit' && <SubmitForm onDone={() => setTab('my')} />}
      {tab === 'my' && <MySubmissions />}
      {tab === 'review' && canReview && <ReviewQueue />}
    </div>
  );
}

function SubmitForm({ onDone }) {
  const [form, setForm] = useState({
    business_name: '', business_address: '', business_city: '', business_phone: '',
    owner_first_name: '', owner_last_name: '', owner_email: '', owner_phone: '',
    classification: 'Bar',
  });
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [missingDocs, setMissingDocs] = useState([]);
  // Requirements already on file (saved registration + uploaded documents),
  // so a reload does not report completed work as missing again.
  const [saved, setSaved] = useState({ fields: {}, documents: {}, fileNames: {} });
  // Required permit documents — served by the backend so this form always
  // matches Super Admin's Permit Checking panel. null = still loading.
  const [permits, setPermits] = useState(null);
  const [configError, setConfigError] = useState(false);

  const loadConfig = () => {
    let alive = true;
    setConfigError(false);
    barRegistrationApi.current({ silentError: true })
      .then((r) => {
        const d = r.data?.data;
        if (!alive || !d) return;
        setSaved({ fields: d.fields || {}, documents: d.documents || {}, fileNames: d.files || {} });
        const permitList = Array.isArray(d.required_permits) ? d.required_permits : [];
        setPermits(permitList);
        setRequiredPermits(permitList);
        setForm((f) => {
          const next = { ...f };
          Object.entries(d.form || {}).forEach(([k, v]) => {
            if (!String(next[k] || '').trim()) next[k] = v;
          });
          return next;
        });
      })
      .catch(() => { if (alive) setConfigError(true); });
    return () => { alive = false; };
  };

  useEffect(() => loadConfig(), []);

  const permitsReady = Array.isArray(permits) && permits.length > 0;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const onFile = (k, e) => {
    setFiles((f) => ({ ...f, [k]: e.target.files[0] }));
    setMissingDocs((d) => d.filter((label) => label !== docLabel(k)));
    setErrors((er) => { const n = { ...er }; delete n[k]; return n; });
  };
  const errCls = (k) => (errors[k] ? ' border-red-500' : '');

  // Live requirement tracking — same evaluator the portal-wide banner uses.
  const { fieldItems, docItems, missingFields, missingDocs: missingDocsLive, isComplete } =
    evaluateChecklist({ saved, form, files, permits: permits || [] });

  const validate = () => {
    const errs = {};
    REQUIRED_FIELDS.forEach(([k, label]) => {
      if (!String(form[k] || '').trim() && !saved.fields?.[k]) errs[k] = `${label} is required.`;
    });
    if (form.owner_email && !/^\S+@\S+\.\S+$/.test(form.owner_email.trim())) {
      errs.owner_email = 'Enter a valid owner email address.';
    }
    const docs = (permitsReady ? permits : [])
      .filter((p) => !files[p.key] && !saved.documents?.[p.key])
      .map((p) => p.label);
    return { errs, docs };
  };

  const submit = async (e) => {
    e.preventDefault();
    const { errs, docs } = validate();
    setErrors(errs);
    setMissingDocs(docs);
    if (Object.keys(errs).length || docs.length) {
      toast.error('Please complete all required fields and permit documents.');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      (permits || []).forEach((d) => { if (files[d.key]) fd.append(d.key, files[d.key]); });
      await barRegistrationApi.submit(fd);
      toast.success('Registration submitted for verification');
      onDone();
    } catch (err) {
      const data = err?.response?.data || {};
      if (Array.isArray(data.missing_fields)) setErrors(Object.fromEntries(data.missing_fields.map((m) => [m, true])));
      if (Array.isArray(data.missing_documents)) setMissingDocs(data.missing_documents);
      toast.error(data.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const errorList = [
    ...Object.values(errors).filter((v) => typeof v === 'string'),
    ...(missingDocs.length ? [`Missing required documents: ${missingDocs.join(', ')}`] : []),
  ];

  return (
    <form onSubmit={submit} className="space-y-5 bg-[#161616] p-6 rounded-xl border border-[#2a2a2a]">
      {errorList.length > 0 && (
        <div className="p-3 rounded-lg text-sm text-red-300" style={{ background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.4)' }}>
          <p className="font-semibold mb-1">Submission incomplete</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {errorList.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Business Name *" error={typeof errors.business_name === 'string' ? errors.business_name : null}>
          <input className={inputCls + errCls('business_name')} value={form.business_name} onChange={(e) => set('business_name', e.target.value)} /></Field>
        <Field label="Classification *">
          <select className={inputCls} value={form.classification} onChange={(e) => set('classification', e.target.value)}>
            {CLASSIFICATIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Business Address *" error={typeof errors.business_address === 'string' ? errors.business_address : null}>
          <input className={inputCls + errCls('business_address')} value={form.business_address} onChange={(e) => set('business_address', e.target.value)} /></Field>
        <Field label="Business City *" error={typeof errors.business_city === 'string' ? errors.business_city : null}>
          <input className={inputCls + errCls('business_city')} value={form.business_city} onChange={(e) => set('business_city', e.target.value)} /></Field>
        <Field label="Business Phone *" error={typeof errors.business_phone === 'string' ? errors.business_phone : null}>
          <input className={inputCls + errCls('business_phone')} value={form.business_phone} onChange={(e) => set('business_phone', e.target.value)} /></Field>
        <Field label="Owner First Name *" error={typeof errors.owner_first_name === 'string' ? errors.owner_first_name : null}>
          <input className={inputCls + errCls('owner_first_name')} value={form.owner_first_name} onChange={(e) => set('owner_first_name', e.target.value)} /></Field>
        <Field label="Owner Last Name *" error={typeof errors.owner_last_name === 'string' ? errors.owner_last_name : null}>
          <input className={inputCls + errCls('owner_last_name')} value={form.owner_last_name} onChange={(e) => set('owner_last_name', e.target.value)} /></Field>
        <Field label="Owner Email *" error={typeof errors.owner_email === 'string' ? errors.owner_email : null}>
          <input type="email" className={inputCls + errCls('owner_email')} value={form.owner_email} onChange={(e) => set('owner_email', e.target.value)} /></Field>
        <Field label="Owner Phone *" error={typeof errors.owner_phone === 'string' ? errors.owner_phone : null}>
          <input className={inputCls + errCls('owner_phone')} value={form.owner_phone} onChange={(e) => set('owner_phone', e.target.value)} /></Field>
      </div>

      <div>
        <p className="text-sm text-gray-300 mb-1 font-semibold">Required Permit Documents</p>
        <p className="text-xs text-gray-500 mb-2">
          {permitsReady
            ? `All ${permits.length} documents below are required before your bar is shown to customers.`
            : 'Loading the required permit documents…'}
        </p>

        {!permitsReady ? (
          configError ? (
            <div className="p-3 rounded-lg text-xs text-red-300" style={{ background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.4)' }}>
              <p className="font-semibold mb-1">Unable to load the required permit documents.</p>
              <button type="button" onClick={() => loadConfig()} className="px-3 py-1.5 rounded-lg bg-[#CC0000] text-white text-xs font-semibold">
                Try again
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Loading…</p>
          )
        ) : (
        <>
        <ChecklistPanel
          missingCount={missingDocsLive.length}
          totalCount={docItems.length}
          summaryLabel="required documents"
          completeText="All required documents submitted."
        >
          <ChecklistGroup items={docItems} />
        </ChecklistPanel>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {permits.map((d) => {
            const isRequired = d.required !== false;
            const staged = Boolean(files[d.key]);
            const alreadySaved = Boolean(saved.documents?.[d.key]);
            // "Done" only when the document is on file and nothing new has been
            // picked: a freshly selected file drops the button back to the active
            // state until the form is submitted again.
            const done = !staged && alreadySaved;
            const fileNote = staged
              ? files[d.key].name
              : done
                ? (saved.fileNames?.[d.key] || 'Document on file')
                : 'No file chosen';

            return (
              <div key={d.key} className="flex flex-col gap-1 text-xs text-gray-400">
                <span>{d.label}{isRequired ? ' *' : ''}</span>

                {/* Custom button + overlaid native input: the state-driven label
                    is visual only, the transparent input still owns the click so
                    choosing a new file reopens the picker. */}
                <div className="relative inline-flex w-fit rounded-lg focus-within:ring-2"
                  style={{ '--tw-ring-color': done ? 'rgba(34,197,94,0.6)' : 'rgba(204,0,0,0.6)' }}>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => onFile(d.key, e)}
                    aria-label={`Upload ${d.label}`}
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                  />
                  <span
                    data-testid={`upload-btn-${d.key}`}
                    className={`pointer-events-none inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      done ? 'bg-green-600 text-white' : 'bg-[#CC0000] text-white'
                    }`}
                  >
                    {done ? '✓ Uploaded' : 'Choose File'}
                  </span>
                </div>

                <span className={`text-[11px] ${done ? 'text-green-400' : staged ? 'text-amber-300' : 'text-gray-500'}`}>
                  {fileNote}
                </span>

                {isRequired ? (
                  staged
                    ? <span className="text-green-400 text-[11px]">✅ {files[d.key].name}</span>
                    : alreadySaved
                      ? <span className="text-green-400 text-[11px]">✅ On file (previously submitted)</span>
                      : <span className="text-red-400 text-[11px]">❌ Missing — required.</span>
                ) : staged || alreadySaved ? (
                  <span className="text-green-400 text-[11px]">✅ {staged ? files[d.key].name : 'On file (previously submitted)'}</span>
                ) : (
                  <span className="text-gray-600 text-[11px]">Optional</span>
                )}
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>

      <div>
        {permitsReady && (
          <ChecklistPanel
            missingCount={missingFields.length + missingDocsLive.length}
            totalCount={fieldItems.length + docItems.length}
            summaryLabel="requirements"
            completeText="All required fields and documents completed."
          >
            <p className="text-[11px] text-amber-300/80 mb-1.5 font-semibold uppercase tracking-wider">Details</p>
            <ChecklistGroup items={fieldItems} />
            <p className="text-[11px] text-amber-300/80 mt-2.5 mb-1.5 font-semibold uppercase tracking-wider">Permit documents</p>
            <ChecklistGroup items={docItems} />
          </ChecklistPanel>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <button type="submit" disabled={loading || !isComplete || !permitsReady}
          title={isComplete && permitsReady ? undefined : 'Complete all required fields and documents above to submit.'}
          className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000] disabled:opacity-40 disabled:cursor-not-allowed self-start`}>
          {loading ? 'Submitting…' : 'Submit Registration'}
        </button>
        {!permitsReady ? (
          <p className="text-xs text-amber-400/80">
            {configError ? 'Fix the error above to see what is required.' : 'Loading required documents…'}
          </p>
        ) : !isComplete && (
          <p className="text-xs text-amber-400/80">
            Complete all required fields and documents above to submit.
          </p>
        )}
      </div>
    </form>
  );
}

// ─── Live requirement checklist ─────────────────────────────────────────────

function ChecklistGroup({ items }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-2 text-xs">
          <span className={item.done ? 'text-green-400' : 'text-red-400'}>
            {`${item.done ? '✅ ' : '❌ '}${item.label}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ChecklistPanel({ missingCount, totalCount, summaryLabel, completeText, children }) {
  const complete = missingCount === 0;
  return (
    <div
      className="rounded-lg p-3 border"
      style={complete
        ? { background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)' }
        : { background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.35)' }}
    >
      <p className={`text-xs font-semibold mb-2 ${complete ? 'text-green-400' : 'text-amber-300'}`}>
        {complete ? `✅ ${completeText}` : `⚠️ ${missingCount} of ${totalCount} ${summaryLabel} missing:`}
      </p>
      {!complete && children}
    </div>
  );
}

function Field({ label, children, error }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-400">
      {label}
      {children}
      {error && <span className="text-red-400 text-[11px]">{error}</span>}
    </label>
  );
}

const COMPLIANCE_STATUS_UI = {
  incomplete: { label: 'Incomplete — hidden from customers', cls: 'bg-yellow-900 text-yellow-300' },
  pending_review: { label: 'Pending Review', cls: 'bg-blue-900 text-blue-300' },
  approved: { label: 'Approved — visible to customers', cls: 'bg-green-900 text-green-300' },
  rejected: { label: 'Not Approved — hidden from customers', cls: 'bg-red-900 text-red-300' },
  hidden_incomplete: { label: 'Auto-Hidden — requirements not completed', cls: 'bg-red-900 text-red-300' },
};

function fmtDate(v) {
  if (!v) return null;
  try { return new Date(v).toLocaleString(); } catch (e) { return String(v); }
}

function fmtRemaining(target, reference) {
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

function MySubmissions() {
  const [rows, setRows] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    barRegistrationApi.my()
      .then((r) => {
        const data = r.data.data;
        if (Array.isArray(data)) {
          setRows(data);
        } else {
          setRows(data?.submissions || []);
          setCompliance(data?.compliance || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const status = compliance?.status || null;
  // Live countdown of the 3-day temporary visibility window.
  useEffect(() => {
    if (status !== 'pending_review') return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  if (loading) return <p className="text-gray-400">Loading…</p>;

  const ui = COMPLIANCE_STATUS_UI[status];
  const countdown = fmtRemaining(compliance?.temp_visible_until, now);

  return (
    <div className="space-y-3">
      {compliance && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-white font-semibold">Bar compliance status</p>
              <p className="text-xs text-gray-400">
                {compliance.submitted_at && <>Submitted {fmtDate(compliance.submitted_at)}</>}
                {compliance.reviewed_at && <> · Reviewed {fmtDate(compliance.reviewed_at)}</>}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${ui ? ui.cls : 'bg-gray-800 text-gray-300'}`}>
              {ui ? ui.label : status}
            </span>
          </div>
          {status === 'approved' && (
            <div className="mt-3 p-3 rounded-lg text-xs text-emerald-200" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' }} data-testid="compliance-approved">
              <span className="font-semibold">✅ Your bar is approved and fully visible to customers.</span>
              {compliance.reviewed_at && <> Reviewed {fmtDate(compliance.reviewed_at)}.</>}
            </div>
          )}
          {status === 'pending_review' && (
            <div className="mt-3 p-3 rounded-lg text-xs text-blue-200" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)' }}>
              <span className="font-semibold">⏳ Temporary visibility:</span> your bar is shown to customers while it is under review.
              {countdown ? (
                <> Time left: <span className="font-mono font-semibold text-white" data-testid="grace-countdown">{countdown}</span> — after that it is hidden until approved.</>
              ) : (
                <> The 3-day window starts when you submit your requirements.</>
              )}
            </div>
          )}
          {status === 'hidden_incomplete' && (
            <div className="mt-3 p-3 rounded-lg text-xs text-red-300" style={{ background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.35)' }}>
              <span className="font-semibold">⏰ Auto-hidden:</span> the 3-day window expired before the requirements were approved, so your bar is no longer shown to customers. Resubmit your complete requirements to be reviewed again.
            </div>
          )}
          {status === 'rejected' && compliance.rejection_reason && (
            <div className="mt-3 p-3 rounded-lg text-xs text-red-300" style={{ background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.35)' }}>
              <span className="font-semibold">Rejection reason:</span> {compliance.rejection_reason}
            </div>
          )}
        </div>
      )}

      {!rows.length && <p className="text-gray-400">No submissions yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4 flex justify-between items-center">
          <div>
            <p className="text-white font-semibold">{r.business_name}</p>
            <p className="text-xs text-gray-400">{r.classification} · {r.status}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${r.auto_verification_status === 'passed' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
            Auto: {r.auto_verification_status}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReviewQueue() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    barRegistrationApi.pending().then((r) => setRows(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openDetail = async (id) => {
    const r = await barRegistrationApi.detail(id);
    setDetail(r.data.data);
  };

  const autoAll = async (id) => {
    setBusy(true);
    try { await barRegistrationApi.autoVerify(id); toast.success('Automated verification run'); await openDetail(id); }
    catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const autoDoc = async (id, docType) => {
    try { await barRegistrationApi.autoVerifyDoc(id, docType); toast.success(`${docLabel(docType)} verified`); await openDetail(id); }
    catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
  };

  const decide = async (id, decision) => {
    const notes = prompt(`Reason for ${decision}:`) || '';
    setBusy(true);
    try { await barRegistrationApi.review(id, { decision, notes }); toast.success(`Registration ${decision}`); setDetail(null); load(); }
    catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  if (detail) {
    return (
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-6">
        <button onClick={() => setDetail(null)} className="text-sm text-gray-400 mb-4">← Back to queue</button>
        <h2 className="text-xl text-white font-bold">{detail.registration.business_name}</h2>
        <p className="text-xs text-gray-400 mb-4">{detail.registration.classification} · {detail.registration.status} · auto: {detail.registration.auto_verification_status}</p>

        <div className="flex gap-3 mb-5">
          <button onClick={() => autoAll(detail.registration.id)} disabled={busy} className={`${btnCls} bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-50`}>Run Automated Verification (All)</button>
        </div>

        <div className="space-y-3">
          {detail.documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3">
              <div>
                <p className="text-white text-sm font-semibold">{docLabel(d.document_type)}</p>
                <p className="text-xs text-gray-400">
                  status: {d.verification_status}
                  {d.ai_confidence_score != null && ` · confidence: ${(d.ai_confidence_score * 100).toFixed(0)}%`}
                  {d.verification_method && ` · via ${d.verification_method}`}
                </p>
                {d.file_path && (
                  <a href={docUrl(d.file_path)} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline">View document</a>
                )}
              </div>
              <button onClick={() => autoDoc(detail.registration.id, d.document_type)} disabled={busy} className={`${btnCls} bg-[#333] text-white hover:bg-[#444] disabled:opacity-50`}>Auto-verify</button>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => decide(detail.registration.id, 'approved')} disabled={busy} className={`${btnCls} bg-green-700 text-white hover:bg-green-600 disabled:opacity-50`}>Approve (Manual)</button>
          <button onClick={() => decide(detail.registration.id, 'rejected')} disabled={busy} className={`${btnCls} bg-red-700 text-white hover:bg-red-600 disabled:opacity-50`}>Reject (Manual)</button>
        </div>
      </div>
    );
  }

  if (loading) return <p className="text-gray-400">Loading…</p>;
  if (!rows.length) return <p className="text-gray-400">No pending registrations.</p>;
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="bg-[#161616] border border-[#2a2a2a] rounded-lg p-4 flex justify-between items-center">
          <div>
            <p className="text-white font-semibold">{r.business_name}</p>
            <p className="text-xs text-gray-400">{r.classification} · auto: {r.auto_verification_status}</p>
          </div>
          <button onClick={() => openDetail(r.id)} className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000]`}>Review</button>
        </div>
      ))}
    </div>
  );
}
