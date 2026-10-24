# Package Inclusions Feature - Database Migration Guide

## Overview
This migration adds support for bar packages with detailed inclusions, allowing bar owners to create bundled offerings (e.g., "VIP Package" with bottles, food, table reservation, etc.).

## Migration File
- **File**: `create_packages_tables.sql`
- **Date**: 2026-03-30
- **Feature**: Package Inclusions Detail (PROMPT 3.1)

## Tables Created

### 1. `bar_packages`
Stores package information for each bar.

**Columns:**
- `id` - Primary key
- `bar_id` - Foreign key to bars table
- `name` - Package name (e.g., "VIP Package", "Birthday Bundle")
- `description` - Optional package description
- `price` - Package price in decimal format
- `is_active` - Active/inactive status (1/0)
- `created_at` - Timestamp of creation
- `updated_at` - Timestamp of last update
- `deleted_at` - Soft delete timestamp (NULL if not deleted)

**Indexes:**
- Primary key on `id`
- Composite index on `(bar_id, is_active, deleted_at)` for efficient queries
- Foreign key constraint to `bars(id)` with CASCADE delete

### 2. `package_inclusions`
Stores individual items included in each package.

**Columns:**
- `id` - Primary key
- `package_id` - Foreign key to bar_packages table
- `item_name` - Name of included item (e.g., "1 bottle", "pulutan", "table", "free entrance")
- `quantity` - Quantity of the item (default: 1)
- `created_at` - Timestamp of creation

**Indexes:**
- Primary key on `id`
- Index on `package_id` for efficient lookups
- Foreign key constraint to `bar_packages(id)` with CASCADE delete

## How to Run Migration

### Option 1: MySQL Command Line
```bash
mysql -u your_username -p your_database_name < migrations/create_packages_tables.sql
```

### Option 2: MySQL Workbench
1. Open MySQL Workbench
2. Connect to your database
3. Open the `create_packages_tables.sql` file
4. Execute the script

### Option 3: phpMyAdmin
1. Log in to phpMyAdmin
2. Select your database
3. Go to SQL tab
4. Copy and paste the contents of `create_packages_tables.sql`
5. Click "Go"

## API Endpoints Added

### Bar Owner Endpoints (Protected)
- `GET /owner/bar/packages` - List all packages for the bar
- `POST /owner/bar/packages` - Create a new package with inclusions
- `PATCH /owner/bar/packages/:id` - Update package and inclusions
- `DELETE /owner/bar/packages/:id` - Soft delete a package

### Public Endpoints
- `GET /public/bars/:id/packages` - Get all active packages for a bar (customer-facing)

## Frontend Changes

### Manager App (Bar Owner)
- **New Page**: `/packages` - Package management interface
- **Features**:
  - Create/edit packages with dynamic inclusion rows
  - Add multiple inclusions per package
  - Toggle package active/inactive status
  - Soft delete packages

### Customer Website
- **Updated**: Bar Detail View
- **Features**:
  - Display packages in Overview tab
  - Show inclusions as bullet list
  - Display package price

## Testing Checklist

### Backend
- [ ] Tables created successfully
- [ ] Foreign key constraints working
- [ ] Can create package with inclusions
- [ ] Can update package and inclusions
- [ ] Can soft delete package
- [ ] Public endpoint returns active packages only

### Manager App
- [ ] Packages page accessible at `/packages`
- [ ] Can create new package
- [ ] Can add multiple inclusions dynamically
- [ ] Can edit existing package
- [ ] Can toggle package status
- [ ] Can delete package
- [ ] Inclusions display correctly

### Customer App
- [ ] Packages display on bar detail page
- [ ] Inclusions shown as bullet list
- [ ] Package price displays correctly
- [ ] Only active packages visible

## Rollback Instructions

If you need to rollback this migration:

```sql
-- Drop tables in reverse order (child first, then parent)
DROP TABLE IF EXISTS `package_inclusions`;
DROP TABLE IF EXISTS `bar_packages`;
```

## Notes
- Packages are soft-deleted (using `deleted_at` timestamp) to preserve historical data
- Inclusions are hard-deleted when package is deleted (CASCADE)
- Package prices are stored as DECIMAL(10,2) for accurate currency handling
- All timestamps use MySQL's CURRENT_TIMESTAMP for consistency
