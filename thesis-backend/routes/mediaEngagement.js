const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");

// ─── GET /media/:mediaId/engagement — like count, comment count, user's like status ───
router.get("/:mediaId/engagement", async (req, res) => {
  try {
    const mediaId = Number(req.params.mediaId);
    if (!mediaId) return res.status(400).json({ success: false, message: "Invalid media ID" });

    const [[likeCount]] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM media_likes WHERE media_id = ?", [mediaId]
    );
    const [[commentCount]] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM media_comments WHERE media_id = ? AND is_hidden = 0", [mediaId]
    );

    let liked = false;
    try {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (token) {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [[existing]] = await pool.query(
          "SELECT 1 FROM media_likes WHERE media_id = ? AND user_id = ? LIMIT 1",
          [mediaId, decoded.id]
        );
        liked = Boolean(existing);
      }
    } catch (_) {}

    return res.json({
      success: true,
      data: {
        likes: likeCount.cnt,
        comments: commentCount.cnt,
        liked,
      },
    });
  } catch (err) {
    console.error("MEDIA ENGAGEMENT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /media/:mediaId/like — toggle like ───
router.post("/:mediaId/like", requireAuth, async (req, res) => {
  try {
    const mediaId = Number(req.params.mediaId);
    const userId = req.user.id;
    if (!mediaId) return res.status(400).json({ success: false, message: "Invalid media ID" });

    const [[existing]] = await pool.query(
      "SELECT id FROM media_likes WHERE media_id = ? AND user_id = ? LIMIT 1",
      [mediaId, userId]
    );

    if (existing) {
      await pool.query("DELETE FROM media_likes WHERE id = ?", [existing.id]);
    } else {
      await pool.query(
        "INSERT INTO media_likes (media_id, user_id) VALUES (?, ?)",
        [mediaId, userId]
      );
    }

    const [[count]] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM media_likes WHERE media_id = ?", [mediaId]
    );

    return res.json({
      success: true,
      data: { liked: !existing, likes: count.cnt },
    });
  } catch (err) {
    console.error("MEDIA LIKE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── GET /media/:mediaId/comments — fetch comments (filtered, threaded, with like counts) ───
router.get("/:mediaId/comments", async (req, res) => {
  try {
    const mediaId = Number(req.params.mediaId);
    if (!mediaId) return res.status(400).json({ success: false, message: "Invalid media ID" });

    let userId = null;
    try {
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (token) {
        const jwt = require("jsonwebtoken");
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      }
    } catch (_) {}

    const [comments] = await pool.query(
      `SELECT mc.id, mc.content, mc.created_at, mc.parent_comment_id,
              mc.mentioned_user_id, mc.mentioned_user_name,
              u.id AS user_id, u.first_name, u.last_name, u.profile_picture,
              (SELECT COUNT(*) FROM media_comment_likes mcl WHERE mcl.comment_id = mc.id) AS like_count
       FROM media_comments mc
       JOIN users u ON u.id = mc.user_id
       WHERE mc.media_id = ? AND mc.is_hidden = 0
       ORDER BY mc.created_at ASC`,
      [mediaId]
    );

    // If user is logged in, fetch which comments they liked
    let likedCommentIds = [];
    if (userId && comments.length > 0) {
      const commentIds = comments.map(c => c.id);
      const [likes] = await pool.query(
        `SELECT comment_id FROM media_comment_likes WHERE comment_id IN (?) AND user_id = ?`,
        [commentIds, userId]
      );
      likedCommentIds = likes.map(l => l.comment_id);
    }

    const enriched = comments.map(c => ({
      ...c,
      liked_by_user: likedCommentIds.includes(c.id),
    }));

    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error("MEDIA COMMENTS ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /media/:mediaId/comments — add a comment (or reply) ───
router.post("/:mediaId/comments", requireAuth, async (req, res) => {
  try {
    const mediaId = Number(req.params.mediaId);
    const userId = req.user.id;
    const { content, parent_comment_id, mentioned_user_id, mentioned_user_name } = req.body || {};

    if (!mediaId) return res.status(400).json({ success: false, message: "Invalid media ID" });
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: "Comment cannot be empty" });
    }

    // If replying, verify parent comment exists and belongs to same media
    if (parent_comment_id) {
      const [[parent]] = await pool.query(
        "SELECT id FROM media_comments WHERE id = ? AND media_id = ? LIMIT 1",
        [parent_comment_id, mediaId]
      );
      if (!parent) return res.status(404).json({ success: false, message: "Parent comment not found" });
    }

    const [result] = await pool.query(
      "INSERT INTO media_comments (media_id, user_id, content, parent_comment_id, mentioned_user_id, mentioned_user_name) VALUES (?, ?, ?, ?, ?, ?)",
      [mediaId, userId, String(content).trim().substring(0, 1000), parent_comment_id || null, mentioned_user_id || null, mentioned_user_name || null]
    );

    const [[comment]] = await pool.query(
      `SELECT mc.id, mc.content, mc.created_at, mc.parent_comment_id,
              mc.mentioned_user_id, mc.mentioned_user_name,
              u.id AS user_id, u.first_name, u.last_name, u.profile_picture,
              0 AS like_count
       FROM media_comments mc
       JOIN users u ON u.id = mc.user_id
       WHERE mc.id = ?`,
      [result.insertId]
    );

    // Create mention notification
    if (mentioned_user_id && Number(mentioned_user_id) !== userId) {
      try {
        const [[mentioner]] = await pool.query("SELECT first_name, last_name FROM users WHERE id = ?", [userId]);
        const [[media]] = await pool.query("SELECT bar_id FROM bar_videos WHERE id = ?", [mediaId]);
        const [[bar]] = await pool.query("SELECT id, name FROM bars WHERE id = ?", [media?.bar_id]);
        const commenterName = mentioner ? `${mentioner.first_name} ${mentioner.last_name}` : "Someone";
        const barName = bar?.name || "a bar";
        const barId = bar?.id || media?.bar_id;
        const commentId = result.insertId;

        const metadata = JSON.stringify({ bar_id: barId, media_id: mediaId, comment_id: commentId });
        const targetRoute = `/bars/${barId}?media=${mediaId}&bar=${barId}&comment=${commentId}`;

        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type, target_route, metadata, is_read)
           VALUES (?, 'mention', 'You were mentioned', ?, ?, 'media_comment', ?, ?, 0)`,
          [
            mentioned_user_id,
            `${commenterName} mentioned you in a comment on ${barName}`,
            commentId,
            targetRoute,
            metadata,
          ]
        );
      } catch (notifErr) {
        console.error("MENTION NOTIFICATION ERROR:", notifErr);
      }
    }

    return res.json({ success: true, data: { ...comment, liked_by_user: false } });
  } catch (err) {
    console.error("MEDIA COMMENT POST ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── POST /media/comments/:commentId/like — toggle like on a comment ───
router.post("/comments/:commentId/like", requireAuth, async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const userId = req.user.id;
    if (!commentId) return res.status(400).json({ success: false, message: "Invalid comment ID" });

    const [[existing]] = await pool.query(
      "SELECT id FROM media_comment_likes WHERE comment_id = ? AND user_id = ? LIMIT 1",
      [commentId, userId]
    );

    if (existing) {
      await pool.query("DELETE FROM media_comment_likes WHERE id = ?", [existing.id]);
    } else {
      await pool.query(
        "INSERT INTO media_comment_likes (comment_id, user_id) VALUES (?, ?)",
        [commentId, userId]
      );
    }

    const [[count]] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM media_comment_likes WHERE comment_id = ?", [commentId]
    );

    return res.json({
      success: true,
      data: { liked: !existing, like_count: count.cnt },
    });
  } catch (err) {
    console.error("COMMENT LIKE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── DELETE /media/:mediaId/comments/:commentId — delete own comment (or owner/admin) ───
router.delete("/:mediaId/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const userId = req.user.id;
    const role = String(req.user.role || req.user.role_name || "").toLowerCase();

    const [[existing]] = await pool.query(
      "SELECT id, user_id FROM media_comments WHERE id = ? AND media_id = ? LIMIT 1",
      [commentId, req.params.mediaId]
    );
    if (!existing) return res.status(404).json({ success: false, message: "Comment not found" });

    // Allow if: own comment, or bar_owner of the bar, or super_admin
    const isOwner = existing.user_id === userId;
    let isBarOwnerOrAdmin = false;
    if (role === "bar_owner" || role === "super_admin") {
      // Verify bar ownership
      const [[media]] = await pool.query("SELECT bar_id FROM bar_videos WHERE id = ?", [req.params.mediaId]);
      if (media) {
        if (role === "super_admin") {
          isBarOwnerOrAdmin = true;
        } else {
          const [[barOwner]] = await pool.query(
            "SELECT bo.id FROM bar_owners bo JOIN bars b ON b.owner_id = bo.id WHERE bo.user_id = ? AND b.id = ? LIMIT 1",
            [userId, media.bar_id]
          );
          isBarOwnerOrAdmin = Boolean(barOwner);
        }
      }
    }

    if (!isOwner && !isBarOwnerOrAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await pool.query("DELETE FROM media_comment_likes WHERE comment_id = ?", [commentId]);
    await pool.query("DELETE FROM media_comments WHERE id = ?", [commentId]);
    return res.json({ success: true });
  } catch (err) {
    console.error("MEDIA COMMENT DELETE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PATCH /media/comments/:commentId/hide — toggle hidden flag (owner/admin only) ───
router.patch("/comments/:commentId/hide", requireAuth, async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const userId = req.user.id;
    const role = String(req.user.role || req.user.role_name || "").toLowerCase();

    const [[existing]] = await pool.query(
      "SELECT mc.id, mc.media_id, mc.is_hidden FROM media_comments mc WHERE mc.id = ? LIMIT 1",
      [commentId]
    );
    if (!existing) return res.status(404).json({ success: false, message: "Comment not found" });

    // Verify bar ownership
    const [[media]] = await pool.query("SELECT bar_id FROM bar_videos WHERE id = ?", [existing.media_id]);
    if (!media) return res.status(404).json({ success: false, message: "Media not found" });

    if (role !== "super_admin") {
      const [[barOwner]] = await pool.query(
        "SELECT bo.id FROM bar_owners bo JOIN bars b ON b.owner_id = bo.id WHERE bo.user_id = ? AND b.id = ? LIMIT 1",
        [userId, media.bar_id]
      );
      if (!barOwner) return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const newHidden = existing.is_hidden ? 0 : 1;
    await pool.query("UPDATE media_comments SET is_hidden = ?, updated_at = NOW() WHERE id = ?", [newHidden, commentId]);

    return res.json({ success: true, data: { is_hidden: newHidden } });
  } catch (err) {
    console.error("COMMENT HIDE ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ─── PATCH /media/comments/:commentId/report — flag comment as reported (owner/admin only) ───
router.patch("/comments/:commentId/report", requireAuth, async (req, res) => {
  try {
    const commentId = Number(req.params.commentId);
    const userId = req.user.id;
    const role = String(req.user.role || req.user.role_name || "").toLowerCase();

    const [[existing]] = await pool.query(
      "SELECT mc.id, mc.media_id, mc.reported FROM media_comments mc WHERE mc.id = ? LIMIT 1",
      [commentId]
    );
    if (!existing) return res.status(404).json({ success: false, message: "Comment not found" });

    const [[media]] = await pool.query("SELECT bar_id FROM bar_videos WHERE id = ?", [existing.media_id]);
    if (!media) return res.status(404).json({ success: false, message: "Media not found" });

    if (role !== "super_admin") {
      const [[barOwner]] = await pool.query(
        "SELECT bo.id FROM bar_owners bo JOIN bars b ON b.owner_id = bo.id WHERE bo.user_id = ? AND b.id = ? LIMIT 1",
        [userId, media.bar_id]
      );
      if (!barOwner) return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const newReported = existing.reported ? 0 : 1;
    await pool.query("UPDATE media_comments SET reported = ?, updated_at = NOW() WHERE id = ?", [newReported, commentId]);

    return res.json({ success: true, data: { reported: newReported } });
  } catch (err) {
    console.error("COMMENT REPORT ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
