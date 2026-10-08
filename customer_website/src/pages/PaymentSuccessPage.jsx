import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { paymentService } from '../services/paymentService';

function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const referenceId = searchParams.get('ref');
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const verifyPayment = async () => {
      if (!referenceId) {
        setLoading(false);
        return;
      }

      // Check if this is a fresh payment redirect or a page refresh
      const paymentSessionKey = `payment_success_${referenceId}`;
      const hasSeenSuccess = sessionStorage.getItem(paymentSessionKey);

      if (hasSeenSuccess) {
        // User refreshed the page - redirect to payment history
        navigate('/dashboard/payments', { replace: true });
        return;
      }

      // Mark this payment as seen
      sessionStorage.setItem(paymentSessionKey, 'true');

      try {
        await paymentService.confirmPaymentByReference(referenceId);
      } catch (_) {
        // fallback to read-only status if confirm cannot be resolved yet
      }

      try {
        const data = await paymentService.getPaymentByReference(referenceId);
        if (!cancelled) setPayment(data);
      } catch (error) {
        console.error('Failed to load payment:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    verifyPayment();
    return () => {
      cancelled = true;
    };
  }, [referenceId, navigate]);

  if (loading) {
    return (
      <div className="payment-result-page">
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Verifying payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-page">
      <div className="card payment-result-card success">
        <div className="result-icon">✅</div>
        <h1>Payment Successful!</h1>
        <p>Your payment has been processed successfully.</p>

        {payment && (
          <div className="payment-result-details">
            <div className="detail-row">
              <span>Reference</span>
              <strong>{payment.reference_id}</strong>
            </div>
            <div className="detail-row">
              <span>Amount</span>
              <strong>₱{Number(payment.amount).toFixed(2)}</strong>
            </div>
            <div className="detail-row">
              <span>Status</span>
              <strong className="status-paid">{payment.status}</strong>
            </div>
            <div className="detail-row">
              <span>Method</span>
              <strong>{payment.payment_method?.toUpperCase()}</strong>
            </div>
          </div>
        )}

        <div className="payment-result-actions">
          <Link to="/dashboard/reservations" className="button">
            View My Reservations
          </Link>
          <Link to="/dashboard/payments" className="button outline">
            Payment History
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PaymentSuccessPage;
