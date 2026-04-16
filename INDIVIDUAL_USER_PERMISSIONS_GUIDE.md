# Individual User Permission Management Guide

## Overview

The RBAC system now supports **individual user permissions** that work alongside role-based permissions. This means you can:

1. Assign a role to a user (e.g., Manager)
2. Add additional individual permissions beyond the role
3. Edit specific permissions for individual users
4. Combine role permissions with user-specific permissions

## Key Features

### ✅ **Role + Individual Permissions**
- Users get their role's default permissions
- Plus any additional individual permissions you assign
- Individual permissions are **additive** (they don't replace role permissions)

### ✅ **Granular Permission Control**
- Add specific resources and actions to individual users
- Update actions for existing permissions
- Remove individual permissions when no longer needed

### ✅ **Effective Permission Calculation**
- System automatically combines role + individual permissions
- Shows you the complete effective permissions for each user
- Clearly indicates which permissions come from role vs individual assignment

## API Endpoints

### User Management

#### List All Users with Permissions
```http
GET /api/user-permissions/users
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "users": [
    {
      "_id": "user_id",
      "name": "Demo User",
      "email": "demo@yopmail.com",
      "role": {
        "_id": "role_id",
        "name": "MANAGER",
        "permissions": [...]
      },
      "individualPermissions": [
        {
          "resource": "dashboard",
          "actions": ["read", "analytics"]
        }
      ]
    }
  ]
}
```

#### Get User Details with Effective Permissions
```http
GET /api/user-permissions/users/{userId}
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "user_id",
    "name": "Demo User",
    "email": "demo@yopmail.com",
    "role": {
      "name": "MANAGER",
      "permissions": [...]
    },
    "individualPermissions": [
      {
        "resource": "dashboard",
        "actions": ["read", "analytics"]
      }
    ],
    "effectivePermissions": [
      {
        "resource": "products",
        "actions": ["read", "create"],
        "source": "role",
        "group": "pricemanagement"
      },
      {
        "resource": "dashboard",
        "actions": ["read", "analytics"],
        "source": "individual",
        "group": "custom"
      }
    ]
  }
}
```

#### Search Users
```http
GET /api/user-permissions/users/search?q=demo@yopmail.com
Authorization: Bearer {admin_token}
```

### Individual Permission Management

#### Add Individual Permission to User
```http
POST /api/user-permissions/users/{userId}/permissions/add
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "resource": "dashboard",
  "actions": ["read", "analytics"]
}
```

**Use Case:** Give dashboard access to a Manager (Managers don't have dashboard by default)

#### Update Permission Actions
```http
PATCH /api/user-permissions/users/{userId}/permissions/{resource}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "actions": ["read", "analytics", "admin", "export"]
}
```

**Use Case:** Expand dashboard permissions to include admin and export capabilities

#### Remove Individual Permission
```http
DELETE /api/user-permissions/users/{userId}/permissions/{resource}
Authorization: Bearer {admin_token}
```

**Use Case:** Remove dashboard access when user no longer needs it

#### Bulk Update All Individual Permissions
```http
PUT /api/user-permissions/users/{userId}/permissions
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "permissions": [
    {
      "resource": "dashboard",
      "actions": ["read", "analytics"]
    },
    {
      "resource": "reports",
      "actions": ["read", "create", "export"]
    }
  ]
}
```

### Role Management

#### Change User Role
```http
POST /api/user-permissions/users/{userId}/role
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "roleId": "manager_role_id"
}
```

#### Get Available Permissions
```http
GET /api/user-permissions/available-permissions
Authorization: Bearer {admin_token}
```

## Step-by-Step Example

### Scenario: Give Manager Role to demo@yopmail.com + Dashboard Access

#### Step 1: Find the User
```bash
curl -X GET "http://localhost:3000/api/user-permissions/users/search?q=demo@yopmail.com" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Step 2: Check Current Permissions
```bash
curl -X GET "http://localhost:3000/api/user-permissions/users/USER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Step 3: Assign Manager Role (if not already)
```bash
curl -X POST "http://localhost:3000/api/user-permissions/users/USER_ID/role" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roleId": "MANAGER_ROLE_ID"
  }'
```

#### Step 4: Add Dashboard Permission (Manager doesn't have this)
```bash
curl -X POST "http://localhost:3000/api/user-permissions/users/USER_ID/permissions/add" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "dashboard",
    "actions": ["read", "analytics"]
  }'
```

#### Step 5: Verify Final Permissions
```bash
curl -X GET "http://localhost:3000/api/user-permissions/users/USER_ID" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

The user now has:
- ✅ All Manager role permissions (products, orders, etc.)
- ✅ Additional dashboard permission (read, analytics)
- ✅ Combined effective permissions from both sources

## Permission Sources

The system tracks where each permission comes from:

- **`role`** - Permission comes from the user's assigned role
- **`individual`** - Permission was specifically assigned to this user
- **`role + individual`** - Permission exists in both role and individual (actions combined)

## Important Notes

### ✅ **Additive Permissions**
- Individual permissions are **added** to role permissions
- They don't replace or override role permissions
- Actions are combined (union of role + individual actions)

### ✅ **Permission Inheritance**
- Users always get their role's permissions
- Individual permissions extend beyond role permissions
- Changing roles preserves individual permissions

### ✅ **Group-Based Access Control**
- The existing group permission middleware automatically checks both:
  - Role permissions
  - Individual user permissions
- No changes needed to existing route protection

## Testing

Run the comprehensive test script:

```bash
cd /Users/vats/celora_github/celora-Backend
node test-individual-user-permissions.js
```

This will:
1. Search for demo@yopmail.com user
2. Assign Manager role if needed
3. Add dashboard permission individually
4. Add custom permissions beyond role
5. Update and remove permissions
6. Show effective permission calculation

## Frontend Integration Tips

### User Permission Editor UI
```javascript
// Get user details with effective permissions
const response = await fetch(`/api/user-permissions/users/${userId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const userData = await response.json();

// Show role permissions (read-only)
const rolePermissions = userData.user.role.permissions;

// Show individual permissions (editable)
const individualPermissions = userData.user.individualPermissions;

// Show combined effective permissions
const effectivePermissions = userData.user.effectivePermissions;
```

### Add Permission Form
```javascript
const addPermission = async (userId, resource, actions) => {
  await fetch(`/api/user-permissions/users/${userId}/permissions/add`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ resource, actions })
  });
};
```

## Common Use Cases

### 1. **Manager + Dashboard Access**
- Assign Manager role: ✅ products, orders, customers
- Add individual permission: ✅ dashboard (read, analytics)
- Result: Manager can manage products/orders AND view dashboard

### 2. **Employee + Special Report Access**
- Assign Employee role: ✅ basic product read access
- Add individual permission: ✅ reports (read, export)
- Result: Employee can view products AND export reports

### 3. **Vendor + Custom Integration**
- Assign Vendor role: ✅ own products only
- Add individual permission: ✅ api-integration (webhook, sync)
- Result: Vendor can manage products AND use API integrations

### 4. **Temporary Permission Escalation**
- User has Customer role: ✅ basic access
- Add individual permission: ✅ support-tickets (create, read)
- Later remove individual permission when no longer needed
- Result: Flexible temporary access without role changes

## Security Considerations

- ✅ Only admins can manage individual user permissions
- ✅ All permission changes are logged (through user model updates)
- ✅ Individual permissions cannot reduce role permissions (only add)
- ✅ Existing group-based access control works seamlessly
- ✅ Permission verification happens at middleware level

## Migration from Role-Only System

If you're upgrading from a role-only system:

1. ✅ **No breaking changes** - existing role system works as before
2. ✅ **Existing users** - keep their role permissions unchanged  
3. ✅ **New functionality** - individual permissions available when needed
4. ✅ **Backward compatibility** - all existing routes and middleware work

The individual permission system is completely additive and doesn't affect existing functionality.
