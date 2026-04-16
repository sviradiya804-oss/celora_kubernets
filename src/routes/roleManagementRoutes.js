const express = require('express');
const router = express.Router();
const { protect: authenticate } = require('../middlewares/authMiddleware');
const Role = require('../models/Role');
const User = require('../models/User');
const { PAGE_GROUPS, getGroupForResource, getResourcesInGroup } = require('../config/permissionGroups');
const { deleteRole } = require('../controllers/roleController');

// Middleware to check if user is admin (ADMIN, SUPERADMIN, or MANAGER)
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(403).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const roleName = req.user.role.name;
  if (!['ADMIN', 'SUPERADMIN', 'MANAGER'].includes(roleName)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Admin role required. Current role: ${roleName || 'unknown'}`
    });
  }

  next();
};

// DELETE /api/role-management/roles/:roleId - Delete a role and convert its users to another role
router.delete('/roles/:roleId', authenticate, requireAdmin, deleteRole);

// PATCH /api/role-management/roles/:roleId - Update role details (name, description)
router.patch('/roles/:roleId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;
    const { name, description } = req.body;

    // Find the role
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Don't allow modifying protected roles unless you're a SUPERADMIN
    if (['ADMIN', 'SUPERADMIN', 'USER'].includes(role.name) && req.user.role.name !== 'SUPERADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Protected roles can only be modified by SUPERADMIN'
      });
    }

    // Check if new name is not already taken (if name is being changed)
    if (name && name !== role.name) {
      const existingRole = await Role.findOne({ name: name.toUpperCase() });
      if (existingRole) {
        return res.status(400).json({
          success: false,
          message: 'Role name already exists'
        });
      }
      role.name = name.toUpperCase(); // Store role names in uppercase
    }

    // Update description if provided
    if (description !== undefined) {
      role.description = description;
    }

    await role.save();

    res.json({
      success: true,
      message: 'Role updated successfully',
      data: {
        roleId: role._id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        updatedAt: role.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update role',
      error: error.message
    });
  }
});

// PATCH /api/role-management/users/:userId/role - Update user's role
router.patch('/users/:userId/role', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleId } = req.body;

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find the new role
    const newRole = await Role.findById(roleId);
    if (!newRole) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Don't allow changing ADMIN/SUPERADMIN roles unless you're a SUPERADMIN
    const currentUserRole = req.user.role.name;
    const currentRole = await Role.findById(user.role);
    if (
      (currentRole?.name === 'ADMIN' || currentRole?.name === 'SUPERADMIN') &&
      currentUserRole !== 'SUPERADMIN'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only SUPERADMIN can modify ADMIN/SUPERADMIN user roles'
      });
    }

    // Update the user's role
    user.role = roleId;
    user.permissions = []; // Clear individual permissions when role changes
    user.permissionsSource = 'role';
    await user.save();

    // Populate role details for response
    await user.populate('role');

    res.json({
      success: true,
      message: `User role updated successfully to ${newRole.name}`,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: {
          id: newRole._id,
          name: newRole.name
        },
        permissions: user.permissions
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
      error: error.message
    });
  }
});

// GET /api/role-management/roles - Get all roles with their permissions
router.get('/roles', authenticate, requireAdmin, async (req, res) => {
  try {
    const roles = await Role.find().lean();
    
    const rolesWithDetails = roles.map(role => {
      // Separate individual permissions from group permissions
      const individualPermissions = [];
      const groupPermissions = [];
      
      if (role.permissions && Array.isArray(role.permissions)) {
        role.permissions.forEach(perm => {
          const resource = perm.resource || perm.name;
          const actions = perm.actions || [];
          
          // Check if this is a group permission
          if (PAGE_GROUPS[resource]) {
            groupPermissions.push({
              group: resource,
              actions,
              resources: PAGE_GROUPS[resource]
            });
          } else {
            individualPermissions.push({
              resource,
              actions,
              group: getGroupForResource(resource) || 'ungrouped'
            });
          }
        });
      }
      
      return {
        ...role,
        individualPermissions,
        groupPermissions,
        totalPermissions: individualPermissions.length + groupPermissions.length
      };
    });

    res.json({
      success: true,
      data: rolesWithDetails,
      total: roles.length
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch roles',
      error: error.message
    });
  }
});

// GET /api/role-management/roles/:roleId - Get specific role details
router.get('/roles/:roleId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;
    const role = await Role.findById(roleId).lean();
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Get users with this role
    const usersWithRole = await User.find({ role: roleId }).select('name email').lean();
    
    // Process permissions
    const individualPermissions = [];
    const groupPermissions = [];
    
    if (role.permissions && Array.isArray(role.permissions)) {
      role.permissions.forEach(perm => {
        const resource = perm.resource || perm.name;
        const actions = perm.actions || [];
        
        if (PAGE_GROUPS[resource]) {
          groupPermissions.push({
            group: resource,
            actions,
            resources: PAGE_GROUPS[resource]
          });
        } else {
          individualPermissions.push({
            resource,
            actions,
            group: getGroupForResource(resource) || 'ungrouped'
          });
        }
      });
    }

    res.json({
      success: true,
      data: {
        ...role,
        individualPermissions,
        groupPermissions,
        usersWithRole,
        totalUsers: usersWithRole.length
      }
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role',
      error: error.message
    });
  }
});

// PUT /api/role-management/roles/:roleId/permissions - Update role permissions
router.put('/roles/:roleId/permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissions, groupPermissions } = req.body;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Build new permissions array
    const newPermissions = [];

    // Add individual resource permissions
    if (permissions && Array.isArray(permissions)) {
      permissions.forEach(perm => {
        if (perm.resource && perm.actions && Array.isArray(perm.actions)) {
          newPermissions.push({
            resource: perm.resource,
            actions: perm.actions
          });
        }
      });
    }

    // Add group permissions
    if (groupPermissions && Array.isArray(groupPermissions)) {
      groupPermissions.forEach(groupPerm => {
        if (groupPerm.group && groupPerm.actions && Array.isArray(groupPerm.actions)) {
          newPermissions.push({
            resource: groupPerm.group,
            actions: groupPerm.actions
          });
        }
      });
    }

    // Update role permissions
    role.permissions = newPermissions;
    await role.save();

    res.json({
      success: true,
      message: `Role '${role.name}' permissions updated successfully`,
      data: {
        roleId: role._id,
        roleName: role.name,
        totalPermissions: newPermissions.length,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update role permissions',
      error: error.message
    });
  }
});

// POST /api/role-management/roles/:roleId/permissions/add - Add specific permission to role
router.post('/roles/:roleId/permissions/add', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;
    const { resource, actions, isGroup = false } = req.body;

    if (!resource || !actions || !Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        message: 'Resource and actions array are required'
      });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Check if permission already exists
    const existingPermIndex = role.permissions.findIndex(p => p.resource === resource);
    
    if (existingPermIndex !== -1) {
      // Merge actions with existing permission
      const existingActions = role.permissions[existingPermIndex].actions || [];
      const newActions = [...new Set([...existingActions, ...actions])]; // Remove duplicates
      role.permissions[existingPermIndex].actions = newActions;
    } else {
      // Add new permission
      role.permissions.push({
        resource,
        actions
      });
    }

    await role.save();

    res.json({
      success: true,
      message: `Permission '${resource}' added to role '${role.name}'`,
      data: {
        roleId: role._id,
        roleName: role.name,
        addedPermission: { resource, actions, isGroup },
        totalPermissions: role.permissions.length
      }
    });
  } catch (error) {
    console.error('Error adding permission to role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add permission to role',
      error: error.message
    });
  }
});

// DELETE /api/role-management/roles/:roleId/permissions/:resource - Remove specific permission from role
router.delete('/roles/:roleId/permissions/:resource', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId, resource } = req.params;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Remove permission
    const initialLength = role.permissions.length;
    role.permissions = role.permissions.filter(p => p.resource !== resource);
    
    if (role.permissions.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: `Permission '${resource}' not found in role '${role.name}'`
      });
    }

    await role.save();

    res.json({
      success: true,
      message: `Permission '${resource}' removed from role '${role.name}'`,
      data: {
        roleId: role._id,
        roleName: role.name,
        removedPermission: resource,
        remainingPermissions: role.permissions.length
      }
    });
  } catch (error) {
    console.error('Error removing permission from role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove permission from role',
      error: error.message
    });
  }
});

// PATCH /api/role-management/roles/:roleId/permissions/:resource - Update specific permission actions
router.patch('/roles/:roleId/permissions/:resource', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId, resource } = req.params;
    const { actions } = req.body;

    if (!actions || !Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        message: 'Actions array is required'
      });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Find and update permission
    const permissionIndex = role.permissions.findIndex(p => p.resource === resource);
    
    if (permissionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `Permission '${resource}' not found in role '${role.name}'`
      });
    }

    const oldActions = role.permissions[permissionIndex].actions;
    role.permissions[permissionIndex].actions = actions;
    
    await role.save();

    res.json({
      success: true,
      message: `Permission '${resource}' actions updated in role '${role.name}'`,
      data: {
        roleId: role._id,
        roleName: role.name,
        resource,
        oldActions,
        newActions: actions
      }
    });
  } catch (error) {
    console.error('Error updating permission actions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update permission actions',
      error: error.message
    });
  }
});

// GET /api/role-management/available-permissions - Get all available permissions and groups
router.get('/available-permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    // Get all unique resources from existing roles
    const roles = await Role.find().lean();
    const allResources = new Set();
    
    roles.forEach(role => {
      if (role.permissions) {
        role.permissions.forEach(perm => {
          if (perm.resource) {
            allResources.add(perm.resource);
          }
        });
      }
    });

    // Organize by groups
    const groupedResources = {};
    const ungroupedResources = [];

    Array.from(allResources).forEach(resource => {
      const group = getGroupForResource(resource);
      if (group) {
        if (!groupedResources[group]) {
          groupedResources[group] = [];
        }
        groupedResources[group].push(resource);
      } else {
        ungroupedResources.push(resource);
      }
    });

    res.json({
      success: true,
      data: {
        pageGroups: PAGE_GROUPS,
        groupedResources,
        ungroupedResources,
        allResources: Array.from(allResources).sort(),
        availableActions: ['create', 'read', 'update', 'delete', 'admin']
      }
    });
  } catch (error) {
    console.error('Error fetching available permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available permissions',
      error: error.message
    });
  }
});

// POST /api/role-management/roles - Create new role
router.post('/roles', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, permissions = [], groupPermissions = [] } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required'
      });
    }

    // Check if role already exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res.status(400).json({
        success: false,
        message: `Role '${name}' already exists`
      });
    }

    // Build permissions array
    const allPermissions = [];

    // Add individual permissions
    if (permissions && Array.isArray(permissions)) {
      permissions.forEach(perm => {
        if (perm.resource && perm.actions) {
          allPermissions.push({
            resource: perm.resource,
            actions: perm.actions
          });
        }
      });
    }

    // Add group permissions
    if (groupPermissions && Array.isArray(groupPermissions)) {
      groupPermissions.forEach(groupPerm => {
        if (groupPerm.group && groupPerm.actions) {
          allPermissions.push({
            resource: groupPerm.group,
            actions: groupPerm.actions
          });
        }
      });
    }

    const newRole = new Role({
      name,
      permissions: allPermissions
    });

    await newRole.save();

    res.status(201).json({
      success: true,
      message: `Role '${name}' created successfully`,
      data: {
        roleId: newRole._id,
        roleName: newRole.name,
        totalPermissions: allPermissions.length
      }
    });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create role',
      error: error.message
    });
  }
});

module.exports = router;
