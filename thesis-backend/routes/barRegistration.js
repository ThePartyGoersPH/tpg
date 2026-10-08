const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const { logAudit } = require("../utils/audit");
const {
  PORTAL_DOC_TYPES,
  REQUIRED_PERMITS: REQUIRED_PERMIT_CONFIG,
  DOC_LABELS,
  LEGACY_DOC_COLUMNS,
  publicPermitList,
  registrationKeyFor,
} = require("../config/requiredPermits");

// ─── File upload (permit docs + selfie) ──────────────────────────────────
// Lists come from config/requiredPermits.js — the same source Super Admin
// reads, so a permit added there is automatically accepted and counted here.
const DOC_TYPES = PORTAL_DOC_TYPES;

// Government permits that must be on file before a bar can enter review.
const REQUIRED_PERMITS = REQUIRED_PERMIT_CONFIG.map((permit) => permit.key);

const PREFILL_FIELDS = [
  "business_name", "business_address", "business_city", "business_phone",
  "owner_first_name", "owner_last_name", "owner_email", "owner_phone",
  "classification",
];

const nonEmpty = (v) => Boolean(v !== null && v !== undefined && String(v).trim() !== "");

/**
 * Everything this bar owner has ALREADY saved: registration field values,
 * uploaded permit documents and the profile/bar record fallbacks. Drives the
 * "X of N requirements" checklist so a reload does not show saved work as
 * missing again.
 */
async function resolveSavedRequirements(user, barId) {
  const values = {
    business_name: null, business_address: null, business_city: null, business_phone: null,
    owner_first_name: null, owner_last_name: null, owner_email: null, owner_phone: null,
    classification: null,
  };
  const documents = {};
  DOC_TYPES.forEach((k) => { documents[k] = false; });
  const fileNames = {};

  try {
    const [[reg]] = await pool.query(
      `SELECT * FROM business_registrations
        WHERE owner_email = ? OR reviewed_by = ?
        ORDER BY created_at DESC LIMIT 1`,
      [user.email, user.id]
    );
    const [[me]] = await pool.query(
      "SELECT first_name, last_name, email, phone_number FROM users WHERE id = ?",
      [user.id]
    );
    const [[bar]] = barId
      ? await pool.query("SELECT name, address, city, phone, contact_number FROM bars WHERE id = ?", [barId])
      : [null];

    if (reg) {
      PREFILL_FIELDS.forEach((k) => { if (nonEmpty(reg[k])) values[k] = reg[k]; });
    }
    // Fallbacks for bars created through the Super Admin approval flow, which
    // never wrote a business_registrations row for this owner.
    if (!nonEmpty(values.business_name) && nonEmpty(bar?.name)) values.business_name = bar.name;
    if (!nonEmpty(values.business_address) && nonEmpty(bar?.address)) values.business_address = bar.address;
    if (!nonEmpty(values.business_city) && nonEmpty(bar?.city)) values.business_city = bar.city;
    if (!nonEmpty(values.business_phone)) {
      values.business_phone = [bar?.phone, bar?.contact_number].find(nonEmpty) || null;
    }
    if (!nonEmpty(values.owner_first_name) && nonEmpty(me?.first_name)) values.owner_first_name = me.first_name;
    if (!nonEmpty(values.owner_last_name) && nonEmpty(me?.last_name)) values.owner_last_name = me.last_name;
    if (!nonEmpty(values.owner_email) && nonEmpty(me?.email)) values.owner_email = me.email;
    if (!nonEmpty(values.owner_phone) && nonEmpty(me?.phone_number)) values.owner_phone = me.phone_number;

    if (barId) {
      const [docRows] = await pool.query(
        `SELECT document_type, file_path FROM bar_registration_documents
          WHERE bar_id = ? AND file_path IS NOT NULL AND file_path != ''
          ORDER BY id ASC`,
        [barId]
      );
      docRows.forEach((r) => {
        if (r.document_type in documents) {
          documents[r.document_type] = true;
          // Latest upload wins — lets the form show the stored filename.
          fileNames[r.document_type] = path.basename(String(r.file_path).replace(/\\/g, "/"));
        }
      });
    }
    if (reg) {
      DOC_TYPES.forEach((k) => {
        if (!documents[k] && nonEmpty(reg[LEGACY_DOC_COLUMNS[k]])) documents[k] = true;
      });
    }
  } catch (err) {
    console.error("resolveSavedRequirements failed:", err.message);
  }

  const fields = {};
  REQUIRED_FIELD_KEYS.forEach((k) => { fields[k] = nonEmpty(values[k]); });
  return { values, fields, documents, fileNames };
}

const REQUIRED_FIELD_KEYS = [
  "business_name", "business_address", "business_city", "business_phone",
  "owner_first_name", "owner_last_name", "owner_email", "owner_phone",
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/registration_docs";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fieldSafe = file.fieldname.replace(/[^a-z0-9]/gi, "_");
    cb(null, `${fieldSafe}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".pdf"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Only JPG, PNG, and PDF files are allowed"));
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────
async function getThreshold() {
  const [rows] = await pool.query("SELECT auto_approve_threshold, require_all_documents FROM bar_verification_config WHERE id = 1");
  return rows[0] || { auto_approve_threshold: 0.7, require_all_documents: 1 };
}

// Automated validation check for a single document. Returns { passed, score }.
async function autoCheckDocument(filePath) {
  if (!filePath) return { passed: false, score: 0 };
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return { passed: false, score: 0 };
  const stat = fs.statSync(abs);
  if (!stat.size || stat.size < 500) return { passed: false, score: 0.2 }; // too small → likely blank
  // Simple heuristics -> deterministic confidence score (no real OCR in this build).
  const ext = path.extname(filePath).toLowerCase();
  let score = 0.6; // base: file present & non-trivial
  if ([".pdf", ".jpg", ".jpeg", ".png"].includes(ext)) score += 0.25;
  if (stat.size > 20000) score += 0.1; // substantial content
  if (stat.size > 200000) score += 0.05;
  return { passed: true, score: Math.min(0.99, Number(score.toFixed(2))) };
}

// ─── Submit a bar registration (auth required) ─────────────────────────────
router.post(
  "/submit",
  requireAuth,
  upload.fields(DOC_TYPES.map((d) => ({ name: d, maxCount: 1 }))),
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const barId = req.user.bar_id || null;

      // Saved state acts as the default, so a re-submission only needs the
      // entries the owner actually changed (and the checklist can mark them
      // as already complete).
      const saved = await resolveSavedRequirements(req.user, barId);
      const b = { ...saved.values };
      Object.entries(req.body || {}).forEach(([k, v]) => {
        if (v !== null && v !== undefined && String(v).trim() !== "") b[k] = v;
      });

      const required = [
        ["business_name", "Business name"],
        ["business_address", "Business address"],
        ["business_city", "Business city"],
        ["business_phone", "Business phone"],
        ["owner_first_name", "Owner first name"],
        ["owner_last_name", "Owner last name"],
        ["owner_email", "Owner email"],
        ["owner_phone", "Owner phone"],
      ];
      const missingFields = required
        .filter(([field]) => !String(b[field] || "").trim())
        .map(([, label]) => label);
      if (missingFields.length) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
          missing_fields: missingFields,
        });
      }

      // Every permit in config/requiredPermits.js is mandatory to leave
      // "incomplete". Documents already on file count as satisfied (no
      // re-upload needed).
      const missingDocs = REQUIRED_PERMITS
        .filter((doc) => !(req.files && req.files[doc] && req.files[doc][0]) && !saved.documents[doc])
        .map((doc) => DOC_LABELS[doc]);
      if (missingDocs.length) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Missing required documents: ${missingDocs.join(", ")}`,
          missing_documents: missingDocs,
        });
      }

      const classification = b.classification || b.business_category || "Bar";
      const REG_COLS = [
        "business_name", "business_address", "business_city", "business_barangay", "business_state", "business_zip",
        "business_phone", "business_email", "business_category", "classification", "bar_types",
        "opening_time", "closing_time", "gcash_number", "gcash_name", "owner_first_name", "owner_middle_name", "owner_last_name",
        "owner_email", "owner_phone",
      ];
      const REG_VALUES = [
        b.business_name, b.business_address, b.business_city, b.business_barangay || null, b.business_state || null, b.business_zip || null,
        b.business_phone, b.business_email || null, b.business_category || null, classification, b.bar_types || null,
        b.opening_time || null, b.closing_time || null, b.gcash_number || null, b.gcash_name || null,
        b.owner_first_name, b.owner_middle_name || null, b.owner_last_name, b.owner_email, b.owner_phone,
      ];

      // owner_email is unique — an owner gets one registration row, so a
      // re-submission (edits after rejection, or a repeat submit) updates that
      // row in place instead of failing on the unique key.
      const [[existingReg]] = await conn.query(
        `SELECT id FROM business_registrations
          WHERE owner_email IN (?, ?)
          ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [req.user.email, b.owner_email || req.user.email]
      );

      let regId;
      if (existingReg) {
        regId = existingReg.id;
        await conn.query(
          `UPDATE business_registrations
              SET ${REG_COLS.map((c) => `${c}=?`).join(', ')},
                  status = 'pending_admin_approval', auto_verification_status = 'pending',
                  rejection_reason = NULL, reviewed_by = NULL, reviewed_at = NULL, verification_notes = NULL
            WHERE id = ?`,
          [...REG_VALUES, regId]
        );
      } else {
        const [ins] = await conn.query(
          `INSERT INTO business_registrations
            (${REG_COLS.join(', ')}, status, auto_verification_status)
           VALUES (${REG_COLS.map(() => '?').join(', ')}, 'pending_admin_approval', 'pending')`,
          REG_VALUES
        );
        regId = ins.insertId;
      }

      // Insert a document row per uploaded file (bar_id links docs to the
      // existing bar so the Super Admin queue can review them). A re-upload
      // replaces this owner's previous copy of the same document.
      const reviewKeys = new Set();
      for (const dt of DOC_TYPES) {
        const f = req.files && req.files[dt] && req.files[dt][0];
        if (f) {
          await conn.query(
            "DELETE FROM bar_registration_documents WHERE registration_id = ? AND document_type = ?",
            [regId, dt]
          );
          await conn.query(
            `INSERT INTO bar_registration_documents (registration_id, bar_id, document_type, file_path, verification_status)
             VALUES (?,?,?,?, 'pending')`,
            [regId, barId, dt, f.path.replace(/\\/g, "/")]
          );
          reviewKeys.add(dt);
          reviewKeys.add(registrationKeyFor(dt));
        }
      }

      // A fresh upload invalidates the stored review for that permit: a stale
      // "missing / no file is on record" decision must never outlive the file
      // it was written for (that is what made Super Admin show MISSING next to
      // a live View Document link).
      for (const reviewKey of reviewKeys) {
        await conn.query(
          "DELETE FROM business_registration_document_reviews WHERE registration_id = ? AND document_type = ?",
          [regId, reviewKey]
        );
      }

      // Submitted in full → park the bar with the Super Admin for review and
      // open the 3-day grace window (the bar stays temporarily visible while
      // it waits). A fresh window only starts when the previous one has
      // lapsed, so resubmitting cannot keep extending visibility.
      if (barId) {
        const [[windowRow]] = await conn.query(
          `SELECT compliance_status,
                  (grace_period_start IS NULL OR temp_visible_until IS NULL
                    OR temp_visible_until <= NOW()) AS fresh
             FROM bars WHERE id = ? FOR UPDATE`,
          [barId]
        );
        const isApproved = windowRow && windowRow.compliance_status === "approved";
        const freshWindow = !windowRow || Number(windowRow.fresh) === 1;

        if (isApproved) {
          // Already permanently visible — only refresh the submission stamp.
          await conn.query(
            `UPDATE bars SET compliance_submitted_at = NOW(),
                             compliance_rejection_reason = NULL
              WHERE id = ?`,
            [barId]
          );
        } else {
          await conn.query(
            `UPDATE bars
                SET compliance_status = 'pending_review',
                    compliance_submitted_at = NOW(),
                    compliance_rejection_reason = NULL,
                    grace_period_start = IF(?, NOW(), grace_period_start),
                    temp_visible_until = IF(?, DATE_ADD(NOW(), INTERVAL 3 DAY), temp_visible_until)
              WHERE id = ?`,
            [freshWindow ? 1 : 0, freshWindow ? 1 : 0, barId]
          );
        }
      }

      await conn.commit();
      await logAudit(conn, { bar_id: barId, user_id: req.user.id, action: "bar_registration_submit", entity: "business_registrations", entity_id: regId, details: { classification, business_name: b.business_name, bar_id: barId } });
      res.json({ success: true, message: "Registration submitted for review", data: { registration_id: regId, compliance_status: barId ? "pending_review" : "incomplete" } });
    } catch (err) {
      await conn.rollback();
      console.error("SUBMIT REG ERROR:", err);
      res.status(500).json({ success: false, message: err.message || "Server error" });
    } finally {
      conn.release();
    }
  }
);

// ─── My submissions (registrant) ─────────────────────────────────────────────
router.get("/my", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, business_name, classification, status, auto_verification_status, rejection_reason, created_at
       FROM business_registrations WHERE owner_email = ? OR reviewed_by = ? ORDER BY created_at DESC`,
      [req.user.email, req.user.id]
    );

    // Compliance status lives on the bar record (drives customer visibility).
    let compliance = null;
    if (req.user.bar_id) {
      const [[bar]] = await pool.query(
        `SELECT compliance_status, compliance_rejection_reason, compliance_submitted_at, compliance_reviewed_at,
                grace_period_start, temp_visible_until
           FROM bars WHERE id = ? LIMIT 1`,
        [req.user.bar_id]
      );
      if (bar) {
        compliance = {
          bar_id: req.user.bar_id,
          status: bar.compliance_status,
          rejection_reason: bar.compliance_rejection_reason,
          submitted_at: bar.compliance_submitted_at,
          reviewed_at: bar.compliance_reviewed_at,
          grace_period_start: bar.grace_period_start,
          temp_visible_until: bar.temp_visible_until,
        };
      }
    }

    res.json({ success: true, data: { submissions: rows, compliance } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Saved state of the requirements checklist ────────────────────────────────
// Tells the submit form which requirements are already on file, so a reload
// does not report saved work as missing again. Also feeds the portal-wide
// "registration incomplete" banner.
router.get("/current", requireAuth, async (req, res) => {
  try {
    const saved = await resolveSavedRequirements(req.user, req.user.bar_id || null);
    res.json({
      success: true,
      data: {
        fields: saved.fields,
        documents: saved.documents,
        files: saved.fileNames,
        form: saved.values,
        // Same list Super Admin's Permit Checking panel enforces — the form's
        // upload buttons, checklist and "X of Y" counter render from this.
        required_permits: publicPermitList(),
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Required permit list (shared config) ────────────────────────────────────
// The Bar Owner form renders its upload buttons, live checklist and
// "X of Y requirements" counter straight from this endpoint, so it can never
// drift from what Super Admin's Permit Checking panel requires.
router.get("/required-permits", requireAuth, async (req, res) => {
  try {
    const permits = publicPermitList();
    res.json({ success: true, data: { permits, total: permits.length } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Pending review queue (viewer) ───────────────────────────────────────────
router.get("/pending", requireAuth, requirePermission("bar_registration_view"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, business_name, classification, status, auto_verification_status, created_at
       FROM business_registrations WHERE status IN ('pending_admin_approval') ORDER BY created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Detail with documents ───────────────────────────────────────────────────
router.get("/:id", requireAuth, requirePermission("bar_registration_view"), async (req, res) => {
  try {
    const [regs] = await pool.query("SELECT * FROM business_registrations WHERE id = ?", [req.params.id]);
    if (!regs.length) return res.status(404).json({ success: false, message: "Not found" });
    const [docs] = await pool.query("SELECT * FROM bar_registration_documents WHERE registration_id = ?", [req.params.id]);
    res.json({ success: true, data: { registration: regs[0], documents: docs } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── Automated verification: one document ────────────────────────────────────
router.post("/:id/documents/:docType/auto-verify", requireAuth, requirePermission("bar_registration_view"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id, docType } = req.params;
    if (!DOC_TYPES.includes(docType)) { await conn.rollback(); return res.status(400).json({ success: false, message: "Unknown document type" }); }
    const [docs] = await conn.query(
      "SELECT * FROM bar_registration_documents WHERE registration_id = ? AND document_type = ?",
      [id, docType]
    );
    if (!docs.length) { await conn.rollback(); return res.status(404).json({ success: false, message: "Document not found" }); }
    const cfg = await getThreshold();
    const { passed, score } = await autoCheckDocument(docs[0].file_path);
    let status = score >= cfg.auto_approve_threshold ? "approved" : "manual_review";
    await conn.query(
      `UPDATE bar_registration_documents SET verification_method='automated', verification_status=?, ai_confidence_score=?, verified_at=NOW() WHERE id=?`,
      [status, score, docs[0].id]
    );
    await conn.commit();
    await logAudit(conn, { bar_id: null, user_id: req.user.id, action: "auto_verify_document", entity: "bar_registration_documents", entity_id: docs[0].id, details: { docType, score, status } });
    res.json({ success: true, data: { document_type: docType, score, status } });
  } catch (e) { await conn.rollback(); res.status(500).json({ success: false, message: e.message }); }
  finally { conn.release(); }
});

// ─── Automated verification: all documents ───────────────────────────────────
router.post("/:id/auto-verify", requireAuth, requirePermission("bar_registration_view"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const [docs] = await conn.query("SELECT * FROM bar_registration_documents WHERE registration_id = ?", [id]);
    const cfg = await getThreshold();
    let allApproved = true;
    for (const d of docs) {
      const { score } = await autoCheckDocument(d.file_path);
      const status = score >= cfg.auto_approve_threshold ? "approved" : "manual_review";
      if (status !== "approved") allApproved = false;
      await conn.query(
        `UPDATE bar_registration_documents SET verification_method='automated', verification_status=?, ai_confidence_score=?, verified_at=NOW() WHERE id=?`,
        [status, score, d.id]
      );
    }
    const autoStatus = docs.length === 0 ? "failed" : (allApproved ? "passed" : "manual_review");
    await conn.query("UPDATE business_registrations SET auto_verification_status = ? WHERE id = ?", [autoStatus, id]);
    await conn.commit();
    await logAudit(conn, { bar_id: null, user_id: req.user.id, action: "auto_verify_all", entity: "business_registrations", entity_id: id, details: { autoStatus } });
    res.json({ success: true, data: { auto_verification_status: autoStatus, documents: docs.length } });
  } catch (e) { await conn.rollback(); res.status(500).json({ success: false, message: e.message }); }
  finally { conn.release(); }
});

// ─── Manual review (admin only) ──────────────────────────────────────────────
router.post("/:id/review", requireAuth, requirePermission("bar_registration_review"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { decision, notes, documentDecisions } = req.body; // decision: approved|rejected
    if (!["approved", "rejected"].includes(decision)) { await conn.rollback(); return res.status(400).json({ success: false, message: "decision must be approved|rejected" }); }
    await conn.query(
      "UPDATE business_registrations SET status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW(), verification_notes = ? WHERE id = ?",
      [decision === "approved" ? "approved" : "rejected", decision === "rejected" ? (notes || "Rejected by admin") : null, req.user.id, notes || null, id]
    );
    // Optional per-document manual decisions
    if (Array.isArray(documentDecisions)) {
      for (const dd of documentDecisions) {
        if (!DOC_TYPES.includes(dd.document_type)) continue;
        const dstatus = dd.decision === "rejected" ? "rejected" : "approved";
        await conn.query(
          `UPDATE bar_registration_documents SET verification_method='manual', verification_status=?, verified_by=?, verified_at=NOW(), notes=? WHERE registration_id=? AND document_type=?`,
          [dstatus, req.user.id, dd.notes || null, id, dd.document_type]
        );
      }
    }
    await conn.commit();
    await logAudit(conn, { bar_id: null, user_id: req.user.id, action: "manual_review_registration", entity: "business_registrations", entity_id: id, details: { decision, notes } });
    res.json({ success: true, message: `Registration ${decision}`, data: { status: decision === "approved" ? "approved" : "rejected" } });
  } catch (e) { await conn.rollback(); res.status(500).json({ success: false, message: e.message }); }
  finally { conn.release(); }
});

// ─── Verification config (admin: bar_verification_manage) ────────────────────
router.get("/config/verification", requireAuth, requirePermission("bar_verification_manage"), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM bar_verification_config WHERE id = 1");
    res.json({ success: true, data: rows[0] || null });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/config/verification", requireAuth, requirePermission("bar_verification_manage"), async (req, res) => {
  try {
    const { auto_approve_threshold, require_all_documents } = req.body;
    await pool.query(
      "UPDATE bar_verification_config SET auto_approve_threshold = ?, require_all_documents = ?, updated_by = ? WHERE id = 1",
      [auto_approve_threshold ?? 0.7, require_all_documents ?? 1, req.user.id]
    );
    res.json({ success: true, message: "Verification config updated" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
