import { useEffect, useState } from 'react';
import { paymentService } from '../services/paymentService';
import { formatDate, formatTime } from '../utils/dateHelpers';
import { Star, MapPin, TrendingUp, CalendarDays, Clock, CreditCard, Utensils } from 'lucide-react';

function parseOrderItems(notes) {
  if (!notes) return [];
  const match = notes.match(/Order:\s*(.+)/i);
  if (!match) return [];
  return match[1].split(',').map(s => s.trim()).filter(Boolean);
}

function parseItemizedOrder(notes) {
  if (!notes) return { tablePrice: 0, menuItems: [] };
  const result = { tablePrice: 0, menuItems: [] };
  
  const tablePriceMatch = notes.match(/Table\s+Price:\s*₱?([\d,]+\.?\d*)/i);
  if (tablePriceMatch) {
    result.tablePrice = parseFloat(tablePriceMatch[1].replace(/,/g, ''));
  }
  
  const menuMatch = notes.match(/Menu\s+Items?:\s*(.+?)(?=(?:Table\s+Price|$))/is);
  if (menuMatch) {
    const itemsText = menuMatch[1];
    const itemLines = itemsText.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    result.menuItems = itemLines.map(line => {
      const priceMatch = line.match(/(.+?)\s*[-–]\s*₱?([\d,]+\.?\d*)/);
      if (priceMatch) {
        return { name: priceMatch[1].trim(), price: parseFloat(priceMatch[2].replace(/,/g, '')) };
      }
      return { name: line, price: 0 };
    });
  }
  
  return result;
}

async function settlePayment(referenceId, attempts = 5, delayMs = 1500) {
  let lastResult = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      lastResult = await paymentService.confirmPaymentByReference(referenceId);
      const status = String(lastResult?.status || '').toLowerCase();
      if (status === 'paid' || status === 'cancelled') return lastResult;
    } catch (_) {}
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return lastResult;
}

function getPaymentStatus(payment) {
  const status = (payment.status || '').toLowerCase();
  const paymentStatus = (payment.payment_status || '').toLowerCase();
  const reservationPaymentStatus = (payment.reservation_payment_status || '').toLowerCase();
  const reservationStatus = (payment.reservation_status || '').toLowerCase();
  const orderStatus = (payment.order_status || '').toLowerCase();
  
  // If reservation/order is cancelled, payment is cancelled regardless of payment_transactions.status
  if (payment.payment_type === 'reservation' && reservationStatus === 'cancelled') {
    return 'cancelled';
  }
  if (payment.payment_type === 'order' && orderStatus === 'cancelled') {
    return 'cancelled';
  }
  
  if (
    payment.payment_type === 'reservation' &&
    (reservationPaymentStatus === 'partial' || Number(payment.remaining_balance || 0) > 0)
  ) {
    return 'partial';
  }
  
  if (status === 'paid' || status === 'completed' || status === 'success' || paymentStatus === 'paid' || paymentStatus === 'completed') {
    return 'paid';
  }
  if (status.includes('cancel') || paymentStatus.includes('cancel')) {
    return 'cancelled';
  }
  if (status === 'failed' || paymentStatus === 'failed') {
    return 'failed';
  }
  if (status === 'pending' || paymentStatus === 'pending') {
    return 'pending';
  }
  return 'paid';
}

function PaymentDetailModal({ payment, onClose }) {
  if (!payment) return null;
  
  const itemized = parseItemizedOrder(payment.notes || payment.reservation_notes || '');
  const items = parseOrderItems(payment.notes || payment.reservation_notes || '');
  const status = getPaymentStatus(payment);
  const menuTotal = itemized.menuItems.reduce((sum, item) => sum + item.price, 0);
  const grandTotal = itemized.tablePrice + menuTotal;
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-h3">Payment Details</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body flex flex-col gap-md">
          <div className="flex gap-sm items-center flex-wrap">
            <span className={`payment-status ${status}`}>
              {status === 'paid' ? 'Paid' : status === 'partial' ? 'Partially Paid' : status === 'cancelled' ? 'Cancelled' : status === 'failed' ? 'Failed' : 'Pending'}
            </span>
            {payment.bar_name && <span className="badge-glass">{payment.bar_name}</span>}
          </div>

          {payment.transaction_number && (
            <div style={{ background: 'rgba(232,0,30,0.08)', border: '1px solid var(--red-primary)', borderRadius: '8px', padding: '0.6rem 1rem' }}>
              <p className="text-label" style={{ fontSize: '0.7rem', marginBottom: '0.2rem' }}>TRANSACTION NUMBER</p>
              <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--red-primary)' }}>{payment.transaction_number}</p>
              <p className="text-dim" style={{ fontSize: '0.7rem', marginTop: '0.2rem' }}>Share this with the bar to confirm your reservation</p>
            </div>
          )}
          {payment.reference_id && (
            <div className="res-detail-section">
              <p className="text-label mb-sm">Reference ID</p>
              <p className="text-body" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{payment.reference_id}</p>
            </div>
          )}

          {payment.table_number && (
            <div className="res-detail-section">
              <p className="text-label mb-sm">Table Reservation</p>
              <div className="flex justify-between items-center">
                <p className="text-body" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Utensils size={13} /> Table #{payment.table_number}{payment.party_size ? ` · Party of ${payment.party_size}` : ''}</p>
                {itemized.tablePrice > 0 && <span className="text-body">₱{itemized.tablePrice.toFixed(2)}</span>}
              </div>
            </div>
          )}

          {itemized.menuItems.length > 0 && (
            <div className="res-detail-section">
              <p className="text-label mb-sm">Menu Items</p>
              <div className="flex flex-col gap-sm">
                {itemized.menuItems.map((item, i) => (
                  <div key={i} className="flex justify-between items-start gap-md">
                    <span className="text-body" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Utensils size={13} /> {item.name}</span>
                    {item.price > 0 && <span className="text-body">₱{item.price.toFixed(2)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length > 0 && itemized.menuItems.length === 0 && (
            <div className="res-detail-section">
              <p className="text-label mb-sm">Order Items</p>
              <div className="flex flex-col gap-sm">
                {items.map((item, i) => (
                  <div key={i} className="phc-item">
                    <Utensils size={13} style={{ flexShrink: 0 }} />
                    <span className="text-body">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="res-detail-section">
            <p className="text-label mb-sm">Date & Time</p>
            <p className="text-body">
              {payment.reservation_date
                ? <><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><CalendarDays size={13} /> {formatDate(payment.reservation_date)}</span>{payment.reservation_time && <span style={{ marginLeft: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Clock size={13} /> {formatTime(payment.reservation_time)}</span>}</>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><CalendarDays size={13} /> {formatDate(payment.created_at)}</span>
              }
            </p>
          </div>

          <div className="res-detail-section">
            <p className="text-label mb-sm">Payment Method</p>
            <p className="text-body">{payment.payment_method?.toUpperCase() || 'N/A'}</p>
          </div>

          <div className="cart-total-box" style={{ marginTop: '0.5rem' }}>
            {itemized.tablePrice > 0 && (
              <div className="cart-total-row">
                <span>Table Reservation</span>
                <span>₱{itemized.tablePrice.toFixed(2)}</span>
              </div>
            )}
            {itemized.menuItems.map((item, i) => (
              <div className="cart-total-row" key={i}>
                <span>{item.name}</span>
                <span>₱{item.price.toFixed(2)}</span>
              </div>
            ))}
            {payment.total_order_amount > 0 ? (
              <>
                <div className="cart-total-row">
                  <span>Total Order</span>
                  <span>₱{Number(payment.total_order_amount).toFixed(2)}</span>
                </div>
                <div className="cart-grand-total">
                  <span>Down Payment Paid</span>
                  <span>₱{Number(payment.amount || 0).toFixed(2)}</span>
                </div>
                {payment.remaining_balance > 0 && (
                  <div className="cart-total-row" style={{ color: '#fbbf24', fontWeight: 600 }}>
                    <span>Remaining Balance (collect in person)</span>
                    <span>₱{Number(payment.remaining_balance).toFixed(2)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="cart-grand-total">
                <span>Total Amount</span>
                <span>₱{(grandTotal > 0 ? grandTotal : Number(payment.amount || 0)).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function computeFavoriteBar(payments) {
  if (!payments.length) return null;
  const barMap = {};
  for (const p of payments) {
    const effectiveStatus = getPaymentStatus(p);
    if (effectiveStatus !== 'paid') continue;
    const key = p.bar_id || p.bar_name;
    if (!key) continue;
    if (!barMap[key]) barMap[key] = { bar_id: p.bar_id, bar_name: p.bar_name || `Bar #${p.bar_id}`, visits: 0, totalSpent: 0 };
    barMap[key].visits++;
    barMap[key].totalSpent += Number(p.amount || 0);
  }
  const bars = Object.values(barMap);
  if (!bars.length) return null;
  return bars.sort((a, b) => b.visits - a.visits || b.totalSpent - a.totalSpent)[0];
}

function PaymentsView() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const data = await paymentService.myHistory();
      const list = Array.isArray(data) ? data : [];
      setPayments(list);

      // Auto-check any pending payments against PayMongo
      const pending = list.filter(p => (p.status || '').toLowerCase() === 'pending' && p.reference_id);
      if (pending.length) {
        await Promise.allSettled(pending.map(p => settlePayment(p.reference_id)));
        // Refresh list after checks
        const updated = await paymentService.myHistory();
        setPayments(Array.isArray(updated) ? updated : list);
      }
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load payment history.');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const handleCancel = async (e, referenceId) => {
    e.stopPropagation();
    setCancellingId(referenceId);
    try {
      await paymentService.cancelPaymentByReference(referenceId);
      setPayments(prev => prev.map(p =>
        p.reference_id === referenceId ? { ...p, status: 'cancelled' } : p
      ));
    } catch (_) {}
    finally { setCancellingId(null); }
  };

  if (loading) return <div className="loading-state" style={{ minHeight: '50vh' }}><div className="spinner" /><span>Loading payments...</span></div>;

  const favoriteBar = computeFavoriteBar(payments);

  return (
    <div className="flex flex-col gap-xl">
      <div className="animate-in">
        <span className="home-eyebrow">PAYMENTS</span>
        <h1 className="home-section-title" style={{ marginTop: '0.5rem' }}>PAYMENT <span className="home-accent">HISTORY</span></h1>
        <p className="home-section-sub">Click any payment to view detailed breakdown.</p>
      </div>

      {payments.length > 0 && (
        <div className="home-stats animate-in" style={{ margin: 0 }}>
          <div className="home-stat" style={{ cursor: 'default' }}>
            <span className="home-stat-num" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)' }}>₱{payments.filter(p => getPaymentStatus(p) === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString('en', { minimumFractionDigits: 2 })}</span>
            <span className="home-stat-label">Total Paid</span>
          </div>
          {favoriteBar && (
            <div className="home-stat" style={{ cursor: 'default', flex: 2 }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}><Star size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.35rem', color: '#CC0000' }} />{favoriteBar.bar_name}</span>
              <span className="home-stat-label">{favoriteBar.visits} visit{favoriteBar.visits !== 1 ? 's' : ''} · ₱{favoriteBar.totalSpent.toLocaleString('en', { minimumFractionDigits: 2 })} spent</span>
            </div>
          )}
        </div>
      )}

      {err && <div className="alert alert-err">{err}</div>}

      {payments.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-icon"><CreditCard size={32} /></div>
          <h3 className="text-h3">No payments yet</h3>
          <p className="text-muted mt-sm">Your payment history will appear here after your first reservation.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {payments.map(p => {
            const status = getPaymentStatus(p);
            const items = parseOrderItems(p.notes || p.reservation_notes || '');
            return (
              <div 
                className="glass-card payment-history-card" 
                key={p.id}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedPayment(p)}
              >
                <div className="phc-header">
                  <div className="phc-left">
                    <div className="phc-bar">{p.bar_name || `Bar #${p.bar_id || '—'}`}</div>
                    <div className="phc-amount">₱{Number(p.amount || 0).toFixed(2)}</div>
                  </div>
                  <div className="phc-right">
                    <span className={`payment-status ${status === 'partial' ? 'approved' : status}`}>
                      {status === 'paid' ? 'Paid' : status === 'partial' ? 'Partially Paid' : status === 'cancelled' ? 'Cancelled' : status === 'failed' ? 'Failed' : 'Pending'}
                    </span>
                    <div className="phc-meta">{p.payment_method?.toUpperCase() || '—'}</div>
                  </div>
                </div>

                <div className="phc-details">
                  <div className="phc-purchase">
                    <span className="text-label">What was reserved</span>
                    <div className="phc-items-list">
                      {p.table_number && (
                        <div className="phc-item">
                          <Utensils size={14} style={{ flexShrink: 0 }} />
                          <span>Table #{p.table_number}{p.party_size ? ` · Party of ${p.party_size}` : ''}</span>
                        </div>
                      )}
                      {items.length > 0 && items.map((item, i) => (
                        <div className="phc-item" key={i}>
                          <Utensils size={14} style={{ flexShrink: 0 }} />
                          <span>{item}</span>
                        </div>
                      ))}
                      {!p.table_number && items.length === 0 && (
                        <div className="phc-item">
                          <CalendarDays size={14} style={{ flexShrink: 0 }} />
                          <span>Table Reservation</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="phc-datetime">
                    <span className="text-label">Date & Time</span>
                    <div style={{ marginTop: '0.25rem' }}>
                      {p.reservation_date
                        ? <><span className="text-body">{formatDate(p.reservation_date)}</span>{p.reservation_time && <span className="text-muted" style={{ marginLeft: '0.5rem' }}>at {formatTime(p.reservation_time)}</span>}</>
                        : <span className="text-muted">{formatDate(p.created_at)}</span>
                      }
                    </div>
                  </div>
                </div>

                {p.transaction_number && (
                  <p className="text-muted" style={{ fontSize: '0.72rem', fontFamily: 'monospace', padding: '0.25rem 1.5rem 0' }}>#{p.transaction_number}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem 1rem' }}>
                  <p className="text-dim mt-sm" style={{ fontSize: '0.75rem', margin: 0 }}>Tap to view full details →</p>
                  {status === 'pending' && (
                    <button
                      className="btn btn-glass"
                      style={{ fontSize: '0.72rem', padding: '0.25rem 0.75rem', borderRadius: 6, opacity: cancellingId === p.reference_id ? 0.6 : 1 }}
                      disabled={cancellingId === p.reference_id}
                      onClick={(e) => handleCancel(e, p.reference_id)}
                    >
                      {cancellingId === p.reference_id ? 'Cancelling…' : 'Cancel Payment'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPayment && (
        <PaymentDetailModal 
          payment={selectedPayment} 
          onClose={() => setSelectedPayment(null)} 
        />
      )}
    </div>
  );
}

export default PaymentsView;
