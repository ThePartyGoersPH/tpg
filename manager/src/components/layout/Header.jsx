import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, ChevronDown, GitBranch, X, CheckCheck, Megaphone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { parseUTC } from '../../utils/dateUtils';
import useAuthStore from '../../stores/authStore';
import useBranchStore from '../../stores/branchStore';
import { socialApi } from '../../api/socialApi';
import apiClient, { getUploadUrl } from '../../api/apiClient';
import { NAV_ITEMS } from '../../utils/permissions';
import EventCommentReplyModal from '../EventCommentReplyModal';
import toast from 'react-hot-toast';

// Where each notification type lands in the bar-side portal.
// `target_route` (set by the backend notification service) always wins when it
// is present; this map is the fallback for rows inserted without one — e.g.
// "New Table Reservation", which is written with a plain INSERT.
const NOTIFICATION_ROUTES = {
  // Reservations
  reservation_received: '/reservations',
  reservation_confirmed: '/reservations',
  reservation_approved: '/reservations',
  reservation_rejected: '/reservations',
  reservation_checked_in: '/reservations',
  reservation_completed: '/reservations',
  reservation_no_show: '/reservations',
  reservation_cancelled: '/reservations',
  reservation_reminder: '/reservations',
  reservation_payment_paid: '/reservations',
  reservation_payment_received: '/reservations',
  reservation_payment_failed: '/reservations',
  // Payment setup
  payout_account_verified: '/bar-management',
  payout_account_rejected: '/bar-management',
  payout_verification_claimed: '/bar-management',
  permit_expiry_warning: '/bar-management',
  permit_expired: '/bar-management',
  // Orders + stock
  order_placed: '/financials',
  low_stock: '/inventory',
  purchase_order_created: '/procurement',
  purchase_order_approved: '/procurement',
  purchase_order_rejected: '/procurement',
  // People
  staff_added: '/staff',
  staff_permission_changed: '/staff',
  attendance_late: '/attendance',
  // Social / comments
  event_comment_reply: '/events',
  bar_event_comment_received: '/events',
  bar_event_reply_received: '/events',
  comment_reply: '/social',
  post_comment_reply: '/social',
  bar_post_comment_received: '/social',
  bar_post_reply_received: '/social',
  reply_reply: '/social',
  comment_reaction: '/social',
  reply_reaction: '/social',
  mention: '/social',
  // Platform
  announcement: '/dashboard',
  payout: '/financials',
};

// Transaction refs are free text inside the message
// ("... Status: pending approval. Txn: RES-20260926-C5PCBP.")
const TXN_REF_PATTERN = /RES-\d{8}-[A-Z0-9]+/i;

const resolveNotificationRoute = (notif) => {
  // Unknown/new types still land somewhere useful instead of doing nothing.
  const route = notif.target_route || NOTIFICATION_ROUTES[notif.type] || '/dashboard';
  if (route.startsWith('/reservations')) {
    const txn = TXN_REF_PATTERN.exec(notif.message || '');
    if (txn) return `${route}?ref=${encodeURIComponent(txn[0].toUpperCase())}`;
  }
  return route;
};

const Header = () => {
  const { user } = useAuthStore();
  const { branches, selectedBranch, selectedBarId, fetchBranches, switchBranch } = useBranchStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [branchOpen, setBranchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [replyNotification, setReplyNotification] = useState(null);
  // Draft text kept at Header level so closing/reopening the modal never loses what was typed.
  const [replyDrafts, setReplyDrafts] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const dropdownRef = useRef(null);
  const isOwner = user?.role === 'bar_owner';

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoadingNotifs(true);
      const { data } = await socialApi.getNotifications({ limit: 20, silentError: true });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  // Fetch announcements
  const fetchAnnouncements = async () => {
    try {
      const { data } = await apiClient.get('/auth/platform/announcements?limit=5', { silentError: true });
      setAnnouncements(data.data || []);
    } catch (err) {
      // Silenced — background fetch, not user-initiated
    }
  };

  // One click = mark read + go where this notification is about. The dropdown
  // always closes first so the destination is never covered by it.
  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await socialApi.markNotificationRead(notif.id);
        await fetchNotifications();
      } catch {
        console.error('Failed to mark notification as read');
      }
    }

    // Comment-type notifications open the inline reply modal
    // (reuses the existing event comment thread + reply flow).
    if (notif.metadata?.event_id) {
      setReplyNotification(notif);
      setNotifOpen(false);
      return;
    }

    setNotifOpen(false);
    navigate(resolveNotificationRoute(notif));
  };

  useEffect(() => {
    if (isOwner && branches.length === 0) {
      fetchBranches();
    }
    if (user) {
      fetchNotifications();
      fetchAnnouncements();
      // Refresh notifications every 30 seconds
      const interval = setInterval(() => {
        fetchNotifications();
        fetchAnnouncements();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isOwner, user]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setBranchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSwitch = async (barId) => {
    if (barId === selectedBarId) { setBranchOpen(false); return; }
    const result = await switchBranch(barId);
    if (result.success) {
      toast.success(`Switched to ${result.bar_name}`);
      setBranchOpen(false);
      window.location.reload();
    } else {
      toast.error(result.message);
    }
  };

  const currentNav = NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  const pageTitle = currentNav?.label || (() => {
    if (location.pathname === '/profile') return 'Profile';
    if (location.pathname === '/settings') return 'Settings';
    if (location.pathname === '/branches') return 'My Branches';
    return 'Dashboard';
  })();

  return (
    <header
      className="h-16 flex items-center justify-between px-6 sticky top-0 z-30"
      style={{ background: '#111111', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-4">
        <h2 className="text-base font-bold text-white tracking-wide">
          {typeof pageTitle === 'function' ? pageTitle() : pageTitle}
        </h2>

        {isOwner && branches.length > 1 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setBranchOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#ccc' }}
            >
              <GitBranch className="w-3.5 h-3.5" style={{ color: '#CC0000' }} />
              <span className="font-medium max-w-[160px] truncate">
                {selectedBranch?.name || 'Select Branch'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${branchOpen ? 'rotate-180' : ''}`} style={{ color: '#666' }} />
            </button>

            {branchOpen && (
              <div className="absolute top-full left-0 mt-1 w-64 rounded-xl shadow-2xl py-1 z-50" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#555' }}>Switch Branch</p>
                </div>
                {branches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSwitch(b.id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${b.is_locked ? 'opacity-40' : ''}`}
                    style={b.id === selectedBarId ? { background: 'rgba(204,0,0,0.08)' } : {}}
                    onMouseEnter={(e) => { if (b.id !== selectedBarId) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { if (b.id !== selectedBarId) e.currentTarget.style.background = 'transparent'; }}
                    disabled={b.is_locked}
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.id === selectedBarId ? '#CC0000' : '#333' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{b.name}</p>
                      <p className="text-xs truncate" style={{ color: '#555' }}>{b.city}{b.is_locked ? ' • Locked' : ''}</p>
                    </div>
                    {b.id === selectedBarId && (
                      <span className="text-xs font-medium" style={{ color: '#CC0000' }}>Active</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Search className="w-4 h-4" style={{ color: '#444' }} />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent text-sm outline-none w-40"
            style={{ color: '#ccc' }}
          />
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) { fetchNotifications(); fetchAnnouncements(); } }}
            className="relative p-2 rounded-lg transition-colors"
            style={{ color: '#666' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full text-[10px] text-white font-bold flex items-center justify-center px-1" style={{ background: '#CC0000' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute top-full right-0 mt-2 w-96 rounded-xl shadow-2xl z-50" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h3 className="font-semibold text-white text-sm">
                  Notifications {unreadCount > 0 && <span style={{ color: '#CC0000' }}>({unreadCount})</span>}
                </h3>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          await socialApi.markAllNotificationsRead();
                          await fetchNotifications();
                          toast.success('All notifications marked as read');
                        } catch (err) {
                          toast.error('Failed to mark as read');
                        }
                      }}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: '#666' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
                      title="Mark all as read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setNotifOpen(false)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#666' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {loadingNotifs ? (
                  <div className="px-4 py-8 text-center text-sm" style={{ color: '#555' }}>Loading...</div>
                ) : (
                  <>
                    {/* Platform Announcements */}
                    {announcements.length > 0 && (
                      <>
                        <div className="px-4 py-2" style={{ background: 'rgba(204,0,0,0.05)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#CC0000' }}>Platform Announcements</p>
                        </div>
                        {announcements.map((ann) => (
                          <div
                            key={`ann-${ann.id}`}
                            className="px-4 py-3"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(204,0,0,0.03)' }}
                          >
                            <div className="flex items-start gap-3">
                              <Megaphone className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#CC0000' }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white">{ann.title}</p>
                                <p className="text-sm mt-0.5" style={{ color: '#aaa' }}>{ann.message}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="px-4 py-2" style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#555' }}>Your Notifications</p>
                        </div>
                      </>
                    )}

                    {/* Regular Notifications */}
                    {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      role="button"
                      tabIndex={0}
                      className="px-4 py-3 cursor-pointer transition-colors"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: !notif.is_read ? 'rgba(204,0,0,0.04)' : 'transparent' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = !notif.is_read ? 'rgba(204,0,0,0.04)' : 'transparent'; }}
                      onFocus={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                      onBlur={(e) => { e.currentTarget.style.background = !notif.is_read ? 'rgba(204,0,0,0.04)' : 'transparent'; }}
                      onClick={() => handleNotifClick(notif)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNotifClick(notif); } }}
                    >
                      <div className="flex items-start gap-3">
                        {!notif.is_read && <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#CC0000' }}></div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{notif.title || 'Notification'}</p>
                          <p className="text-sm mt-0.5" style={{ color: '#888' }}>{notif.message}</p>
                          <p className="text-xs mt-1" style={{ color: '#555' }}>
                            {notif.time_ago || formatDistanceToNow(parseUTC(notif.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                    ) : (
                      <div className="px-4 py-8 text-center text-sm" style={{ color: '#555' }}>
                        {announcements.length > 0 ? 'No new notifications' : 'No notifications'}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="flex items-center gap-3 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden" style={{ background: '#CC0000' }}>
            {user?.profile_picture ? (
              <img src={getUploadUrl(user.profile_picture)} alt="" className="w-full h-full object-cover" />
            ) : (
              `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`
            )}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-white leading-tight">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs capitalize" style={{ color: '#555' }}>{user?.role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {replyNotification && (
        <EventCommentReplyModal
          notification={replyNotification}
          draft={replyDrafts[replyNotification.id] || ''}
          onDraftChange={(v) => setReplyDrafts((d) => ({ ...d, [replyNotification.id]: v }))}
          onClose={() => setReplyNotification(null)}
        />
      )}
    </header>
  );
};

export default Header;
