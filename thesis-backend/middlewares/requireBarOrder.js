// Per-bar order/book/pay gate for customer-portal money endpoints.
//
// Rules (mirror customer_website/src/utils/ownerPreview.js canOrderAtBar):
// - bar_owner: ALWAYS denied, on any bar.
// - worker roles (staff, manager, employee, cashier, hr, finance): denied
//   only when the target bar is one they're attached to.
// - customer (or missing role): allowed.
// - any other non-customer role (super_admin, admin): denied.
//
// Unlike requireRole(), this has NO owner/super-admin bypass: those roles
// must not be able to book or pay through customer flows.
//
// Usage: requireBarOrderAccess({ getBarId: (req) => Number(req.body?.bar_id) })
// or with an async resolver that looks the bar up from the DB.
const WORKER_ROLES = new Set(["staff", "manager", "employee", "cashier", "hr", "finance"]);

function roleKey(user) {
  return String(user?.role_name || user?.role || "").trim().toLowerCase();
}

function userBarIds(user) {
  const raw = [user?.bar_id];
  if (Array.isArray(user?.bar_ids)) raw.push(...user.bar_ids);
  if (Array.isArray(user?.assigned_bar_ids)) raw.push(...user.assigned_bar_ids);
  if (user?.assigned_bar_id !== undefined) raw.push(user.assigned_bar_id);
  return [...new Set(
    raw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
  )];
}

function requireBarOrderAccess({ getBarId }) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let barId = null;
    try {
      barId = await getBarId(req);
    } catch (err) {
      console.error("BAR ORDER BAR-RESOLVE ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
    barId = Number(barId);
    if (!Number.isFinite(barId) || barId <= 0) {
      return res.status(400).json({ success: false, message: "A valid bar is required for this action." });
    }

    const role = roleKey(req.user);

    if (role === "" || role === "customer") return next();

    if (role === "bar_owner") {
      return res.status(403).json({
        success: false,
        code: "ROLE_NOT_ALLOWED",
        message: "You can't place orders at this bar.",
      });
    }

    if (WORKER_ROLES.has(role)) {
      if (userBarIds(req.user).includes(barId)) {
        return res.status(403).json({
          success: false,
          code: "ROLE_NOT_ALLOWED",
          message: "You can't place orders at this bar.",
        });
      }
      return next();
    }

    return res.status(403).json({
      success: false,
      code: "ROLE_NOT_ALLOWED",
      message: "This action is only available to customer accounts.",
    });
  };
}

module.exports = { requireBarOrderAccess, userBarIds, WORKER_ROLES };
