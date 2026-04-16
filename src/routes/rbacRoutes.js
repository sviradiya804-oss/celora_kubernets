const express = require('express');
const {
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  getRoleById,
  syncUsersToRole,
  getUserPermissions,
  updateUserPermissions,
  syncUserToRole,
  getAllUsers,
  getRoleHierarchy
} = require('../controllers/rbacController');

const authenticate = require('../middlewares/protect');
const { checkRolePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Role Management Routes
router.get('/roles', authenticate, checkRolePermission('SUPERADMIN', 'ADMIN'), getAllRoles);
router.post('/roles', authenticate, checkRolePermission('SUPERADMIN'), createRole);
router.get('/roles/:roleId', authenticate, checkRolePermission('SUPERADMIN', 'ADMIN'), getRoleById);
router.put('/roles/:roleId', authenticate, checkRolePermission('SUPERADMIN'), updateRole);
router.delete('/roles/:roleId', authenticate, checkRolePermission('SUPERADMIN'), deleteRole);
router.post('/roles/:roleId/sync-users', authenticate, checkRolePermission('SUPERADMIN'), syncUsersToRole);

// User Permission Management Routes
router.get('/users', authenticate, checkRolePermission('SUPERADMIN', 'ADMIN'), getAllUsers);
router.get('/users/:userId/permissions', authenticate, checkRolePermission('SUPERADMIN', 'ADMIN'), getUserPermissions);
router.put('/users/:userId/permissions', authenticate, checkRolePermission('SUPERADMIN'), updateUserPermissions);
router.post('/users/:userId/sync-role', authenticate, checkRolePermission('SUPERADMIN'), syncUserToRole);

// System Routes
router.get('/hierarchy', authenticate, checkRolePermission('SUPERADMIN', 'ADMIN'), getRoleHierarchy);

module.exports = router;
