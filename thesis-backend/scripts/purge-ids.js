'use strict';
// scripts/purge-ids.js — placeholder; implement retention purge logic here
const config = require('../config/env');
console.log('[purge-ids] ID retention purge stub. Approved retention:', config.ID_RETENTION_DAYS_APPROVED, 'days; rejected:', config.ID_RETENTION_DAYS_REJECTED, 'days.');
console.log('[purge-ids] Implement actual file deletion based on ID submissions older than retention days.');