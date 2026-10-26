// Phase 0 — multi-tenant scoping helper.
// Every tenant-scoped record is keyed by bar_id. New modules should use these
// helpers instead of inline `req.user.bar_id` reads to keep isolation consistent.

function getBarId(req) {
  return req.user ? req.user.bar_id : undefined;
}

// Returns the bar_id or throws a normalized error object (so handlers can 403).
function assertBarId(req) {
  const barId = getBarId(req);
  if (barId === null || barId === undefined) {
    const err = new Error("This account is not linked to a bar.");
    err.statusCode = 403;
    err.code = "NO_BAR_LINKED";
    throw err;
  }
  return barId;
}

// Append a `bar_id = ?` clause to a WHERE array + params array.
// Returns { where, params } extended in place-safe manner.
function scopeWhere(whereClauses, params, barId) {
  whereClauses.push("bar_id = ?");
  params.push(barId);
  return { whereClauses, params };
}

module.exports = { getBarId, assertBarId, scopeWhere };
