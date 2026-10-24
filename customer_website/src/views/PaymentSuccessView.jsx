import { useEffect, useState, useRef } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { paymentService } from '../services/paymentService';
import { formatDate, formatTime } from '../utils/dateHelpers';
import { CheckCircle } from 'lucide-react';

const CART_STORAGE_KEY = 'bar_cart_data';

function PaymentSuccessView() {
  const { viewParams, navigate } = useView();
  const referenceId = viewParams.ref;
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const countdownRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const verifyPayment = async () => {
      if (!referenceId) {
        setLoading(false);
        navigate(VIEWS.RESERVATIONS);
        return;
      }

      // Mark this payment as seen immediately
      const paymentSessionKey = `payment_success_${referenceId}`;
      sessionStorage.setItem(paymentSessionKey, 'true');

      // Immediately replace URL to prevent reload loop
      window.history.replaceState({}, '', '/');

      try {
        let details = null;
        for (let attempt = 0; attempt < 6; attempt += 1) {
          let confirmResult = null;
          try {
            confirmResult = await paymentService.confirmPaymentByReference(referenceId);
          } catch (_) {}

          try {
            details = await paymentService.getPaymentByReference(referenceId);
          } catch (_) {}

          const effectiveStatus = String(confirmResult?.status || details?.status || '').toLowerCase();
          if (effectiveStatus === 'paid' || effectiveStatus === 'cancelled') {
            break;
          }

          if (attempt < 5) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }

        if (!cancelled) {
          setPayment(details);
          if ((details?.status || '').toLowerCase() === 'paid') {
            localStorage.removeItem(CART_STORAGE_KEY);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    verifyPayment();
    return () => {
      cancelled = true;
    };
  }, [referenceId, navigate]);

  const currentStatus = String(payment?.status || '').toLowerCase();

  useEffect(() => {
    if (loading || currentStatus !== 'paid') return;
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          navigate(VIEWS.RESERVATIONS);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [loading, navigate, currentStatus]);

  if (loading) {
    return (
      <div className="result-page">
        <div className="glass-card result-card">
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p className="text-muted mt-md">Verifying payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="result-page">
      <div className="glass-card result-card">
        <div className="result-icon"><CheckCircle size={52} strokeWidth={1.5} style={{ color: currentStatus === 'cancelled' ? '#f59e0b' : currentStatus === 'paid' ? '#22c55e' : '#fbbf24' }} /></div>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          PAYMENT <span style={{ color: 'var(--color-red-primary)' }}>{currentStatus === 'paid' ? 'CONFIRMED' : currentStatus === 'cancelled' ? 'CANCELLED' : 'PROCESSING'}</span>
        </h1>
        <p className="text-muted mt-sm">{currentStatus === 'paid' ? 'Your payment has been processed successfully.' : currentStatus === 'cancelled' ? 'Your payment was cancelled.' : 'We are still verifying your payment with PayMongo.'}</p>

        {payment && (
          <div className="result-details">
            <div className="detail-row">
              <span>Reference Number</span>
              <strong>#{payment.transaction_number || payment.reference_id}</strong>
            </div>
            
            {payment.bar_name && (
              <div className="detail-row">
                <span>Bar</span>
                <strong>{payment.bar_name}</strong>
              </div>
            )}
            
            {payment.table_number && (
              <div className="detail-row">
                <span>Table</span>
                <strong>{payment.table_number}</strong>
              </div>
            )}
            
            {payment.reservation_date && (
              <div className="detail-row">
                <span>Date & Time</span>
                <strong>
                  {formatDate(payment.reservation_date)}
                  {payment.reservation_time && ` · ${formatTime(payment.reservation_time)}`}
                </strong>
              </div>
            )}
            
            {payment.party_size && (
              <div className="detail-row">
                <span>Party Size</span>
                <strong>{payment.party_size} {payment.party_size === 1 ? 'guest' : 'guests'}</strong>
              </div>
            )}

            {payment.line_items && payment.line_items.length > 0 && (
              <div className="detail-section mt-md">
                <p className="text-label mb-sm">Items Ordered:</p>
                {payment.line_items.map((item, idx) => (
                  <div key={idx} className="detail-row" style={{ fontSize: '0.9rem' }}>
                    <span>{item.item_name} x{item.quantity}</span>
                    <span>₱{Number(item.line_total || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {payment.total_order_amount > 0 && (
              <div className="detail-row mt-md" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
                <span>Total Order</span>
                <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>₱{Number(payment.total_order_amount).toFixed(2)}</strong>
              </div>
            )}

            <div className={`detail-row${!payment.total_order_amount ? ' mt-md' : ''}`} style={!payment.total_order_amount ? { borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' } : {}}>
              <span>{payment.remaining_balance > 0 ? 'Down Payment Paid' : 'Total Paid'}</span>
              <strong style={{ fontSize: '1.2rem', color: '#dc2626' }}>₱{Number(payment.amount || 0).toFixed(2)}</strong>
            </div>

            {payment.remaining_balance > 0 && (
              <div className="detail-row" style={{ background: 'rgba(251,191,36,0.08)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem', marginTop: '0.25rem' }}>
                <span style={{ color: '#fbbf24', fontWeight: 600 }}>Remaining Balance</span>
                <strong style={{ fontSize: '1rem', color: '#fbbf24' }}>₱{Number(payment.remaining_balance).toFixed(2)}</strong>
              </div>
            )}

            {payment.remaining_balance > 0 && (
              <p style={{ fontSize: '0.75rem', color: '#888', textAlign: 'center', marginTop: '0.25rem' }}>
                Remaining balance will be collected in person at the bar.
              </p>
            )}

            <div className="detail-row">
              <span>Payment Method</span>
              <strong>{(payment.payment_method || '').toUpperCase()}</strong>
            </div>
          </div>
        )}

        {currentStatus === 'paid' && (
          <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '1rem' }}>
            Redirecting to reservations in <strong style={{ color: '#22c55e' }}>{countdown}s</strong>…
          </p>
        )}
        <div className="flex gap-md justify-center mt-sm">
          <button className="btn btn-red" onClick={() => { clearInterval(countdownRef.current); navigate(VIEWS.RESERVATIONS); }}>
            View My Reservations
          </button>
          <button className="btn btn-glass" onClick={() => { clearInterval(countdownRef.current); navigate(VIEWS.HOME); }}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccessView;
