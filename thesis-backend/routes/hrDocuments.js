const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");

// Helper: resolve document storage_path portably.
// DB may store absolute paths from a different machine (e.g. C:\Users\Admin\thesis-backend\uploads\...)
// Extract the relative 'uploads/...' portion and resolve against current cwd.
function resolveDocPath(storagePath) {
  // First try the stored path directly
  const direct = path.resolve(storagePath);
  if (fs.existsSync(direct)) return direct;

  // Extract relative portion starting from 'uploads'
  const normalized = storagePath.replace(/\\/g, '/');
  const uploadsIdx = normalized.indexOf('uploads/');
  if (uploadsIdx !== -1) {
    const relative = normalized.substring(uploadsIdx);
    const local = path.join(process.cwd(), relative);
    if (fs.existsSync(local)) return local;
  }

  // Fallback: return direct path (will fail with 404)
  return direct;
}

// storage: always upload to /uploads/bar_<barId>/tmp (then move after req.body is available)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const barId = req.user.bar_id;
    const dir = path.join(process.cwd(), "uploads", `bar_${barId}`, "tmp");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safe = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// ======================
// HR/OWNER: UPLOAD DOC
// ======================
router.post(
  "/documents/upload",
  requireAuth,
  requirePermission("documents_send"),
  upload.single("file"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const uploadedBy = req.user.id;

      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });
      if (!req.file) return res.status(400).json({ success:false, message:"file is required" });

      const employeeUserId = req.body.employee_user_id ? Number(req.body.employee_user_id) : null;
      const docType = String(req.body.doc_type || "other").toLowerCase();
      const title = String(req.body.title || "").trim();

      if (!title) return res.status(400).json({ success:false, message:"title is required" });

      const allowed = new Set(["contract","id","nbi","medical","clearance","other"]);
      if (!allowed.has(docType)) return res.status(400).json({ success:false, message:"Invalid doc_type" });

      // Require employee_user_id for employee-related docs
      const requiresEmployee = new Set(["contract","id","nbi","medical","clearance"]);
      if (requiresEmployee.has(docType) && (!employeeUserId || employeeUserId <= 0)) {
        return res.status(400).json({ success:false, message:"employee_user_id is required for this doc_type" });
      }

      // Move file from tmp -> employees/<employeeUserId or 0>
      const targetEmployeeId = employeeUserId || 0;
      const targetDir = path.join(
        process.cwd(),
        "uploads",
        `bar_${barId}`,
        "employees",
        String(targetEmployeeId)
      );
      fs.mkdirSync(targetDir, { recursive: true });

      const newPath = path.join(targetDir, req.file.filename);
      fs.renameSync(req.file.path, newPath);

      const storagePath = newPath;

      const [result] = await pool.query(
        `INSERT INTO documents
          (bar_id, employee_user_id, uploaded_by_user_id, doc_type, title,
           stored_filename, original_filename, mime_type, size_bytes, storage_path,
           is_active, archived_at, archived_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL)`,
        [
          barId,
          employeeUserId,
          uploadedBy,
          docType,
          title,
          req.file.filename,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          storagePath
        ]
      );

      const [created] = await pool.query(
        `SELECT id, bar_id, employee_user_id, doc_type, title, original_filename, mime_type, size_bytes,
                is_active, archived_at, archived_by_user_id, created_at
         FROM documents
         WHERE id=? LIMIT 1`,
        [result.insertId]
      );

      return res.status(201).json({ success:true, message:"Document uploaded", data: created[0] });
    } catch (err) {
      console.error("DOC UPLOAD ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// ======================
// VIEW DOC INLINE (in-app)
// Keeps auth checks same as download but serves inline content.
// ======================
router.get(
  "/documents/:id/view",
  requireAuth,
  requirePermission(["documents_view_all", "documents_view_own"]),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const userId = req.user.id;
      const id = Number(req.params.id);

      if (barId === null || barId === undefined) {
        return res.status(403).json({ success:false, message:"No bar_id on account" });
      }
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success:false, message:"Invalid id" });
      }

      const [rows] = await pool.query(
        `SELECT id, bar_id, employee_user_id, original_filename, mime_type, storage_path, is_active
         FROM documents
         WHERE id=? AND bar_id=?
         LIMIT 1`,
        [id, barId]
      );
      if (!rows.length) return res.status(404).json({ success:false, message:"Document not found" });

      const doc = rows[0];
      if (Number(doc.is_active) !== 1) {
        return res.status(410).json({ success:false, message:"Document is archived" });
      }

      // Check if user has permission to view this document
      // Bar owners and managers with documents_view_all can view any document in the bar
      // Employees can view if: 1) it's their employee document, OR 2) it was sent to them
      const role = (req.user.role || req.user.role_name || '').toLowerCase();
      const hasViewAll = role === 'bar_owner' || role === 'manager' || role === 'super_admin'
        || req.user.permissions?.includes?.('documents_view_all');
      
      if (!hasViewAll) {
        // Check if document was sent to this user
        const [recipient] = await pool.query(
          "SELECT 1 FROM document_recipients WHERE document_id = ? AND recipient_user_id = ? LIMIT 1",
          [id, userId]
        );
        
        // Also check if it's their employee document
        const isTheirDoc = Number(doc.employee_user_id) === Number(userId);
        
        if (!recipient.length && !isTheirDoc) {
          return res.status(403).json({ success:false, message:"You do not have permission to view this document." });
        }
      }

      const filePath = resolveDocPath(doc.storage_path);
      if (!fs.existsSync(filePath)) {
        console.error("DOC VIEW: File not found. storage_path=", doc.storage_path, "resolved=", filePath);
        return res.status(404).json({ success:false, message:"File missing on server" });
      }

      res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
      res.setHeader("Content-Disposition", `inline; filename="${doc.original_filename || "document"}"`);
      return res.sendFile(filePath);
    } catch (err) {
      console.error("DOC VIEW ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// ======================
// HR/OWNER: LIST DOCS
// default: active only
// ?archived=1 -> archived only
// ?all=1 -> both
// ?employee_user_id=30 -> filter
// ======================
router.get(
  "/documents",
  requireAuth,
  requirePermission("documents_view_all"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

      const employeeUserId = req.query.employee_user_id ? Number(req.query.employee_user_id) : null;
      const archived = String(req.query.archived || "0") === "1";
      const all = String(req.query.all || "0") === "1";

      let sql = `
        SELECT d.id, d.employee_user_id, d.doc_type, d.title, d.original_filename, d.mime_type, d.size_bytes, d.created_at,
               d.is_active, d.archived_at, d.archived_by_user_id,
               u.first_name AS employee_first_name, u.last_name AS employee_last_name
        FROM documents d
        LEFT JOIN users u ON u.id = d.employee_user_id
        WHERE d.bar_id = ?
      `;
      const params = [barId];

      if (!all) {
        sql += " AND d.is_active = ? ";
        params.push(archived ? 0 : 1);
      }

      if (employeeUserId) {
        sql += " AND d.employee_user_id = ? ";
        params.push(employeeUserId);
      }

      sql += " ORDER BY id DESC LIMIT 200";

      const [rows] = await pool.query(sql, params);
      return res.json({ success:true, data: rows });
    } catch (err) {
      console.error("DOC LIST ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// ======================
// STAFF: LIST OWN DOCS
// default: active only
// ?archived=1 -> archived only
// ======================
router.get(
  "/documents/my",
  requireAuth,
  requirePermission("documents_view_own"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const employeeUserId = req.user.id;
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });

      const archived = String(req.query.archived || "0") === "1";

      const [rows] = await pool.query(
        `SELECT id, doc_type, title, original_filename, mime_type, size_bytes, created_at,
                is_active, archived_at
         FROM documents
         WHERE bar_id = ? AND employee_user_id = ? AND is_active = ?
         ORDER BY id DESC
         LIMIT 200`,
        [barId, employeeUserId, archived ? 0 : 1]
      );

      return res.json({ success:true, data: rows });
    } catch (err) {
      console.error("MY DOCS ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// ======================
// DOWNLOAD DOC
// HR/OWNER: any doc in bar (active only)
// STAFF: only own doc (active only)
// ======================
router.get(
  "/documents/:id/download",
  requireAuth,
  requirePermission("documents_view_own"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const id = Number(req.params.id);

      if (barId === null || barId === undefined) {
        return res.status(403).json({ success:false, message:"No bar_id on account" });
      }
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success:false, message:"Invalid id" });
      }

      const [rows] = await pool.query(
        `SELECT id, bar_id, employee_user_id, original_filename, mime_type, storage_path, is_active
         FROM documents
         WHERE id=? AND bar_id=?
         LIMIT 1`,
        [id, barId]
      );
      if (!rows.length) return res.status(404).json({ success:false, message:"Document not found" });

      const doc = rows[0];
      if (Number(doc.is_active) !== 1) {
        return res.status(410).json({ success:false, message:"Document is archived" });
      }

      // Staff can only download own doc
      const roleStr = String(req.user.role || "").toLowerCase();
      if (roleStr === "staff") {
        if (Number(doc.employee_user_id) !== Number(req.user.id)) {
          return res.status(403).json({ success:false, message:"Forbidden" });
        }
      }

      res.setHeader("Content-Type", doc.mime_type);
      res.setHeader("Content-Disposition", `attachment; filename="${doc.original_filename}"`);
      return res.sendFile(resolveDocPath(doc.storage_path));
    } catch (err) {
      console.error("DOC DOWNLOAD ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);


// ======================
// HR/OWNER: ARCHIVE (SOFT DELETE)
// ======================
router.patch(
  "/documents/:id/approve",
  requireAuth,
  requirePermission("documents_manage"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const id = Number(req.params.id);
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });
      if (!id) return res.status(400).json({ success:false, message:"Invalid id" });

      const { action } = req.body || {}; // "approve" | "reject"
      if (!action || !["approve", "reject"].includes(action)) {
        return res.status(400).json({ success:false, message:"action must be approve or reject" });
      }

      const [result] = await pool.query(
        `UPDATE documents
         SET is_active=?, approved_at=NOW(), approved_by_user_id=?
         WHERE id=? AND bar_id=?`,
        [action === "approve" ? 1 : 0, req.user.id, id, barId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success:false, message:"Document not found" });
      }

      return res.json({ success:true, message:`Document ${action}d` });
    } catch (err) {
      console.error("DOC APPROVE ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// ======================
// HR/OWNER: RESTORE
// ======================
router.patch(
  "/documents/:id/restore",
  requireAuth,
  requirePermission("documents_manage"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const id = Number(req.params.id);
      if (!barId) return res.status(400).json({ success:false, message:"No bar_id on account" });
      if (!id) return res.status(400).json({ success:false, message:"Invalid id" });

      const [result] = await pool.query(
        `UPDATE documents
         SET is_active=1, archived_at=NULL, archived_by_user_id=NULL
         WHERE id=? AND bar_id=? AND is_active=0`,
        [id, barId]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ success:false, message:"Document not found or not archived" });
      }

      return res.json({ success:true, message:"Document restored" });
    } catch (err) {
      console.error("DOC RESTORE ERROR:", err);
      return res.status(500).json({ success:false, message:"Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// DOCUMENT RECIPIENTS — Send files to specific staff
// ═══════════════════════════════════════════════════
const { logAudit, auditContext } = require("../utils/audit");

// POST /documents/:id/send — send a document to specific staff members
router.post(
  "/documents/:id/send",
  requireAuth,
  requirePermission("documents_send"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const docId = Number(req.params.id);
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
      if (!Number.isInteger(docId) || docId <= 0) return res.status(400).json({ success: false, message: "Invalid document id" });

      const { recipient_user_ids } = req.body || {};
      if (!Array.isArray(recipient_user_ids) || recipient_user_ids.length === 0) {
        return res.status(400).json({ success: false, message: "recipient_user_ids array is required" });
      }

      // Verify document belongs to this bar
      const [docRows] = await pool.query(
        "SELECT id, title FROM documents WHERE id = ? AND bar_id = ? LIMIT 1",
        [docId, barId]
      );
      if (!docRows.length) {
        return res.status(404).json({ success: false, message: "Document not found" });
      }

      // Verify all recipients belong to this bar
      const placeholders = recipient_user_ids.map(() => "?").join(",");
      const [validUsers] = await pool.query(
        `SELECT id FROM users WHERE id IN (${placeholders}) AND bar_id = ? AND is_active = 1`,
        [...recipient_user_ids, barId]
      );

      const validIds = validUsers.map(u => u.id);
      if (validIds.length === 0) {
        return res.status(400).json({ success: false, message: "No valid recipients found in your bar" });
      }

      // Insert recipients (ignore duplicates)
      let added = 0;
      for (const uid of validIds) {
        try {
          await pool.query(
            `INSERT IGNORE INTO document_recipients (document_id, recipient_user_id, sent_by_user_id)
             VALUES (?, ?, ?)`,
            [docId, uid, req.user.id]
          );
          added++;
        } catch (dupErr) {
          // Ignore duplicates silently
        }
      }

      logAudit(null, {
        bar_id: barId,
        user_id: req.user.id,
        action: "SEND_DOCUMENT",
        entity: "documents",
        entity_id: docId,
        details: {
          recipient_user_ids: validIds,
          total_sent: added,
          document_title: docRows[0].title
        },
        ...auditContext(req)
      });

      return res.json({
        success: true,
        message: `Document sent to ${added} staff member(s)`,
        data: { document_id: docId, recipients_added: added, valid_ids: validIds }
      });
    } catch (err) {
      console.error("SEND DOC ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET /documents/:id/recipients — list recipients of a document
router.get(
  "/documents/:id/recipients",
  requireAuth,
  requirePermission("documents_view_all"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const docId = Number(req.params.id);
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
      if (!Number.isInteger(docId) || docId <= 0) return res.status(400).json({ success: false, message: "Invalid id" });

      // Verify document belongs to this bar
      const [docRows] = await pool.query(
        "SELECT id FROM documents WHERE id = ? AND bar_id = ? LIMIT 1",
        [docId, barId]
      );
      if (!docRows.length) {
        return res.status(404).json({ success: false, message: "Document not found" });
      }

      const [rows] = await pool.query(
        `SELECT dr.id, dr.recipient_user_id, dr.sent_by_user_id, dr.sent_at, dr.read_at,
                u.first_name, u.last_name, u.email, u.role
         FROM document_recipients dr
         JOIN users u ON u.id = dr.recipient_user_id
         WHERE dr.document_id = ?
         ORDER BY dr.sent_at DESC`,
        [docId]
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("DOC RECIPIENTS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET /documents/received — Staff: list documents sent to me
router.get(
  "/documents/received",
  requireAuth,
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      const userId = req.user.id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const [rows] = await pool.query(
        `SELECT d.id, d.doc_type, d.title, d.original_filename, d.mime_type, d.size_bytes,
                d.is_active, d.created_at,
                dr.sent_at, dr.read_at,
                CONCAT(sender.first_name, ' ', sender.last_name) AS sent_by_name
         FROM document_recipients dr
         JOIN documents d ON d.id = dr.document_id
         LEFT JOIN users sender ON sender.id = dr.sent_by_user_id
         WHERE dr.recipient_user_id = ? AND d.bar_id = ? AND d.is_active = 1
         ORDER BY dr.sent_at DESC
         LIMIT 200`,
        [userId, barId]
      );

      return res.json({ success: true, data: rows });
    } catch (err) {
      console.error("RECEIVED DOCS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// PATCH /documents/:id/mark-read — Staff marks a received document as read
router.patch(
  "/documents/:id/mark-read",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const docId = Number(req.params.id);
      if (!Number.isInteger(docId) || docId <= 0) return res.status(400).json({ success: false, message: "Invalid id" });

      const [result] = await pool.query(
        "UPDATE document_recipients SET read_at = NOW() WHERE document_id = ? AND recipient_user_id = ? AND read_at IS NULL",
        [docId, userId]
      );

      return res.json({ success: true, message: result.affectedRows > 0 ? "Marked as read" : "Already read or not found" });
    } catch (err) {
      console.error("MARK READ ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
