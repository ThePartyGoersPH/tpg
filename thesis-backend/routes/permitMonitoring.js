const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const requireAuth = require('../middlewares/requireAuth');
const requirePermitAccess = require('../middlewares/requirePermitAccess');
const { logAudit } = require('../utils/audit');
const { runPermitExpiryCheck } = require('../jobs/permitExpiryChecker');
const { createNotification } = require('../utils/notificationService');
const { resolveComplianceDocuments, documentCounts } = require('../utils/complianceDocuments');

/**
 * GET /permit-monitoring/expiring
 * Get bars with expired or soon-to-expire permits AND/OR incomplete required
 * documents. Document status is resolved through utils/complianceDocuments.js
 * — the exact source the Bar Registration record and Super Admin's Permit
 * Checking panel use, so this page can never disagree with them.
 * Super admins see all bars; bar owners see only their own bar.
 */
router.get('/expiring', requireAuth, requirePermitAccess, async (req, res) => {
  try {
    const { status, limit = 100, page = 1 } = req.query;

    // Candidates: anything with a permit expiry date, plus every bar that is
    // not fully compliant yet (so a bar missing documents is never invisible
    // here just because its expiry date happens to be unset).
    let whereClause = `WHERE (b.permit_expiry_date IS NOT NULL
                          OR IFNULL(b.compliance_status, 'incomplete') <> 'approved')`;
    const params = [];

    // Bar owner scoping: only show their own bar
    if (!req.isSuperAdmin) {
      whereClause += ` AND b.id = ?`;
      params.push(req.user.bar_id);
    }

    const [rows] = await pool.query(
      `SELECT 
        b.id,
        b.name,
        b.address,
        b.city,
        b.permit_expiry_date,
        b.permit_status,
        b.permit_expiry_notified_at,
        b.permit_expired_flagged_at,
        b.compliance_status,
        b.status as bar_status,
        u.id as owner_id,
        u.email as owner_email,
        u.first_name as owner_first_name,
        u.last_name as owner_last_name,
        DATEDIFF(b.permit_expiry_date, CURDATE()) as days_until_expiry,
        (SELECT COUNT(*) FROM permit_expiry_notifications 
         WHERE bar_id = b.id AND notification_type = '30_day_warning') as warning_count
       FROM bars b
       LEFT JOIN bar_owners bo ON b.owner_id = bo.id
       LEFT JOIN users u ON bo.user_id = u.id
       ${whereClause}
       LIMIT 500`,
      params
    );

    // Real-time document status from the shared registration/document records.
    const enriched = await Promise.all(rows.map(async (bar) => {
      const documents = await resolveComplianceDocuments(bar.id, bar.owner_email, bar.name);
      const counts = documentCounts(documents);
      return {
        ...bar,
        documents_uploaded: counts.uploaded,
        documents_required: counts.required,
        documents_complete: counts.complete,
        documents_missing: documents.filter((document) => !document.uploaded).map((document) => document.label),
      };
    }));

    const expiryIssue = (bar) => bar.permit_status === 'expiring_soon' || bar.permit_status === 'expired';
    const documentIssue = (bar) => !bar.documents_complete;

    let filtered;
    if (status === 'all') {
      // Every candidate bar, issue or not.
      filtered = enriched;
    } else if (status === 'documents') {
      filtered = enriched.filter(documentIssue);
    } else if (status && ['valid', 'expiring_soon', 'expired'].includes(status)) {
      filtered = enriched.filter((bar) => bar.permit_status === status);
    } else {
      // Default view: every bar with an expiry OR document issue.
      filtered = enriched.filter((bar) => expiryIssue(bar) || documentIssue(bar));
    }

    // Missing documents first, then earliest expiry (bars without a date last).
    filtered.sort((a, b) =>
      Number(a.documents_complete) - Number(b.documents_complete) ||
      (a.days_until_expiry == null ? Number.MAX_SAFE_INTEGER : a.days_until_expiry) -
      (b.days_until_expiry == null ? Number.MAX_SAFE_INTEGER : b.days_until_expiry)
    );

    const total = filtered.length;
    const safeLimit = Math.min(Number(limit) || 100, 500);
    const safePage = Math.max(1, Number(page) || 1);
    const bars = filtered.slice((safePage - 1) * safeLimit, (safePage - 1) * safeLimit + safeLimit);

    return res.json({
      success: true,
      data: {
        bars,
        pagination: {
          total,
          page: safePage,
          limit: safeLimit,
          totalPages: Math.ceil(total / safeLimit) || 1
        }
      }
    });
  } catch (err) {
    console.error('GET /permit-monitoring/expiring error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /permit-monitoring/stats
 * Get permit expiry statistics.
 * Super admins see platform-wide stats; bar owners see stats for their bar only.
 */
router.get('/stats', requireAuth, requirePermitAccess, async (req, res) => {
  try {
    let barFilter = '';
    const params = [];

    if (!req.isSuperAdmin) {
      barFilter = 'WHERE id = ?';
      params.push(req.user.bar_id);
    }

    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_bars,
        SUM(CASE WHEN permit_status = 'valid' THEN 1 ELSE 0 END) as valid_permits,
        SUM(CASE WHEN permit_status = 'expiring_soon' THEN 1 ELSE 0 END) as expiring_soon,
        SUM(CASE WHEN permit_status = 'expired' THEN 1 ELSE 0 END) as expired_permits,
        SUM(CASE WHEN permit_expiry_date IS NULL THEN 1 ELSE 0 END) as no_expiry_date
      FROM bars ${barFilter}
    `, params);

    let notifFilter = '';
    const notifParams = [];
    if (!req.isSuperAdmin) {
      notifFilter = 'WHERE bar_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
      notifParams.push(req.user.bar_id);
    } else {
      notifFilter = 'WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    const [recentNotifications] = await pool.query(`
      SELECT 
        notification_type,
        COUNT(*) as count
      FROM permit_expiry_notifications
      ${notifFilter}
      GROUP BY notification_type
    `, notifParams);

    return res.json({
      success: true,
      data: {
        overview: stats[0],
        recentNotifications
      }
    });
  } catch (err) {
    console.error('GET /permit-monitoring/stats error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * POST /permit-monitoring/deactivate/:barId
 * Manually deactivate a bar due to expired permit.
 * Bar owners can only deactivate their own bar.
 */
router.post('/deactivate/:barId', requireAuth, requirePermitAccess, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { barId } = req.params;
    const { reason } = req.body;

    // Bar owner scoping: can only deactivate their own bar
    if (!req.isSuperAdmin && String(req.user.bar_id) !== String(barId)) {
      return res.status(403).json({ success: false, message: 'You can only manage your own bar' });
    }

    await conn.beginTransaction();

    const [bars] = await conn.query(
      'SELECT id, name, status, permit_status FROM bars WHERE id = ?',
      [barId]
    );

    if (bars.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Bar not found' });
    }

    const bar = bars[0];

    await conn.query(
      `UPDATE bars SET status = 'inactive' WHERE id = ?`,
      [barId]
    );

    await logAudit(
      barId, req.user.id, 'DEACTIVATE_BAR_EXPIRED_PERMIT', 'bars', barId,
      { reason: reason || 'Expired business permit', permit_status: bar.permit_status, previous_status: bar.status }
    );

    await conn.commit();

    try {
      const [[owner]] = await conn.query(
        "SELECT bo.user_id FROM bar_owners bo WHERE bo.id = (SELECT owner_id FROM bars WHERE id = ?)",
        [barId]
      );
      if (owner?.user_id) {
        await createNotification({
          userIds: owner.user_id,
          type: "permit_expired",
          title: "Bar Deactivated — Permit Expired",
          message: `Your bar "${bar.name}" was deactivated because its business permit expired. Renew the permit to reactivate.`,
          referenceType: "bar", referenceId: Number(barId),
          category: "compliance", action: "navigate", targetRoute: "/bar-management",
        });
      }
    } catch (e) {
      console.error("permit deactivate owner notification failed:", e.message);
    }

    return res.json({ success: true, message: `Bar "${bar.name}" has been deactivated due to expired permit` });
  } catch (err) {
    await conn.rollback();
    console.error('POST /permit-monitoring/deactivate error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
});

/**
 * POST /permit-monitoring/reactivate/:barId
 * Reactivate a bar after permit renewal.
 * Bar owners can only reactivate their own bar.
 */
router.post('/reactivate/:barId', requireAuth, requirePermitAccess, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { barId } = req.params;
    const { newExpiryDate } = req.body;

    if (!newExpiryDate) {
      return res.status(400).json({ success: false, message: 'New expiry date is required' });
    }

    // Bar owner scoping
    if (!req.isSuperAdmin && String(req.user.bar_id) !== String(barId)) {
      return res.status(403).json({ success: false, message: 'You can only manage your own bar' });
    }

    await conn.beginTransaction();

    const [bars] = await conn.query('SELECT id, name, status FROM bars WHERE id = ?', [barId]);
    if (bars.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Bar not found' });
    }

    const bar = bars[0];

    // `status` is CASE'd so a bar that is still `pending` (approved but not
    // yet through the PayMongo setup gate in services/barActivation.js) is
    // never quietly promoted to `active` by a permit renewal.
    await conn.query(
      `UPDATE bars SET status = CASE WHEN status = 'pending' THEN 'pending' ELSE 'active' END,
         permit_status = 'valid',
         permit_expiry_date = ?, permit_expired_flagged_at = NULL, permit_expiry_notified_at = NULL
       WHERE id = ?`,
      [newExpiryDate, barId]
    );

    await logAudit(barId, req.user.id, 'REACTIVATE_BAR_PERMIT_RENEWED', 'bars', barId,
      { new_expiry_date: newExpiryDate, previous_status: bar.status });

    await conn.commit();

    // A `pending` bar keeps its status, so don't tell the owner it went live.
    const actuallyReactivated = String(bar.status || '').toLowerCase() !== 'pending';

    try {
      const [[owner]] = await conn.query(
        "SELECT bo.user_id FROM bar_owners bo WHERE bo.id = (SELECT owner_id FROM bars WHERE id = ?)",
        [barId]
      );
      if (owner?.user_id && actuallyReactivated) {
        await createNotification({
          userIds: owner.user_id,
          type: "permit_expiry_warning",
          title: "Bar Reactivated — Permit Renewed",
          message: `Your bar "${bar.name}" has been reactivated. New permit expiry: ${newExpiryDate}.`,
          referenceType: "bar", referenceId: Number(barId),
          category: "compliance", action: "navigate", targetRoute: "/bar-management",
        });
      }
    } catch (e) {
      console.error("permit reactivate owner notification failed:", e.message);
    }

    return res.json({
      success: true,
      message: actuallyReactivated
        ? `Bar "${bar.name}" has been reactivated with new permit expiry date`
        : `Permit renewed for "${bar.name}" — the bar stays pending until its payment setup is complete`,
    });
  } catch (err) {
    await conn.rollback();
    console.error('POST /permit-monitoring/reactivate error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
});

/**
 * POST /permit-monitoring/run-check
 * Manually trigger permit expiry check. Available to both roles.
 */
router.post('/run-check', requireAuth, requirePermitAccess, async (req, res) => {
  try {
    const result = await runPermitExpiryCheck();
    return res.json({ success: true, message: 'Permit expiry check completed', data: result });
  } catch (err) {
    console.error('POST /permit-monitoring/run-check error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET /permit-monitoring/notifications/:barId
 * Get notification history for a specific bar.
 * Bar owners can only view notifications for their own bar.
 */
router.get('/notifications/:barId', requireAuth, requirePermitAccess, async (req, res) => {
  try {
    const { barId } = req.params;

    // Bar owner scoping
    if (!req.isSuperAdmin && String(req.user.bar_id) !== String(barId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [notifications] = await pool.query(
      `SELECT id, notification_type, permit_expiry_date, email_sent, email_sent_at, created_at
       FROM permit_expiry_notifications WHERE bar_id = ? ORDER BY created_at DESC`,
      [barId]
    );

    return res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('GET /permit-monitoring/notifications error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
