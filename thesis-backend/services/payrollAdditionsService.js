const leaveSvc = require("./leaveBalanceService");

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// An approved leave-to-cash conversion becomes an earning line on the payroll
// item of the run whose period covers the approval date. If no run covers it
// yet the conversion stays pending and is folded in when the run is generated.

async function attachAddition(conn, { conversion, payrollItemId, payrollRunId, hoursPerDay }) {
  const days = Number(conversion.days || 0);
  const dailyRate = Number(conversion.daily_rate || 0);
  const amount = Number(conversion.amount || 0);
  const hours = round2(days * hoursPerDay);
  const hourlyRate = dailyRate > 0 ? round2(dailyRate / hoursPerDay) : 0;
  const label = "Sick Leave Conversion";
  const basis = `${days} day(s) × PHP ${dailyRate.toFixed(2)} = PHP ${amount.toFixed(2)} (${hours} hrs @ PHP ${hourlyRate.toFixed(2)}/hr)`;

  await conn.query(
    `INSERT INTO payroll_addition_items
       (payroll_item_id, leave_conversion_id, label, days, hours, daily_rate, hourly_rate,
        amount, computation_basis, approved_by, approved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
    [payrollItemId, conversion.id, label, days, hours, dailyRate, hourlyRate,
      amount, basis, conversion.decided_by || null, conversion.decided_at || null]
  );

  const [[item]] = await conn.query(
    "SELECT additions, gross_pay, adjusted_gross_pay, net_pay FROM payroll_items WHERE id = ? LIMIT 1 FOR UPDATE",
    [payrollItemId]
  );
  if (!item) return null;
  const gross = round2(Number(item.gross_pay || 0) + amount);
  const adjusted = item.adjusted_gross_pay === null || item.adjusted_gross_pay === undefined
    ? gross
    : round2(Number(item.adjusted_gross_pay) + amount);
  const net = round2(Number(item.net_pay || 0) + amount);
  await conn.query(
    "UPDATE payroll_items SET additions = ?, gross_pay = ?, adjusted_gross_pay = ?, net_pay = ? WHERE id = ?",
    [round2(Number(item.additions || 0) + amount), gross, adjusted, net, payrollItemId]
  );

  await conn.query(
    "UPDATE leave_cash_conversions SET payroll_run_id = ?, payroll_item_id = ?, applied_at = NOW() WHERE id = ?",
    [payrollRunId, payrollItemId, conversion.id]
  );

  return { run_id: payrollRunId, item_id: payrollItemId, amount, hours, days };
}

async function applyPendingForRun(conn, { barId, runId, periodStart, periodEnd }) {
  const hoursPerDay = await leaveSvc.hoursPerDay(conn, barId);
  const [pending] = await conn.query(
    `SELECT c.id, c.employee_user_id, c.days, c.daily_rate, c.amount, c.decided_by, c.decided_at,
            pi.id AS payroll_item_id
     FROM leave_cash_conversions c
     JOIN payroll_items pi ON pi.user_id = c.employee_user_id AND pi.payroll_run_id = ?
     WHERE c.bar_id = ?
       AND c.status = 'approved'
       AND c.payroll_item_id IS NULL
       AND c.decided_at IS NOT NULL
       AND DATE(c.decided_at) BETWEEN ? AND ?
     ORDER BY c.id ASC`,
    [runId, barId, periodStart, periodEnd]
  );

  const applied = [];
  for (const conversion of pending) {
    const result = await attachAddition(conn, {
      conversion,
      payrollItemId: conversion.payroll_item_id,
      payrollRunId: runId,
      hoursPerDay,
    });
    if (result) applied.push({ conversion_id: conversion.id, ...result });
  }
  return applied;
}

async function applyToDraftRun(conn, { barId, userId, conversion }) {
  const [runs] = await conn.query(
    `SELECT pr.id AS run_id, pi.id AS payroll_item_id
     FROM payroll_runs pr
     JOIN payroll_items pi ON pi.payroll_run_id = pr.id AND pi.user_id = ?
     WHERE pr.bar_id = ?
       AND pr.status = 'draft'
       AND pr.period_start IS NOT NULL AND pr.period_end IS NOT NULL
       AND DATE(?) BETWEEN pr.period_start AND pr.period_end
     ORDER BY pr.id DESC
     LIMIT 1`,
    [userId, barId, conversion.decided_at]
  );
  if (!runs.length) return { applied: false };

  const hoursPerDay = await leaveSvc.hoursPerDay(conn, barId);
  const result = await attachAddition(conn, {
    conversion,
    payrollItemId: runs[0].payroll_item_id,
    payrollRunId: runs[0].run_id,
    hoursPerDay,
  });
  return result ? { applied: true, ...result } : { applied: false };
}

// Conversions go back to "approved but not yet paid" when their run is
// regenerated or cancelled, so a later generate picks them up exactly once.
async function releaseForRun(conn, runId) {
  const [rows] = await conn.query(
    "SELECT id FROM payroll_items WHERE payroll_run_id = ?",
    [runId]
  );
  if (rows.length) {
    await conn.query(
      "DELETE FROM payroll_addition_items WHERE payroll_item_id IN (?)",
      [rows.map((r) => r.id)]
    );
  }
  const [released] = await conn.query(
    `UPDATE leave_cash_conversions
     SET payroll_item_id = NULL, payroll_run_id = NULL, applied_at = NULL
     WHERE payroll_run_id = ?`,
    [runId]
  );
  return released.affectedRows;
}

async function attachAdditionItems(pool, items) {
  if (!items.length) return items;
  const ids = items.map((item) => item.id);
  const [additions] = await pool.query(
    `SELECT payroll_item_id, leave_conversion_id, label, days, hours, daily_rate, hourly_rate,
            amount, computation_basis, approved_by, approved_at
     FROM payroll_addition_items
     WHERE payroll_item_id IN (?)
     ORDER BY id ASC`,
    [ids]
  );
  const byItem = new Map();
  for (const addition of additions) {
    const list = byItem.get(addition.payroll_item_id) || [];
    list.push(addition);
    byItem.set(addition.payroll_item_id, list);
  }
  for (const item of items) {
    if (item.additions === undefined || item.additions === null) item.additions = 0;
    item.addition_items = byItem.get(item.id) || [];
  }
  return items;
}

module.exports = {
  applyPendingForRun,
  applyToDraftRun,
  releaseForRun,
  attachAdditionItems,
};
