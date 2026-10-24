'use strict';
/**
 * middleware/requireApprovedCustomer.js
 * Rejects non-approved customers with 403 { code: "ID_NOT_APPROVED" }.
 * Allows super_admin, bar_owner, staff, and approved customers.
 */
const pool = require('../config/database');

module.exports = async function requireApprovedCustomer(req, res, next) {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const [rows] = await pool.query(
      'SELECT role, id_verification_status, is_verified FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];
    const role = String(user.role || '').toLowerCase();

    // Non-customer roles (admin, bar owner, staff) are always allowed
    if (role !== 'customer') {
      return next();
    }

    // Customer must be approved
    if (user.id_verification_status !== 'approved') {
      let message = 'Your ID verification is pending review.';
      let code = 'ID_NOT_APPROVED';

      if (user.id_verification_status === 'email_unverified' || !user.is_verified) {
        message = 'Please verify your email first.';
        code = 'EMAIL_NOT_VERIFIED';
      } else if (user.id_verification_status === 'rejected') {
        message = 'Your ID was rejected. Please resubmit.';
        code = 'ID_REJECTED';
      } else if (user.id_verification_status === 'pending_review') {
        message = 'Your ID is under review. We will email you when it is done.';
        code = 'ID_PENDING_REVIEW';
      }

      return res.status(403).json({
        success: false,
        code,
        message,
        status: user.id_verification_status,
      });
    }

    next();
  } catch (err) {
    console.error('requireApprovedCustomer error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};