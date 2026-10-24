import { useSearchParams, Link } from 'react-router-dom';

function PaymentFailedPage() {
  const [searchParams] = useSearchParams();
  const referenceId = searchParams.get('ref');

  return (
    <div className="payment-result-page">
      <div className="card payment-result-card failed">
        <div className="result-icon">❌</div>
        <h1>Payment Failed</h1>
        <p>We were unable to process your payment. Please try again.</p>

        {referenceId && (
          <div className="payment-result-details">
            <div className="detail-row">
              <span>Reference</span>
              <strong>{referenceId}</strong>
            </div>
          </div>
        )}

        <div className="payment-result-actions">
          <Link to="/dashboard/reservations" className="button">
            Back to Reservations
          </Link>
          <Link to="/dashboard/payments" className="button outline">
            Payment History
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PaymentFailedPage;
