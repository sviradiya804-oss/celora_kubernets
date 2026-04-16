const mongoose = require('mongoose');
const Schema = require('../models/schema.js');
const ApiError = require('../utils/ApiError');

// Get Wishlist (with pagination)
exports.getWishlist = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      // Return empty wishlist for unauthenticated users
      return res.status(200).json({
        data: [],
        page: 1,
        limit: 10,
        totalPages: 0,
        totalResults: 0,
        message: 'Please login to view your wishlist'
      });
    }
  console.log('Fetching wishlist for user:', userId);
  const Wishlist = mongoose.models['wishlistModel'] || mongoose.model('wishlistModel', Schema['wishlist'], 'wishlists');
  // Use a tolerant isDeleted check to handle documents created before the field existed
  const queryObj = { user: userId, isDeleted: { $ne: true } };
  console.log('Wishlist query:', queryObj);
  const wishlist = await Wishlist.findOne(queryObj);
  console.log('Wishlist found:', !!wishlist, wishlist ? { id: wishlist._id, products: wishlist.products.length } : null);
    if (!wishlist) {
      return res.status(200).json({
        data: [],
        page: 1,
        limit: 10,
        totalPages: 0,
        totalResults: 0
      });
    }
    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 10);
    const start = (page - 1) * limit;
    const paginatedProducts = wishlist.products.slice(start, start + limit);
    return res.status(200).json({
      data: paginatedProducts,
      page,
      limit,
      totalPages: Math.ceil(wishlist.products.length / limit),
      totalResults: wishlist.products.length
    });
  } catch (err) {
    next(new ApiError(500, err.message));
  }
};

// Add Product to Wishlist
exports.addToWishlist = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: 'User or productId missing' });
    }
    const Wishlist = mongoose.models['wishlistModel'] || mongoose.model('wishlistModel', Schema['wishlist'], 'wishlists');
    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = new Wishlist({
        wishlistId: 'WIS' + Date.now(),
        user: userId,
        products: [productId],
        isDeleted: false,
        createdBy: userId,
        updatedBy: userId,
        createdOn: new Date(),
        updatedOn: new Date()
      });
    } else {
      if (!wishlist.products.includes(productId)) {
        wishlist.products.push(productId);
        wishlist.updatedOn = new Date();
        wishlist.updatedBy = userId;
      }
    }
    const saved = await wishlist.save();
    return res.status(201).json({
      success: true,
      data: saved,
      message: 'Product added to wishlist'
    });
  } catch (err) {
    next(new ApiError(500, err.message));
  }
};

// Remove Product from Wishlist
exports.removeFromWishlist = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: 'User or productId missing' });
    }
    const Wishlist = mongoose.models['wishlistModel'] || mongoose.model('wishlistModel', Schema['wishlist'], 'wishlists');
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }
    wishlist.products = wishlist.products.filter(p => p.toString() !== productId);
    wishlist.updatedOn = new Date();
    wishlist.updatedBy = userId;
    await wishlist.save();
    return res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      data: wishlist
    });
  } catch (err) {
    next(new ApiError(500, err.message));
  }
};