import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import { procurementApi } from '../api/procurementApi';
import { inventoryApi } from '../api/inventoryApi';

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white text-sm focus:outline-none focus:border-[#CC0000]';
const btnCls = 'px-4 py-2 rounded-lg text-sm font-semibold transition';
const cardCls = 'bg-[#161616] border border-[#2a2a2a] rounded-xl p-5';
const fmt = (n) => (Number(n || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const UNITS = ['Bottle', 'Bucket', 'Case (12 bottles)', 'Glass', 'Liter', 'Kilogram', 'Piece'];

export default function Procurement() {
  const permissions = useAuthStore((s) => s.permissions) || [];
  const canCreate = permissions.includes('procurement_create');
  const [tab, setTab] = useState('purchase-orders');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Procurement</h1>
      <p className="text-sm text-gray-400 mb-5">Manage suppliers and raise purchase orders for bar inventory restocking.</p>
      <div className="flex gap-2 mb-6">
        {[['purchase-orders', 'Purchase Orders'], ['suppliers', 'Suppliers']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`${btnCls} ${tab === k ? 'bg-[#CC0000] text-white' : 'bg-[#222] text-gray-300'}`}>{label}</button>
        ))}
      </div>
      {tab === 'purchase-orders' && <PurchaseOrdersTab canCreate={canCreate} />}
      {tab === 'suppliers' && <SuppliersTab canCreate={canCreate} />}
    </div>
  );
}

function SuppliersTab({ canCreate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: null, name: '', contact_person: '', email: '', facebook_link: '', phone: '', address: '' });
  const [editing, setEditing] = useState(false);

  const load = () => {
    setLoading(true);
    procurementApi.listSuppliers().then((r) => setRows(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Supplier name required');
    try {
      if (editing) { await procurementApi.updateSupplier(form.id, form); toast.success('Supplier updated'); }
      else { await procurementApi.createSupplier(form); toast.success('Supplier created'); }
      setForm({ id: null, name: '', contact_person: '', email: '', facebook_link: '', phone: '', address: '' });
      setEditing(false); load();
    } catch (err) { toast.error(err?.response?.data?.message || 'Save failed'); }
  };

  const edit = (s) => { setForm({ id: s.id, name: s.name, contact_person: s.contact_person || '', email: s.email || '', facebook_link: s.facebook_link || '', phone: s.phone || '', address: s.address || '' }); setEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const remove = async (id) => { if (!confirm('Deactivate this supplier?')) return; try { await procurementApi.deleteSupplier(id); toast.success('Supplier deactivated'); load(); } catch (e) { toast.error('Failed'); } };

  return (
    <div className="space-y-6">
      {canCreate && (
        <form onSubmit={submit} className={`${cardCls} space-y-3`}>
          <h2 className="text-white font-semibold">{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name *"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Contact Person"><input className={inputCls} value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Field>
            <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Facebook Page / Messenger Link (optional)"><input className={inputCls} placeholder="https://facebook.com/..." value={form.facebook_link} onChange={(e) => setForm({ ...form, facebook_link: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Address"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          </div>
          <div className="flex gap-2">
            <button className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000]`}>{editing ? 'Update' : 'Create'}</button>
            {editing &&             <button type="button" onClick={() => { setForm({ id: null, name: '', contact_person: '', email: '', facebook_link: '', phone: '', address: '' }); setEditing(false); }} className={`${btnCls} bg-[#333] text-white`}>Cancel</button>}
          </div>
        </form>
      )}
      <div className={cardCls}>
        <h2 className="text-white font-semibold mb-3">Suppliers</h2>
        {loading ? <p className="text-gray-400">Loading…</p> : rows.length === 0 ? <p className="text-gray-400">No suppliers yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]"><tr><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Contact</th><th className="py-2 pr-4">Email</th><th className="py-2 pr-4">Notifications</th><th className="py-2 pr-4">Phone</th><th className="py-2 pr-4"></th></tr></thead>
              <tbody className="text-gray-200">
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-[#1f1f1f]">
                    <td className="py-2 pr-4">{s.name} {s.is_active ? '' : <span className="text-xs text-red-400">(inactive)</span>}</td>
                    <td className="py-2 pr-4">{s.contact_person || '—'}</td>
                    <td className="py-2 pr-4">{s.email || '—'}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {s.email
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300 mr-1">✉ Email</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 mr-1">No email</span>}
                      {s.facebook_link
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900 text-indigo-300">f Link saved</span>
                        : null}
                    </td>
                    <td className="py-2 pr-4">{s.phone || '—'}</td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {canCreate && <><button onClick={() => edit(s)} className="text-blue-400 text-xs mr-3">Edit</button><button onClick={() => remove(s)} className="text-red-400 text-xs">Deactivate</button></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PurchaseOrdersTab({ canCreate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const [prefillItems, setPrefillItems] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // The pre-fill payload is consumed by CreatePOForm when it mounts; clear it
  // whenever the form closes so a later manual open starts with one blank row.
  useEffect(() => { if (!showForm) setPrefillItems(null); }, [showForm]);

  const load = () => { setLoading(true); procurementApi.listPOs().then((r) => setRows(r.data.data || [])).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []); // eslint-disable-line
  useEffect(() => { procurementApi.listSuppliers().then((r) => setSuppliers(r.data.data || [])).catch(() => {}); inventoryApi.list().then((r) => setInventory(r.data?.data || r.data || [])).catch(() => {}); }, []);

  // Deep links from the Inventory Requests page:
  //   ?po=17              → open that purchase order's detail
  //   ?newPO=1&requests=  → open New Purchase Order, pre-filled from requests
  const paramsHandled = useRef(false);
  useEffect(() => {
    if (paramsHandled.current) return;
    paramsHandled.current = true;
    const poId = Number(searchParams.get('po'));
    const requestsParam = searchParams.get('requests');
    const hasLinkParams = searchParams.get('newPO') || requestsParam || poId;
    if (searchParams.get('newPO') && requestsParam) prefillFromRequests(requestsParam);
    else if (poId) openDetail(poId);
    if (hasLinkParams) setSearchParams({}, { replace: true });
  }, []);

  const prefillFromRequests = async (param) => {
    try {
      const ids = [...new Set(String(param).split(',').map((s) => Number(s.trim())).filter((n) => Number.isSafeInteger(n) && n > 0))];
      if (!ids.length) return;
      const [reqRes, invRes] = await Promise.all([
        procurementApi.getRequests(ids),
        inventory.length ? Promise.resolve(null) : inventoryApi.list().catch(() => null),
      ]);
      const rows = reqRes.data.data || [];
      const inv = inventory.length ? inventory : ((invRes && (invRes.data?.data || invRes.data)) || []);
      if (inv.length && !inventory.length) setInventory(inv);

      const eligible = rows.filter((r) => r.status === 'approved' && !r.purchase_order_id);
      const skipped = ids.length - eligible.length;
      if (skipped > 0) {
        toast.error(`${skipped} request${skipped === 1 ? '' : 's'} could not be added (already sent to Procurement or not approved)`);
      }
      if (!eligible.length) {
        if (!rows.length) toast.error('Inventory requests not found');
        return;
      }
      setPrefillItems(eligible.map((r) => ({
        inventory_item_id: (inv.find((x) => String(x.name).toLowerCase() === String(r.item_name).toLowerCase()) || {}).id || '',
        item_name: r.item_name,
        quantity_ordered: String(r.quantity_needed || ''),
        unit_cost: r.cost_price != null && r.cost_price !== '' && Number.isFinite(Number(r.cost_price)) ? String(Number(r.cost_price)) : '',
        unit: UNITS.includes(r.unit) ? r.unit : 'Piece',
        request_id: r.id,
      })));
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success(`${eligible.length} inventory request${eligible.length === 1 ? '' : 's'} added to this purchase order`);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not load inventory requests');
    }
  };

  const openDetail = async (id) => { try { const r = await procurementApi.getPO(id); setDetail(r.data.data); } catch (e) { toast.error(e?.response?.data?.message || 'Purchase order not found'); } };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-400">Status legend: draft → pending_approval → approved → partially_received → received · Approval decisions are made in <span className="text-gray-200">Procurement &amp; Supply → Finance Approvals</span></p>
        {canCreate && <button onClick={() => setShowForm((v) => !v)} className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000]`}>{showForm ? 'Close' : 'New Purchase Order'}</button>}
      </div>

      {showForm && <CreatePOForm suppliers={suppliers} inventory={inventory} initialItems={prefillItems} onSaved={() => { setShowForm(false); load(); }} />}

      {detail ? <PODetail detail={detail} onBack={() => setDetail(null)} /> :
        <div className={cardCls}>
          <h2 className="text-white font-semibold mb-3">Purchase Orders</h2>
          {loading ? <p className="text-gray-400">Loading…</p> : rows.length === 0 ? <p className="text-gray-400">No purchase orders yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]"><tr><th className="py-2 pr-4">ID</th><th className="py-2 pr-4">Supplier</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Expected</th><th className="py-2 pr-4"></th></tr></thead>
                <tbody className="text-gray-200">
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-[#1f1f1f]">
                      <td className="py-2 pr-4">#{r.id}</td>
                      <td className="py-2 pr-4">{r.supplier_name || '—'}</td>
                      <td className="py-2 pr-4"><StatusBadge status={r.status} /></td>
                      <td className="py-2 pr-4">₱{fmt(r.total_amount)}</td>
                      <td className="py-2 pr-4">{r.expected_delivery || '—'}</td>
                      <td className="py-2 pr-4"><button onClick={() => openDetail(r.id)} className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000]`}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>}
    </div>
  );
}

const emptyItemRow = () => ({ inventory_item_id: '', item_name: '', quantity_ordered: '', unit_cost: '', unit: 'Piece', request_id: null });

function CreatePOForm({ suppliers, inventory, onSaved, initialItems }) {
  const [supplier_id, setSupplier] = useState('');
  const [expected_delivery, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState(() => (Array.isArray(initialItems) && initialItems.length ? initialItems : [emptyItemRow()]));
  const [busy, setBusy] = useState(false);

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItems((arr) => [...arr, emptyItemRow()]);
  const removeItem = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i));
  const onInvSelect = (i, invId) => {
    const inv = inventory.find((x) => String(x.id) === String(invId));
    setItem(i, 'inventory_item_id', invId);
    setItem(i, 'item_name', inv ? inv.name : '');
  };

  const submit = async (e) => {
    e.preventDefault();
    const clean = items.filter((it) => it.item_name && it.quantity_ordered).map((it) => ({
      inventory_item_id: it.inventory_item_id || null,
      item_name: it.item_name,
      quantity_ordered: Number(it.quantity_ordered),
      unit_cost: Number(it.unit_cost) || 0,
      unit: it.unit || null,
      request_id: it.request_id || null,
    }));
    if (!clean.length) return toast.error('Add at least one item');
    setBusy(true);
    try {
      const r = await procurementApi.createPO({ supplier_id: supplier_id || null, expected_delivery: expected_delivery || null, notes, items: clean });
      const created = r.data.data || {};
      const linked = (created.linked_request_ids || []).length;
      const base = created.status === 'approved'
        ? 'Purchase order created and auto-approved (below approval threshold)'
        : 'Purchase order created — sent to Finance Approvals';
      toast.success(linked ? `${base} · ${linked} inventory request${linked === 1 ? '' : 's'} linked` : base);
      onSaved();
    }
    catch (err) { toast.error(err?.response?.data?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const selectedSupplierLabel = supplier_id
    ? (suppliers.find((s) => String(s.id) === String(supplier_id))?.name || '')
    : 'Walk-in';

  return (
    <form onSubmit={submit} className={`${cardCls} space-y-4`}>
      <h2 className="text-white font-semibold">New Purchase Order</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Supplier">
          <select
            className={`${inputCls} pr-8 truncate max-w-full`}
            style={{ textOverflow: 'ellipsis' }}
            title={`Supplier: ${selectedSupplierLabel}`}
            value={supplier_id}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">Walk-in</option>
            {suppliers.filter(s=>s.is_active).map((s) => <option key={s.id} value={s.id} title={s.name}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Expected Delivery"><input type="date" className={inputCls} value={expected_delivery} onChange={(e) => setExpected(e.target.value)} /></Field>
        <Field label="Notes"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-gray-400 font-semibold">Items</p>
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select className={`${inputCls} flex-1`} value={it.inventory_item_id} onChange={(e) => onInvSelect(i, e.target.value)}><option value="">— manual item —</option>{inventory.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <input className={`${inputCls} w-40`} placeholder="Name" value={it.item_name} onChange={(e) => setItem(i, 'item_name', e.target.value)} />
            <input type="number" min="1" className={`${inputCls} w-24`} placeholder="Qty" value={it.quantity_ordered} onChange={(e) => setItem(i, 'quantity_ordered', e.target.value)} />
            <select className={`${inputCls} w-32`} value={it.unit || 'Piece'} onChange={(e) => setItem(i, 'unit', e.target.value)} title="Unit">
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" min="0" step="0.01" className={`${inputCls} w-28`} placeholder="Unit ₱" value={it.unit_cost} onChange={(e) => setItem(i, 'unit_cost', e.target.value)} />
            <button type="button" onClick={() => removeItem(i)} className="text-red-400 text-sm px-2">✕</button>
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-sm text-blue-400">+ Add item</button>
      </div>
      <button type="submit" disabled={busy} className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000] disabled:opacity-50`}>{busy ? 'Saving…' : 'Create Purchase Order'}</button>
    </form>
  );
}

function PODetail({ detail, onBack }) {
  const totalRecv = detail.items.reduce((s, it) => s + Number(it.quantity_received || 0), 0);
  const [notifying, setNotifying] = React.useState(false);
  const [notifyResult, setNotifyResult] = React.useState(null);
  const canNotify = !['rejected', 'cancelled'].includes(String(detail.status));

  const notifySupplier = async () => {
    setNotifying(true);
    setNotifyResult(null);
    try {
      const r = await procurementApi.notifyPO(detail.id);
      setNotifyResult(r.data.data);
      if (r.data.success) toast.success('Supplier notified');
      else toast.error(r.data.message || 'Partially notified — see channel status');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Notify failed';
      setNotifyResult({ error: msg });
      toast.error(msg);
    } finally { setNotifying(false); }
  };

  const emailState = notifyResult?.email || (detail.email_sent_at ? { sent: true } : null);
  return (
    <div className={cardCls}>
      <button onClick={onBack} className="text-sm text-gray-400 mb-3">← Back</button>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-white font-semibold">Purchase Order #{detail.id}</h2>
        <StatusBadge status={detail.status} />
      </div>
      <p className="text-xs text-gray-400 mb-3">Supplier: {detail.supplier_name || '—'} · Total: ₱{fmt(detail.total_amount)} · Expected: {detail.expected_delivery || '—'}</p>
      <table className="w-full text-sm text-left mb-4">
        <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]"><tr><th className="py-2 pr-4">Item</th><th className="py-2 pr-4">Ordered</th><th className="py-2 pr-4">Received</th><th className="py-2 pr-4">Unit ₱</th></tr></thead>
        <tbody className="text-gray-200">
          {detail.items.map((it) => (
            <tr key={it.id} className="border-b border-[#1f1f1f]">
              <td className="py-2 pr-4">{it.item_name}{it.unit ? <span className="text-gray-500 text-xs ml-1">({it.unit})</span> : null}</td>
              <td className="py-2 pr-4">{it.quantity_ordered}</td>
              <td className="py-2 pr-4">{it.quantity_received}</td>
              <td className="py-2 pr-4">₱{fmt(it.unit_cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail.status === 'pending_approval' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-900/30 border border-yellow-800 text-yellow-200 text-xs">
          <span>⏳</span>
          <span><strong>Awaiting Finance Approval.</strong> Approve or reject this purchase order in <strong>Procurement &amp; Supply → Finance Approvals</strong>.</span>
        </div>
      )}
      {canNotify && (
        <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={notifySupplier} disabled={notifying} className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000] disabled:opacity-50`}>
              {notifying ? 'Notifying…' : 'Notify Supplier'}
            </button>
            {detail.supplier_facebook_link && (
              <a href={detail.supplier_facebook_link} target="_blank" rel="noopener noreferrer" className={`${btnCls} bg-[#1877F2] text-white hover:brightness-110`}>
                Message on Facebook →
              </a>
            )}
            {emailState && (
              emailState.sent
                ? <span className="text-xs px-2 py-1 rounded-full bg-green-900 text-green-300">✓ Emailed{emailState.to ? ` to ${emailState.to}` : ''}</span>
                : <span className="text-xs px-2 py-1 rounded-full bg-red-900 text-red-300" title={emailState.error || ''}>✕ Email failed</span>
            )}
          </div>
          {(notifyResult?.error) && (
            <p className="text-xs text-gray-500 mt-2">{notifyResult.error}</p>
          )}
          {detail.last_notify_error && !notifyResult && (
            <p className="text-xs text-gray-500 mt-2">Last attempt: {detail.last_notify_error}</p>
          )}
        </div>
      )}
      <p className="text-xs text-gray-500">Received so far: {totalRecv}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { draft: 'bg-gray-700 text-gray-200', pending_approval: 'bg-yellow-900 text-yellow-300', approved: 'bg-blue-900 text-blue-300', rejected: 'bg-red-900 text-red-300', partially_received: 'bg-purple-900 text-purple-300', received: 'bg-green-900 text-green-300', cancelled: 'bg-gray-800 text-gray-400' };
  return <span className={`text-xs px-2 py-1 rounded-full ${map[status] || 'bg-gray-700 text-gray-200'}`}>{status}</span>;
}

function Field({ label, children }) {
  return <label className="flex flex-col gap-1 text-xs text-gray-400">{label}{children}</label>;
}
