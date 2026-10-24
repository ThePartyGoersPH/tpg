import { useEffect, useState } from 'react';
import { socialService } from '../services/socialService';
import { formatDate } from '../utils/dateHelpers';
import { Bell, CalendarDays, CreditCard, PartyPopper, Star, Heart, MessageCircle } from 'lucide-react';

function getNotificationMessage(notification) {
  const type = String(notification.type || '').toLowerCase();
  const reservationStatus = String(notification.reservation_status || '').toLowerCase();
  const reservationPaymentStatus = String(notification.reservation_payment_status || '').toLowerCase();

  if (type === 'reservation_confirmed') {
    const baseMessage = String(notification.message || '').replace(/has been submitted and is pending approval\.?/i, 'is confirmed.');

    if (reservationPaymentStatus === 'partial') {
      return baseMessage.replace(/is confirmed\.?/i, 'is confirmed. Payment status: Partially Paid.');
    }

    if (reservationPaymentStatus === 'paid') {
      return baseMessage.replace(/is confirmed\.?/i, 'is confirmed. Payment status: Paid.');
    }

    if (reservationStatus === 'confirmed') {
      return baseMessage.replace(/submitted and is pending approval\.?/i, 'is confirmed.');
    }
  }

  return notification.message || '';
}

function NotificationsView() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const load = async (p = 1) => {
    try {
      setLoading(true); setErr('');
      const data = await socialService.notifications({ page: p, limit: perPage });
      setNotifications(data?.notifications || data?.data || []);
      setTotal(data?.total || data?.unread_count || 0);
      setPage(p);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to load notifications.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  const handleMarkRead = async (id) => {
    try {
      await socialService.markOneRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (_) {
      try { await socialService.markNotificationRead(id); } catch (_2) {}
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    }
  };

  const handleClear = async () => {
    try {
      await socialService.clearNotifications();
      setNotifications([]);
    } catch (e) {
      setErr(e?.response?.data?.message || 'Failed to clear notifications.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await socialService.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (_) {
      try {
        await Promise.all(notifications.filter(n => !n.is_read).map(n => socialService.markNotificationRead(n.id)));
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      } catch (_2) {}
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalPages = Math.ceil(total / perPage);

  const getIcon = (type) => {
    if (!type) return <Bell size={18} />;
    const t = type.toLowerCase();
    if (t.includes('reply')) return <MessageCircle size={18} />;
    if (t.includes('comment')) return <MessageCircle size={18} />;
    if (t.includes('reservation')) return <CalendarDays size={18} />;
    if (t.includes('payment')) return <CreditCard size={18} />;
    if (t.includes('event')) return <PartyPopper size={18} />;
    if (t.includes('review')) return <Star size={18} />;
    if (t.includes('follow')) return <Heart size={18} />;
    return <Bell size={18} />;
  };

  if (loading) return <div className="loading-state" style={{ minHeight: '50vh' }}><div className="spinner" /><span>Loading notifications...</span></div>;

  return (
    <div className="flex flex-col gap-xl">
      <div className="flex justify-between items-center flex-wrap gap-md">
        <div>
          <span className="home-eyebrow">ALERTS</span>
          <h1 className="home-section-title" style={{ marginTop: '0.5rem' }}>NOTIFICATIONS</h1>
          <p className="home-section-sub">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>
        </div>
        <div className="flex gap-sm">
          {unreadCount > 0 && <button className="btn btn-glass btn-sm" onClick={handleMarkAllRead}>Mark all read</button>}
          {notifications.length > 0 && <button className="btn btn-ghost btn-sm" onClick={handleClear}>Clear all</button>}
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}

      {notifications.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-icon"><Bell size={32} /></div>
          <h3 className="text-h3">No notifications</h3>
          <p className="text-muted mt-sm">You'll see notifications here when something happens.</p>
        </div>
      ) : (
        <div className="notif-list">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`notif-item ${!n.is_read ? 'unread' : ''}`}
              onClick={() => !n.is_read && handleMarkRead(n.id)}
            >
              {!n.is_read && <div className="notif-dot" />}
              <div className="notif-icon">{getIcon(n.type)}</div>
              <div className="notif-content">
                <div className="notif-title">{n.title || 'Notification'}</div>
                <div className="notif-msg">{getNotificationMessage(n)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="notif-time">{n.time_ago || formatDate(n.created_at)}</div>
                  {!n.is_read && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>NEW</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-sm mt-md">
          <button className="btn btn-glass btn-sm" disabled={page <= 1} onClick={() => load(page - 1)}>Previous</button>
          <span className="text-muted" style={{ alignSelf: 'center', fontSize: '0.85rem' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-glass btn-sm" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

export default NotificationsView;
