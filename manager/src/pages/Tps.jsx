import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Search, ChevronDown, X } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import { tpsApi } from '../api/tpsApi';
import { inventoryApi } from '../api/inventoryApi';

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#333] text-white text-sm focus:outline-none focus:border-[#CC0000]';
const btnCls = 'px-4 py-2 rounded-lg text-sm font-semibold transition';
const cardCls = 'bg-[#161616] border border-[#2a2a2a] rounded-xl p-5';

const fmt = (n) => (Number(n || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Searchable Item Select Dropdown Component
function ItemSelect({ value, onChange, items, placeholder = 'Search items...', disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lower = search.toLowerCase();
    return items.filter((item) =>
      (item.name && item.name.toLowerCase().includes(lower)) ||
      (item.sku && item.sku.toLowerCase().includes(lower)) ||
      (item.barcode && item.barcode.toLowerCase().includes(lower))
    );
  }, [items, search]);

  const handleSelect = (item) => {
    setSelectedItem(item);
    setSearch(item.name);
    setIsOpen(false);
    onChange(item);
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    setSelectedItem(null);
    setSearch('');
    onChange(null);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#666', pointerEvents: 'none' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`${inputCls} pl-10 pr-10 ${selectedItem ? 'bg-[#222]' : ''}`}
          autoComplete="off"
        />
        {selectedItem && (
          <button type="button" onClick={clearSelection} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded" style={{ color: '#888' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}>
            <X className="w-4 h-4" />
          </button>
        )}
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: '#666', pointerEvents: 'none' }} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-[#333] bg-[#1a1a1a] shadow-lg" style={{ minWidth: '300px' }}>
          {filteredItems.length === 0 ? (
            <div className="px-4 py-3 text-center text-gray-400 text-sm">
              {search ? 'No items found' : 'No items available'}
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="w-full px-4 py-2 text-left hover:bg-[#2a2a2a] flex items-center gap-3 border-b border-[#2a2a2a] last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {item.sku && `SKU: ${item.sku}`} {item.sku && item.barcode && '·'} {item.barcode && `Barcode: ${item.barcode}`}
                  </p>
                </div>
                <span className="text-sm font-semibold text-green-400 whitespace-nowrap">₱{fmt(item.price || item.unit_price || item.selling_price)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function Tps() {
  const permissions = useAuthStore((s) => s.permissions) || [];
  const canCreate = permissions.includes('tps_create');
  const [tab, setTab] = useState('transactions');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Transactions</h1>
      <p className="text-sm text-gray-400 mb-5">
        Record point-of-sale transactions with item naming and amount-paid tracking, and reconcile wastage / shrinkage for inventory control.
      </p>

      <div className="flex gap-2 mb-6">
        {[['transactions', 'Transactions'], ['wastage', 'Wastage & Shrinkage']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`${btnCls} ${tab === k ? 'bg-[#CC0000] text-white' : 'bg-[#222] text-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'transactions' && <TransactionsTab canCreate={canCreate} />}
      {tab === 'wastage' && <WastageTab canCreate={canCreate} />}
    </div>
  );
}

function SummaryCards({ from, to }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    tpsApi.getSummary({ from, to }).then((r) => setData(r.data.data)).catch(() => {});
  }, [from, to]);
  if (!data) return null;
  const cards = [
    ['Transactions', data.txn_count],
    ['Total Sales', `₱${fmt(data.total_sales)}`],
    ['Total Amount Paid', `₱${fmt(data.total_paid)}`],
    ['Total Shrinkage', `₱${fmt(data.total_shrinkage)}`],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map(([label, val]) => (
        <div key={label} className={cardCls}>
          <p className="text-xs text-gray-400 mb-1">{label}</p>
          <p className="text-xl font-bold text-white">{val}</p>
        </div>
      ))}
    </div>
  );
}

function TransactionsTab({ canCreate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    setLoading(true);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    tpsApi.listTransactions(params).then((r) => setRows(r.data.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line

  return (
    <div className="space-y-6">
      <SummaryCards from={from} to={to} />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">From<input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-gray-400 flex flex-col gap-1">To<input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button onClick={load} className={`${btnCls} bg-[#333] text-white hover:bg-[#444]`}>Filter</button>
      </div>

      {canCreate && <RecordTransactionForm onSaved={load} />}

      <div className={cardCls}>
        <h2 className="text-white font-semibold mb-3">Recorded Transactions</h2>
        {loading ? <p className="text-gray-400">Loading…</p> :
          rows.length === 0 ? <p className="text-gray-400">No transactions found.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]">
                  <tr>
                    <th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Order #</th>
                    <th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Amount Paid</th>
                    <th className="py-2 pr-4">Change</th><th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4">Date</th>
                  </tr>
                </thead>
                <tbody className="text-gray-200">
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-[#1f1f1f]">
                      <td className="py-2 pr-4">{r.transaction_name || <span className="text-gray-500">—</span>}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{r.order_number}</td>
                      <td className="py-2 pr-4">₱{fmt(r.total_amount)}</td>
                      <td className="py-2 pr-4 text-green-400">₱{fmt(r.amount_received)}</td>
                      <td className="py-2 pr-4">₱{fmt(r.change_amount)}</td>
                      <td className="py-2 pr-4">{r.payment_method}</td>
                      <td className="py-2 pr-4 text-xs">{new Date(r.created_at).toLocaleString()}</td>
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

function RecordTransactionForm({ onSaved }) {
  const [name, setName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [items, setItems] = useState([{ item_id: null, item_name: '', unit_price: '', quantity: '1' }]);
  const [busy, setBusy] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  useEffect(() => {
    inventoryApi.list().then((r) => {
      const data = r.data?.data || r.data || [];
      setInventoryItems(data.filter((item) => item.is_active !== 0 && (item.stock_qty == null || item.stock_qty > 0)));
      setInventoryLoading(false);
    }).catch(() => setInventoryLoading(false));
  }, []);

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItems((arr) => [...arr, { item_id: null, item_name: '', unit_price: '', quantity: '1' }]);
  const removeItem = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0), 0);
  const amt = Number(amountPaid) || 0;
  const change = Math.max(0, amt - subtotal);

  const submit = async (e) => {
    e.preventDefault();
    if (!items.some((it) => it.item_id && it.unit_price)) return toast.error('Add at least one valid item with inventory selection');
    if (!amt) return toast.error('Amount paid is required');
    setBusy(true);
    try {
      const payload = {
        transaction_name: name || null,
        payment_method: paymentMethod,
        amount_paid: amt,
        items: items.filter((it) => it.item_id && it.unit_price).map((it) => ({
          item_id: Number(it.item_id),
          item_name: it.item_name,
          unit_price: Number(it.unit_price),
          quantity: Number(it.quantity) || 1,
        })),
      };
      const res = await tpsApi.recordTransaction(payload);
      toast.success(`Transaction recorded — change ₱${fmt(res.data.data.change)}`);
      setName(''); setAmountPaid(''); setItems([{ item_id: null, item_name: '', unit_price: '', quantity: '1' }]);
      onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to record transaction');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className={`${cardCls} space-y-4`}>
      <h2 className="text-white font-semibold">Record Transaction</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="text-xs text-gray-400 flex flex-col gap-1">Transaction Name
          <input className={inputCls} placeholder="e.g. Friday Night Batch" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-xs text-gray-400 flex flex-col gap-1">Payment Method
          <select className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option><option value="digital">Digital</option>
          </select>
        </label>
        <label className="text-xs text-gray-400 flex flex-col gap-1">Amount Paid *
          <input type="number" min="0" step="0.01" className={inputCls} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} required />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-400 font-semibold">Items (select from inventory)</p>
        {inventoryLoading ? (
          <div className="text-center text-gray-400 py-4">Loading inventory items...</div>
        ) : (
          items.map((it, i) => (
            <div key={i} className="flex gap-2 items-center">
              <ItemSelect
                value={it.item_id ? inventoryItems.find((inv) => inv.id === it.item_id) : null}
                onChange={(selected) => setItem(i, 'item_id', selected?.id || null)}
                items={inventoryItems}
                placeholder="Search inventory items..."
              />
              <input type="number" min="0" step="0.01" className={`${inputCls} w-32`} placeholder="Unit ₱" value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} readOnly={!it.item_id} style={{ opacity: it.item_id ? 1 : 0.5 }} />
              <input type="number" min="1" className={`${inputCls} w-24`} placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} disabled={!it.item_id} style={{ opacity: it.item_id ? 1 : 0.5 }} />
              <button type="button" onClick={() => removeItem(i)} className="text-red-400 text-sm px-2">✕</button>
            </div>
          ))
        )}
        <button type="button" onClick={addItem} className="text-sm text-blue-400">+ Add item</button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-300">Subtotal: <span className="text-white font-semibold">₱{fmt(subtotal)}</span> · Change: <span className="text-green-400 font-semibold">₱{fmt(change)}</span></p>
        <button type="submit" disabled={busy} className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000] disabled:opacity-50`}>{busy ? 'Saving…' : 'Record Transaction'}</button>
      </div>
    </form>
  );
}

function WastageTab({ canCreate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = () => {
    setLoading(true);
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    tpsApi.getWastage(params).then((r) => setData(r.data.data)).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-400 flex flex-col gap-1">From<input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs text-gray-400 flex flex-col gap-1">To<input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button onClick={load} className={`${btnCls} bg-[#333] text-white hover:bg-[#444]`}>Filter</button>
      </div>

      {canCreate && <RecordWastageForm onSaved={load} />}

      <div className={cardCls}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-white font-semibold">Shrinkage Report</h2>
          {data && <span className="text-sm text-red-400 font-semibold">Total Shrinkage: ₱{fmt(data.total_shrinkage)}</span>}
        </div>
        {loading ? <p className="text-gray-400">Loading…</p> :
          !data || data.items.length === 0 ? <p className="text-gray-400">No wastage recorded.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 border-b border-[#2a2a2a]">
                  <tr><th className="py-2 pr-4">Item</th><th className="py-2 pr-4">Qty Wasted</th><th className="py-2 pr-4">Unit Cost</th><th className="py-2 pr-4">Shrinkage Cost</th></tr>
                </thead>
                <tbody className="text-gray-200">
                  {data.items.map((w) => (
                    <tr key={w.item_id} className="border-b border-[#1f1f1f]">
                      <td className="py-2 pr-4">{w.item_name}</td>
                      <td className="py-2 pr-4">{w.total_qty}</td>
                      <td className="py-2 pr-4">₱{fmt(w.cost_price)}</td>
                      <td className="py-2 pr-4 text-red-400">₱{fmt(w.shrinkage_cost)}</td>
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

function RecordWastageForm({ onSaved }) {
  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    inventoryApi.list().then((r) => setItems(r.data?.data || r.data || [])).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!itemId || !qty) return toast.error('Select an item and quantity');
    setBusy(true);
    try {
      await tpsApi.recordWastage({ item_id: Number(itemId), quantity_wasted: Number(qty), reason: reason || null });
      toast.success('Wastage recorded');
      setQty(''); setReason(''); onSaved();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to record wastage');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className={`${cardCls} space-y-4`}>
      <h2 className="text-white font-semibold">Record Wastage / Spillage / Loss</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="text-xs text-gray-400 flex flex-col gap-1">Inventory Item
          <select className={inputCls} value={itemId} onChange={(e) => setItemId(e.target.value)} required>
            <option value="">Select item…</option>
            {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-400 flex flex-col gap-1">Quantity Wasted *
          <input type="number" min="1" className={inputCls} value={qty} onChange={(e) => setQty(e.target.value)} required />
        </label>
        <label className="text-xs text-gray-400 flex flex-col gap-1">Reason
          <input className={inputCls} placeholder="e.g. spilled, expired" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </div>
      <button type="submit" disabled={busy} className={`${btnCls} bg-[#CC0000] text-white hover:bg-[#a30000] disabled:opacity-50`}>{busy ? 'Saving…' : 'Record Wastage'}</button>
    </form>
  );
}
