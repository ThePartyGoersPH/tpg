import { useEffect, useState, useRef } from 'react';
import { useView } from '../hooks/useView';
import { VIEWS } from '../contexts/ViewContext';
import { XCircle } from 'lucide-react';
import { paymentService } from '../services/paymentService';

function PaymentFailedView() {
  const { viewParams, navigate } = useView();
  const referenceId = viewParams.ref;
  const [countdown, setCountdown] = useState(5);
  const countdownRef = useRef(null);

  useEffect(() => {
    // Mark as handled and immediately replace URL to prevent reload loop
    if (referenceId) {
      const paymentSessionKey = `payment_failed_${referenceId}`;
      sessionStorage.setItem(paymentSessionKey, 'true');
      paymentService.cancelPaymentByReference(referenceId).catch(() => {});
    } else {
      // No reference ID, redirect to reservations immediately
      navigate(VIEWS.RESERVATIONS);
      return;
    }
    
    // Immediately replace URL to prevent reload loop
    window.history.replaceState({}, '', '/');
    // Start 5-second countdown then redirect to reservations
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
  }, [referenceId, navigate]);

  return (
    <div className="result-page">
      <div className="glass-card result-card">
        <div className="result-icon"><XCircle size={52} strokeWidth={1.5} style={{ color: '#f59e0b' }} /></div>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 800, lineHeight: 1.1, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>PAYMENT <span style={{ color: '#f59e0b' }}>CANCELLED</span></h1>
        <p className="text-muted mt-sm">Your payment was cancelled. No charges were made.</p>

        {referenceId && (
          <div className="result-details">
            <div className="detail-row">
              <span>Reference</span>
              <strong>{referenceId}</strong>
            </div>
          </div>
        )}

        <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: '1rem' }}>
          Redirecting to reservations in <strong style={{ color: '#f59e0b' }}>{countdown}s</strong>…
        </p>
        <div className="flex gap-md justify-center mt-sm">
          <button className="btn btn-red" onClick={() => { clearInterval(countdownRef.current); navigate(VIEWS.RESERVATIONS); }}>
            Back to Reservations
          </button>
          <button className="btn btn-glass" onClick={() => { clearInterval(countdownRef.current); navigate(VIEWS.PAYMENTS); }}>
            Payment History
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentFailedView;
