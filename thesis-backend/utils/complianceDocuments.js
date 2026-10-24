const pool = require("../config/database");
const { COMPLIANCE_DOCUMENTS, REQUIRED_COUNT } = require("../config/requiredPermits");

/**
 * Permit documents for a bar — THE document source every screen reads
 * (Super Admin compliance queue, Permit Monitoring, Permit Checking, approval
 * gates).
 *
 * Files for the same permits live in two places, so both are merged per
 * document type: a permit counts as uploaded when EITHER the owner portal
 * submission (`bar_registration_documents`) or the older `business_registrations`
 * column holds a file. The portal file wins when both exist — every screen then
 * reports the same count.
 *
 * The document list itself comes from config/requiredPermits.js, so it is
 * identical to what the Bar Owner form uploads and Permit Checking reviews.
 */
async function resolveComplianceDocuments(barId, ownerEmail, barName) {
  const registrationId = await resolveComplianceRegistrationId(barId, ownerEmail, barName);

  const [docRows] = await pool.query(
    `SELECT document_type, file_path, verification_status, created_at
       FROM bar_registration_documents
      WHERE bar_id = ? OR (registration_id = ? AND bar_id IS NULL)
      ORDER BY id DESC`,
    [barId, registrationId || 0]
  );
  const byType = new Map();
  for (const row of docRows) {
    if (row.file_path && !byType.has(row.document_type)) byType.set(row.document_type, row);
  }

  // Older registration record fills whatever the portal has not stored yet.
  if (registrationId) {
    const [[regRow]] = await pool.query("SELECT * FROM business_registrations WHERE id = ?", [registrationId]);
    if (regRow) {
      for (const doc of COMPLIANCE_DOCUMENTS) {
        const filePath = regRow[doc.legacyColumn];
        if (filePath && !byType.has(doc.key)) {
          byType.set(doc.key, {
            file_path: filePath,
            verification_status: null,
            created_at: regRow.created_at,
          });
        }
      }
    }
  }

  return COMPLIANCE_DOCUMENTS.map((doc) => {
    const hit = byType.get(doc.key) || null;
    return {
      document_type: doc.key,
      label: doc.label,
      file_path: hit ? hit.file_path : null,
      uploaded: Boolean(hit),
      verification_status: hit ? hit.verification_status : null,
      uploaded_at: hit ? hit.created_at : null,
    };
  });
}

/** `{ uploaded, required, complete }` for a resolved document list. */
function documentCounts(documents) {
  const list = Array.isArray(documents) ? documents : [];
  const uploaded = list.filter((document) => document.uploaded).length;
  const required = REQUIRED_COUNT;
  return { uploaded, required, complete: uploaded >= required };
}

/**
 * Registration that produced this bar: portal documents first, then the same
 * owner email / business name match used to resolve compliance documents.
 */
async function resolveComplianceRegistrationId(barId, ownerEmail, barName) {
  try {
    const [[portal]] = await pool.query(
      `SELECT registration_id FROM bar_registration_documents
        WHERE bar_id = ? AND registration_id IS NOT NULL
        ORDER BY id DESC LIMIT 1`,
      [barId]
    );
    if (portal && portal.registration_id) return portal.registration_id;

    if (ownerEmail) {
      const [[byEmail]] = await pool.query(
        "SELECT id FROM business_registrations WHERE owner_email = ? ORDER BY created_at DESC LIMIT 1",
        [ownerEmail]
      );
      if (byEmail) return byEmail.id;
    }
    if (barName) {
      const [[byName]] = await pool.query(
        "SELECT id FROM business_registrations WHERE business_name = ? ORDER BY created_at DESC LIMIT 1",
        [barName]
      );
      if (byName) return byName.id;
    }
  } catch (err) {
    console.error("resolveComplianceRegistrationId failed:", err.message);
  }
  return null;
}

module.exports = {
  resolveComplianceDocuments,
  resolveComplianceRegistrationId,
  documentCounts,
};
