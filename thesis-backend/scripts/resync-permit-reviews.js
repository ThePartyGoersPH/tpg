/**
 * Re-verify every business_registration_document_reviews row against the files
 * that actually exist for that registration.
 *
 *   approved/reviewed but no usable file  -> status = 'missing'
 *   'missing' but a file is back on record -> status = 'pending' (awaiting review)
 *
 * Also prints (without changing) registrations whose own status is 'approved'
 * while required permits are still without files.
 *
 * Usage: node scripts/resync-permit-reviews.js [--dry-run]
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const pool = require("../config/database");

const REQUIRED_REGISTRATION_DOCUMENTS = [
  "bir_certificate",
  "business_permit",
  "mayors_permit",
  "sanitary_permit",
  "fire_safety_certificate",
  "liquor_license",
  "selfie_with_id",
];

const REGISTRATION_DOC_PORTAL_TYPES = {
  bir_certificate: ["bir_certificate"],
  business_permit: ["business_plate_permit", "business_permit"],
  mayors_permit: ["mayors_permit"],
  sanitary_permit: ["sanitary_permit"],
  fire_safety_certificate: ["fire_safety_certificate"],
  liquor_license: ["tobacco_liquor_permit", "liquor_license"],
  selfie_with_id: ["selfie_with_id"],
};

const SERVER_ROOT = path.resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

function localPath(filePath) {
  if (!filePath) return null;
  const raw = String(filePath).trim();
  if (!raw) return null;
  let rel = raw.replace(/^https?:\/\/[^/]+/i, "").split("?")[0];
  try { rel = decodeURIComponent(rel); } catch (_) { /* keep raw */ }
  rel = rel.replace(/^\/+/, "");
  return rel ? path.resolve(SERVER_ROOT, rel) : null;
}

function fileUsable(filePath) {
  const local = localPath(filePath);
  if (!local) return false;
  try { return fs.statSync(local).isFile(); } catch (_) { return false; }
}

async function main() {
  const [registrations] = await pool.query(
    `SELECT id, business_name, status, ${REQUIRED_REGISTRATION_DOCUMENTS.join(", ")}
       FROM business_registrations ORDER BY id`
  );
  const [docRows] = await pool.query(
    `SELECT registration_id, document_type, file_path FROM bar_registration_documents
      WHERE file_path IS NOT NULL AND file_path != '' ORDER BY id DESC`
  );
  const [reviews] = await pool.query(
    `SELECT id, registration_id, document_type, status, check_method, notes
       FROM business_registration_document_reviews`
  );

  const portalByReg = new Map();
  docRows.forEach((row) => {
    const key = `${row.registration_id}|${row.document_type}`;
    if (!portalByReg.has(key)) portalByReg.set(key, row.file_path);
  });
  const reviewByKey = new Map();
  reviews.forEach((review) => reviewByKey.set(`${review.registration_id}|${review.document_type}`, review));

  const fixed = [];
  const stale = [];
  const registrationLevel = [];

  for (const reg of registrations) {
    for (const documentType of REQUIRED_REGISTRATION_DOCUMENTS) {
      const aliases = REGISTRATION_DOC_PORTAL_TYPES[documentType] || [documentType];
      const fromPortal = aliases
        .map((alias) => portalByReg.get(`${reg.id}|${alias}`))
        .find(Boolean);
      const filePath = fromPortal || reg[documentType] || null;
      const usable = fileUsable(filePath);
      const review = reviewByKey.get(`${reg.id}|${documentType}`);
      if (!review) continue;

      if (!usable && review.status !== "missing") {
        fixed.push({
          reg: reg.id,
          biz: reg.business_name,
          doc: documentType,
          from: review.status,
          to: "missing",
          reason: filePath ? "file missing from storage" : "no file on record",
        });
      } else if (usable && review.status === "missing") {
        stale.push({
          reg: reg.id,
          biz: reg.business_name,
          doc: documentType,
          from: review.status,
          to: "pending",
          reason: "file back on record",
        });
      }
    }

    const outstanding = REQUIRED_REGISTRATION_DOCUMENTS.filter((documentType) => {
      const aliases = REGISTRATION_DOC_PORTAL_TYPES[documentType] || [documentType];
      const fromPortal = aliases
        .map((alias) => portalByReg.get(`${reg.id}|${alias}`))
        .find(Boolean);
      return !fileUsable(fromPortal || reg[documentType]);
    });
    if (reg.status === "approved" && outstanding.length) {
      registrationLevel.push(`${reg.id} "${reg.business_name}" — missing: ${outstanding.join(", ")}`);
    }
  }

  const updates = [...fixed, ...stale];
  console.log(`\n=== Permit review resync ${DRY_RUN ? "(dry run)" : ""} ===`);
  console.log(`review rows checked: ${reviews.length}, corrections: ${updates.length}`);
  updates.forEach((u) =>
    console.log(`  reg ${u.reg} (${u.biz}) ${u.doc}: ${u.from} -> ${u.to}  [${u.reason}]`)
  );

  if (!DRY_RUN && updates.length) {
    for (const u of updates) {
      const notes = u.to === "missing"
        ? "Resynced: no usable file is on record for this permit."
        : "Resynced: file is on record and awaiting review.";
      await pool.query(
        `UPDATE business_registration_document_reviews
            SET status = ?, notes = ?, check_method = NULL, checked_at = NULL, checked_by = NULL
          WHERE registration_id = ? AND document_type = ?`,
        [u.to, notes, u.reg, u.doc]
      );
    }
    console.log(`applied ${updates.length} correction(s).`);
  }

  console.log(`\n=== Registrations marked approved while required permits lack files (reported only) ===`);
  console.log(registrationLevel.length ? registrationLevel.join("\n") : "  (none)");

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
