import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './hooks/useAuth';
import { useView } from './hooks/useView';
import { VIEWS } from './contexts/ViewContext';
import { isOwnerPreview, isBarOwner, canOrderAtBar, filterNavItems, isCustomerOnlyView } from './utils/ownerPreview';
import { managerPortalUrl } from './utils/managerLinks';
import { socialService } from './services/socialService';
import { authService } from './services/authService';
import { formatDate } from './utils/dateHelpers';
import { imageUrl } from './utils/imageUrl';
import { sortNotifications } from './utils/notificationSort';
import { Bell, Home, Wine, MapPin, CalendarDays, BookMarked, CreditCard, User, Menu, X, Star, Heart, PartyPopper, Megaphone, MessageCircle } from 'lucide-react';
import ThemeToggle from './components/ui/ThemeToggle';

import LandingView from './views/LandingView';
import LoginView from './views/LoginView';
import RegisterView from './views/RegisterView';
import HomeView from './views/HomeView';
import BarsView from './views/BarsView';
import BarDetailView from './views/BarDetailView';
import EventsView from './views/EventsView';
import ReservationsView from './views/ReservationsView';
import PaymentsView from './views/PaymentsView';
import ProfileView from './views/ProfileView';
import NotificationsView from './views/NotificationsView';
import PaymentSuccessView from './views/PaymentSuccessView';
import PaymentFailedView from './views/PaymentFailedView';
import VerifyEmailView from './views/VerifyEmailView';
import ResetPasswordView from './views/ResetPasswordView';

const MapView = lazy(() => import('./views/MapView'));

const NAV_ICON_SIZE = 16;
const NAV_ITEMS = [
  { view: VIEWS.HOME, label: 'Home', icon: <Home size={NAV_ICON_SIZE} /> },
  { view: VIEWS.BARS, label: 'Bars', icon: <Wine size={NAV_ICON_SIZE} /> },
  { view: VIEWS.MAP, label: 'Map', icon: <MapPin size={NAV_ICON_SIZE} /> },
  { view: VIEWS.EVENTS, label: 'Events', icon: <CalendarDays size={NAV_ICON_SIZE} /> },
  { view: VIEWS.RESERVATIONS, label: 'Reservations', icon: <BookMarked size={NAV_ICON_SIZE} /> },
  { view: VIEWS.PAYMENTS, label: 'Payments', icon: <CreditCard size={NAV_ICON_SIZE} /> },
  { view: VIEWS.PROFILE, label: 'Profile', icon: <User size={NAV_ICON_SIZE} /> },
];

const NOTIF_ICON = (type) => {
  if (!type) return <Bell size={18} />;
  const t = type.toLowerCase();
  if (t.includes('reply')) return <MessageCircle size={18} />;
  if (t.includes('reservation')) return <CalendarDays size={18} />;
  if (t.includes('payment')) return <CreditCard size={18} />;
  if (t.includes('event')) return <PartyPopper size={18} />;
  if (t.includes('review')) return <Star size={18} />;
  if (t.includes('follow')) return <Heart size={18} />;
  if (t.includes('comment')) return <MessageCircle size={18} />;
  return <Bell size={18} />;
};

function fallbackNotificationDestination(notification) {
  const t = String(notification?.type || '').toLowerCase();
  if (t === 'mention') {
    // Try to use stored target_route/metadata for deep-link
    const meta = notification?.metadata;
    const barId = Number(meta?.bar_id || 0);
    if (barId > 0) {
      return {
        view: VIEWS.BAR_DETAIL,
        params: {
          barId,
          ...(meta?.media_id ? { openMediaId: Number(meta.media_id) } : {}),
          ...(meta?.comment_id ? { highlightCommentId: Number(meta.comment_id) } : {}),
        },
      };
    }
    return { view: VIEWS.HOME, params: {} };
  }
  if (t.includes('reply') || t.includes('comment') || t.includes('reaction') || t.includes('event')) {
    return { view: VIEWS.EVENTS, params: {} };
  }
  if (t.includes('reservation')) return { view: VIEWS.RESERVATIONS, params: {} };
  if (t.includes('payment')) return { view: VIEWS.PAYMENTS, params: {} };
  if (t.includes('announcement')) return { view: VIEWS.HOME, params: {} };
  return { view: VIEWS.NOTIFICATIONS, params: {} };
}

function mapResolvedTargetToDestination(target, notification) {
  const fallback = fallbackNotificationDestination(notification);
  if (!target || typeof target !== 'object') return fallback;

  const normalizedTarget = {
    ...target,
    notification_id: Number(target.notification_id || notification?.id || 0) || null,
  };

  const view = String(normalizedTarget.view || '').toLowerCase();
  const route = String(normalizedTarget.route || '').toLowerCase();

  if (view === 'reservation_detail' || view === 'reservations' || route === '/reservations') {
    const reservationId = Number(normalizedTarget.reservation_id || notification?.reference_id || 0);
    return {
      view: VIEWS.RESERVATIONS,
      params: {
        notificationTarget: normalizedTarget,
        ...(reservationId > 0 ? { reservationId } : {}),
      },
    };
  }

  if (view === 'post_detail' || view === 'event_detail' || view === 'events' || route === '/events') {
    return {
      view: VIEWS.EVENTS,
      params: { notificationTarget: normalizedTarget },
    };
  }

  if (view === 'payments' || route === '/payments') {
    return { view: VIEWS.PAYMENTS, params: {} };
  }

  if (view === 'bar_detail' || route.startsWith('/bars/')) {
    const barId = Number(normalizedTarget.bar_id || 0);
    return {
      view: VIEWS.BAR_DETAIL,
      params: {
        barId,
        notificationTarget: normalizedTarget,
        ...(normalizedTarget.media_id ? { openMediaId: Number(normalizedTarget.media_id) } : {}),
        ...(normalizedTarget.comment_id ? { highlightCommentId: Number(normalizedTarget.comment_id) } : {}),
      },
    };
  }

  if (view === 'home' || route === '/home') {
    return { view: VIEWS.HOME, params: {} };
  }

  return fallback;
}

function NotificationsPanel({ open, onClose, onNavigate }) {
  const [tab, setTab] = useState('updates');
  const [notifications, setNotifications] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const unread = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if (!open) return;

    let active = true;
    let requestSeq = 0;
    const loadPanelData = async (silent = false) => {
      if (!silent) setLoading(true);
      const seq = ++requestSeq;
      try {
        const [nd, an] = await Promise.all([
          socialService.notifications({ limit: 30 }),
          authService.getAnnouncements(10),
        ]);
        // A slower earlier response must never overwrite a newer payload.
        if (!active || seq !== requestSeq) return;
        setNotifications(sortNotifications(nd?.notifications || nd?.data || []));
        setAnnouncements(Array.isArray(an) ? an : []);
      } catch (_) {
        // Keep existing panel data on transient failures.
      } finally {
        if (!silent && active && seq === requestSeq) setLoading(false);
      }
    };

    loadPanelData(false);
    const refreshId = setInterval(() => loadPanelData(true), 15000);

    return () => {
      active = false;
      clearInterval(refreshId);
    };
  }, [open]);

  const markRead = async (id) => {
    try {
      await socialService.markOneRead(id);
      setNotifications(p => p.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (_) {
      // Fallback to old endpoint
      try { await socialService.markNotificationRead(id); } catch (_2) {}
      setNotifications(p => p.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    }
  };

  const markAllRead = async () => {
    try {
      await socialService.markAllRead();
      setNotifications(p => p.map(n => ({ ...n, is_read: 1 })));
    } catch (_) {
      // Fallback to old approach
      try {
        await Promise.all(notifications.filter(n => !n.is_read).map(n => socialService.markNotificationRead(n.id)));
        setNotifications(p => p.map(n => ({ ...n, is_read: 1 })));
      } catch (_2) {}
    }
  };

  const handleNotifClick = async (n) => {
    // Mark as read in background (non-blocking)
    if (!n.is_read) {
      markRead(n.id).catch(() => {});
    }

    let destination = fallbackNotificationDestination(n);

    const notifId = Number(n?.id || 0);
    if (notifId > 0) {
      try {
        const resolved = await socialService.notificationTarget(notifId);
        destination = mapResolvedTargetToDestination(resolved?.target, n);
      } catch (_) {
        destination = fallbackNotificationDestination(n);
      }
    }

    // Close panel first, then navigate
    onClose();
    // Use requestAnimationFrame to ensure panel is closed before navigating
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (onNavigate) {
          onNavigate(destination.view, destination.params || {});
        }
      });
    });
  };

  if (!open) return null;

  return (
    <div className="notif-panel-backdrop" onClick={onClose}>
      <div className="notif-panel" onClick={e => e.stopPropagation()}>
        <div className="notif-panel-header">
          <h3 className="text-h3">Notifications</h3>
          <div className="flex gap-sm items-center">
            {unread > 0 && <button className="btn btn-glass btn-sm" onClick={markAllRead}>Mark all read</button>}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="notif-panel-tabs">
          <button className={`notif-tab ${tab === 'updates' ? 'active' : ''}`} onClick={() => setTab('updates')}>
            Updates {unread > 0 && <span className="notif-badge-inline">{unread}</span>}
          </button>
          <button className={`notif-tab ${tab === 'announcements' ? 'active' : ''}`} onClick={() => setTab('announcements')}>
            Announcements
          </button>
        </div>

        <div className="notif-panel-body">
          {loading ? (
            <div className="loading-state" style={{ padding: '2rem' }}><div className="spinner" /><span>Loading...</span></div>
          ) : tab === 'updates' ? (
            notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-icon"><Bell size={32} /></div>
                <p className="text-muted">No notifications yet.</p>
              </div>
            ) : (
              <div className="notif-list">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className={`notif-item ${!n.is_read ? 'unread' : ''}`}
                    onClick={() => handleNotifClick(n)}
                    style={{ cursor: 'pointer' }}
                  >
                    {!n.is_read && <div className="notif-dot" />}
                    <div className="notif-icon">{NOTIF_ICON(n.type)}</div>
                    <div className="notif-content">
                      <div className="notif-title">{n.title || 'Notification'}</div>
                      <div className="notif-msg">{n.message || ''}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="notif-time">{n.time_ago || formatDate(n.created_at)}</div>
                        {!n.is_read && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.1rem 0.4rem', borderRadius: '6px' }}>NEW</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            announcements.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-icon"><Megaphone size={32} /></div>
                <p className="text-muted">No announcements.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-sm" style={{ padding: '0.75rem' }}>
                {announcements.map(a => (
                  <div className="glass-card glass-card-body" key={a.id} style={{ padding: '1rem' }}>
                    <h4 className="text-h4">{a.title}</h4>
                    <p className="text-body mt-sm" style={{ fontSize: '0.85rem' }}>{a.message}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function NavAvatar({ user }) {
  const [imgFailed, setImgFailed] = useState(false);
  const pic = user?.profile_url || user?.profile_picture;
  const src = pic ? imageUrl(pic) : '';
  const initial = (user?.first_name?.[0] || '?').toUpperCase();

  const placeholder = (
    <div className="avatar-ring" style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-red-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, color: '#fff', flexShrink: 0, letterSpacing: 0 }}>
      {initial}
    </div>
  );

  if (!src || imgFailed) return placeholder;

  return (
    <img
      src={src}
      alt={user?.first_name}
      className="avatar-ring"
      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      onError={() => setImgFailed(true)}
    />
  );
}

function Sidebar({ currentView, navigate, sidebarOpen, onToggleSidebar }) {
  const { user } = useAuth();
  const visibleItems = filterNavItems(NAV_ITEMS, user);
  return (
    <>
      {/* Sidebar */}
      <aside className={`app-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Menu</span>
        </div>
        <nav className="sidebar-nav">
          {visibleItems.map((item) => (
            <button
              key={item.view}
              className={`sidebar-link ${currentView === item.view ? 'active' : ''}`}
              onClick={() => navigate(item.view)}
              title={item.label}
            >
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={onToggleSidebar} />
      )}
    </>
  );
}

function GlassNav({ onOpenNotif, unread, onToggleSidebar, sidebarOpen }) {
  const { user, logout, isAuthenticated, maintenance } = useAuth();
  const { currentView, navigate } = useView();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (view) => {
    navigate(view);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate(VIEWS.LANDING);
  };

  return (
    <>
      {maintenance?.active && (
        <div className="maintenance-bar">
          <span>🔧</span>
          <span>{maintenance.message}</span>
        </div>
      )}
      <header className="glass-nav">
        <div className="glass-nav-left">
          {isAuthenticated && (
            <button 
              className="sidebar-toggle-btn" 
              onClick={onToggleSidebar}
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              <Menu size={22} />
            </button>
          )}
          <div className="brand" onClick={() => go(isAuthenticated ? VIEWS.HOME : VIEWS.LANDING)}>
            <img src="/party-logo-v2.png" alt="Logo" className="brand-logo" onError={(e) => { e.target.style.display = 'none'; }} />
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '0.82rem', letterSpacing: '1.5px', textTransform: 'uppercase' }}>THE PARTY<span className="brand-accent"> GOERS</span></span>
          </div>
        </div>

        {isAuthenticated ? (
          <>
            <div className="nav-actions">
              <ThemeToggle />
              <button className="notif-bell" onClick={onOpenNotif} title="Notifications">
                <Bell size={18} strokeWidth={2} style={{ color: 'var(--color-text-primary)' }} />
                {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
              </button>
              <div className="flex items-center gap-sm" style={{ cursor: 'pointer' }} onClick={() => navigate(VIEWS.PROFILE)}>
                <NavAvatar user={user} />
                <span className="nav-username" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{user?.first_name}</span>
              </div>
              <button className="btn btn-ghost btn-sm nav-logout" onClick={handleLogout}>Logout</button>
            </div>
          </>
        ) : (
          <div className="nav-actions">
            <ThemeToggle />
            <button className="btn btn-ghost btn-sm" onClick={() => go(VIEWS.LOGIN)}>Login</button>
            <button className="btn btn-red btn-sm" onClick={() => go(VIEWS.REGISTER)}>Register</button>
          </div>
        )}
      </header>

      {/* Mobile menu */}
      <div className={`mobile-menu ${mobileOpen ? 'open' : ''}`}>
        <button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={22} /></button>
        <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Appearance</span>
          <ThemeToggle showLabel />
        </div>
        {filterNavItems(NAV_ITEMS, user).map((item) => (
          <button
            key={item.view}
            className={`nav-link ${currentView === item.view ? 'active' : ''}`}
            onClick={() => go(item.view)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>{item.icon}{item.label}</span>
          </button>
        ))}
        <button className="btn btn-ghost" onClick={handleLogout} style={{ marginTop: '1rem' }}>Logout</button>
      </div>

      {/* Sidebar for authenticated users */}
      {isAuthenticated && (
        <Sidebar 
          currentView={currentView} 
          navigate={go} 
          sidebarOpen={sidebarOpen}
          onToggleSidebar={onToggleSidebar}
        />
      )}
    </>
  );
}

const FULL_WIDTH_VIEWS = [VIEWS.LANDING, VIEWS.LOGIN, VIEWS.REGISTER, VIEWS.PAYMENT_SUCCESS, VIEWS.PAYMENT_FAILED, VIEWS.VERIFY_EMAIL, VIEWS.HOME, VIEWS.RESET_PASSWORD, VIEWS.MAP];
const MAINTENANCE_EXEMPT = [VIEWS.LANDING, VIEWS.LOGIN, VIEWS.REGISTER, VIEWS.PAYMENT_SUCCESS, VIEWS.PAYMENT_FAILED, VIEWS.VERIFY_EMAIL, VIEWS.RESET_PASSWORD];

function PreviewBlockedNotice() {
  const { navigate } = useView();
  return (
    <div className="empty-state" style={{ minHeight: '60vh' }}>
      <div className="empty-icon">👁️</div>
      <h2 className="text-h2">Not available in owner preview</h2>
      <p className="text-muted mt-sm">Reservations and payments are customer-only areas.</p>
      <button className="btn btn-red" style={{ marginTop: '1rem' }} onClick={() => navigate(VIEWS.HOME)}>
        Back to Home
      </button>
    </div>
  );
}

function ViewRenderer() {
  const { currentView, transitioning } = useView();
  const { user, isAuthenticated, loading, maintenance } = useAuth();

  if (loading) {
    return (
      <div className="loading-state" style={{ minHeight: '80vh' }}>
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (maintenance?.active && isAuthenticated && !MAINTENANCE_EXEMPT.includes(currentView)) {
    return (
      <div className="empty-state" style={{ minHeight: '60vh' }}>
        <div className="empty-icon">🛠️</div>
        <h2 className="text-h2">Under Maintenance</h2>
        <p className="text-muted mt-sm">{maintenance.message}</p>
      </div>
    );
  }

  // Owner preview guard: non-customer roles can never render
  // customer-only views, no matter how they navigate here
  // (menu, deep-links, notifications, or restored sessions).
  if (isAuthenticated && isOwnerPreview(user) && isCustomerOnlyView(currentView)) {
    return (
      <div className="view-container">
        <div className="view active">
          <PreviewBlockedNotice />
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case VIEWS.LANDING: return <LandingView />;
      case VIEWS.LOGIN: return <LoginView />;
      case VIEWS.REGISTER: return <RegisterView />;
      case VIEWS.HOME: return isAuthenticated ? <HomeView /> : <LandingView />;
      case VIEWS.BARS: return isAuthenticated ? <BarsView /> : <LoginView />;
      case VIEWS.BAR_DETAIL: return isAuthenticated ? <BarDetailView /> : <LoginView />;
      case VIEWS.MAP:
        return (
          <Suspense fallback={<div className="loading-state"><div className="spinner" /><span>Loading map...</span></div>}>
            <MapView />
          </Suspense>
        );
      case VIEWS.EVENTS: return isAuthenticated ? <EventsView /> : <LoginView />;
      case VIEWS.RESERVATIONS: return isAuthenticated ? <ReservationsView /> : <LoginView />;
      case VIEWS.PAYMENTS: return isAuthenticated ? <PaymentsView /> : <LoginView />;
      case VIEWS.NOTIFICATIONS: return isAuthenticated ? <NotificationsView /> : <LoginView />;
      case VIEWS.PROFILE: return isAuthenticated ? <ProfileView /> : <LoginView />;
      case VIEWS.PAYMENT_SUCCESS: return <PaymentSuccessView />;
      case VIEWS.PAYMENT_FAILED: return <PaymentFailedView />;
      case VIEWS.VERIFY_EMAIL: return <VerifyEmailView />;
      case VIEWS.RESET_PASSWORD: return <ResetPasswordView />;
      default: return <LandingView />;
    }
  };

  return (
    <div className="view-container">
      <div className={`view ${transitioning ? '' : 'active'}`}>
        {renderView()}
      </div>
    </div>
  );
}

function mapNotificationToView(notification) {
  return fallbackNotificationDestination(notification).view;
}

function shouldSurfaceLiveNotification(notification) {
  const t = String(notification?.type || '').toLowerCase();
  return t.includes('reply') || t.includes('comment');
}

function LiveNotificationToast({ notification, onOpen, onDismiss }) {
  if (!notification) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: '1rem',
        bottom: '1rem',
        zIndex: 1200,
        width: 'min(360px, calc(100vw - 2rem))',
        background: 'rgba(12, 16, 28, 0.96)',
        border: '1px solid rgba(204, 0, 0, 0.45)',
        borderRadius: '14px',
        boxShadow: '0 14px 38px rgba(0, 0, 0, 0.45)',
        padding: '0.9rem 0.95rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ color: '#ef4444', marginTop: '0.15rem' }}><MessageCircle size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.68)', marginBottom: '0.2rem' }}>
          New reply
        </div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.22rem', lineHeight: 1.3 }}>
          {notification.title || 'New Reply to Your Comment'}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', lineHeight: 1.35 }}>
          {notification.message || 'Someone replied to your comment.'}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.62rem' }}>
          <button className="btn btn-red btn-sm" onClick={onOpen}>Open</button>
          <button className="btn btn-ghost btn-sm" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

function OwnerPreviewBanner() {
  const { user } = useAuth();
  const { currentView, viewParams } = useView();
  // Owners see it on every page; staff see it while viewing their own bar
  // (bar detail carries barId in the view params).
  const showForOwnBar =
    currentView === VIEWS.BAR_DETAIL &&
    Number(viewParams?.barId) > 0 &&
    !canOrderAtBar(user, { id: viewParams.barId });
  if (!isBarOwner(user) && !showForOwnBar) return null;
  return (
    <div
      className="owner-preview-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.6rem',
        flexWrap: 'wrap',
        padding: '0.4rem 0.75rem',
        paddingTop: 'calc(0.4rem + env(safe-area-inset-top, 0px))',
        background: 'rgba(204, 0, 0, 0.14)',
        borderBottom: '1px solid rgba(204, 0, 0, 0.4)',
        color: '#fff',
        fontSize: '0.8rem',
        fontWeight: 600,
        textAlign: 'center',
        zIndex: 1100,
      }}
    >
      <span>👁 View-only mode</span>
      <button
        className="btn btn-red btn-sm"
        style={{ minHeight: '32px', padding: '0.15rem 0.7rem', fontSize: '0.75rem' }}
        onClick={() => { window.location.href = managerPortalUrl(); }}
      >
        Back to Portal
      </button>
    </div>
  );
}

function App() {
  const { currentView, navigate } = useView();
  const { user, isAuthenticated } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tpg_sidebar_open');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 1024;
    }
    return true;
  });

  const handleToggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('tpg_sidebar_open', String(next));
      return next;
    });
  };
  const [liveNotification, setLiveNotification] = useState(null);
  const seenNotificationIdsRef = useRef(new Set());
  const notificationsPrimedRef = useRef(false);

  const openNotificationDestination = useCallback(async (notification) => {
    let destination = fallbackNotificationDestination(notification);
    const notifId = Number(notification?.id || 0);

    if (notifId > 0) {
      try {
        const resolved = await socialService.notificationTarget(notifId);
        destination = mapResolvedTargetToDestination(resolved?.target, notification);
      } catch (_) {
        destination = fallbackNotificationDestination(notification);
      }
    }

    navigate(destination.view, destination.params || {});
  }, [navigate]);

  const surfaceLiveNotification = useCallback((notification) => {
    if (!shouldSurfaceLiveNotification(notification)) return;

    setLiveNotification(notification);

    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const browserNotif = new Notification(notification.title || 'New reply', {
      body: notification.message || 'Someone replied to your comment.',
      tag: `reply-${notification.id}`,
    });
    browserNotif.onclick = () => {
      window.focus();
      setLiveNotification(null);
      openNotificationDestination(notification);
    };
  }, [openNotificationDestination]);

  const trackIncomingNotifications = useCallback((items) => {
    if (!Array.isArray(items) || items.length === 0) return;

    const seen = seenNotificationIdsRef.current;
    const newOnes = [];

    for (let i = items.length - 1; i >= 0; i -= 1) {
      const n = items[i];
      const id = Number(n?.id || 0);
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      newOnes.push(n);
    }

    if (!notificationsPrimedRef.current) {
      notificationsPrimedRef.current = true;
      return;
    }

    for (const n of newOnes) {
      if (!n?.is_read) {
        surfaceLiveNotification(n);
      }
    }
  }, [surfaceLiveNotification]);

  useEffect(() => {
    if (!isAuthenticated) {
      seenNotificationIdsRef.current = new Set();
      notificationsPrimedRef.current = false;
      setLiveNotification(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!liveNotification) return;
    const timeoutId = setTimeout(() => setLiveNotification(null), 6000);
    return () => clearTimeout(timeoutId);
  }, [liveNotification]);

  const fetchUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      // Use dedicated unread-count endpoint while separately polling latest items for live alerts.
      const d = await socialService.unreadCount().catch(() => null);
      if (d?.count !== undefined) {
        setUnread(d.count);
      }

      const nd = await socialService.notifications({ limit: 10 }).catch(() => null);
      if (d?.count === undefined) {
        setUnread(nd?.unread_count || 0);
      }

      const latest = nd?.notifications || nd?.data || [];
      trackIncomingNotifications(latest);
    } catch (_) {}
  }, [isAuthenticated, trackIncomingNotifications]);

  useEffect(() => {
    fetchUnread();
    const iv = setInterval(fetchUnread, 15000);
    return () => clearInterval(iv);
  }, [fetchUnread]);

  const isFullWidth = FULL_WIDTH_VIEWS.includes(currentView) ||
    (!isAuthenticated && currentView === VIEWS.HOME);

  return (
    <div className={`app-shell ${isAuthenticated ? 'with-sidebar' : ''} ${sidebarOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}>
      <OwnerPreviewBanner />
      <GlassNav 
        onOpenNotif={() => setNotifOpen(true)} 
        unread={unread} 
        onToggleSidebar={handleToggleSidebar}
        sidebarOpen={sidebarOpen}
      />
      <main className={isFullWidth ? '' : 'app-body'}>
        <ErrorBoundary>
          <ViewRenderer />
        </ErrorBoundary>
      </main>
      <NotificationsPanel open={notifOpen} onClose={() => { setNotifOpen(false); fetchUnread(); }} onNavigate={navigate} />
      <LiveNotificationToast
        notification={liveNotification}
        onOpen={() => {
          if (liveNotification) openNotificationDestination(liveNotification);
          setLiveNotification(null);
        }}
        onDismiss={() => setLiveNotification(null)}
      />
    </div>
  );
}

export default App;
