import {
  LayoutDashboard, Beer, Package, UtensilsCrossed, Grid3x3,
  CalendarCheck, PartyPopper, Users, Clock, CalendarOff,
  Wallet, FileText, UserCheck, Star, BarChart3, DollarSign,
  ScrollText, GitBranch, Crown, Settings as SettingsIcon,
  Store, UsersRound, TrendingUp, Building2, ClipboardCheck, Receipt, Truck, Brain,
  MessageCircle, ShieldCheck, ScanLine
} from 'lucide-react';

/**
 * Navigation Groups Configuration
 * Reorganizes navigation items into collapsible groups with hover support
 */

export const NAV_GROUPS = [
  // 📊 Overview - Standalone (no group)
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    isStandalone: true,
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        permissions: [],
      },
    ],
  },

  // 🍺 Bar Operations
  {
    id: 'bar-operations',
    label: 'Bar Operations',
    icon: Store,
    isStandalone: false,
    items: [
      {
        key: 'bar-management',
        label: 'Bar Management',
        path: '/bar-management',
        icon: Beer,
        permissions: ['bar_details_view'],
      },
      {
        key: 'menu',
        label: 'Menu',
        path: '/menu',
        icon: UtensilsCrossed,
        permissions: ['menu_view'],
      },
      {
        key: 'packages',
        label: 'Packages',
        path: '/packages',
        icon: Package,
        permissions: ['menu_view'],
      },
      {
        key: 'inventory',
        label: 'Inventory',
        path: '/inventory',
        icon: Package,
        permissions: ['menu_view'],
      },
      {
        key: 'inventory-requests',
        label: 'Inventory Requests',
        path: '/inventory-requests',
        icon: ClipboardCheck,
        permissions: [],
      },
      {
        key: 'tables',
        label: 'Tables',
        path: '/tables',
        icon: Grid3x3,
        permissions: ['table_view'],
      },
      {
        key: 'reservations',
        label: 'Reservations',
        path: '/reservations',
        icon: CalendarCheck,
        permissions: ['reservation_view'],
      },
      {
        key: 'qr-checkin',
        label: 'QR Check-In',
        path: '/qr-checkin',
        icon: ScanLine,
        permissions: ['qr_scan'],
      },
    ],
  },

  // 📅 Events & Posts - Standalone
  {
    id: 'events',
    label: 'Events & Posts',
    icon: PartyPopper,
    isStandalone: true,
    items: [
      {
        key: 'events',
        label: 'Events & Posts',
        path: '/events',
        icon: PartyPopper,
        permissions: ['events_view'],
      },
    ],
  },

  // 🌐 Social - Standalone
  {
    id: 'social',
    label: 'Social',
    icon: MessageCircle,
    isStandalone: true,
    items: [
      {
        key: 'social',
        label: 'Social',
        path: '/social',
        icon: MessageCircle,
        permissions: [],
      },
    ],
  },

  // 👥 HR
  {
    id: 'people-payroll',
    label: 'HR',
    icon: UsersRound,
    isStandalone: false,
    items: [
      {
        key: 'staff',
        label: 'Staff Management',
        path: '/staff',
        icon: Users,
        permissions: ['staff_view'],
      },
      {
        key: 'attendance',
        label: 'Attendance',
        path: '/attendance',
        icon: Clock,
        permissions: ['attendance_view_own', 'attendance_view_all'],
      },
      {
        key: 'leaves',
        label: 'Absence Balances',
        path: '/leaves',
        icon: CalendarOff,
        permissions: ['leave_view_own', 'leave_view_all'],
      },
      {
        key: 'payroll',
        label: 'Payroll',
        path: '/payroll',
        icon: Wallet,
        permissions: ['payroll_view_own', 'payroll_view_all'],
      },
      {
        key: 'deduction-settings',
        label: 'Deduction Settings',
        path: '/deduction-settings',
        icon: SettingsIcon,
        permissions: ['payroll_create'],
      },
      {
        key: 'payroll-settings',
        label: 'Payroll Settings',
        path: '/payroll-settings',
        icon: DollarSign,
        permissions: ['payroll_create'],
      },
      {
        key: 'documents',
        label: 'Documents',
        path: '/documents',
        icon: FileText,
        permissions: ['documents_view_own', 'documents_view_all'],
      },
    ],
  },

  // 🛎️ Customers
  {
    id: 'customers',
    label: 'Customers',
    icon: UserCheck,
    isStandalone: false,
    items: [
      {
        key: 'customers',
        label: 'Customers',
        path: '/customers',
        icon: UserCheck,
        permissions: ['ban_view'],
      },
      {
        key: 'reviews',
        label: 'Reviews',
        path: '/reviews',
        icon: Star,
        permissions: ['reviews_view'],
      },
      {
        key: 'crm',
        label: 'Customer Insights',
        path: '/crm',
        icon: Users,
        permissions: ['crm_view'],
      },
    ],
  },

  // 📈 Insights & Finance
  {
    id: 'insights-finance',
    label: 'Insights & Finance',
    icon: TrendingUp,
    isStandalone: false,
    items: [
      {
        key: 'analytics',
        label: 'Analytics',
        path: '/analytics',
        icon: BarChart3,
        permissions: ['analytics_bar_view'],
      },
      {
        key: 'dss',
        label: 'Smart Recommendations',
        path: '/dss',
        icon: Brain,
        permissions: ['dss_diagnostic_view'],
      },
      {
        key: 'financials',
        label: 'Financials',
        path: '/financials',
        icon: DollarSign,
        permissions: ['financials_view'],
      },
      {
        key: 'audit-logs',
        label: 'Activity History',
        path: '/audit-logs',
        icon: ScrollText,
        permissions: ['logs_view'],
      },
    ],
  },

  // 🏛️ Compliance
  {
    id: 'compliance',
    label: 'Compliance',
    icon: ScrollText,
    isStandalone: false,
    items: [
      {
        key: 'bar-registration',
        label: 'Bar Registration',
        path: '/bar-registration',
        icon: ClipboardCheck,
        permissions: ['bar_registration_view'],
      },
      {
        key: 'permit-monitoring',
        label: 'Permit Monitoring',
        path: '/permit-monitoring',
        icon: ShieldCheck,
        permissions: ['super_admin_access'],
      },
    ],
  },

  // 🧾 Operations
  {
    id: 'operations',
    label: 'Operations',
    icon: Receipt,
    isStandalone: false,
    items: [
      {
        key: 'transactions',
        label: 'Transactions',
        path: '/transactions',
        icon: Receipt,
        permissions: ['tps_view'],
      },
    ],
  },

  // 📦 Supply Chain
  {
    id: 'supply-chain-group',
    label: 'Supply Chain',
    icon: Truck,
    isStandalone: false,
    items: [
      {
        key: 'procurement',
        label: 'Procurement',
        path: '/procurement',
        icon: ClipboardCheck,
        permissions: ['procurement_view'],
      },
      {
        key: 'supply-chain',
        label: 'Supply Chain',
        path: '/supply-chain',
        icon: Truck,
        permissions: ['supply_chain_view'],
      },
    ],
  },

  // 💰 Finance Approvals
  {
    id: 'finance-approvals',
    label: 'Finance Approvals',
    icon: Wallet,
    isStandalone: false,
    items: [
      {
        key: 'payroll-finance',
        label: 'Finance Approvals',
        path: '/payroll-finance',
        icon: Wallet,
        permissions: ['finance_payroll_approve', 'procurement_finance_approve'],
      },
    ],
  },

  // ⚙️ Settings & Account
  {
    id: 'settings-account',
    label: 'Settings & Account',
    icon: Building2,
    isStandalone: false,
    ownerOnly: true,
    items: [
      {
        key: 'branches',
        label: 'My Branches',
        path: '/branches',
        icon: GitBranch,
        permissions: [],
      },
      {
        key: 'subscription',
        label: 'Subscription',
        path: '/subscription',
        icon: Crown,
        permissions: [],
      },
    ],
  },
];

/**
 * Get visible groups.
 * The full navigation tree is always rendered regardless of the user's
 * permissions or the current route. Route-level protection still applies
 * when a link is actually navigated to.
 * @returns {Array} All groups with all items
 */
export const getVisibleGroups = () => {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: [...group.items],
  }));
};

/**
 * Find which group contains a specific route
 * @param {string} currentPath - Current route path
 * @returns {string|null} Group ID or null
 */
export const findGroupForRoute = (currentPath) => {
  for (const group of NAV_GROUPS) {
    const hasRoute = group.items.some((item) => item.path === currentPath);
    if (hasRoute) return group.id;
  }
  return null;
};
