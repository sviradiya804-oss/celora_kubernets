const multer = require("multer");
const path = require("path");

// Store file in memory (no disk)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".xlsx") {
    cb(null, true);
  } else {
    cb(new Error("Only .xlsx files are allowed"));
  }
};

module.exports = multer({ storage, fileFilter });
