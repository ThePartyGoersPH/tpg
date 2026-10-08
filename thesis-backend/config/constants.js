// Role permissions and allowed actions
const OWNER_ALLOWED_CREATE = ["staff", "hr", "cashier", "manager", "finance"];
const HR_ALLOWED_CREATE = ["staff"];
const ADMIN_ALLOWED_CREATE = ["bar_owner", "admin"];

// Employment statuses
const EMPLOYMENT_STATUSES = ["probationary", "regular", "contract", "part-time"];

// User roles
const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  BAR_OWNER: "bar_owner",
  HR: "hr",
  MANAGER: "manager",
  STAFF: "staff",
  CASHIER: "cashier",
  FINANCE: "finance",
  EMPLOYEE: "employee",
  CUSTOMER: "customer"
};

// Account statuses
const ACCOUNT_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  PENDING: "pending",
  SUSPENDED: "suspended"
};

module.exports = {
  OWNER_ALLOWED_CREATE,
  HR_ALLOWED_CREATE,
  ADMIN_ALLOWED_CREATE,
  EMPLOYMENT_STATUSES,
  USER_ROLES,
  ACCOUNT_STATUSES,
};
