# Inventory Request + Approval Workflow - Documentation

## Overview
This feature implements a request and approval system for inventory management, allowing staff to submit inventory requests and bar owners to approve or reject them.

## Migration File
- **File**: `create_inventory_requests.sql`
- **Date**: 2026-03-30
- **Feature**: Inventory Request + Approval Workflow (PROMPT 3.5)

## Database Schema

### `inventory_requests` Table

**Purpose:** Stores all inventory requests submitted by staff with their approval status.

**Columns:**
- `id` - Primary key
- `bar_id` - Foreign key to bars table
- `requester_id` - User ID of staff who submitted the request
- `item_name` - Name of the item being requested
- `quantity_needed` - Quantity needed
- `unit` - Unit of measurement (ENUM: Bottle, Bucket, Case, Glass, Liter, Kilogram, Piece)
- `reason` - Optional reason for the request
- `status` - Request status (ENUM: pending, approved, rejected)
- `reviewed_by` - User ID of owner/manager who reviewed the request
- `reviewed_at` - Timestamp when request was reviewed
- `rejection_note` - Optional note explaining rejection
- `created_at` - Timestamp of creation
- `updated_at` - Timestamp of last update

**Indexes:**
- Primary key on `id`
- Composite index on `(bar_id, status)` for efficient filtering
- Index on `requester_id` for staff's own requests
- Index on `reviewed_by` for reviewer tracking

**Foreign Keys:**
- `bar_id` → `bars(id)` with CASCADE delete
- `requester_id` → `users(id)` with CASCADE delete
- `reviewed_by` → `users(id)` with SET NULL delete

## API Endpoints

### Staff Endpoints

#### Submit Inventory Request
```
POST /owner/inventory/requests
```
**Authentication:** Required  
**Permissions:** None (all authenticated staff can submit)  
**Body:**
```json
{
  "item_name": "San Miguel Beer",
  "quantity_needed": 24,
  "unit": "Bottle",
  "reason": "Running low on stock for weekend rush"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Inventory request submitted",
  "data": { "id": 123 }
}
```

#### Get Own Requests
```
GET /owner/inventory/requests/my
```
**Authentication:** Required  
**Permissions:** None  
**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "item_name": "San Miguel Beer",
      "quantity_needed": 24,
      "unit": "Bottle",
      "reason": "Running low on stock",
      "status": "pending",
      "rejection_note": null,
      "created_at": "2026-03-30T10:00:00Z",
      "reviewed_at": null,
      "reviewer_first_name": null,
      "reviewer_last_name": null
    }
  ]
}
```

### Owner Endpoints

#### Get All Requests (with optional filter)
```
GET /owner/inventory/requests?status=pending
```
**Authentication:** Required  
**Permissions:** `menu_view`  
**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "item_name": "San Miguel Beer",
      "quantity_needed": 24,
      "unit": "Bottle",
      "reason": "Running low on stock",
      "status": "pending",
      "rejection_note": null,
      "created_at": "2026-03-30T10:00:00Z",
      "reviewed_at": null,
      "requester_first_name": "Juan",
      "requester_last_name": "Dela Cruz",
      "reviewer_first_name": null,
      "reviewer_last_name": null
    }
  ]
}
```

#### Approve Request
```
POST /owner/inventory/requests/:id/approve
```
**Authentication:** Required  
**Permissions:** `menu_update`  
**Response:**
```json
{
  "success": true,
  "message": "Request approved"
}
```

#### Reject Request
```
POST /owner/inventory/requests/:id/reject
```
**Authentication:** Required  
**Permissions:** `menu_update`  
**Body:**
```json
{
  "rejection_note": "Item not in budget this month"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Request rejected"
}
```

## Frontend Implementation

### Manager App Components

#### New Files Created
- `manager/src/api/inventoryRequestApi.js` - API client
- `manager/src/pages/InventoryRequests.jsx` - Main UI component

#### Features

**For All Users (Staff & Owners):**
- Submit new inventory requests
- View own request history
- See request status (Pending, Approved, Rejected)
- View rejection notes if applicable

**For Owners Only:**
- View all requests from all staff
- Filter by status (All, Pending, Approved, Rejected)
- Approve pending requests
- Reject pending requests with optional note
- See who submitted each request
- Track who reviewed each request

#### Navigation
- Added to Bar Operations group
- Route: `/inventory-requests`
- Icon: ClipboardCheck
- No permission requirements (accessible to all staff)

## Workflow

### Staff Workflow
1. Navigate to "Inventory Requests" in sidebar
2. Click "New Request" button
3. Fill in form:
   - Item Name (required)
   - Quantity Needed (required)
   - Unit (dropdown, required)
   - Reason (optional)
4. Submit request
5. Request appears in "My Requests" with "Pending" status
6. Wait for owner review
7. Check status updates (Approved/Rejected)
8. If rejected, view rejection note

### Owner Workflow
1. Navigate to "Inventory Requests" in sidebar
2. Switch to "All Requests" tab
3. View pending requests at the top
4. For each pending request:
   - Review item name, quantity, unit, and reason
   - See who submitted the request
   - Click "Approve" to approve
   - Click "Reject" to open rejection modal
   - Optionally add rejection note
5. Approved requests move to "Approved" status
6. Rejected requests move to "Rejected" status
7. Staff can see updated status immediately

## Status Flow

```
Pending → Approved (by owner)
        ↓
        Rejected (by owner with optional note)
```

**Status Badges:**
- **Pending** - Yellow badge with clock icon
- **Approved** - Green badge with check icon
- **Rejected** - Red badge with X icon

## Testing Checklist

### Database
- [ ] Run migration successfully
- [ ] Verify table structure
- [ ] Check foreign key constraints
- [ ] Test cascade deletes

### Backend API
- [ ] Staff can submit requests
- [ ] Staff can view own requests
- [ ] Owner can view all requests
- [ ] Owner can filter by status
- [ ] Owner can approve requests
- [ ] Owner can reject requests with note
- [ ] Audit logs are created for all actions

### Manager App - Staff View
- [ ] Can access Inventory Requests page
- [ ] Can submit new request
- [ ] Form validation works
- [ ] Unit dropdown shows all options
- [ ] Can view own request history
- [ ] Status badges display correctly
- [ ] Rejection notes are visible

### Manager App - Owner View
- [ ] Can switch between "My Requests" and "All Requests"
- [ ] Can filter by status (All, Pending, Approved, Rejected)
- [ ] Pending requests show at top
- [ ] Can see requester information
- [ ] Approve button works
- [ ] Reject modal opens
- [ ] Can add rejection note
- [ ] Status updates immediately after action

### Permissions
- [ ] All staff can submit requests (no permission required)
- [ ] All staff can view own requests
- [ ] Only users with `menu_view` can see all requests
- [ ] Only users with `menu_update` can approve/reject

## Notes

- Requests are sorted with pending first, then by creation date
- Once approved or rejected, requests cannot be changed
- Rejection notes are optional but recommended for clarity
- All actions are logged in audit trail
- Staff can submit unlimited requests
- No automatic inventory updates (manual process after approval)

## Future Enhancements (Not Implemented)

- Automatic inventory stock updates on approval
- Email notifications for status changes
- Request expiration after X days
- Bulk approve/reject functionality
- Request history analytics
- Integration with reorder level alerts
