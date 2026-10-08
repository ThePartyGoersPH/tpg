-- ============================================================================
-- ADD DEDUCTION SETTINGS PERMISSIONS
-- ============================================================================
-- This migration adds permissions for managing payroll deduction settings

-- Add deduction settings permissions
INSERT INTO `permissions` (`name`, `module`, `action`, `description`) VALUES
('deduction_settings_view', 'deduction_settings', 'view', 'View employee deduction settings'),
('deduction_settings_manage', 'deduction_settings', 'manage', 'Configure and manage employee deduction settings (BIR, SSS, PhilHealth, Late)')
ON DUPLICATE KEY UPDATE 
  description = VALUES(description);

-- Note: These permissions are automatically included in payroll_view_all and payroll_create
-- but can be granted separately if needed for more granular access control
