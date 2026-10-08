# Payroll Deductions System - Complete Guide

## Overview

The Payroll Deductions System enhances the existing payroll module by adding optional, configurable deductions for employees. All deductions are **toggleable** and can be enabled/disabled per employee, ensuring flexibility in payroll processing.

## Supported Deductions

### 1. BIR (Bureau of Internal Revenue) - Withholding Tax
- **Type**: Progressive tax based on annual taxable income
- **Calculation**: Uses Philippine tax brackets (2024)
- **Configuration**: Tax exemption status (S, ME, S1-S4, ME1-ME4)
- **Formula**: `Base Tax + (Excess Income × Tax Rate)`

**Tax Brackets (2024)**:
- ₱0 - ₱250,000: 0%
- ₱250,001 - ₱400,000: 15% of excess over ₱250,000
- ₱400,001 - ₱800,000: ₱22,500 + 20% of excess over ₱400,000
- ₱800,001 - ₱2,000,000: ₱102,500 + 25% of excess over ₱800,000
- ₱2,000,001 - ₱8,000,000: ₱402,500 + 30% of excess over ₱2,000,000
- Above ₱8,000,000: ₱2,202,500 + 35% of excess over ₱8,000,000

### 2. SSS (Social Security System)
- **Type**: Monthly contribution based on salary bracket
- **Calculation**: Fixed amount per salary range
- **Employee Share**: Deducted from employee's salary
- **Employer Share**: Paid by employer (tracked but not deducted)
- **Range**: ₱180 - ₱1,125 (employee share)

### 3. PhilHealth (Philippine Health Insurance)
- **Type**: Monthly health insurance contribution
- **Calculation**: 5% of basic salary (employee pays 2.5%)
- **Minimum**: ₱250/month (employee share)
- **Maximum**: ₱2,500/month (employee share)
- **Formula**: `(Basic Salary × 5%) ÷ 2`

### 4. Late Deduction
- **Type**: Automatic deduction for tardiness
- **Calculation**: Based on minutes late and daily rate
- **Formula**: `(Daily Rate ÷ Work Hours ÷ 60) × Late Minutes`
- **Tracking**: Requires `late_minutes` in attendance_logs

## Database Schema

### New Tables

#### 1. `employee_deduction_settings`
Stores per-employee deduction configuration:
```sql
CREATE TABLE employee_deduction_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  bar_id INT NOT NULL,
  user_id INT NOT NULL,
  bir_enabled TINYINT(1) DEFAULT 0,
  bir_exemption_status VARCHAR(20) DEFAULT 'S',
  sss_enabled TINYINT(1) DEFAULT 0,
  sss_number VARCHAR(50),
  philhealth_enabled TINYINT(1) DEFAULT 0,
  philhealth_number VARCHAR(50),
  late_deduction_enabled TINYINT(1) DEFAULT 0,
  UNIQUE KEY (bar_id, user_id)
);
```

#### 2. `payroll_deduction_items`
Stores itemized deduction details for audit:
```sql
CREATE TABLE payroll_deduction_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  payroll_item_id INT NOT NULL,
  deduction_type ENUM('bir', 'sss', 'philhealth', 'late', 'other'),
  deduction_label VARCHAR(100),
  amount DECIMAL(10,2),
  is_enabled TINYINT(1) DEFAULT 1,
  computation_basis TEXT,
  KEY idx_payroll_item (payroll_item_id)
);
```

#### 3. Reference Tables
- `bir_tax_brackets` - Tax bracket definitions
- `sss_contribution_table` - SSS contribution rates
- `philhealth_contribution_table` - PhilHealth rates
- `payroll_deduction_audit` - Audit trail for changes

### Updated Tables

#### `payroll_items`
New columns added:
- `bir_deduction` DECIMAL(10,2) - BIR withholding tax
- `sss_deduction` DECIMAL(10,2) - SSS employee share
- `philhealth_deduction` DECIMAL(10,2) - PhilHealth employee share
- `late_deduction` DECIMAL(10,2) - Late deduction amount
- `other_deductions` DECIMAL(10,2) - Other deductions
- `total_deductions` DECIMAL(10,2) - Sum of all deductions

**Net Pay Calculation**:
```
Net Pay = Gross Pay - Total Deductions
Total Deductions = BIR + SSS + PhilHealth + Late + Other
```

#### `attendance_logs`
New columns for late tracking:
- `late_minutes` INT - Minutes late for this attendance
- `expected_time_in` TIME - Expected clock-in time

## API Endpoints

### Deduction Settings Management

#### Get Employee Deduction Settings
```http
GET /hr/payroll/deduction-settings/:userId
Authorization: Bearer {token}
Permissions: payroll_view_all
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "bar_id": 11,
    "user_id": 123,
    "bir_enabled": 1,
    "bir_exemption_status": "S1",
    "sss_enabled": 1,
    "sss_number": "34-1234567-8",
    "philhealth_enabled": 1,
    "philhealth_number": "12-345678901-2",
    "late_deduction_enabled": 1
  }
}
```

#### Update Employee Deduction Settings
```http
PUT /hr/payroll/deduction-settings/:userId
Authorization: Bearer {token}
Permissions: payroll_create
Content-Type: application/json

{
  "bir_enabled": true,
  "bir_exemption_status": "S1",
  "sss_enabled": true,
  "sss_number": "34-1234567-8",
  "philhealth_enabled": true,
  "philhealth_number": "12-345678901-2",
  "late_deduction_enabled": true
}
```

#### Toggle Specific Deduction
```http
PATCH /hr/payroll/deduction-settings/:userId/toggle
Authorization: Bearer {token}
Permissions: payroll_create
Content-Type: application/json

{
  "deduction_type": "bir",  // bir, sss, philhealth, or late
  "enabled": true
}
```

#### Get All Employees with Settings
```http
GET /hr/payroll/deduction-settings
Authorization: Bearer {token}
Permissions: payroll_view_all
```

### Payroll Generation (Updated)

When generating payroll, deductions are automatically calculated:

```http
POST /hr/payroll/runs/:id/generate
Authorization: Bearer {token}
Permissions: payroll_create
```

**Response includes deduction breakdown**:
```json
{
  "success": true,
  "generated": [
    {
      "user_id": 123,
      "days_present": 22,
      "gross_pay": 11000.00,
      "deductions": {
        "bir": 825.00,
        "sss": 495.00,
        "philhealth": 275.00,
        "late": 150.00,
        "total": 1745.00
      },
      "net_pay": 9255.00
    }
  ]
}
```

### View Payroll Items (Updated)

```http
GET /hr/payroll/runs/:id/items
Authorization: Bearer {token}
Permissions: payroll_view_all
```

**Response includes itemized deductions**:
```json
{
  "success": true,
  "run": { ... },
  "items": [
    {
      "id": 1,
      "user_id": 123,
      "first_name": "Juan",
      "last_name": "Dela Cruz",
      "gross_pay": 11000.00,
      "bir_deduction": 825.00,
      "sss_deduction": 495.00,
      "philhealth_deduction": 275.00,
      "late_deduction": 150.00,
      "total_deductions": 1745.00,
      "net_pay": 9255.00,
      "deduction_items": [
        {
          "deduction_type": "bir",
          "deduction_label": "BIR Withholding Tax",
          "amount": 825.00,
          "computation_basis": "Annual Gross: 132000.00 - Exemption: 75000.00 = Taxable: 57000.00..."
        }
      ]
    }
  ]
}
```

## Usage Guide

### For HR/Payroll Administrators

#### 1. Configure Employee Deductions

Navigate to **Deduction Settings** page:

1. View all employees with their current deduction status
2. Click **Configure** on any employee
3. Toggle deductions on/off:
   - **BIR Tax**: Enable and select tax exemption status
   - **SSS**: Enable and optionally enter SSS number
   - **PhilHealth**: Enable and optionally enter PhilHealth number
   - **Late Deduction**: Enable to automatically deduct for tardiness
4. Click **Save Settings**

#### 2. Quick Toggle Deductions

From the employee list, click the colored badges to quickly enable/disable specific deductions:
- **Blue**: BIR Tax
- **Green**: SSS
- **Purple**: PhilHealth
- **Amber**: Late Deduction

#### 3. Run Payroll with Deductions

1. Go to **Payroll** page
2. Select period dates
3. Click **Run Payroll**
4. System automatically:
   - Calculates gross pay (daily rate × days present)
   - Applies enabled deductions for each employee
   - Computes net pay (gross - deductions)
   - Stores itemized deduction details

#### 4. Review Payroll Details

Click **View** on any payroll run to see:
- Gross pay per employee
- Individual deduction amounts (BIR, SSS, PhilHealth, Late)
- Total deductions
- Net pay
- Computation details for each deduction

### For Employees

#### View Payslips

Navigate to **Payroll** page to view your payroll history:

1. See all payroll periods
2. Click the expand arrow (▶) to view deduction breakdown
3. View itemized deductions:
   - BIR Withholding Tax amount
   - SSS Contribution amount
   - PhilHealth Contribution amount
   - Late Deduction (if applicable)
4. See computation details explaining how each deduction was calculated

## Migration Instructions

### Running the Migration

1. **Backup your database** before running the migration
2. Execute the migration file:
   ```bash
   mysql -u username -p database_name < migrations/payroll_deductions_system.sql
   ```

3. The migration is **safe** and uses:
   - `CREATE TABLE IF NOT EXISTS` for new tables
   - Dynamic column checks before `ALTER TABLE`
   - `INSERT IGNORE` for reference data

### Post-Migration Steps

1. **Verify tables created**:
   ```sql
   SHOW TABLES LIKE '%deduction%';
   SHOW TABLES LIKE '%bir%';
   SHOW TABLES LIKE '%sss%';
   SHOW TABLES LIKE '%philhealth%';
   ```

2. **Check payroll_items columns**:
   ```sql
   DESCRIBE payroll_items;
   ```
   Should show: `bir_deduction`, `sss_deduction`, `philhealth_deduction`, `late_deduction`, `total_deductions`

3. **Verify reference data**:
   ```sql
   SELECT COUNT(*) FROM bir_tax_brackets;  -- Should be 6
   SELECT COUNT(*) FROM sss_contribution_table;  -- Should be 33
   SELECT COUNT(*) FROM philhealth_contribution_table;  -- Should be 3
   ```

## Deduction Calculation Examples

### Example 1: Employee with All Deductions

**Employee**: Maria Santos  
**Daily Rate**: ₱500  
**Days Present**: 22 days  
**Late Minutes**: 120 minutes (2 hours)

**Calculations**:
```
Gross Pay = ₱500 × 22 = ₱11,000

BIR Tax:
- Annual Gross = ₱11,000 × 12 = ₱132,000
- Exemption (S1) = ₱75,000
- Taxable = ₱132,000 - ₱75,000 = ₱57,000
- Annual Tax = ₱0 + (₱57,000 × 15%) = ₱8,550
- Monthly Tax = ₱8,550 ÷ 12 = ₱712.50

SSS:
- Monthly Salary = ₱11,000
- Employee Share = ₱495.00

PhilHealth:
- Monthly Salary = ₱11,000
- Premium = ₱11,000 × 5% = ₱550
- Employee Share = ₱550 ÷ 2 = ₱275.00

Late Deduction:
- Hourly Rate = ₱500 ÷ 8 = ₱62.50
- Minute Rate = ₱62.50 ÷ 60 = ₱1.04
- Deduction = 120 × ₱1.04 = ₱125.00

Total Deductions = ₱712.50 + ₱495.00 + ₱275.00 + ₱125.00 = ₱1,607.50
Net Pay = ₱11,000 - ₱1,607.50 = ₱9,392.50
```

### Example 2: Employee with Selective Deductions

**Employee**: Pedro Reyes  
**Daily Rate**: ₱800  
**Days Present**: 20 days  
**Enabled Deductions**: SSS and PhilHealth only

**Calculations**:
```
Gross Pay = ₱800 × 20 = ₱16,000

BIR Tax = ₱0 (disabled)

SSS:
- Monthly Salary = ₱16,000
- Employee Share = ₱720.00

PhilHealth:
- Monthly Salary = ₱16,000
- Premium = ₱16,000 × 5% = ₱800
- Employee Share = ₱800 ÷ 2 = ₱400.00

Late Deduction = ₱0 (disabled)

Total Deductions = ₱720.00 + ₱400.00 = ₱1,120.00
Net Pay = ₱16,000 - ₱1,120.00 = ₱14,880.00
```

## Updating Tax Tables

### Updating BIR Tax Brackets

When tax brackets change (e.g., for 2025):

```sql
-- Deactivate old brackets
UPDATE bir_tax_brackets SET is_active = 0 WHERE year = 2024;

-- Insert new brackets
INSERT INTO bir_tax_brackets (min_income, max_income, base_tax, excess_rate, year, is_active) VALUES
(0.00, 250000.00, 0.00, 0.0000, 2025, 1),
-- ... add new brackets
```

### Updating SSS Contribution Table

```sql
-- Deactivate old rates
UPDATE sss_contribution_table SET is_active = 0 WHERE year = 2024;

-- Insert new rates
INSERT INTO sss_contribution_table (...) VALUES (...);
```

### Updating PhilHealth Rates

```sql
-- Deactivate old rates
UPDATE philhealth_contribution_table SET is_active = 0 WHERE year = 2024;

-- Insert new rates
INSERT INTO philhealth_contribution_table (...) VALUES (...);
```

## Troubleshooting

### Issue: Deductions not calculating

**Check**:
1. Employee has deduction settings enabled
2. Reference tables have active data for current year
3. Employee has valid daily_rate in employee_profiles
4. Payroll period dates are valid

**Solution**:
```sql
-- Check employee settings
SELECT * FROM employee_deduction_settings WHERE user_id = ?;

-- Check reference data
SELECT * FROM bir_tax_brackets WHERE is_active = 1;
SELECT * FROM sss_contribution_table WHERE is_active = 1;
SELECT * FROM philhealth_contribution_table WHERE is_active = 1;
```

### Issue: Late deduction not working

**Check**:
1. `late_deduction_enabled = 1` for employee
2. `late_minutes` populated in attendance_logs
3. Employee has valid daily_rate

**Solution**:
```sql
-- Check late minutes
SELECT work_date, late_minutes FROM attendance_logs 
WHERE employee_user_id = ? AND work_date BETWEEN ? AND ?;

-- Update late minutes if needed
UPDATE attendance_logs 
SET late_minutes = TIMESTAMPDIFF(MINUTE, expected_time_in, time_in)
WHERE id = ?;
```

### Issue: Wrong tax calculation

**Check**:
1. Correct exemption status set
2. Gross pay is accurate
3. Using correct tax year brackets

**Debug**:
```javascript
// Test calculation manually
const { calculateMonthlyBIRTax } = require('./utils/deductionCalculator');
const result = await calculateMonthlyBIRTax(11000, 'S1');
console.log(result);
```

## Security & Audit

### Audit Trail

All deduction setting changes are logged in `payroll_deduction_audit`:

```sql
SELECT 
  pda.*,
  u.first_name, u.last_name,
  changed.first_name AS changed_by_name
FROM payroll_deduction_audit pda
JOIN users u ON u.id = pda.user_id
JOIN users changed ON changed.id = pda.changed_by
WHERE pda.bar_id = ?
ORDER BY pda.created_at DESC;
```

### Permissions Required

- **View Deduction Settings**: `payroll_view_all`
- **Modify Deduction Settings**: `payroll_create`
- **View Own Payroll**: `payroll_view_own`
- **Generate Payroll**: `payroll_create`

## Best Practices

1. **Configure deductions before running payroll** for the first time
2. **Review deduction calculations** in draft payroll before finalizing
3. **Keep reference tables updated** with current year rates
4. **Backup database** before running migrations or updates
5. **Test calculations** with sample data before going live
6. **Document exemption status** for each employee
7. **Regularly audit** deduction settings and calculations
8. **Communicate changes** to employees when deductions are enabled/modified

## Support & Maintenance

### Regular Maintenance Tasks

- **Annually**: Update tax brackets and contribution tables
- **Monthly**: Review deduction calculations for accuracy
- **Quarterly**: Audit deduction settings and changes
- **As needed**: Update employee exemption statuses

### Getting Help

For issues or questions:
1. Check this documentation
2. Review audit logs for recent changes
3. Test calculations with deduction calculator utilities
4. Contact system administrator

---

**Version**: 1.0  
**Last Updated**: March 22, 2026  
**Compatibility**: Philippine tax and contribution rates (2024)
