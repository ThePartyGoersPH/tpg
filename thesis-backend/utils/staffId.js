// Staff ID numbers: [year]-[6 digits], e.g. 2026-123456 -> masked 2026-***456.
// Full IDs leave the API only for HR / Bar Owner / Super Admin / Admin.

const FULL_ID_ROLES = ["hr", "bar_owner", "super_admin", "admin"];

function normalizeRole(user) {
  return String(user?.role_name || user?.role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function canViewFullStaffId(user) {
  return FULL_ID_ROLES.includes(normalizeRole(user));
}

function maskStaffIdNumber(staffIdNumber) {
  if (!staffIdNumber) return null;
  const raw = String(staffIdNumber);
  const dash = raw.indexOf("-");
  if (dash < 0) return raw;
  const year = raw.slice(0, dash);
  const digits = raw.slice(dash + 1);
  if (digits.length < 3) return raw;
  return `${year}-***${digits.slice(-3)}`;
}

function formatStaffIdNumber(year, suffixDigits) {
  return `${year}-${String(suffixDigits).padStart(6, "0")}`;
}

async function staffIdExists(queryable, candidate) {
  const [rows] = await queryable.query(
    "SELECT 1 FROM users WHERE staff_id_number = ? LIMIT 1",
    [candidate]
  );
  return rows.length > 0;
}

async function generateStaffIdNumber(queryable) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = Math.floor(Math.random() * 1000000);
    const candidate = formatStaffIdNumber(year, suffix);
    if (!(await staffIdExists(queryable, candidate))) return candidate;
  }
  const fallback = formatStaffIdNumber(year, Date.now() % 1000000);
  if (!(await staffIdExists(queryable, fallback))) return fallback;
  for (let seq = 1; seq <= 1000; seq += 1) {
    const candidate = formatStaffIdNumber(year, seq);
    if (!(await staffIdExists(queryable, candidate))) return candidate;
  }
  throw new Error("Unable to generate a unique staff ID number");
}

module.exports = {
  canViewFullStaffId,
  maskStaffIdNumber,
  formatStaffIdNumber,
  generateStaffIdNumber,
};
