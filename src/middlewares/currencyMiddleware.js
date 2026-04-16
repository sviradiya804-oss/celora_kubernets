/**
 * Currency Middleware
 * Resolves the target currency for the request from multiple sources:
 * Priority: 1. Query params, 2. Headers, 3. User profile, 4. Default USD
 */

const mongoose = require('mongoose');

/**
 * Middleware to extract and attach currency information to the request
 * Sets req.currencyInfo with { currency, country, source }
 */
const resolveCurrency = async (req, res, next) => {
  try {
    let currency = null;
    let country = null;
    let source = 'default';

    // Priority 1: Query parameters (?currency=EUR or ?country=Germany)
    if (req.query.currency) {
      currency = req.query.currency.toUpperCase();
      source = 'query';
    } else if (req.query.country) {
      country = req.query.country;
      source = 'query';
    }
    // Priority 1.5: Body parameters (for POST requests)
    else if (req.body && req.body.currency) {
      currency = req.body.currency.toUpperCase();
      source = 'body';
    } else if (req.body && req.body.country) {
      country = req.body.country;
      source = 'body';
    }

    // Priority 2: Headers (x-currency or x-country)
    else if (req.headers['x-currency']) {
      currency = req.headers['x-currency'].toUpperCase();
      source = 'header';
    } else if (req.headers['x-country']) {
      country = req.headers['x-country'];
      source = 'header';
    }

    // Priority 3: Authenticated user's profile
    else if (req.user) {
      try {
        const User = mongoose.model('User');
        const user = await User.findById(req.user._id || req.user.id)
          .select('preferredCurrency preferredCountry exchangeRate')
          .lean();

        if (user) {
          currency = user.preferredCurrency || null;
          country = user.preferredCountry || null;
          source = 'profile';

          // Also attach exchangeRate reference if available
          if (user.exchangeRate) {
            req.userExchangeRateId = user.exchangeRate;
          }
        }
      } catch (err) {
        console.warn('Currency middleware: Failed to fetch user preferences:', err.message);
      }
    }

    // Attach to request for downstream use
    req.currencyInfo = {
      currency: currency || 'USD',
      country: country || null,
      source: source,
      exchangeRateId: req.userExchangeRateId || null
    };

    console.log('🔹 [CurrencyMiddleware] Resolved currency:', req.currencyInfo);

    next();
  } catch (error) {
    console.error('Currency middleware error:', error);
    // Set default and continue
    req.currencyInfo = { currency: 'USD', country: null, source: 'default' };
    next();
  }
};

module.exports = { resolveCurrency };
