import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import { supplyChainApi } from '../api/supplyChainApi';

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white text-sm focus:outline-none focus:border-[#CC0000]';
const btnCls = 'px-4 py-2 rounded-lg text-sm font-semibold transition';
const cardCls = 'bg-[#161616] border border-[#2a2a2a] rounded-xl p-5';
const fmt = (n) => (Number(n || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SupplyChain() {
  const permissions = useAuthStore((s) => s.permissions) || [];
  const canReceive = permissions.includes('supply_chain_receive');
  const [tab, setTab] = useState('receive');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Supply Chain</h1>
      <p className="text-sm text-gray-400 mb-5">Receive approved purchase orders and reconcile stock; track goods-received history.</p>
      <div className="flex gap-2 mb-6">
        {[['receive', 'Receive Goods'], ['history', 'Received History']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`${btnCls} ${tab === k ? 'bg-[#CC0000] text-white' : 'bg-[#222] text-gray-300'}`}>{label}</button>
        ))}
      </div>
      {tab === 'receive' && <ReceiveTab canReceive={canReceive} />}
      {tab === 'history' && <HistoryTab />}
    </div>
  );
}

function ReceiveTab({ canReceive }) {
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const load = () => { setLoading(true); supplyChainApi.listReceivablePOs().then((r) => setPos(r.data.data || [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []); // eslint-disable-line

  const open = async (id) => { const r = await supplyChainApi.getPO(id); setDetail({ ...r.data.data, lines: r.data.data.items.map((it) => ({ po_item_id: it.id, qty: '' })) }); };

  return (
    <div className="space-y-6">
      {!detail ? (
        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-3">Purchase Orders to Receive</h2>
          {loading ? <p className="text-gray-400">Loading…</p> : pos.length === 0 ? <p className="text-gray-400">No orders awaiting receipt.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]"><tr><th className="py-2 pr-4">ID</th><th className="py-2 pr-4">Supplier</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4"></th></tr></thead>
                <tbody className="text-gray-200">
                  {pos.map((r) => (
                    <tr key={r.id} className="border-b border-[#1f1f1f]">
                      <td className="py-2 pr-4">#{r.id}</td>
                      <td className="py-2 pr-4">{r.supplier_name || '—'}</td>
                      <td className="py-2 pr-4">{r.status}</td>
                      <td className="py-2 pr-4">₱{fmt(r.total_amount)}</td>
                      <td className="py-2 pr-4"><button onClick={() => open(r.id)} disabled={!canReceive} className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000] disabled:opacity-40`}>Receive</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : <ReceiveForm detail={detail} setDetail={setDetail} onDone={load} />}
    </div>
  );
}

function ReceiveForm({ detail, setDetail, onDone }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const setQty = (i, v) => setDetail((d) => ({ ...d, lines: d.lines.map((l, idx) => idx === i ? { ...l, qty: v } : l) }));

  const remaining = (it) => Number(it.quantity_ordered) - Number(it.quantity_received);
  const validLines = detail.lines.filter((l) => { const it = detail.items.find((x) => x.id === l.po_item_id); return l.qty && Number(l.qty) > 0 && Number(l.qty) <= remaining(it); });

  const submit = async (e) => {
    e.preventDefault();
    if (!validLines.length) return toast.error('Enter a valid quantity to receive for at least one item');
    setBusy(true);
    try {
      await supplyChainApi.receive(detail.id, { notes, items: validLines.map((l) => ({ po_item_id: l.po_item_id, quantity_received: Number(l.qty) })) });
      toast.success('Goods received — inventory updated');
      setDetail(null); onDone();
    } catch (err) { toast.error(err?.response?.data?.message || 'Receive failed'); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className={`${cardCls} space-y-4`}>
      <div className="flex justify-between items-center">
        <h2 className="text-white font-semibold">Receive — PO #{detail.id}</h2>
        <button type="button" onClick={() => setDetail(null)} className="text-sm text-gray-400">← Cancel</button>
      </div>
      <p className="text-xs text-gray-400">Supplier: {detail.supplier_name || '—'}</p>
      <div className="space-y-3">
        {detail.items.map((it) => {
          const rem = remaining(it);
          return (
            <div key={it.id} className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center sm:justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex-1 min-w-0">
                <p className="text-white text-lg font-semibold truncate">{it.item_name}</p>
                <p className="text-xs text-gray-400 mt-1 flex items-center flex-wrap">
                  <span>Ordered: <strong className="text-gray-200 font-semibold">{it.quantity_ordered}</strong></span>
                  <span className="mx-2 text-gray-600">|</span>
                  <span>Received: <strong className="text-gray-200 font-semibold">{it.quantity_received}</strong></span>
                  <span className="mx-2 text-gray-600">|</span>
                  <span>Remaining: <strong className="text-gray-200 font-semibold">{rem}</strong></span>
                </p>
              </div>
              <input type="number" min="0" max={rem} className={`${inputCls} w-full sm:w-36 flex-shrink-0`} placeholder={`Receive (≤${rem})`} value={detail.lines.find((l) => l.po_item_id === it.id)?.qty || ''} onChange={(e) => setQty(detail.lines.findIndex((l) => l.po_item_id === it.id), e.target.value)} />
            </div>
          );
        })}
      </div>
      <Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <button type="submit" disabled={busy} className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000] disabled:opacity-50`}>{busy ? 'Saving…' : 'Confirm Receipt'}</button>
    </form>
  );
}

function HistoryTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const load = () => { setLoading(true); supplyChainApi.listGRN().then((r) => setRows(r.data.data || [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []); // eslint-disable-line

  const open = async (id) => { const r = await supplyChainApi.getGRN(id); setDetail(r.data.data); };

  return (
    <div className={cardCls}>
      <h2 className="text-white font-semibold mb-3">Goods Received Notes</h2>
      {loading ? <p className="text-gray-400">Loading…</p> : rows.length === 0 ? <p className="text-gray-400">No goods received yet.</p> :
        detail ? (
          <div>
            <button onClick={() => setDetail(null)} className="text-sm text-gray-400 mb-3">← Back</button>
            <p className="text-white font-semibold mb-2">GRN #{detail.id} · {new Date(detail.received_at).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mb-3">{detail.notes || ''}</p>
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]"><tr><th className="py-2 pr-4">Item</th><th className="py-2 pr-4">Qty Received</th><th className="py-2 pr-4">Unit ₱</th></tr></thead>
              <tbody className="text-gray-200">
                {detail.items.map((it) => <tr key={it.id} className="border-b border-[#1f1f1f]"><td className="py-2 pr-4">{it.item_name}</td><td className="py-2 pr-4">{it.quantity_received}</td><td className="py-2 pr-4">₱{fmt(it.unit_cost)}</td></tr>)}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]"><tr><th className="py-2 pr-4">GRN</th><th className="py-2 pr-4">PO</th><th className="py-2 pr-4">Supplier</th><th className="py-2 pr-4">Received</th><th className="py-2 pr-4"></th></tr></thead>
              <tbody className="text-gray-200">
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#1f1f1f]">
                    <td className="py-2 pr-4">#{r.id}</td>
                    <td className="py-2 pr-4">#{r.po_id}</td>
                    <td className="py-2 pr-4">{r.supplier_name || '—'}</td>
                    <td className="py-2 pr-4">{new Date(r.received_at).toLocaleString()}</td>
                    <td className="py-2 pr-4"><button onClick={() => open(r.id)} className={`${btnCls} bg-[#333] text-white hover:bg-[#444]`}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}

function Field({ label, children }) {
  return <label className="flex flex-col gap-1 text-xs text-gray-400">{label}{children}</label>;
}
