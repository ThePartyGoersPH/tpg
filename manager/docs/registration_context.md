# Registration Context — Platform Bar System
## Super Admin Reference Document

---

## 1. Fields Collected During Registration

### Step 1 — Owner Account (`business_registrations` table)

| Form Field        | Column                  | Type           | Notes                          |
|-------------------|-------------------------|----------------|--------------------------------|
| First Name        | `owner_first_name`      | VARCHAR(80)    | Required                       |
| Last Name         | `owner_last_name`       | VARCHAR(80)    | Required                       |
| Email Address     | `owner_email`           | VARCHAR(150)   | Required, unique, normalized   |
| Phone Number      | `owner_phone`           | VARCHAR(30)    | Optional                       |
| Password          | `owner_password`        | VARCHAR(255)   | bcrypt hashed, never displayed |

### Step 2 — Bar Details (`business_registrations` table)

| Form Field        | Column                  | Type           | Notes                            |
|-------------------|-------------------------|----------------|----------------------------------|
| Bar Name          | `business_name`         | VARCHAR(150)   | Required                         |
| Bar Address       | `business_address`      | TEXT           | Required                         |
| City              | `business_city`         | VARCHAR(100)   | Required                         |
| Bar Description   | `business_description`  | TEXT           | Optional                         |
| Opening Time      | `opening_time`          | VARCHAR(30)    | e.g. "6:00 PM"                   |
| Closing Time      | `closing_time`          | VARCHAR(30)    | e.g. "2:00 AM"                   |
| GCash Number      | `gcash_number`          | VARCHAR(30)    | Optional                         |
| GCash Name        | `gcash_name`            | VARCHAR(255)   | Optional, registered GCash name  |

### Step 3 — Business Documents (`business_registrations` table)

| Form Field         | Column             | Type         | Notes                              |
|--------------------|--------------------|--------------|------------------------------------|
| BIR Certificate    | `bir_certificate`  | VARCHAR(500) | File path on server, required      |
| Business Permit    | `business_permit`  | VARCHAR(500) | File path on server, required      |

---

## 2. Document Storage

- **Upload destination:** `uploads/registration_docs/` (relative to backend root)
- **Accepted formats:** JPG, PNG, PDF
- **Max file size:** 5 MB per file
- **Filename format:** `{fieldname}_{timestamp}_{random}.{ext}`
  - e.g. `bir_certificate_1742620800000_x7k2pq.pdf`
- **How to serve:** Files are accessible via static URL:
  ```
  GET http://localhost:3000/uploads/registration_docs/{filename}
  ```
  Configured via `app.use("/uploads", express.static("uploads"))` in `index.js`
- **Value stored in DB:** Relative path, e.g. `uploads/registration_docs/bir_certificate_1742620800000_x7k2pq.pdf`

---

## 3. Registration Status Flow

```
Owner Submits Form + Documents
        ↓
status = 'pending'
(stored in business_registrations)
        ↓
Super Admin Reviews: name, bar info, documents
        ↓
    ┌───────┴────────┐
 APPROVE           REJECT
    ↓                 ↓
status = 'approved'  status = 'rejected'
    ↓                 ↓
Backend creates:    Owner sees rejection
- users row           notice on login
- bars row
- bar_documents row
Owner can log in
```

**Status values:** `pending` | `approved` | `rejected`

**Important:** When a `pending` or `rejected` email tries to log in, the existing `/auth/login` endpoint already returns specific error codes:
- `REGISTRATION_PENDING` → "Your business registration is currently under review."
- `REGISTRATION_REJECTED` → "Your business registration was not approved."

---

## 4. What Super Admin Needs to Fetch for Review

### Full registration record includes:

**Owner Info:**
- `owner_first_name`, `owner_last_name`
- `owner_email`
- `owner_phone`

**Bar Info:**
- `business_name` (bar name)
- `business_address`
- `business_city`
- `business_description`
- `opening_time`, `closing_time`
- `gcash_number`, `gcash_name`

**Documents (viewable/downloadable):**
- `bir_certificate` → served at `GET /uploads/{bir_certificate_path}`
- `business_permit` → served at `GET /uploads/{business_permit_path}`

**Meta:**
- `id` (registration ID)
- `status`
- `created_at` (registration date)
- `reviewed_by`, `reviewed_at`, `rejection_reason`

---

## 5. API Endpoints for Super Admin

### List all pending registrations
```
GET /super-admin/registrations
```
**Query params:** `?status=pending` (or `approved`, `rejected`, `all`)

### Get full registration details
```
GET /super-admin/registrations/:id
```
**Returns:** All fields + document URLs

### Approve a registration
```
PATCH /super-admin/registrations/:id/approve
```
**Effect:**
1. Creates `users` row with `role = 'bar_owner'`, `is_active = 1`
2. Creates `bars` row linked to new user
3. Updates `business_registrations.status = 'approved'`

### Reject a registration
```
PATCH /super-admin/registrations/:id/reject
Body: { "reason": "Documents are unclear or expired." }
```
**Effect:**
1. Updates `business_registrations.status = 'rejected'`
2. Stores `rejection_reason`

---

## 6. Document Viewing

Files are served from the backend static file server:

```
Base URL: http://localhost:3000
Documents path: /uploads/registration_docs/

Example:
  BIR:    http://localhost:3000/uploads/registration_docs/bir_certificate_1742620800000_x7k2pq.pdf
  Permit: http://localhost:3000/uploads/registration_docs/business_permit_1742620800001_abc123.jpg
```

To build the URL from a DB value:
```javascript
const BASE_URL = process.env.VITE_API_URL || 'http://localhost:3000';
const birUrl = `${BASE_URL}/${registration.bir_certificate}`;
const permitUrl = `${BASE_URL}/${registration.business_permit}`;
```

Super admin can:
- Open image files directly in a browser/modal
- Download PDF files via anchor tag with `download` attribute

---

## 7. Expected API Response Shapes

### `GET /super-admin/registrations`
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "business_name": "Eclipse Bar",
      "business_city": "Quezon City",
      "owner_first_name": "Marco",
      "owner_last_name": "Reyes",
      "owner_email": "marco@eclipsebar.ph",
      "owner_phone": "09171234567",
      "status": "pending",
      "created_at": "2025-03-22T08:00:00.000Z"
    }
  ],
  "total": 1
}
```

### `GET /super-admin/registrations/:id`
```json
{
  "success": true,
  "data": {
    "id": 5,
    "owner_first_name": "Marco",
    "owner_last_name": "Reyes",
    "owner_email": "marco@eclipsebar.ph",
    "owner_phone": "09171234567",
    "business_name": "Eclipse Bar",
    "business_address": "123 Katipunan Ave, UP Campus",
    "business_city": "Quezon City",
    "business_description": "A premium bar for night owls.",
    "opening_time": "7:00 PM",
    "closing_time": "3:00 AM",
    "gcash_number": "09171234567",
    "gcash_name": "Marco Reyes",
    "bir_certificate": "uploads/registration_docs/bir_certificate_1742620800000_x7k2pq.pdf",
    "business_permit": "uploads/registration_docs/business_permit_1742620800001_abc123.jpg",
    "bir_certificate_url": "http://localhost:3000/uploads/registration_docs/bir_certificate_1742620800000_x7k2pq.pdf",
    "business_permit_url": "http://localhost:3000/uploads/registration_docs/business_permit_1742620800001_abc123.jpg",
    "status": "pending",
    "rejection_reason": null,
    "reviewed_by": null,
    "reviewed_at": null,
    "created_at": "2025-03-22T08:00:00.000Z"
  }
}
```

### `PATCH /super-admin/registrations/:id/approve` (success)
```json
{
  "success": true,
  "message": "Registration approved. Bar owner account created.",
  "data": {
    "user_id": 25,
    "bar_id": 15
  }
}
```

### `PATCH /super-admin/registrations/:id/reject` (success)
```json
{
  "success": true,
  "message": "Registration rejected."
}
```

---

## 8. Database Tables Summary

### `business_registrations` (existing + extended)
Primary table for all pending bar owner registrations.

Key columns added by migration `add_bar_owner_registration_fields.sql`:
- `business_description` TEXT
- `opening_time` VARCHAR(30)
- `closing_time` VARCHAR(30)
- `gcash_number` VARCHAR(30)
- `gcash_name` VARCHAR(255)
- `bir_certificate` VARCHAR(500)
- `business_permit` VARCHAR(500)

### `users` (existing)
Created when a registration is **approved**:
- `role = 'bar_owner'`
- `is_active = 1`
- `bar_id` linked to new bars row

### `bars` (existing)
Created when a registration is **approved**:
- Populated from `business_name`, `business_address`, `business_city`, etc.
- `owner_id` linked to new users row
- `status = 'active'`

---

## 9. Migration Required

Run this SQL before the registration flow is used:

```
thesis-backend/migrations/add_bar_owner_registration_fields.sql
```

Command (from thesis-backend directory):
```bash
mysql -u root -p your_database_name < migrations/add_bar_owner_registration_fields.sql
```

---

## 10. Frontend Routes

| Route       | Component        | Access     |
|-------------|------------------|------------|
| `/`         | LandingPage.jsx  | Public     |
| `/login`    | Login.jsx        | Public     |
| `/register` | Register.jsx     | Public     |
| `/dashboard`| Dashboard.jsx    | Auth only  |

---

*Generated: March 2026 — Platform Bar System*
