import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Beer, Package, UtensilsCrossed, Grid3x3,
  CalendarCheck, PartyPopper, Monitor, Users, Clock, CalendarOff,
  Wallet, FileText, UserCheck, Star, Percent, BarChart3, Heart,
  ScrollText, LogOut, Settings, User, ChevronLeft, ChevronRight,
  GitBranch, Crown, ShieldCheck, DollarSign, ChevronDown,
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import { getUploadUrl } from '../../api/apiClient';
import { NAV_ITEMS } from '../../utils/permissions';
import { NAV_GROUPS, findGroupForRoute } from '../../utils/navigationGroups';
import logoImg from '../../../logo.png';

const iconMap = {
  LayoutDashboard, Beer, Package, UtensilsCrossed, Grid3x3,
  CalendarCheck, PartyPopper, Monitor, Users, Clock, CalendarOff,
  Wallet, FileText, UserCheck, Star, Percent, BarChart3, Heart,
  ScrollText, Settings, User, GitBranch, Crown, ShieldCheck, DollarSign,
};

const NavGroupItem = ({ group, collapsed, isExpanded, onToggle, currentPath }) => {
  const GroupIcon = group.icon;
  const isActive = group.items.some(item => item.path === currentPath);

  // Standalone items (no dropdown)
  if (group.isStandalone && group.items.length === 1) {
    const item = group.items[0];
    const ItemIcon = item.icon;
    return (
      <NavLink
        to={item.path}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
            isActive
              ? 'text-white'
              : 'hover:text-white'
          }`
        }
        style={({ isActive }) => isActive ? {
          background: 'rgba(204,0,0,0.15)',
          borderLeft: '2px solid #CC0000',
        } : { borderLeft: '2px solid transparent', color: '#888' }}
        title={collapsed ? item.label : undefined}
      >
        <ItemIcon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </NavLink>
    );
  }

  // Group with dropdown — expands ONLY on click (no hover behavior).
  // Hover is handled purely by CSS classes (text/background highlight).
  return (
    <div className="relative">
      {/* Group Header */}
      <button
        onClick={() => onToggle(group.id)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:text-white"
        style={isActive ? { background: 'var(--m-active-bg)' } : { color: '#888' }}
        title={collapsed ? group.label : undefined}
      >
        <GroupIcon className="w-[18px] h-[18px] flex-shrink-0" style={isActive ? { color: '#CC0000' } : {}} />
        {!collapsed && (
          <>
            <span className="truncate flex-1 text-left">{group.label}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </>
        )}
      </button>

      {/* Dropdown Items */}
      {!collapsed && isExpanded && (
        <div className="mt-1 ml-2 pl-4 space-y-0.5 animate-slideDown" style={{ borderLeft: '1px solid var(--m-border)' }}>
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive ? 'text-white' : 'hover:text-white'
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: 'rgba(204,0,0,0.15)',
                  borderLeft: '2px solid #CC0000',
                } : { borderLeft: '2px solid transparent', color: '#888' }}
              >
                <ItemIcon className="w-[16px] h-[16px] flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}

      {/* Collapsed state tooltip */}
      {collapsed && isExpanded && (
        <div className="fixed left-[68px] rounded-lg shadow-xl py-2 px-1 min-w-[200px] z-50 animate-fadeIn" style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)' }}>
          <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: '#555' }}>
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const ItemIcon = item.icon;
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive ? 'text-white' : 'hover:text-white'
                    }`
                  }
                  style={({ isActive }) => isActive ? { background: 'rgba(204,0,0,0.15)' } : { color: '#888' }}
                >
                  <ItemIcon className="w-[16px] h-[16px] flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ collapsed, onToggle, mobileOpen, onClose }) => {
  const { user, logout, hasPermission } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebar.expanded') || '{}');
    } catch (e) {
      return {};
    }
  });

  const isOwner = user?.role === 'bar_owner';

  // Permission-aware filtering: reuse the SAME hasPermission() the route
  // guard (ProtectedRoute) uses, so the sidebar can never drift from the
  // page-level access control. Items the user cannot access are dropped,
  // and parent groups left with zero visible children are hidden entirely.
  // Groups with ownerOnly: true are hidden entirely from non-owner users.
  const visibleGroups = NAV_GROUPS
    .filter((group) => !(group.ownerOnly && !isOwner))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPermission(item.permissions || [])),
    }))
    .filter((group) => group.items.length > 0);

  // Auto-expand the group containing the current route, and persist manual
  // expand/collapse state so it survives navigation and reloads.
  useEffect(() => {
    const currentGroupId = findGroupForRoute(location.pathname);
    if (currentGroupId) {
      setExpandedGroups(prev => {
        if (prev[currentGroupId]) return prev;
        const next = { ...prev, [currentGroupId]: true };
        try { localStorage.setItem('sidebar.expanded', JSON.stringify(next)); } catch (e) {}
        return next;
      });
    }
  }, [location.pathname]);

  const handleGroupToggle = (groupId) => {
    setExpandedGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try { localStorage.setItem('sidebar.expanded', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-dvh text-white flex flex-col transition-all duration-300 z-50 ${
        collapsed ? 'w-[68px]' : 'w-[260px]'
      } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      style={{ background: 'var(--m-surface)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid var(--m-border)' }}>
        <img src={logoImg} alt="Logo" className="w-9 h-9 rounded-lg object-contain flex-shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-white leading-tight truncate">The Party Goers</h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#CC0000' }}>BAR OWNER PORTAL</span>
          </div>
        )}
      </div>

      {/* User Badge */}
      {!collapsed && user && (
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--m-border)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white overflow-hidden" style={{ background: '#CC0000' }}>
              {user.profile_picture ? (
                <img src={getUploadUrl(user.profile_picture)} alt="" className="w-full h-full object-cover" />
              ) : (
                `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium truncate text-white">{user.first_name} {user.last_name}</p>
              <p className="text-[10px] uppercase" style={{ color: '#555' }}>{user.role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5"
        onClick={(e) => { if (e.target.closest('a[href]') && onClose) onClose(); }}
      >
        {visibleGroups.map((group) => (
          <NavGroupItem
            key={group.id}
            group={group}
            collapsed={collapsed}
            isExpanded={expandedGroups[group.id] || false}
            onToggle={handleGroupToggle}
            currentPath={location.pathname}
          />
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="p-2 space-y-0.5" style={{ borderTop: '1px solid var(--m-border)' }}>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive ? 'text-white' : 'text-gray-500 hover:text-white'
            }`
          }
          style={({ isActive }) => isActive ? { background: 'rgba(204,0,0,0.15)', borderLeft: '2px solid #CC0000' } : { borderLeft: '2px solid transparent' }}
          title={collapsed ? 'Profile' : undefined}
        >
          <User className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span>Profile</span>}
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive ? 'text-white' : 'text-gray-500 hover:text-white'
            }`
          }
          style={({ isActive }) => isActive ? { background: 'rgba(204,0,0,0.15)', borderLeft: '2px solid #CC0000' } : { borderLeft: '2px solid transparent' }}
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
          style={{ color: '#666', borderLeft: '2px solid transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6666'; e.currentTarget.style.background = 'rgba(204,0,0,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'transparent'; }}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 z-50"
        style={{ background: 'var(--m-surface-2)', border: '1px solid var(--m-border)', color: '#666' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#CC0000'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--m-surface-2)'; e.currentTarget.style.color = '#666'; }}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
};

export default Sidebar;
