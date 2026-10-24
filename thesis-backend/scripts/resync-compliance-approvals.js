/**
 * Data integrity fix: nothing may stay "approved" without every required
 * document (config/requiredPermits.js) on record.
 *
 * 1. bars with compliance_status = 'approved' but fewer than REQUIRED_COUNT
 *      -> compliance_status = 'pending_review' (all profile fields complete)
 *         or 'incomplete' (profile fields missing)
 *      -> review + grace columns cleared so the bar drops out of customer
 *         visibility immediately (complianceVisible() no longer matches)
 * 2. business_registrations with status = 'approved' but fewer than REQUIRED_COUNT
 *      -> 'pending_admin_approval' (the enum's pending-review state; the table
 *         has no 'incomplete'/'pending_review' value)
 *
 * Every corrected record is written to the audit trail as:
 *   System corrected invalid approval: <name> had X/Y documents but was
 *   marked Approved — reverted to <status>
 *
 * Idempotent: it only scans rows that are still marked approved.
 *
 * Usage: node scripts/resync-compliance-approvals.js [--dry-run]
 */
require("dotenv").config();
const pool = require("../config/database");
// Same list the app enforces — never redefine a permit list in a script.
const { REQUIRED_PERMITS, REQUIRED_COUNT } = require("../config/requiredPermits");
const DRY_RUN = process.argv.includes("--dry-run");
const SUPER_ADMIN_ID = Number(process.env.SUPER_ADMIN_ID || 114);

const COMPLIANCE_DOCUMENTS = REQUIRED_PERMITS;
const LEGACY_COLUMNS = COMPLIANCE_DOCUMENTS.map((doc) => doc.legacyColumn);
const ACTION = "SYSTEM_CORRECTED_INVALID_APPROVAL";

function hasFile(filePath) {
  // Same rule the compliance queue uses: a stored path counts as uploaded.
  return Boolean(filePath && String(filePath).trim());
}

// Portal submission first (bar_registration_documents), then the legacy
// business_registrations column — identical precedence to resolveComplianceDocuments.
function countRegistrationDocuments(registration, portalFiles) {
  return COMPLIANCE_DOCUMENTS.filter((doc) => {
    const fromPortal = doc.portalTypes.map((alias) => portalFiles.get(alias)).find(Boolean);
    return hasFile(fromPortal || registration[doc.legacyColumn]);
  }).length;
}

async function resolveActorUserId() {
  const [[byId]] = await pool.query("SELECT id FROM users WHERE id = ? LIMIT 1", [SUPER_ADMIN_ID]);
  if (byId) return byId.id;
  const [[anyAdmin]] = await pool.query(
    "SELECT id FROM users WHERE role IN ('super_admin', 'admin') ORDER BY id LIMIT 1"
  );
  if (anyAdmin) return anyAdmin.id;
  const [[anyUser]] = await pool.query("SELECT id FROM users ORDER BY id LIMIT 1");
  if (!anyUser) throw new Error("No user row available for platform audit actor");
  console.warn(`  ! super admin ${SUPER_ADMIN_ID} not found — using user ${anyUser.id}`);
  return anyUser.id;
}

async function writeBarAudit(actorUserId, bar, uploaded, target) {
  const message = `System corrected invalid approval: ${bar.name} had ${uploaded}/${REQUIRED_COUNT} documents but was marked Approved — reverted to ${target === "pending_review" ? "Pending Review" : "Incomplete"}`;
  const details = JSON.stringify({
    message,
    bar_name: bar.name,
    documents: `${uploaded}/${REQUIRED_COUNT}`,
    uploaded,
    required: REQUIRED_COUNT,
    from: "approved",
    to: target,
  });

  // Audit Logs page: bar-scoped rows (user_id 0 = system, same as the grace job)
  await pool.query(
    `INSERT INTO audit_logs (bar_id, user_id, action, entity, entity_id, details)
     VALUES (?, 0, ?, 'bar', ?, ?)`,
    [bar.id, ACTION, bar.id, details]
  );
  // Audit Logs page: platform rows (actor shows as the admin account)
  await pool.query(
    `INSERT INTO platform_audit_logs (actor_user_id, action, entity, entity_id, target_bar_id, details)
     VALUES (?, ?, 'bar', ?, ?, ?)`,
    [actorUserId, ACTION, bar.id, bar.id, details]
  );
  return message;
}

async function writeRegistrationAudit(actorUserId, registration, uploaded) {
  const message = `System corrected invalid approval: ${registration.business_name} (registration #${registration.id}) had ${uploaded}/${REQUIRED_COUNT} documents but was marked Approved — reverted to Pending Review`;
  const details = JSON.stringify({
    message,
    business_name: registration.business_name,
    documents: `${uploaded}/${REQUIRED_COUNT}`,
    uploaded,
    required: REQUIRED_COUNT,
    from: "approved",
    to: "pending_admin_approval",
  });
  await pool.query(
    `INSERT INTO platform_audit_logs (actor_user_id, action, entity, entity_id, details)
     VALUES (?, ?, 'business_registration', ?, ?)`,
    [actorUserId, ACTION, registration.id, details]
  );
  return message;
}

async function main() {
  console.log(`\n=== Compliance approval resync ${DRY_RUN ? "(dry run)" : ""} ===`);
  const actorUserId = await resolveActorUserId();

  // ── 1. bars published without 6/6 documents ───────────────────────────
  const [bars] = await pool.query(
    `SELECT b.id, b.name, b.address, b.city, b.compliance_status,
            bo.business_name AS owner_business_name,
            u.email AS owner_email,
            b.email AS bar_email
       FROM bars b
       LEFT JOIN bar_owners bo ON bo.id = b.owner_id
       LEFT JOIN users u ON u.id = bo.user_id
      WHERE b.compliance_status = 'approved'
      ORDER BY b.id`
  );

  const correctedBars = [];
  for (const bar of bars) {
    const [portalRows] = await pool.query(
      `SELECT document_type, file_path FROM bar_registration_documents
        WHERE bar_id = ? AND file_path IS NOT NULL AND file_path != ''
        ORDER BY id DESC`,
      [bar.id]
    );
    const portalFiles = new Map();
    portalRows.forEach((row) => {
      if (!portalFiles.has(row.document_type)) portalFiles.set(row.document_type, row.file_path);
    });

    let uploaded = 0;
    let sources = null;
    if (portalFiles.size) {
      uploaded = COMPLIANCE_DOCUMENTS.filter((doc) =>
        doc.portalTypes.some((alias) => hasFile(portalFiles.get(alias)))
      ).length;
      sources = "portal";
    } else {
      // fall back to the owner's registration record, matching the queue
      let reg = null;
      const ownerEmail = bar.owner_email || bar.bar_email;
      if (ownerEmail) {
        const [[byEmail]] = await pool.query(
          "SELECT * FROM business_registrations WHERE owner_email = ? ORDER BY created_at DESC LIMIT 1",
          [ownerEmail]
        );
        reg = byEmail || null;
      }
      if (!reg) {
        const [[byName]] = await pool.query(
          "SELECT * FROM business_registrations WHERE business_name = ? ORDER BY created_at DESC LIMIT 1",
          [bar.name]
        );
        reg = byName || null;
      }
      if (reg) {
        uploaded = countRegistrationDocuments(reg, new Map());
        sources = `registration #${reg.id}`;
      } else {
        uploaded = 0;
        sources = "no registration record";
      }
    }

    if (uploaded >= REQUIRED_COUNT) {
      console.log(`  ok    bar ${bar.id} "${bar.name}" — ${uploaded}/${REQUIRED_COUNT}, stays approved`);
      continue;
    }

    const fieldsComplete = Boolean(
      bar.name && bar.address && bar.city && (bar.owner_email || bar.bar_email)
    );
    const target = fieldsComplete ? "pending_review" : "incomplete";

    if (!DRY_RUN) {
      await pool.query(
        `UPDATE bars
            SET compliance_status = ?,
                compliance_reviewed_by = NULL,
                compliance_reviewed_at = NULL,
                grace_period_start = NULL,
                temp_visible_until = NULL
          WHERE id = ? AND compliance_status = 'approved'`,
        [target, bar.id]
      );
      const message = await writeBarAudit(actorUserId, bar, uploaded, target);
      correctedBars.push({ id: bar.id, name: bar.name, uploaded, target, sources, message });
    } else {
      correctedBars.push({ id: bar.id, name: bar.name, uploaded, target, sources, message: "(dry run)" });
    }
    console.log(
      `  FIXED bar ${bar.id} "${bar.name}" — ${uploaded}/${REQUIRED_COUNT} via ${sources} -> ${target}`
    );
  }

  // ── 2. registrations approved without 6/6 documents ───────────────────
  const [regs] = await pool.query(
    `SELECT id, business_name, business_address, business_city, owner_email, ${LEGACY_COLUMNS.join(", ")}
       FROM business_registrations
      WHERE status = 'approved'
      ORDER BY id`
  );

  const correctedRegs = [];
  for (const reg of regs) {
    const [portalRows] = await pool.query(
      `SELECT document_type, file_path FROM bar_registration_documents
        WHERE registration_id = ? AND file_path IS NOT NULL AND file_path != ''
        ORDER BY id DESC`,
      [reg.id]
    );
    const portalFiles = new Map();
    portalRows.forEach((row) => {
      if (!portalFiles.has(row.document_type)) portalFiles.set(row.document_type, row.file_path);
    });
    const uploaded = countRegistrationDocuments(reg, portalFiles);

    if (uploaded >= REQUIRED_COUNT) {
      console.log(`  ok    registration ${reg.id} "${reg.business_name}" — ${uploaded}/${REQUIRED_COUNT}, stays approved`);
      continue;
    }

    if (!DRY_RUN) {
      await pool.query(
        `UPDATE business_registrations
            SET status = 'pending_admin_approval', reviewed_by = NULL, reviewed_at = NULL
          WHERE id = ? AND status = 'approved'`,
        [reg.id]
      );
      const message = await writeRegistrationAudit(actorUserId, reg, uploaded);
      correctedRegs.push({ id: reg.id, name: reg.business_name, uploaded, message });
    } else {
      correctedRegs.push({ id: reg.id, name: reg.business_name, uploaded, message: "(dry run)" });
    }
    console.log(`  FIXED registration ${reg.id} "${reg.business_name}" — ${uploaded}/${REQUIRED_COUNT} -> pending_admin_approval`);
  }

  console.log(`\n=== Summary ${DRY_RUN ? "(dry run)" : ""} ===`);
  console.log(`bars corrected: ${correctedBars.length}`);
  correctedBars.forEach((b) =>
    console.log(`  - ${b.name} (#${b.id}): ${b.uploaded}/${REQUIRED_COUNT} -> ${b.target}`)
  );
  console.log(`registrations corrected: ${correctedRegs.length}`);
  correctedRegs.forEach((r) =>
    console.log(`  - ${r.name} (#${r.id}): ${r.uploaded}/${REQUIRED_COUNT} -> pending_admin_approval`)
  );
  if (!correctedBars.length && !correctedRegs.length) {
    console.log("  (nothing to correct)");
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
