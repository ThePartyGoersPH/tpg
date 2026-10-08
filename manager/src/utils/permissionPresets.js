// Central source of truth for RBAC permission presets.
// Each preset lists the FULL set of permission `name` values it grants.
// To add a permission to a role, add its `name` to the relevant array below —
// no UI/logic changes needed elsewhere.
//
// Sets are composed so that:
//   Employee    = base self-service perms
//   Cashier     = Employee + POS/front-of-house perms
//   HR          = Employee + HR department perms
//   Finance     = Employee + finance reports/transactions + PO finance approval perms
//   Manager     = Employee + HR + Finance + Manager-level perms
//   All         = every permission in the system
//   Clear       = no permissions

const EMPLOYEE = [
  'attendance_view_own',
  'documents_view_own',
  'events_view',
  'leave_apply',
  'leave_view_own',
  'menu_view',
  'payroll_view_own',
  'qr_scan',
  'reservation_view',
  'reviews_view',
  'table_update',
  'table_view',
];

const CASHIER_EXTRA = [
  'reservation_create',
];

const HR_EXTRA = [
  'attendance_create',
  'attendance_view_all',
  'crm_manage',
  'crm_view',
  'deduction_settings_manage',
  'deduction_settings_view',
  'documents_manage',
  'documents_send',
  'documents_view_all',
  'leave_approve',
  'leave_view_all',
  'payroll_create',
  'payroll_view_all',
  'staff_create',
  'staff_deactivate',
  'staff_delete',
  'staff_edit_permissions',
  'staff_reset_password',
  'staff_update',
  'staff_view',
];

const FINANCE_EXTRA = [
  'financials_view',
  'finance_reports_view',
  'tps_view',
  'tps_create',
  'procurement_finance_approve',
];

const MANAGER_EXTRA = [
  'analytics_bar_view',
  'ban_branch',
  'ban_lift',
  'ban_view',
  'bar_details_update',
  'dss_diagnostic_view',
  'dss_predictive_view',
  'dss_prescriptive_view',
  'events_comment_manage',
  'events_comment_reply',
  'events_create',
  'events_delete',
  'events_update',
  'finance_budget_manage',
  'finance_payroll_approve',
  'finance_reports_view',
  'finance_view',
  'financials_view',
  'menu_create',
  'menu_delete',
  'menu_publish',
  'menu_update',
  'reservation_create',
  'reservation_manage',
  'reviews_reply',
  'table_reserve',
  'tps_create',
  'tps_view',
];

// Sentinels handled specially by the UI:
export const ALL_SENTINEL = '__ALL__';
export const CLEAR_SENTINEL = '__CLEAR__';

export const PERMISSION_PRESETS = {
  employee: [...EMPLOYEE],
  cashier: [...EMPLOYEE, ...CASHIER_EXTRA],
  hr: [...EMPLOYEE, ...HR_EXTRA],
  finance: [...EMPLOYEE, ...FINANCE_EXTRA],
  manager: [...EMPLOYEE, ...HR_EXTRA, ...FINANCE_EXTRA, ...MANAGER_EXTRA],
  all: ALL_SENTINEL,
  clear: CLEAR_SENTINEL,
};

export const PRESET_ORDER = ['employee', 'cashier', 'hr', 'finance', 'manager', 'all', 'clear'];

export const PRESET_LABELS = {
  employee: 'Employee',
  cashier: 'Cashier',
  hr: 'HR',
  finance: 'Finance',
  manager: 'Manager',
  all: 'All',
  clear: 'Clear',
};

export const PRESET_COLORS = {
  employee: '#888888',
  cashier: '#4ade80',
  hr: '#22c55e',
  finance: '#f59e0b',
  manager: '#60a5fa',
  all: '#CC0000',
  clear: '#ff6666',
};
