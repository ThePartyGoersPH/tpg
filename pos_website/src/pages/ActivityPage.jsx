import { useCallback, useEffect, useState } from 'react';
import { History, LayoutGrid, Map, RefreshCw, Search, Table2, Users, Wallet } from 'lucide-react';
import { io } from 'socket.io-client';
import { confirmDialog } from '../utils/confirmDialog';
import { posApi } from '../api/pos';

function money(value) {
  return Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function formatFriendlyDate(value) {
  if (!value) return '-';

  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatFriendlyTime(value) {
  if (!value) return '-';

  const raw = String(value).trim();
  const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const date = new Date();
    date.setHours(Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3] || 0), 0);
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatFriendlyDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function methodLabel(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'gcash') return 'GCash';
  if (key === 'paymaya') return 'PayMaya';
  if (key === 'cash') return 'Cash';
  return value || 'Unpaid';
}

function tableStatusModel(table) {
  const status = String(table?.status || '').toLowerCase();
  const isBookedReservation = status === 'reserved' && table?.reservation_source === 'booked';
  const hasActiveOrder = status === 'occupied' && table?.active_order;
  const isInactive = Number(table?.is_active || 0) === 0;

  const statusClass = ['available', 'reserved', 'occupied', 'unavailable'].includes(status)
    ? status
    : 'available';

  const tone = statusClass === 'occupied'
    ? 'info'
    : statusClass === 'reserved'
      ? 'warn'
      : statusClass === 'unavailable'
        ? 'danger'
        : 'ok';

  const statusLabel = status === 'occupied'
    ? 'Occupied'
    : status === 'reserved'
      ? (isBookedReservation ? 'Reserved (Booked)' : 'Reserved (Manual)')
      : status === 'unavailable'
        ? 'Unavailable'
        : 'Available';

  const lockReason = hasActiveOrder
    ? `Locked by active order ${table?.active_order?.order_number || `#${table?.active_order?.order_id || ''}`}`
    : isBookedReservation
      ? 'Locked by today\'s customer reservation'
      : isInactive
        ? 'Inactive in back-office settings'
        : '';

  const canChangeTo = (nextStatus) => {
    if (status === nextStatus) return false;
    if (hasActiveOrder || isBookedReservation) return false;
    if (isInactive && nextStatus !== 'unavailable') return false;
    return true;
  };

  return { status, statusClass, tone, statusLabel, lockReason, hasActiveOrder, isBookedReservation, isInactive, canChangeTo };
}

function TableStatusCard({ table, updating, onChangeStatus }) {
  const model = tableStatusModel(table);
  const { status, statusClass, tone, statusLabel, lockReason, canChangeTo } = model;

  const action = (nextStatus, label, toneClass) => (
    <button
      className={`table-action-btn is-${toneClass} ${status === nextStatus ? 'active' : ''}`}
      disabled={updating || !canChangeTo(nextStatus)}
      onClick={() => onChangeStatus(table, nextStatus)}
    >
      {label}
    </button>
  );

  return (
    <article className={`table-card st-${statusClass}`}>
      <div className="table-card-top">
        <span className="table-tag">T-{String(table.table_number || table.id).padStart(2, '0')}</span>
        <span className={`status-pill ${tone}`}><i /> {statusLabel}</span>
      </div>

      <div className="table-meta">
        <strong>{table.capacity || 0}</strong>
        <span>{Number(table.capacity || 0) === 1 ? 'guest' : 'guests'}</span>
      </div>

      <div className="table-actions table-action-group" role="group" aria-label="Table status">
        {action('available', 'Available', 'available')}
        {action('reserved', 'Reserve', 'reserve')}
        {action('unavailable', 'Block', 'block')}
      </div>

      <p className={`table-help ${lockReason ? 'locked' : ''}`}>
        {updating ? 'Updating status…' : lockReason || 'Manual table control'}
      </p>
    </article>
  );
}

function FloorTableTile({ table, onClick }) {
  const { statusClass, tone, statusLabel, lockReason } = tableStatusModel(table);

  return (
    <button type="button" className={`floor-table st-${statusClass}`} onClick={() => onClick(table)}>
      <span className="ft-num">T-{String(table.table_number || table.id).padStart(2, '0')}</span>
      <span className="ft-seats"><Users size={13} /> {table.capacity || 0} seats</span>
      <span className={`status-pill ${tone}`}><i /> {statusLabel}</span>
      <span className="ft-tap">{lockReason ? 'Locked · tap for actions' : 'Tap to manage'}</span>
    </button>
  );
}


export default function ActivityPage({ canManage, canView }) {
  const [mode, setMode] = useState('tables');
  const [viewMode, setViewMode] = useState('grid');
  const [floorTable, setFloorTable] = useState(null);
  const [search, setSearch] = useState('');
  const [reservationTransactionId, setReservationTransactionId] = useState('');
  const [reservationLookupLoading, setReservationLookupLoading] = useState(false);
  const [reservationPayLoading, setReservationPayLoading] = useState(false);
  const [reservationPaymentMethod, setReservationPaymentMethod] = useState('cash');
  const [reservationResult, setReservationResult] = useState(null);
  const [reservationMessage, setReservationMessage] = useState('');

  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(true);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState('');
  const [tableStatusMessage, setTableStatusMessage] = useState('');
  const [tableUpdateBusyId, setTableUpdateBusyId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [paying, setPaying] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [checkoutData, setCheckoutData] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState('');

  const selectedOrderId = selectedOrder?.id ? Number(selectedOrder.id) : null;
  const isOnlinePending = selectedOrder
    && String(selectedOrder.status || '').toLowerCase() === 'pending'
    && ['digital', 'online', 'gcash', 'paymaya'].includes(String(selectedOrder.payment_method || '').toLowerCase());

  const lookupReservation = async () => {
    const txn = String(reservationTransactionId || '').trim();
    if (!txn) {
      setError('Enter a reservation transaction number first.');
      return;
    }

    setError('');
    setReservationMessage('');
    setReservationLookupLoading(true);
    try {
      const { data } = await posApi.lookupReservationByTransaction(txn);
      setReservationResult(data?.data || data || null);
    } catch (err) {
      setReservationResult(null);
      setError(err?.response?.data?.message || 'Failed to lookup reservation transaction.');
    } finally {
      setReservationLookupLoading(false);
    }
  };

  const payReservationBalance = async () => {
    if (!reservationResult?.id || reservationPayLoading) return;
    const ok = await confirmDialog({ title: 'Collect reservation balance?', message: `Collect the remaining balance using ${methodLabel(reservationPaymentMethod)}?`, confirmText: 'Collect' });
    if (!ok) return;

    setReservationPayLoading(true);
    setError('');
    setReservationMessage('');
    try {
      const { data } = await posApi.payReservationBalance(reservationResult.id, {
        payment_method: reservationPaymentMethod,
      });
      setReservationMessage(data?.message || 'Reservation balance paid.');

      const refreshed = await posApi.lookupReservationByTransaction(
        String(reservationResult.transaction_number || reservationTransactionId).trim()
      );
      setReservationResult(refreshed?.data?.data || refreshed?.data || null);
      await loadTables();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to mark reservation balance as paid.');
    } finally {
      setReservationPayLoading(false);
    }
  };

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const { data } = await posApi.getTables();
      setTables(data?.data || data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load tables.');
    } finally {
      setTablesLoading(false);
    }
  }, []);

  const handleSetTableStatus = useCallback(async (table, nextStatus) => {
    const tableId = Number(table?.id || 0);
    if (!tableId || tableUpdateBusyId) return;

    const currentStatus = String(table?.status || '').toLowerCase();
    if (currentStatus === nextStatus) return;

    if (nextStatus === 'available') {
      const confirmed = await confirmDialog({ title: `Mark Table ${String(table?.table_number || tableId).padStart(2, '0')} as available?`, confirmText: 'Mark Available' });
      if (!confirmed) return;
    }

    setError('');
    setReservationMessage('');
    setTableStatusMessage('');
    setTableUpdateBusyId(tableId);

    try {
      const { data } = await posApi.updateTableStatus(tableId, { status: nextStatus });
      setTableStatusMessage(data?.message || `Table ${tableId} updated.`);
      await loadTables();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update table status.');
    } finally {
      setTableUpdateBusyId(null);
    }
  }, [loadTables, tableUpdateBusyId]);

  const loadOrders = useCallback(async () => {
    if (!canView) {
      setOrdersLoading(false);
      return;
    }
    setOrdersLoading(true);
    try {
      const { data } = await posApi.listOrders({ limit: 200, status: statusFilter || undefined });
      setOrders(data?.data || data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load order history.');
    } finally {
      setOrdersLoading(false);
    }
  }, [canView, statusFilter]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredTables = tables.filter((table) => String(table.table_number || table.id).toLowerCase().includes(search.toLowerCase()));
  const filteredOrders = orders.filter((order) => {
    const needle = search.toLowerCase();
    if (!needle) return true;
    return String(order.order_number || order.id).toLowerCase().includes(needle);
  });

  const openDetails = async (id) => {
    setError('');
    try {
      const { data } = await posApi.getOrder(id);
      const nextOrder = data?.data || data;
      setSelectedOrder(nextOrder);
      setPaymentMethod('cash');
      setAmountReceived(String(nextOrder?.total_amount || ''));
      setCheckoutData(null);
      setOnlineStatus('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load order details.');
    }
  };

  const closeDetails = () => {
    setSelectedOrder(null);
    setPaymentMethod('cash');
    setAmountReceived('');
    setCheckoutData(null);
    setOnlineStatus('');
  };

  const refreshSelectedOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    const { data } = await posApi.getOrder(orderId);
    setSelectedOrder(data?.data || data);
  }, []);

  const handleConfirmPayment = async () => {
    if (!selectedOrderId || paying) return;
    setError('');
    setPaying(true);

    try {
      if (paymentMethod === 'cash') {
        const amount = Number(amountReceived || 0);
        const total = Number(selectedOrder?.total_amount || 0);
        if (!amount || amount < total) {
          setError('Amount received must be equal to or greater than total.');
          return;
        }

        await posApi.payOrder(selectedOrderId, {
          payment_method: 'cash',
          amount_received: amount,
        });

        await Promise.all([
          loadOrders(),
          loadTables(),
          refreshSelectedOrder(selectedOrderId),
        ]);

        setCheckoutData(null);
        setOnlineStatus('Payment completed successfully.');
        return;
      }

      const { data } = await posApi.createCheckout({
        order_id: selectedOrderId,
        payment_method: paymentMethod,
      });

      const payload = data?.data || data;
      setCheckoutData(payload || null);
      setOnlineStatus(`Waiting for ${methodLabel(paymentMethod)} payment confirmation...`);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to process payment.');
    } finally {
      setPaying(false);
    }
  };

  const recheckOnlinePayment = useCallback(async (silent = false) => {
    if (!selectedOrderId || reconciling) return;
    setReconciling(true);
    try {
      const { data } = await posApi.reconcileOrderPayment({ order_id: selectedOrderId });
      const result = data?.data || {};

      await Promise.all([
        loadOrders(),
        loadTables(),
        refreshSelectedOrder(selectedOrderId),
      ]);

      if (String(result.status || '').toLowerCase() === 'paid') {
        setCheckoutData(null);
        setOnlineStatus('Payment confirmed by PayMongo.');
      } else if (!silent) {
        setOnlineStatus('Payment is still pending on server. Try again after a few seconds.');
      }
    } catch (err) {
      if (!silent) {
        setError(err?.response?.data?.message || 'Failed to recheck online payment status.');
      }
    } finally {
      setReconciling(false);
    }
  }, [loadOrders, loadTables, reconciling, refreshSelectedOrder, selectedOrderId]);

  const cancelPendingOrder = async () => {
    if (!selectedOrderId || cancellingOrder) return;
    const ok = await confirmDialog({ title: 'Cancel this pending order?', confirmText: 'Cancel Order', danger: true });
    if (!ok) return;

    setCancellingOrder(true);
    setError('');
    try {
      await posApi.cancelOrder(selectedOrderId);
      await Promise.all([loadOrders(), loadTables()]);
      setOnlineStatus('Order cancelled.');
      closeDetails();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to cancel pending order.');
    } finally {
      setCancellingOrder(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('pos_token');
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://api.thepartygoers.fun';
    if (!token || !canView) return undefined;

    const socket = io(apiBaseUrl, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    socket.on('orderPaid', async (payload) => {
      const paidOrderId = Number(payload?.order_id || 0);
      if (!paidOrderId) return;

      try {
        await Promise.all([loadOrders(), loadTables()]);
        if (selectedOrderId && paidOrderId === selectedOrderId) {
          await refreshSelectedOrder(paidOrderId);
          setCheckoutData(null);
          setOnlineStatus('Payment confirmed by PayMongo.');
        }
      } catch {
        // Silent fallback: list refresh will retry via manual refresh button.
      }
    });

    socket.on('orderPaymentFailed', (payload) => {
      const failedOrderId = Number(payload?.order_id || 0);
      if (selectedOrderId && failedOrderId === selectedOrderId) {
        setOnlineStatus('Online payment failed or expired. Generate a new QR to retry.');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [canView, loadOrders, loadTables, refreshSelectedOrder, selectedOrderId]);

  useEffect(() => {
    if (!isOnlinePending || !selectedOrderId) return;
    recheckOnlinePayment(true);
  }, [isOnlinePending, recheckOnlinePayment, selectedOrderId]);

  return (
    <section className="activity-layout">
      <aside className="activity-side">
        <label className="search-box">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={mode === 'tables' ? 'Search table...' : mode === 'history' ? 'Search order...' : 'Search mode disabled here'}
            disabled={mode === 'reservation'}
          />
        </label>

        <button className={mode === 'tables' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('tables')}>
          <Table2 size={16} /> Tables
        </button>
        <button className={mode === 'history' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('history')}>
          <History size={16} /> Order History
        </button>
        <button className={mode === 'reservation' ? 'mode-btn active' : 'mode-btn'} onClick={() => setMode('reservation')}>
          <Wallet size={16} /> Reservation Balance
        </button>

        <div className="activity-note">
          <h4>TPG POS</h4>
          <p>Real-time table and order activity for your floor team.</p>
        </div>
      </aside>

      <div className="activity-main">
        {mode === 'tables' ? (
          <>
            <div className="activity-head">
              <div>
                <h3>Floor &amp; Tables</h3>
                <span className="head-sub">Tap a table to manage its status</span>
              </div>
              <div className="head-actions">
                <div className="view-toggle" role="group" aria-label="Table view">
                  <button
                    type="button"
                    className={viewMode === 'grid' ? 'active' : ''}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid size={14} /> Cards
                  </button>
                  <button
                    type="button"
                    className={viewMode === 'floor' ? 'active' : ''}
                    onClick={() => setViewMode('floor')}
                  >
                    <Map size={14} /> Floor Plan
                  </button>
                </div>
                <button className="btn-secondary" onClick={loadTables} disabled={tablesLoading}>
                  <RefreshCw size={14} /> {tablesLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="floor-legend">
              <span className="legend-chip ok"><i /> Available</span>
              <span className="legend-chip warn"><i /> Reserved</span>
              <span className="legend-chip info"><i /> Occupied</span>
              <span className="legend-chip danger"><i /> Blocked</span>
            </div>

            {tablesLoading && !tables.length ? <p className="empty-note">Loading tables...</p> : null}

            {viewMode === 'grid' ? (
              <div className="tables-grid">
                {filteredTables.map((table) => (
                  <TableStatusCard
                    key={table.id}
                    table={table}
                    updating={tableUpdateBusyId === Number(table.id)}
                    onChangeStatus={handleSetTableStatus}
                  />
                ))}
              </div>
            ) : (
              <div className="floor-plan">
                <div className="floor-grid">
                  {filteredTables.map((table) => (
                    <FloorTableTile key={table.id} table={table} onClick={setFloorTable} />
                  ))}
                </div>
              </div>
            )}

            {!tablesLoading && filteredTables.length === 0 ? (
              <div className="empty-state">
                <span className="es-icon"><Table2 size={20} /></span>
                <strong>No tables found</strong>
                <p>Nothing matches “{search}”. Clear the search to see your full floor.</p>
              </div>
            ) : null}
          </>
        ) : mode === 'history' ? (
          <>
            <div className="activity-head">
              <div>
                <h3>Order History</h3>
                <span className="head-sub">Every order taken on this terminal</span>
              </div>
              <div className="row-actions">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button className="btn-secondary" onClick={loadOrders} disabled={ordersLoading}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
            </div>

            {ordersLoading && !orders.length ? <p className="empty-note">Loading order history...</p> : null}

            <div className="orders-table-wrap">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date &amp; Time</th>
                    <th>Order Number</th>
                    <th>Order Status</th>
                    <th>Total Payment</th>
                    <th>Table Charge</th>
                    <th>Payment</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, index) => {
                    const orderTone = order.status === 'completed'
                      ? 'ok'
                      : order.status === 'pending'
                        ? 'warn'
                        : 'muted';
                    return (
                      <tr key={order.id}>
                        <td className="num">{String(index + 1).padStart(3, '0')}</td>
                        <td>{formatFriendlyDateTime(order.created_at)}</td>
                        <td className="num">{order.order_number || order.id}</td>
                        <td><span className={`status-pill ${orderTone}`}><i /> {order.status}</span></td>
                        <td className="num">PHP {money(order.total_amount)}</td>
                        <td className="num">PHP {money(order.table_price || 0)}</td>
                        <td>{methodLabel(order.payment_method)}</td>
                        <td><button className="btn-secondary" onClick={() => openDetails(order.id)}>Detail</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!ordersLoading && filteredOrders.length === 0 ? (
              <div className="empty-state">
                <span className="es-icon"><History size={20} /></span>
                <strong>No order history yet</strong>
                <p>Orders you take on this terminal will show up here with their payment status.</p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="activity-head">
              <div>
                <h3>Reservation Balance</h3>
                <span className="head-sub">Look up a booking and collect its remaining balance</span>
              </div>
            </div>

            <article className="box-card">
              <div className="cash-form-row">
                <label>
                  Reservation Transaction ID
                  <input
                    value={reservationTransactionId}
                    onChange={(e) => setReservationTransactionId(e.target.value)}
                    placeholder="Enter reservation # or payment ref (e.g. RES-...)"
                  />
                </label>
                <button className="btn-primary" onClick={lookupReservation} disabled={reservationLookupLoading}>
                  {reservationLookupLoading ? 'Searching...' : 'Search Reservation'}
                </button>
              </div>

              {reservationResult ? (
                <>
                  <div className="cash-grid">
                    <div><span>Transaction</span><strong>{reservationResult.transaction_number}</strong></div>
                    <div><span>Customer</span><strong>{reservationResult.customer_name}</strong></div>
                    <div><span>Date</span><strong>{formatFriendlyDate(reservationResult.reservation_date)}</strong></div>
                    <div><span>Time</span><strong>{formatFriendlyTime(reservationResult.reservation_time)}</strong></div>
                    <div><span>Status</span><strong>{reservationResult.status || '-'}</strong></div>
                    <div><span>Payment Status</span><strong>{reservationResult.payment_status || '-'}</strong></div>
                  </div>

                  <div className="split-grid">
                    <article className="box-card">
                      <h4>Reserved Tables</h4>
                      <ul>
                        {(reservationResult.tables || []).map((table) => (
                          <li key={table.table_id || table.table_number}>
                            <span>Table {String(table.table_number || table.table_id).padStart(2, '0')}</span>
                            <span>PHP {money(table.price || 0)}</span>
                          </li>
                        ))}
                      </ul>
                    </article>

                    <article className="box-card">
                      <h4>Reservation Items</h4>
                      <ul>
                        {(reservationResult.items || []).map((item) => (
                          <li key={item.id}>
                            <span>{item.item_name} x {item.quantity}</span>
                            <span>PHP {money(Number(item.quantity || 0) * Number(item.unit_price || 0))}</span>
                          </li>
                        ))}
                      </ul>
                      {!reservationResult.items?.length ? <p className="empty-note">No menu items attached.</p> : null}
                    </article>
                  </div>

                  <div className="totals-box">
                    <div><span>Items Amount</span><strong>PHP {money(reservationResult.items_amount)}</strong></div>
                    <div><span>Table Amount</span><strong>PHP {money(reservationResult.table_amount)}</strong></div>
                    <div><span>Total Amount</span><strong>PHP {money(reservationResult.total_amount)}</strong></div>
                    <div><span>Deposit Paid</span><strong>PHP {money(reservationResult.deposit_amount)}</strong></div>
                    <div><span>Total Paid</span><strong>PHP {money(reservationResult.paid_amount)}</strong></div>
                    <div className="grand"><span>Balance Due</span><strong>PHP {money(reservationResult.balance_due)}</strong></div>
                  </div>

                  {Number(reservationResult.balance_due || 0) > 0 ? (
                    canManage ? (
                      <div className="payment-actions-row">
                        <select
                          value={reservationPaymentMethod}
                          onChange={(e) => setReservationPaymentMethod(e.target.value)}
                          disabled={reservationPayLoading}
                        >
                          <option value="cash">Cash</option>
                          <option value="gcash">GCash (Online)</option>
                          <option value="paymaya">PayMaya (Online)</option>
                        </select>
                        <button className="btn-primary" onClick={payReservationBalance} disabled={reservationPayLoading}>
                          {reservationPayLoading ? 'Processing...' : `Collect Balance Payment (${methodLabel(reservationPaymentMethod)})`}
                        </button>
                      </div>
                    ) : (
                      <p className="empty-note">You can view this reservation, but only users with reservation_manage can collect balance.</p>
                    )
                  ) : (
                    <p className="ok-msg">No remaining balance. Reservation is fully paid.</p>
                  )}

                  <article className="box-card">
                    <h4>Payment History</h4>
                    {reservationResult.payments?.length ? (
                      <ul>
                        {reservationResult.payments.map((payment) => (
                          <li key={payment.id}>
                            <span>
                              {payment.reference_id || `PAY-${payment.id}`} • {methodLabel(payment.payment_method)} • {String(payment.status || '').toUpperCase()} • {formatFriendlyDateTime(payment.paid_at || payment.created_at)}
                            </span>
                            <span>PHP {money(payment.amount || 0)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="empty-note">No payment history found yet.</p>
                    )}
                  </article>
                </>
              ) : (
                <p className="empty-note">Enter reservation transaction number or payment reference to view details and balance.</p>
              )}
            </article>
          </>
        )}

        {error ? <p className="error-msg">{error}</p> : null}
        {tableStatusMessage ? <p className="ok-msg">{tableStatusMessage}</p> : null}
        {reservationMessage ? <p className="ok-msg">{reservationMessage}</p> : null}

        {selectedOrder ? (
          <div className="modal-backdrop" onClick={closeDetails}>
            <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
              <h3>{selectedOrder.order_number || `Order #${selectedOrder.id}`}</h3>
              <p>Status: {selectedOrder.status}</p>
              <p>Table: {selectedOrder.table_number ? `Table ${String(selectedOrder.table_number).padStart(2, '0')}` : 'No table assigned'}</p>
              {Number(selectedOrder.table_price || 0) > 0 ? (
                <p>Table Charge: PHP {money(selectedOrder.table_price)}</p>
              ) : null}
              <p>Total: PHP {money(selectedOrder.total_amount)}</p>
              <p>Payment: {methodLabel(selectedOrder.payment_method)}</p>

              {selectedOrder.items?.length ? (
                <div className="totals-box">
                  <div><span>Items Subtotal</span><strong>PHP {money(selectedOrder.subtotal)}</strong></div>
                  {Number(selectedOrder.table_price || 0) > 0 ? (
                    <div><span>Table Charge</span><strong>PHP {money(selectedOrder.table_price)}</strong></div>
                  ) : null}
                  <div><span>Discount</span><strong>PHP {money(selectedOrder.discount_amount)}</strong></div>
                  <div className="grand"><span>Total</span><strong>PHP {money(selectedOrder.total_amount)}</strong></div>
                </div>
              ) : null}

              <div className="items-list">
                {(selectedOrder.items || []).map((item) => (
                  <div className="item-row" key={item.id}>
                    <span>{item.item_name} x {item.quantity} @ PHP {money(item.unit_price)}</span>
                    <strong>PHP {money(item.subtotal)}</strong>
                  </div>
                ))}
              </div>

              {selectedOrder.status === 'pending' && canManage ? (
                <div className="payment-panel">
                  <div className="payment-row">
                    <label>Mode of Payment</label>
                    <select value={paymentMethod} onChange={(e) => {
                      setPaymentMethod(e.target.value);
                      setCheckoutData(null);
                      setOnlineStatus('');
                    }}>
                      <option value="cash">Cash</option>
                      <option value="gcash">GCash</option>
                      <option value="paymaya">PayMaya</option>
                    </select>
                  </div>

                  {paymentMethod === 'cash' ? (
                    <div className="payment-row">
                      <label>Amount Received</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountReceived}
                        onChange={(e) => setAmountReceived(e.target.value)}
                        placeholder="Enter amount"
                      />
                    </div>
                  ) : null}

                  <button className="btn-primary btn-lg btn-block" onClick={handleConfirmPayment} disabled={paying}>
                    {paying ? 'Processing...' : paymentMethod === 'cash' ? 'Confirm Cash Payment' : `Generate ${methodLabel(paymentMethod)} QR`}
                  </button>

                  {isOnlinePending ? (
                    <button className="btn-secondary" onClick={() => recheckOnlinePayment(false)} disabled={reconciling}>
                      {reconciling ? 'Rechecking...' : 'Recheck Online Payment'}
                    </button>
                  ) : null}

                  <button className="btn-danger" onClick={cancelPendingOrder} disabled={cancellingOrder || paying || reconciling}>
                    {cancellingOrder ? 'Cancelling...' : 'Cancel Pending Order'}
                  </button>

                  {checkoutData?.qr_code ? (
                    <div className="qr-box">
                      <img src={checkoutData.qr_code} alt="PayMongo checkout QR" />
                      <a href={checkoutData.checkout_url} target="_blank" rel="noreferrer">Open checkout page</a>
                    </div>
                  ) : null}

                  {onlineStatus ? <p className="empty-note">{onlineStatus}</p> : null}
                </div>
              ) : null}

              <button className="ghost" onClick={closeDetails}>Close</button>
            </div>
          </div>
        ) : null}

        {floorTable ? (() => {
          const liveTable = tables.find((t) => Number(t.id) === Number(floorTable.id)) || floorTable;
          const model = tableStatusModel(liveTable);
          const updating = tableUpdateBusyId === Number(liveTable.id);
          const label = `T-${String(liveTable.table_number || liveTable.id).padStart(2, '0')}`;

          const act = (nextStatus, labelClass, title, hint) => (
            <button
              type="button"
              className={labelClass}
              disabled={updating || !model.canChangeTo(nextStatus)}
              onClick={() => handleSetTableStatus(liveTable, nextStatus)}
            >
              {title}
              <small>
                {updating
                  ? 'Updating…'
                  : model.status === nextStatus
                    ? 'Current status'
                    : hint}
              </small>
            </button>
          );

          return (
            <div className="modal-backdrop" onClick={() => setFloorTable(null)}>
              <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                <div className="ticket-title">
                  <h3>Table {label}</h3>
                  <span className={`status-pill ${model.tone}`}><i /> {model.statusLabel}</span>
                </div>
                <p>
                  Seats {liveTable.capacity || 0} ·{' '}
                  {model.lockReason || 'Choose the new status for this table.'}
                </p>

                <div className="modal-action-grid">
                  {act('available', 'is-available', 'Mark Available', 'Frees the table for walk-ins')}
                  {act('reserved', 'is-reserve', 'Reserve Table', 'Holds it for a booking')}
                  {act('unavailable', 'is-block', 'Block Table', 'Removes it from the floor')}
                </div>

                <button className="ghost btn-block" onClick={() => setFloorTable(null)}>Close</button>
              </div>
            </div>
          );
        })() : null}
      </div>
    </section>
  );
}
