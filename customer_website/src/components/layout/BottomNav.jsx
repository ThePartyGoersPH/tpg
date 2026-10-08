import { NavLink } from 'react-router-dom';
import { Home, Martini, Map as MapIcon, Ticket, User } from 'lucide-react';

const tabs = [
  { to: '/dashboard', label: 'Home', Icon: Home, end: true },
  { to: '/dashboard/bars', label: 'Bars', Icon: Martini },
  { to: '/map', label: 'Map', Icon: MapIcon },
  { to: '/dashboard/events', label: 'Events', Icon: Ticket },
  { to: '/dashboard/profile', label: 'Profile', Icon: User },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `bottom-nav-tab${isActive ? ' active' : ''}`}
        >
          <Icon className="bottom-nav-icon" aria-hidden="true" />
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
