const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Enhanced Validation Middleware for Celora Backend
 * Provides comprehensive input validation and sanitization
 */

// Generic validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Cart validation rules
const validateCartAdd = [
  body('sessionId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .trim()
    .escape()
    .withMessage('Valid session ID is required'),
    
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required'),
    
  body('productId')
    .isMongoId()
    .withMessage('Valid product ID is required'),
    
  body('quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
    
  body('selectedVariant')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .trim()
    .escape()
    .withMessage('Variant must be a valid string'),
    
  handleValidationErrors
];

const validateCartUpdate = [
  body('sessionId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .trim()
    .escape(),
    
  body('userId')
    .isMongoId(),
    
  body('productId')
    .isMongoId(),
    
  body('quantity')
    .isInt({ min: 1, max: 100 }),
    
  handleValidationErrors
];

const validateCartCheckout = [
  body('sessionId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .trim()
    .escape(),
    
  body('userId')
    .isMongoId(),
    
  handleValidationErrors
];

const validateCouponApplication = [
  body('sessionId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .trim()
    .escape(),
    
  body('userId')
    .isMongoId(),
    
  body('code')
    .isString()
    .isLength({ min: 1, max: 50 })
    .trim()
    .escape()
    .matches(/^[A-Z0-9-_]+$/)
    .withMessage('Coupon code contains invalid characters'),
    
  handleValidationErrors
];

// Payment validation rules
const validatePaymentIntent = [
  body('amount')
    .isInt({ min: 1, max: 100000000 }) // Max $1M in cents
    .withMessage('Amount must be a positive integer in cents'),
    
  body('currency')
    .isString()
    .isLength({ min: 3, max: 3 })
    .toLowerCase()
    .isIn(['usd', 'eur', 'gbp', 'cad'])
    .withMessage('Invalid currency code'),
    
  handleValidationErrors
];

const validateRefund = [
  body('paymentIntentId')
    .isString()
    .matches(/^pi_[a-zA-Z0-9_]+$/)
    .withMessage('Invalid payment intent ID format'),
    
  body('amount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Refund amount must be positive'),
    
  handleValidationErrors
];

// Order validation rules
const validateOrderStatusUpdate = [
  param('orderId')
    .isString()
    .isLength({ min: 1, max: 100 })
    .trim()
    .escape(),
    
  body('newStatus')
    .isString()
    .isIn(['Pending', 'Confirmed', 'Manufacturing', 'Quality Assurance', 'Out For Delivery', 'Delivered', 'Cancelled'])
    .withMessage('Invalid order status'),
    
  body('statusMessage')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .trim()
    .escape(),
    
  body('customerEmail')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
    
  handleValidationErrors
];

const validateEmailTest = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
    
  body('type')
    .isString()
    .isIn(['confirmed', 'manufacturing', 'quality', 'delivery', 'delivered', 'invoice'])
    .withMessage('Invalid email type'),
    
  body('orderId')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .trim()
    .escape(),
    
  body('customerName')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .trim()
    .escape(),
    
  body('imageUrls')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Maximum 10 image URLs allowed'),
    
  body('imageUrls.*')
    .optional()
    .isURL()
    .withMessage('Invalid image URL format'),
    
  handleValidationErrors
];

// Common CRUD validation
const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
    
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('sort')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .trim()
    .escape(),
    
  handleValidationErrors
];

// Security validation middleware
const validateSession = async (req, res, next) => {
  try {
    const { sessionId, userId } = req.body;
    
    // Validate session belongs to user (if authenticated)
    if (req.user && req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Session does not belong to authenticated user'
      });
    }
    
    // Additional session validation logic can be added here
    // e.g., check session expiry, validate session format, etc.
    
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Session validation failed'
    });
  }
};

// Price validation middleware
const validatePricing = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    
    if (productId && quantity) {
      // Ensure we're using current product price, not client-provided price
      const Product = mongoose.models.productModel || 
        mongoose.model('productModel', require('../models/schema').product, 'products');
      
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      
      // Check if product is available
      if (product.status === 'disabled' || product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: 'Product not available in requested quantity'
        });
      }
      
      // Attach validated product data to request
      req.validatedProduct = product;
    }
    
    next();
  } catch (error) {
    console.error('Price validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Price validation failed'
    });
  }
};

// File upload validation
const validateFileUpload = (req, res, next) => {
  if (req.file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'
      });
    }
    
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    
    // Validate filename
    const filename = req.file.originalname;
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename characters'
      });
    }
  }
  
  next();
};

module.exports = {
  // Cart validations
  validateCartAdd,
  validateCartUpdate,
  validateCartCheckout,
  validateCouponApplication,
  
  // Payment validations
  validatePaymentIntent,
  validateRefund,
  
  // Order validations
  validateOrderStatusUpdate,
  validateEmailTest,
  
  // Common validations
  validateMongoId,
  validatePagination,
  
  // Security middlewares
  validateSession,
  validatePricing,
  validateFileUpload,
  
  // Utility
  handleValidationErrors
};
