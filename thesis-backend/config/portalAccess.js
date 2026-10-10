// Portal access — the ONE source of truth for which roles may use which
// portal, shared by login, route guards, and (by mirror files) the frontends.
// No role may access another portal's routes. Ports:
//   admin    -> /admin/*, /api/admin/*, /super-admin/*
//   manager  -> /manager/* and the bar-side APIs (/owner, /branches, /pos, ...)
//   pos      -> same bar-side family as manager (POS is a bar-side surface)
//   customer -> customer pages and customer APIs
//
// Frontend mirrors: customer_website/src/utils/constants.js,
// manager/src/utils/portalAccess.js, super_admin_web/src/utils/portalAccess.js,
// pos_website/src/utils/portalAccess.js — keep the role lists in sync.

function norm(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

const ADMIN_PORTAL_ROLES = ["super_admin", "admin"];

// Every bar-side role that signs into the manager portal or POS today.
// Deliberately NOT super_admin and NOT customer.
const MANAGER_PORTAL_ROLES = [
  "bar_owner",
  "manager",
  "staff",
  "employee",
  "cashier",
  "hr",
  "finance",
  "crm",
  "executive",
  "operations",
  "procurement",
  "supply_chain",
];

const CUSTOMER_PORTAL_ROLES = ["customer"];

const APP_PORTALS = {
  admin: ADMIN_PORTAL_ROLES,
  manager: MANAGER_PORTAL_ROLES,
  pos: MANAGER_PORTAL_ROLES,
  customer: CUSTOMER_PORTAL_ROLES,
};

function portalForApp(app) {
  const key = String(app || "").trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(APP_PORTALS, key)) return key;
  return null;
}

function rolesForPortal(portal) {
  return APP_PORTALS[portal] || [];
}

function roleAllowedForPortal(role, portal) {
  return rolesForPortal(portal).includes(norm(role));
}

// Where a role belongs when it lands in the wrong portal.
function homeForRole(role) {
  const r = norm(role);
  if (ADMIN_PORTAL_ROLES.includes(r)) return "/admin";
  if (MANAGER_PORTAL_ROLES.includes(r)) return "/manager";
  return "/";
}

module.exports = {
  norm,
  ADMIN_PORTAL_ROLES,
  MANAGER_PORTAL_ROLES,
  CUSTOMER_PORTAL_ROLES,
  APP_PORTALS,
  portalForApp,
  rolesForPortal,
  roleAllowedForPortal,
  homeForRole,
};
