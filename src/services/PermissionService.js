const User = require('../models/User');
const Role = require('../models/Role');
const { generateToken } = require('../utils/generateToken');

class PermissionService {
  /**
   * Check if user has specific permission
   * @param {Object} user - User object with populated role
   * @param {string} resource - Resource name
   * @param {string} action - Action name
   * @returns {boolean}
   */
  static hasPermission(user, resource, action) {
    if (!user) return false;

    // Allow guest users to delete the cart
    if (user.role?.name === 'GUEST' && resource === 'cart' && action === 'delete') {
      return true;
    }

    // Get effective permissions (user permissions override role permissions)
    const permissions = user.permissions && user.permissions.length > 0 
      ? user.permissions 
      : user.role?.permissions || [];

    // Check for specific permission
    const hasSpecificPermission = permissions.some(permission => 
      permission.resource === resource && 
      permission.actions && permission.actions.includes(action)
    );

    if (hasSpecificPermission) return true;

    // Check for admin wildcard permissions
    if (user.role?.name === 'SUPER_ADMIN' || user.role?.name === 'ADMIN') {
      const hasAdminPermission = permissions.some(permission => 
        permission.resource === 'admin' && 
        permission.actions && (
          permission.actions.includes('all') || 
          permission.actions.includes('*')
        )
      );
      if (hasAdminPermission) return true;
    }

    return false;
  }

  /**
   * Get all effective permissions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  static async getUserEffectivePermissions(userId) {
    const user = await User.findById(userId).populate('role');
    if (!user) return [];

    return user.permissions && user.permissions.length > 0 
      ? user.permissions 
      : user.role?.permissions || [];
  }

  /**
   * Update user permissions and regenerate JWT token
   * @param {string} userId - User ID
   * @param {Array} permissions - New permissions array
   * @param {string} permissionsSource - Source of permissions ('role', 'custom', 'hybrid')
   * @returns {Promise<Object>}
   */
  static async updateUserPermissions(userId, permissions, permissionsSource = 'custom') {
    const user = await User.findById(userId).populate('role');
    if (!user) {
      throw new Error('User not found');
    }

    // Update permissions
    user.permissions = permissions || [];
    user.permissionsSource = permissionsSource;

    if (permissionsSource === 'role') {
      user.permissions = user.role?.permissions || [];
      user.lastRoleSync = new Date();
    }

    await user.save();

    // Generate new token with updated permissions
    const newToken = generateToken(user);

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        permissions: user.permissions,
        permissionsSource: user.permissionsSource,
        role: user.role?.name
      },
      token: newToken
    };
  }

  /**
   * Sync user permissions with their role
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  static async syncUserWithRole(userId) {
    const user = await User.findById(userId).populate('role');
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.role) {
      throw new Error('User has no role assigned');
    }

    return this.updateUserPermissions(userId, user.role.permissions, 'role');
  }

  /**
   * Bulk sync all users with their roles
   * @param {string} roleId - Role ID (optional, if provided only users with this role are synced)
   * @returns {Promise<number>}
   */
  static async bulkSyncUsersWithRoles(roleId = null) {
    const filter = roleId ? { role: roleId, permissionsSource: { $in: ['role', 'hybrid'] } } : { permissionsSource: 'role' };
    
    const users = await User.find(filter).populate('role');
    let syncedCount = 0;

    for (const user of users) {
      if (user.role) {
        user.permissions = user.role.permissions || [];
        user.lastRoleSync = new Date();
        await user.save();
        syncedCount++;
      }
    }

    return syncedCount;
  }

  /**
   * Get permission summary for a user (for debugging/admin purposes)
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  static async getUserPermissionSummary(userId) {
    const user = await User.findById(userId).populate('role');
    if (!user) {
      throw new Error('User not found');
    }

    const rolePermissions = user.role?.permissions || [];
    const userPermissions = user.permissions || [];
    const effectivePermissions = userPermissions.length > 0 ? userPermissions : rolePermissions;

    return {
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      role: {
        id: user.role?._id,
        name: user.role?.name,
        permissions: rolePermissions
      },
      userCustomPermissions: userPermissions,
      effectivePermissions,
      permissionsSource: user.permissionsSource,
      lastRoleSync: user.lastRoleSync,
      permissionCount: {
        role: rolePermissions.length,
        custom: userPermissions.length,
        effective: effectivePermissions.length
      }
    };
  }

  /**
   * Validate permissions array format
   * @param {Array} permissions - Permissions array to validate
   * @returns {boolean}
   */
  static validatePermissions(permissions) {
    if (!Array.isArray(permissions)) return false;

    return permissions.every(permission => 
      permission &&
      typeof permission.resource === 'string' &&
      Array.isArray(permission.actions) &&
      permission.actions.every(action => typeof action === 'string')
    );
  }

  /**
   * Get all available resources and actions from existing roles
   * @returns {Promise<Object>}
   */
  static async getAvailablePermissions() {
    const roles = await Role.find({ isActive: true });
    const resourceMap = new Map();

    roles.forEach(role => {
      role.permissions.forEach(permission => {
        if (!resourceMap.has(permission.resource)) {
          resourceMap.set(permission.resource, new Set());
        }
        permission.actions.forEach(action => {
          resourceMap.get(permission.resource).add(action);
        });
      });
    });

    const result = {};
    resourceMap.forEach((actions, resource) => {
      result[resource] = Array.from(actions).sort();
    });

    return result;
  }

  /**
   * Check if user can perform action on specific resource
   * This is a convenience method for middleware use
   * @param {string} userId - User ID
   * @param {string} resource - Resource name
   * @param {string} action - Action name
   * @returns {Promise<boolean>}
   */
  static async canUserPerformAction(userId, resource, action) {
    const user = await User.findById(userId).populate('role');
    return this.hasPermission(user, resource, action);
  }
}

module.exports = PermissionService;
