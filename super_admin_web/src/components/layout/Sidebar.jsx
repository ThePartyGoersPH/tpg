import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { customerApprovalsAPI } from '../../api/services';
import {
  LayoutDashboard,
  Building2,
  Package,
  Users,
  UserPlus,
  FileText,
  Settings,
  LogOut,
  Banknote,
  UserX,
  ClipboardCheck,
  TrendingUp,
  MessageSquare,
  Shield,
  FileCheck
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Revenue', href: '/revenue', icon: TrendingUp },
  { name: 'Bars & Branches', href: '/bars', icon: Building2 },
  { name: 'Registrations', href: '/registrations', icon: ClipboardCheck },
  { name: 'Permit Monitoring', href: '/permit-monitoring', icon: FileCheck },
  { name: 'Payouts', href: '/payouts', icon: Banknote },
  { name: 'Subscriptions', href: '/subscriptions', icon: Package },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Customer Approvals', href: '/customer-approvals', icon: UserPlus, badgeKey: 'pendingCustomers' },
  { name: 'Banning', href: '/banning', icon: UserX },
  { name: 'Platform Feedback', href: '/feedback', icon: MessageSquare },
  { name: 'Social Moderation', href: '/social', icon: Shield },
  { name: 'Audit Logs', href: '/audit-logs', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [pendingCustomers, setPendingCustomers] = useState(0);

  // Sidebar badge: refresh pending-customer count every 60s, plus
  // immediately after any approval decision anywhere in the app.
  useEffect(() => {
    let alive = true;
    const loadBadge = async () => {
      try {
        const res = await customerApprovalsAPI.stats();
        if (!alive) return;
        if (res.data?.success) setPendingCustomers(Number(res.data.data?.pending || 0));
      } catch {
        // badge keeps its last known value on transient errors
      }
    };
    loadBadge();
    const timer = setInterval(loadBadge, 60000);
    const onChanged = () => loadBadge();
    window.addEventListener('customer-approvals-changed', onChanged);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('customer-approvals-changed', onChanged); };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col w-64 glass-sidebar h-screen fixed left-0 top-0 z-30">
      <div className="flex items-center gap-3 h-16 px-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-800 flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-sm">SA</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-wide">Platform Bar</h1>
          <p className="text-[10px] text-red-300/70 uppercase tracking-widest">Super Admin</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        <nav className="px-3 space-y-0.5">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-[13px] font-medium rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-red-600/30 to-red-900/20 text-white border border-red-500/20 shadow-lg shadow-red-900/10'
                    : 'text-white/50 hover:text-white/90 hover:bg-white/[0.04]'
                }`
              }
            >
              <item.icon className="mr-3 h-4 w-4" />
              <span className="flex-1">{item.name}</span>
              {item.badgeKey === 'pendingCustomers' && pendingCustomers > 0 && (
                <span className="ml-2 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingCustomers > 99 ? '99+' : pendingCustomers}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/[0.06] p-4">
        <div className="flex items-center mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-800 flex items-center justify-center mr-3 text-xs font-bold text-white">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.first_name} {user?.last_name}</p>
            <p className="text-[11px] text-white/40 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-3 py-2 text-sm font-medium text-white/50 hover:text-red-400 hover:bg-white/[0.04] rounded-lg transition"
        >
          <LogOut className="mr-3 h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  );
}
