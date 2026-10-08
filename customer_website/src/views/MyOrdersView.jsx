import { useEffect, useState } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { orderService } from '../services/orderService';
import { formatDateTime } from '../utils/dateHelpers';
import { ShoppingBag, Receipt, CheckCircle, Clock, XCircle, ArrowRight, Plus } from 'lucide-react';

function fmt(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusPill({ status, paymentStatus }) {
  if (status === 'cancelled') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}>
      <XCircle size={11} /> Cancelled
    </span>
  );
  if (paymentStatus === 'paid' || status === 'completed' || status === 'paid') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
      <CheckCircle size={11} /> Paid
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
      <Clock size={11} /> Pending
    </span>
  );
}

export default function MyOrdersView() {
  const { navigate } = useView();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true); setErr('');
    orderService.myOrders({ limit: 30 })
      .then(data => setOrders(Array.isArray(data) ? data : []))
      .catch(e => setErr(e?.response?.data?.message || 'Failed to load orders.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-state" style={{ minHeight: '60vh' }}>
      <div className="spinner" /><span>Loading orders...</span>
    </div>
  );

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 0 4rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingTop: '0.5rem' }}>
        <div>
          <h1 className="text-h2" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShoppingBag size={24} style={{ color: 'var(--red)' }} /> My Orders
          </h1>
          <p className="text-muted" style={{ margin: 0, fontSize: '0.82rem' }}>Your web order history</p>
        </div>
        <button className="btn btn-red btn-sm" onClick={() => navigate(VIEWS.BARS)}>
          <Plus size={14} /> New Order
        </button>
      </div>

      {err && <div className="alert alert-error mb-md">{err}</div>}

      {orders.length === 0 && !loading ? (
        <div className="glass-card empty-state" style={{ padding: '3.5rem' }}>
          <div className="empty-icon"><ShoppingBag size={44} /></div>
          <h3 className="text-h3">No orders yet</h3>
          <p className="text-muted">Start your first online order from any bar on the platform.</p>
          <button className="btn btn-red mt-md" onClick={() => navigate(VIEWS.BARS)}>
            Browse Bars
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {orders.map(order => (
            <div key={order.id} className="glass-card glass-card-body" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              gap: '1rem', flexWrap: 'wrap', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
              onClick={() => navigate(VIEWS.ORDER_RECEIPT, { orderId: order.id })}
            >
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{order.bar_name}</span>
                  <StatusPill status={order.status} paymentStatus={order.payment_status} />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span>Order# <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{order.order_number}</span></span>
                  {order.or_number && (
                    <span>OR# <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f87171' }}>{order.or_number}</span></span>
                  )}
                  <span>{formatDateTime(order.created_at)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem', color: '#f87171' }}>{fmt(order.total_amount)}</span>
                {Number(order.tax_amount) > 0 && (
                  <span style={{ fontSize: '0.72rem', color: '#fbbf24' }}>
                    incl. {order.tax_type_snapshot} {fmt(order.tax_amount)}
                  </span>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                  onClick={e => { e.stopPropagation(); navigate(VIEWS.ORDER_RECEIPT, { orderId: order.id }); }}
                >
                  <Receipt size={13} /> Receipt <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
