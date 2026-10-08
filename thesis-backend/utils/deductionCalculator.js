const pool = require("../config/database");

let lateMinutesColumnPromise = null;

async function getLateMinutesColumn() {
  if (lateMinutesColumnPromise) return lateMinutesColumnPromise;

  lateMinutesColumnPromise = (async () => {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'attendance_logs'
         AND COLUMN_NAME IN ('minutes_late', 'late_minutes')`
    );

    const cols = new Set(rows.map((r) => String(r.COLUMN_NAME || '').toLowerCase()));
    if (cols.has('minutes_late')) return 'minutes_late';
    if (cols.has('late_minutes')) return 'late_minutes';
    return null;
  })().catch((err) => {
    lateMinutesColumnPromise = null;
    throw err;
  });

  return lateMinutesColumnPromise;
}

/**
 * PAYROLL DEDUCTION CALCULATOR
 * 
 * Provides utilities to calculate various payroll deductions:
 * - BIR (Bureau of Internal Revenue) - Withholding tax
 * - SSS (Social Security System) - Monthly contribution
 * - PhilHealth - Monthly health insurance contribution
 * - Late Deduction - Based on tardiness minutes
 */

/**
 * Calculate BIR withholding tax based on annual taxable income
 * Uses progressive tax brackets from bir_tax_brackets table
 * 
 * @param {number} annualTaxableIncome - Annual taxable income
 * @param {number} year - Tax year (default: 2024)
 * @returns {Promise<{tax: number, bracket: object}>}
 */
async function calculateBIRTax(annualTaxableIncome, year = 2024) {
  try {
    const income = Number(annualTaxableIncome);
    
    // Get applicable tax bracket
    const [brackets] = await pool.query(
      `SELECT * FROM bir_tax_brackets 
       WHERE year = ? AND is_active = 1 
         AND min_income <= ?
         AND (max_income IS NULL OR max_income >= ?)
       ORDER BY min_income DESC
       LIMIT 1`,
      [year, income, income]
    );

    if (!brackets.length) {
      // No bracket found, return 0 tax
      return { tax: 0, bracket: null, computation: 'No tax bracket found' };
    }

    const bracket = brackets[0];
    const baseTax = Number(bracket.base_tax);
    const excessRate = Number(bracket.excess_rate);
    const minIncome = Number(bracket.min_income);

    // Calculate tax: base_tax + (excess over min_income * excess_rate)
    const excess = Math.max(0, income - minIncome);
    const excessTax = excess * excessRate;
    const totalTax = baseTax + excessTax;

    return {
      tax: Math.round(totalTax * 100) / 100, // Round to 2 decimals
      bracket: {
        min_income: bracket.min_income,
        max_income: bracket.max_income,
        base_tax: bracket.base_tax,
        excess_rate: bracket.excess_rate
      },
      computation: `Base: ${baseTax} + (${excess.toFixed(2)} × ${(excessRate * 100).toFixed(2)}%) = ${totalTax.toFixed(2)}`
    };
  } catch (err) {
    console.error("BIR Tax Calculation Error:", err);
    return { tax: 0, bracket: null, computation: 'Error calculating tax' };
  }
}

/**
 * Calculate monthly BIR withholding tax from monthly gross pay
 * 
 * @param {number} monthlyGrossPay - Monthly gross salary
 * @param {string} exemptionStatus - Tax exemption status (S, ME, S1, S2, etc.)
 * @returns {Promise<{monthlyTax: number, annualTax: number, computation: string}>}
 */
async function calculateMonthlyBIRTax(monthlyGrossPay, exemptionStatus = 'S') {
  try {
    const monthlyGross = Number(monthlyGrossPay);
    
    // Annualize the income (monthly × 12)
    const annualGross = monthlyGross * 12;
    
    // Apply exemptions (simplified - adjust based on actual BIR rules)
    const exemptionAmounts = {
      'S': 50000,    // Single
      'ME': 50000,   // Married Employee
      'S1': 75000,   // Single with 1 dependent
      'S2': 100000,  // Single with 2 dependents
      'S3': 125000,  // Single with 3 dependents
      'S4': 150000,  // Single with 4 dependents
      'ME1': 75000,  // Married with 1 dependent
      'ME2': 100000, // Married with 2 dependents
      'ME3': 125000, // Married with 3 dependents
      'ME4': 150000  // Married with 4 dependents
    };
    
    const exemption = exemptionAmounts[exemptionStatus] || 50000;
    const annualTaxableIncome = Math.max(0, annualGross - exemption);
    
    // Calculate annual tax
    const { tax: annualTax, computation } = await calculateBIRTax(annualTaxableIncome);
    
    // Convert to monthly
    const monthlyTax = annualTax / 12;
    
    return {
      monthlyTax: Math.round(monthlyTax * 100) / 100,
      annualTax: Math.round(annualTax * 100) / 100,
      annualGross,
      exemption,
      annualTaxableIncome,
      computation: `Annual Gross: ${annualGross.toFixed(2)} - Exemption: ${exemption.toFixed(2)} = Taxable: ${annualTaxableIncome.toFixed(2)}. ${computation}. Monthly: ${monthlyTax.toFixed(2)}`
    };
  } catch (err) {
    console.error("Monthly BIR Tax Calculation Error:", err);
    return { monthlyTax: 0, annualTax: 0, computation: 'Error' };
  }
}

/**
 * Calculate SSS contribution based on monthly salary
 * 
 * @param {number} monthlySalary - Monthly salary compensation
 * @param {number} year - Contribution year (default: 2024)
 * @returns {Promise<{employeeShare: number, employerShare: number, total: number, computation: string}>}
 */
async function calculateSSSContribution(monthlySalary, year = 2024) {
  try {
    const salary = Number(monthlySalary);
    
    // Get applicable SSS bracket
    const [brackets] = await pool.query(
      `SELECT * FROM sss_contribution_table 
       WHERE year = ? AND is_active = 1 
         AND min_salary <= ?
         AND (max_salary IS NULL OR max_salary >= ?)
       ORDER BY min_salary DESC
       LIMIT 1`,
      [year, salary, salary]
    );

    if (!brackets.length) {
      return { 
        employeeShare: 0, 
        employerShare: 0, 
        total: 0, 
        computation: 'No SSS bracket found for salary: ' + salary 
      };
    }

    const bracket = brackets[0];
    
    return {
      employeeShare: Number(bracket.employee_share),
      employerShare: Number(bracket.employer_share),
      total: Number(bracket.total_contribution),
      bracket: {
        min_salary: bracket.min_salary,
        max_salary: bracket.max_salary
      },
      computation: `Salary: ${salary.toFixed(2)} → Employee: ${bracket.employee_share}, Employer: ${bracket.employer_share}, Total: ${bracket.total_contribution}`
    };
  } catch (err) {
    console.error("SSS Calculation Error:", err);
    return { employeeShare: 0, employerShare: 0, total: 0, computation: 'Error' };
  }
}

/**
 * Calculate PhilHealth contribution based on monthly basic salary
 * 
 * @param {number} monthlyBasicSalary - Monthly basic salary
 * @param {number} year - Contribution year (default: 2024)
 * @returns {Promise<{employeeShare: number, employerShare: number, total: number, computation: string}>}
 */
async function calculatePhilHealthContribution(monthlyBasicSalary, year = 2024) {
  try {
    const salary = Number(monthlyBasicSalary);
    
    // Get applicable PhilHealth bracket
    const [brackets] = await pool.query(
      `SELECT * FROM philhealth_contribution_table 
       WHERE year = ? AND is_active = 1 
         AND min_salary <= ?
         AND (max_salary IS NULL OR max_salary >= ?)
       ORDER BY min_salary DESC
       LIMIT 1`,
      [year, salary, salary]
    );

    if (!brackets.length) {
      return { 
        employeeShare: 0, 
        employerShare: 0, 
        total: 0, 
        computation: 'No PhilHealth bracket found' 
      };
    }

    const bracket = brackets[0];
    const premiumRate = Number(bracket.premium_rate);
    const employeeShareRate = Number(bracket.employee_share_rate);
    
    // Calculate premium (salary × premium_rate)
    let totalPremium = salary * premiumRate;
    
    // Apply min/max caps
    if (bracket.min_contribution && totalPremium < bracket.min_contribution) {
      totalPremium = Number(bracket.min_contribution);
    }
    if (bracket.max_contribution && totalPremium > bracket.max_contribution) {
      totalPremium = Number(bracket.max_contribution);
    }
    
    // Employee pays half (or specified share rate)
    const employeeShare = totalPremium * employeeShareRate;
    const employerShare = totalPremium - employeeShare;
    
    return {
      employeeShare: Math.round(employeeShare * 100) / 100,
      employerShare: Math.round(employerShare * 100) / 100,
      total: Math.round(totalPremium * 100) / 100,
      bracket: {
        min_salary: bracket.min_salary,
        max_salary: bracket.max_salary,
        premium_rate: bracket.premium_rate
      },
      computation: `Salary: ${salary.toFixed(2)} × ${(premiumRate * 100).toFixed(2)}% = ${totalPremium.toFixed(2)} (Employee: ${employeeShare.toFixed(2)}, Employer: ${employerShare.toFixed(2)})`
    };
  } catch (err) {
    console.error("PhilHealth Calculation Error:", err);
    return { employeeShare: 0, employerShare: 0, total: 0, computation: 'Error' };
  }
}

/**
 * Calculate late deduction based on tardiness minutes
 * 
 * @param {number} lateMinutes - Total minutes late
 * @param {number} dailyRate - Employee's daily rate
 * @param {number} workHoursPerDay - Standard work hours per day (default: 8)
 * @returns {number} Deduction amount
 */
function calculateLateDeduction(lateMinutes, dailyRate, workHoursPerDay = 8) {
  try {
    const minutes = Number(lateMinutes);
    const rate = Number(dailyRate);
    const hours = Number(workHoursPerDay);
    
    if (minutes <= 0 || rate <= 0) return 0;
    
    // Calculate hourly rate
    const hourlyRate = rate / hours;
    
    // Calculate minute rate
    const minuteRate = hourlyRate / 60;
    
    // Calculate deduction
    const deduction = minutes * minuteRate;
    
    return Math.round(deduction * 100) / 100;
  } catch (err) {
    console.error("Late Deduction Calculation Error:", err);
    return 0;
  }
}

/**
 * Get total late minutes for an employee in a date range
 * 
 * @param {number} barId - Bar ID
 * @param {number} userId - Employee user ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<{totalMinutes: number, days: number}>}
 */
async function getTotalLateMinutes(barId, userId, startDate, endDate) {
  try {
    const lateCol = await getLateMinutesColumn();
    if (!lateCol) return { totalMinutes: 0, days: 0 };

    const [result] = await pool.query(
      `SELECT 
         SUM(${lateCol}) as total_minutes,
         COUNT(*) as late_days
       FROM attendance_logs
       WHERE bar_id = ? AND employee_user_id = ?
         AND work_date BETWEEN ? AND ?
         AND ${lateCol} > 0`,
      [barId, userId, startDate, endDate]
    );
    
    return {
      totalMinutes: Number(result[0]?.total_minutes || 0),
      days: Number(result[0]?.late_days || 0)
    };
  } catch (err) {
    console.error("Get Late Minutes Error:", err);
    return { totalMinutes: 0, days: 0 };
  }
}

/**
 * Calculate all deductions for an employee
 * 
 * @param {object} params - Calculation parameters
 * @param {number} params.barId - Bar ID
 * @param {number} params.userId - Employee user ID
 * @param {number} params.grossPay - Gross pay for the period
 * @param {number} params.dailyRate - Daily rate
 * @param {string} params.periodStart - Period start date
 * @param {string} params.periodEnd - Period end date
 * @returns {Promise<object>} All deductions breakdown
 */
async function calculateAllDeductions(params) {
  const { barId, userId, grossPay, dailyRate, periodStart, periodEnd, standardWorkMinutes } = params;

  // SSS / PhilHealth / BIR are defined on a MONTHLY salary, but `grossPay` here is
  // the pay-period gross. Extrapolate to a monthly-equivalent salary, compute the
  // statutory amount on that, then apportion the result back to the period.
  // For a full-month run the fraction is ~1, so behaviour is unchanged.
  let fraction = 1;
  try {
    const ms = Date.parse(periodStart);
    const me = Date.parse(periodEnd);
    if (!isNaN(ms) && !isNaN(me) && me >= ms) {
      const periodDays = Math.max(1, Math.round((me - ms) / 86400000) + 1);
      const end = new Date(me);
      const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
      if (daysInMonth > 0) fraction = Math.min(31, Math.max(0.01, periodDays / daysInMonth));
    }
  } catch (_) {
    fraction = 1;
  }
  const monthlyGross = Number(grossPay || 0) / fraction;
  
  try {
    // Get employee deduction settings
    const [settings] = await pool.query(
      `SELECT * FROM employee_deduction_settings 
       WHERE bar_id = ? AND user_id = ? 
       LIMIT 1`,
      [barId, userId]
    );
    
    const deductionSettings = settings[0] || {
      bir_enabled: 0,
      bir_exemption_status: 'S',
      sss_enabled: 0,
      philhealth_enabled: 0,
      late_deduction_enabled: 0
    };
    
    const deductions = {
      bir: { amount: 0, enabled: false, computation: '' },
      sss: { amount: 0, enabled: false, computation: '' },
      philhealth: { amount: 0, enabled: false, computation: '' },
      late: { amount: 0, enabled: false, computation: '' },
      total: 0
    };
    
    // Calculate BIR if enabled
    if (deductionSettings.bir_enabled) {
      const birResult = await calculateMonthlyBIRTax(
        monthlyGross, 
        deductionSettings.bir_exemption_status
      );
      deductions.bir = {
        amount: Math.round(birResult.monthlyTax * fraction * 100) / 100,
        enabled: true,
        computation: birResult.computation
      };
    }
    
    // Calculate SSS if enabled
    if (deductionSettings.sss_enabled) {
      const sssResult = await calculateSSSContribution(monthlyGross);
      deductions.sss = {
        amount: Math.round(sssResult.employeeShare * fraction * 100) / 100,
        enabled: true,
        computation: sssResult.computation
      };
    }
    
    // Calculate PhilHealth if enabled
    if (deductionSettings.philhealth_enabled) {
      const philhealthResult = await calculatePhilHealthContribution(monthlyGross);
      deductions.philhealth = {
        amount: Math.round(philhealthResult.employeeShare * fraction * 100) / 100,
        enabled: true,
        computation: philhealthResult.computation
      };
    }
    
    // Calculate Late Deduction if enabled
    if (deductionSettings.late_deduction_enabled) {
      const lateData = await getTotalLateMinutes(barId, userId, periodStart, periodEnd);
      const workHoursPerDay = standardWorkMinutes ? Number(standardWorkMinutes) / 60 : 8;
      const lateAmount = calculateLateDeduction(lateData.totalMinutes, dailyRate, workHoursPerDay);
      deductions.late = {
        amount: lateAmount,
        enabled: true,
        computation: `${lateData.totalMinutes} minutes late over ${lateData.days} days × rate = ${lateAmount.toFixed(2)}`
      };
    }
    
    // Calculate total deductions
    deductions.total = 
      deductions.bir.amount + 
      deductions.sss.amount + 
      deductions.philhealth.amount + 
      deductions.late.amount;
    
    return deductions;
  } catch (err) {
    console.error("Calculate All Deductions Error:", err);
    return {
      bir: { amount: 0, enabled: false, computation: 'Error' },
      sss: { amount: 0, enabled: false, computation: 'Error' },
      philhealth: { amount: 0, enabled: false, computation: 'Error' },
      late: { amount: 0, enabled: false, computation: 'Error' },
      total: 0
    };
  }
}

module.exports = {
  calculateBIRTax,
  calculateMonthlyBIRTax,
  calculateSSSContribution,
  calculatePhilHealthContribution,
  calculateLateDeduction,
  getTotalLateMinutes,
  calculateAllDeductions
};
