import { useEffect, useState } from 'react';
import { posAPI } from '../api/services';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Search, ShoppingCart, Filter } from 'lucide-react';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ bar_id: '', status: '', from: '', to: '' });

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.bar_id) params.bar_id = filters.bar_id;
      if (filters.status) params.status = filters.status;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      const res = await posAPI.getOrders(params);
      if (res.data.success) setOrders(res.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const statusColors = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-green-500/20 text-green-400',
    cancelled: 'bg-red-500/20 text-red-400'
  };

  const paymentColors = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    paid: 'bg-green-500/20 text-green-400',
    refunded: 'bg-blue-500/20 text-blue-400',
    failed: 'bg-red-500/20 text-red-400'
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">POS Orders</h1>
        <p className="text-white/40 text-sm mt-1">All point-of-sale orders across bars</p>
      </div>

      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <Filter className="h-4 w-4"/>
          <span>Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select className="glass-input text-sm" value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input type="date" className="glass-input text-sm" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})} placeholder="From"/>
          <input type="date" className="glass-input text-sm" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})} placeholder="To"/>
          <button onClick={fetchOrders} className="btn-red text-sm">Apply Filters</button>
        </div>
      </div>

      <div className="glass-table">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead><tr className="border-b border-white/[0.06]">
              {['Order #','Bar','Staff','Total','Payment','Status','Date','Method'].map(h=>(
                <th key={h} className="px-5 py-3 text-[10px] font-semibold text-white/30 uppercase text-left">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="px-5 py-12 text-center text-white/30">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan="8" className="px-5 py-12 text-center text-white/30">No orders found</td></tr>
              ) : orders.map(o=>(
                <tr key={o.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-sm font-medium text-white">{o.order_number}</td>
                  <td className="px-5 py-3 text-xs text-white/60">{o.bar_name}</td>
                  <td className="px-5 py-3 text-xs text-white/50">{o.staff_name||'N/A'}</td>
                  <td className="px-5 py-3 text-sm font-bold text-white">{formatCurrency(o.total_amount)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${paymentColors[o.payment_status]||'bg-gray-500/20 text-gray-400'}`}>
                      {o.payment_status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[o.status]||'bg-gray-500/20 text-gray-400'}`}>
                      {o.status?.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-white/40">{formatDateTime(o.created_at)}</td>
                  <td className="px-5 py-3 text-xs text-white/50">{o.payment_method||'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {orders.length > 0 && (
        <div className="glass-card px-5 py-3 text-xs text-white/40">
          Showing {orders.length} order{orders.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
