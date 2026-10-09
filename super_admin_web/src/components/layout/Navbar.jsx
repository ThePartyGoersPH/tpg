import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, AlertCircle, FileText, DollarSign, Flag, CheckCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { dashboardAPI } from '../../api/services';
import { formatCurrentDateLabel, formatDateTime } from '../../utils/formatters';

const notifIcon = (type) => {
  if (type === 'business_registration') return <FileText className="h-3.5 w-3.5 text-orange-400" />;
  if (type === 'pending_payouts') return <DollarSign className="h-3.5 w-3.5 text-amber-400" />;
  if (type === 'flagged_content') return <Flag className="h-3.5 w-3.5 text-red-400" />;
  if (type === 'platform_feedback') return <Bell className="h-3.5 w-3.5 text-blue-400" />;
  if (type === 'customer_approval') return <Bell className="h-3.5 w-3.5 text-emerald-400" />;
  return <AlertCircle className="h-3.5 w-3.5 text-white/40" />;
};

const actionableTypes = new Set(['business_registration', 'pending_payouts', 'flagged_content', 'customer_approval']);

// Deep-link each notification type to its management page, carrying the
// specific item id so the target page can open/filter/highlight it.
const destinationFor = (n) => {
  if (n?.type === 'business_registration' && n?.item_id) return `/registrations?open=${n.item_id}`;
  if (n?.type === 'platform_feedback' && n?.item_id) return `/feedback?review=${n.item_id}`;
  if (n?.type === 'pending_payouts') return '/payouts';
  if (n?.type === 'flagged_content') {
    return n?.id === 'flagged-comments' ? '/social?tab=reported-comments' : '/social?tab=posts';
  }
  return n?.action_url || null;
};

export default function Navbar() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    try {
      const res = await dashboardAPI.getNotifications(12);
      if (res.data?.success) {
        const payload = res.data.data || {};
        setNotifications(payload.notifications || []);
        setUnreadCount(Number(payload.unread_count || 0));
      }
    } catch {
      // keep last-known state on transient errors
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification) return;
    // Optimistic read state so the badge drops instantly; the POST below
    // persists it per-admin in the backend.
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - (notification.is_read ? 0 : 1)));
    setNotifOpen(false);

    try {
      await dashboardAPI.markNotificationRead(notification.id);
    } catch {
      // Next poll re-syncs from the server; navigation still proceeds.
    }

    const dest = destinationFor(notification);
    if (dest) navigate(dest);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await dashboardAPI.markAllNotificationsRead();
    } catch {
      loadNotifications();
    }
  };

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      if (!alive) return;
      await loadNotifications();
    };

    if (String(user?.role || '').toLowerCase() === 'super_admin') {
      tick();
      const timer = setInterval(tick, 30000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }

    return () => {
      alive = false;
    };
  }, [user?.role]);

  return (
    <div className="glass-navbar h-14 flex items-center justify-between px-6 overflow-visible">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            placeholder="Search bars, users..."
            className="glass-input w-full pl-9 pr-4 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-6">
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative p-2 text-white/40 hover:text-white/80 hover:bg-white/[0.06] rounded-lg transition"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] max-h-[420px] overflow-y-auto p-3 z-[9999] border border-white/[0.12] rounded-xl shadow-2xl" style={{background: 'rgba(20, 10, 25, 0.97)', backdropFilter: 'blur(24px)'}}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider">Notifications</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40">{unreadCount} pending</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-1 text-[10px] font-medium text-white/50 hover:text-white/90 transition"
                        title="Mark all as read"
                      >
                        <CheckCheck className="h-3 w-3" />Mark all read
                      </button>
                    )}
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <div className="text-xs text-white/40 py-4 text-center">No new notifications</div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((n) => {
                      const isActionable = actionableTypes.has(n.type);
                      const isRead = !!n.is_read;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleNotificationClick(n)}
                          className={`w-full text-left p-2.5 rounded-lg border hover:bg-white/[0.07] transition ${
                            isRead ? 'opacity-55' : ''
                          } ${
                            isActionable
                              ? 'bg-orange-500/[0.06] border-orange-500/20'
                              : 'bg-white/[0.03] border-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 flex-shrink-0">{notifIcon(n.type)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs ${isRead ? 'font-medium text-white/60' : 'font-semibold text-white/85'}`}>{n.title}</span>
                                {isActionable && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 uppercase">Action needed</span>
                                )}
                                {!isRead && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                              </div>
                              <div className="text-xs text-white/55 mt-0.5 line-clamp-2">{n.message}</div>
                              <div className="text-[10px] text-white/35 mt-1">{formatDateTime(n.created_at)}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <span className="text-xs text-white/30 hidden md:block">
          {formatCurrentDateLabel()}
        </span>
      </div>
    </div>
  );
}
