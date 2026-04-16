const mongoose = require('mongoose');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const Role = require('../models/Role');
const { getGroupForResource } = require('../config/permissionGroups');

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

// Normalize permissions into { resource, actions: [] }
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
      if (resource) out.push({ resource, actions });
    }
  });
  return out;
};

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

      const resource = req.params.indexName || 'cart';

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
      apply(userPerms); // user permissions additive (overrides could be implemented later)

      // Check direct resource permission first
      let actionsForResource = permissionMap.get(resource) || new Set();

      console.log(`[Permission Debug] Resource: ${resource}, Actions: ${Array.from(actionsForResource)}`);

      // If no direct permission, check group permission
      if (!actionsForResource.has(action)) {
        const group = getGroupForResource(resource);
        if (group) {
          actionsForResource = permissionMap.get(group) || new Set();
          console.log(`[Permission Debug] Group: ${group}, Actions: ${Array.from(actionsForResource)}`);
        }
      }

      if (!actionsForResource.has(action)) {
        console.log(`[Permission Debug] Access denied - Resource: ${resource}, Group: ${getGroupForResource(resource)}, Action: ${action}, Available: ${Array.from(actionsForResource)}`);
        return res.status(403).json({ message: "Forbidden: You don't have permission." });
      }

      console.log(`[Permission Debug] Access granted - Resource: ${resource}, Action: ${action}`);

      return next();
    } catch (err) {
      console.error('Error in checkPermission middleware:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
};

module.exports = { checkRolePermission, checkPermission };
