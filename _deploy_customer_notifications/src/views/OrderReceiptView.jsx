import { useEffect, useState } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { orderService } from '../services/orderService';
import { ArrowLeft, Printer, CheckCircle, Clock, XCircle, Receipt, MapPin, Phone, Mail } from 'lucide-react';

function fmt(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(dt) {
  if (!dt) return '—';
  try {
    return new Date(dt).toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch (_) { return dt; }
}

function StatusBadge({ status, paymentStatus }) {
  const paid = paymentStatus === 'paid';
  const cancelled = status === 'cancelled';
  const completed = status === 'completed' || status === 'paid';

  if (cancelled) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
      <XCircle size={13} /> Cancelled
    </span>
  );
  if (paid || completed) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.22)' }}>
      <CheckCircle size={13} /> {paid ? 'Paid' : 'Completed'}
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.22)' }}>
      <Clock size={13} /> Pending Payment
    </span>
  );
}

export default function OrderReceiptView() {
  const { viewParams, navigate, goBack, canGoBack } = useView();
  const orderId = viewParams?.orderId;

  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!orderId) { setErr('No order specified.'); setLoading(false); return; }
    setLoading(true); setErr('');
    orderService.getReceipt(orderId)
      .then(data => setReceipt(data))
      .catch(e => setErr(e?.response?.data?.message || 'Failed to load receipt.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return (
    <div className="loading-state" style={{ minHeight: '60vh' }}>
      <div className="spinner" /><span>Loading receipt...</span>
    </div>
  );

  if (err || !receipt) return (
    <div className="empty-state" style={{ minHeight: '60vh' }}>
      <div className="empty-icon">⚠️</div>
      <h3 className="text-h3">Receipt not found</h3>
      <p className="text-muted">{err || 'This receipt could not be loaded.'}</p>
      <button className="btn btn-ghost btn-sm mt-md" onClick={() => navigate(VIEWS.MY_ORDERS)}>
        <ArrowLeft size={14} /> My Orders
      </button>
    </div>
  );

  const hasTax = Number(receipt.tax_amount) > 0;
  const taxLabel = receipt.tax_type_snapshot === 'VAT' ? 'VAT' : 'Tax';

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 0 4rem' }}>

      {/* Back + Print */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingTop: '0.5rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => canGoBack ? goBack() : navigate(VIEWS.MY_ORDERS)}>
          <ArrowLeft size={16} /> Back
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
          <Printer size={15} /> Print
        </button>
      </div>

      {/* ── Receipt Card ── */}
      <div className="glass-card" id="receipt-printable" style={{ overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(204,0,0,0.25), rgba(139,0,0,0.15))',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '1.75rem 1.75rem 1.25rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🧾</div>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.3rem', fontWeight: 800 }}>{receipt.bar_name}</h2>
          {receipt.bar_address && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
              <MapPin size={11} /> {receipt.bar_address}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            {receipt.bar_phone && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Phone size={10} /> {receipt.bar_phone}
              </span>
            )}
            {receipt.bar_email && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Mail size={10} /> {receipt.bar_email}
              </span>
            )}
          </div>

          {/* BIR info */}
          {receipt.is_bir_registered && receipt.bar_tin && (
            <div style={{
              marginTop: '0.75rem', padding: '0.4rem 1rem',
              background: 'rgba(251,191,36,0.08)', borderRadius: '8px',
              border: '1px solid rgba(251,191,36,0.2)',
              display: 'inline-block',
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fbbf24', letterSpacing: '0.5px' }}>
                BIR REGISTERED · TIN: {receipt.bar_tin}
              </span>
            </div>
          )}
        </div>

        <div style={{ padding: '1.5rem 1.75rem' }}>

          {/* OR Number + Status */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem',
            padding: '0.9rem 1rem', borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Official Receipt No.
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 800, color: '#f87171' }}>
                {receipt.or_number || '—'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <StatusBadge status={receipt.status} paymentStatus={receipt.payment_status} />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.4rem' }}>
                {formatDateTime(receipt.created_at)}
              </div>
            </div>
          </div>

          {/* Order number */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem',
          }}>
            <span>Order #</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{receipt.order_number}</span>
          </div>

          {/* Dashed divider */}
          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '1rem 0' }} />

          {/* Items */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Items Ordered
            </div>
            {(receipt.items || []).map((item, idx) => (
              <div key={idx} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: '0.88rem',
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{item.item_name}</span>
                  <span style={{ color: 'var(--text-dim)', marginLeft: '0.5rem', fontSize: '0.78rem' }}>
                    × {item.quantity} @ {fmt(item.unit_price)}
                  </span>
                </div>
                <span style={{ fontWeight: 700 }}>{fmt(item.subtotal)}</span>
              </div>
            ))}
          </div>

          {/* Dashed divider */}
          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', margin: '1rem 0' }} />

          {/* Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                Subtotal
                {hasTax && receipt.tax_mode === 'INCLUSIVE' ? ' (tax-inclusive)' : ''}
              </span>
              <span>{fmt(receipt.subtotal)}</span>
            </div>

            {hasTax && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  {taxLabel} ({Number(receipt.tax_rate_snapshot || 0)}%
                  {receipt.tax_mode === 'INCLUSIVE' ? ', inclusive' : ''})
                </span>
                <span style={{ color: '#fbbf24' }}>{fmt(receipt.tax_amount)}</span>
              </div>
            )}

            {receipt.payment_method && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-dim)' }}>Paid via</span>
                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{receipt.payment_method}</span>
              </div>
            )}

            {/* Total */}
            <div style={{ borderTop: '2px solid rgba(255,255,255,0.1)', paddingTop: '0.6rem', marginTop: '0.3rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.15rem' }}>
                <span>TOTAL</span>
                <span style={{ color: '#f87171' }}>{fmt(receipt.total_amount)}</span>
              </div>
              {hasTax && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textAlign: 'right', marginTop: '0.2rem' }}>
                  {receipt.tax_type_snapshot === 'VAT' ? `VAT of ${fmt(receipt.tax_amount)} included` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', marginTop: '1.25rem', paddingTop: '1rem', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Thank you for your order at <strong style={{ color: 'var(--text-muted)' }}>{receipt.bar_name}</strong>!
            </p>
            {receipt.or_number && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.68rem', color: '#666' }}>
                Keep this receipt for your records · OR# {receipt.or_number}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate(VIEWS.MY_ORDERS)}>
          <Receipt size={15} /> My Orders
        </button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate(VIEWS.BARS)}>
          Order Again
        </button>
      </div>
    </div>
  );
}
