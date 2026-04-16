const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// Safe way to import Role model without causing OverwriteModelError
const Role = mongoose.models.Role || mongoose.model('Role', require('../models/Role').schema);

// Enhanced permission middleware that uses JWT permissions first
const enhancedCheckPermission = (action) => {
  return async (req, res, next) => {
    try {
      let effectivePermissions = [];
      let permissionsSource = 'unknown';
      let user = req.user;

      // Step 1: Try to get permissions from JWT token first (fastest)
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          if (decoded.permissions && Array.isArray(decoded.permissions)) {
            effectivePermissions = decoded.permissions;
            permissionsSource = decoded.permissionsSource || 'jwt';
            
            // Quick permission check using JWT data
            const hasPermission = checkPermissionInArray(effectivePermissions, req.params.indexName, action);
            if (hasPermission) {
              return next();
            }
            
            // Check for SUPERADMIN in JWT
            if (decoded.roleName === 'SUPERADMIN') {
              return next();
            }
          }
        } catch (jwtError) {
          // JWT decode failed, continue with database fallback
          console.log('JWT permission check failed, falling back to database');
        }
      }

      // Step 2: Database fallback for security and consistency
      if (!user) {
        const guestRole = await Role.findOne({ name: 'GUEST' });
        if (!guestRole) {
          return res.status(403).json({ message: 'Access denied: GUEST role not defined' });
        }
        user = { _id: null, role: guestRole, permissions: [] };
        effectivePermissions = guestRole.permissions || [];
        permissionsSource = 'guest_role';
      } else {
        const populatedUser = await User.findById(user._id).populate('role');
        if (!populatedUser) {
          return res.status(401).json({ message: 'Unauthorized: User not found' });
        }
        
        if (!populatedUser.role) {
          const guestRole = await Role.findOne({ name: 'GUEST' });
          if (!guestRole) {
            return res.status(403).json({ message: 'Access denied: GUEST role not defined' });
          }
          populatedUser.role = guestRole;
        }
        
        user = populatedUser;
        
        // Determine effective permissions (user permissions take precedence)
        if (user.permissions && user.permissions.length > 0) {
          effectivePermissions = user.permissions;
          permissionsSource = user.permissionsSource || 'custom';
        } else {
          effectivePermissions = user.role.permissions || [];
          permissionsSource = 'role';
        }
      }

      // Step 3: Check SUPERADMIN role (always has access)
      if (user.role && user.role.name === 'SUPERADMIN') {
        return next();
      }

      // Step 4: Check permissions
      const resource = req.params.indexName;
      const hasPermission = checkPermissionInArray(effectivePermissions, resource, action);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: "Forbidden: You don't have permission.",
          resource,
          action,
          permissionsSource,
          effectivePermissionsCount: effectivePermissions.length
        });
      }

      // Add permission info to request for debugging
      req.permissionInfo = {
        resource,
        action,
        permissionsSource,
        effectivePermissions: effectivePermissions.length,
        hasAccess: true
      };

      return next();
    } catch (err) {
      console.error('Error in enhancedCheckPermission middleware:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
};

// Helper function to check if permission exists in array
const checkPermissionInArray = (permissions, resource, action) => {
  if (!Array.isArray(permissions) || !resource || !action) {
    return false;
  }

  return permissions.some(permission => {
    if (permission.resource === 'all') {
      // Universal access
      return true;
    }
    
    if (permission.resource === resource) {
      return Array.isArray(permission.actions) && permission.actions.includes(action);
    }
    
    return false;
  });
};

// Normalize permissions into { resource, actions: [] } format
const normalizePermissions = (perms) => {
  const out = [];
  if (!Array.isArray(perms)) return out;
  
  perms.forEach((p) => {
    if (!p) return;
    
    if (typeof p === 'string') {
      const [resource, action] = p.split(':');
      if (action) {
        out.push({ resource, actions: [action] });
      } else {
        out.push({ resource, actions: [] });
      }
    } else if (typeof p === 'object') {
      const resource = p.resource || p.name || p.resourceName;
      const actions = Array.isArray(p.actions) ? p.actions : (p.actions ? [p.actions] : []);
      if (resource) {
        out.push({ resource, actions });
      }
    }
  });
  
  return out;
};

// Role-based permission check (unchanged for backward compatibility)
const checkRolePermission = (...roles) => {
  const normalized = roles.map((r) => String(r).toUpperCase());
  
  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Access denied: no user', 403));
    }

    const userRole = req.user.role;
    const roleName = userRole && userRole.name ? String(userRole.name).toUpperCase() : null;
    const roleId = userRole && userRole._id ? String(userRole._id) : null;

    if (roleName && normalized.includes(roleName)) return next();
    if (roleId && normalized.includes(roleId.toUpperCase())) return next();

    return next(
      new ErrorResponse(`Access denied for role: ${roleName || roleId || 'unknown'}`, 403)
    );
  };
};

// Legacy checkPermission (for backward compatibility)
const checkPermission = (action) => {
  return async (req, res, next) => {
    try {
      let user = req.user;

      if (!user) {
        const guestRole = await Role.findOne({ name: 'GUEST' });
        if (!guestRole)
          return res.status(403).json({ message: 'Access denied: GUEST role not defined' });
        user = { _id: null, role: guestRole, permissions: [] };
      } else {
        const populatedUser = await User.findById(user._id).populate('role');
        if (!populatedUser)
          return res.status(401).json({ message: 'Unauthorized: User not found' });
        if (!populatedUser.role) {
          const guestRole = await Role.findOne({ name: 'GUEST' });
          if (!guestRole)
            return res.status(403).json({ message: 'Access denied: GUEST role not defined' });
          populatedUser.role = guestRole;
        }
        user = populatedUser;
      }

      const resource = req.params.indexName;

      const rolePerms = normalizePermissions(user.role?.permissions || []);
      const userPerms = normalizePermissions(user.permissions || []);

      // Build permission map: resource -> Set(actions)
      const permissionMap = new Map();
      const apply = (perms) => {
        perms.forEach((p) => {
          const resKey = String(p.resource);
          const set = permissionMap.get(resKey) || new Set();
          (p.actions || []).forEach((a) => set.add(a));
          permissionMap.set(resKey, set);
        });
      };

      apply(rolePerms);
      apply(userPerms); // user permissions additive

      const actionsForResource = permissionMap.get(resource) || new Set();
      if (!actionsForResource.has(action)) {
        return res.status(403).json({ message: "Forbidden: You don't have permission." });
      }

      return next();
    } catch (err) {
      console.error('Error in checkPermission middleware:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
};

// Get effective permissions for a user
const getEffectivePermissions = async (userId) => {
  try {
    const user = await User.findById(userId).populate('role');
    
    if (!user) {
      return [];
    }

    // If user has custom permissions, use those
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions;
    }

    // Otherwise, use role permissions
    return user.role ? user.role.permissions : [];
  } catch (error) {
    console.error('Error getting effective permissions:', error);
    return [];
  }
};

module.exports = { 
  checkRolePermission, 
  checkPermission, 
  enhancedCheckPermission,
  normalizePermissions,
  checkPermissionInArray,
  getEffectivePermissions
};
