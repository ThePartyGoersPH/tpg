const pool = require("../config/database");

// Utility function to check if user belongs to the same bar
async function assertSameBarOrThrow(barId, targetUserId) {
  const [rows] = await pool.query(
    "SELECT id, bar_id FROM users WHERE id = ? LIMIT 1",
    [targetUserId]
  );
  if (!rows.length) return { ok: false, status: 404, message: "User not found" };
  if (rows[0].bar_id !== barId) return { ok: false, status: 403, message: "Forbidden (different bar)" };
  return { ok: true };
}

module.exports = {
  assertSameBarOrThrow,
};
