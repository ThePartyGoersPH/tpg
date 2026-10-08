// Fix permissions for existing users who were created before the migration
const pool = require('./config/database');

async function fixExistingPermissions() {
  try {
    console.log('=== Fixing Existing User Permissions ===\n');
    
    // Get all users without permissions but with a role
    const [usersWithoutPerms] = await pool.query(`
      SELECT u.id, u.email, u.role, u.role_id 
      FROM users u 
      LEFT JOIN user_permissions up ON u.id = up.user_id 
      WHERE up.user_id IS NULL 
      AND u.role_id IS NOT NULL 
      AND u.is_active = 1
    `);
    
    console.log(`Found ${usersWithoutPerms.length} users without permissions`);
    
    if (usersWithoutPerms.length === 0) {
      console.log('All users already have permissions!');
      return;
    }
    
    for (const user of usersWithoutPerms) {
      console.log(`\nFixing user: ${user.email} (Role: ${user.role}, ID: ${user.id})`);
      
      // Assign all permissions for their role
      const [result] = await pool.query(`
        INSERT INTO user_permissions (user_id, permission_id, granted_by) 
        SELECT ?, rp.permission_id, ? 
        FROM role_permissions rp 
        WHERE rp.role_id = ?
        ON DUPLICATE KEY UPDATE granted_by = VALUES(granted_by)
      `, [user.id, 1, user.role_id]); // Use admin ID as granted_by
      
      console.log(`  → Assigned ${result.affectedRows} permissions`);
    }
    
    // Verify the fix
    const [fixedUsers] = await pool.query(`
      SELECT u.email, COUNT(up.permission_id) as perm_count
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.role_id IS NOT NULL AND u.is_active = 1
      GROUP BY u.id, u.email
      ORDER BY perm_count
    `);
    
    console.log('\n=== Permission Summary ===');
    fixedUsers.forEach(user => {
      console.log(`${user.email}: ${user.perm_count} permissions`);
    });
    
    console.log('\n✅ Fixed all existing user permissions!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

fixExistingPermissions();
