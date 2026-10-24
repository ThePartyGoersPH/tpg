# How to Create a Super Admin Account

## Quick Start

I've created a SQL file that will add a new Super Admin account to your database.

### Default Credentials
- **Email:** `superadmin@system.com`
- **Password:** `SuperAdmin123!`
- **Role:** SUPER_ADMIN (full system access)

## Step-by-Step Instructions

### Option 1: Using MySQL Command Line

1. **Open Command Prompt or Terminal**

2. **Navigate to the backend directory:**
```bash
cd c:\Users\Admin\thesis_mobile_app1\thesis-backend
```

3. **Run the SQL file:**
```bash
mysql -u root -p your_database_name < create_super_admin.sql
```

Replace:
- `root` with your MySQL username
- `your_database_name` with your database name (likely `tpg` based on your SQL dump)

4. **Enter your MySQL password when prompted**

### Option 2: Using MySQL Workbench or phpMyAdmin

1. **Open MySQL Workbench or phpMyAdmin**

2. **Select your database** (likely named `tpg`)

3. **Open the SQL tab**

4. **Copy and paste this SQL:**

```sql
INSERT INTO `users` (
  `first_name`, 
  `last_name`, 
  `email`, 
  `password`, 
  `phone_number`, 
  `phone_verified`, 
  `profile_picture`, 
  `date_of_birth`, 
  `role`, 
  `role_id`, 
  `is_verified`, 
  `newsletter`, 
  `is_active`, 
  `bar_id`
) VALUES (
  'System',
  'Administrator',
  'superadmin@system.com',
  '$2b$10$YQ7x08tM6t9Hf4.7LNUHu1e/SyYNPtMMIULcfIljCkEs1SyO/n89bq',
  NULL,
  0,
  NULL,
  NULL,
  'super_admin',
  6,
  1,
  0,
  1,
  NULL
);
```

5. **Execute the SQL**

6. **Verify it worked:**
```sql
SELECT id, first_name, last_name, email, role, role_id, is_active 
FROM users 
WHERE email = 'superadmin@system.com';
```

## Login to Your App

1. **Open your Flutter app**

2. **Login with:**
   - Email: `superadmin@system.com`
   - Password: `SuperAdmin123!`

3. **You now have full system access!**

## What Can Super Admin Do?

As a Super Admin, you have:

✅ **Global Access**
- Access to ALL bars in the system (no bar_id restriction)
- View and manage all bar owners
- Access all platform features

✅ **Full Permissions**
- Bypasses all permission checks
- Can perform any action in the system
- Access to `/superadmin/*` routes

✅ **Platform Management**
- Approve/suspend/reactivate bars
- Create/reset/disable bar owners
- View global audit logs
- Manage system maintenance and announcements
- Monitor suspicious logins

✅ **User Management**
- Manage users across all bars
- Reset passwords for any user
- Transfer bar ownership
- View all user activities

## Security Recommendations

⚠️ **IMPORTANT: Change the password immediately after first login!**

1. **Login to the app**
2. **Go to Settings**
3. **Change Password**
4. **Use a strong, unique password**

### To Generate a New Password Hash

If you want to set a custom password before creating the account:

**Using Node.js:**
```javascript
const bcrypt = require('bcrypt');
const hash = bcrypt.hashSync('YourNewPassword', 10);
console.log(hash);
```

**Using Online Tool:**
- Visit: https://bcrypt-generator.com/
- Enter your password
- Use 10 rounds
- Copy the hash and replace it in the SQL

## Customization

You can modify the SQL file to change:

- **Email:** Change `'superadmin@system.com'` to your preferred email
- **Name:** Change `'System'` and `'Administrator'` to your name
- **Password:** Replace the password hash with your own (see above)
- **Phone:** Add a phone number if desired

## Troubleshooting

**Error: Duplicate entry for email**
- The email already exists in the database
- Change the email in the SQL to a unique one

**Error: Cannot add foreign key constraint**
- Make sure the `roles` table has a row with `id = 6` (SUPER_ADMIN)
- Check your SQL dump - it should already exist

**Can't login after creating account**
- Verify the user was created: `SELECT * FROM users WHERE email = 'superadmin@system.com';`
- Check that `is_active = 1` and `role_id = 6`
- Make sure you're using the correct password: `SuperAdmin123!`

## Database Structure Reference

From your SQL dump, I found:

**Roles Table:**
- Role ID `6` = `SUPER_ADMIN` (Global super admin for whole system)
- Role ID `7` = `BAR_OWNER` (Bar owner/admin for a specific bar)
- Role ID `5` = `STAFF` (General staff user)
- Role ID `2` = `HR` (Human resources staff)
- Role ID `8` = `CASHIER` (Cashier role under a bar)
- Role ID `4` = `CUSTOMER` (Customer user)

**Users Table Fields:**
- `role`: String representation (e.g., 'super_admin')
- `role_id`: Foreign key to roles table (e.g., 6)
- `bar_id`: NULL for super admin (has access to all bars)
- `is_verified`: 1 for verified accounts
- `is_active`: 1 for active accounts

## Files Created

1. `create_super_admin.sql` - The SQL script to create the account
2. `HOW_TO_CREATE_SUPER_ADMIN.md` - This instruction file

Both files are in: `c:\Users\Admin\thesis_mobile_app1\thesis-backend\`
