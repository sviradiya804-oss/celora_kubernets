const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  // Enhanced JWT payload with permissions for RBAC system
  const payload = {
    id: user._id,
    role: user.role?._id || user.role,
    roleName: user.role?.name || 'UNKNOWN',
    permissions: user.permissions || [],
    permissionsSource: user.permissionsSource || 'role',
    tokenVersion: user.tokenVersion || 0
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

module.exports = generateToken;
