# Role Management System - Individual Permission Editing

## Overview

The Role Management System provides comprehensive APIs for editing individual role permissions in your RBAC (Role-Based Access Control) system. This allows administrators to granularly manage permissions for each role without affecting the broader group-based permission structure.

## Key Features

✅ **Individual Role Permission Editing** - Edit permissions for specific roles  
✅ **Add/Remove Permissions** - Granular control over role capabilities  
✅ **Update Permission Actions** - Modify specific actions for resources  
✅ **Bulk Permission Updates** - Efficiently update multiple permissions at once  
✅ **Role Creation & Management** - Create new roles with custom permissions  
✅ **User Association Tracking** - See which users are assigned to each role  

## API Endpoints

### Base URL: `/api/role-management`

| Method | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/roles` | List all roles with permission details |
| `GET` | `/roles/:id` | Get specific role details with users |
| `POST` | `/roles` | Create new role with permissions |
| `PUT` | `/roles/:id/permissions` | Bulk update role permissions |
| `POST` | `/roles/:id/permissions/add` | Add specific permission to role |
| `PATCH` | `/roles/:id/permissions/:resource` | Update permission actions |
| `DELETE` | `/roles/:id/permissions/:resource` | Remove specific permission |
| `GET` | `/available-permissions` | List all available permissions and groups |

## Authentication & Authorization

- **Authentication Required**: All endpoints require valid JWT token
- **Admin Access Only**: Only users with Admin role can access these endpoints
- **Header Format**: `Authorization: Bearer <your_jwt_token>`

## Usage Examples

### 1. List All Roles

```bash
curl -X GET "http://localhost:3000/api/role-management/roles" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "roles": [
    {
      "_id": "role_id_here",
      "name": "Manager",
      "description": "Manager role with limited permissions",
      "permissions": [
        {
          "resource": "products",
          "actions": ["read", "update"]
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 2. Get Role Details

```bash
curl -X GET "http://localhost:3000/api/role-management/roles/ROLE_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "role": {
    "_id": "role_id_here",
    "name": "Manager",
    "description": "Manager role",
    "permissions": [
      {
        "resource": "products",
        "actions": ["read", "update"]
      }
    ],
    "users": [
      {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com"
      }
    ]
  }
}
```

### 3. Add Permission to Role

```bash
curl -X POST "http://localhost:3000/api/role-management/roles/ROLE_ID/permissions/add" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "inventory",
    "actions": ["read", "update"]
  }'
```

### 4. Update Permission Actions

```bash
curl -X PATCH "http://localhost:3000/api/role-management/roles/ROLE_ID/permissions/inventory" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actions": ["read", "create", "update", "delete"]
  }'
```

### 5. Remove Permission from Role

```bash
curl -X DELETE "http://localhost:3000/api/role-management/roles/ROLE_ID/permissions/inventory" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 6. Bulk Update Role Permissions

```bash
curl -X PUT "http://localhost:3000/api/role-management/roles/ROLE_ID/permissions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": [
      {
        "resource": "products",
        "actions": ["read", "create", "update"]
      },
      {
        "resource": "orders",
        "actions": ["read", "update"]
      },
      {
        "resource": "customers",
        "actions": ["read"]
      }
    ]
  }'
```

### 7. Create New Role

```bash
curl -X POST "http://localhost:3000/api/role-management/roles" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Manager",
    "description": "Custom role with specific permissions",
    "permissions": [
      {
        "resource": "products",
        "actions": ["read", "update"]
      },
      {
        "resource": "orders",
        "actions": ["read"]
      }
    ]
  }'
```

## Available Resources & Actions

### Standard Resources:
- `products` - Product catalog management
- `orders` - Order processing and tracking
- `customers` - Customer information management
- `inventory` - Inventory tracking and management
- `reports` - Analytics and reporting
- `settings` - System configuration
- `users` - User account management
- `payments` - Payment processing
- `shipping` - Shipping and logistics
- `marketing` - Marketing campaigns and tools

### Standard Actions:
- `read` - View/retrieve data
- `create` - Add new records
- `update` - Modify existing records
- `delete` - Remove records
- `manage` - Full administrative control

## Testing

### 1. Using the Test Script

```bash
cd /Users/vats/celora_github/celora-Backend
node test-role-management.js
```

### 2. Using Postman Collection

1. Import `Role-Management-System.postman_collection.json`
2. Set environment variable `base_url` to `http://localhost:3000`
3. Run the collection to test all endpoints

### 3. Manual Testing with curl

Use the curl examples above with your actual JWT token.

## Integration with Existing RBAC

The Role Management System works alongside your existing group-based permissions:

1. **Group Permissions** - Broad access control by page groups
2. **Individual Role Permissions** - Granular resource-level control
3. **Combined Security** - Both systems work together for comprehensive access control

## Error Handling

The API returns standard HTTP status codes:

- `200` - Success
- `201` - Created successfully
- `400` - Bad request (validation errors)
- `401` - Unauthorized (no token)
- `403` - Forbidden (not admin)
- `404` - Role not found
- `409` - Conflict (duplicate permission)
- `500` - Internal server error

## Security Considerations

1. **Admin Only Access** - All endpoints require Admin role
2. **JWT Token Validation** - Tokens are verified on every request
3. **Input Validation** - All inputs are validated and sanitized
4. **Permission Conflicts** - System prevents duplicate permissions
5. **Audit Trail** - All changes are logged for security monitoring

## Next Steps

1. **Frontend Integration** - Build UI components for role management
2. **Permission Templates** - Create common permission sets for quick assignment
3. **Bulk User Assignment** - Tools for assigning roles to multiple users
4. **Permission Inheritance** - Hierarchical permission structures
5. **Audit Dashboard** - Track permission changes and usage analytics

---

**🎉 Your Role Management System is now ready for individual permission editing!**

The system provides comprehensive APIs for granular role permission management while maintaining the security and structure of your existing RBAC implementation.
