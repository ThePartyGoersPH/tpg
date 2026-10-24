/**
 * Status sync backfill: an approved registration must read "approved"
 * everywhere the Bar Owner Portal looks.
 *
 * Super Admin's approval used to write ONLY business_registrations.status, so
 * the owner kept seeing:
 *   - "Registration Pending Review" banner + "Bar compliance status: Pending
 *     Review"  -> bars.compliance_status (never updated)
 *   - the 3-day countdown / temporary visibility window -> bars.grace_period_start
 *     and bars.temp_visible_until (never cleared)
 *   - the yellow "Auto: pending" badge -> business_registrations.auto_verification_status
 *     (never updated)
 *
 * This script repairs rows already approved before that fix. The approve
 * endpoint now performs the same update inside its transaction, so this only
 * ever needs to run once on an existing database.
 *
 * Invariant honoured here (same as scripts/resync-compliance-approvals.js):
 * a bar is only marked approved when every required permit document from
 * config/requiredPermits.js is on record.
 *
 * Idempotent: rows already in sync are reported and left alone.
 *
 * Usage: node scripts/sync-approved-registration-compliance.js [--dry-run]
 */
require("dotenv").config();
const pool = require("../config/database");
const { REQUIRED_COUNT } = require("../config/requiredPermits");
const { resolveComplianceDocuments } = require("../utils/complianceDocuments");

const DRY_RUN = process.argv.includes("--dry-run");
const SUPER_ADMIN_ID = Number(process.env.SUPER_ADMIN_ID || 114);

/** Same bar resolution the approve endpoint uses: documents first, then the
 *  account chain (users.email -> bar_owners -> bars.owner_id). */
async function resolveBarId(reg) {
  const [docRows] = await pool.query(
    "SELECT bar_id FROM bar_registration_documents WHERE registration_id = ? AND bar_id IS NOT NULL ORDER BY id DESC LIMIT 1",
    [reg.id]
  );
  if (docRows.length) return docRows[0].bar_id;

  const [bars] = await pool.query(
    `SELECT b.id FROM bars b
       JOIN bar_owners bo ON bo.id = b.owner_id
       JOIN users u ON u.id = bo.user_id
      WHERE u.email = ? ORDER BY b.id LIMIT 1`,
    [reg.owner_email]
  );
  return bars.length ? bars[0].id : null;
}

async function main() {
  const [regs] = await pool.query(
    "SELECT * FROM business_registrations WHERE status = 'approved' ORDER BY id"
  );
  console.log(`Approved registrations: ${regs.length}${DRY_RUN ? " (dry run)" : ""}`);

  let repaired = 0;
  let inSync = 0;

  for (const reg of regs) {
    const barId = await resolveBarId(reg);
    if (!barId) {
      console.log(`  #${reg.id} ${reg.business_name}: no linked bar — skipped`);
      continue;
    }

    const docs = await resolveComplianceDocuments(barId, reg.owner_email, reg.business_name);
    const uploaded = docs.filter((doc) => doc.uploaded).length;
    if (uploaded < REQUIRED_COUNT) {
      console.warn(
        `  #${reg.id} ${reg.business_name} (bar ${barId}): only ${uploaded}/${REQUIRED_COUNT} documents on record — leaving as-is (resync-compliance-approvals.js owns this state)`
      );
      continue;
    }

    const [[bar]] = await pool.query(
      `SELECT compliance_status, compliance_reviewed_by, compliance_reviewed_at,
              grace_period_start, temp_visible_until
         FROM bars WHERE id = ?`,
      [barId]
    );
    const complianceDirty =
      bar.compliance_status !== "approved" ||
      bar.compliance_reviewed_at == null ||
      bar.grace_period_start != null ||
      bar.temp_visible_until != null;
    const autoDirty = reg.auto_verification_status !== "passed";

    if (!complianceDirty && !autoDirty) {
      inSync += 1;
      console.log(`  #${reg.id} ${reg.business_name} (bar ${barId}): already in sync`);
      continue;
    }

    console.log(
      `  #${reg.id} ${reg.business_name} (bar ${barId}):\n` +
        `      compliance_status ${bar.compliance_status} -> approved\n` +
        `      grace_period_start ${bar.grace_period_start ? "set" : "NULL"} -> NULL, ` +
        `temp_visible_until ${bar.temp_visible_until ? "set" : "NULL"} -> NULL\n` +
        `      auto_verification_status ${reg.auto_verification_status} -> passed`
    );

    if (DRY_RUN) continue;

    await pool.query(
      `UPDATE bars
          SET compliance_status = 'approved',
              compliance_rejection_reason = NULL,
              compliance_submitted_at = COALESCE(compliance_submitted_at, NOW()),
              compliance_reviewed_by = ?,
              compliance_reviewed_at = COALESCE(compliance_reviewed_at, NOW()),
              grace_period_start = NULL,
              temp_visible_until = NULL
        WHERE id = ?`,
      [bar.compliance_reviewed_by || SUPER_ADMIN_ID, barId]
    );
    await pool.query(
      "UPDATE business_registrations SET auto_verification_status = 'passed' WHERE id = ?",
      [reg.id]
    );
    repaired += 1;
  }

  console.log(
    `\nDone: ${repaired} record(s) repaired, ${inSync} already in sync${DRY_RUN ? " (dry run — nothing written)" : ""}`
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
