---
description: Main bar vs branch structure, super admin hierarchy view
---

# Branch Identity Context (Platform Bar System)

## 1) Column Definitions

### Migration: `20260322_bars_branch_identity.sql`

Added to `bars` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `is_branch` | TINYINT(1) | `0` | `0` = main/standalone bar, `1` = branch |
| `parent_bar_id` | INT | `NULL` | FK to `bars.id` of the parent bar. `NULL` = main bar |

### Index
```sql
ADD KEY idx_bars_parent_bar_id (parent_bar_id);
```

## 2) How Main Bar vs Branch Is Determined

| `is_branch` | `parent_bar_id` | Meaning |
|-------------|-----------------|---------|
| `0` | `NULL` | **Main bar** or standalone bar |
| `1` | `<id>` | **Branch** of the bar with that id |

### Creation Rules
- When a bar is created via normal registration → `is_branch = 0`, `parent_bar_id = NULL`
- When a branch is created via `POST /branches/create` → `is_branch = 1`, `parent_bar_id = <owner's main bar id>`

### Existing Branch System
The `routes/branches.js` file already handles:
- `GET /branches/my` — list all bars owned by the current user (main + branches)
- `POST /branches/create` — create a new branch (subscription-gated)
- `POST /branches/switch` — switch active bar context
- `PATCH /branches/:id` — update branch details
- `GET /branches/subscription-info` — check branch limits

## 3) Super Admin API Response Structure

### GET /super-admin/bars
Already conditionally includes `parent_bar_id` via `hasParentBarIdColumn()` check.

**Response shape per bar:**
```json
{
  "id": 1,
  "name": "Juan Bar",
  "is_branch": 0,
  "parent_bar_id": null,
  "status": "active",
  "address": "123 Main St",
  "city": "Manila",
  "owner_name": "Juan Owner",
  "owner_email": "juan@tpg.com"
}
```

**Grouped/tree structure (built client-side or via dedicated endpoint):**
```json
{
  "bar_id": 1,
  "name": "Juan Bar",
  "is_branch": false,
  "branches": [
    { "bar_id": 4, "name": "Juan Bar - BGC Branch", "is_branch": true, "parent_bar_id": 1 },
    { "bar_id": 7, "name": "Juan Bar - Makati Branch", "is_branch": true, "parent_bar_id": 1 }
  ]
}
```

## 4) How to Display the Hierarchy in Super Admin UI

### Grouping Logic (Frontend)
```javascript
function groupBarsWithBranches(bars) {
  const mainBars = bars.filter(b => !b.parent_bar_id && !b.is_branch);
  const branches = bars.filter(b => b.parent_bar_id || b.is_branch);

  return mainBars.map(main => ({
    ...main,
    branches: branches.filter(br => br.parent_bar_id === main.id),
  }));
}
```

### Display Rules
- Main bars render at top level with full details
- Branches render indented below their parent with a "Branch" badge
- Standalone bars (no branches) render normally
- Orphan branches (parent_bar_id set but parent not found) render at top level with a warning indicator

### Visual Treatment
- Main bar row: normal styling, expandable if has branches
- Branch row: indented left, lighter background, "🔀 Branch" label
- Branch count badge next to main bar name: e.g., "Juan Bar (2 branches)"

## 5) Branch Ownership

All branches share the same `owner_id` as the main bar. The bar owner can:
- View all their bars (main + branches) via `GET /branches/my`
- Switch between bars via `POST /branches/switch` (updates `user.bar_id`)
- Staff accounts are locked to a specific branch and cannot switch
