import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import { payrollFinanceApi } from '../api/payrollFinanceApi';
import { procurementApi } from '../api/procurementApi';

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

  const load = () => {
    setLoading(true);
    Promise.all([payrollFinanceApi.summary(), payrollFinanceApi.listRuns()])
      .then(([s, r]) => { setSummary(s.data.data); setRows(r.data.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line

  const loadPOs = () => {
    setPosLoading(true);
    payrollFinanceApi.listPOs()
      .then((r) => {
        const d = r.data.data || {};
        setPos(d.purchase_orders || []);
        setThreshold(Number(d.threshold || 0));
      })
      .catch(() => {}).finally(() => setPosLoading(false));
  };
  useEffect(loadPOs, []); // eslint-disable-line

  const approve = async (id) => { try { await payrollFinanceApi.approve(id); toast.success('Payroll released to Finance'); setDetail(null); load(); } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); } };
  const reject = async (id) => { const notes = prompt('Reason for rejection:') || ''; try { await payrollFinanceApi.reject(id, notes); toast.success('Payroll rejected'); setDetail(null); load(); } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); } };
  const open = async (id) => { const r = await payrollFinanceApi.getRun(id); setDetail(r.data.data); };
  const approvePO = async (id) => { try { await procurementApi.approvePO(id); toast.success('Purchase order approved'); loadPOs(); } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); } };
  const rejectPO = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try { await procurementApi.rejectPO(id, reason.trim()); toast.success('Purchase order rejected — requester notified'); loadPOs(); } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
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
                      {canApprovePO && (<><button onClick={() => approvePO(r.id)} className={`${btnCls} bg-green-700 text-white hover:bg-green-600 mr-2`}>Approve</button><button onClick={() => rejectPO(r.id)} className={`${btnCls} bg-red-700 text-white hover:bg-red-600`}>Reject</button></>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail ? <RunDetail detail={detail} canApprove={canApprove} onApprove={() => approve(detail.id)} onReject={() => reject(detail.id)} onBack={() => setDetail(null)} /> : (
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
                      <td className="py-2 pr-4"><button onClick={() => open(r.id)} className={`${btnCls} bg-[#333] text-white hover:bg-[#444] mr-2`}>View</button>{canApprove && r.status === 'finalized' && <><button onClick={() => approve(r.id)} className={`${btnCls} bg-green-700 text-white hover:bg-green-600 mr-2`}>Release</button><button onClick={() => reject(r.id)} className={`${btnCls} bg-red-700 text-white hover:bg-red-600`}>Reject</button></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
