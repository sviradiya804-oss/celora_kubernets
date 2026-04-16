const express = require('express');
const router = express.Router();
const {importDiamonds} = require('../controllers/importController');
const upload = require('../utils/multer');

// POST /api/diamonds/import
router.post("/import", upload.single("file"), importDiamonds);

module.exports = router;
