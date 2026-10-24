import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, X } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import { payrollFinanceApi } from '../api/payrollFinanceApi';
import { procurementApi } from '../api/procurementApi';
import ErrorBoundary from '../components/common/ErrorBoundary.jsx';

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white text-sm focus:outline-none focus:border-[#CC0000]';
const btnCls = 'px-4 py-2 rounded-lg text-sm font-semibold transition';
const cardCls = 'bg-[#161616] border border-[#2a2a2a] rounded-xl p-5';
const fmt = (n) => (Number(n || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayrollFinance() {
  const permissions = useAuthStore((s) => s.permissions) || [];
  const canApprove = permissions.includes('finance_payroll_approve');
  const canApprovePO = permissions.includes('procurement_finance_approve');
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [pos, setPos] = useState([]);
  const [threshold, setThreshold] = useState(null);
  const [posLoading, setPosLoading] = useState(true);
  const [showPODetail, setShowPODetail] = useState(false);
  const [poDetail, setPoDetail] = useState(null);
  const [poDetailLoading, setPoDetailLoading] = useState(false);
  const [poDetailError, setPoDetailError] = useState('');
  const [rejectModal, setRejectModal] = useState(null);

  const load = () => {
    if (!canApprove) { setLoading(false); return; }
    setLoading(true);
    Promise.all([payrollFinanceApi.summary(), payrollFinanceApi.listRuns()])
      .then(([s, r]) => { setSummary(s.data.data); setRows(r.data.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [canApprove]); // eslint-disable-line

  const loadPOs = () => {
    if (!canApprovePO) { setPosLoading(false); return; }
    setPosLoading(true);
    payrollFinanceApi.listPOs()
      .then((r) => {
        const d = r.data.data || {};
        setPos(d.purchase_orders || []);
        setThreshold(Number(d.threshold || 0));
      })
      .catch(() => {}).finally(() => setPosLoading(false));
  };
  useEffect(() => { loadPOs(); }, [canApprovePO]); // eslint-disable-line

  const approve = async (id) => { try { await payrollFinanceApi.approve(id); toast.success('Payroll released to Finance'); setDetail(null); load(); } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); } };
  const open = async (id) => { const r = await payrollFinanceApi.getRun(id); setDetail(r.data.data); };
  const closePODetail = () => { setShowPODetail(false); setPoDetail(null); setPoDetailError(''); };
  const openPODetail = async (id) => {
    setShowPODetail(true);
    setPoDetail(null);
    setPoDetailError('');
    setPoDetailLoading(true);
    try {
      const r = await procurementApi.getPO(id);
      setPoDetail(r.data?.data || null);
    } catch (e) {
      setPoDetailError(e?.response?.data?.message || 'Could not load purchase order');
    } finally { setPoDetailLoading(false); }
  };
  const approvePO = async (id) => { try { await procurementApi.approvePO(id); toast.success('Purchase order approved'); closePODetail(); loadPOs(); } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); } };
  const submitReject = async (reason) => {
    const m = rejectModal;
    if (!m) return false;
    try {
      if (m.kind === 'po') {
        await procurementApi.rejectPO(m.id, reason);
        toast.success('Purchase order rejected — requester notified');
        closePODetail();
        loadPOs();
      } else {
        await payrollFinanceApi.reject(m.id, reason);
        toast.success('Payroll rejected');
        setDetail(null);
        load();
      }
      setRejectModal(null);
      return true;
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed');
      return false;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Finance Approvals</h1>
      <p className="text-sm text-gray-400 mb-5">Single approval queue: purchase orders and payroll runs are reviewed here before they proceed.</p>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[['Posted to Finance', `₱${fmt(summary.posted_total)}`], ['Pending Approval', `₱${fmt(summary.pending_total)}`], [`Approved (${summary.approved_count})`, 'released'], [`Pending (${summary.pending_count})`, 'awaiting']].map(([l, v]) => (
            <div key={l} className={cardCls}><p className="text-xs text-gray-400 mb-1">{l}</p><p className="text-xl font-bold text-white">{v}</p></div>
          ))}
        </div>
      )}

      {canApprovePO && (
      <div className={cardCls}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-white font-semibold">Purchase Orders Awaiting Finance Approval</h2>
            <p className="text-xs text-gray-400 mt-1">
              {threshold !== null
                ? threshold > 0
                  ? `Approval threshold: ₱${fmt(threshold)} — POs at or above this total are reviewed here; smaller POs are auto-approved at creation.`
                  : 'Approval threshold: ₱0.00 — every purchase order must be approved here.'
                : ''}
            </p>
          </div>
        </div>
        {posLoading ? <p className="text-gray-400">Loading…</p> : pos.length === 0 ? (
          <p className="text-gray-400">No purchase orders awaiting finance approval.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]"><tr><th className="py-2 pr-4">PO #</th><th className="py-2 pr-4">Supplier</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Requested by</th><th className="py-2 pr-4">Date requested</th><th className="py-2 pr-4"></th></tr></thead>
              <tbody className="text-gray-200">
                {pos.map((r) => (
                  <tr key={r.id} className="border-b border-[#1f1f1f]">
                    <td className="py-2 pr-4">#{r.id}</td>
                    <td className="py-2 pr-4 max-w-[200px] truncate" title={r.supplier_name || 'Walk-in'}>{r.supplier_name || 'Walk-in'}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">₱{fmt(r.total_amount)}{r.above_threshold && threshold > 0 ? <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-orange-900 text-orange-300">at/above threshold</span> : null}</td>
                    <td className="py-2 pr-4">{r.requested_by_name || '—'}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{String(r.created_at || '').slice(0, 10)}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      <button onClick={() => openPODetail(r.id)} className={`${btnCls} bg-[#333] text-white hover:bg-[#444] mr-2`} title="View full details">View</button>
                      {canApprovePO && (<><button onClick={() => approvePO(r.id)} className={`${btnCls} bg-green-700 text-white hover:bg-green-600 mr-2`}>Approve</button><button onClick={() => setRejectModal({ kind: 'po', id: r.id })} className={`${btnCls} bg-red-700 text-white hover:bg-red-600`}>Reject</button></>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {canApprove && (detail ? <RunDetail detail={detail} canApprove={canApprove} onApprove={() => approve(detail.id)} onReject={() => setRejectModal({ kind: 'payroll', id: detail.id })} onBack={() => setDetail(null)} /> : (
        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-3">Payroll Runs</h2>
          {loading ? <p className="text-gray-400">Loading…</p> : rows.length === 0 ? <p className="text-gray-400">No payroll runs yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]"><tr><th className="py-2 pr-4">ID</th><th className="py-2 pr-4">Period</th><th className="py-2 pr-4">HR Status</th><th className="py-2 pr-4">Net Total</th><th className="py-2 pr-4">Items</th><th className="py-2 pr-4"></th></tr></thead>
                <tbody className="text-gray-200">
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-[#1f1f1f]">
                      <td className="py-2 pr-4">#{r.id}</td>
                      <td className="py-2 pr-4">{r.period_start} → {r.period_end}</td>
                      <td className="py-2 pr-4"><FinanceBadge status={r.status} /></td>
                      <td className="py-2 pr-4">₱{fmt(r.net_total)}</td>
                      <td className="py-2 pr-4">{r.item_count}</td>
                      <td className="py-2 pr-4"><button onClick={() => open(r.id)} className={`${btnCls} bg-[#333] text-white hover:bg-[#444] mr-2`}>View</button>{canApprove && r.status === 'finalized' && <><button onClick={() => approve(r.id)} className={`${btnCls} bg-green-700 text-white hover:bg-green-600 mr-2`}>Release</button><button onClick={() => setRejectModal({ kind: 'payroll', id: r.id })} className={`${btnCls} bg-red-700 text-white hover:bg-red-600`}>Reject</button></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {showPODetail && (
        <ErrorBoundary>
          <PODetailModal
            data={poDetail}
            loading={poDetailLoading}
            error={poDetailError}
            canApprove={canApprovePO}
            onClose={closePODetail}
            onApprove={() => poDetail && approvePO(poDetail.id)}
            onReject={() => poDetail && setRejectModal({ kind: 'po', id: poDetail.id })}
          />
        </ErrorBoundary>
      )}

      {rejectModal && (
        <ErrorBoundary>
          <RejectModal
            title={rejectModal.kind === 'po' ? `Reject Purchase Order #${rejectModal.id}` : `Reject Payroll Run #${rejectModal.id}`}
            description={rejectModal.kind === 'po'
              ? 'This purchase order will be rejected and the requester will be notified. This action cannot be undone.'
              : 'This payroll run will be rejected and the reason recorded with it. This action cannot be undone.'}
            onCancel={() => setRejectModal(null)}
            onSubmit={submitReject}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}

function RunDetail({ detail, canApprove, onApprove, onReject, onBack }) {
  return (
    <div className={cardCls}>
      <button onClick={onBack} className="text-sm text-gray-400 mb-3">← Back</button>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-white font-semibold">Payroll Run #{detail.id}</h2>
        <FinanceBadge status={detail.status} />
      </div>
      <p className="text-xs text-gray-400 mb-3">Period: {detail.period_start} → {detail.period_end} · Net Total: ₱{fmt(detail.net_total)} · Created by: {detail.created_by_name || '—'}</p>
      {detail.finance_notes && <p className="text-xs text-red-300 mb-3">Finance note: {detail.finance_notes}</p>}
      <table className="w-full text-sm text-left mb-4">
        <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]"><tr><th className="py-2 pr-4">Employee</th><th className="py-2 pr-4">Days</th><th className="py-2 pr-4">Gross</th><th className="py-2 pr-4">Deductions</th><th className="py-2 pr-4">Net</th></tr></thead>
        <tbody className="text-gray-200">
          {detail.items.map((it) => (
            <tr key={it.id} className="border-b border-[#1f1f1f]">
              <td className="py-2 pr-4">{it.employee_name || 'Staff #' + it.user_id}</td>
              <td className="py-2 pr-4">{it.days_present}</td>
              <td className="py-2 pr-4">₱{fmt(it.gross_pay)}</td>
              <td className="py-2 pr-4">₱{fmt(it.deductions)}</td>
              <td className="py-2 pr-4">₱{fmt(it.net_pay)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {canApprove && detail.status === 'finalized' && (
        <div className="flex gap-3">
          <button onClick={onApprove} className={`${btnCls} bg-green-700 text-white hover:bg-green-600`}>Release to Finance</button>
          <button onClick={onReject} className={`${btnCls} bg-red-700 text-white hover:bg-red-600`}>Reject</button>
        </div>
      )}
      {detail.status !== 'finalized' && <p className="text-xs text-gray-500">Finance actions available only for HR-finalized runs.</p>}
    </div>
  );
}

function FinanceBadge({ status }) {
  const map = { draft: 'bg-gray-700 text-gray-200', finalized: 'bg-yellow-900 text-yellow-300', pending_approval: 'bg-orange-900 text-orange-300', approved: 'bg-green-900 text-green-300', rejected: 'bg-red-900 text-red-300' };
  const label = { draft: 'HR Draft', finalized: 'Awaiting Finance', pending_approval: 'Pending Finance', approved: 'Released', rejected: 'Rejected' };
  return <span className={`text-xs px-2 py-1 rounded-full ${map[status] || 'bg-gray-700 text-gray-200'}`}>{label[status] || status}</span>;
}

function ModalField({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-0.5">{label}</p>
      <div className="text-sm text-gray-200 break-words">{value}</div>
    </div>
  );
}

function POStatusBadge({ status }) {
  const map = { draft: 'bg-gray-700 text-gray-200', pending_approval: 'bg-yellow-900 text-yellow-300', approved: 'bg-blue-900 text-blue-300', rejected: 'bg-red-900 text-red-300', partially_received: 'bg-purple-900 text-purple-300', received: 'bg-green-900 text-green-300', cancelled: 'bg-gray-800 text-gray-400' };
  return <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${map[status] || 'bg-gray-700 text-gray-200'}`}>{status || '—'}</span>;
}

function PODetailModal({ data, loading, error, canApprove, onClose, onApprove, onReject }) {
  const items = Array.isArray(data?.items) ? data.items : [];
  const lineTotal = (it) => Number(it?.quantity_ordered || 0) * Number(it?.unit_cost || 0);
  const computedTotal = items.reduce((s, it) => s + lineTotal(it), 0);
  const total = data?.total_amount != null && data.total_amount !== '' && Number.isFinite(Number(data.total_amount))
    ? Number(data.total_amount) : computedTotal;
  const full = (v) => (v ? String(v).replace('T', ' ').slice(0, 16) : '—');
  const day = (v) => (v ? String(v).slice(0, 10) : '—');
  const hasHistory = !!(data && (data.approved_at || data.email_sent_at || data.last_notify_error));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Purchase order details">
      <div
        className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-bold text-white truncate">Purchase Order{data?.id ? ` #${data.id}` : ''}</h3>
            {data?.status && <POStatusBadge status={data.status} />}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg transition-colors shrink-0" style={{ color: '#666' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto grow space-y-5">
          {loading && <p className="text-sm text-gray-400">Loading purchase order…</p>}
          {!loading && error && (
            <div className="p-3 rounded-lg text-sm text-red-300" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>{error}</div>
          )}
          {!loading && !error && !data && <p className="text-sm text-gray-400">Purchase order not found.</p>}

          {!loading && !error && data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                <ModalField label="Status" value={<POStatusBadge status={data.status} />} />
                <ModalField label="Requested by" value={data.requested_by_name || '—'} />
                <ModalField label="Supplier" value={data.supplier_name || 'Walk-in'} />
                <ModalField label="Created" value={full(data.created_at)} />
                <ModalField label="Order date" value={day(data.order_date)} />
                <ModalField label="Expected delivery" value={day(data.expected_delivery)} />
              </div>

              {data.supplier_facebook_link && (
                <div className="text-xs break-all">
                  <span className="text-gray-400">Supplier contact: </span>
                  <a href={data.supplier_facebook_link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{data.supplier_facebook_link}</a>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-400 font-semibold mb-1">Notes</p>
                <p className="text-sm text-gray-200">{data.notes || <span className="text-gray-500">—</span>}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2">Items</p>
                {items.length === 0 ? (
                  <p className="text-sm text-gray-500">No items on this purchase order.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]">
                        <tr>
                          <th className="py-2 pr-3">Item</th>
                          <th className="py-2 pr-3">Qty</th>
                          <th className="py-2 pr-3">Unit</th>
                          <th className="py-2 pr-3">Unit ₱</th>
                          <th className="py-2">Line total</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-200">
                        {items.map((it, i) => (
                          <tr key={it?.id ?? i} className="border-b border-[#1f1f1f]">
                            <td className="py-2 pr-3">{it?.item_name || '—'}</td>
                            <td className="py-2 pr-3">{it?.quantity_ordered ?? '—'}</td>
                            <td className="py-2 pr-3">{it?.unit || '—'}</td>
                            <td className="py-2 pr-3 whitespace-nowrap">₱{fmt(it?.unit_cost)}</td>
                            <td className="py-2 whitespace-nowrap">₱{fmt(lineTotal(it))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-end items-baseline gap-3 mt-3 pt-3 border-t border-[#2a2a2a]">
                  <span className="text-xs text-gray-400 font-semibold">Grand total</span>
                  <span className="text-lg font-bold text-white">₱{fmt(total)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 font-semibold mb-1">Approval &amp; notification</p>
                {!hasHistory ? (
                  <p className="text-sm text-gray-500">No approval history yet.</p>
                ) : (
                  <ul className="text-xs text-gray-300 space-y-1">
                    {data.approved_at && <li>Approved: {full(data.approved_at)}{data.approved_by ? ` · by user #${data.approved_by}` : ''}</li>}
                    {data.email_sent_at && <li>Supplier notified: {full(data.email_sent_at)}</li>}
                    {data.last_notify_error && <li className="text-red-300">Last notify error: {String(data.last_notify_error)}</li>}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        {!loading && !error && data && (
          <div className="px-5 py-4 shrink-0 flex flex-wrap gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {canApprove && (<>
              <button onClick={onApprove} className={`${btnCls} bg-green-700 text-white hover:bg-green-600`}>Approve</button>
              <button onClick={onReject} className={`${btnCls} bg-red-700 text-white hover:bg-red-600`}>Reject</button>
            </>)}
            <button onClick={onClose} className={`${btnCls} bg-[#222] text-gray-300 hover:bg-[#333] ${canApprove ? 'ml-auto' : ''}`}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RejectModal({ title, description, onCancel, onSubmit }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  const submit = async () => {
    const value = String(reason || '').trim();
    if (!value) { setError('A reason is required before rejecting.'); return; }
    setError('');
    setBusy(true);
    const ok = await onSubmit(value);
    if (!ok) setBusy(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={() => { if (!busy) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-md p-6"
        style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white">{title}</h3>
            <p className="text-sm mt-1" style={{ color: '#888' }}>{description}</p>
          </div>
          <button
            onClick={() => { if (!busy) onCancel(); }}
            aria-label="Close"
            className="p-1 rounded-lg transition-colors shrink-0"
            style={{ color: '#666' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <label htmlFor="reject-reason" className="block text-xs text-gray-400 font-semibold mb-1">
            Reason for rejection <span style={{ color: '#CC0000' }}>*</span>
          </label>
          <textarea
            id="reject-reason"
            rows={4}
            autoFocus
            value={reason}
            disabled={busy}
            onChange={(e) => { setReason(e.target.value); if (error) setError(''); }}
            placeholder="Explain why this is being rejected…"
            className={`${inputCls} resize-y`}
          />
          {error && <p className="text-xs mt-1" style={{ color: '#ff6666' }}>{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { if (!busy) onCancel(); }}
            disabled={busy}
            className={`${btnCls} flex-1 bg-[#222] text-gray-300 hover:bg-[#333] disabled:opacity-60`}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`${btnCls} flex-1 bg-[#CC0000] text-white hover:bg-[#e00000] disabled:opacity-60 flex items-center justify-center gap-2`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
