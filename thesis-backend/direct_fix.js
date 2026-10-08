// Direct fix without authentication - for testing only
const mysql = require('mysql2/promise');

async function directFix() {
  let connection;
  
  try {
    // Database connection from config
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'tpg',
      multipleStatements: true
    });
    
    console.log('✅ Connected to database');
    
    // Find users without permissions
    const [usersWithoutPerms] = await connection.execute(`
      SELECT u.id, u.email, u.role, u.role_id 
      FROM users u 
      LEFT JOIN user_permissions up ON u.id = up.user_id 
      WHERE up.user_id IS NULL 
      AND u.role_id IS NOT NULL 
      AND u.is_active = 1
    `);
    
    console.log(`Found ${usersWithoutPerms.length} users without permissions:`);
    usersWithoutPerms.forEach(user => {
      console.log(`  - ${user.email} (Role: ${user.role}, ID: ${user.role_id})`);
    });
    
    if (usersWithoutPerms.length === 0) {
      console.log('✅ All users already have permissions!');
      return;
    }
    
    // Fix permissions for each user
    let totalFixed = 0;
    
    for (const user of usersWithoutPerms) {
      const [result] = await connection.execute(`
        INSERT INTO user_permissions (user_id, permission_id, granted_by) 
        SELECT ?, rp.permission_id, ? 
        FROM role_permissions rp 
        WHERE rp.role_id = ?
        ON DUPLICATE KEY UPDATE granted_by = VALUES(granted_by)
      `, [user.id, user.id, user.role_id]);
      
      totalFixed += result.affectedRows;
      console.log(`✅ Fixed ${user.email}: ${result.affectedRows} permissions assigned`);
    }
    
    console.log(`\n🎉 SUCCESS: Fixed permissions for ${usersWithoutPerms.length} users (${totalFixed} total permissions)`);
    
    // Verify the fix
    const [verification] = await connection.execute(`
      SELECT u.email, COUNT(up.permission_id) as perm_count
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.role_id IS NOT NULL AND u.is_active = 1
      GROUP BY u.id, u.email
      ORDER BY perm_count
    `);
    
    console.log('\n📊 Permission Summary:');
    verification.forEach(user => {
      console.log(`  ${user.email}: ${user.perm_count} permissions`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

directFix();
