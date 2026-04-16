const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();
const {
  register,
  login,
  logout,
  forgetPassword,
  resetPassword,
  adminLogin,
  updatePasswordByAdmin
} = require('../controllers/authController');
const { loginLimiter } = require('../utils/rateLimiter');
const { protect: authenticate } = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.post('/forget-password', forgetPassword);
router.put('/reset-password/:token', resetPassword);

// Admin routes
router.post('/admin/login', loginLimiter, adminLogin);
router.put('/admin/update-password/:userId', authenticate, updatePasswordByAdmin);

// Google OAuth
router.get('/google', (req, res, next) => {
  console.log('🔥 /google route HIT');
  next();
}, passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
}));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    try {
      if (!req.user) {
        console.error('❌ No user found in Google OAuth callback');
        return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
      }

      console.log('✅ Google OAuth callback successful for user:', req.user.email);

      const token = jwt.sign(
        {
          id: req.user._id,
          email: req.user.email,
          tokenVersion: req.user.tokenVersion || 0
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      const refreshToken = jwt.sign(
        { id: req.user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Save refresh token in secure, HttpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      const redirectURL = `${process.env.CLIENT_URL}/oauth-success?token=${token}`;
      console.log('🔄 Redirecting to:', redirectURL);
      res.redirect(redirectURL);
    } catch (error) {
      console.error('❌ Error in Google OAuth callback:', error);
      res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_error`);
    }
  }
);

module.exports = router;
