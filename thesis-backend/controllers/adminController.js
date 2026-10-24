const bcrypt = require("bcrypt");
const pool = require("../config/database");

exports.createBarWithOwner = async (req, res) => {
  // Safe destructure (won't crash even if body is empty)
  const owner = req.body?.owner || {};
  const barOwnerProfile = req.body?.bar_owner_profile || {};
  const bar = req.body?.bar || {};

  // Very specific validation messages (para di na blind)
  if (!owner.first_name) return res.status(400).json({ success: false, message: "owner.first_name required" });
  if (!owner.last_name) return res.status(400).json({ success: false, message: "owner.last_name required" });
  if (!owner.email) return res.status(400).json({ success: false, message: "owner.email required" });
  if (!owner.password) return res.status(400).json({ success: false, message: "owner.password required" });

  if (!barOwnerProfile.business_name) {
    return res.status(400).json({ success: false, message: "bar_owner_profile.business_name required" });
  }

  if (!bar.name) return res.status(400).json({ success: false, message: "bar.name required" });
  if (!bar.address) return res.status(400).json({ success: false, message: "bar.address required" });
  if (!bar.city) return res.status(400).json({ success: false, message: "bar.city required" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) unique email check
    const [exists] = await conn.query("SELECT id FROM users WHERE email = ? LIMIT 1", [owner.email]);
    if (exists.length) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    // 2) create user (role = bar_owner)
    const hashed = await bcrypt.hash(owner.password, 10);
    const [userIns] = await conn.query(
      `INSERT INTO users
        (first_name, last_name, email, password, phone_number, role, is_active, bar_id, created_at, updated_at)
       VALUES
        (?, ?, ?, ?, ?, 'bar_owner', 1, NULL, NOW(), NOW())`,
      [
        owner.first_name,
        owner.last_name,
        owner.email,
        hashed,
        owner.phone_number || null
      ]
    );
    const ownerUserId = userIns.insertId;

    // 3) create bar_owners row (FK to users.id)
    const [boIns] = await conn.query(
      `INSERT INTO bar_owners
        (user_id, business_name, business_address, business_phone, business_email, permit_document, created_at)
       VALUES
        (?, ?, ?, ?, ?, ?, NOW())`,
      [
        ownerUserId,
        barOwnerProfile.business_name,
        barOwnerProfile.business_address || null,
        barOwnerProfile.business_phone || null,
        barOwnerProfile.business_email || null,
        barOwnerProfile.permit_document || null
      ]
    );
    const barOwnerId = boIns.insertId; // IMPORTANT: bars.owner_id references THIS id

    // 4) create bar row with owner_id = barOwnerId
    const [barIns] = await conn.query(
      `INSERT INTO bars
        (name, description, address, city, state, zip_code, phone, email, website,
         category, price_range, image_path,
         monday_hours, tuesday_hours, wednesday_hours, thursday_hours, friday_hours, saturday_hours, sunday_hours,
         owner_id, status, compliance_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`,
      [
        bar.name,
        bar.description || null,
        bar.address,
        bar.city,
        bar.state || null,
        bar.zip_code || null,
        bar.phone || null,
        bar.email || null,
        bar.website || null,
        bar.category || null,
        bar.price_range || null,
        bar.image_path || null,
        bar.monday_hours || null,
        bar.tuesday_hours || null,
        bar.wednesday_hours || null,
        bar.thursday_hours || null,
        bar.friday_hours || null,
        bar.saturday_hours || null,
        bar.sunday_hours || null,
        barOwnerId,
        bar.status || "pending",
        new Date(),  // created_at
        new Date()   // updated_at
      ]
    );

    const barId = barIns.insertId;

    // 5) update owner user's bar_id
    await conn.query("UPDATE users SET bar_id = ? WHERE id = ?", [barId, ownerUserId]);

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Bar + bar owner created",
      data: {
        owner_user_id: ownerUserId,
        bar_owner_id: barOwnerId,
        bar_id: barId
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error("ADMIN CREATE BAR ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    conn.release();
  }
};
