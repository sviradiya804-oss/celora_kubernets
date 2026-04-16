const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();



router.get("/verify", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.status(200).json({
      message: "User is logged in",
      user: decoded,
    });
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

module.exports = router;