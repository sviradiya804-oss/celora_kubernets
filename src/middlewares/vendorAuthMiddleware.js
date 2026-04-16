const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Schema = require('../models/schema');

// Create models
const Vendor = mongoose.models.vendorModel || mongoose.model('vendorModel', Schema.vendor, 'vendors');

// Vendor authentication middleware
exports.vendorAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's a vendor token
    if (decoded.type !== 'vendor') {
      return res.status(401).json({ message: 'Invalid token type' });
    }
    
    const vendor = await Vendor.findById(decoded.id).select('-password');
    
    if (!vendor) {
      return res.status(401).json({ message: 'Vendor not found' });
    }
    
    if (vendor.isDeleted) {
      return res.status(401).json({ message: 'Vendor account is deactivated' });
    }
    
    req.vendor = vendor;
    req.vendorId = vendor._id;
    next();
  } catch (err) {
    console.error('Vendor auth error:', err);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Admin authentication middleware (for vendor management)
exports.adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's an admin/user token (not vendor)
    if (decoded.type === 'vendor') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    // Import User model to check admin status
    const User = require('../models/User');
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Check if user has admin role (adjust this based on your role system)
    // For now, allow any authenticated user to access admin routes
    // You can modify this based on your actual role structure
    
    req.user = user;
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Middleware to check if vendor is approved (for diamond operations)
exports.checkVendorApproval = async (req, res, next) => {
  try {
    if (req.vendor.verificationStatus !== 'approved') {
      return res.status(403).json({ 
        message: 'Your account must be approved before performing this action',
        currentStatus: req.vendor.verificationStatus 
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
