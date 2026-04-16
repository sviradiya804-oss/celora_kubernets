const jwt = require('jsonwebtoken');
const BlacklistedToken = require('../models/BlacklistedToken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'No token provided'));
  }

  const token = authHeader.split(' ')[1];

  // Check if token is blacklisted
  const blacklisted = await BlacklistedToken.findOne({ token });
  if (blacklisted) {
    return next(new ApiError(401, 'Token is blacklisted. Please login again.'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).populate('role');
    if (!user) {
      return next(new ApiError(401, 'User no longer exists'));
    }

    req.user = user; // include role here if needed
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
};
