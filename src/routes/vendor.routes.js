const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const adminVendorController = require('../controllers/adminVendorController');
const { vendorAuth, adminAuth, checkVendorApproval } = require('../middlewares/vendorAuthMiddleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Public routes (no authentication required)
router.post('/register', vendorController.registerVendor);
router.post('/login', vendorController.loginVendor);

// Vendor protected routes
router.get('/profile', vendorAuth, vendorController.getVendorProfile);
router.put('/profile', vendorAuth, vendorController.updateVendorProfile);

// Document upload (single file with documentType in body)
router.post('/upload-documents-fields', 
  vendorAuth, 
  upload.fields([
    { name: 'businessCard', maxCount: 1 },
    { name: 'ownerProof', maxCount: 1 },
    { name: 'passport', maxCount: 1 },
    { name: 'pancard', maxCount: 1 }
  ]),
  vendorController.uploadMultipleDocuments
);
// Dashboard
router.get('/dashboard', vendorAuth, vendorController.getDashboardStats);

// Diamond management (requires vendor approval)
router.post('/diamonds', 
  vendorAuth, 
  checkVendorApproval, 
  vendorController.addDiamond
);

router.get('/diamonds', 
  vendorAuth, 
  vendorController.getVendorDiamonds
);

router.post('/diamonds/import', 
  vendorAuth, 
  checkVendorApproval,
  upload.single('file'), 
  vendorController.importDiamonds
);

// Admin routes for vendor management
router.get('/admin/stats', adminAuth, adminVendorController.getVendorStats);
router.get('/admin/vendors', adminAuth, vendorController.getAllVendors);
router.get('/admin/vendors/:vendorId', adminAuth, adminVendorController.getVendorDetails);
router.put('/admin/vendors/:vendorId/verify', adminAuth, vendorController.verifyVendor);
router.put('/admin/vendors/:vendorId/documents/:documentType/verify', adminAuth, vendorController.verifyDocument);

// Admin routes for diamond verification
router.get('/admin/diamonds', adminAuth, adminVendorController.getVendorDiamondsForVerification);
router.put('/admin/diamonds/:diamondId/verify', adminAuth, adminVendorController.verifyVendorDiamond);

module.exports = router;
