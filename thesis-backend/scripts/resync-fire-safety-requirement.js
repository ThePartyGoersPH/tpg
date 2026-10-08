/**
 * Data integrity fix for the shared required-permit list
 * (config/requiredPermits.js) after Fire Safety Inspection Certificate became a
 * required document for every bar.
 *
 * 1. bars still marked 'approved' / 'pending_review' without a Fire Safety
 *      Inspection Certificate on record
 *      -> compliance_status = 'incomplete', review + grace columns cleared
 *         (the bar drops out of customer visibility immediately) and the owner
 *         is notified — the portal banner then lists the missing document.
 * 2. stale document reviews that still say "missing / no file is on record"
 *      while a file IS on record (the owner uploaded after that check ran)
 *      -> reset to 'pending' so Permit Checking never contradicts a live
 *         View Document link.
 *
 * Idempotent: a bar only changes while it lacks the fire safety document, and
 * a review row only changes while its stored status contradicts the file.
 *
 * Usage: node scripts/resync-fire-safety-requirement.js [--dry-run]
 */
require("dotenv").config();
const pool = require("../config/database");
const { REQUIRED_PERMITS, REQUIRED_COUNT, labelFor } = require("../config/requiredPermits");
const { resolveComplianceDocuments, documentCounts } = require("../utils/complianceDocuments");
const { createNotification } = require("../utils/notificationService");

const DRY_RUN = process.argv.includes("--dry-run");
const SUPER_ADMIN_ID = Number(process.env.SUPER_ADMIN_ID || 114);
const FIRE_SAFETY_KEY = "fire_safety_certificate";
const FIRE_SAFETY_LABEL = labelFor(FIRE_SAFETY_KEY);
const ACTION = "NEW_REQUIRED_DOCUMENT";

async function resolveActorUserId() {
  const [[byId]] = await pool.query("SELECT id FROM users WHERE id = ? LIMIT 1", [SUPER_ADMIN_ID]);
  if (byId) return byId.id;
  const [[anyAdmin]] = await pool.query(
    "SELECT id FROM users WHERE role IN ('super_admin', 'admin') ORDER BY id LIMIT 1"
  );
  if (anyAdmin) return anyAdmin.id;
  const [[anyUser]] = await pool.query("SELECT id FROM users ORDER BY id LIMIT 1");
  if (!anyUser) throw new Error("No user row available for platform audit actor");
  return anyUser.id;
}

const hasFile = (value) => Boolean(value && String(value).trim());

async function main() {
  console.log(`\n=== Required-permit resync (${REQUIRED_COUNT} documents) ${DRY_RUN ? "(dry run)" : ""} ===`);
  const actorUserId = await resolveActorUserId();

  // ── 1. bars missing the Fire Safety Inspection Certificate ─────────────
  const [bars] = await pool.query(
    `SELECT b.id, b.name, b.address, b.city, b.compliance_status, b.grace_period_start, b.temp_visible_until,
            u.email AS owner_email, b.email AS bar_email
       FROM bars b
       LEFT JOIN bar_owners bo ON bo.id = b.owner_id
       LEFT JOIN users u ON u.id = bo.user_id
      WHERE b.compliance_status IN ('approved', 'pending_review')
      ORDER BY b.id`
  );

  const reverted = [];
  for (const bar of bars) {
    const ownerEmail = bar.owner_email || bar.bar_email;
    const documents = await resolveComplianceDocuments(bar.id, ownerEmail, bar.name);
    const counts = documentCounts(documents);
    const fireSafety = documents.find((doc) => doc.document_type === FIRE_SAFETY_KEY);

    if (fireSafety && fireSafety.uploaded) {
      console.log(`  ok    bar ${bar.id} "${bar.name}" — fire safety on file (${counts.uploaded}/${counts.required}), stays ${bar.compliance_status}`);
      continue;
    }

    const message = `System applied the new required-document policy: ${bar.name} is missing the ${FIRE_SAFETY_LABEL} (${counts.uploaded}/${counts.required} documents) — reverted to Incomplete until it is submitted`;
    console.log(`  FIXED bar ${bar.id} "${bar.name}" — ${counts.uploaded}/${counts.required}, missing ${FIRE_SAFETY_LABEL} -> incomplete`);
    reverted.push({ id: bar.id, name: bar.name, documents: `${counts.uploaded}/${counts.required}` });

    if (DRY_RUN) continue;

    await pool.query(
      `UPDATE bars
          SET compliance_status = 'incomplete',
              compliance_reviewed_by = NULL,
              compliance_reviewed_at = NULL,
              grace_period_start = NULL,
              temp_visible_until = NULL
        WHERE id = ? AND compliance_status IN ('approved', 'pending_review')`,
      [bar.id]
    );

    const details = JSON.stringify({
      message,
      bar_name: bar.name,
      missing: FIRE_SAFETY_LABEL,
      documents: `${counts.uploaded}/${counts.required}`,
      uploaded: counts.uploaded,
      required: counts.required,
      from: bar.compliance_status,
      to: "incomplete",
    });
    await pool.query(
      `INSERT INTO audit_logs (bar_id, user_id, action, entity, entity_id, details)
       VALUES (?, 0, ?, 'bar', ?, ?)`,
      [bar.id, ACTION, bar.id, details]
    );
    await pool.query(
      `INSERT INTO platform_audit_logs (actor_user_id, action, entity, entity_id, target_bar_id, details)
       VALUES (?, ?, 'bar', ?, ?, ?)`,
      [actorUserId, ACTION, bar.id, bar.id, details]
    );

    try {
      await createNotification({
        barId: bar.id,
        type: "compliance_document_required",
        title: `New required document: ${FIRE_SAFETY_LABEL}`,
        message: `Your bar registration now requires a ${FIRE_SAFETY_LABEL}. Upload it from Bar Registration so your bar can be reviewed and shown to customers again.`,
        referenceType: "bar",
        referenceId: bar.id,
      });
    } catch (err) {
      console.warn(`  ! notification for bar ${bar.id} failed: ${err.message}`);
    }
  }

  // ── 2. stale "missing" reviews that now have a file on record ──────────
  const [staleReviews] = await pool.query(
    `SELECT r.id, r.registration_id, r.document_type
       FROM business_registration_document_reviews r
      WHERE r.status = 'missing'
      ORDER BY r.id`
  );

  let resetReviews = 0;
  for (const review of staleReviews) {
    const permit = REQUIRED_PERMITS.find((entry) => entry.legacyColumn === review.document_type);
    if (!permit) continue;

    const [portalRows] = await pool.query(
      `SELECT file_path FROM bar_registration_documents
        WHERE registration_id = ? AND document_type IN (${permit.portalTypes.map(() => "?").join(",")})
          AND file_path IS NOT NULL AND file_path != ''
        ORDER BY id DESC LIMIT 1`,
      [review.registration_id, ...permit.portalTypes]
    );
    let filePath = portalRows[0] ? portalRows[0].file_path : null;
    if (!filePath) {
      const [[reg]] = await pool.query(
        `SELECT ${permit.legacyColumn} AS file_path FROM business_registrations WHERE id = ?`,
        [review.registration_id]
      );
      filePath = reg ? reg.file_path : null;
    }

    if (!hasFile(filePath)) continue; // genuinely missing — the row is correct
    resetReviews += 1;
    console.log(`  FIXED review ${review.id} (registration ${review.registration_id}, ${review.document_type}) — file exists, status missing -> pending`);
    if (DRY_RUN) continue;

    await pool.query(
      `UPDATE business_registration_document_reviews
          SET status = 'pending', check_method = NULL, notes = 'File on record — the previous check ran before this file was uploaded, so the review was reset.',
              checked_by = NULL, checked_at = NULL
        WHERE id = ?`,
      [review.id]
    );
  }

  console.log(`\n=== Summary ${DRY_RUN ? "(dry run)" : ""} ===`);
  console.log(`bars reverted for missing ${FIRE_SAFETY_LABEL}: ${reverted.length}`);
  reverted.forEach((bar) => console.log(`  - ${bar.name} (#${bar.id}): ${bar.documents} -> incomplete`));
  console.log(`stale document reviews reset: ${resetReviews}`);
  if (!reverted.length && !resetReviews) console.log("  (nothing to correct)");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
