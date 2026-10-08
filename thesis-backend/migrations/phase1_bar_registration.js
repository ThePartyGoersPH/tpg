// Phase 1 — Bar Registration & Verification.
// Adds establishment classification, an automated-verification status flag,
// and a per-document verification table tracking each required permit
// (BIR, Mayor's Permit, Sanitary Permit, Business Plate, Tobacco & Liquor Permit)
// with automated + manual verification.

const mysql = require('mysql2/promise');

const SQL = `
-- Establish classification (Bar, Resto-Bar, etc.) + automated verification status
ALTER TABLE business_registrations
  ADD COLUMN classification VARCHAR(100) NULL AFTER business_category,
  ADD COLUMN auto_verification_status ENUM('pending','checking','passed','failed','manual_review') NOT NULL DEFAULT 'pending' AFTER status,
  ADD COLUMN verification_notes TEXT NULL AFTER rejection_reason;

-- Per-document verification tracking
CREATE TABLE IF NOT EXISTS bar_registration_documents (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  registration_id INT(11) NOT NULL,
  bar_id INT(11) NULL,
  document_type VARCHAR(60) NOT NULL,
  file_path VARCHAR(500) NULL,
  verification_method ENUM('automated','manual') NULL,
  verification_status ENUM('pending','checking','approved','rejected','manual_review') NOT NULL DEFAULT 'pending',
  ai_confidence_score DECIMAL(5,2) NULL,
  verified_by INT(11) NULL,
  verified_at DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX (registration_id),
  INDEX (bar_id)
);

-- Config for the automated verification engine (managed by admin: bar_verification_manage)
CREATE TABLE IF NOT EXISTS bar_verification_config (
  id INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  auto_approve_threshold DECIMAL(5,2) NOT NULL DEFAULT 0.70,
  require_all_documents TINYINT(1) NOT NULL DEFAULT 1,
  updated_by INT(11) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO bar_verification_config (id, auto_approve_threshold, require_all_documents)
SELECT 1, 0.70, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM bar_verification_config WHERE id = 1);
`;

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'tpg', multipleStatements: true,
  });
  try {
    await conn.query(SQL);
    const [cols] = await conn.query('SHOW COLUMNS FROM business_registrations WHERE Field IN ("classification","auto_verification_status")');
    const [docs] = await conn.query('SHOW TABLES LIKE "bar_registration_documents"');
    const [cfg] = await conn.query('SHOW TABLES LIKE "bar_verification_config"');
    console.log('business_registrations new cols:', JSON.stringify(cols.map(c => c.Field)));
    console.log('bar_registration_documents exists:', docs.length === 1);
    console.log('bar_verification_config exists:', cfg.length === 1);
    console.log('PHASE 1 MIGRATION OK');
  } catch (e) {
    console.error('MIGRATION ERROR:', e.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
})();
