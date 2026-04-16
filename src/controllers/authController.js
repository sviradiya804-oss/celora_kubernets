const User = require('../models/User');
const { Role } = require('../models/index.js');
const generateToken = require('../utils/generateToken');
const ApiError = require('../utils/ApiError');
const redisClient = require('../utils/redis');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/emailService'); // Your email utility
const generatePassword = require('../utils/generatePassword'); // The new password utility
const asyncHandler = require('express-async-handler'); // For handling async errors
const { sendPasswordResetEmail } = require('../utils/emailService'); // Import the password reset email function
const crypto = require('crypto');

// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
  const { name, email, password, role: roleInput } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return next(new ApiError(400, 'User already exists', { email }));
    }

    // Set default role to 'USER' if no role is provided
    const roleName = roleInput ? roleInput.toUpperCase() : 'USER';
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return next(new ApiError(400, 'Role not found', { role: roleName }));
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role._id,
      permissions: role.permissions || [],
      permissionsSource: 'role'
    });

    // Populate role for token generation
    await user.populate('role');

    const token = generateToken(user);

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      user: userResponse,
      token,
      permissions: user.permissions,
      permissionsSource: user.permissionsSource
    });
  } catch (err) {
    console.error('Register Error:', err);
    next(new ApiError(500, err.message));
  }
};
// @route   PUT /api/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  try {
    const resetToken = req.params.token;

    if (!req.body.password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // 1. Find user by hashed token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // 2. Set password and reset fields, then save to trigger pre-save middleware for hashing
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    
    // Save will trigger pre-save middleware which hashes the password
    await user.save({ validateBeforeSave: false });

    res.status(200).json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    // Find user and populate role information
    const user = await User.findOne({ email })
      .select('+password')
      .populate('role');

    if (!user || !(await user.matchPassword(password))) {
      return next(new ApiError(401, 'Invalid email or password'));
    }

    // Calculate effective permissions by combining role and individual permissions
    const rolePermissions = user.role?.permissions || [];
    const individualPermissions = user.permissions || [];

    // Create a map to merge permissions by resource
    const permissionMap = new Map();

    // Add role permissions first
    rolePermissions.forEach(perm => {
      permissionMap.set(perm.resource, {
        resource: perm.resource,
        actions: [...perm.actions],
        _id: perm._id,
        source: 'role'
      });
    });

    // Add/merge individual permissions (they override role permissions for same resource)
    individualPermissions.forEach(perm => {
      if (permissionMap.has(perm.resource)) {
        // Merge actions, removing duplicates
        const existing = permissionMap.get(perm.resource);
        const combinedActions = [...new Set([...existing.actions, ...perm.actions])];
        permissionMap.set(perm.resource, {
          resource: perm.resource,
          actions: combinedActions,
          _id: perm._id,
          source: 'combined'
        });
      } else {
        permissionMap.set(perm.resource, {
          resource: perm.resource,
          actions: [...perm.actions],
          _id: perm._id,
          source: 'individual'
        });
      }
    });

    const effectivePermissions = Array.from(permissionMap.values());

    // Create a user object with effective permissions for token generation
    const userForToken = {
      ...user.toObject(),
      permissions: effectivePermissions,
      permissionsSource: individualPermissions.length > 0 ? 'combined' : 'role'
    };

    // Generate token with effective permissions
    const token = generateToken(userForToken);

    // Return user without password
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token,
        permissions: user.permissions || [],
        effectivePermissions: effectivePermissions,
        permissionsSource: userForToken.permissionsSource
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    next(new ApiError(500, err.message));
  }
};

// /@route   POST /api/auth/forgetPassword
exports.forgetPassword = async (req, res) => {
  const { email } = req.body;
  let user;

  try {
    user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `https://celorajewelry.com/reset-password?token=${resetToken}`;

    res.status(202).json({ message: 'Password reset request accepted. Check your email shortly.' });

    await sendPasswordResetEmail(user.email, resetUrl, user.name).catch((emailError) => {

      console.error(`Failed to send password reset email to ${email}:`, emailError);

    });
  } catch (err) {
    console.error(err);

    // Optional cleanup to avoid keeping stale tokens
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }

    res.status(500).json({ message: 'Failed to process reset request' });
  }
};

// /@route   POST /api/auth/logout
exports.logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next(new ApiError(400, 'No token provided'));

    const decoded = jwt.decode(token);
    if (!decoded?.exp) return next(new ApiError(400, 'Invalid token'));

    const ttl = decoded.exp - Math.floor(Date.now() / 1000); // seconds left until JWT expires

    // Blacklist the token with expiry
    await redisClient.set(token, 'blacklisted', { EX: ttl });

    res.status(200).json({ message: 'Logged out and token blacklisted' });
  } catch (err) {
    console.error('Logout error:', err);
    next(new ApiError(500, err.message));
  }
};

/**
 * @desc    Create a new user (by an Admin)
 * @route   POST /api/v1/users
 * @access  Private/Admin
 */
exports.createUserByAdmin = asyncHandler(async (req, res) => {
  const { name, email, role } = req.body;

  // ... (Steps 1, 2, 3 are the same)
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User with this email already exists');
  }

  const temporaryPassword = generatePassword();

  const user = await User.create({
    name,
    email,
    role,
    password: temporaryPassword
  });

  if (user) {
    // 4. Send success response to the admin IMMEDIATELY
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      message: 'User created successfully. Credentials will be sent to their email shortly.'
    });

    // 5. Send the welcome email in the background
    // NOTICE: There is no 'await' here.
    sendEmail(email, 'Your New Account Credentials', 'newUserCredentials', {
      name: user.name,
      email: user.email,
      password: temporaryPassword
    }).catch((emailError) => {
      // If the email fails, we log the error but the user has already received a success response.
      console.error(`Failed to send welcome email to ${email}:`, emailError);
      // Here you could add logic to a retry queue or a monitoring service.
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// Soft delete user by admin
exports.softDeleteUserByAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params; // User ID from the URL parameter

  const user = await User.findById(id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (!user.isActive) {
    res.status(400);
    throw new Error('User is already deactivated');
  }

  user.isActive = false; // Mark user as inactive
  await user.save();

  res.status(200).json({
    message: 'User has been deactivated (soft deleted) successfully'
  });
});

/**
 * @desc    Update user password by admin
 * @route   PUT /api/auth/admin/update-password/:userId
 * @access  Private/Admin
 */
exports.updatePasswordByAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { password, sendEmail: shouldSendEmail } = req.body;

  if (!password) {
    res.status(400);
    throw new Error('Password is required');
  }

  // Validate password strength
  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters long');
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  // Update password (will be auto-hashed by pre-save middleware)
  user.password = password;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password updated successfully',
    userId: user._id,
    email: user.email
  });

  // Optionally send email notification in background
  if (shouldSendEmail) {
    sendEmail(user.email, 'Password Updated', 'passwordUpdated', {
      name: user.name,
      password: password
    }).catch((emailError) => {
      console.error(`Failed to send password update email to ${user.email}:`, emailError);
    });
  }
});

/**
 * @desc    Admin login with email and password
 * @route   POST /api/auth/admin/login
 * @access  Public
 */
exports.adminLogin = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // Find user and populate role information
    const user = await User.findOne({ email })
      .select('+password')
      .populate('role');

    if (!user || !(await user.matchPassword(password))) {
      return next(new ApiError(401, 'Invalid email or password'));
    }

    // Check if user has admin role
    const adminRoles = ['SUPERADMIN', 'ADMIN', 'GHB Admin'];
    const isAdmin = user.role && (
      adminRoles.includes(user.role.name) ||
      adminRoles.some(adminRole => user.role.name.toLowerCase().includes(adminRole.toLowerCase()))
    );

    if (!isAdmin) {
      return next(new ApiError(403, 'Access denied. Admin privileges required.'));
    }

    // Calculate effective permissions
    const rolePermissions = user.role?.permissions || [];
    const individualPermissions = user.permissions || [];

    const permissionMap = new Map();

    rolePermissions.forEach(perm => {
      permissionMap.set(perm.resource, {
        resource: perm.resource,
        actions: [...perm.actions],
        _id: perm._id,
        source: 'role'
      });
    });

    individualPermissions.forEach(perm => {
      if (permissionMap.has(perm.resource)) {
        const existing = permissionMap.get(perm.resource);
        const combinedActions = [...new Set([...existing.actions, ...perm.actions])];
        permissionMap.set(perm.resource, {
          resource: perm.resource,
          actions: combinedActions,
          _id: perm._id,
          source: 'combined'
        });
      } else {
        permissionMap.set(perm.resource, {
          resource: perm.resource,
          actions: [...perm.actions],
          _id: perm._id,
          source: 'individual'
        });
      }
    });

    const effectivePermissions = Array.from(permissionMap.values());

    const userForToken = {
      ...user.toObject(),
      permissions: effectivePermissions,
      permissionsSource: individualPermissions.length > 0 ? 'combined' : 'role'
    };

    const token = generateToken(userForToken);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        user: userResponse,
        token,
        permissions: user.permissions || [],
        effectivePermissions: effectivePermissions,
        permissionsSource: userForToken.permissionsSource,
        isAdmin: true
      }
    });
  } catch (err) {
    console.error('Admin Login Error:', err);
    next(new ApiError(500, err.message));
  }
};
