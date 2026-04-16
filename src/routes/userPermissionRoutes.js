const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const { protect } = require('../middlewares/authMiddleware');
const { permissionGroups } = require('../config/permissionGroups');

// Helper: resolve user by ObjectId or email (accept email in :userId param)
const getUserByIdOrEmail = async (idOrEmail) => {
  if (!idOrEmail) return null;
  // crude email check
  if (idOrEmail.includes && idOrEmail.includes('@')) {
    return await User.findOne({ email: idOrEmail });
  }
  // otherwise assume ObjectId
  if (mongoose && mongoose.Types && mongoose.Types.ObjectId.isValid(idOrEmail)) {
    return await User.findById(idOrEmail);
  }
  return null;
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(403).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const roleName = req.user.role.name;
  if (!['ADMIN', 'SUPERADMIN'].includes(roleName)) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  next();
};

/**
 * @route   GET /api/user-permissions/users
 * @desc    Get all users with their roles and individual permissions
 * @access  Admin only
 */
router.get('/users', protect, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .populate('role', 'name permissions')
      .select('name email role permissions createdAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        individualPermissions: user.permissions || [],
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

/**
 * @route   GET /api/user-permissions/users/search
 * @desc    Search users by email or name
 * @access  Admin only
 */
router.get('/users/search', protect, requireAdmin, async (req, res) => {
  try {
    console.log('Search query parameters:', req.query);
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const users = await User.find({
 
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ]
    })
    .populate('role', 'name')
    .select('name email role permissions')
    .limit(20)
    .sort({ name: 1 });

    res.json({
      success: true,
      count: users.length,
      users: users.map(user => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hasIndividualPermissions: user.permissions && user.permissions.length > 0
      }))
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching users'
    });
  }
});

/**
 * @route   GET /api/user-permissions/users/:userId
 * @desc    Get specific user with detailed permissions (role + individual)
 * @access  Admin only
 */
router.get('/users/:userId', protect, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    let user = await getUserByIdOrEmail(userId);
    if (user) {
      // ensure role and limited fields
      user = await User.findById(user._id)
        .populate('role', 'name permissions')
        .select('name email role permissions createdAt');
    }

      if (!user) {
        console.warn(`User not found for identifier: ${userId}`);
        return res.status(404).json({
          success: false,
          message: `User not found for identifier: ${userId}`
        });
      }

    // Combine role permissions with individual permissions
    const rolePermissions = user.role?.permissions || [];
    const individualPermissions = user.permissions || [];
    
    // Create a map of all effective permissions
    const effectivePermissions = new Map();

    // Add role permissions
    rolePermissions.forEach(perm => {
      effectivePermissions.set(perm.resource, {
        resource: perm.resource,
        actions: [...perm.actions],
        source: 'role',
        group: perm.group
      });
    });

    // Add/override with individual permissions
    individualPermissions.forEach(perm => {
      if (effectivePermissions.has(perm.resource)) {
        // Merge actions (combine role + individual)
        const existing = effectivePermissions.get(perm.resource);
        const combinedActions = [...new Set([...existing.actions, ...perm.actions])];
        effectivePermissions.set(perm.resource, {
          ...existing,
          actions: combinedActions,
          source: 'role + individual'
        });
      } else {
        // New permission not in role
        effectivePermissions.set(perm.resource, {
          resource: perm.resource,
          actions: [...perm.actions],
          source: 'individual',
          group: 'custom'
        });
      }
    });

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        individualPermissions: user.permissions || [],
        effectivePermissions: Array.from(effectivePermissions.values()),
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user'
    });
  }
});

/**
 * @route   POST /api/user-permissions/users/:userId/permissions/add
 * @desc    Add individual permission to a specific user
 * @access  Admin only
 */
router.post('/users/:userId/permissions/add', protect, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { resource, actions } = req.body;

    if (!resource || !actions || !Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        message: 'Resource and actions array are required'
      });
    }

  let user = await getUserByIdOrEmail(userId);
  if (user) user = await User.findById(user._id).populate('role', 'name permissions');
      if (!user) {
        console.warn(`User not found for identifier: ${userId}`);
        return res.status(404).json({
          success: false,
          message: `User not found for identifier: ${userId}`
        });
      }

    // Check if user already has individual permission for this resource
    const existingPermIndex = user.permissions.findIndex(perm => perm.resource === resource);

    if (existingPermIndex !== -1) {
      // Update existing permission by merging actions
      const existingActions = user.permissions[existingPermIndex].actions;
      const newActions = [...new Set([...existingActions, ...actions])];
      user.permissions[existingPermIndex].actions = newActions;
    } else {
      // Add new permission
      user.permissions.push({ resource, actions });
    }

    await user.save();

    res.json({
      success: true,
      message: `Individual permission "${resource}" added to user ${user.name}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        individualPermissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Error adding user permission:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding permission'
    });
  }
});

/**
 * @route   PATCH /api/user-permissions/users/:userId/permissions/:resource
 * @desc    Update specific individual permission actions for a user
 * @access  Admin only
 */
router.patch('/users/:userId/permissions/:resource', protect, requireAdmin, async (req, res) => {
  try {
    const { userId, resource } = req.params;
    const { actions } = req.body;

    if (!actions || !Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        message: 'Actions array is required'
      });
    }

  let user = await getUserByIdOrEmail(userId);
  if (user) user = await User.findById(user._id).populate('role', 'name permissions');
      if (!user) {
        console.warn(`User not found for identifier: ${userId}`);
        return res.status(404).json({
          success: false,
          message: `User not found for identifier: ${userId}`
        });
      }

    // Find and update the specific permission
    const permissionIndex = user.permissions.findIndex(perm => perm.resource === resource);

    if (permissionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Individual permission for resource "${resource}" not found`
      });
    }

    user.permissions[permissionIndex].actions = actions;
    await user.save();

    res.json({
      success: true,
      message: `Individual permission "${resource}" updated for user ${user.name}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        individualPermissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Error updating user permission:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating permission'
    });
  }
});

/**
 * @route   PATCH /api/user-permissions/users/:userId/permissions
 * @desc    Update specific individual permission actions for a user (resource from body)
 * @access  Admin only
 */
router.patch('/users/:userId/permissions', protect, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { resource, actions } = req.body;

    if (!resource) {
      return res.status(400).json({
        success: false,
        message: 'Resource is required in request body'
      });
    }

    if (!actions || !Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        message: 'Actions array is required'
      });
    }

    let user = await getUserByIdOrEmail(userId);
    if (user) user = await User.findById(user._id).populate('role', 'name permissions');
    if (!user) {
      console.warn(`User not found for identifier: ${userId}`);
      return res.status(404).json({
        success: false,
        message: `User not found for identifier: ${userId}`
      });
    }

    // Find and update the specific permission
    const permissionIndex = user.permissions.findIndex(perm => perm.resource === resource);

    if (permissionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Individual permission for resource "${resource}" not found`
      });
    }

    user.permissions[permissionIndex].actions = actions;
    await user.save();

    res.json({
      success: true,
      message: `Individual permission "${resource}" updated for user ${user.name}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        individualPermissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Error updating user permission:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating permission'
    });
  }
});

/**
 * @route   DELETE /api/user-permissions/users/:userId/permissions/:resource
 * @desc    Remove specific individual permission from a user
 * @access  Admin only
 */
router.delete('/users/:userId/permissions/:resource', protect, requireAdmin, async (req, res) => {
  try {
    const { userId, resource } = req.params;

  let user = await getUserByIdOrEmail(userId);
  if (user) user = await User.findById(user._id).populate('role', 'name permissions');
      if (!user) {
        console.warn(`User not found for identifier: ${userId}`);
        return res.status(404).json({
          success: false,
          message: `User not found for identifier: ${userId}`
        });
      }

    // Remove the specific permission
    const initialLength = user.permissions.length;
    user.permissions = user.permissions.filter(perm => perm.resource !== resource);

    if (user.permissions.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: `Individual permission for resource "${resource}" not found`
      });
    }

    await user.save();

    res.json({
      success: true,
      message: `Individual permission "${resource}" removed from user ${user.name}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        individualPermissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Error removing user permission:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing permission'
    });
  }
});

/**
 * @route   PUT /api/user-permissions/users/:userId/permissions
 * @desc    Bulk update all individual permissions for a user
 * @access  Admin only
 */
router.put('/users/:userId/permissions', protect, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'Permissions array is required'
      });
    }

    // Validate permissions format
    for (const perm of permissions) {
      if (!perm.resource || !perm.actions || !Array.isArray(perm.actions)) {
        return res.status(400).json({
          success: false,
          message: 'Each permission must have resource and actions array'
        });
      }
    }

  let user = await getUserByIdOrEmail(userId);
  if (user) user = await User.findById(user._id).populate('role', 'name permissions');
  if (!user) {
      console.warn(`User not found for identifier: ${userId}`);
      return res.status(404).json({
        success: false,
        message: `User not found for identifier: ${userId}`
      });
    }

    // Replace all individual permissions
    user.permissions = permissions;
    await user.save();

    res.json({
      success: true,
      message: `All individual permissions updated for user ${user.name}`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        individualPermissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Error updating user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating permissions'
    });
  }
});

/**
 * @route   POST /api/user-permissions/users/:userId/role
 * @desc    Change user's role
 * @access  Admin only
 */
router.post('/users/:userId/role', protect, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: 'Role ID is required'
      });
    }

  let user = await getUserByIdOrEmail(userId);
    const role = await Role.findById(roleId);

    if (!user) {
      console.warn(`User not found for identifier: ${userId}`);
      return res.status(404).json({
        success: false,
        message: `User not found for identifier: ${userId}`
      });
    }

    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

  const oldRole = await Role.findById(user.role);
    user.role = roleId;
    await user.save();

    await user.populate('role', 'name permissions');

    res.json({
      success: true,
      message: `User ${user.name} role changed from "${oldRole?.name}" to "${role.name}"`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        individualPermissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Error changing user role:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while changing role'
    });
  }
});

/**
 * @route   GET /api/user-permissions/available-permissions
 * @desc    Get all available permissions that can be assigned individually
 * @access  Admin only
 */
router.get('/available-permissions', protect, requireAdmin, async (req, res) => {
  try {
    const groups = permissionGroups.map(group => ({
      name: group.name,
      resources: group.resources.map(resource => ({
        name: resource.name,
        actions: resource.actions
      }))
    }));

    // Also get all unique resources from existing roles for reference
    const roles = await Role.find({}).select('permissions');
    const roleResources = new Set();
    
    roles.forEach(role => {
      role.permissions.forEach(perm => {
        roleResources.add(perm.resource);
      });
    });

    res.json({
      success: true,
      groups,
      existingRoleResources: Array.from(roleResources).sort()
    });
  } catch (error) {
    console.error('Error fetching available permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching available permissions'
    });
  }
});
module.exports = router;
