const Role = require('../models/Role');
const User = require('../models/User');

// Delete a role and convert its users to another role (default: USER)
exports.deleteRole = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { targetRoleName = 'USER' } = req.body; // Default to USER if not specified

    // 1. Find the role to be deleted
    const roleToDelete = await Role.findById(roleId);
    if (!roleToDelete) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // 2. Don't allow deleting protected roles
    if (['ADMIN', 'SUPERADMIN', 'USER'].includes(roleToDelete.name)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete protected roles (ADMIN, SUPERADMIN, USER)'
      });
    }

    // 3. Find the target role (USER role by default)
    const targetRole = await Role.findOne({ name: targetRoleName });
    if (!targetRole) {
      return res.status(404).json({
        success: false,
        message: `Target role ${targetRoleName} not found`
      });
    }

    // 4. Find and update all users with this role
    const usersToUpdate = await User.find({ role: roleId });
    
    // Update users to new role
    await User.updateMany(
      { role: roleId },
      { 
        role: targetRole._id,
        permissions: [], // Clear individual permissions
        permissionsSource: 'role'
      }
    );

    // 5. Delete the role
    await Role.findByIdAndDelete(roleId);

    res.json({
      success: true,
      message: `Role ${roleToDelete.name} deleted successfully`,
      data: {
        deletedRole: roleToDelete.name,
        targetRole: targetRole.name,
        usersUpdated: usersToUpdate.length,
        updatedUsers: usersToUpdate.map(u => ({
          id: u._id,
          name: u.name,
          email: u.email
        }))
      }
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete role',
      error: error.message
    });
  }
};
