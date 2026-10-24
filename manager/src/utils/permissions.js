export const PERMISSIONS = {
  // Bar
  BAR_DETAILS_VIEW: 'bar_details_view',
  BAR_DETAILS_UPDATE: 'bar_details_update',
  // Staff
  STAFF_VIEW: 'staff_view',
  STAFF_CREATE: 'staff_create',
  STAFF_UPDATE: 'staff_update',
  STAFF_DELETE: 'staff_delete',
  STAFF_DEACTIVATE: 'staff_deactivate',
  STAFF_RESET_PASSWORD: 'staff_reset_password',
  STAFF_EDIT_PERMISSIONS: 'staff_edit_permissions',
  // Attendance
  ATTENDANCE_VIEW_OWN: 'attendance_view_own',
  ATTENDANCE_VIEW_ALL: 'attendance_view_all',
  ATTENDANCE_CREATE: 'attendance_create',
  // Leave
  LEAVE_APPLY: 'leave_apply',
  LEAVE_VIEW_OWN: 'leave_view_own',
  LEAVE_VIEW_ALL: 'leave_view_all',
  LEAVE_APPROVE: 'leave_approve',
  // Payroll
  PAYROLL_VIEW_OWN: 'payroll_view_own',
  PAYROLL_VIEW_ALL: 'payroll_view_all',
  PAYROLL_CREATE: 'payroll_create',
  // Documents
  DOCUMENTS_VIEW_OWN: 'documents_view_own',
  DOCUMENTS_VIEW_ALL: 'documents_view_all',
  DOCUMENTS_SEND: 'documents_send',
  DOCUMENTS_MANAGE: 'documents_manage',
  // Menu / Inventory
  MENU_VIEW: 'menu_view',
  MENU_CREATE: 'menu_create',
  MENU_UPDATE: 'menu_update',
  MENU_DELETE: 'menu_delete',
  INVENTORY_REQUEST: 'inventory_request',
  // Reservation
  RESERVATION_VIEW: 'reservation_view',
  RESERVATION_MANAGE: 'reservation_manage',
  RESERVATION_CREATE: 'reservation_create',
  // Events
  EVENTS_VIEW: 'events_view',
  EVENTS_CREATE: 'events_create',
  EVENTS_UPDATE: 'events_update',
  EVENTS_DELETE: 'events_delete',
  EVENTS_COMMENT_MANAGE: 'events_comment_manage',
  EVENTS_COMMENT_REPLY: 'events_comment_reply',
  // Tables
  TABLE_VIEW: 'table_view',
  TABLE_UPDATE: 'table_update',
  // Financials
  FINANCIALS_VIEW: 'financials_view',
  // Analytics / DSS
  ANALYTICS_BAR_VIEW: 'analytics_bar_view',
  // Reviews
  REVIEWS_VIEW: 'reviews_view',
  REVIEWS_REPLY: 'reviews_reply',
  // Bans
  BAN_VIEW: 'ban_view',
  BAN_BRANCH: 'ban_branch',
  BAN_LIFT: 'ban_lift',
  // Logs
  LOGS_VIEW: 'logs_view',

  // Finance
  FINANCE_VIEW: 'finance_view',
  FINANCE_BUDGET_MANAGE: 'finance_budget_manage',
  FINANCE_PAYROLL_APPROVE: 'finance_payroll_approve',
  FINANCE_REPORTS_VIEW: 'finance_reports_view',

  // Procurement
  PROCUREMENT_VIEW: 'procurement_view',
  PROCUREMENT_CREATE: 'procurement_create',
  PROCUREMENT_APPROVE: 'procurement_approve',
  PROCUREMENT_FINANCE_APPROVE: 'procurement_finance_approve',
  PROCUREMENT_BUDGET_VIEW: 'procurement_budget_view',

  // Supply Chain
  SUPPLY_CHAIN_VIEW: 'supply_chain_view',
  SUPPLY_CHAIN_RECEIVE: 'supply_chain_receive',
  SUPPLY_CHAIN_MANAGE: 'supply_chain_manage',
  INVENTORY_RECEIVE: 'inventory_receive',

  // DSS tiers (DIKW)
  DSS_DIAGNOSTIC_VIEW: 'dss_diagnostic_view',
  DSS_PREDICTIVE_VIEW: 'dss_predictive_view',
  DSS_PRESCRIPTIVE_VIEW: 'dss_prescriptive_view',

  // CRM
  CRM_VIEW: 'crm_view',
  CRM_MANAGE: 'crm_manage',

  // Bar Registration & Verification
  BAR_REGISTRATION_VIEW: 'bar_registration_view',
  BAR_REGISTRATION_REVIEW: 'bar_registration_review',
  BAR_VERIFICATION_MANAGE: 'bar_verification_manage',

  // Transaction Processing System (TPS)
  TPS_VIEW: 'tps_view',
  TPS_CREATE: 'tps_create',

  // QR Scan (reservation check-in at door)
  QR_SCAN: 'qr_scan',
};

export const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    permissions: [],
  },
  {
    key: 'bar-management',
    label: 'Bar Management',
    path: '/bar-management',
    icon: 'Beer',
    permissions: ['bar_details_view'],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    path: '/inventory',
    icon: 'Package',
    permissions: ['menu_view'],
  },
  {
    key: 'inventory-requests',
    label: 'Inventory Requests',
    path: '/inventory-requests',
    icon: 'ClipboardCheck',
    permissions: ['inventory_request', 'menu_view'],
  },
  {
    key: 'menu',
    label: 'Menu',
    path: '/menu',
    icon: 'UtensilsCrossed',
    permissions: ['menu_view'],
  },
  {
    key: 'packages',
    label: 'Packages',
    path: '/packages',
    icon: 'Package',
    permissions: ['menu_view'],
  },
  {
    key: 'tables',
    label: 'Tables',
    path: '/tables',
    icon: 'Grid3x3',
    permissions: ['table_view'],
  },
  {
    key: 'reservations',
    label: 'Reservations',
    path: '/reservations',
    icon: 'CalendarCheck',
    permissions: ['reservation_view'],
  },
  {
    key: 'events',
    label: 'Events & Posts',
    path: '/events',
    icon: 'PartyPopper',
    permissions: ['events_view'],
  },
  {
    key: 'staff',
    label: 'Staff Management',
    path: '/staff',
    icon: 'Users',
    permissions: ['staff_view'],
  },
  {
    key: 'attendance',
    label: 'Attendance',
    path: '/attendance',
    icon: 'Clock',
    permissions: ['attendance_view_own', 'attendance_view_all'],
  },
  {
    key: 'leaves',
    label: 'Absence Balances',
    path: '/leaves',
    icon: 'CalendarOff',
    permissions: ['leave_view_own', 'leave_view_all'],
  },
  {
    key: 'payroll',
    label: 'Payroll',
    path: '/payroll',
    icon: 'Wallet',
    permissions: ['payroll_view_own', 'payroll_view_all'],
  },
  {
    key: 'deduction-settings',
    label: 'Deduction Settings',
    path: '/deduction-settings',
    icon: 'Settings',
    permissions: ['payroll_create'],
  },
  {
    key: 'payroll-settings',
    label: 'Payroll Settings',
    path: '/payroll-settings',
    icon: 'DollarSign',
    permissions: ['payroll_create'],
  },
  {
    key: 'documents',
    label: 'Documents',
    path: '/documents',
    icon: 'FileText',
    permissions: ['documents_view_own', 'documents_view_all'],
  },
  {
    key: 'customers',
    label: 'Customers',
    path: '/customers',
    icon: 'UserCheck',
    permissions: ['ban_view'],
  },
  {
    key: 'reviews',
    label: 'Reviews',
    path: '/reviews',
    icon: 'Star',
    permissions: ['reviews_view'],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    path: '/analytics',
    icon: 'BarChart3',
    permissions: ['analytics_bar_view'],
  },
  {
    key: 'dss',
    label: 'Smart Recommendations',
    path: '/dss',
    icon: 'Brain',
    permissions: ['dss_diagnostic_view'],
  },
  {
    key: 'crm',
    label: 'Customer Insights',
    path: '/crm',
    icon: 'Users',
    permissions: ['crm_view'],
  },
  {
    key: 'financials',
    label: 'Financials',
    path: '/financials',
    icon: 'DollarSign',
    permissions: ['financials_view'],
  },
  {
    key: 'audit-logs',
    label: 'Activity History',
    path: '/audit-logs',
    icon: 'ScrollText',
    permissions: ['logs_view'],
  },
  {
    key: 'branches',
    label: 'My Branches',
    path: '/branches',
    icon: 'GitBranch',
    permissions: ['bar_details_view'],
  },
  {
    key: 'bar-registration',
    label: 'Bar Registration',
    path: '/bar-registration',
    icon: 'ClipboardCheck',
    permissions: ['bar_registration_view'],
  },
  {
    key: 'transactions',
    label: 'Transactions',
    path: '/transactions',
    icon: 'Receipt',
    permissions: ['tps_view'],
  },
  {
    key: 'procurement',
    label: 'Procurement',
    path: '/procurement',
    icon: 'ClipboardCheck',
    permissions: ['procurement_view'],
  },
  {
    key: 'supply-chain',
    label: 'Supply Chain',
    path: '/supply-chain',
    icon: 'Truck',
    permissions: ['supply_chain_view'],
  },
  {
    key: 'payroll-finance',
    label: 'Finance Approvals',
    path: '/payroll-finance',
    icon: 'Wallet',
    permissions: ['finance_payroll_approve', 'procurement_finance_approve'],
  },
  {
    key: 'subscription-approvals',
    label: 'Subscription Approvals',
    path: '/subscription-approvals',
    icon: 'ShieldCheck',
    permissions: [],
    roles: ['super_admin'],
  },
];

export const hasPermission = (userPermissions, requiredPermissions) => {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  if (!userPermissions || userPermissions.length === 0) return false;
  return requiredPermissions.some((p) => userPermissions.includes(p));
};

export const isOwnerRole = (role) => role === 'bar_owner';
