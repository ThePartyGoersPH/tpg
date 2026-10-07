import { useEffect, useState } from 'react';
import { paymentService } from '../services/paymentService';

function PaymentHistoryPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', payment_type: '' });

  useEffect(() => {
    loadPayments();
  }, [filter]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.payment_type) params.payment_type = filter.payment_type;
      const data = await paymentService.myHistory(params);
      setPayments(data);
    } catch (error) {
      console.error('Failed to load payment history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#22c55e';
      case 'pending': return '#f59e0b';
      case 'processing': return '#3b82f6';
      case 'failed': return '#ef4444';
      case 'refunded': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getMethodLabel = (method) => {
    switch (method) {
      case 'gcash': return 'GCash';
      case 'paymaya': return 'PayMaya';
      case 'card': return 'Card';
      case 'cash': return 'Cash';
      default: return method || 'N/A';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="page-container">
      <div className="section-header-row">
        <div>
          <h1 className="section-title">Payment History</h1>
          <p className="section-subtitle">View all your transactions</p>
        </div>
      </div>

      <div className="filter-row" style={{ marginBottom: '1.5rem' }}>
        <select
          className="form-select"
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select
          className="form-select"
          value={filter.payment_type}
          onChange={(e) => setFilter((f) => ({ ...f, payment_type: e.target.value }))}
        >
          <option value="">All Types</option>
          <option value="order">Orders</option>
          <option value="reservation">Reservations</option>
        </select>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Loading payments...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>💳</p>
          <h3>No payments found</h3>
          <p className="text-muted">Your payment transactions will appear here.</p>
        </div>
      ) : (
        <div className="payments-list">
          {payments.map((payment) => (
            <div key={payment.id} className="payment-card card">
              <div className="payment-card-top">
                <div className="payment-info">
                  <span className="payment-ref">#{payment.reference_id}</span>
                  <span className="payment-type-badge">
                    {payment.payment_type === 'order' ? '🛒 Order' : '📅 Reservation'}
                  </span>
                </div>
                <div
                  className="payment-status-badge"
                  style={{ backgroundColor: getStatusColor(payment.status) }}
                >
                  {payment.status}
                </div>
              </div>
              <div className="payment-card-body">
                <div className="payment-amount">₱{Number(payment.amount).toFixed(2)}</div>
                <div className="payment-details">
                  <span>Method: {getMethodLabel(payment.payment_method)}</span>
                  <span>Date: {formatDate(payment.created_at)}</span>
                  {payment.paid_at && <span>Paid: {formatDate(payment.paid_at)}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PaymentHistoryPage;
