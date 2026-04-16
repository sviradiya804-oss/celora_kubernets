const express = require('express');
const router = express.Router();
const {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog
} = require('../controllers/blogController');
const { protect } = require('../middlewares/authMiddleware');
const { checkRolePermission } = require('../middlewares/permissionMiddleware');
const upload = require('../middlewares/uploadMiddleware');

// Create Blog (Only admin and superadmin can create blogs)
router.post(
  '/',
  protect,
  checkRolePermission('admin', 'superadmin'),
  upload.single('image'),
  createBlog
);

// Get All Blogs (Public)
router.get('/', getAllBlogs);

// Get Single Blog by ID (Public)
router.get('/:id', getBlogById);

// Update Blog (Protected)
router.put(
  '/:id',
  protect,
  checkRolePermission('admin', 'superadmin'),
  upload.single('image'),
  updateBlog
);

// Delete Blog (Protected)
router.delete('/:id', protect, checkRolePermission('admin', 'superadmin'), deleteBlog);

module.exports = router;
