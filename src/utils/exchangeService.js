const mongoose = require('mongoose');
const models = require('../models');

const ExchangeRate = models.Exchangerate;

/**
 * Resolve an active exchange rate record by country or currency code.
 * Accepts either country name/code or currency ISO code.
 * Returns an object { rate, currencyCode, symbol } with defaults for USD.
 */
const resolveRate = async (opts = {}) => {
  const { country, currency, exchangeRateId, exchangeRateDoc } = opts;

  // If an exchange rate doc is provided directly, use it
  if (exchangeRateDoc && typeof exchangeRateDoc === 'object') {
    return { rate: exchangeRateDoc.rate || 1, currencyCode: exchangeRateDoc.currencyCode || 'USD', symbol: exchangeRateDoc.symbol || exchangeRateDoc.currencyCode || '$' };
  }

  // If an explicit exchangerate id is provided, fetch and return it
  if (exchangeRateId) {
    try {
      const recById = await ExchangeRate.findById(exchangeRateId).lean();
      if (recById) return { rate: recById.rate || 1, currencyCode: recById.currencyCode || 'USD', symbol: recById.symbol || recById.currencyCode || '$' };
    } catch (e) {
      // swallow and fallback to other lookups
    }
  }

  // If neither country nor currency nor id provided, default to USD
  if (!country && !currency) {
    return { rate: 1, currencyCode: 'USD', symbol: '$' };
  }

  const query = { isActive: true };
  if (currency) query.$or = [{ currencyCode: currency.toUpperCase() }];
  if (country) {
    query.$or = query.$or ? query.$or.concat([{ country: country }, { country: country.toUpperCase() }, { country: country.toLowerCase() }]) : [{ country }];
  }

  let rec = await ExchangeRate.findOne(query).lean();

  // fallback: try currency only
  if (!rec && currency) rec = await ExchangeRate.findOne({ currencyCode: currency.toUpperCase(), isActive: true }).lean();

  if (!rec) return { rate: 1, currencyCode: 'USD', symbol: '$' };

  return { rate: rec.rate || 1, currencyCode: rec.currencyCode || 'USD', symbol: rec.symbol || rec.currencyCode || '$' };
};

/**
 * Convert numeric amount (assumed stored in USD base) using resolved rate.
 */
const convertAmount = (amount, rate) => {
  if (typeof amount !== 'number') amount = Number(amount) || 0;
  return Number((amount * (rate || 1)).toFixed(2));
};

/**
 * Convert product-like object in-place (returns a shallow-copied converted object)
 * Will convert fields: price, priceAtTime, productDetails.price, total, formattedTotal
 * Also handles: subtotal, grandTotal, amount, discountAmount, shippingCost, taxAmount
 * Adds: currencyCode, currencySymbol, priceConverted (where applicable), formattedPrice
 */
const convertProductSnapshot = (product, rateInfo) => {
  if (!product || typeof product !== 'object') return product;

  const out = Object.assign({}, product);
  const { rate, currencyCode, symbol } = rateInfo || { rate: 1, currencyCode: 'USD', symbol: '$' };

  // convert top-level price fields
  if (out.price !== undefined) out.price = convertAmount(out.price, rate);
  if (out.priceAtTime !== undefined) out.priceAtTime = convertAmount(out.priceAtTime, rate);
  
  // Convert monetary fields commonly found in cart/checkout/orders
  if (out.subtotal !== undefined) out.subtotal = convertAmount(out.subtotal, rate);
  if (out.grandTotal !== undefined) out.grandTotal = convertAmount(out.grandTotal, rate);
  if (out.amount !== undefined) out.amount = convertAmount(out.amount, rate);
  if (out.discountAmount !== undefined) out.discountAmount = convertAmount(out.discountAmount, rate);
  if (out.shippingCost !== undefined) out.shippingCost = convertAmount(out.shippingCost, rate);
  if (out.taxAmount !== undefined) out.taxAmount = convertAmount(out.taxAmount, rate);

  // productDetails.price
  if (out.productDetails && out.productDetails.price !== undefined) {
    out.productDetails = Object.assign({}, out.productDetails);
    out.productDetails.price = convertAmount(out.productDetails.price, rate);
  }

  // totals that depend on price * quantity
  if (out.total !== undefined && out.quantity !== undefined) {
    // recalc from converted priceAtTime if available otherwise productDetails.price
    const unit = out.priceAtTime || (out.productDetails && out.productDetails.price) || out.price || 0;
    out.total = Number((unit * (out.quantity || 1)).toFixed(2));
  }

  // formatted strings
  const displayUnit = out.priceAtTime || (out.productDetails && out.productDetails.price) || out.price || 0;
  out.formattedPrice = `${symbol}${Number(displayUnit).toFixed(2)}`;
  if (out.total !== undefined) out.formattedTotal = `${symbol}${Number(out.total).toFixed(2)}`;
  if (out.subtotal !== undefined) out.formattedSubtotal = `${symbol}${Number(out.subtotal).toFixed(2)}`;
  if (out.grandTotal !== undefined) out.formattedGrandTotal = `${symbol}${Number(out.grandTotal).toFixed(2)}`;

  out.currencyCode = currencyCode;
  out.currencySymbol = symbol;

  return out;
};

module.exports = {
  resolveRate,
  convertAmount,
  convertProductSnapshot
};
