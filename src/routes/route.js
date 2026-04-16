const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect: authenticate } = require('../middlewares/authMiddleware.js');
const commonController = require('../controllers/commonController.js');
const { checkIndex } = require('../middlewares/checkIndex.js');
const { checkPermissionWithGroups } = require('../middlewares/groupPermissionMiddleware.js');
const { isPublicResource } = require('../config/permissionGroups');
const userController = require('../controllers/authController.js');
const { convertResponse } = require('../middlewares/responseConversionMiddleware');
const { cacheMiddleware } = require('../middlewares/cacheMiddleware.js');

// Configure multer for in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Custom middleware for public read access
const publicOrAuthenticatedRead = async (req, res, next) => {
  const resource = req.params.indexName?.toLowerCase();

  // Check if this is a public resource that anyone can read
  if (isPublicResource(resource, 'read')) {
    console.log(`[PublicRoute] Allowing public access to: ${req.method} ${req.path} (resource: ${resource})`);
    return next();
  }

  // Not a public resource, require authentication and permission
  return authenticate(req, res, () => {
    return checkPermissionWithGroups('read')(req, res, next);
  });
};

// Middleware to check for the indexName in the URL
// Allow public POST for newsletter
router.post('/newsletter', (req, res, next) => {
  req.params.indexName = 'newsletter';
  next();
}, commonController.insert);

router.use('/:indexName', checkIndex);

// Access routes for finding data - allow public access for guest-accessible resources
router.get('/:indexName/:id', publicOrAuthenticatedRead, cacheMiddleware(3600), convertResponse, commonController.findOne);
router.post('/:indexName/search', publicOrAuthenticatedRead, convertResponse, commonController.find);
router.get('/:indexName', publicOrAuthenticatedRead, cacheMiddleware(3600), convertResponse, commonController.find);

// Protected routes for creating and updating data
// The 'upload.array('images', 10)' middleware will parse multiple files.
// 'images' is the field name for the files. '10' is the maximum number of files allowed.

router.post(
  '/:indexName',
  authenticate,
  checkPermissionWithGroups('create'),
  upload.any(), // Use multer middleware for multiple files,
  (req, res, next) => {
    // If the index is 'users', use the special controller.
    // Otherwise, use the common one.
    if (req.params.indexName === 'user') {
      return userController.createUserByAdmin(req, res, next);
    } else {
      return commonController.insert(req, res, next);
    }
  }
);

router.put(
  '/:indexName/:id',
  authenticate,
  checkPermissionWithGroups('update'),
  upload.any(), // Use multer middleware for multiple files
  commonController.update
);
router.delete('/:indexName/:id', authenticate, checkPermissionWithGroups('delete'),
  (req, res, next) => {
    // If the index is 'users', use the special controller.
    // Otherwise, use the common one.
    if (req.params.indexName === 'user') {
      return userController.softDeleteUserByAdmin(req, res, next);
    } else {
      return commonController.remove(req, res, next);
    }
  },
);

module.exports = router;
