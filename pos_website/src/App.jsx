import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Clock3,
  Maximize2,
  Minimize2,
  LogOut,
  ShoppingBag,
  Store,
} from 'lucide-react';
import LoginPage from './pages/LoginPage';
import DashboardTab from './pages/DashboardTab';
import NewOrderTab from './pages/NewOrderTab';
import ActivityPage from './pages/ActivityPage';
import { useAuth } from './contexts/useAuth';

function LoadingScreen() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h2>Loading POS...</h2>
      </div>
    </div>
  );
}

export default function App() {
  const { initialized, isAuthenticated, user, logout, can } = useAuth();
  const [activeView, setActiveView] = useState('pos');
  const [now] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef(null);

  useEffect(() => {
    const updateFullscreenState = () => {
      const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(Boolean(fsElement));
    };

    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState);
    updateFullscreenState();

    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
      if (fsElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
        return;
      }

      const target = shellRef.current || document.documentElement;
      if (target.requestFullscreen) {
        await target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen toggle failed:', err);
    }
  };

  const views = useMemo(() => {
    const nextViews = [];
    if (can('menu_view')) {
      nextViews.push({ id: 'pos', label: 'Point of Sales', icon: ShoppingBag });
      nextViews.push({ id: 'activity', label: 'Activity', icon: Activity });
      nextViews.push({ id: 'report', label: 'Report', icon: BarChart3 });
    }
    return nextViews;
  }, [can]);
  const resolvedView = views.some((view) => view.id === activeView) ? activeView : (views[0]?.id || 'pos');

  if (!initialized) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const canManage = can('reservation_manage');
  const canView = can('reservation_view');

  return (
    <div className="pos-shell-bg" ref={shellRef}>
      <div className="pos-shell">
        <aside className="left-nav">
          <div className="brand-block">
            <span className="brand-mark">TPG</span>
            <div>
              <strong>The Partygoers</strong>
              <p>POS Terminal</p>
            </div>
          </div>

          <div className="left-user">
            <div className="user-pill">
              <span className="avatar-dot">{String(user?.first_name?.[0] || 'U').toUpperCase()}</span>
              <div>
                <strong>{user?.first_name || 'POS User'} {user?.last_name || ''}</strong>
                <p>{String(user?.role || user?.role_name || '').replace('_', ' ') || 'Staff'}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="nav-label">Workspace</p>
            <nav className="nav-list">
              {views.map((view) => {
                const Icon = view.icon;
                return (
                  <button
                    key={view.id}
                    className={resolvedView === view.id ? 'nav-btn active' : 'nav-btn'}
                    onClick={() => setActiveView(view.id)}
                  >
                    <Icon size={17} />
                    <span>{view.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <button className="nav-btn logout" onClick={logout}>
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </aside>

        <div className="main-stage">
          <header className="stage-topbar">
            <div className="top-chip"><Store size={14} /> POS Floor</div>
            <div className="top-chip"><CalendarDays size={14} /> {now.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div className="top-chip"><Clock3 size={14} /> {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="top-chip open"><span className="dot" /> Open Order</div>
            <button type="button" className="top-chip top-chip-action" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </button>
          </header>

          <main>
            {resolvedView === 'pos' ? (
              <NewOrderTab canManage={canManage} onOrderCreated={() => setActiveView('pos')} />
            ) : null}
            {resolvedView === 'activity' ? <ActivityPage canManage={canManage} canView={canView} /> : null}
            {resolvedView === 'report' ? <DashboardTab /> : null}
          </main>
        </div>
      </div>
      {!views.length ? (
        <div className="no-perms">
          <p className="error-msg">
            Your account has no POS permissions. Required permissions include menu_view, reservation_view, and reservation_manage.
          </p>
        </div>
      ) : null}
    </div>
  );
}
