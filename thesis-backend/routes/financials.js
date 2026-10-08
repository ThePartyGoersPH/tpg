const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const requireAuth = require("../middlewares/requireAuth");
const requirePermission = require("../middlewares/requirePermission");
const platformSettings = require("../services/platformSettingsService");

// Settled POS sales land in either 'completed' (cash) or 'paid' (digital).
// Filtering on a single status silently dropped digital revenue.
const SETTLED_POS_STATUSES = "('completed', 'paid')";

// ═══════════════════════════════════════════════════
// AUTO PAYOUT COMPUTATION
// ═══════════════════════════════════════════════════

/**
 * GET /owner/financials/auto-payout
 * Compute real-time earnings: total sales, platform fees, net earnings
 */
router.get(
  "/auto-payout",
  requireAuth,
  requirePermission("financials_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const { from, to } = req.query;
      
      const platformFeePercent = await platformSettings.getPlatformFeePercentage(pool);

      // Build date filter
      let dateFilter = "";
      const params = [barId];
      if (from) {
        dateFilter += " AND DATE(created_at) >= ?";
        params.push(from);
      }
      if (to) {
        dateFilter += " AND DATE(created_at) <= ?";
        params.push(to);
      }

      // Get all settled POS orders
      const [posOrders] = await pool.query(
        `SELECT 
           COUNT(*) as order_count,
           COALESCE(SUM(total_amount), 0) as total_sales,
           COALESCE(SUM(CASE WHEN payment_method <> 'cash' THEN total_amount ELSE 0 END), 0) as online_sales
         FROM pos_orders
         WHERE bar_id = ? AND status IN ${SETTLED_POS_STATUSES} ${dateFilter}`,
        params
      );

      // Get reservation payments (if payment_transactions table exists)
      const [reservationPayments] = await pool.query(
        `SELECT 
           COALESCE(SUM(amount), 0) as total_reservations
         FROM payment_transactions
         WHERE bar_id = ? AND status = 'paid' AND payment_type = 'reservation' ${dateFilter}`,
        params
      ).catch(() => [[{ total_reservations: 0 }]]);

      const totalSales = parseFloat(posOrders[0]?.total_sales || 0);
      const totalReservations = parseFloat(reservationPayments[0]?.total_reservations || 0);
      const grossRevenue = totalSales + totalReservations;
      const onlineSales = parseFloat(posOrders[0]?.online_sales || 0);

      // Platform fee actually booked to the platform, taken from the payout
      // ledger. Recomputing it as a percentage of gross revenue charged the fee
      // on in-store cash and on POS digital sales, neither of which ever
      // produces a payout.
      const [feeRows] = await pool.query(
        `SELECT COALESCE(SUM(platform_fee_amount), 0) as booked_fee,
                COUNT(*) as payout_count
         FROM payouts
         WHERE bar_id = ? ${dateFilter}`,
        params
      );
      const platformFeeAmount = parseFloat(feeRows[0]?.booked_fee || 0);
      const estimatedFeeAmount = ((onlineSales + totalReservations) * platformFeePercent) / 100;
      const netEarnings = grossRevenue - platformFeeAmount;

      return res.json({
        success: true,
        data: {
          total_sales: totalSales,
          total_reservations: totalReservations,
          gross_revenue: grossRevenue,
          cash_sales: Math.max(0, totalSales - onlineSales),
          online_sales: onlineSales,
          platform_fee_percentage: platformFeePercent,
          platform_fee_amount: platformFeeAmount,
          platform_fee_estimated: estimatedFeeAmount,
          payout_count: parseInt(feeRows[0]?.payout_count || 0),
          net_earnings: netEarnings,
          order_count: parseInt(posOrders[0]?.order_count || 0),
          date_range: {
            from: from || null,
            to: to || null,
          },
        },
      });
    } catch (err) {
      console.error("AUTO PAYOUT ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// CASHFLOW DASHBOARD
// ═══════════════════════════════════════════════════

/**
 * GET /owner/financials/cashflow
 * Full financial overview: income, expenses, profit, payouts
 */
router.get(
  "/cashflow",
  requireAuth,
  requirePermission("financials_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const { from, to } = req.query;
      
      let dateFilter = "";
      const params = [barId];
      if (from) {
        dateFilter += " AND DATE(created_at) >= ?";
        params.push(from);
      }
      if (to) {
        dateFilter += " AND DATE(created_at) <= ?";
        params.push(to);
      }

      // --- INCOME ---
      // POS Orders (cash lands in 'completed', digital in 'paid')
      const [posIncome] = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) as pos_revenue,
                COALESCE(SUM(CASE WHEN payment_method <> 'cash' THEN total_amount ELSE 0 END), 0) as pos_online_revenue
         FROM pos_orders
         WHERE bar_id = ? AND status IN ${SETTLED_POS_STATUSES} ${dateFilter}`,
        params
      );

      // Reservations
      const [reservationIncome] = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as reservation_revenue
         FROM payment_transactions
         WHERE bar_id = ? AND status = 'paid' AND payment_type = 'reservation' ${dateFilter}`,
        params
      ).catch(() => [[{ reservation_revenue: 0 }]]);

      const posRevenue = parseFloat(posIncome[0]?.pos_revenue || 0);
      const posOnlineRevenue = parseFloat(posIncome[0]?.pos_online_revenue || 0);
      const totalIncome = posRevenue + 
                          parseFloat(reservationIncome[0]?.reservation_revenue || 0);

      // --- EXPENSES ---
      // Payroll (only finance-approved / released payroll runs — HR↔Finance bridge gate)
      const payrollDateFilter = dateFilter.replace(/created_at/g, 'pr.finalized_at');
      const [payrollExpenses] = await pool.query(
        `SELECT COALESCE(SUM(pi.net_pay), 0) as payroll_total
         FROM payroll_items pi
         JOIN payroll_runs pr ON pr.id = pi.payroll_run_id
         WHERE pi.bar_id = ? AND pr.status = 'approved' ${payrollDateFilter}`,
        params
      ).catch(() => [[{ payroll_total: 0 }]]);

      // Inventory costs (total current stock value)
      const [inventoryCosts] = await pool.query(
        `SELECT COALESCE(SUM(cost_price * stock_qty), 0) as inventory_cost
         FROM inventory_items
         WHERE bar_id = ? AND is_active = 1`,
        [barId]
      ).catch(() => [[{ inventory_cost: 0 }]]);

      const totalExpenses = parseFloat(payrollExpenses[0]?.payroll_total || 0) + 
                            parseFloat(inventoryCosts[0]?.inventory_cost || 0);

      // --- PLATFORM FEES ---
      // Taken from the payout ledger, not recomputed as a percentage of gross
      // revenue: in-store cash and POS digital sales never produce a payout, so
      // charging them a fee reported money the platform never collected.
      const platformFeePercent = await platformSettings.getPlatformFeePercentage(pool);
      const feeBearingIncome = posOnlineRevenue + parseFloat(reservationIncome[0]?.reservation_revenue || 0);
      const estimatedPlatformFeeAmount = (feeBearingIncome * platformFeePercent) / 100;

      // --- PAYOUTS ---
      const [payouts] = await pool.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN status = 'completed' THEN net_amount ELSE 0 END), 0) as payouts_released,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END), 0) as payouts_pending,
           COALESCE(SUM(CASE WHEN status = 'processing' THEN net_amount ELSE 0 END), 0) as payouts_processing,
           COALESCE(SUM(platform_fee_amount), 0) as platform_fees_booked
         FROM payouts
         WHERE bar_id = ? ${dateFilter}`,
        params
      );

      const platformFeeAmount = parseFloat(payouts[0]?.platform_fees_booked || 0);

      // --- NET PROFIT ---
      const netProfit = totalIncome - totalExpenses - platformFeeAmount;

      return res.json({
        success: true,
        data: {
          income: {
            pos_revenue: posRevenue,
            pos_online_revenue: posOnlineRevenue,
            reservation_revenue: parseFloat(reservationIncome[0]?.reservation_revenue || 0),
            total: totalIncome,
          },
          expenses: {
            payroll: parseFloat(payrollExpenses[0]?.payroll_total || 0),
            inventory: parseFloat(inventoryCosts[0]?.inventory_cost || 0),
            total: totalExpenses,
          },
          platform_fees: {
            percentage: platformFeePercent,
            amount: platformFeeAmount,
            estimated_amount: estimatedPlatformFeeAmount,
          },
          payouts: {
            released: parseFloat(payouts[0]?.payouts_released || 0),
            pending: parseFloat(payouts[0]?.payouts_pending || 0),
            processing: parseFloat(payouts[0]?.payouts_processing || 0),
            total: parseFloat(payouts[0]?.payouts_released || 0) + 
                   parseFloat(payouts[0]?.payouts_pending || 0) + 
                   parseFloat(payouts[0]?.payouts_processing || 0),
          },
          net_profit: netProfit,
          date_range: {
            from: from || null,
            to: to || null,
          },
        },
      });
    } catch (err) {
      console.error("CASHFLOW DASHBOARD ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// DAILY/MONTHLY TRENDS
// ═══════════════════════════════════════════════════

/**
 * GET /owner/financials/trends
 * Daily sales, monthly income, reservation trends
 */
router.get(
  "/trends",
  requireAuth,
  requirePermission("financials_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const { period = '30days' } = req.query;

      let dateCondition = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
      let groupBy = "DATE(created_at)";
      
      if (period === '12months') {
        dateCondition = "DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)";
        groupBy = "DATE_FORMAT(created_at, '%Y-%m')";
      }

      // Daily/Monthly sales
      const [salesTrend] = await pool.query(
        `SELECT 
           ${groupBy} as period,
           COUNT(*) as order_count,
           COALESCE(SUM(total_amount), 0) as revenue
         FROM pos_orders
         WHERE bar_id = ? AND status IN ${SETTLED_POS_STATUSES} AND ${dateCondition}
         GROUP BY ${groupBy}
         ORDER BY period ASC`,
        [barId]
      );

      // Reservation trends
      const [reservationTrend] = await pool.query(
        `SELECT 
           ${groupBy} as period,
           COUNT(*) as reservation_count
         FROM reservations
         WHERE bar_id = ? AND status IN ('approved', 'completed') AND ${dateCondition}
         GROUP BY ${groupBy}
         ORDER BY period ASC`,
        [barId]
      ).catch(() => [[]]);

      return res.json({
        success: true,
        data: {
          sales_trend: salesTrend,
          reservation_trend: reservationTrend,
          period: period,
        },
      });
    } catch (err) {
      console.error("FINANCIAL TRENDS ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// ═══════════════════════════════════════════════════
// PAYOUTS LIST
// ═══════════════════════════════════════════════════

/**
 * GET /owner/financials/payouts
 * Returns payout records for this bar with summary totals
 */
router.get(
  "/payouts",
  requireAuth,
  requirePermission("financials_view"),
  async (req, res) => {
    try {
      const barId = req.user.bar_id;
      if (!barId) return res.status(400).json({ success: false, message: "No bar_id on account" });

      const { status, from, to, limit = 100 } = req.query;

      let where = "WHERE p.bar_id = ?";
      const params = [barId];

      if (status) {
        where += " AND p.status = ?";
        params.push(status);
      }
      if (from) {
        where += " AND DATE(p.created_at) >= ?";
        params.push(from);
      }
      if (to) {
        where += " AND DATE(p.created_at) <= ?";
        params.push(to);
      }

      const [payouts] = await pool.query(
        `SELECT p.id, p.gross_amount, p.platform_fee, p.platform_fee_amount, p.net_amount,
                p.status, p.payout_method, p.payout_reference, p.gcash_number, p.gcash_account_name,
                p.processed_at, p.notes, p.created_at,
                r.transaction_number AS reservation_txn,
                r.reservation_date
         FROM payouts p
         LEFT JOIN reservations r ON r.id = p.reservation_id
         ${where}
         ORDER BY p.created_at DESC
         LIMIT ?`,
        [...params, Number(limit)]
      );

      const [summary] = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN status = 'pending'    THEN net_amount ELSE 0 END), 0) AS pending,
           COALESCE(SUM(CASE WHEN status = 'processing' THEN net_amount ELSE 0 END), 0) AS processing,
           COALESCE(SUM(CASE WHEN status IN ('sent','completed') THEN net_amount ELSE 0 END), 0) AS paid_out,
           COALESCE(SUM(net_amount), 0) AS total
         FROM payouts
         WHERE bar_id = ?`,
        [barId]
      );

      return res.json({ success: true, data: { payouts, summary: summary[0] } });
    } catch (err) {
      console.error("PAYOUTS LIST ERROR:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
