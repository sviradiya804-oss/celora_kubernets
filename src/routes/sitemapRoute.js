const express = require('express');
const router = express.Router();
const sitemapController = require('../controllers/sitemapController');

/**
 * Sitemap Routes
 * Dynamic sitemap generation with jewelry and blog slugs
 * Domain: https://celorajewelry.com
 */

// Main sitemap endpoint - serves sitemap.xml
router.get('/sitemap.xml', sitemapController.getSitemap);

// Statistics endpoint for debugging (optional - can be protected with auth)
router.get('/sitemap-stats', sitemapController.getSitemapStats);

// Visual sitemap data endpoint (JSON)
router.get('/sitemap-data', sitemapController.getVisualSitemap);

module.exports = router;
