const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { getEffectiveSubscription } = require("../utils/subscription");
const requireAuth = require("../middlewares/requireAuth");
const { logAudit, auditContext } = require("../utils/audit");

// ═══════════════════════════════════════════
// GET /branches/my — list all branches owned by the current user
// ═══════════════════════════════════════════
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = String(req.user.role || "").toLowerCase();

    let ownerUserId = userId;

    // Oversight mode: super admins own no bar, so the picker lists every bar.
    // (Their users.bar_id stays NULL; the portal sends the pick per request
    // via X-Bar-Id, which requireAuth honors for SUPER_ADMIN.)
    if (role === "super_admin") {
      const [bars] = await pool.query(
        `SELECT id, name, address, city, status, latitude, longitude, image_path, logo_path,
                is_locked, created_at
         FROM bars ORDER BY name ASC`
      );
      return res.json({ success: true, data: bars });
    }

    // If staff/HR, find the owner of their bar to show branches
    if (role !== "bar_owner") {
      if (!req.user.bar_id) {
        return res.json({ success: true, data: [] });
      }
      const [barRows] = await pool.query(
        "SELECT owner_id FROM bars WHERE id = ? LIMIT 1",
        [req.user.bar_id]
      );
      if (!barRows.length) return res.json({ success: true, data: [] });
      ownerUserId = barRows[0].owner_id;

      // Staff only see their own branch
      if (role !== "bar_owner") {
        const [staffBar] = await pool.query(
          `SELECT id, name, address, city, status, latitude, longitude, image_path, logo_path,
                  is_locked, created_at
           FROM bars WHERE id = ? LIMIT 1`,
          [req.user.bar_id]
        );
        return res.json({ success: true, data: staffBar });
      }
    }

    // For bar owners: find bar_owners.id from user_id
    const [owners] = await pool.query(
      "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
      [ownerUserId]
    );

    if (!owners.length) {
      // Fallback: check bars.owner_id directly (some owners may not have bar_owners record)
      const [bars] = await pool.query(
        `SELECT id, name, address, city, status, latitude, longitude, image_path, logo_path,
                is_locked, created_at
         FROM bars WHERE owner_id = ? ORDER BY created_at ASC`,
        [ownerUserId]
      );
      return res.json({ success: true, data: bars });
    }

    const ownerId = owners[0].id;

    const [bars] = await pool.query(
      `SELECT id, name, address, city, status, latitude, longitude, image_path, logo_path,
              is_locked, created_at
       FROM bars WHERE owner_id = ? ORDER BY created_at ASC`,
      [ownerId]
    );

    return res.json({ success: true, data: bars });
  } catch (err) {
    console.error("GET MY BRANCHES ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// POST /branches/create — create a new branch (subscription-gated)
// ═══════════════════════════════════════════
router.post("/create", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = String(req.user.role || "").toLowerCase();

    if (role !== "bar_owner") {
      return res.status(403).json({ success: false, message: "Only bar owners can create branches." });
    }

    const { name, address, city, state, zip_code, phone, email, latitude, longitude, category } = req.body;

    if (!name || !address || !city) {
      return res.status(400).json({ success: false, message: "Branch name, address, and city are required." });
    }

    // Get bar_owners record
    const [owners] = await pool.query(
      "SELECT id, subscription_tier FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) {
      return res.status(404).json({ success: false, message: "Bar owner profile not found." });
    }
    const ownerId = owners[0].id;

    // Count current bars
    const [[{ cnt: currentBarCount }]] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM bars WHERE owner_id = ?",
      [ownerId]
    );

    // Get subscription limit — honors expiry (enforces downgrade if expired).
    let maxBars = 1; // free tier default
    const eff = await getEffectiveSubscription(ownerId);
    if (eff.subscription) {
      maxBars = eff.subscription.max_bars;
    } else {
      const [freePlan] = await pool.query(
        "SELECT max_bars FROM subscription_plans WHERE name = 'free' LIMIT 1"
      );
      maxBars = freePlan.length ? freePlan[0].max_bars : 1;
    }

    if (currentBarCount >= maxBars) {
      return res.status(403).json({
        success: false,
        message: `Your current subscription plan allows up to ${maxBars} branch${maxBars > 1 ? "es" : ""}. Please upgrade to add more.`,
        data: { current: currentBarCount, max: maxBars },
      });
    }

    // Create the new branch
    const [result] = await pool.query(
      `INSERT INTO bars (name, description, address, city, state, zip_code, phone, email, 
                         category, latitude, longitude, owner_id, status, lifecycle_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending')`,
      [
        name,
        req.body.description || null,
        address,
        city,
        state || null,
        zip_code || null,
        phone || null,
        email || null,
        category || null,
        latitude || null,
        longitude || null,
        ownerId,
      ]
    );

    const newBarId = result.insertId;

    // Audit log
    logAudit(null, {
      bar_id: newBarId,
      user_id: userId,
      action: "CREATE_BRANCH",
      entity: "bars",
      entity_id: newBarId,
      details: { name, address, city },
      ...auditContext(req),
    });

    return res.json({
      success: true,
      message: "Branch created successfully!",
      data: { id: newBarId, name, status: "pending" },
    });
  } catch (err) {
    console.error("CREATE BRANCH ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// POST /branches/switch — switch active branch (updates user's bar_id)
// ═══════════════════════════════════════════
router.post("/switch", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { bar_id } = req.body;

    if (!bar_id) {
      return res.status(400).json({ success: false, message: "bar_id is required." });
    }

    const role = String(req.user.role || "").toLowerCase();

    // Oversight mode: super admins may view any bar without owning it. Their
    // users.bar_id stays NULL — the portal keeps the pick in localStorage and
    // sends it per request via X-Bar-Id.
    if (role === "super_admin") {
      const [bars] = await pool.query(
        "SELECT id, name FROM bars WHERE id = ? LIMIT 1",
        [bar_id]
      );
      if (!bars.length) {
        return res.status(404).json({ success: false, message: "Bar not found." });
      }
      return res.json({
        success: true,
        message: `Viewing ${bars[0].name} (oversight mode — your account keeps no bar_id)`,
        data: { bar_id: bars[0].id, bar_name: bars[0].name },
      });
    }

    // Verify ownership
    if (role === "bar_owner") {
      const [owners] = await pool.query(
        "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
        [userId]
      );
      if (!owners.length) {
        return res.status(404).json({ success: false, message: "Bar owner not found." });
      }

      const [bars] = await pool.query(
        "SELECT id, name, is_locked FROM bars WHERE id = ? AND owner_id = ? LIMIT 1",
        [bar_id, owners[0].id]
      );
      if (!bars.length) {
        return res.status(403).json({ success: false, message: "You do not own this branch." });
      }
      if (bars[0].is_locked) {
        return res.status(403).json({
          success: false,
          message: "This branch is locked. Please upgrade your subscription to access it.",
        });
      }

      // Update user's bar_id
      await pool.query("UPDATE users SET bar_id = ? WHERE id = ?", [bar_id, userId]);

      return res.json({
        success: true,
        message: `Switched to ${bars[0].name}`,
        data: { bar_id: bars[0].id, bar_name: bars[0].name },
      });
    }

    // Staff cannot switch branches
    return res.status(403).json({
      success: false,
      message: "Staff accounts are assigned to a specific branch.",
    });
  } catch (err) {
    console.error("SWITCH BRANCH ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// PATCH /branches/:id — update branch details (name, location)
// ═══════════════════════════════════════════
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const barId = parseInt(req.params.id, 10);
    const role = String(req.user.role || "").toLowerCase();

    if (role !== "bar_owner") {
      return res.status(403).json({ success: false, message: "Only bar owners can edit branches." });
    }

    // Verify ownership
    const [owners] = await pool.query(
      "SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) {
      return res.status(404).json({ success: false, message: "Bar owner not found." });
    }

    const [bars] = await pool.query(
      "SELECT id FROM bars WHERE id = ? AND owner_id = ? LIMIT 1",
      [barId, owners[0].id]
    );
    if (!bars.length) {
      return res.status(403).json({ success: false, message: "You do not own this branch." });
    }

    const allowed = [
      "name", "description", "address", "city", "state", "zip_code",
      "phone", "email", "category", "latitude", "longitude",
    ];

    const updates = [];
    const params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update." });
    }

    updates.push("updated_at = NOW()");
    params.push(barId);

    await pool.query(`UPDATE bars SET ${updates.join(", ")} WHERE id = ?`, params);

    logAudit(null, {
      bar_id: barId,
      user_id: userId,
      action: "UPDATE_BRANCH",
      entity: "bars",
      entity_id: barId,
      details: { fields_updated: Object.keys(req.body).filter((k) => allowed.includes(k)) },
      ...auditContext(req),
    });

    return res.json({ success: true, message: "Branch updated successfully." });
  } catch (err) {
    console.error("UPDATE BRANCH ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /branches/subscription-info — get branch limits for current owner
// ═══════════════════════════════════════════
router.get("/subscription-info", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const [owners] = await pool.query(
      "SELECT id, subscription_tier FROM bar_owners WHERE user_id = ? LIMIT 1",
      [userId]
    );
    if (!owners.length) {
      return res.json({
        success: true,
        data: { tier: "free", max_bars: 1, current_bars: 0, can_create: false },
      });
    }

    const ownerId = owners[0].id;

    const [[{ cnt }]] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM bars WHERE owner_id = ?",
      [ownerId]
    );

    let maxBars = 1;
    let planName = "Free";
    const eff = await getEffectiveSubscription(ownerId);
    if (eff.subscription) {
      maxBars = eff.subscription.max_bars;
      planName = eff.subscription.display_name;
    }

    return res.json({
      success: true,
      data: {
        tier: eff.tier,
        plan_name: planName,
        max_bars: maxBars,
        current_bars: cnt,
        can_create: cnt < maxBars,
      },
    });
  } catch (err) {
    console.error("GET SUBSCRIPTION INFO ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
