const express = require("express");
const router = express.Router();
const { exportData } = require("../controllers/exportController");

router.post("/", exportData);

module.exports = router;
