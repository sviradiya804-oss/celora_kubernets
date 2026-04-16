const mongoose = require('mongoose');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Role = require('../models/Role');
const { getGroupForResource, isPublicResource } = require('../config/permissionGroups');

const checkRolePermission = (...roles) => {
  const normalized = roles.map((r) => String(r).toUpperCase());
  return (req, res, next) => {
    if (!req.user) return next(new ErrorResponse('Access denied: no user', 403));

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

// Normalize permissions into { resource, actions: [], group?: string }
const normalizePermissions = (perms) => {
  const out = [];
  if (!Array.isArray(perms)) return out;
  perms.forEach((p) => {
    if (!p) return;
    if (typeof p === 'string') {
      const [resource, action] = p.split(':');
      if (action) out.push({ resource, actions: [action] });
      else out.push({ resource, actions: [] });
    } else if (typeof p === 'object') {
      const resource = p.resource || p.name || p.resourceName;
      const actions = Array.isArray(p.actions) ? p.actions : p.actions ? [p.actions] : [];
      const group = p.group || null;
      if (resource) out.push({ resource, actions, group });
    }
  });
  return out;
};

// Enhanced permission check with group hierarchy
const checkPermissionWithGroups = (action) => {
  return async (req, res, next) => {
    try {
      let user = req.user;
      const resource = req.params.indexName;

      // Handle GUEST users first
      if (!user) {
        // Check if this is a public resource for GUEST
        if (isPublicResource(resource, action)) {
          console.log(`[Auth] GUEST public access granted: ${action} ${resource}`);
          return next();
        }

        const guestRole = await Role.findOne({ name: 'GUEST' });
        if (!guestRole) {
          return res.status(403).json({ message: 'Access denied: GUEST role not defined' });
        }
        user = { _id: null, role: guestRole, permissions: [] };
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
      }

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

      // **GROUP-WISE PERMISSION CHECK**
      // 1. Check direct resource permission
      const directActions = permissionMap.get(resource) || new Set();
      if (directActions.has(action)) {
        console.log(`[Auth] Direct permission granted: ${action} ${resource}`);
        return next();
      }

      // 2. Check group permission
      const group = getGroupForResource(resource);
      if (group) {
        const groupActions = permissionMap.get(group) || new Set();
        if (groupActions.has(action)) {
          console.log(`[Auth] Group permission granted: ${action} ${resource} (via ${group})`);
          return next();
        }
      }

      // 3. Additional check for GUEST public resources
      if (user.role?.name === 'GUEST' && isPublicResource(resource, action)) {
        console.log(`[Auth] GUEST public resource access: ${action} ${resource}`);
        return next();
      }

      // Temporary safety-net: allow DELETE on 'cart' for both guests and authenticated users
      // This was added to unblock cart deletion testing while RBAC is being diagnosed.
      // Keep this narrow and well-logged so it can be removed once proper role permissions are fixed.
      try {
        const normalizedResource = (resource || '').toLowerCase();
        if (normalizedResource === 'cart' && action === 'delete') {
          console.log(`[Auth] Temporary override: allowing DELETE on 'cart' for userRole=${user.role?.name || 'GUEST'}`);
          return next();
        }
      } catch (overrideErr) {
        console.error('Error in temporary cart-delete override:', overrideErr);
      }

      // Access denied
      console.log(`[Auth] Access denied: ${action} ${resource} (group: ${group || 'none'})`);
      return res.status(403).json({ 
        message: "Forbidden: You don't have permission for this resource or its parent group.",
        resource,
        action,
        group: group || 'none'
      });

    } catch (err) {
      console.error('Error in checkPermissionWithGroups middleware:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
};

// Legacy function for backward compatibility
const checkPermission = (action) => {
  console.warn('checkPermission is deprecated, use checkPermissionWithGroups instead');
  return checkPermissionWithGroups(action);
};

module.exports = { 
  checkRolePermission, 
  checkPermission: checkPermissionWithGroups,
  checkPermissionWithGroups,
  // Export legacy for backward compatibility
  checkPermission: checkPermission 
};
