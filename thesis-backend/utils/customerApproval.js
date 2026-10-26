// Customer approval gate — single source of truth used by password login,
// Google login, and the authenticated-request middleware.
//
// Rules:
// - Only role='customer' rows are ever evaluated; staff/owners/admins are
//   always allowed through (their access is governed elsewhere).
// - Missing/legacy NULL approval_status is treated as 'approved' so no
//   pre-existing account can ever be locked out by this gate.
// - Returns null when allowed, or { code, message } when blocked.
// - Callers deliberately do NOT audit-log blocks (a pending user retrying
//   login would otherwise spam the audit trail).

function approvalStateOf(user) {
  const role = String(user?.role_name || user?.role || "").trim().toLowerCase();
  if (role !== "customer") return "approved";
  const status = user?.approval_status;
  if (status === undefined || status === null || status === "") return "approved";
  return String(status).trim().toLowerCase();
}

function checkCustomerApproval(user) {
  const state = approvalStateOf(user);
  if (state === "pending") {
    return {
      code: "ACCOUNT_PENDING_APPROVAL",
      message: "Your account is waiting for admin approval. You'll be able to log in once it's approved.",
    };
  }
  if (state === "rejected") {
    const reason = String(user?.approval_rejection_reason || "").trim();
    return {
      code: "ACCOUNT_REJECTED",
      message: reason
        ? `Your registration was not approved: ${reason} If you think this is a mistake, please contact support.`
        : "Your registration was not approved. Please contact support if you think this is a mistake.",
    };
  }
  return null;
}

module.exports = { checkCustomerApproval, approvalStateOf };
