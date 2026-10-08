// utils/compliance.js
// Shared customer-visibility rule for bar compliance.
//
// A bar is visible to customers when:
//   1. compliance_status = 'approved' (Super Admin published it), OR
//   2. it is still under review BUT the 3-day submission grace window has not
//      lapsed yet (pending_review + temp_visible_until > NOW()).
//
// Every customer-facing query must use complianceVisible() instead of a bare
// `compliance_status = 'approved'` check so grace-period bars stay visible and
// auto-hidden bars (hidden_incomplete) drop out immediately.

const GRACE_DAYS = 3;

/**
 * SQL boolean expression for "this bar may be shown to customers".
 * @param {string} [alias] table alias (or '' for none). Returns a parenthesised
 *   expression so it can be safely AND-ed into any WHERE clause.
 */
function complianceVisible(alias = "") {
  const p = alias ? `${alias}.` : "";
  return (
    `(${p}compliance_status = 'approved'` +
    ` OR (${p}compliance_status = 'pending_review'` +
    ` AND ${p}temp_visible_until IS NOT NULL` +
    ` AND ${p}temp_visible_until > NOW()))`
  );
}

module.exports = { complianceVisible, GRACE_DAYS };
