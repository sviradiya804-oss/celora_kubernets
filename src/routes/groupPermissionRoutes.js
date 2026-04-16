const express = require('express');
const router = express.Router();
const Role = require('../models/Role');
const { protect: authenticate } = require('../middlewares/authMiddleware');
const { PAGE_GROUPS, getGroupForResource, getResourcesInGroup } = require('../config/permissionGroups');

// Simple admin check middleware for group permission management routes
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  const userRole = req.user.role;
  const roleName = userRole && userRole.name ? String(userRole.name).toUpperCase() : null;
  
  if (!roleName || !['ADMIN', 'SUPERADMIN', 'MANAGER'].includes(roleName)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Admin role required. Current role: ${roleName || 'unknown'}`
    });
  }
  
  next();
};

// Get all page groups and their resources
router.get('/groups', authenticate, requireAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      groups: PAGE_GROUPS,
      message: 'Page groups retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get role with grouped permissions
router.get('/roles/:roleId/permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;
    const role = await Role.findById(roleId);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Group permissions by group
    const groupedPermissions = {};
    const ungroupedPermissions = [];

    role.permissions.forEach(perm => {
      const group = perm.group || getGroupForResource(perm.resource);
      
      if (group) {
        if (!groupedPermissions[group]) {
          groupedPermissions[group] = {
            groupName: group,
            permissions: []
          };
        }
        groupedPermissions[group].permissions.push(perm);
      } else {
        ungroupedPermissions.push(perm);
      }
    });

    res.json({
      success: true,
      role: {
        _id: role._id,
        name: role.name,
        description: role.description
      },
      groupedPermissions,
      ungroupedPermissions,
      availableGroups: PAGE_GROUPS
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update role permissions with group support
router.put('/roles/:roleId/permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId } = req.params;
    const { groupPermissions, individualPermissions } = req.body;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Clear existing permissions
    role.permissions = [];

    // Add group permissions
    if (groupPermissions) {
      Object.keys(groupPermissions).forEach(groupName => {
        const groupData = groupPermissions[groupName];
        if (groupData.enabled && groupData.actions && groupData.actions.length > 0) {
          // Add group-level permission
          role.permissions.push({
            resource: groupName,
            actions: groupData.actions,
            group: null // This is a parent group
          });

          // Optionally add individual resource permissions within the group
          if (groupData.includeIndividual) {
            const resourcesInGroup = getResourcesInGroup(groupName);
            resourcesInGroup.forEach(resource => {
              role.permissions.push({
                resource: resource,
                actions: groupData.actions,
                group: groupName
              });
            });
          }
        }
      });
    }

    // Add individual permissions (not part of groups)
    if (individualPermissions) {
      individualPermissions.forEach(perm => {
        if (perm.resource && perm.actions && perm.actions.length > 0) {
          role.permissions.push({
            resource: perm.resource,
            actions: perm.actions,
            group: perm.group || getGroupForResource(perm.resource)
          });
        }
      });
    }

    await role.save();

    res.json({
      success: true,
      message: 'Role permissions updated successfully',
      role: {
        _id: role._id,
        name: role.name,
        permissions: role.permissions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Add/remove group permission for a role
router.post('/roles/:roleId/groups/:groupName', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId, groupName } = req.params;
    const { actions, enabled } = req.body;

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    if (!PAGE_GROUPS[groupName]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group name'
      });
    }

    // Remove existing group permission
    role.permissions = role.permissions.filter(p => p.resource !== groupName || p.group !== null);

    if (enabled && actions && actions.length > 0) {
      // Add new group permission
      role.permissions.push({
        resource: groupName,
        actions: actions,
        group: null // This is a parent group
      });
    }

    await role.save();

    res.json({
      success: true,
      message: enabled ? `Group ${groupName} permissions added` : `Group ${groupName} permissions removed`,
      role: {
        _id: role._id,
        name: role.name,
        permissions: role.permissions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Remove specific resource permissions from a role
router.delete('/roles/:roleId/resources/:resource', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId, resource } = req.params;
    
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Remove the specific resource permission
    role.permissions = role.permissions.filter(p => p.resource !== resource);
    await role.save();

    res.json({
      success: true,
      message: `Resource '${resource}' permission removed from role '${role.name}'`,
      role: {
        id: role._id,
        name: role.name,
        permissions: role.permissions
      }
    });

  } catch (error) {
    console.error('Error removing resource permission:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add group permissions to a role
router.post('/roles/:roleId/groups/:groupName/permissions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId, groupName } = req.params;
    const { actions = ['read'] } = req.body; // Default to read permission
    
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Check if group exists in our configuration
    const { getResourcesInGroup } = require('../config/permissionGroups');
    const groupResources = getResourcesInGroup(groupName);
    
    if (!groupResources || groupResources.length === 0) {
      return res.status(400).json({ 
        message: `Invalid group name '${groupName}'`,
        availableGroups: Object.keys(require('../config/permissionGroups').PAGE_GROUPS)
      });
    }

    // Add group permission (this will control access to all resources in the group)
    const existingGroupPerm = role.permissions.find(p => p.resource === groupName);
    if (existingGroupPerm) {
      // Update existing group permission
      existingGroupPerm.actions = [...new Set([...existingGroupPerm.actions, ...actions])];
    } else {
      // Add new group permission
      role.permissions.push({
        resource: groupName,
        actions: actions
      });
    }

    await role.save();

    res.json({
      success: true,
      message: `Group '${groupName}' permissions added to role '${role.name}'`,
      groupResources,
      role: {
        id: role._id,
        name: role.name,
        permissions: role.permissions
      }
    });

  } catch (error) {
    console.error('Error adding group permissions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Remove group permissions from a role  
router.delete('/roles/:roleId/groups/:groupName', authenticate, requireAdmin, async (req, res) => {
  try {
    const { roleId, groupName } = req.params;
    
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Remove group permission
    const originalLength = role.permissions.length;
    role.permissions = role.permissions.filter(p => p.resource !== groupName);
    
    const removed = originalLength !== role.permissions.length;
    if (removed) {
      await role.save();
    }

    res.json({
      success: true,
      message: removed ? 
        `Group '${groupName}' permissions removed from role '${role.name}'` :
        `Group '${groupName}' was not found in role '${role.name}' permissions`,
      role: {
        id: role._id,
        name: role.name,
        permissions: role.permissions
      }
    });

  } catch (error) {
    console.error('Error removing group permissions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
