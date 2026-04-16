const express = require('express');
const router = express.Router();
const { protect: authenticate } = require('../middlewares/authMiddleware.js');
const wishlistController = require('../controllers/wishlistController.js');

// Get wishlist (paginated)
router.get('/', authenticate, wishlistController.getWishlist);

// Add product to wishlist
router.post('/', authenticate, wishlistController.addToWishlist);

// Remove product from wishlist
router.delete('/', authenticate, wishlistController.removeFromWishlist);

module.exports = router;