/**
 * Currency Preference Routes
 * API endpoints for managing user currency preferences
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect: authenticate } = require('../middlewares/authMiddleware');
const models = require('../models');

// Models
const User = mongoose.model('User');
const Exchangerate = models.Exchangerate;

/**
 * Optional authentication middleware
 * Tries to authenticate user but doesn't fail if no token present
 * Sets req.user if authenticated, otherwise leaves it undefined
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch (error) {
    // Token validation failed - continue as guest user
    console.log('Optional auth failed, continuing as guest:', error.message);
  }
  
  next();
};

/**
 * GET /api/currency/preference
 * Get current user's currency preference
 */
router.get('/preference', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id)
      .select('preferredCurrency preferredCountry exchangeRate')
      .populate('exchangeRate')
      .lean();

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      preference: {
        currency: user.preferredCurrency || 'USD',
        country: user.preferredCountry || 'United States',
        exchangeRate: user.exchangeRate || null
      }
    });
  } catch (error) {
    console.error('Get currency preference error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch currency preference' 
    });
  }
});

/**
 * PUT /api/currency/preference
 * Update user's preferred currency
 * Body: { currency: 'EUR', country: 'Germany' } or { exchangeRateId: '...' }
 */
router.put('/preference', authenticate, async (req, res) => {
  try {
    const { currency, country, exchangeRateId } = req.body;

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    // Option 1: Set by exchangeRateId
    if (exchangeRateId) {
      const exchangeRate = await Exchangerate.findById(exchangeRateId);
      if (!exchangeRate) {
        return res.status(404).json({ 
          success: false, 
          error: 'Exchange rate not found' 
        });
      }

      user.exchangeRate = exchangeRateId;
      user.preferredCurrency = exchangeRate.currencyCode;
      user.preferredCountry = exchangeRate.country;
    }
    // Option 2: Set by currency code or country
    else if (currency || country) {
      const query = { isActive: true };
      if (currency) query.currencyCode = currency.toUpperCase();
      if (country) query.country = country;

      const exchangeRate = await Exchangerate.findOne(query);
      
      if (exchangeRate) {
        user.exchangeRate = exchangeRate._id;
        user.preferredCurrency = exchangeRate.currencyCode;
        user.preferredCountry = exchangeRate.country;
      } else {
        // Set currency/country even if no exchange rate found (will use Frankfurter API)
        if (currency) user.preferredCurrency = currency.toUpperCase();
        if (country) user.preferredCountry = country;
        user.exchangeRate = null;
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide currency, country, or exchangeRateId' 
      });
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('preferredCurrency preferredCountry exchangeRate')
      .populate('exchangeRate')
      .lean();

    res.json({
      success: true,
      message: 'Currency preference updated successfully',
      preference: {
        currency: updatedUser.preferredCurrency,
        country: updatedUser.preferredCountry,
        exchangeRate: updatedUser.exchangeRate
      }
    });
  } catch (error) {
    console.error('Update currency preference error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update currency preference' 
    });
  }
});

/**
 * DELETE /api/currency/preference
 * Reset user's currency preference to default (USD)
 */
router.delete('/preference', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    user.preferredCurrency = 'USD';
    user.preferredCountry = 'United States';
    user.exchangeRate = null;

    await user.save();

    res.json({
      success: true,
      message: 'Currency preference reset to default (USD)',
      preference: {
        currency: 'USD',
        country: 'United States',
        exchangeRate: null
      }
    });
  } catch (error) {
    console.error('Reset currency preference error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset currency preference' 
    });
  }
});

/**
 * GET /api/currency/available
 * Get list of available currencies/exchange rates
 * Public endpoint - works for both authenticated and guest users
 */
router.get('/available', async (req, res) => {
  try {
    const exchangeRates = await Exchangerate.find({ isActive: true })
      .select('country currencyCode rate symbol flags')
      .sort({ country: 1 })
      .lean();

    res.json({
      success: true,
      currencies: exchangeRates,
      baseCurrency: 'USD',
      note: 'All prices are stored in USD. Use the rate as multiplier to convert.'
    });
  } catch (error) {
    console.error('Get available currencies error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch available currencies' 
    });
  }
});

/**
 * POST /api/currency/validate
 * Validate a currency code and get its exchange rate
 * Public endpoint - useful for guest users before making requests
 */
router.post('/validate', async (req, res) => {
  try {
    const { currency } = req.body;

    if (!currency) {
      return res.status(400).json({
        success: false,
        error: 'Currency code is required'
      });
    }

    const exchangeRate = await Exchangerate.findOne({
      currencyCode: currency.toUpperCase(),
      isActive: true
    }).lean();

    if (!exchangeRate) {
      return res.status(404).json({
        success: false,
        error: `Currency '${currency}' not found or not active`,
        availableEndpoint: '/api/currency/available'
      });
    }

    res.json({
      success: true,
      valid: true,
      currency: {
        code: exchangeRate.currencyCode,
        symbol: exchangeRate.symbol,
        rate: exchangeRate.rate,
        country: exchangeRate.country
      },
      usage: {
        queryParam: `?currency=${exchangeRate.currencyCode}`,
        header: `X-Currency: ${exchangeRate.currencyCode}`
      }
    });
  } catch (error) {
    console.error('Validate currency error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate currency'
    });
  }
});

/**
 * POST /api/currency/set
 * Set currency preference
 * - For authenticated users: Saves to user profile
 * - For guest users: Returns instructions to use query params/headers
 */
router.post('/set', optionalAuth, async (req, res) => {
  try {
    const { currency, country } = req.body;

    if (!currency) {
      return res.status(400).json({
        success: false,
        error: 'Currency code is required'
      });
    }

    // Validate currency exists
    const exchangeRate = await Exchangerate.findOne({
      currencyCode: currency.toUpperCase(),
      isActive: true
    }).lean();

    if (!exchangeRate) {
      return res.status(404).json({
        success: false,
        error: `Currency '${currency}' not found or not active`,
        availableEndpoint: '/api/currency/available'
      });
    }

    // Check if user is authenticated
    const isAuthenticated = req.user && (req.user._id || req.user.id);

    if (isAuthenticated) {
      // Authenticated user - save to profile
      const user = await User.findById(req.user._id || req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      user.preferredCurrency = exchangeRate.currencyCode;
      user.preferredCountry = country || exchangeRate.country;
      user.exchangeRate = exchangeRate._id;

      await user.save();

      return res.json({
        success: true,
        message: 'Currency preference saved to your profile',
        userType: 'authenticated',
        preference: {
          currency: exchangeRate.currencyCode,
          symbol: exchangeRate.symbol,
          country: user.preferredCountry,
          rate: exchangeRate.rate
        },
        appliedTo: 'All future requests will use this currency automatically'
      });
    } else {
      // Guest user - return instructions
      return res.json({
        success: true,
        message: 'Currency preference cannot be saved (guest user)',
        userType: 'guest',
        preference: {
          currency: exchangeRate.currencyCode,
          symbol: exchangeRate.symbol,
          country: exchangeRate.country,
          rate: exchangeRate.rate
        },
        instructions: {
          queryParam: `Add ?currency=${exchangeRate.currencyCode} to your requests`,
          header: `Or add header: X-Currency: ${exchangeRate.currencyCode}`,
          example: `/api/jewelry?currency=${exchangeRate.currencyCode}`
        },
        note: 'To save currency preference permanently, please sign up or log in'
      });
    }
  } catch (error) {
    console.error('Set currency error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set currency preference'
    });
  }
});

module.exports = router;
