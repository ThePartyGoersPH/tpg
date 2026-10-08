const pool = require('./config/database');

(async () => {
  try {
    console.log('Checking BAR_OWNER role permissions for documents_view_all...\n');
    
    const [rolePerms] = await pool.query(`
      SELECT rp.role_id, r.name AS role_name, p.name AS permission_name 
      FROM role_permissions rp 
      JOIN roles r ON r.id = rp.role_id 
      JOIN permissions p ON p.id = rp.permission_id 
      WHERE r.id = 7 AND p.name = 'documents_view_all'
    `);
    
    console.log('Role permissions:', rolePerms);
    
    console.log('\nChecking if any bar_owner users have user_permissions overrides...\n');
    
    const [userOverrides] = await pool.query(`
      SELECT u.id, u.email, u.role, u.role_id, 
             COUNT(up.permission_id) as override_count
      FROM users u
      LEFT JOIN user_permissions up ON up.user_id = u.id
      WHERE u.role = 'bar_owner'
      GROUP BY u.id
    `);
    
    console.log('Bar owner users:', userOverrides);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
