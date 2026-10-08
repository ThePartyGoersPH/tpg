import React, { useState, useEffect } from 'react';
import { Monitor, ShoppingCart, DollarSign, TrendingUp, Search, Eye, X } from 'lucide-react';
import { posApi } from '../api/posApi';
import { usePermission } from '../hooks/usePermission';
import { format } from 'date-fns';
import { parseUTC } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Human-readable atomic stock, e.g. "3 Cases (36 Bottles remaining)".
const trimStockNum = (n) => {
  const v = Math.round(Number(n || 0) * 100) / 100;
  return String(Number.isInteger(v) ? v : v);
};
const pluralizeUnit = (word, n) => (Number(n) === 1 ? word : `${word}s`);
const formatAtomicStock = (item) => {
  const total = Number(item?.stock_qty || 0);
  const ratio = Number(item?.units_per_pack) > 0 ? Number(item.units_per_pack) : 1;
  const pack = String(item?.pack_unit || '').trim();
  const base = String(item?.base_unit || item?.unit || '').trim();
  if (ratio > 1 && pack) {
    const packs = Math.floor(total / ratio + 1e-9);
    if (packs < 1) return `${trimStockNum(total)} ${pluralizeUnit(base || 'unit', total)}`;
    return `${trimStockNum(packs)} ${pluralizeUnit(pack, packs)} (${trimStockNum(total)} ${pluralizeUnit(base || 'unit', total)} remaining)`;
  }
  return `${trimStockNum(total)} ${pluralizeUnit(base || item?.unit || 'pcs', total)}`;
};

const POS = () => {
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');
  const [orderFilter, setOrderFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { can } = usePermission();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [dashRes, ordersRes] = await Promise.all([
        posApi.getDashboard().catch(() => ({ data: null })),
        can('reservation_view') ? posApi.listOrders({ limit: 100 }) : Promise.resolve({ data: [] }),
      ]);
      setDashboard(dashRes.data?.data || dashRes.data || null);
      setOrders(ordersRes.data?.data || ordersRes.data || []);
    } catch {} finally { setLoading(false); }
  };

  const viewOrder = async (id) => {
    try {
      const { data } = await posApi.getOrder(id);
      setSelectedOrder(data.data || data);
    } catch {}
  };

  const filteredOrders = orders.filter((o) => {
    if (!orderFilter) return true;
    return o.status === orderFilter;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => setTab('dashboard')} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'dashboard' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>Dashboard</button>
        {can('reservation_view') && <button onClick={() => setTab('orders')} className="px-4 py-2 rounded-md text-sm font-medium transition-colors" style={tab === 'orders' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>Orders</button>}
      </div>

      {tab === 'dashboard' && dashboard && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)' }}><DollarSign className="w-5 h-5" style={{ color: '#4ade80' }} /></div>
                <div>
                  <p className="text-xs" style={{ color: '#888' }}>Today's Revenue</p>
                  <p className="text-xl font-extrabold text-white">₱{Number(dashboard.today?.revenue || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.12)' }}><ShoppingCart className="w-5 h-5" style={{ color: '#60a5fa' }} /></div>
                <div>
                  <p className="text-xs" style={{ color: '#888' }}>Completed</p>
                  <p className="text-xl font-extrabold text-white">{dashboard.today?.completed_count || 0}</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}><Monitor className="w-5 h-5" style={{ color: '#fbbf24' }} /></div>
                <div>
                  <p className="text-xs" style={{ color: '#888' }}>Pending</p>
                  <p className="text-xl font-extrabold text-white">{dashboard.today?.pending_count || 0}</p>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.12)' }}><TrendingUp className="w-5 h-5" style={{ color: '#c084fc' }} /></div>
                <div>
                  <p className="text-xs" style={{ color: '#888' }}>Week Revenue</p>
                  <p className="text-xl font-extrabold text-white">₱{Number(dashboard.week?.revenue || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-bold text-white mb-4">Top Selling Items</h3>
              <div className="space-y-2">
                {(dashboard.top_items || []).slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: 'rgba(204,0,0,0.15)', color: '#CC0000' }}>{i + 1}</span>
                      <span className="text-sm" style={{ color: '#ccc' }}>{item.item_name || item.name}</span>
                    </div>
                    <span className="text-xs font-medium" style={{ color: '#666' }}>{item.total_qty || item.quantity} sold</span>
                  </div>
                ))}
                {(!dashboard.top_items || dashboard.top_items.length === 0) && <p className="text-sm" style={{ color: '#555' }}>No data yet.</p>}
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold text-white mb-4">Low Stock Alerts</h3>
              <div className="space-y-2">
                {(dashboard.low_stock || []).slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 last:border-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="text-sm" style={{ color: '#ccc' }}>{item.name}</span>
                      <span className={item.stock_status === 'critical' ? 'badge-danger' : 'badge-warning'}>
                        {formatAtomicStock(item)}
                      </span>
                  </div>
                ))}
                {(!dashboard.low_stock || dashboard.low_stock.length === 0) && <p className="text-sm" style={{ color: '#555' }}>All stock levels normal.</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'orders' && (
        <>
          <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
            {['', 'pending', 'completed', 'cancelled'].map((f) => (
              <button key={f} onClick={() => setOrderFilter(f)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={orderFilter === f ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}
              >{f ? f.charAt(0).toUpperCase() + f.slice(1) : 'All'}</button>
            ))}
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}><tr>
                  <th className="table-header">Order #</th>
                  <th className="table-header">Table</th>
                  <th className="table-header">Total</th>
                  <th className="table-header">Payment</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Actions</th>
                </tr></thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.04)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td className="table-cell font-medium" style={{ color: '#CC0000' }}>{o.order_number || `#${o.id}`}</td>
                      <td className="table-cell">{o.table_id ? `Table ${o.table_id}` : 'Takeout'}</td>
                      <td className="table-cell font-semibold">₱{Number(o.total_amount || 0).toLocaleString()}</td>
                      <td className="table-cell">{o.payment_method || '—'}</td>
                      <td className="table-cell">
                        <span className={o.status === 'completed' ? 'badge-success' : o.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}>{o.status}</span>
                      </td>
                      <td className="table-cell">{o.created_at ? format(parseUTC(o.created_at), 'MMM d, h:mm a') : '—'}</td>
                      <td className="table-cell text-right">
                        <button onClick={() => viewOrder(o.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#CC0000'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><Eye className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && <tr><td colSpan="7" className="text-center py-8" style={{ color: '#555' }}>No orders found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.08)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="font-bold text-white">Order {selectedOrder.order_number || `#${selectedOrder.id}`}</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-lg transition-colors" style={{ color: '#666' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="space-y-2 mb-4">
                {(selectedOrder.items || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <p className="text-sm font-medium text-white">{item.item_name}</p>
                      <p className="text-xs" style={{ color: '#666' }}>{item.quantity} x ₱{Number(item.unit_price || 0).toLocaleString()}</p>
                    </div>
                    <span className="text-sm font-semibold text-white">₱{Number(item.subtotal || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex justify-between text-sm"><span style={{ color: '#888' }}>Subtotal</span><span className="text-white">₱{Number(selectedOrder.subtotal || 0).toLocaleString()}</span></div>
                {selectedOrder.discount_amount > 0 && <div className="flex justify-between text-sm"><span style={{ color: '#888' }}>Discount</span><span style={{ color: '#ff6666' }}>-₱{Number(selectedOrder.discount_amount).toLocaleString()}</span></div>}
                <div className="flex justify-between font-bold text-base mt-2"><span className="text-white">Total</span><span style={{ color: '#CC0000' }}>₱{Number(selectedOrder.total_amount || 0).toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
