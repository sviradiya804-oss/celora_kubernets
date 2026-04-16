const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');
const Role = require('../models/Role');
const { isPublicResource } = require('../config/permissionGroups');
const redisClient = require('../utils/redis');

// HTTP method to action mapping
const methodToActionMap = {
  GET: 'read',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

exports.protect = async (req, res, next) => {
  const action = methodToActionMap[req.method];

  // Extract resource from params or from URL path
  let resource = req.params.indexName;
  if (!resource) {
    // Extract resource from path for specific routes like /api/wishlist, /api/cart, etc.
    // Use req.originalUrl to get the full path since req.path is relative to the router
    const fullPath = req.originalUrl || req.path;
    const pathSegments = fullPath.split('/').filter(segment => segment);
    if (pathSegments.length >= 2 && pathSegments[0] === 'api') {
      resource = pathSegments[1];
    }
  }

  try {
    // If an Authorization header is present, always validate token and populate req.user.
    // Only when there's no token present do we consult the GUEST role for public access.
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      // Check if token is blacklisted
      const isBlacklisted = await redisClient.get(token);
      if (isBlacklisted) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token (logged out)' });
      }

      // Validate token and attach user
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).populate('role').select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Check if token version matches the user's current token version
      // Use || 0 to handle cases where tokenVersion might be undefined (legacy tokens/users)
      const tokenVersion = decoded.tokenVersion || 0;
      const userTokenVersion = req.user.tokenVersion || 0;

      if (tokenVersion !== userTokenVersion) {
        return res.status(401).json({ message: 'Unauthorized: Password changed, please login again' });
      }

      return next();
    }

    // No token provided -> allow if resource is public for guests
    // Normalize resource (some routes use pluralization/casing)
    const normalizedResource = (resource || '').toLowerCase();
    const publicAllowed = isPublicResource(normalizedResource, action);

    if (publicAllowed) {
      console.log(`[Auth] Public route allowed for guests: ${req.method} ${req.originalUrl || req.path} -> ${normalizedResource}#${action}`);
      return next();
    }

    // No token and not public
    return res.status(401).json({ message: 'Unauthorized: Token required' });
  } catch (err) {
    console.error(`[Auth] Error in protect middleware: ${err.message}`);
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

// Export authenticate as an alias for protect
exports.authenticate = exports.protect;
