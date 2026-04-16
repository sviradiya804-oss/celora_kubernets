# Group-wise RBAC System Implementation

## Overview
This system implements hierarchical, group-based Role-Based Access Control (RBAC) where pages and their related APIs are organized into groups. When a user loses permission to a parent group, they automatically lose access to all child APIs within that group.

## Key Features

### 1. **Hierarchical Permissions**
- **Parent Groups**: Main page categories (e.g., "Price Management")
- **Child APIs**: Individual endpoints within each group (e.g., "exchangerate", "metalprice")
- **Inheritance**: Removing group permission denies access to all child APIs

### 2. **GUEST User Support**
- Maintains existing GUEST user functionality
- GUEST users can access public resources (categories, products, blogs) for website viewing
- Automatic fallback to GUEST role for unauthenticated users

### 3. **Flexible Permission Checking**
- Direct resource permission check
- Group-level permission check (if no direct permission)
- Public resource access for GUEST users

## Directory Structure

```
src/
├── config/
│   └── permissionGroups.js          # Group mappings and configurations
├── middlewares/
│   └── groupPermissionMiddleware.js  # Enhanced permission checking logic
├── routes/
│   └── groupPermissionRoutes.js      # API endpoints for managing group permissions
└── models/
    ├── Role.js                       # Updated role schema with group support
    └── schema.js                     # Updated schema with group field
```

## Page Groups Configuration

The system organizes your pages into the following groups:

### Management Groups
- **Dashboard**: `dashboard`
- **Order Management**: `order`, `ordertracking`, `orderhistory`, `orderupdate`, `orderstatus`
- **Diamonds**: `diamond`, `helddiamond`, `shape`, `diamondimport`, `diamondexport`
- **Price Management**: `exchangerate`, `metalprice`, `otherprice`, `labourcost`, `diamondmarkup`, `diamondrate`

### Product & Content Groups  
- **Jewelry**: `jewelry`, `jewelrystyle`, `addjewelry`, `productcategory`, `productsubcategory`, `collection`
- **Product Management**: `category`, `subcategory`, `highlightproducts`, `inventory`, `product`
- **Content Management**: `faq`, `inquiry`, `banner`, `blog`, `addblog`, `bloglist`, `contactus`

### User & System Groups
- **User Management**: `user`, `retailer`, `subscribers`, `userlist`, `role`, `permission`, `auth`
- **Vendor Management**: `vendor`, `kyc`, `vendorverification`, `vendordocument`
- **Marketing**: `coupon`, `fulldiscount`, `topheaderintro`, `intropropup`, `promotionalstripe`, `discount`
- **Configuration**: `caratsize`, `packaging`, `socialposts`, `virtualappointments`, `relation`, `occasion`

### E-commerce Groups
- **Wishlist**: `wishlist`
- **Cart**: `cart`  
- **Payment**: `payment`, `stripe`, `checkout`

## Setup Instructions

### 1. **Initialize Database**
Run the setup script to configure GUEST and ADMIN permissions:

```bash
# Setup GUEST permissions for public access
node setup-group-permissions.js guest

# Setup ADMIN group permissions
node setup-group-permissions.js admin

# Setup both
node setup-group-permissions.js all
```

### 2. **Schema Updates**
The role schema now includes a `group` field in permissions:

```javascript
permissions: [{
  resource: String,     // API endpoint or group name
  actions: [String],    // ['create', 'read', 'update', 'delete']
  group: String         // Parent group (optional)
}]
```

### 3. **API Endpoints**
New endpoints for managing group permissions:

- `GET /api/permissions/groups` - List all page groups
- `GET /api/permissions/roles/:roleId/permissions` - Get role permissions grouped
- `PUT /api/permissions/roles/:roleId/permissions` - Update role permissions
- `POST /api/permissions/roles/:roleId/groups/:groupName` - Add/remove group permission

## How It Works

### Permission Check Flow
1. **Direct Permission**: Check if user has direct permission for the specific API
2. **Group Permission**: If no direct permission, check if user has permission for the parent group
3. **GUEST Access**: For unauthenticated users, check if it's a public resource
4. **Deny Access**: If none of the above, deny access

### Example Scenarios

#### Scenario 1: Price Management Group
```javascript
// Admin has group permission
{
  resource: "pricemanagement",
  actions: ["create", "read", "update", "delete"],
  group: null  // This is a parent group
}

// User tries to access: GET /api/exchangerate
// Result: ✅ Allowed (exchangerate belongs to pricemanagement group)
```

#### Scenario 2: Individual API Permission
```javascript
// User has specific API permission
{
  resource: "exchangerate", 
  actions: ["read"],
  group: "pricemanagement"
}

// User tries to access: POST /api/metalprice
// Result: ❌ Denied (no permission for metalprice or pricemanagement group)
```

#### Scenario 3: GUEST Public Access
```javascript
// GUEST user (unauthenticated)
// Tries to access: GET /api/jewelry
// Result: ✅ Allowed (jewelry is in GUEST_PUBLIC_RESOURCES)

// Tries to access: POST /api/jewelry  
// Result: ❌ Denied (only read access for public resources)
```

## Migration Guide

### From Old System
1. **Backup existing roles**: Export current role permissions
2. **Run setup script**: Initialize group permissions
3. **Update middleware**: Routes now use `groupPermissionMiddleware`
4. **Test permissions**: Verify existing functionality works
5. **Assign group permissions**: Update roles to use group-based permissions

### Role Permission Examples

#### ADMIN Role (Full Access)
```javascript
permissions: [
  { resource: "dashboard", actions: ["create", "read", "update", "delete"] },
  { resource: "ordermanagement", actions: ["create", "read", "update", "delete"] },
  { resource: "pricemanagement", actions: ["create", "read", "update", "delete"] },
  // ... all groups
]
```

#### MANAGER Role (Limited Groups)
```javascript
permissions: [
  { resource: "dashboard", actions: ["read"] },
  { resource: "ordermanagement", actions: ["read", "update"] },
  { resource: "jewelry", actions: ["create", "read", "update"] },
  { resource: "contentmanagement", actions: ["read", "update"] }
]
```

#### USER Role (Specific APIs)
```javascript
permissions: [
  { resource: "dashboard", actions: ["read"] },
  { resource: "jewelry", actions: ["read"] },
  { resource: "wishlist", actions: ["create", "read", "update", "delete"], group: "wishlist" }
]
```

#### GUEST Role (Public Access)
```javascript
permissions: [
  { resource: "jewelry", actions: ["read"], group: "jewelry" },
  { resource: "category", actions: ["read"], group: "productmanagement" },
  { resource: "blog", actions: ["read"], group: "contentmanagement" },
  // ... all public resources
]
```

## Testing

### Test Group Permission Inheritance
```bash
# 1. Create a role with only group permission
curl -X PUT /api/permissions/roles/ROLE_ID/permissions \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "groupPermissions": {
      "pricemanagement": {
        "enabled": true,
        "actions": ["read", "update"]
      }
    }
  }'

# 2. Test access to child APIs
curl -X GET /api/exchangerate -H "Authorization: Bearer TOKEN"  # ✅ Should work
curl -X GET /api/metalprice -H "Authorization: Bearer TOKEN"    # ✅ Should work  
curl -X POST /api/otherprice -H "Authorization: Bearer TOKEN"   # ❌ Should fail (no create)
```

### Test GUEST Public Access
```bash
# Public resource (should work without authentication)
curl -X GET /api/jewelry

# Private resource (should fail without authentication) 
curl -X POST /api/jewelry
```

## Benefits

1. **Simplified Management**: Manage permissions at group level instead of individual APIs
2. **Inheritance**: Remove group permission automatically denies all child APIs
3. **Scalable**: Easy to add new APIs to existing groups
4. **Backward Compatible**: Existing individual permissions still work
5. **GUEST Support**: Maintains public access for website functionality
6. **Flexible**: Supports both group and individual permission models

## Troubleshooting

### Common Issues

1. **Permission Denied Errors**
   - Check if user has either direct API permission or parent group permission
   - Verify group mappings in `permissionGroups.js`
   - Check GUEST role for public resources

2. **GUEST Access Issues**
   - Run `node setup-group-permissions.js guest` to refresh GUEST permissions
   - Check if resource is in `GUEST_PUBLIC_RESOURCES` array

3. **Group Not Working**
   - Verify group exists in `PAGE_GROUPS` configuration
   - Check if API is mapped to correct group in `RESOURCE_TO_GROUP`

### Debug Mode
Enable detailed logging in the middleware:
```javascript
// In groupPermissionMiddleware.js, uncomment console.log statements
console.log(`[Auth] Checking permission: ${action} ${resource} (group: ${group})`);
```
