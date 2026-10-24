import { useEffect, useState, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { socialService } from '../../services/socialService';
import { imageUrl } from '../../utils/imageUrl';
import '../../styles/enhancements.css';

const navItems = [
  { to: '/dashboard', label: '🏠 Home' },
  { to: '/dashboard/bars', label: '🍸 Bars' },
  { to: '/map', label: '🗺️ Map' },
  { to: '/dashboard/events', label: '🎉 Events' },
  { to: '/dashboard/reservations', label: '📅 Reservations' },
  { to: '/dashboard/payments', label: '💳 Payments' },
  { to: '/dashboard/profile', label: '👤 Profile' },
];

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const fetchUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await socialService.notifications(1);
      setUnreadCount(data?.unread_count || 0);
    } catch (_err) {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMobileOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="navbar-wrap">
        <div className="container navbar">
          <div>
            <div className="brand">Party<span className="brand-accent">Goers</span></div>
            <div className="brand-sub">Discover · Reserve · Experience</div>
          </div>

          <nav className="nav-links">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {item.label.split(' ').slice(1).join(' ')}
              </NavLink>
            ))}
          </nav>

          <div className="user-tools">
            <NavLink to="/dashboard/notifications" className="notification-bell" title="Notifications">
              🔔
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </NavLink>
            <div className="user-profile-info">
              {user?.profile_picture ? (
                <img
                  src={imageUrl(user.profile_picture)}
                  alt={user.first_name}
                  className="user-avatar"
                />
              ) : (
                <div className="user-avatar-placeholder">{user?.first_name?.charAt(0) || 'U'}</div>
              )}
              <span className="desktop-only">{user?.first_name}</span>
            </div>
            <button className="btn btn-ghost btn-sm nav-logout" onClick={handleLogout} type="button">
              Logout
            </button>

            {/* Hamburger — mobile only */}
            <button
              className="mobile-toggle"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle navigation"
              type="button"
            >
              <span className={`hamburger ${mobileOpen ? 'open' : ''}`}>
                <span /><span /><span />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="mobile-nav-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <nav className={`mobile-nav-drawer ${mobileOpen ? 'open' : ''}`}>
        <div className="mobile-nav-header">
          <div className="brand">Party<span className="brand-accent">Goers</span></div>
          <button
            className="mobile-nav-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            type="button"
          >✕</button>
        </div>

        <div className="mobile-nav-user">
          {user?.profile_picture ? (
            <img
              src={imageUrl(user.profile_picture)}
              alt={user.first_name}
              className="user-avatar"
            />
          ) : (
            <div className="user-avatar-placeholder">{user?.first_name?.charAt(0) || 'U'}</div>
          )}
          <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>
            {user?.first_name} {user?.last_name}
          </span>
        </div>

        <div className="mobile-nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}
            >
              <span className="mobile-nav-icon">{item.label.split(' ')[0]}</span>
              {item.label.split(' ').slice(1).join(' ')}
            </NavLink>
          ))}

          <NavLink to="/dashboard/notifications" className="mobile-nav-link" onClick={() => setMobileOpen(false)}>
            <span className="mobile-nav-icon">🔔</span>
            Notifications
            {unreadCount > 0 && <span className="mobile-nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </NavLink>
        </div>

        <div className="mobile-nav-footer">
          <button className="btn btn-ghost w-full" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </nav>
    </>
  );
}

export default Navbar;
