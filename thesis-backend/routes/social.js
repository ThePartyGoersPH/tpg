const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { ensureMobilePushSchema } = require("../utils/ensureMobilePushSchema");
const { isPushEnabled } = require("../utils/pushNotifications");
const { createNotification } = require("../utils/notificationService");
const { complianceVisible } = require("../utils/compliance");

let triggerPushDispatch = () => {};
try {
  ({ triggerPushDispatch } = require("../utils/triggerPushDispatch"));
} catch (_) {
  // Keep social routes operational on deployments without push dispatcher module.
}

const postImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/posts";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `post_${req.user?.bar_id || 0}_${Date.now()}${ext}`);
  }
});
const postImageUpload = multer({
  storage: postImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"), false);
  }
});

// ─── Helper: time elapsed string ───
function timeElapsed(datetime) {
  if (!datetime) return "";
  const now = new Date();
  // Normalize bare MySQL datetime strings (no TZ) to UTC to avoid Manila double-offset bug
  let ago;
  if (typeof datetime === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(datetime) && !/Z|[+-]\d{2}:?\d{2}$/.test(datetime)) {
    ago = new Date(datetime.replace(' ', 'T') + 'Z');
  } else {
    ago = new Date(datetime);
  }
  const diffMs = now - ago;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return diffMin + " minute" + (diffMin > 1 ? "s" : "") + " ago";
  if (diffHr < 24) return diffHr + " hour" + (diffHr > 1 ? "s" : "") + " ago";
  if (diffDay === 1) {
    return "Yesterday at " + ago.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  if (ago.getFullYear() === now.getFullYear()) {
    return ago.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " at " + ago.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return ago.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " at " + ago.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

async function getBarTeamNotificationRecipients(barId) {
  const normalizedBarId = Number(barId);
  if (!normalizedBarId) return [];

  const [rows] = await pool.query(
    `SELECT DISTINCT recipient_id
     FROM (
       SELECT bo.user_id AS recipient_id
       FROM bars b
       JOIN bar_owners bo ON bo.id = b.owner_id
       WHERE b.id = ?
         AND bo.user_id IS NOT NULL

       UNION

       SELECT u.id AS recipient_id
       FROM users u
       LEFT JOIN roles r
         ON r.id = COALESCE(
           u.role_id,
           (SELECT id FROM roles WHERE UPPER(name) = UPPER(u.role) LIMIT 1)
         )
       WHERE u.bar_id = ?
         AND COALESCE(u.is_active, 1) = 1
         AND LOWER(COALESCE(r.name, u.role, '')) IN ('bar_owner', 'manager', 'staff', 'employee', 'hr')
     ) recipients
     WHERE recipient_id IS NOT NULL`,
    [normalizedBarId, normalizedBarId]
  );

  return rows
    .map((row) => Number(row.recipient_id || 0))
    .filter((id) => Number.isFinite(id) && id > 0);
}

async function notifyBarTeamSocialInteraction({
  barId,
  actorUserId,
  type,
  title,
  message,
  referenceId,
  referenceType = 'comment',
  category = 'social',
  action = 'open_chat',
  targetRoute = '/events',
  metadata = null,
}) {
  const actorId = Number(actorUserId || 0);
  const recipients = await getBarTeamNotificationRecipients(barId);
  const targets = recipients.filter((id) => id !== actorId);
  if (!targets.length) return 0;

  for (const userId of targets) {
    try {
      await createNotification({
        userIds: userId,
        type,
        title,
        message,
        referenceType,
        referenceId: Number(referenceId || 0) || null,
        category,
        action,
        targetRoute,
        metadata: { ...(metadata || {}), customer_id: actorId },
      });
    } catch (e) {
      console.error('notifyBarTeamSocialInteraction failed:', e.message);
    }
  }

  return targets.length;
}

// ═══════════════════════════════════════════
// BAR FOLLOW (explicit REST endpoints; existing /follow-bar remains)
// ═══════════════════════════════════════════
router.post("/bars/:barId/follow", requireAuth, async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    const userId = req.user.id;
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar" });

    const [bars] = await pool.query(
      "SELECT id FROM bars WHERE id = ? AND status = 'active' LIMIT 1",
      [barId]
    );
    if (!bars.length) return res.status(404).json({ success: false, message: "Bar not found" });

    const [banRows] = await pool.query(
      "SELECT 1 FROM customer_bar_bans WHERE bar_id = ? AND customer_id = ? LIMIT 1",
      [barId, userId]
    );
    if (banRows.length) {
      return res.status(403).json({ success: false, message: "You are banned from this bar" });
    }

    await pool.query(
      "INSERT IGNORE INTO bar_followers (bar_id, user_id) VALUES (?, ?)",
      [barId, userId]
    );

    const [[{ followerCount }]] = await pool.query(
      "SELECT COUNT(*) AS followerCount FROM bar_followers WHERE bar_id = ?",
      [barId]
    );

    return res.json({ success: true, following: true, followerCount });
  } catch (err) {
    console.error("FOLLOW BAR (REST) ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/bars/:barId/follow", requireAuth, async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    const userId = req.user.id;
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar" });

    await pool.query("DELETE FROM bar_followers WHERE bar_id = ? AND user_id = ?", [barId, userId]);

    const [[{ followerCount }]] = await pool.query(
      "SELECT COUNT(*) AS followerCount FROM bar_followers WHERE bar_id = ?",
      [barId]
    );

    return res.json({ success: true, following: false, followerCount });
  } catch (err) {
    console.error("UNFOLLOW BAR (REST) ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// CHECK FOLLOW STATUS (additive endpoint for Customer App)
// ═══════════════════════════════════════════
router.get("/bars/:barId/follow-status", requireAuth, async (req, res) => {
  try {
    const barId = Number(req.params.barId);
    const userId = req.user.id;
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar" });

    const [rows] = await pool.query(
      "SELECT id FROM bar_followers WHERE bar_id = ? AND user_id = ? LIMIT 1",
      [barId, userId]
    );

    return res.json({ success: true, following: rows.length > 0 });
  } catch (err) {
    console.error("FOLLOW STATUS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// BAR POSTS (created by bar owner/staff from manager portal)
// ═══════════════════════════════════════════
router.post("/bar-posts", requireAuth, postImageUpload.single("image"), async (req, res) => {
  try {
    const userId = req.user.id;
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

    const { content } = req.body || {};
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Post content is required" });
    }

    const imagePath = req.file ? req.file.path.replace(/\\/g, "/") : null;

    const [result] = await pool.query(
      "INSERT INTO bar_posts (bar_id, user_id, content, image_path, status) VALUES (?, ?, ?, ?, 'active')",
      [barId, userId, content.trim(), imagePath]
    );

    return res.status(201).json({ success: true, message: "Post created", data: { id: result.insertId, image_path: imagePath } });
  } catch (err) {
    console.error("CREATE BAR POST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PATCH /social/bar-posts/:id — edit own post ───
router.patch("/bar-posts/:id", requireAuth, postImageUpload.single("image"), async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const barId = req.user.bar_id;
    if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });
    if (!postId) return res.status(400).json({ success: false, message: "Invalid post id" });

    const [[post]] = await pool.query(
      `SELECT id, bar_id FROM bar_posts WHERE id = ? AND bar_id = ? LIMIT 1`,
      [postId, barId]
    );
    if (!post) return res.status(404).json({ success: false, message: "Post not found" });

    const content = req.body?.content !== undefined ? String(req.body.content).trim() : undefined;
    if (content !== undefined && !content) return res.status(400).json({ success: false, message: "Post content cannot be empty" });

    const sets = [];
    const vals = [];
    if (content !== undefined) { sets.push("content = ?"); vals.push(content); }
    if (req.file) { sets.push("image_path = ?"); vals.push(req.file.path.replace(/\\/g, "/")); }
    if (req.body?.remove_image === "true" || req.body?.remove_image === true) { sets.push("image_path = NULL"); }
    if (!sets.length) return res.status(400).json({ success: false, message: "No fields to update" });

    sets.push("updated_at = NOW()");
    vals.push(postId, barId);

    await pool.query(`UPDATE bar_posts SET ${sets.join(", ")} WHERE id = ? AND bar_id = ?`, vals);
    const [[updated]] = await pool.query(`SELECT id, bar_id, content, image_path, status, like_count, comment_count, created_at, updated_at FROM bar_posts WHERE id = ? LIMIT 1`, [postId]);
    return res.json({ success: true, message: "Post updated", data: updated });
  } catch (err) {
    console.error("PATCH BAR POST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// EVENT SOCIAL INTERACTIONS
// ═══════════════════════════════════════════
router.post("/events/:eventId/like", requireAuth, async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const userId = req.user.id;
    if (!eventId) return res.status(400).json({ success: false, message: "Invalid event" });

    const [events] = await pool.query(
      "SELECT id, bar_id FROM bar_events WHERE id = ? LIMIT 1",
      [eventId]
    );
    if (!events.length) return res.status(404).json({ success: false, message: "Event not found" });

    const [banRows] = await pool.query(
      "SELECT 1 FROM customer_bar_bans WHERE bar_id = ? AND customer_id = ? LIMIT 1",
      [events[0].bar_id, userId]
    );
    if (banRows.length) {
      return res.status(403).json({ success: false, message: "You are banned from this bar" });
    }

    await pool.query(
      "INSERT IGNORE INTO event_likes (event_id, user_id) VALUES (?, ?)",
      [eventId, userId]
    );

    const [[{ likeCount }]] = await pool.query(
      "SELECT COUNT(*) AS likeCount FROM event_likes WHERE event_id = ?",
      [eventId]
    );

    return res.json({ success: true, liked: true, likeCount });
  } catch (err) {
    console.error("EVENT LIKE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/events/:eventId/like", requireAuth, async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const userId = req.user.id;
    if (!eventId) return res.status(400).json({ success: false, message: "Invalid event" });

    await pool.query("DELETE FROM event_likes WHERE event_id = ? AND user_id = ?", [eventId, userId]);

    const [[{ likeCount }]] = await pool.query(
      "SELECT COUNT(*) AS likeCount FROM event_likes WHERE event_id = ?",
      [eventId]
    );

    return res.json({ success: true, liked: false, likeCount });
  } catch (err) {
    console.error("EVENT UNLIKE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/events/:eventId/comments", async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, message: "Invalid event" });

    // Get the bar_id for this event to identify owner replies
    const [eventRows] = await pool.query("SELECT bar_id FROM bar_events WHERE id = ? LIMIT 1", [eventId]);
    const eventBarId = eventRows[0]?.bar_id || null;

    // Determine bar owner user IDs for this bar
    let ownerUserIds = [];
    if (eventBarId) {
      const [ownerRows] = await pool.query(
        `SELECT u.id FROM users u
         JOIN bar_owners bo ON bo.user_id = u.id
         JOIN bars b ON b.owner_id = bo.id
         WHERE b.id = ?`,
        [eventBarId]
      );
      ownerUserIds = ownerRows.map(r => r.id);
    }

    const [rows] = await pool.query(
      `SELECT ec.id, ec.event_id, ec.user_id, ec.comment, ec.created_at, ec.updated_at,
              u.first_name, u.last_name, u.profile_picture, u.role
       FROM event_comments ec
       JOIN users u ON u.id = ec.user_id
       WHERE ec.event_id = ? AND ec.status = 'active'
       ORDER BY ec.created_at DESC`,
      [eventId]
    );

    // Fetch replies for all comments
    const commentIds = rows.map(r => r.id);
    let repliesByCommentId = {};
    if (commentIds.length) {
      const placeholders = commentIds.map(() => "?").join(",");
      const [replyRows] = await pool.query(
        `SELECT ecr.id, ecr.event_comment_id, ecr.reply, ecr.created_at, ecr.updated_at,
                ecr.user_id, u.first_name, u.last_name, u.profile_picture, u.role
         FROM event_comment_replies ecr
         JOIN users u ON u.id = ecr.user_id
         WHERE ecr.event_comment_id IN (${placeholders}) AND ecr.status = 'active'
         ORDER BY ecr.created_at ASC`,
        commentIds
      );
      for (const r of replyRows) {
        if (!repliesByCommentId[r.event_comment_id]) repliesByCommentId[r.event_comment_id] = [];
        repliesByCommentId[r.event_comment_id].push({
          id: r.id,
          reply: r.reply,
          user_id: r.user_id,
          user_name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
          profile_picture: r.profile_picture,
          is_bar_owner: ownerUserIds.includes(r.user_id) || String(r.role || '').toLowerCase() === 'bar_owner',
          created_at: r.created_at,
        });
      }
    }

    const data = rows.map(row => ({
      ...row,
      user_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      is_bar_owner: ownerUserIds.includes(row.user_id) || String(row.role || '').toLowerCase() === 'bar_owner',
      replies: repliesByCommentId[row.id] || [],
    }));

    const [[{ commentCount }]] = await pool.query(
      "SELECT COUNT(*) AS commentCount FROM event_comments WHERE event_id = ? AND status = 'active'",
      [eventId]
    );

    return res.json({ success: true, data, commentCount });
  } catch (err) {
    console.error("EVENT COMMENTS LIST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/events/:eventId/comments", requireAuth, async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const userId = req.user.id;
    const comment = String(req.body?.comment || "").trim();
    const parentCommentId = req.body?.parent_comment_id ? Number(req.body.parent_comment_id) : null;
    if (!eventId) return res.status(400).json({ success: false, message: "Invalid event" });
    if (!comment) return res.status(400).json({ success: false, message: "comment is required" });

    const [events] = await pool.query(
      "SELECT id, bar_id FROM bar_events WHERE id = ? LIMIT 1",
      [eventId]
    );
    if (!events.length) return res.status(404).json({ success: false, message: "Event not found" });

    const [banRows] = await pool.query(
      "SELECT 1 FROM customer_bar_bans WHERE bar_id = ? AND customer_id = ? LIMIT 1",
      [events[0].bar_id, userId]
    );
    if (banRows.length) {
      return res.status(403).json({ success: false, message: "You are banned from this bar" });
    }

    let insertId;
    let parentCommentOwnerId = null;

    if (parentCommentId) {
      // Verify parent comment exists and belongs to this event
      const [parentRows] = await pool.query(
        "SELECT id, user_id FROM event_comments WHERE id = ? AND event_id = ? AND COALESCE(status, 'active') = 'active' LIMIT 1",
        [parentCommentId, eventId]
      );
      if (!parentRows.length) return res.status(404).json({ success: false, message: "Parent comment not found" });
      parentCommentOwnerId = Number(parentRows[0].user_id || 0);

      // Insert into event_comment_replies
      const [ins] = await pool.query(
        "INSERT INTO event_comment_replies (event_comment_id, event_id, user_id, reply) VALUES (?, ?, ?, ?)",
        [parentCommentId, eventId, userId, comment]
      );
      insertId = ins.insertId;
    } else {
      // Insert as a top-level comment
      const [ins] = await pool.query(
        "INSERT INTO event_comments (event_id, user_id, comment) VALUES (?, ?, ?)",
        [eventId, userId, comment]
      );
      insertId = ins.insertId;
    }

    const [[{ commentCount }]] = await pool.query(
      "SELECT COUNT(*) AS commentCount FROM event_comments WHERE event_id = ? AND status = 'active'",
      [eventId]
    );

    const [uRows] = await pool.query(
      "SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1",
      [userId]
    );
    const commenterName = uRows.length
      ? `${uRows[0].first_name || ''} ${uRows[0].last_name || ''}`.trim()
      : 'Someone';
    const preview = comment.substring(0, 50) + (comment.length > 50 ? '...' : '');

    try {
      const ownerType = parentCommentId ? 'bar_event_reply_received' : 'bar_event_comment_received';
      const ownerTitle = parentCommentId ? 'New Reply on Event' : 'New Comment on Event';
      const ownerMessage = parentCommentId
        ? `${commenterName} replied on an event: "${preview}"`
        : `${commenterName} commented on an event: "${preview}"`;

      const inserted = await notifyBarTeamSocialInteraction({
        barId: events[0].bar_id,
        actorUserId: userId,
        type: ownerType,
        title: ownerTitle,
        message: ownerMessage,
        referenceId: insertId,
        referenceType: 'comment',
        targetRoute: '/events',
        metadata: { event_id: eventId, comment_id: insertId, parent_comment_id: parentCommentId },
      });

      if (inserted > 0) triggerPushDispatch('bar-event-comment-owner-notify');
    } catch (_) {}

    if (parentCommentOwnerId && parentCommentOwnerId !== userId) {
      try {
        await createNotification({
          userIds: parentCommentOwnerId,
          type: 'event_comment_reply',
          title: 'New Reply to Your Event Comment',
          message: `${commenterName} replied: "${preview}"`,
          referenceType: 'reply',
          referenceId: insertId,
          category: 'social',
          action: 'open_chat',
          targetRoute: '/events',
          metadata: { event_id: eventId, comment_id: insertId, customer_id: userId },
        });

        triggerPushDispatch('event-comment-reply');
      } catch (_) {}
    }

    return res.status(201).json({ success: true, data: { id: insertId, parent_comment_id: parentCommentId }, commentCount });
  } catch (err) {
    console.error("EVENT COMMENT CREATE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// FOLLOW / UNFOLLOW BAR
// ═══════════════════════════════════════════
router.post("/follow-bar", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const barId = Number(req.body.bar_id);
    if (!barId) return res.status(400).json({ success: false, message: "Invalid bar" });

    const [banRows] = await pool.query(
      "SELECT 1 FROM customer_bar_bans WHERE bar_id = ? AND customer_id = ? LIMIT 1",
      [barId, userId]
    );
    if (banRows.length) {
      return res.status(403).json({ success: false, message: "You are banned from this bar" });
    }

    const [existing] = await pool.query(
      "SELECT id FROM bar_followers WHERE bar_id = ? AND user_id = ?",
      [barId, userId]
    );

    let action, following, buttonText;
    if (existing.length) {
      await pool.query("DELETE FROM bar_followers WHERE bar_id = ? AND user_id = ?", [barId, userId]);
      action = "unfollowed"; following = false; buttonText = "Follow";
    } else {
      await pool.query("INSERT INTO bar_followers (bar_id, user_id) VALUES (?, ?)", [barId, userId]);
      action = "followed"; following = true; buttonText = "Following";
    }

    const [[{ count: followerCount }]] = await pool.query(
      "SELECT COUNT(*) as count FROM bar_followers WHERE bar_id = ?", [barId]
    );

    return res.json({ success: true, action, following, buttonText, followerCount });
  } catch (err) {
    console.error("FOLLOW BAR ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

// ═══════════════════════════════════════════
// LIKE / UNLIKE POST
// ═══════════════════════════════════════════
router.post("/like-post", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = Number(req.body.post_id);
    if (!postId) return res.status(400).json({ success: false, message: "Invalid post" });

    const [postRows] = await pool.query(
      "SELECT bar_id FROM bar_posts WHERE id = ? LIMIT 1",
      [postId]
    );
    if (!postRows.length) return res.status(404).json({ success: false, message: "Post not found" });

    const [banRows] = await pool.query(
      "SELECT 1 FROM customer_bar_bans WHERE bar_id = ? AND customer_id = ? LIMIT 1",
      [postRows[0].bar_id, userId]
    );
    if (banRows.length) {
      return res.status(403).json({ success: false, message: "You are banned from this bar" });
    }

    const [existing] = await pool.query(
      "SELECT id FROM bar_post_likes WHERE post_id = ? AND user_id = ?",
      [postId, userId]
    );

    let action, liked;
    if (existing.length) {
      await pool.query("DELETE FROM bar_post_likes WHERE post_id = ? AND user_id = ?", [postId, userId]);
      action = "unliked"; liked = false;
    } else {
      await pool.query("INSERT INTO bar_post_likes (post_id, user_id) VALUES (?, ?)", [postId, userId]);
      action = "liked"; liked = true;
    }

    const [[{ count: likeCount }]] = await pool.query(
      "SELECT COUNT(*) as count FROM bar_post_likes WHERE post_id = ?", [postId]
    );

    return res.json({ success: true, action, liked, likeCount });
  } catch (err) {
    console.error("LIKE POST ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

// ═══════════════════════════════════════════
// POST COMMENT
// ═══════════════════════════════════════════
router.post("/comments", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = Number(req.body.post_id);
    const comment = (req.body.comment || "").trim();
    const parentCommentId = req.body.parent_comment_id ? Number(req.body.parent_comment_id) : null;
    if (!postId || !comment) return res.status(400).json({ success: false, message: "Post ID and comment are required" });

    const [postRows] = await pool.query(
      "SELECT bp.id, bp.bar_id, b.owner_id FROM bar_posts bp JOIN bars b ON bp.bar_id = b.id WHERE bp.id = ? LIMIT 1",
      [postId]
    );
    if (!postRows.length) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    const [banRows] = await pool.query(
      "SELECT 1 FROM customer_bar_bans WHERE bar_id = ? AND customer_id = ? LIMIT 1",
      [postRows[0].bar_id, userId]
    );
    if (banRows.length) {
      return res.status(403).json({ success: false, message: "You are banned from this bar" });
    }

    let parentCommentOwnerId = null;
    if (parentCommentId) {
      const [parentRows] = await pool.query(
        "SELECT id, user_id FROM bar_post_comments WHERE id = ? AND post_id = ? AND COALESCE(status, 'active') = 'active' LIMIT 1",
        [parentCommentId, postId]
      );
      if (!parentRows.length) {
        return res.status(404).json({ success: false, message: "Parent comment not found" });
      }
      parentCommentOwnerId = Number(parentRows[0].user_id || 0);
    }

    const [ins] = await pool.query(
      "INSERT INTO bar_post_comments (post_id, user_id, comment, parent_comment_id) VALUES (?, ?, ?, ?)",
      [postId, userId, comment, parentCommentId]
    );
    const commentId = ins.insertId;

    const [userRows] = await pool.query(
      "SELECT first_name, last_name, profile_picture FROM users WHERE id = ?", [userId]
    );
    const userInfo = userRows[0] || {};

    // Comment count (all comments including nested replies)
    const [[{ count: commentCount }]] = await pool.query(
      "SELECT COUNT(*) as count FROM bar_post_comments WHERE post_id = ? AND COALESCE(status, 'active') = 'active'",
      [postId]
    );

    const commenterName = `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() || 'Someone';
    const preview = comment.substring(0, 50) + (comment.length > 50 ? "..." : "");

    try {
      const ownerType = parentCommentId ? 'bar_post_reply_received' : 'bar_post_comment_received';
      const ownerTitle = parentCommentId ? 'New Reply on Bar Post' : 'New Comment on Bar Post';
      const ownerMessage = parentCommentId
        ? `${commenterName} replied on a bar post: "${preview}"`
        : `${commenterName} commented on a bar post: "${preview}"`;

      const inserted = await notifyBarTeamSocialInteraction({
        barId: postRows[0].bar_id,
        actorUserId: userId,
        type: ownerType,
        title: ownerTitle,
        message: ownerMessage,
        referenceId: commentId,
        referenceType: 'comment',
        targetRoute: '/events',
        metadata: { post_id: postId, comment_id: commentId, parent_comment_id: parentCommentId },
      });

      if (inserted > 0) triggerPushDispatch('bar-post-comment-owner-notify');
    } catch (_) {}

    if (parentCommentOwnerId && parentCommentOwnerId !== userId) {
      const notifMessage = commenterName + ' replied: "' + preview + '"';
      try {
        await createNotification({
          userIds: parentCommentOwnerId,
          type: 'comment_reply',
          title: 'New Reply to Your Comment',
          message: notifMessage,
          referenceType: 'reply',
          referenceId: commentId,
          category: 'social',
          action: 'open_chat',
          targetRoute: '/events',
          metadata: { post_id: postId, comment_id: commentId, customer_id: userId },
        });
        triggerPushDispatch('post-comment-reply');
      } catch (_) {}
    }

    return res.json({
      success: true,
      comment: {
        id: commentId,
        comment,
        user_name: (userInfo.first_name || "") + " " + (userInfo.last_name || ""),
        profile_picture: userInfo.profile_picture || "assets/images/default-avatar.png",
        created_at: new Date().toISOString(),
        parent_comment_id: parentCommentId,
        replies: []
      },
      commentCount
    });
  } catch (err) {
    console.error("POST COMMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

// ═══════════════════════════════════════════
// GET COMMENTS (with replies + reactions)
// ═══════════════════════════════════════════
router.get("/comments/:postId", async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    if (!postId) return res.status(400).json({ success: false, message: "Invalid post" });

    // Try to get current user from optional auth
    let currentUserId = 0;
    try {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        currentUserId = decoded.id || 0;
      }
    } catch (_) {}

    // Fetch ALL comments for this post (both top-level and replies)
    const [allComments] = await pool.query(
      `SELECT c.id, c.comment, c.created_at, c.user_id, c.parent_comment_id,
              u.first_name, u.last_name, u.profile_picture
       FROM bar_post_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ?
         AND COALESCE(c.status, 'active') = 'active'
       ORDER BY c.created_at ASC`,
      [postId]
    );

    // Build nested structure
    const commentMap = {};
    const commentsList = [];

    // First pass: create all comment objects
    for (const row of allComments) {
      const cid = row.id;

      // Get reactions for this comment
      const [reactionRows] = await pool.query(
        "SELECT reaction, COUNT(*) as count FROM bar_comment_reactions WHERE comment_id = ? GROUP BY reaction",
        [cid]
      );
      const reactionCounts = {};
      let totalReactions = 0;
      for (const r of reactionRows) { reactionCounts[r.reaction] = r.count; totalReactions += r.count; }

      let userReaction = null;
      if (currentUserId) {
        const [ur] = await pool.query(
          "SELECT reaction FROM bar_comment_reactions WHERE comment_id = ? AND user_id = ? LIMIT 1",
          [cid, currentUserId]
        );
        if (ur.length) userReaction = ur[0].reaction;
      }

      const commentObj = {
        id: row.id,
        comment: row.comment,
        user_id: row.user_id,
        user_name: (row.first_name || "") + " " + (row.last_name || ""),
        profile_picture: row.profile_picture || "assets/images/default-avatar.png",
        created_at: row.created_at,
        time_ago: timeElapsed(row.created_at),
        parent_comment_id: row.parent_comment_id,
        replies: [],
        reactions: reactionCounts,
        total_reactions: totalReactions,
        user_reaction: userReaction
      };

      commentMap[row.id] = commentObj;
    }

    // Second pass: build tree structure
    for (const comment of Object.values(commentMap)) {
      if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
        // This is a reply, add it to parent's replies array
        commentMap[comment.parent_comment_id].replies.push(comment);
      } else if (!comment.parent_comment_id) {
        // This is a top-level comment
        commentsList.push(comment);
      }
    }

    // Add reply_count to each comment recursively
    function countReplies(comment) {
      let count = comment.replies.length;
      for (const reply of comment.replies) {
        count += countReplies(reply);
      }
      return count;
    }

    for (const comment of commentsList) {
      comment.reply_count = countReplies(comment);
    }

    // Sort top-level comments by newest first
    commentsList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return res.json({ success: true, comments: commentsList });
  } catch (err) {
    console.error("GET COMMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error: " + err.message });
  }
});

// ═══════════════════════════════════════════
// COMMENT REACTION
// ═══════════════════════════════════════════
router.post("/comment-reaction", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = Number(req.body.comment_id);
    let reaction = req.body.reaction || "like";
    if (!commentId) return res.status(400).json({ success: false, message: "Comment ID is required" });

    const allowed = ["like", "love", "laugh", "wow", "sad", "angry"];
    if (!allowed.includes(reaction)) reaction = "like";

    // Get comment data for notification
    let commentData = null;
    try {
      const [cd] = await pool.query(
        "SELECT c.user_id, c.post_id, be.bar_id FROM bar_post_comments c JOIN bar_events be ON c.post_id = be.id WHERE c.id = ? AND COALESCE(c.status, 'active') = 'active'",
        [commentId]
      );
      if (cd.length) commentData = cd[0];
    } catch (_) {}
    if (!commentData) return res.status(404).json({ success: false, message: "Comment not found" });

    const [existing] = await pool.query(
      "SELECT id FROM bar_comment_reactions WHERE comment_id = ? AND user_id = ? AND reaction = ?",
      [commentId, userId, reaction]
    );

    let action, hasReacted;
    if (existing.length) {
      await pool.query("DELETE FROM bar_comment_reactions WHERE id = ?", [existing[0].id]);
      action = "removed"; hasReacted = false;
    } else {
      await pool.query("DELETE FROM bar_comment_reactions WHERE comment_id = ? AND user_id = ?", [commentId, userId]);
      const [ins] = await pool.query(
        "INSERT INTO bar_comment_reactions (comment_id, user_id, reaction) VALUES (?, ?, ?)",
        [commentId, userId, reaction]
      );
      action = "added"; hasReacted = true;

      // Notification
      if (commentData.user_id !== userId) {
        try {
          const [u] = await pool.query("SELECT first_name, last_name FROM users WHERE id = ?", [userId]);
          const name = u.length ? u[0].first_name + " " + u[0].last_name : "Someone";
          await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
             VALUES (?, 'comment_reaction', 'New Reaction to Your Comment', ?, ?, 'reaction')`,
            [commentData.user_id, name + " reacted to your comment", commentId]
          );
          triggerPushDispatch('comment-reaction');
        } catch (_) {}
      }
    }

    const [counts] = await pool.query(
      "SELECT reaction, COUNT(*) as count FROM bar_comment_reactions WHERE comment_id = ? GROUP BY reaction",
      [commentId]
    );
    const reactionCounts = {};
    let totalReactions = 0;
    for (const r of counts) { reactionCounts[r.reaction] = r.count; totalReactions += r.count; }

    return res.json({ success: true, action, reaction, hasReacted, reactionCounts, totalReactions });
  } catch (err) {
    console.error("COMMENT REACTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

// ═══════════════════════════════════════════
// COMMENT REPLY
// ═══════════════════════════════════════════
router.post("/comment-reply", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = Number(req.body.comment_id);
    const parentReplyId = req.body.parent_reply_id ? Number(req.body.parent_reply_id) : null;
    const reply = (req.body.reply || "").trim();
    if (!commentId || !reply) return res.status(400).json({ success: false, message: "Comment ID and reply are required" });

    // Get comment data
    const [cd] = await pool.query(
      "SELECT c.user_id, c.post_id, be.bar_id FROM bar_post_comments c JOIN bar_events be ON c.post_id = be.id WHERE c.id = ? AND COALESCE(c.status, 'active') = 'active'",
      [commentId]
    );
    if (!cd.length) return res.status(404).json({ success: false, message: "Comment not found" });
    const commentData = cd[0];

    let parentReplyUserId = null;
    if (parentReplyId) {
      const [pr] = await pool.query("SELECT user_id FROM bar_comment_replies WHERE id = ?", [parentReplyId]);
      if (pr.length) parentReplyUserId = pr[0].user_id;
    }

    let insResult;
    if (parentReplyId) {
      [insResult] = await pool.query(
        "INSERT INTO bar_comment_replies (comment_id, user_id, reply, parent_reply_id) VALUES (?, ?, ?, ?)",
        [commentId, userId, reply, parentReplyId]
      );
    } else {
      [insResult] = await pool.query(
        "INSERT INTO bar_comment_replies (comment_id, user_id, reply) VALUES (?, ?, ?)",
        [commentId, userId, reply]
      );
    }
    const replyId = insResult.insertId;

    const [userRows] = await pool.query("SELECT first_name, last_name, profile_picture FROM users WHERE id = ?", [userId]);
    const userInfo = userRows[0] || {};

    const [[{ count: replyCount }]] = await pool.query(
      "SELECT COUNT(*) as count FROM bar_comment_replies WHERE comment_id = ?", [commentId]
    );

    const replierName = (userInfo.first_name || "") + " " + (userInfo.last_name || "");

    // Notify comment owner
    if (commentData.user_id !== userId) {
      try {
        const msg = replierName + ' replied: "' + reply.substring(0, 50) + (reply.length > 50 ? "..." : "") + '"';
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
           VALUES (?, 'comment_reply', 'New Reply to Your Comment', ?, ?, 'reply')`,
          [commentData.user_id, msg, replyId]
        );
        triggerPushDispatch('comment-reply');
      } catch (_) {}
    }

    // Notify parent reply owner
    if (parentReplyUserId && parentReplyUserId !== userId && parentReplyUserId !== commentData.user_id) {
      try {
        const msg = replierName + ' replied: "' + reply.substring(0, 50) + (reply.length > 50 ? "..." : "") + '"';
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
           VALUES (?, 'reply_reply', 'New Reply to Your Reply', ?, ?, 'reply')`,
          [parentReplyUserId, msg, replyId]
        );
        triggerPushDispatch('reply-reply');
      } catch (_) {}
    }

    return res.json({
      success: true,
      reply: {
        id: replyId,
        comment_id: commentId,
        parent_reply_id: parentReplyId,
        reply,
        user_name: replierName,
        profile_picture: userInfo.profile_picture || "assets/images/default-avatar.png",
        created_at: new Date().toISOString()
      },
      replyCount
    });
  } catch (err) {
    console.error("COMMENT REPLY ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

// ═══════════════════════════════════════════
// REPLY REACTION
// ═══════════════════════════════════════════
router.post("/reply-reaction", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const replyId = Number(req.body.reply_id);
    let reaction = req.body.reaction || "like";
    if (!replyId) return res.status(400).json({ success: false, message: "Reply ID is required" });

    const allowed = ["like", "love", "laugh", "wow", "sad", "angry"];
    if (!allowed.includes(reaction)) reaction = "like";

    const [rd] = await pool.query(
      `SELECT r.user_id, r.comment_id, c.post_id, be.bar_id
       FROM bar_comment_replies r
       JOIN bar_post_comments c ON r.comment_id = c.id
       JOIN bar_events be ON c.post_id = be.id
       WHERE r.id = ?`,
      [replyId]
    );
    if (!rd.length) return res.status(404).json({ success: false, message: "Reply not found" });
    const replyData = rd[0];

    const [existing] = await pool.query(
      "SELECT id, reaction FROM bar_reply_reactions WHERE reply_id = ? AND user_id = ?",
      [replyId, userId]
    );

    let action, hasReacted;
    if (existing.length) {
      if (existing[0].reaction === reaction) {
        await pool.query("DELETE FROM bar_reply_reactions WHERE id = ?", [existing[0].id]);
        action = "removed"; hasReacted = false;
      } else {
        await pool.query("UPDATE bar_reply_reactions SET reaction = ? WHERE id = ?", [reaction, existing[0].id]);
        action = "updated"; hasReacted = true;
      }
    } else {
      await pool.query(
        "INSERT INTO bar_reply_reactions (reply_id, user_id, reaction) VALUES (?, ?, ?)",
        [replyId, userId, reaction]
      );
      action = "added"; hasReacted = true;
    }

    // Notification for reply owner (on add/update)
    if (action !== "removed" && replyData.user_id !== userId) {
      try {
        const [u] = await pool.query("SELECT first_name, last_name FROM users WHERE id = ?", [userId]);
        const name = u.length ? u[0].first_name + " " + u[0].last_name : "Someone";
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
           VALUES (?, 'reply_reaction', 'New Reaction to Your Reply', ?, ?, 'reply_reaction')`,
          [replyData.user_id, name + " reacted to your reply", replyId]
        );
        triggerPushDispatch('reply-reaction');
      } catch (_) {}
    }

    const [counts] = await pool.query(
      "SELECT reaction, COUNT(*) as count FROM bar_reply_reactions WHERE reply_id = ? GROUP BY reaction",
      [replyId]
    );
    const reactionCounts = {};
    let totalReactions = 0;
    for (const r of counts) { reactionCounts[r.reaction] = r.count; totalReactions += r.count; }

    return res.json({ success: true, action, reaction, hasReacted, reactionCounts, totalReactions });
  } catch (err) {
    console.error("REPLY REACTION ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

// ═══════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const all = req.query.all === "1";
    let limit = 20;
    if (all) limit = 200;
    else if (req.query.limit) limit = Math.max(1, Math.min(200, Number(req.query.limit)));

    const [[{ count: unreadCount }]] = await pool.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    );

    const [rows] = await pool.query(
      `SELECT n.*, r.status AS reservation_status, r.payment_status AS reservation_payment_status
       FROM notifications n
       LEFT JOIN reservations r
         ON n.reference_type = 'reservation' AND n.reference_id = r.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT ?`,
      [userId, limit]
    );

    const notifications = rows.map(row => {
      let parsedMeta = null;
      if (row.metadata) {
        try { parsedMeta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata; }
        catch (_) { parsedMeta = null; }
      }
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        reference_id: row.reference_id,
        reference_type: row.reference_type,
        related_id: row.related_id,
        related_type: row.related_type,
        is_read: !!row.is_read,
        created_at: row.created_at,
        time_ago: timeElapsed(row.created_at),
        post_id: row.post_id || null,
        comment_id: row.comment_id || null,
        bar_id: row.bar_id || null,
        category: row.category || null,
        action: row.action || 'navigate',
        target_route: row.target_route || null,
        metadata: parsedMeta,
        reservation_status: row.reservation_status || null,
        reservation_payment_status: row.reservation_payment_status || null
      };
    });

    return res.json({ success: true, unread_count: unreadCount, notifications });
  } catch (err) {
    console.error("GET NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

router.post("/notifications/read", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.body?.notification_id ? Number(req.body.notification_id) : null;

    if (notificationId) {
      await pool.query("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [notificationId, userId]);
    } else {
      await pool.query("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [userId]);
    }

    return res.json({ success: true, message: "Notifications marked as read" });
  } catch (err) {
    console.error("MARK NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

router.delete("/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [result] = await pool.query("DELETE FROM notifications WHERE user_id = ?", [userId]);
    return res.json({ success: true, message: "All notifications cleared", deleted_count: result.affectedRows });
  } catch (err) {
    console.error("CLEAR NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

// ═══════════════════════════════════════════
// ARCHIVED EVENTS
// ═══════════════════════════════════════════
router.get("/archived-events", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const barId = req.user.bar_id;
    const search = req.query.search || "";

    let sql, params;
    if (String(req.user.role || '').trim().toLowerCase() === "super_admin") {
      sql = `SELECT ae.*, b.name as bar_name,
                    DATE_FORMAT(ae.archived_at, '%M %d, %Y %h:%i %p') as formatted_archived_at
             FROM archived_events ae
             JOIN bars b ON ae.bar_id = b.id
             WHERE 1=1`;
      params = [];
      if (search) {
        sql += " AND (ae.title LIKE ? OR b.name LIKE ?)";
        params.push("%" + search + "%", "%" + search + "%");
      }
    } else {
      // Bar owner — get their bar_owner id
      const [boRows] = await pool.query("SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1", [userId]);
      const barOwnerId = boRows.length ? boRows[0].id : 0;
      sql = `SELECT ae.*, b.name as bar_name,
                    DATE_FORMAT(ae.archived_at, '%M %d, %Y %h:%i %p') as formatted_archived_at
             FROM archived_events ae
             JOIN bars b ON ae.bar_id = b.id
             WHERE ae.archived_by = ?`;
      params = [barOwnerId];
      if (search) {
        sql += " AND (ae.title LIKE ? OR b.name LIKE ?)";
        params.push("%" + search + "%", "%" + search + "%");
      }
    }
    sql += " ORDER BY ae.archived_at DESC";

    const [rows] = await pool.query(sql, params);
    return res.json({ success: true, events: rows });
  } catch (err) {
    console.error("ARCHIVED EVENTS LIST ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

router.post("/archived-events/restore", requireAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const archiveId = Number(req.body.archive_id);
    if (!archiveId) return res.status(400).json({ success: false, message: "Invalid archive ID" });

    await conn.beginTransaction();

    const [archived] = await conn.query("SELECT * FROM archived_events WHERE id = ?", [archiveId]);
    if (!archived.length) { await conn.rollback(); return res.status(404).json({ success: false, message: "Archived event not found" }); }
    const ae = archived[0];

    const [existCheck] = await conn.query("SELECT id FROM bar_events WHERE id = ?", [ae.original_event_id]);
    if (existCheck.length) { await conn.rollback(); return res.status(409).json({ success: false, message: "Event already exists in main table" }); }

    await conn.query(
      `INSERT INTO bar_events (id, bar_id, title, description, event_date, start_time, end_time,
       entry_price, max_capacity, current_bookings, image_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ae.original_event_id, ae.bar_id, ae.title, ae.description, ae.event_date, ae.start_time, ae.end_time,
       ae.entry_price, ae.max_capacity || 0, ae.current_bookings || 0, ae.image_path || null, ae.status || "active"]
    );

    await conn.query("DELETE FROM archived_events WHERE id = ?", [archiveId]);
    await conn.commit();

    return res.json({ success: true, message: "Event restored successfully" });
  } catch (err) {
    await conn.rollback();
    console.error("RESTORE ARCHIVED EVENT ERROR:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

router.delete("/archived-events/:id", requireAuth, async (req, res) => {
  try {
    const archiveId = Number(req.params.id);
    if (!archiveId) return res.status(400).json({ success: false, message: "Invalid archive ID" });

    const [result] = await pool.query("DELETE FROM archived_events WHERE id = ?", [archiveId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Archive not found" });

    return res.json({ success: true, message: "Event permanently deleted" });
  } catch (err) {
    console.error("DELETE ARCHIVED EVENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Database error" });
  }
});

// ═══════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════
router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 2) return res.json([]);

    const term = "%" + q + "%";
    const [rows] = await pool.query(
      `SELECT id, name AS title, CONCAT(address, ', ', city) AS description,
              CONCAT('/bar.php?id=', id) AS link
       FROM bars
       WHERE status = 'active' AND ${complianceVisible()}
         AND (name LIKE ? OR city LIKE ? OR address LIKE ?)
       ORDER BY name ASC LIMIT 20`,
      [term, term, term]
    );

    return res.json(rows);
  } catch (err) {
    console.error("SEARCH ERROR:", err);
    return res.json([]);
  }
});

// ═══════════════════════════════════════════
// EMAIL VERIFICATION
// ═══════════════════════════════════════════
router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ success: false, message: "Email and code required" });

    const [rows] = await pool.query(
      "SELECT id FROM users WHERE email = ? AND verification_code = ? LIMIT 1",
      [email.trim().toLowerCase(), code.trim()]
    );

    if (!rows.length) {
      return res.status(400).json({ success: false, message: "Invalid or expired code" });
    }

    await pool.query(
      "UPDATE users SET is_verified = 1, verification_code = NULL, updated_at = NOW() WHERE id = ?",
      [rows[0].id]
    );

    return res.json({ success: true, message: "Email verified successfully" });
  } catch (err) {
    console.error("VERIFY EMAIL ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: "Email required" });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const [result] = await pool.query(
      "UPDATE users SET verification_code = ?, updated_at = NOW() WHERE email = ? AND is_verified = 0",
      [code, email.trim().toLowerCase()]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Email not found or already verified" });
    }

    // In production, send the code via email here
    console.log(`VERIFICATION CODE for ${email}: ${code}`);

    return res.json({ success: true, message: "Verification code sent" });
  } catch (err) {
    console.error("RESEND VERIFICATION ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// SMS VERIFICATION (stub - needs Twilio config)
// ═══════════════════════════════════════════
router.post("/send-sms-verification", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const phone = req.body.phone || "";
    if (!phone) return res.status(400).json({ success: false, message: "Phone number required" });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await pool.query(
      "UPDATE users SET sms_verification_code = ?, updated_at = NOW() WHERE id = ?",
      [code, userId]
    );

    // In production, send SMS via Twilio here
    console.log(`SMS CODE for ${phone}: ${code}`);

    return res.json({ success: true, message: "Verification code sent" });
  } catch (err) {
    console.error("SEND SMS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/verify-sms-code", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { phone, code } = req.body || {};
    if (!code) return res.status(400).json({ success: false, message: "Code required" });

    const [rows] = await pool.query(
      "SELECT id FROM users WHERE id = ? AND sms_verification_code = ? LIMIT 1",
      [userId, code.trim()]
    );

    if (!rows.length) {
      return res.status(400).json({ success: false, message: "Invalid code" });
    }

    await pool.query(
      "UPDATE users SET phone_verified = 1, sms_verification_code = NULL, phone_number = ?, updated_at = NOW() WHERE id = ?",
      [phone || null, userId]
    );

    return res.json({ success: true, message: "Phone verified successfully" });
  } catch (err) {
    console.error("VERIFY SMS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /social/followings — list bars the user follows
// ═══════════════════════════════════════════
router.get("/followings", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT b.id, b.name, b.address, b.city, b.category, b.image_path,
              b.logo_path, b.video_path,
              b.logo_path AS bar_icon, b.video_path AS bar_gif,
              b.rating, b.review_count,
              (SELECT COUNT(*) FROM bar_followers bf2 WHERE bf2.bar_id = b.id) AS follower_count,
              bf.created_at AS followed_at
       FROM bars b
       JOIN bar_followers bf ON b.id = bf.bar_id
       WHERE bf.user_id = ?
         AND b.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM customer_bar_bans cbb WHERE cbb.bar_id = b.id AND cbb.customer_id = ?)
       ORDER BY bf.created_at DESC`,
      [userId, userId]
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET FOLLOWINGS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /social/unified-feed — unified events + posts feed
// ═══════════════════════════════════════════
router.get("/unified-feed", async (req, res) => {
  try {
    let currentUserId = 0;
    try {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        currentUserId = decoded.id || 0;
      }
    } catch (_) {}

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const focusPostId = Number(req.query.focus_post_id || 0);
    const focusEventId = Number(req.query.focus_event_id || 0);

    const sortFeedItems = (a, b) => {
      const followDelta = Number(b.is_followed || 0) - Number(a.is_followed || 0);
      if (followDelta !== 0) return followDelta;
      return new Date(b.created_at) - new Date(a.created_at);
    };

    const normalizeFeedItem = (item) => ({
      ...item,
      time_ago: timeElapsed(item.created_at),
      like_count: Number(item.like_count || 0),
      comment_count: Number(item.comment_count || 0),
      user_liked: !!item.user_liked,
      is_followed: Number(item.is_followed || 0) > 0,
    });

    const buildItemKey = (item) => `${String(item.feed_type || '').toLowerCase()}:${Number(item.id || 0)}`;

    // Get posts
    const [posts] = await pool.query(
      `SELECT bp.id, bp.bar_id, bp.content AS description, bp.created_at,
              'post' AS feed_type,
              bp.image_path AS post_image_path,
              b.name AS bar_name, b.image_path AS bar_image, b.logo_path AS bar_logo,
              (SELECT COUNT(*) FROM bar_post_likes WHERE post_id = bp.id) AS like_count,
              (SELECT COUNT(*) FROM bar_post_comments WHERE post_id = bp.id AND COALESCE(status, 'active') = 'active') AS comment_count,
              ${currentUserId ? `(SELECT COUNT(*) > 0 FROM bar_post_likes WHERE post_id = bp.id AND user_id = ${currentUserId}) AS user_liked` : '0 AS user_liked'},
              ${currentUserId ? `(SELECT COUNT(*) > 0 FROM bar_followers WHERE bar_id = bp.bar_id AND user_id = ${currentUserId}) AS is_followed` : '0 AS is_followed'}
       FROM bar_posts bp
       JOIN bars b ON bp.bar_id = b.id
       WHERE bp.status = 'active' AND b.status = 'active'
       ${currentUserId ? `AND NOT EXISTS (SELECT 1 FROM customer_bar_bans WHERE bar_id = bp.bar_id AND customer_id = ${currentUserId})` : ''}
       ORDER BY bp.created_at DESC
       LIMIT ?`,
      [limit]
    );

    // Get events
    const [events] = await pool.query(
      `SELECT be.id, be.bar_id, be.title, be.description, be.event_date, be.start_time, be.end_time,
              be.entry_price, be.image_path, be.created_at,
              'event' AS feed_type,
              b.name AS bar_name, b.image_path AS bar_image, b.logo_path AS bar_logo,
              (SELECT COUNT(*) FROM event_likes WHERE event_id = be.id) AS like_count,
              (SELECT COUNT(*) FROM event_comments WHERE event_id = be.id AND status = 'active') AS comment_count,
              ${currentUserId ? `(SELECT COUNT(*) > 0 FROM event_likes WHERE event_id = be.id AND user_id = ${currentUserId}) AS user_liked` : '0 AS user_liked'},
              ${currentUserId ? `(SELECT COUNT(*) > 0 FROM bar_followers WHERE bar_id = be.bar_id AND user_id = ${currentUserId}) AS is_followed` : '0 AS is_followed'}
       FROM bar_events be
       JOIN bars b ON be.bar_id = b.id
       WHERE be.status = 'active' AND b.status = 'active'
       ${currentUserId ? `AND NOT EXISTS (SELECT 1 FROM customer_bar_bans WHERE bar_id = be.bar_id AND customer_id = ${currentUserId})` : ''}
       ORDER BY be.created_at DESC
       LIMIT ?`,
      [limit]
    );

    let feed = [...posts, ...events].map(normalizeFeedItem).sort(sortFeedItems);

    const hasFeedItem = (feedType, id) =>
      feed.some((item) => String(item.feed_type || '').toLowerCase() === feedType && Number(item.id || 0) === Number(id));

    if (focusPostId > 0 && !hasFeedItem('post', focusPostId)) {
      const [focusPostRows] = await pool.query(
        `SELECT bp.id, bp.bar_id, bp.content AS description, bp.created_at,
                'post' AS feed_type,
                bp.image_path AS post_image_path,
                b.name AS bar_name, b.image_path AS bar_image, b.logo_path AS bar_logo,
                (SELECT COUNT(*) FROM bar_post_likes WHERE post_id = bp.id) AS like_count,
                (SELECT COUNT(*) FROM bar_post_comments WHERE post_id = bp.id AND COALESCE(status, 'active') = 'active') AS comment_count,
                ${currentUserId ? `(SELECT COUNT(*) > 0 FROM bar_post_likes WHERE post_id = bp.id AND user_id = ${currentUserId}) AS user_liked` : '0 AS user_liked'},
                ${currentUserId ? `(SELECT COUNT(*) > 0 FROM bar_followers WHERE bar_id = bp.bar_id AND user_id = ${currentUserId}) AS is_followed` : '0 AS is_followed'}
         FROM bar_posts bp
         JOIN bars b ON bp.bar_id = b.id
         WHERE bp.id = ?
           AND bp.status = 'active'
           AND b.status = 'active'
           ${currentUserId ? `AND NOT EXISTS (SELECT 1 FROM customer_bar_bans WHERE bar_id = bp.bar_id AND customer_id = ${currentUserId})` : ''}
         LIMIT 1`,
        [focusPostId]
      );

      if (focusPostRows.length) {
        feed.push(normalizeFeedItem(focusPostRows[0]));
      }
    }

    if (focusEventId > 0 && !hasFeedItem('event', focusEventId)) {
      const [focusEventRows] = await pool.query(
        `SELECT be.id, be.bar_id, be.title, be.description, be.event_date, be.start_time, be.end_time,
                be.entry_price, be.image_path, be.created_at,
                'event' AS feed_type,
                b.name AS bar_name, b.image_path AS bar_image, b.logo_path AS bar_logo,
                (SELECT COUNT(*) FROM event_likes WHERE event_id = be.id) AS like_count,
                (SELECT COUNT(*) FROM event_comments WHERE event_id = be.id AND status = 'active') AS comment_count,
                ${currentUserId ? `(SELECT COUNT(*) > 0 FROM event_likes WHERE event_id = be.id AND user_id = ${currentUserId}) AS user_liked` : '0 AS user_liked'},
                ${currentUserId ? `(SELECT COUNT(*) > 0 FROM bar_followers WHERE bar_id = be.bar_id AND user_id = ${currentUserId}) AS is_followed` : '0 AS is_followed'}
         FROM bar_events be
         JOIN bars b ON be.bar_id = b.id
         WHERE be.id = ?
           AND be.status = 'active'
           AND b.status = 'active'
           ${currentUserId ? `AND NOT EXISTS (SELECT 1 FROM customer_bar_bans WHERE bar_id = be.bar_id AND customer_id = ${currentUserId})` : ''}
         LIMIT 1`,
        [focusEventId]
      );

      if (focusEventRows.length) {
        feed.push(normalizeFeedItem(focusEventRows[0]));
      }
    }

    feed = feed.sort(sortFeedItems);

    const dedupedFeed = [];
    const seenKeys = new Set();
    for (const item of feed) {
      const key = buildItemKey(item);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      dedupedFeed.push(item);
    }

    if (focusPostId > 0 || focusEventId > 0) {
      const focusKeys = new Set();
      if (focusPostId > 0) focusKeys.add(`post:${focusPostId}`);
      if (focusEventId > 0) focusKeys.add(`event:${focusEventId}`);

      const prioritized = [
        ...dedupedFeed.filter((item) => focusKeys.has(buildItemKey(item))),
        ...dedupedFeed.filter((item) => !focusKeys.has(buildItemKey(item))),
      ];
      feed = prioritized.slice(0, limit);
    } else {
      feed = dedupedFeed.slice(0, limit);
    }

    return res.json({ success: true, data: feed });
  } catch (err) {
    console.error("GET UNIFIED FEED ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// GET /social/bar-posts — list posts (for public feed / bar page)
// ═══════════════════════════════════════════
router.get("/bar-posts", async (req, res) => {
  try {
    const barId = req.query.bar_id;
    let currentUserId = 0;
    try {
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ")) {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        currentUserId = decoded.id || 0;
      }
    } catch (_) {}

    let where = "bp.status = 'active'";
    const params = [];
    if (barId) {
      where += " AND bp.bar_id = ?";
      params.push(barId);
    }
    if (currentUserId) {
      where += " AND NOT EXISTS (SELECT 1 FROM customer_bar_bans cbb WHERE cbb.bar_id = bp.bar_id AND cbb.customer_id = ?)";
      params.push(currentUserId);
    }
    const [rows] = await pool.query(
      `SELECT bp.*, b.name AS bar_name, b.image_path AS bar_image,
              u.first_name, u.last_name
       FROM bar_posts bp
       JOIN bars b ON bp.bar_id = b.id
       LEFT JOIN users u ON bp.user_id = u.id
       WHERE ${where}
       ORDER BY bp.created_at DESC LIMIT 50`,
      params
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET BAR POSTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// POST /social/bar-posts — create a post (bar owner)
// ═══════════════════════════════════════════
router.post("/bar-posts", requireAuth, async (req, res) => {
  try {
    const { bar_id, content } = req.body;
    if (!bar_id || !content) {
      return res.status(400).json({ success: false, message: "Bar ID and content are required" });
    }

    // Verify bar ownership
    const [bars] = await pool.query(
      "SELECT id FROM bars WHERE id = ? AND owner_id = (SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1)",
      [bar_id, req.user.id]
    );
    if (!bars.length) return res.status(403).json({ success: false, message: "Not authorized" });

    const [result] = await pool.query(
      "INSERT INTO bar_posts (bar_id, user_id, content) VALUES (?, ?, ?)",
      [bar_id, req.user.id, content]
    );
    return res.json({ success: true, message: "Post created", data: { id: result.insertId } });
  } catch (err) {
    console.error("CREATE BAR POST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// DELETE /social/bar-posts/:id — delete a post
// ═══════════════════════════════════════════
router.delete("/bar-posts/:id", requireAuth, async (req, res) => {
  try {
    const postId = req.params.id;
    const [posts] = await pool.query(
      `SELECT bp.id FROM bar_posts bp
       JOIN bars b ON bp.bar_id = b.id
       WHERE bp.id = ? AND b.owner_id = (SELECT id FROM bar_owners WHERE user_id = ? LIMIT 1)`,
      [postId, req.user.id]
    );
    if (!posts.length) return res.status(403).json({ success: false, message: "Not authorized" });

    await pool.query("UPDATE bar_posts SET status = 'archived', updated_at = NOW() WHERE id = ?", [postId]);
    return res.json({ success: true, message: "Post archived" });
  } catch (err) {
    console.error("DELETE BAR POST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// FEATURE 1: REPORT COMMENT / REPLY
// ═══════════════════════════════════════════
router.post("/comments/:commentId/report", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = Number(req.params.commentId);
    const { reason, details, comment_type } = req.body || {};

    if (!commentId) return res.status(400).json({ success: false, message: "Invalid comment ID" });
    if (!reason) return res.status(400).json({ success: false, message: "Reason is required" });

    const allowedReasons = [
      "Spam or advertisement",
      "Offensive or inappropriate",
      "Harassment or bullying",
      "False information",
      "Other"
    ];
    if (!allowedReasons.includes(reason)) {
      return res.status(400).json({ success: false, message: "Invalid reason" });
    }

    // Determine comment type and validate existence + not own comment
    const requestedType = comment_type || "post_comment";
    const validTypes = ["post_comment", "event_comment", "post_reply", "event_reply"];
    if (!validTypes.includes(requestedType)) {
      return res.status(400).json({ success: false, message: "Invalid comment_type" });
    }

    let normalizedType = requestedType;
    let commentOwnerId = null;
    if (requestedType === "post_comment") {
      const [rows] = await pool.query("SELECT user_id FROM bar_post_comments WHERE id = ? AND COALESCE(status, 'active') = 'active' LIMIT 1", [commentId]);
      if (!rows.length) return res.status(404).json({ success: false, message: "Comment not found" });
      commentOwnerId = rows[0].user_id;
    } else if (requestedType === "event_comment") {
      const [rows] = await pool.query("SELECT user_id FROM event_comments WHERE id = ? LIMIT 1", [commentId]);
      if (!rows.length) return res.status(404).json({ success: false, message: "Comment not found" });
      commentOwnerId = rows[0].user_id;
    } else if (requestedType === "post_reply") {
      const [replyRows] = await pool.query("SELECT user_id FROM bar_comment_replies WHERE id = ? LIMIT 1", [commentId]);
      if (replyRows.length) {
        commentOwnerId = replyRows[0].user_id;
      } else {
        // Fallback for feeds where replies are stored in bar_post_comments with parent_comment_id.
        const [commentRows] = await pool.query("SELECT user_id FROM bar_post_comments WHERE id = ? AND COALESCE(status, 'active') = 'active' LIMIT 1", [commentId]);
        if (!commentRows.length) return res.status(404).json({ success: false, message: "Reply not found" });
        commentOwnerId = commentRows[0].user_id;
        normalizedType = "post_comment";
      }
    } else if (requestedType === "event_reply") {
      const [replyRows] = await pool.query("SELECT user_id FROM event_comment_replies WHERE id = ? LIMIT 1", [commentId]);
      if (replyRows.length) {
        commentOwnerId = replyRows[0].user_id;
      } else {
        // Backward-compatible fallback if event replies are represented as event_comments.
        const [commentRows] = await pool.query("SELECT user_id FROM event_comments WHERE id = ? LIMIT 1", [commentId]);
        if (!commentRows.length) return res.status(404).json({ success: false, message: "Reply not found" });
        commentOwnerId = commentRows[0].user_id;
        normalizedType = "event_comment";
      }
    }

    if (commentOwnerId === userId) {
      return res.status(400).json({ success: false, message: "You cannot report your own comment" });
    }

    // Check for comment_reports table existence
    const [tableCheck] = await pool.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comment_reports' LIMIT 1`
    );
    if (!tableCheck.length) {
      // Auto-create the table if migration hasn't run
      await pool.query(`
        CREATE TABLE IF NOT EXISTS comment_reports (
          id INT PRIMARY KEY AUTO_INCREMENT,
          comment_id INT NOT NULL,
          comment_type ENUM('post_comment','event_comment','post_reply','event_reply') NOT NULL DEFAULT 'post_comment',
          reporter_id INT NOT NULL,
          reason VARCHAR(100) NOT NULL,
          details TEXT,
          status ENUM('pending', 'reviewed', 'dismissed') DEFAULT 'pending',
          reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY one_report_per_user (comment_id, comment_type, reporter_id),
          INDEX idx_comment_reports_status (status),
          INDEX idx_comment_reports_comment (comment_id, comment_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }

    await pool.query(
      `INSERT INTO comment_reports (comment_id, comment_type, reporter_id, reason, details)
       VALUES (?, ?, ?, ?, ?)`,
      [commentId, normalizedType, userId, reason, details ? String(details).substring(0, 200) : null]
    );

    return res.status(201).json({ success: true, message: "Report submitted. Thank you for helping keep the community safe." });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "You have already reported this comment." });
    }
    console.error("REPORT COMMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/comments/:commentId/report-status", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = Number(req.params.commentId);
    const commentType = req.query.comment_type || "post_comment";

    const validTypes = ["post_comment", "event_comment", "post_reply", "event_reply"];
    if (!validTypes.includes(String(commentType))) {
      return res.status(400).json({ success: false, message: "Invalid comment_type" });
    }

    // Check table existence
    const [tableCheck] = await pool.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'comment_reports' LIMIT 1`
    );
    if (!tableCheck.length) {
      return res.json({ success: true, reported: false });
    }

    const lookupTypes = [commentType];
    if (commentType === "post_reply") lookupTypes.push("post_comment");
    if (commentType === "event_reply") lookupTypes.push("event_comment");

    const placeholders = lookupTypes.map(() => "?").join(", ");
    const [rows] = await pool.query(
      `SELECT id
       FROM comment_reports
       WHERE comment_id = ?
         AND comment_type IN (${placeholders})
         AND reporter_id = ?
       LIMIT 1`,
      [commentId, ...lookupTypes, userId]
    );

    return res.json({ success: true, reported: rows.length > 0 });
  } catch (err) {
    console.error("REPORT STATUS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// FEATURE 2: GET TABLES FOR EVENT
// ═══════════════════════════════════════════
router.get("/events/:eventId/tables", async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, message: "Invalid event ID" });

    // Get event details
    const [eventRows] = await pool.query(
      `SELECT id, bar_id, event_date, start_time, end_time, entry_price
       FROM bar_events
       WHERE id = ? AND status = 'active' AND archived_at IS NULL
       LIMIT 1`,
      [eventId]
    );
    if (!eventRows.length) return res.status(404).json({ success: false, message: "Event not found" });

    const event = eventRows[0];
    const barId = event.bar_id;
    const eventDate = event.event_date ? new Date(event.event_date).toISOString().slice(0, 10) : null;
    // Use event start_time for availability check; normalize to HH:00:00
    let eventTime = null;
    if (event.start_time) {
      const hh = String(event.start_time).slice(0, 2);
      eventTime = `${hh}:00:00`;
    }

    if (!eventDate) {
      return res.status(400).json({ success: false, message: "Event has no date" });
    }

    // Get all active tables for this bar
    const [allTables] = await pool.query(
      `SELECT id, bar_id, table_number, capacity, is_active, manual_status, image_path, price
       FROM bar_tables
       WHERE bar_id = ? AND is_active = 1 AND deleted_at IS NULL
       ORDER BY capacity ASC, table_number ASC`,
      [barId]
    );

    // Get reserved table IDs for this event date/time
    let reservedTableIds = [];
    if (eventTime) {
      const [reserved] = await pool.query(
        `SELECT DISTINCT table_id FROM reservations
         WHERE bar_id = ? AND reservation_date = ? AND reservation_time = ?
          AND status IN ('pending','approved','paid','confirmed','checked_in')`,
        [barId, eventDate, eventTime]
      );
      reservedTableIds = reserved.map(r => r.table_id);
    }

    const tables = allTables.map(t => ({
      ...t,
      available: !reservedTableIds.includes(t.id) && String(t.manual_status || 'available').toLowerCase() === 'available',
    }));

    return res.json({
      success: true,
      data: tables,
      event: {
        id: event.id,
        bar_id: barId,
        event_date: eventDate,
        start_time: event.start_time,
        end_time: event.end_time,
        entry_price: Number(event.entry_price || 0),
      }
    });
  } catch (err) {
    console.error("EVENT TABLES ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

async function resolveNotificationTargetPayload(userId, notificationId) {
  const [notifRows] = await pool.query(
    `SELECT id, type, title, message, reference_id, reference_type, metadata, target_route
     FROM notifications
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [notificationId, userId]
  );

  if (!notifRows.length) return null;

  const row = notifRows[0];
  const type = String(row.type || "").toLowerCase();
  const referenceType = String(row.reference_type || "").toLowerCase();
  const referenceId = Number(row.reference_id || 0);
  const directPostId = Number(row.post_id || 0);
  const directCommentId = Number(row.comment_id || 0);
  const targetReferenceId = referenceId > 0 ? referenceId : directCommentId;

  // Handle mention notifications — deep-link to bar media viewer
  if (type === "mention" && referenceType === "media_comment") {
    let metadata = {};
    try { metadata = JSON.parse(row.metadata || "{}"); } catch (_) {}
    const barId = Number(metadata.bar_id || 0);
    const mediaId = Number(metadata.media_id || 0);
    const commentId = Number(metadata.comment_id || referenceId || 0);

    if (barId > 0) {
      const target = {
        notification_id: Number(row.id || 0) || null,
        view: "bar_detail",
        route: `/bars/${barId}`,
        reference_type: "media_comment",
        reference_id: referenceId || null,
        bar_id: barId,
        media_id: mediaId || null,
        comment_id: commentId || null,
      };
      return { notification: row, target };
    }
  }

  const fallbackView =
    type.includes("reservation")
      ? "reservations"
      : type.includes("payment")
      ? "payments"
      : (type.includes("comment") || type.includes("reply") || type.includes("reaction") || type.includes("event"))
      ? "events"
      : "notifications";

  const fallbackRoute =
    fallbackView === "reservations"
      ? "/reservations"
      : fallbackView === "payments"
      ? "/payments"
      : fallbackView === "events"
      ? "/events"
      : "/notifications";

  const target = {
    notification_id: Number(row.id || 0) || null,
    view: fallbackView,
    route: fallbackRoute,
    reference_type: row.reference_type || null,
    reference_id: targetReferenceId || null,
  };

  const looksLikeReservationTarget =
    targetReferenceId > 0 &&
    (referenceType === "reservation" || referenceType.includes("reservation") || type.includes("reservation"));

  if (looksLikeReservationTarget) {
    let reservationLookupId = targetReferenceId;
    let reservationRows = [];

    const [directReservationRows] = await pool.query(
      `SELECT id, status, payment_status
       FROM reservations
       WHERE id = ?
       LIMIT 1`,
      [reservationLookupId]
    );
    reservationRows = directReservationRows;

    if (!reservationRows.length) {
      const [paymentRows] = await pool.query(
        `SELECT related_id
         FROM payment_transactions
         WHERE id = ? AND payment_type = 'reservation'
         LIMIT 1`,
        [reservationLookupId]
      );

      const derivedReservationId = Number(paymentRows?.[0]?.related_id || 0);
      if (derivedReservationId > 0) {
        reservationLookupId = derivedReservationId;
        const [derivedReservationRows] = await pool.query(
          `SELECT id, status, payment_status
           FROM reservations
           WHERE id = ?
           LIMIT 1`,
          [reservationLookupId]
        );
        reservationRows = derivedReservationRows;
      }
    }

    if (reservationRows.length) {
      target.view = "reservation_detail";
      target.route = "/reservations";
      target.reservation_id = Number(reservationRows[0].id || reservationLookupId);
      target.reservation_status = reservationRows[0].status || null;
      target.reservation_payment_status = reservationRows[0].payment_status || null;
      return { notification: row, target };
    }
  }

  const resolvePostCommentById = async (commentId) => {
    if (!commentId) return null;
    const [rows] = await pool.query(
      `SELECT c.id AS comment_id, c.parent_comment_id, c.post_id
       FROM bar_post_comments c
       WHERE c.id = ?
       LIMIT 1`,
      [commentId]
    );
    return rows.length ? rows[0] : null;
  };

  const resolvePostReplyById = async (replyId) => {
    if (!replyId) return null;
    const [rows] = await pool.query(
      `SELECT r.id AS reply_id, r.comment_id, c.post_id, c.parent_comment_id
       FROM bar_comment_replies r
       JOIN bar_post_comments c ON c.id = r.comment_id
       WHERE r.id = ?
       LIMIT 1`,
      [replyId]
    );
    return rows.length ? rows[0] : null;
  };

  const resolveEventReplyById = async (replyId) => {
    if (!replyId) return null;
    const [rows] = await pool.query(
      `SELECT r.id AS reply_id, r.event_id, r.event_comment_id
       FROM event_comment_replies r
       WHERE r.id = ?
       LIMIT 1`,
      [replyId]
    );
    return rows.length ? rows[0] : null;
  };

  const resolveEventPayload = async (eventId) => {
    if (!eventId) return null;
    const [rows] = await pool.query(
      `SELECT e.id, e.bar_id, e.title, e.description, e.event_date, e.start_time, e.end_time,
              e.entry_price, e.max_capacity, e.current_bookings, e.status, e.image_path,
              b.name AS bar_name,
              (SELECT COUNT(*) FROM event_likes el WHERE el.event_id = e.id) AS like_count,
              (SELECT COUNT(*) FROM event_comments ec WHERE ec.event_id = e.id AND ec.status = 'active') AS comment_count,
              EXISTS(
                SELECT 1 FROM event_likes el2 WHERE el2.event_id = e.id AND el2.user_id = ?
              ) AS user_liked
       FROM bar_events e
       LEFT JOIN bars b ON b.id = e.bar_id
       WHERE e.id = ?
       LIMIT 1`,
      [userId, eventId]
    );
    return rows.length ? rows[0] : null;
  };

  if (directPostId > 0) {
    target.view = "post_detail";
    target.route = "/events";
    target.feed_type = "post";
    target.post_id = directPostId;
    target.comment_id = directCommentId > 0 ? directCommentId : targetReferenceId || null;
    return { notification: row, target };
  }

  const hasMissingReferenceType =
    !referenceType || referenceType === "unknown" || referenceType === "notification";

  const looksLikeCommentTarget =
    targetReferenceId > 0 &&
    (
      ["comment", "reaction"].includes(referenceType) ||
      (
        hasMissingReferenceType &&
        !type.includes("reply") &&
        (type.includes("comment") || type.includes("reaction"))
      )
    );

  if (looksLikeCommentTarget) {
    const postComment = await resolvePostCommentById(targetReferenceId);
    if (postComment) {
      target.view = "post_detail";
      target.route = "/events";
      target.feed_type = "post";
      target.post_id = Number(postComment.post_id || 0);
      target.comment_id = Number(postComment.comment_id || targetReferenceId);
      target.parent_comment_id = Number(postComment.parent_comment_id || 0) || null;
      return { notification: row, target };
    }
  }

  const looksLikeReplyTarget =
    targetReferenceId > 0 &&
    (
      ["reply", "reply_reaction"].includes(referenceType) ||
      (hasMissingReferenceType && type.includes("reply"))
    );

  if (looksLikeReplyTarget) {
    const postReply = await resolvePostReplyById(targetReferenceId);
    if (postReply) {
      target.view = "post_detail";
      target.route = "/events";
      target.feed_type = "post";
      target.post_id = Number(postReply.post_id || 0);
      target.comment_id = Number(postReply.comment_id || 0) || null;
      target.reply_id = Number(postReply.reply_id || targetReferenceId);
      target.parent_comment_id = Number(postReply.parent_comment_id || 0) || null;
      return { notification: row, target };
    }

    const postCommentAsReply = await resolvePostCommentById(targetReferenceId);
    if (postCommentAsReply) {
      target.view = "post_detail";
      target.route = "/events";
      target.feed_type = "post";
      target.post_id = Number(postCommentAsReply.post_id || 0);
      target.comment_id = Number(postCommentAsReply.comment_id || targetReferenceId);
      target.parent_comment_id = Number(postCommentAsReply.parent_comment_id || 0) || null;
      return { notification: row, target };
    }

    const eventReply = await resolveEventReplyById(targetReferenceId);
    if (eventReply) {
      const eventPayload = await resolveEventPayload(Number(eventReply.event_id || 0));
      if (eventPayload) {
        target.view = "event_detail";
        target.route = "/events";
        target.feed_type = "event";
        target.event_id = Number(eventPayload.id || 0);
        target.comment_id = Number(eventReply.event_comment_id || 0) || null;
        target.reply_id = Number(eventReply.reply_id || targetReferenceId);
        target.bar_name = eventPayload.bar_name || null;
        target.event = {
          id: eventPayload.id,
          bar_id: eventPayload.bar_id,
          title: eventPayload.title,
          description: eventPayload.description,
          event_date: eventPayload.event_date,
          start_time: eventPayload.start_time,
          end_time: eventPayload.end_time,
          entry_price: Number(eventPayload.entry_price || 0),
          max_capacity: eventPayload.max_capacity,
          current_bookings: Number(eventPayload.current_bookings || 0),
          status: eventPayload.status,
          image_path: eventPayload.image_path,
          like_count: Number(eventPayload.like_count || 0),
          comment_count: Number(eventPayload.comment_count || 0),
          user_liked: Number(eventPayload.user_liked || 0) === 1,
        };
        return { notification: row, target };
      }
    }
  }

  return { notification: row, target };
}

// ═══════════════════════════════════════════
// FEATURE 4: NOTIFICATION ENDPOINTS (additive)
// ═══════════════════════════════════════════
router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const [[{ count }]] = await pool.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    );
    return res.json({ success: true, count });
  } catch (err) {
    console.error("UNREAD COUNT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/notifications/:id/target", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = Number(req.params.id);
    if (!notificationId) {
      return res.status(400).json({ success: false, message: "Invalid notification ID" });
    }

    const payload = await resolveNotificationTargetPayload(userId, notificationId);
    if (!payload) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, ...payload });
  } catch (err) {
    console.error("NOTIFICATION TARGET ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [userId]);
    return res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("MARK ALL READ ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const notifId = Number(req.params.id);
    if (!notifId) return res.status(400).json({ success: false, message: "Invalid notification ID" });

    await pool.query("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [notifId, userId]);
    return res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error("MARK ONE READ ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ═══════════════════════════════════════════
// MOBILE PUSH TOKEN REGISTRATION
// ═══════════════════════════════════════════
router.get('/push-tokens/status', requireAuth, async (req, res) => {
  try {
    await ensureMobilePushSchema();

    const userId = req.user.id;
    const [tokens] = await pool.query(
      `SELECT id, token, platform, app_id, is_active, last_seen_at, updated_at
       FROM mobile_push_tokens
       WHERE user_id = ? AND app_id = 'customer_app'
       ORDER BY updated_at DESC
       LIMIT 5`,
      [userId]
    );

    const [deliveryErrors] = await pool.query(
      `SELECT l.notification_id, l.status, l.error_message, l.created_at
       FROM mobile_notification_push_log l
       JOIN mobile_push_tokens t ON t.id = l.token_id
       WHERE t.user_id = ?
         AND t.app_id = 'customer_app'
         AND l.status IN ('failed', 'skipped')
       ORDER BY l.created_at DESC
       LIMIT 10`,
      [userId]
    );

    const sanitizedTokens = (tokens || []).map((tokenRow) => {
      const raw = String(tokenRow.token || '');
      const suffix = raw.length > 12 ? raw.slice(-12) : raw;
      return {
        id: tokenRow.id,
        token_preview: suffix ? `...${suffix}` : '',
        platform: tokenRow.platform,
        app_id: tokenRow.app_id,
        is_active: Number(tokenRow.is_active || 0) === 1,
        last_seen_at: tokenRow.last_seen_at,
        updated_at: tokenRow.updated_at,
      };
    });

    return res.json({
      success: true,
      data: {
        push_enabled: isPushEnabled(),
        active_token_count: sanitizedTokens.filter((tokenRow) => tokenRow.is_active).length,
        tokens: sanitizedTokens,
        recent_delivery_errors: deliveryErrors || [],
      },
    });
  } catch (err) {
    console.error('PUSH TOKEN STATUS ERROR:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/push-tokens', requireAuth, async (req, res) => {
  try {
    await ensureMobilePushSchema();

    const userId = req.user.id;
    const token = String(req.body?.token || '').trim();
    const rawPlatform = String(req.body?.platform || 'unknown').toLowerCase().trim();
    const platform = ['android', 'ios', 'web', 'unknown'].includes(rawPlatform)
      ? rawPlatform
      : 'unknown';
    const appId = String(req.body?.app_id || 'customer_app').trim().slice(0, 64) || 'customer_app';

    if (!token || token.length < 20) {
      return res.status(400).json({ success: false, message: 'Invalid push token' });
    }

    const [result] = await pool.query(
      `INSERT INTO mobile_push_tokens (user_id, token, platform, app_id, is_active, last_seen_at)
       VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         platform = VALUES(platform),
         app_id = VALUES(app_id),
         is_active = 1,
         last_seen_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, token, platform, appId]
    );

    return res.json({
      success: true,
      message: 'Push token registered',
      inserted_or_updated: result.affectedRows > 0,
    });
  } catch (err) {
    console.error('REGISTER PUSH TOKEN ERROR:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/push-tokens', requireAuth, async (req, res) => {
  try {
    await ensureMobilePushSchema();

    const userId = req.user.id;
    const token = String(req.body?.token || '').trim();
    const appId = String(req.body?.app_id || 'customer_app').trim().slice(0, 64) || 'customer_app';

    let result;
    if (token) {
      [result] = await pool.query(
        `UPDATE mobile_push_tokens
         SET is_active = 0, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND app_id = ? AND token = ?`,
        [userId, appId, token]
      );
    } else {
      [result] = await pool.query(
        `UPDATE mobile_push_tokens
         SET is_active = 0, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND app_id = ?`,
        [userId, appId]
      );
    }

    return res.json({
      success: true,
      message: 'Push token(s) unregistered',
      affected: result.affectedRows || 0,
    });
  } catch (err) {
    console.error('UNREGISTER PUSH TOKEN ERROR:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
