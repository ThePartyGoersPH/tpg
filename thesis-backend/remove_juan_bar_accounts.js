// Remove all accounts under Juan Bar except the owner
const mysql = require('mysql2/promise');

async function removeJuanBarAccounts() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'tpg'
    });
    
    console.log('✅ Connected to database');
    
    // First, get all users under Juan Bar (bar_id = 11) except the owner
    const [users] = await connection.execute(
      `SELECT id, email, role, first_name, last_name 
       FROM users 
       WHERE bar_id = 11 
       AND email != 'juan.owner1234243@tpg.com'
       ORDER BY role, email`
    );
    
    console.log(`\n📋 Found ${users.length} accounts to remove from Juan Bar:`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.first_name} ${user.last_name}, Role: ${user.role})`);
    });
    
    if (users.length === 0) {
      console.log('✅ No accounts to remove (only owner exists)');
      return;
    }
    
    // Confirm before proceeding
    console.log('\n⚠️  WARNING: This will permanently delete:');
    console.log('   - User accounts');
    console.log('   - Employee profiles');
    console.log('   - User permissions');
    console.log('   - User sessions');
    console.log('   - All related data');
    
    // Get user IDs to delete
    const userIds = users.map(u => u.id);
    
    // Start transaction
    await connection.beginTransaction();
    
    try {
      // Delete user permissions
      const [permResult] = await connection.execute(
        `DELETE FROM user_permissions WHERE user_id IN (${userIds.join(',')})`
      );
      console.log(`✅ Deleted ${permResult.affectedRows} permission records`);
      
      // Delete user sessions
      const [sessResult] = await connection.execute(
        `DELETE FROM user_sessions WHERE user_id IN (${userIds.join(',')})`
      );
      console.log(`✅ Deleted ${sessResult.affectedRows} session records`);
      
      // Delete employee profiles
      const [profResult] = await connection.execute(
        `DELETE FROM employee_profiles WHERE user_id IN (${userIds.join(',')})`
      );
      console.log(`✅ Deleted ${profResult.affectedRows} employee profile records`);
      
      // Delete the users
      const [userResult] = await connection.execute(
        `DELETE FROM users WHERE id IN (${userIds.join(',')})`
      );
      console.log(`✅ Deleted ${userResult.affectedRows} user accounts`);
      
      // Commit transaction
      await connection.commit();
      console.log('\n🎉 SUCCESS: All Juan Bar accounts removed except owner!');
      
      // Verify remaining users
      const [remaining] = await connection.execute(
        'SELECT id, email, role FROM users WHERE bar_id = 11'
      );
      
      console.log('\n📊 Remaining Juan Bar accounts:');
      remaining.forEach(user => {
        console.log(`  ✅ ${user.email} (${user.role})`);
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

removeJuanBarAccounts();
