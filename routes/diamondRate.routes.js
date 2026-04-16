const express = require('express');
const router = express.Router();
const upload = require('../utils/multer');
const diamondRateController = require('../controllers/importdiamondRates'); // Adjust path as needed

// POST /api/diamond-rate/import
router.post(
  '/import',
  upload.any(), // Accepts Excel file uploads
  diamondRateController.importDiamondRate
);

module.exports = router;
