const User = require('../models/User');
const Role = require('../models/Role');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

// Get all roles
const getAllRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find({}).select('-__v');
  
  // Calculate user count for each role
  const rolesWithCounts = await Promise.all(
    roles.map(async (role) => {
      const userCount = await User.countDocuments({ role: role._id });
      return {
        ...role.toObject(),
        userCount
      };
    })
  );

  res.status(200).json({
    success: true,
    count: roles.length,
    data: rolesWithCounts
  });
});

// Get single role
const getRoleById = asyncHandler(async (req, res) => {
  // Convert to ObjectId if it's a valid string
  let roleId = req.params.roleId;
  if (typeof roleId === 'string' && mongoose.Types.ObjectId.isValid(roleId)) {
    roleId = new mongoose.Types.ObjectId(roleId);
  }

  const roles = await Role.find({ _id: roleId });
  
  if (!roles || roles.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  const role = roles[0];
  const userCount = await User.countDocuments({ role: roleId });
  const users = await User.find({ role: roleId }).select('name email isActive');

  res.status(200).json({
    success: true,
    data: {
      ...role.toObject(),
      userCount,
      users
    }
  });
});

// Create new role
const createRole = asyncHandler(async (req, res) => {
  const { name, description, permissions } = req.body;

  // Check if role name already exists
  const existingRole = await Role.findOne({ name: name.toUpperCase() });
  if (existingRole) {
    return res.status(400).json({
      success: false,
      message: 'Role name already exists'
    });
  }

  const role = await Role.create({
    name: name.toUpperCase(),
    description,
    permissions: permissions || []
  });

  res.status(201).json({
    success: true,
    message: 'Role created successfully',
    data: role
  });
});

// Update role
const updateRole = asyncHandler(async (req, res) => {
  const { permissions, description, syncUsers } = req.body;
  
  // Convert to ObjectId if it's a valid string
  let roleId = req.params.roleId;
  if (typeof roleId === 'string' && mongoose.Types.ObjectId.isValid(roleId)) {
    roleId = new mongoose.Types.ObjectId(roleId);
  }
  
  const roles = await Role.find({ _id: roleId });
  if (!roles || roles.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  const role = roles[0];

  // Update role
  if (permissions) role.permissions = permissions;
  if (description) role.description = description;
  
  await role.save();

  // Sync users if requested
  let syncedUsers = 0;
  if (syncUsers) {
    const usersToSync = await User.find({ 
      role: roleId,
      permissionsSource: { $in: ['role', undefined, null] }
    });

    for (const user of usersToSync) {
      user.permissions = permissions || [];
      user.permissionsSource = 'role';
      await user.save();
      syncedUsers++;
    }
  }

  res.status(200).json({
    success: true,
    message: `Role updated successfully${syncUsers ? `. Synced ${syncedUsers} users.` : ''}`,
    data: role,
    syncedUsers
  });
});

// Delete role
const deleteRole = asyncHandler(async (req, res) => {
  // Convert to ObjectId if it's a valid string
  let roleId = req.params.roleId;
  if (typeof roleId === 'string' && mongoose.Types.ObjectId.isValid(roleId)) {
    roleId = new mongoose.Types.ObjectId(roleId);
  }

  const roles = await Role.find({ _id: roleId });
  if (!roles || roles.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  // Check if role is in use
  const userCount = await User.countDocuments({ role: roleId });
  if (userCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete role. ${userCount} users are currently assigned to this role.`
    });
  }

  await Role.deleteOne({ _id: roleId });

  res.status(200).json({
    success: true,
    message: 'Role deleted successfully'
  });
});

// Sync all users of a role to the role's permissions
const syncUsersToRole = asyncHandler(async (req, res) => {
  // Convert to ObjectId if it's a valid string
  let roleId = req.params.roleId;
  if (typeof roleId === 'string' && mongoose.Types.ObjectId.isValid(roleId)) {
    roleId = new mongoose.Types.ObjectId(roleId);
  }

  const roles = await Role.find({ _id: roleId });
  if (!roles || roles.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }

  const role = roles[0];
  const users = await User.find({ role: roleId });
  let syncedCount = 0;

  for (const user of users) {
    user.permissions = role.permissions || [];
    user.permissionsSource = 'role';
    await user.save();
    syncedCount++;
  }

  res.status(200).json({
    success: true,
    message: `Successfully synced ${syncedCount} users to role permissions`,
    syncedCount
  });
});

// Get all users with their roles and permissions
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({})
    .populate('role', 'name permissions')
    .select('name email isActive permissions permissionsSource createdAt')
    .sort({ createdAt: -1 });

  const usersWithEffectivePermissions = users.map(user => {
    const effectivePermissions = user.permissions && user.permissions.length > 0 
      ? user.permissions 
      : (user.role ? user.role.permissions : []);

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      role: user.role,
      permissions: user.permissions || [],
      effectivePermissions,
      permissionsSource: user.permissionsSource || 'role',
      createdAt: user.createdAt
    };
  });

  res.status(200).json({
    success: true,
    count: users.length,
    data: usersWithEffectivePermissions
  });
});

// Get user's effective permissions
const getUserPermissions = asyncHandler(async (req, res) => {
  // Convert to ObjectId if it's a valid string
  let userId = req.params.userId;
  if (typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
    userId = new mongoose.Types.ObjectId(userId);
  }

  const users = await User.find({ _id: userId }).populate('role');
  
  if (!users || users.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const user = users[0];
  const effectivePermissions = user.permissions && user.permissions.length > 0 
    ? user.permissions 
    : (user.role ? user.role.permissions : []);

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      permissions: user.permissions || [],
      effectivePermissions,
      permissionsSource: user.permissionsSource || 'role'
    }
  });
});

// Update user's individual permissions
const updateUserPermissions = asyncHandler(async (req, res) => {
  const { permissions, permissionsSource } = req.body;
  
  // Convert to ObjectId if it's a valid string
  let userId = req.params.userId;
  if (typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
    userId = new mongoose.Types.ObjectId(userId);
  }
  
  const users = await User.find({ _id: userId }).populate('role');
  if (!users || users.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const user = users[0];
  user.permissions = permissions || [];
  user.permissionsSource = permissionsSource || 'custom';
  await user.save();

  res.status(200).json({
    success: true,
    message: 'User permissions updated successfully',
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      permissions: user.permissions,
      permissionsSource: user.permissionsSource
    }
  });
});

// Sync user back to their role's permissions
const syncUserToRole = asyncHandler(async (req, res) => {
  // Convert to ObjectId if it's a valid string
  let userId = req.params.userId;
  if (typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
    userId = new mongoose.Types.ObjectId(userId);
  }

  const users = await User.find({ _id: userId }).populate('role');
  if (!users || users.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const user = users[0];
  if (!user.role) {
    return res.status(400).json({
      success: false,
      message: 'User has no role assigned'
    });
  }

  user.permissions = user.role.permissions || [];
  user.permissionsSource = 'role';
  await user.save();

  res.status(200).json({
    success: true,
    message: `User synced to role '${user.role.name}' permissions`,
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      permissions: user.permissions,
      permissionsSource: user.permissionsSource
    }
  });
});

// Get role hierarchy for admin interface
const getRoleHierarchy = asyncHandler(async (req, res) => {
  const roles = await Role.find({}).select('name description permissions');
  
  const hierarchy = {
    SUPERADMIN: {
      level: 5,
      description: 'Full system access',
      canManage: ['ADMIN', 'MANAGER', 'EMPLOYEE', 'USER', 'GUEST']
    },
    ADMIN: {
      level: 4,
      description: 'Administrative access',
      canManage: ['MANAGER', 'EMPLOYEE', 'USER', 'GUEST']
    },
    MANAGER: {
      level: 3,
      description: 'Management access',
      canManage: ['EMPLOYEE', 'USER', 'GUEST']
    },
    EMPLOYEE: {
      level: 2,
      description: 'Employee access',
      canManage: ['USER', 'GUEST']
    },
    USER: {
      level: 1,
      description: 'Customer access',
      canManage: []
    },
    GUEST: {
      level: 0,
      description: 'Public access',
      canManage: []
    }
  };

  const rolesWithHierarchy = roles.map(role => ({
    ...role.toObject(),
    hierarchy: hierarchy[role.name] || { level: 0, description: 'Custom role', canManage: [] }
  }));

  res.status(200).json({
    success: true,
    data: {
      roles: rolesWithHierarchy,
      hierarchy
    }
  });
});

module.exports = {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  syncUsersToRole,
  getAllUsers,
  getUserPermissions,
  updateUserPermissions,
  syncUserToRole,
  getRoleHierarchy
};
