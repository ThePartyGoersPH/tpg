import { useCallback, useEffect, useMemo, useState } from 'react';
import { posApi } from '../api/pos';
import { confirmDialog } from '../utils/confirmDialog';

function currency(value) {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export default function OrdersTab({ canManage, canView }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [paying, setPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await posApi.listOrders({ limit: 150, status: filter || undefined });
      setOrders(data?.data || data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [canView, filter]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openDetails = async (orderId) => {
    setError('');
    try {
      const { data } = await posApi.getOrder(orderId);
      const detail = data?.data || data;
      setSelectedOrder(detail);
      setPaymentMethod('cash');
      setAmountReceived(String(Number(detail.total_amount || 0)));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load order details.');
    }
  };

  const payOrder = async () => {
    if (!selectedOrder || !canManage) return;
    setPaying(true);
    setError('');

    try {
      const payload = {
        payment_method: paymentMethod,
      };

      if (paymentMethod === 'cash') {
        payload.amount_received = Number(amountReceived || 0);
      }

      await posApi.payOrder(selectedOrder.id, payload);
      setSelectedOrder(null);
      await loadOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to process payment.');
    } finally {
      setPaying(false);
    }
  };

  const cancelOrder = async (orderId) => {
    if (!canManage) return;
    const ok = await confirmDialog({ title: 'Cancel this order?', confirmText: 'Cancel Order', danger: true });
    if (!ok) return;

    try {
      await posApi.cancelOrder(orderId);
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
      await loadOrders();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to cancel order.');
    }
  };

  const rows = useMemo(() => orders || [], [orders]);

  if (!canView) {
    return <p className="error-msg">You do not have permission to view POS orders.</p>;
  }

  return (
    <section className="tab-panel">
      <div className="panel-header">
        <h2>Orders</h2>
        <div className="row-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={loadOrders}>Refresh</button>
        </div>
      </div>

      {loading ? <p className="empty-note">Loading orders...</p> : null}
      {error ? <p className="error-msg">{error}</p> : null}

      {!loading && rows.length === 0 ? <p className="empty-note">No orders found.</p> : null}

      {!loading && rows.length > 0 ? (
        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Status</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id}>
                  <td>{order.order_number || order.id}</td>
                  <td>{order.status}</td>
                  <td>{currency(order.total_amount)}</td>
                  <td>{order.payment_method || '-'}</td>
                  <td>{order.created_at ? new Date(order.created_at).toLocaleString() : '-'}</td>
                  <td className="row-actions">
                    <button onClick={() => openDetails(order.id)}>View</button>
                    {order.status === 'pending' && canManage ? (
                      <button className="danger" onClick={() => cancelOrder(order.id)}>
                        Cancel
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Order {selectedOrder.order_number || selectedOrder.id}</h3>
            <p>Status: {selectedOrder.status}</p>
            <p>Total: {currency(selectedOrder.total_amount)}</p>

            <div className="items-list">
              {(selectedOrder.items || []).map((item) => (
                <div key={item.id} className="item-row">
                  <span>{item.item_name} x {item.quantity}</span>
                  <strong>{currency(item.subtotal)}</strong>
                </div>
              ))}
            </div>

            {selectedOrder.status === 'pending' && canManage ? (
              <div className="payment-box">
                <label>
                  Payment Method
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="paymaya">PayMaya</option>
                  </select>
                </label>

                {paymentMethod === 'cash' ? (
                  <label>
                    Amount Received
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                    />
                  </label>
                ) : null}

                <button onClick={payOrder} disabled={paying}>
                  {paying ? 'Processing...' : 'Mark as Paid'}
                </button>
              </div>
            ) : null}

            <button className="ghost" onClick={() => setSelectedOrder(null)}>Close</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
