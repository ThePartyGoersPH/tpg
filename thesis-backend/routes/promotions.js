const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { checkPlanLimit } = require("../utils/subscription");

// ─── Multer for promotion images ───
const promoImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/promotions";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `promo_${req.user.bar_id || 0}_${Date.now()}${ext}`);
  },
});
const promoImageUpload = multer({
  storage: promoImageStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(path.extname(file.originalname))) {
      return cb(new Error("Only image files are allowed"));
    }
    cb(null, true);
  },
});

// ═══════════════════════════════════════════
// GET /promotions — list promotions for owner's bars
// ═══════════════════════════════════════════
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT p.*, b.name AS bar_name
       FROM promotions p
       JOIN bars b ON p.bar_id = b.id
       WHERE b.owner_id = (SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1)
       ORDER BY p.created_at DESC`,
      [userId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET PROMOTIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /promotions/:id — single promotion detail
// ═══════════════════════════════════════════
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, b.name AS bar_name
       FROM promotions p
       JOIN bars b ON p.bar_id = b.id
       WHERE p.id = ? AND b.owner_id = (SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1)`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Promotion not found" });
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("GET PROMOTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// POST /promotions — create a promotion
// ═══════════════════════════════════════════
router.post("/", requireAuth, promoImageUpload.single("image"), async (req, res) => {
  try {
    const { bar_id, title, description, discount_type, discount_value, valid_from, valid_until } = req.body;
    if (!bar_id || !title || !discount_type || discount_value === undefined) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Verify bar ownership
    const [bars] = await pool.query(
      "SELECT id FROM bars WHERE id = ? AND owner_id = (SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1)",
      [bar_id, req.user.id]
    );
    if (!bars.length) return res.status(403).json({ success: false, message: "Not authorized for this bar" });

    // Subscription limit check for promotions
    const promoLimit = await checkPlanLimit(req.user.id, 'promotions');
    if (!promoLimit.allowed) {
      const planDisplay = promoLimit.planName.charAt(0).toUpperCase() + promoLimit.planName.slice(1);
      return res.status(402).json({
        success: false,
        message: `You've reached your ${planDisplay} Plan limit of ${promoLimit.max} promotion${promoLimit.max !== 1 ? 's' : ''}. Upgrade to create more.`,
        data: { current: promoLimit.current, max: promoLimit.max },
      });
    }

    const imagePath = req.file ? req.file.path.replace(/\\/g, "/") : null;

    const [result] = await pool.query(
      `INSERT INTO promotions (bar_id, title, description, discount_type, discount_value, valid_from, valid_until, image_path, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [bar_id, title, description || null, discount_type, discount_value, valid_from || null, valid_until || null, imagePath, req.user.id]
    );

    return res.json({ success: true, message: "Promotion created successfully", data: { id: result.insertId } });
  } catch (err) {
    console.error("CREATE PROMOTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// PATCH /promotions/:id — update a promotion
// ═══════════════════════════════════════════
router.patch("/:id", requireAuth, promoImageUpload.single("image"), async (req, res) => {
  try {
    const promoId = req.params.id;
    // Verify ownership
    const [existing] = await pool.query(
      `SELECT p.id FROM promotions p
       JOIN bars b ON p.bar_id = b.id
       WHERE p.id = ? AND b.owner_id = (SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1)`,
      [promoId, req.user.id]
    );
    if (!existing.length) return res.status(403).json({ success: false, message: "Not authorized" });

    const fields = {};
    const allowed = ["title", "description", "discount_type", "discount_value", "valid_from", "valid_until", "status", "max_redemptions"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) fields[key] = req.body[key];
    }
    if (req.file) fields.image_path = req.file.path.replace(/\\/g, "/");

    if (!Object.keys(fields).length) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    const sets = Object.keys(fields).map((k) => `${k} = ?`).join(", ");
    const vals = Object.values(fields);
    vals.push(promoId);

    await pool.query(`UPDATE promotions SET ${sets} WHERE id = ?`, vals);
    return res.json({ success: true, message: "Promotion updated successfully" });
  } catch (err) {
    console.error("UPDATE PROMOTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// POST /promotions/:id/toggle — toggle active/inactive
// ═══════════════════════════════════════════
router.post("/:id/toggle", requireAuth, async (req, res) => {
  try {
    const promoId = req.params.id;
    const [rows] = await pool.query(
      `SELECT p.id, p.status FROM promotions p
       JOIN bars b ON p.bar_id = b.id
       WHERE p.id = ? AND b.owner_id = (SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1)`,
      [promoId, req.user.id]
    );
    if (!rows.length) return res.status(403).json({ success: false, message: "Not authorized" });

    const newStatus = rows[0].status === "active" ? "inactive" : "active";
    await pool.query("UPDATE promotions SET status = ? WHERE id = ?", [newStatus, promoId]);
    return res.json({ success: true, message: `Promotion ${newStatus === "active" ? "activated" : "deactivated"}`, data: { status: newStatus } });
  } catch (err) {
    console.error("TOGGLE PROMOTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// DELETE /promotions/:id — delete a promotion
// ═══════════════════════════════════════════
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const promoId = req.params.id;
    const [rows] = await pool.query(
      `SELECT p.id, p.image_path FROM promotions p
       JOIN bars b ON p.bar_id = b.id
       WHERE p.id = ? AND b.owner_id = (SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1)`,
      [promoId, req.user.id]
    );
    if (!rows.length) return res.status(403).json({ success: false, message: "Not authorized" });

    // Clean up image
    if (rows[0].image_path && fs.existsSync(rows[0].image_path)) {
      fs.unlinkSync(rows[0].image_path);
    }

    await pool.query("DELETE FROM promotions WHERE id = ?", [promoId]);
    return res.json({ success: true, message: "Promotion deleted successfully" });
  } catch (err) {
    console.error("DELETE PROMOTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
