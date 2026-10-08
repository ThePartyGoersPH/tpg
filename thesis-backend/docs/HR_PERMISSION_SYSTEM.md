# HR Permission System Documentation

## Overview

The HR permission system provides a shortcut middleware to check for all necessary HR permissions at once. This ensures that users who need to operate as HR have all the required permissions to perform HR tasks effectively.

## Required HR Permissions

To operate as an HR, a user must have ALL of the following permissions:

### Staff Management
- `staff_view` - View list of staff accounts
- `staff_create` - Create new staff accounts  
- `staff_update` - Edit staff profiles and details
- `staff_reset_password` - Reset any employee password
- `staff_edit_permissions` - Edit another staff member permission set
- `staff_deactivate` - Deactivate a staff account
- `staff_delete` - Permanently delete a staff account

### Attendance Management
- `attendance_view_own` - View and manage own time in/time out
- `attendance_view_all` - View attendance records of all staff
- `attendance_create` - Create attendance entries for staff

### Leave Management
- `leave_view_own` - View own leave applications and status
- `leave_apply` - Submit a leave request
- `leave_view_all` - See all leave applications
- `leave_approve` - Approve or decline leave requests

### Payroll Management
- `payroll_view_own` - View own payroll records
- `payroll_view_all` - View all payroll records
- `payroll_create` - Run payroll processing

### Document Management
- `documents_view_own` - View own documents
- `documents_view_all` - View all documents
- `documents_send` - Upload and send documents
- `documents_manage` - Approve and manage documents

## Middleware Usage

### 1. Require All HR Permissions

Use this middleware for routes that require full HR capabilities:

```javascript
const requireHRPermissions = require('../middlewares/requireHRPermissions');

// Apply to HR dashboard or critical HR operations
router.get('/hr/dashboard', requireAuth, requireHRPermissions, async (req, res) => {
  // User has all HR permissions
  res.json({ message: 'Welcome to HR Dashboard' });
});

// Apply to sensitive HR operations
router.post('/hr/process-payroll', requireAuth, requireHRPermissions, async (req, res) => {
  // Process payroll with full HR authority
});
```

### 2. Require Any HR Permissions

Use this middleware for routes that need some HR capabilities but not all:

```javascript
const { requireAnyHR } = require('../middlewares/requireHRPermissions');

// View HR reports (needs either attendance or payroll access)
router.get('/hr/reports', requireAuth, requireAnyHR(['attendance_view_all', 'payroll_view_all']), async (req, res) => {
  // Generate reports based on available permissions
});

// Manage attendance (only needs attendance permissions)
router.get('/hr/attendance-management', requireAuth, requireAnyHR(['attendance_view_all', 'attendance_create']), async (req, res) => {
  // Attendance management interface
});
```

## API Endpoints

### 1. HR Permissions Checklist

Get a detailed checklist of all HR permissions and which ones the user has:

```http
GET /hr/permissions-checklist
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "role": "hr",
      "bar_id": 1
    },
    "hr_readiness_score": 85,
    "can_operate_as_hr": false,
    "missing_essential_permissions": ["staff_delete"],
    "summary": {
      "granted_permissions": 17,
      "total_permissions": 20,
      "missing_permissions": 3
    },
    "checklist": {
      "staff_management": {
        "label": "Staff Management",
        "description": "Create, view, and manage staff accounts",
        "permissions": [
          {
            "code": "staff_view",
            "label": "View Staff List",
            "description": "View list of all staff accounts",
            "granted": true
          },
          // ... more permissions
        ],
        "granted_count": 6,
        "total_count": 7
      },
      // ... more categories
    }
  }
}
```

### 2. HR Operations Summary

Get a summary of what HR operations the user can perform:

```http
GET /hr/operations-summary
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "role": "hr",
      "bar_id": 1
    },
    "operations": [
      {
        "name": "View Staff Directory",
        "permissions": ["staff_view"],
        "category": "staff",
        "can_perform": true
      },
      // ... more operations
    ],
    "operations_by_category": {
      "staff": [
        // ... staff operations
      ],
      "attendance": [
        // ... attendance operations
      ]
    },
    "summary": {
      "total_operations": 7,
      "can_perform": 6,
      "cannot_perform": 1
    }
  }
}
```

## Implementation Examples

### Example 1: Protecting HR Dashboard

```javascript
// routes/hr.js
const requireHRPermissions = require('../middlewares/requireHRPermissions');

router.get('/hr/dashboard', requireAuth, requireHRPermissions, async (req, res) => {
  // Access HR permission info from req.user.hrPermissions
  const { hasAll, missing, present } = req.user.hrPermissions;
  
  // Show dashboard with full HR capabilities
  res.json({
    message: 'HR Dashboard',
    permissions: {
      hasAll,
      missing,
      present
    }
  });
});
```

### Example 2: Conditional Feature Access

```javascript
// routes/hr.js
router.get('/hr/staff-management', requireAuth, requirePermission('staff_view'), async (req, res) => {
  // Check if user has additional HR permissions
  const canCreate = req.user.permissions?.includes('staff_create');
  const canUpdate = req.user.permissions?.includes('staff_update');
  const canDelete = req.user.permissions?.includes('staff_delete');
  
  res.json({
    features: {
      view: true,
      create: canCreate,
      update: canUpdate,
      delete: canDelete
    }
  });
});
```

### Example 3: Frontend Integration

```javascript
// In your React component
const fetchHRChecklist = async () => {
  const response = await fetch('/hr/permissions-checklist', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  
  if (data.success) {
    setHRReadinessScore(data.data.hr_readiness_score);
    setCanOperateAsHR(data.data.can_operate_as_hr);
    setChecklist(data.data.checklist);
  }
};
```

## Security Considerations

1. **SUPER_ADMIN Bypass**: Super admins automatically pass all HR permission checks
2. **Bar Scope**: All HR operations are scoped to the user's bar_id
3. **Permission Resolution**: The system checks user-specific permissions first, then falls back to role permissions
4. **Audit Logging**: All HR permission checks and operations are logged for audit purposes

## Best Practices

1. Use `requireHRPermissions` for critical HR operations that need full HR authority
2. Use `requireAnyHR` for features that need partial HR capabilities
3. Always check the `req.user.hrPermissions` object to understand the user's permission level
4. Use the permissions checklist endpoint to inform users about their HR capabilities
5. Implement proper error handling to guide users when they lack required permissions

## Migration Notes

When upgrading existing HR routes:

1. Replace multiple `requirePermission` calls with `requireHRPermissions` for full HR access
2. Use `requireAnyHR` for routes that previously checked individual HR permissions
3. Update frontend to handle the new permission structure and provide better user feedback
4. Test thoroughly to ensure all HR functionality works with the new permission system
