
const express = require('express');
const router = express.Router();
const {getAdminLogs} = require('../controllers/adminLogsController');
const { isAdmin } = require('../middlewares/logMiddleware'); // <- import here
const { isAuth } = require('../middlewares/logMiddleware');  // <- if using JWT-based auth

router.get('/admin-logs',  getAdminLogs);

module.exports = router;
