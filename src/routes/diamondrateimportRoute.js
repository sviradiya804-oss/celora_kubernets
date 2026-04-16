const express = require('express');
const router = express.Router();
const upload = require('../utils/multer'); 
const diamondRateController = require('../controllers/importdiamondRates'); // Adjust path as needed
const { protect: authenticate } = require('../middlewares/authMiddleware.js');

// POST /api/diamond-rate/import
router.post(
  '/import',
  authenticate, // Authentication required
  upload.any(), // File upload handling
  diamondRateController.importDiamondRate // Updated to match controller export
);

module.exports = router;
