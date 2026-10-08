import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Check, X as XIcon, Ban, CalendarCheck, Clock, Users, Hash, CreditCard, Package, User, MapPin, FileText, Loader2, DollarSign, Banknote, UserX, Bike, Store } from 'lucide-react';
import { reservationApi } from '../api/reservationApi';
import { barApi } from '../api/barApi';
import { usePermission } from '../hooks/usePermission';
import { formatFriendlyDate, formatFriendlyDateTime, formatFriendlyTime } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ConfirmModal from '../components/common/ConfirmModal';

const statusColors = {
  pending: 'badge-yellow',
  approved: 'badge-blue',
  confirmed: 'badge-green',
  checked_in: 'badge-green',
  no_show: 'badge-orange',
  rejected: 'badge-red',
  cancelled: 'badge-gray',
  partial: 'badge-yellow',
};

const ReservationDetail = ({ detail, onClose }) => (
  <div className="space-y-4">
    {/* Header */}
    <div className="px-5 py-4 flex items-center justify-between rounded-xl" style={{ background: 'linear-gradient(135deg, #1a0000, #0a0a1a)' }}>
      <div>
        <p className="text-xs font-medium" style={{ color: '#CC0000' }}>Transaction</p>
        <p className="text-lg font-bold text-white">#{detail.transaction_number || '—'}</p>
      </div>
      <div className="flex items-center gap-2">
        {detail.payment_status === 'partial' ? (
          <span className={statusColors.partial}>Partially Paid</span>
        ) : detail.payment_status === 'paid' ? (
          <span className={statusColors.confirmed}>Paid</span>
        ) : (
          <span className={statusColors[detail.status] || 'badge-gray'}>{detail.status}</span>
        )}
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: '#666' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}>
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>

    <div className="space-y-4">
      {/* Customer + Reservation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" style={{ color: '#CC0000' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Customer</span>
          </div>
          <p className="text-sm font-medium text-white">
            {detail.first_name ? `${detail.first_name} ${detail.last_name}` : (detail.guest_name || 'Guest')}
          </p>
          {(detail.email || detail.guest_email) && <p className="text-xs" style={{ color: '#666' }}>{detail.email || detail.guest_email}</p>}
          {(detail.phone_number || detail.guest_phone) && <p className="text-xs" style={{ color: '#666' }}>{detail.phone_number || detail.guest_phone}</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" style={{ color: '#CC0000' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Reservation</span>
          </div>
          {detail.tables && detail.tables.length > 0 ? (
            <>
              {detail.tables.length === 1 ? (
                <p className="text-sm text-white">
                  <span className="font-medium">Table {detail.tables[0].table_number}</span>
                  {detail.tables[0].capacity && <span style={{ color: '#666' }}> (cap: {detail.tables[0].capacity})</span>}
                  {detail.tables[0].floor && <span style={{ color: '#666' }}> · Floor {detail.tables[0].floor}</span>}
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">{detail.tables.length} Tables Reserved</p>
                  <div className="flex flex-wrap gap-1">
                    {detail.tables.map((table, idx) => (
                      <span key={idx} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(204,0,0,0.15)', color: '#CC0000' }}>
                        #{table.table_number}
                        {table.capacity && ` (${table.capacity})`}
                        {table.floor && ` · F${table.floor}`}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#666' }}>
                    Total capacity: {detail.tables.reduce((sum, t) => sum + (Number(t.capacity) || 0), 0)} pax
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-white">
              <span className="font-medium">Table {detail.table_number || detail.table_id}</span>
              {detail.capacity && <span style={{ color: '#666' }}> (cap: {detail.capacity})</span>}
            </p>
          )}
          {detail.table_price != null && Number(detail.table_price) > 0 && (
            <p className="text-xs" style={{ color: '#aaa' }}>Table rate: <span className="font-medium text-white">₱{Number(detail.table_price).toLocaleString()}</span></p>
          )}
          {detail.deposit_amount != null && Number(detail.deposit_amount) > 0 && (
            <p className="text-xs" style={{ color: '#aaa' }}>Deposit paid: <span className="font-medium" style={{ color: '#4ade80' }}>₱{Number(detail.deposit_amount).toLocaleString()}</span></p>
          )}
          <p className="text-xs" style={{ color: '#ccc' }}>
            {formatFriendlyDate(detail.reservation_date)}
            {detail.reservation_time ? ` at ${formatFriendlyTime(detail.reservation_time)}` : ''}
          </p>
          <p className="text-xs" style={{ color: '#666' }}>{detail.party_size} guest{detail.party_size !== 1 ? 's' : ''}</p>
          {detail.occasion && <p className="text-xs" style={{ color: '#666' }}>Occasion: {detail.occasion}</p>}
        </div>
      </div>

      {/* Fulfillment (takeout orders): pickup vs delivery + rider details */}
      {detail.order_type === 'takeout' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            {detail.fulfillment === 'delivery'
              ? <Bike className="w-4 h-4" style={{ color: '#c084fc' }} />
              : <Store className="w-4 h-4" style={{ color: '#4ade80' }} />}
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Fulfillment</span>
            {detail.fulfillment === 'delivery' ? (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}>Delivery</span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>Pickup</span>
            )}
          </div>
          {detail.fulfillment === 'delivery' ? (
            <div className="rounded-lg p-3 space-y-1" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
              {detail.delivery_name && <p className="text-sm font-medium text-white">{detail.delivery_name}</p>}
              {detail.delivery_phone && <p className="text-xs" style={{ color: '#ccc' }}>{detail.delivery_phone}</p>}
              {detail.delivery_address && <p className="text-xs" style={{ color: '#ccc' }}>{detail.delivery_address}</p>}
              {detail.delivery_notes && <p className="text-xs" style={{ color: '#888' }}>Note: {detail.delivery_notes}</p>}
              {detail.delivery_fee != null && Number(detail.delivery_fee) > 0 && (
                <p className="text-xs font-semibold" style={{ color: '#c084fc' }}>Delivery fee: ₱{Number(detail.delivery_fee).toLocaleString()}</p>
              )}
            </div>
          ) : (
            <p className="text-xs" style={{ color: '#666' }}>Customer picks up at the store.</p>
          )}
        </div>
      )}

      {/* Items Ordered */}
      {detail.items && detail.items.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4" style={{ color: '#CC0000' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Items Ordered</span>
          </div>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--m-border)' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--m-active-bg)' }}>
                  <th className="text-left text-xs font-medium px-3 py-2" style={{ color: '#888' }}>Item</th>
                  <th className="text-center text-xs font-medium px-3 py-2" style={{ color: '#888' }}>Qty</th>
                  <th className="text-right text-xs font-medium px-3 py-2" style={{ color: '#888' }}>Price</th>
                  <th className="text-right text-xs font-medium px-3 py-2" style={{ color: '#888' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--m-border)' }}>
                    <td className="px-3 py-2 text-sm text-white">{item.menu_name}</td>
                    <td className="px-3 py-2 text-sm text-center" style={{ color: '#ccc' }}>x{item.quantity}</td>
                    <td className="px-3 py-2 text-sm text-right" style={{ color: '#888' }}>₱{Number(item.unit_price).toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm text-right font-medium text-white">₱{Number(item.line_total).toLocaleString()}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: '1px solid var(--m-border)' }}>
                  <td colSpan="3" className="px-3 py-2 text-sm font-semibold text-right" style={{ color: '#888' }}>Total</td>
                  <td className="px-3 py-2 text-sm font-bold text-right" style={{ color: '#CC0000' }}>₱{Number(detail.total_amount || 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tax Breakdown (VAT snapshot stored at checkout) */}
      {detail.tax_amount != null && Number(detail.tax_amount) > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4" style={{ color: '#CC0000' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Tax Breakdown</span>
          </div>
          <div className="rounded-lg p-3 space-y-1" style={{ background: 'var(--m-active-bg)', border: '1px solid var(--m-border)' }}>
            <div className="flex items-center justify-between text-sm" style={{ color: '#ccc' }}>
              <span>Subtotal{detail.tax_mode === 'INCLUSIVE' ? ' (Net of VAT)' : ''}</span>
              <span>₱{Number(detail.net_subtotal ?? 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm" style={{ color: '#ccc' }}>
              <span>VAT ({Number(detail.tax_rate || 0)}%{detail.tax_mode === 'INCLUSIVE' ? ' Included' : ''})</span>
              <span>₱{Number(detail.tax_amount || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Payment Breakdown */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-4 h-4" style={{ color: '#CC0000' }} />
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Payment Summary</span>
        </div>
        <div className="rounded-lg px-4 py-3 space-y-1.5" style={{ background: 'var(--m-active-bg)', border: '1px solid var(--m-border)' }}>
          {detail.total_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: '#888' }}>Total Bill</span>
              <span className="text-sm font-medium text-white">₱{Number(detail.total_amount).toLocaleString()}</span>
            </div>
          )}
          {detail.online_payment_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: '#888' }}>Paid Online ({detail.online_payment_method || 'online'})</span>
              <span className="text-sm font-medium" style={{ color: '#4ade80' }}>₱{Number(detail.online_payment_amount).toLocaleString()}</span>
            </div>
          )}
          {(() => {
            const paid = Number(detail.online_payment_amount || detail.deposit_amount || 0);
            const total = Number(detail.total_amount || 0);
            const remaining = Math.max(0, total - paid);
            const isFullyPaid = total > 0 && remaining === 0;
            const isPartialPaid = total > 0 && paid > 0 && remaining > 0;

            if (isFullyPaid) {
              return (
                <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--m-border)' }}>
                  <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>Fully Paid ✓</span>
                  <span className="text-sm font-bold" style={{ color: '#4ade80' }}>₱0.00 remaining</span>
                </div>
              );
            }
            if (isPartialPaid) {
              return (
                <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--m-border)' }}>
                  <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>Remaining Balance (collect in person)</span>
                  <span className="text-sm font-bold" style={{ color: '#fbbf24' }}>₱{remaining.toLocaleString()}</span>
                </div>
              );
            }
            return null;
          })()}
          {detail.online_paid_at && (
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: '#888' }}>Online paid at</span>
              <span className="text-sm" style={{ color: '#ccc' }}>{formatFriendlyDateTime(detail.online_paid_at)}</span>
            </div>
          )}
          {detail.online_reference && (
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: '#888' }}>Reference</span>
              <span className="text-xs font-mono" style={{ color: '#666' }}>{detail.online_reference}</span>
            </div>
          )}
          {!detail.online_payment_amount && detail.deposit_amount > 0 && (
            <div className="flex justify-between">
              <span className="text-xs" style={{ color: '#888' }}>Deposit</span>
              <span className="text-sm font-medium" style={{ color: '#4ade80' }}>₱{Number(detail.deposit_amount).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
      {detail.payment && detail.payment.reference_id && (
        <div className="rounded-lg px-3 py-2" style={{ background: 'var(--m-active-bg)', border: '1px solid var(--m-border)' }}>
          <span className="text-xs" style={{ color: '#555' }}>PayMongo ref: </span>
          <span className="text-xs font-mono" style={{ color: '#555' }}>{detail.payment.reference_id}</span>
        </div>
      )}

      {/* Notes */}
      {detail.notes && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4" style={{ color: '#CC0000' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#888' }}>Notes</span>
          </div>
          <p className="text-sm" style={{ color: '#aaa' }}>{detail.notes}</p>
        </div>
      )}
    </div>
  </div>
);

const Reservations = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('latest');
  const { can } = usePermission();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, action: null });
  const [unpaidConfirm, setUnpaidConfirm] = useState({ isOpen: false, id: null, action: null, reservation: null });
  const [txnSearch, setTxnSearch] = useState('');
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnDetail, setTxnDetail] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [rowLoading, setRowLoading] = useState(null);
  const [markingPaid, setMarkingPaid] = useState(null);
  const [barDetails, setBarDetails] = useState(null);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(120);
  const [timeLimitSaving, setTimeLimitSaving] = useState(false);
  const [barDetailsDenied, setBarDetailsDenied] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => { loadBarDetails(); }, []);

  // Deep link from a notification click: /reservations?ref=RES-20260926-XXXXXX
  // Pre-fills the Transaction Lookup and runs it, and narrows the list to the
  // same reference, so the user lands straight on the record that needs action.
  const [searchParams] = useSearchParams();
  const deepRef = (searchParams.get('ref') || '').trim().toUpperCase();

  useEffect(() => {
    if (!deepRef) return;
    let stale = false;
    setTxnSearch(deepRef);
    setSearch(deepRef);
    (async () => {
      try {
        setTxnLoading(true);
        const { data } = await reservationApi.lookup(deepRef, { silentError: true });
        if (!stale) setTxnDetail(data.data || data);
      } catch {
        // The ref lookup failed (unknown txn or another bar's record).
        // Drop back to the general list instead of leaving an empty
        // "No reservations found." table, and clear any detail card left
        // over from the previous ref.
        if (!stale) setTxnDetail(null);
        setSearch('');
      } finally {
        if (!stale) setTxnLoading(false);
      }
    })();
    return () => { stale = true; };
  }, [deepRef]);

  const load = async () => {
    try {
      const { data } = await reservationApi.list();
      setReservations(data.data || data || []);
    } catch {} finally { setLoading(false); }
  };

  const loadBarDetails = async () => {
    try {
      const { data } = await barApi.getDetails({ silentError: true });
      const d = data.data || data;
      setBarDetails(d);
      setBarDetailsDenied(false);
      if (d?.reservation_time_limit_minutes != null) {
        const n = Number(d.reservation_time_limit_minutes);
        if (Number.isFinite(n) && n > 0) setTimeLimitMinutes(n);
      }
    } catch (e) {
      // Background config fetch failed (e.g. missing bar_details_view).
      // Degrade gracefully: hide/disable the time-limit editor instead of alarming the user.
      if (e?.response?.status === 403) setBarDetailsDenied(true);
    }
  };

  const parseBarTypes = (raw) => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const derivedTimeLimitMode = (types) => {
    const norm = types.map((x) => String(x || '').toLowerCase());
    if (norm.includes('club')) return 'club';
    if (norm.includes('comedy bar')) return 'event';
    if (norm.includes('restobar')) return 'restobar';
    return null;
  };

  const effectiveMode = (() => {
    const types = parseBarTypes(barDetails?.bar_types);
    return barDetails?.reservation_time_limit_mode || derivedTimeLimitMode(types);
  })();

  const barTypesList = parseBarTypes(barDetails?.bar_types);

  const handleAction = (id, action, reservation) => {
    if ((action === 'check_in' || action === 'complete') && reservation) {
      const paid = Number(reservation.online_payment_amount || reservation.deposit_amount || 0);
      const hasPaid = paid > 0 || reservation.payment_status === 'paid';
      if (!hasPaid) {
        setUnpaidConfirm({ isOpen: true, id, action, reservation });
        return;
      }
    }
    setConfirmModal({ isOpen: true, id, action });
  };

  const executeAction = async () => {
    const { id, action } = confirmModal;
    try {
      let res;
      if (action === 'approved') await reservationApi.approve(id);
      else if (action === 'rejected') await reservationApi.reject(id);
      else if (action === 'check_in') res = await reservationApi.checkIn(id);
      else if (action === 'complete') res = await reservationApi.complete(id);
      else if (action === 'no_show') await reservationApi.noShow(id);
      else if (action === 'mark_balance_paid') {
        const { data } = await reservationApi.markBalancePaid(id);
        toast.success(data.message || 'Balance marked as paid!');
        setConfirmModal({ isOpen: false, id: null, action: null });
        load();
        return;
      }
      else await reservationApi.cancel(id);
      const settled = res?.data?.payment_settled;
      toast.success(settled ? 'Reservation updated — remaining balance settled' : 'Reservation updated');
      setConfirmModal({ isOpen: false, id: null, action: null });
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Failed to update reservation'); }
  };

  const executeUnpaidConfirm = async () => {
    const { id, action } = unpaidConfirm;
    setUnpaidConfirm({ isOpen: false, id: null, action: null, reservation: null });
    try {
      let res;
      if (action === 'check_in') res = await reservationApi.checkIn(id);
      else if (action === 'complete') res = await reservationApi.complete(id);
      toast.success('Reservation updated');
      load();
    } catch (e) { toast.error(e?.response?.data?.message || 'Failed to update reservation'); }
  };

  const fetchDetail = useCallback(async (txn) => {
    if (!txn) return null;
    const { data } = await reservationApi.lookup(txn);
    return data.data || data;
  }, []);

  const handleLookup = async () => {
    const q = txnSearch.trim();
    if (!q) return toast.error('Enter a transaction number');
    try {
      setTxnLoading(true);
      const detail = await fetchDetail(q);
      setTxnDetail(detail);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Reservation not found';
      toast.error(msg);
      setTxnDetail(null);
    } finally {
      setTxnLoading(false);
    }
  };

  const handleRowClick = async (r) => {
    if (!r.transaction_number) {
      toast.error('No transaction number for this reservation');
      return;
    }
    try {
      setRowLoading(r.id);
      const detail = await fetchDetail(r.transaction_number);
      setSelectedReservation(detail);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not load reservation details';
      toast.error(msg);
    } finally {
      setRowLoading(null);
    }
  };

  const filtered = reservations.filter((r) => {
    const q = search.trim().toLowerCase();
    const matchSearch = (r.guest_name || '').toLowerCase().includes(q) ||
      (r.guest_email || '').toLowerCase().includes(q) ||
      (r.transaction_number || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' || r.status === filter;
    return matchSearch && matchFilter;
  });

  const filteredSorted = [...filtered].sort((a, b) => {
    const aTs = new Date(a.created_at || 0).getTime();
    const bTs = new Date(b.created_at || 0).getTime();
    const safeA = Number.isFinite(aTs) ? aTs : 0;
    const safeB = Number.isFinite(bTs) ? bTs : 0;

    if (safeA === safeB) {
      return sortOrder === 'latest' ? (Number(b.id || 0) - Number(a.id || 0)) : (Number(a.id || 0) - Number(b.id || 0));
    }
    return sortOrder === 'latest' ? (safeB - safeA) : (safeA - safeB);
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const stats = {
    total: reservations.length,
    today: reservations.filter(r => {
      try { return r.reservation_date?.split('T')[0] === todayStr; } catch { return false; }
    }).length,
    paid: reservations.filter(r => r.payment_status === 'paid').length,
    cancelled: reservations.filter(r => r.status === 'cancelled').length,
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card py-4"><p className="text-xs" style={{ color: '#888' }}>Total</p><p className="text-xl font-bold text-white">{stats.total}</p></div>
        <div className="card py-4"><p className="text-xs" style={{ color: '#888' }}>Today</p><p className="text-xl font-bold" style={{ color: '#CC0000' }}>{stats.today}</p></div>
        <div className="card py-4"><p className="text-xs" style={{ color: '#888' }}>Paid</p><p className="text-xl font-bold" style={{ color: '#4ade80' }}>{stats.paid}</p></div>
        <div className="card py-4"><p className="text-xs" style={{ color: '#888' }}>Cancelled</p><p className="text-xl font-bold" style={{ color: '#666' }}>{stats.cancelled}</p></div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-2">Reservation Time Limit</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg p-3" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
            <p className="text-xs" style={{ color: '#888' }}>Bar Type</p>
            <p className="text-sm font-medium text-white">{barTypesList.length ? barTypesList.join(', ') : '—'}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
            <p className="text-xs" style={{ color: '#888' }}>Rule</p>
            <p className="text-sm font-medium text-white">
              {effectiveMode === 'club' ? 'Whole day (manual release)' :
               effectiveMode === 'event' ? 'Event duration' :
               effectiveMode === 'restobar' || effectiveMode === 'custom' ? 'Fixed minutes' :
               'Default (1 hour)'}
            </p>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
            <p className="text-xs" style={{ color: '#888' }}>Time Limit</p>
            {barDetailsDenied ? (
              <p className="text-sm mt-1" style={{ color: '#888' }}>
                You don't have permission to view or edit reservation time limits.
              </p>
            ) : (effectiveMode === 'restobar' || effectiveMode === 'custom') ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min="30"
                  step="30"
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(e.target.value)}
                  className="input-field"
                  style={{ maxWidth: 140 }}
                  disabled={timeLimitSaving || barDetailsDenied}
                />
                <button
                  className="px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                  disabled={timeLimitSaving || barDetailsDenied}
                  style={{ background: '#CC0000' }}
                  onClick={async () => {
                    try {
                      setTimeLimitSaving(true);
                      const n = Number(timeLimitMinutes);
                      if (!Number.isFinite(n) || n <= 0) return toast.error('Enter a valid minute value');
                      await barApi.updateDetails({ reservation_time_limit_mode: effectiveMode || 'custom', reservation_time_limit_minutes: n });
                      toast.success('Reservation time limit updated');
                      await loadBarDetails();
                    } catch {
                      toast.error('Failed to update time limit');
                    } finally {
                      setTimeLimitSaving(false);
                    }
                  }}
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium text-white mt-1">
                {effectiveMode === 'club' ? 'All day' : effectiveMode === 'event' ? 'Varies by event' : '60 minutes'}
              </p>
            )}
            {effectiveMode === 'club' && (
              <p className="text-xs mt-2" style={{ color: '#666' }}>
                For clubs: tables stay reserved for the date until staff marks the reservation completed.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Lookup */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Hash className="w-4 h-4" style={{ color: '#CC0000' }} />
          <h3 className="text-sm font-semibold text-white">Transaction Lookup</h3>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 sm:max-w-md" style={{ background: 'var(--m-bg)', border: '1px solid var(--m-border)' }}>
            <Search className="w-4 h-4" style={{ color: '#555' }} />
            <input
              value={txnSearch}
              onChange={(e) => setTxnSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
              placeholder="Enter transaction number (e.g. RES-20260322-XXXXXX)"
              className="bg-transparent text-sm outline-none flex-1 text-white placeholder-gray-600"
            />
          </div>
          <button
            onClick={handleLookup}
            disabled={txnLoading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ background: '#CC0000' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#a00'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#CC0000'; }}
          >
            {txnLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Transaction Detail */}
        {txnDetail && (
          <div className="mt-4 rounded-xl overflow-hidden p-5 space-y-4" style={{ border: '1px solid var(--m-border)', background: '#111' }}>
            <ReservationDetail detail={txnDetail} onClose={() => setTxnDetail(null)} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 flex-1 sm:max-w-xs" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
          <Search className="w-4 h-4" style={{ color: '#555' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest or txn..." className="bg-transparent text-sm outline-none flex-1 text-white placeholder-gray-600" />
        </div>
        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
          <button
            onClick={() => setSortOrder('latest')}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={sortOrder === 'latest' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}
          >
            Latest to Oldest
          </button>
          <button
            onClick={() => setSortOrder('oldest')}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            style={sortOrder === 'oldest' ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}
          >
            Oldest to Latest
          </button>
        </div>
        <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
          {['all', 'pending', 'approved', 'confirmed', 'checked_in', 'completed', 'no_show', 'rejected', 'cancelled'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={filter === f ? { background: '#CC0000', color: '#fff' } : { color: '#888' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderBottom: '1px solid var(--m-border)' }}>
              <tr>
                <th className="table-header">Guest</th>
                <th className="table-header">Date & Time</th>
                <th className="table-header">Party Size</th>
                <th className="table-header">Table</th>
                <th className="table-header">Status</th>
                <th className="table-header">Payment</th>
                {can('RESERVATION_MANAGE') && <th className="table-header text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredSorted.map((r) => (
                <tr key={r.id} className="transition-colors" style={{ borderBottom: '1px solid var(--m-border)', cursor: 'pointer' }}
                  onClick={() => handleRowClick(r)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      {rowLoading === r.id && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: '#CC0000' }} />}
                      <div>
                        <p className="font-medium text-white">{r.guest_name || 'N/A'}</p>
                        <p className="text-xs" style={{ color: '#666' }}>{r.guest_email || r.guest_phone || ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      <CalendarCheck className="w-3.5 h-3.5" style={{ color: '#555' }} />
                      <span>{formatFriendlyDate(r.reservation_date)}</span>
                    </div>
                    {r.reservation_time && (
                      <div className="flex items-center gap-1.5 text-xs mt-0.5" style={{ color: '#666' }}>
                        <Clock className="w-3 h-3" /> {formatFriendlyTime(r.reservation_time)}
                      </div>
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1" style={{ color: '#ccc' }}><Users className="w-3.5 h-3.5" style={{ color: '#555' }} /> {r.party_size || '—'}</div>
                  </td>
                  <td className="table-cell">
                    {r.order_type === 'takeout' ? (
                      r.fulfillment === 'delivery' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}>Delivery</span>
                      ) : r.fulfillment === 'pickup' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>Pickup</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>Takeout</span>
                      )
                    ) : r.order_type === 'dine_in' && !(r.tables && r.tables.length) && !r.table_number && !r.table_id ? (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}>Dine-In (No Table Reserved)</span>
                    ) : r.tables && r.tables.length > 1 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.tables.map((t, idx) => (
                          <span key={idx} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(204,0,0,0.1)', color: '#CC0000' }}>
                            #{t.table_number}
                          </span>
                        ))}
                      </div>
                    ) : r.table_number ? `#${r.table_number}` : (r.table_id ? `#${r.table_id}` : '—')}
                  </td>
                  <td className="table-cell">
                    {r.payment_status === 'partial' ? (
                      <span className={statusColors.partial}>Partially Paid</span>
                    ) : r.payment_status === 'paid' ? (
                      <span className={statusColors.confirmed}>Paid</span>
                    ) : r.payment_status === 'cancelled' ? (
                      <span className={statusColors.cancelled}>Cancelled</span>
                    ) : (
                      <span className={statusColors[r.status] || 'badge-gray'}>{r.status}</span>
                    )}
                    {r.status === 'cancelled' && (r.payment_status === 'paid' || r.payment_status === 'partial') && (
                      <p className="text-xs mt-1 font-semibold" style={{ color: '#f59e0b' }}>⚠ Refund needed</p>
                    )}
                  </td>
                  <td className="table-cell">
                    {(() => {
                      const paid = Number(r.online_payment_amount || r.deposit_amount || 0);
                      const total = Number(r.total_amount || 0);
                      const remaining = Math.max(0, total - paid);
                      const isFullyPaid = total > 0 && remaining === 0;
                      const isPartial = r.payment_status === 'partial' || (total > 0 && paid > 0 && remaining > 0);
                      if (isFullyPaid) return (
                        <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>Fully Paid ✓</span>
                      );
                      if (isPartial) return (
                        <div>
                          <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>Down Payment</span>
                          <p className="text-xs" style={{ color: '#4ade80' }}>Online: ₱{paid.toLocaleString()}</p>
                          {total > 0 && (
                            <p className="text-xs font-semibold" style={{ color: '#fbbf24' }}>
                              Balance: ₱{remaining.toLocaleString()}
                            </p>
                          )}
                        </div>
                      );
                      if (r.online_payment_amount > 0) return (
                        <div>
                          <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>Partial</span>
                          <p className="text-xs" style={{ color: '#4ade80' }}>Online: ₱{Number(r.online_payment_amount).toLocaleString()}</p>
                        </div>
                      );
                      return <span className="text-xs" style={{ color: '#666' }}>{r.payment_status || 'unpaid'}</span>;
                    })()}
                  </td>
                  {can('RESERVATION_MANAGE') && (
                    <td className="table-cell text-right">
                      {r.status === 'pending' && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleAction(r.id, 'approved'); }} className="p-1.5 rounded-lg transition-colors" style={{ color: '#4ade80' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            title="Approve"><Check className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); handleAction(r.id, 'rejected'); }} className="p-1.5 rounded-lg transition-colors" style={{ color: '#ff6666' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(204,0,0,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            title="Reject"><XIcon className="w-4 h-4" /></button>
                        </div>
                      )}
                      {r.status === 'approved' && (
                        <button onClick={(e) => { e.stopPropagation(); handleAction(r.id, 'cancelled'); }} className="p-1.5 rounded-lg transition-colors" style={{ color: '#666' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--m-active-bg)'; e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
                          title="Cancel">
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                      {r.status === 'confirmed' && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleAction(r.id, 'check_in', r); }} className="p-1.5 rounded-lg transition-colors" style={{ color: '#4ade80' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            title="Check In">
                            <CalendarCheck className="w-4 h-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleAction(r.id, 'no_show'); }} className="p-1.5 rounded-lg transition-colors" style={{ color: '#f59e0b' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            title="Mark No Show">
                            <UserX className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      {r.status === 'checked_in' && (
                        <button onClick={(e) => { e.stopPropagation(); handleAction(r.id, 'complete', r); }} className="p-1.5 rounded-lg transition-colors" style={{ color: '#4ade80' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          title="Mark Completed">
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {(r.payment_status === 'partial' || (['approved','confirmed','checked_in'].includes(r.status) && r.online_payment_amount > 0 && Number(r.total_amount || 0) > 0 && Number(r.online_payment_amount) < Number(r.total_amount))) && r.payment_status !== 'paid' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAction(r.id, 'mark_balance_paid'); }}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#fbbf24' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(251,191,36,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          title="Mark Balance Paid (cash in person)">
                          <Banknote className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {filteredSorted.length === 0 && (
                <tr><td colSpan="7" className="text-center py-8" style={{ color: '#555' }}>No reservations found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Row Click Detail Modal */}
      {selectedReservation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setSelectedReservation(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl overflow-hidden overflow-y-auto"
            style={{ background: '#111', border: '1px solid var(--m-border)', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <ReservationDetail detail={selectedReservation} onClose={() => setSelectedReservation(null)} />
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, id: null, action: null })}
        onConfirm={executeAction}
        title={
          confirmModal.action === 'approved' ? 'Approve Reservation?' :
          confirmModal.action === 'rejected' ? 'Reject Reservation?' :
          confirmModal.action === 'check_in' ? 'Check In Customer?' :
          confirmModal.action === 'complete' ? 'Mark Reservation Completed?' :
          confirmModal.action === 'no_show' ? 'Mark as No Show?' :
          confirmModal.action === 'mark_balance_paid' ? 'Mark Remaining Balance as Paid?' :
          'Cancel Reservation?'
        }
        message={
          confirmModal.action === 'approved' ? 'This reservation will be approved and the customer will be notified.' :
          confirmModal.action === 'rejected' ? 'This reservation will be rejected and the customer will be notified.' :
          confirmModal.action === 'check_in' ? 'This will mark the customer as checked in.' :
          confirmModal.action === 'complete' ? 'This will release the table for new reservations.' :
          confirmModal.action === 'no_show' ? 'This will mark the customer as a no-show. Their reservation status will be updated.' :
          confirmModal.action === 'mark_balance_paid' ? 'Confirm that the customer has paid the remaining balance in person (cash). This will mark the reservation as fully paid.' :
          'This reservation will be cancelled.'
        }
        confirmText={
          confirmModal.action === 'approved' ? 'Approve' :
          confirmModal.action === 'rejected' ? 'Reject' :
          confirmModal.action === 'check_in' ? 'Check In' :
          confirmModal.action === 'complete' ? 'Complete' :
          confirmModal.action === 'no_show' ? 'Mark No Show' :
          confirmModal.action === 'mark_balance_paid' ? 'Confirm Paid' :
          'Cancel'
        }
        type={confirmModal.action === 'approved' ? 'info' : confirmModal.action === 'check_in' || confirmModal.action === 'complete' || confirmModal.action === 'mark_balance_paid' ? 'info' : confirmModal.action === 'no_show' ? 'danger' : 'danger'}
      />

      <ConfirmModal
        isOpen={unpaidConfirm.isOpen}
        onClose={() => setUnpaidConfirm({ isOpen: false, id: null, action: null, reservation: null })}
        onConfirm={executeUnpaidConfirm}
        title="No Payment Recorded"
        message={`This reservation has no payment on record. Mark as ${unpaidConfirm.action === 'check_in' ? 'checked in' : 'completed'} and treat as fully paid (cash at venue)?`}
        confirmText={unpaidConfirm.action === 'check_in' ? 'Check In & Mark Paid' : 'Complete & Mark Paid'}
        type="warning"
      />
    </div>
  );
};

export default Reservations;
