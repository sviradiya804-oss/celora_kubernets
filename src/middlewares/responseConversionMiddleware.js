/**
 * Response Conversion Middleware
 * Automatically converts price fields in API responses based on currency preferences
 */

const exchangeService = require('../utils/exchangeService');

/**
 * Recursively convert price-related fields in nested objects/arrays
 */
function convertDataRecursively(data, rateInfo) {
  // Handle null/undefined
  if (data == null) return data;

  // Handle arrays - convert each item
  if (Array.isArray(data)) {
    return data.map(item => convertDataRecursively(item, rateInfo));
  }

  // Handle objects
  if (typeof data === 'object') {
    // Check if this looks like a jewelry metalPricing object with finalPrice
    if (data.finalPrice && typeof data.finalPrice === 'object') {
      const converted = { ...data };
      
      // Convert finalPrice.natural and finalPrice.lab
      if (data.finalPrice.natural !== undefined) {
        converted.finalPrice = { ...data.finalPrice };
        converted.finalPrice.natural = exchangeService.convertAmount(data.finalPrice.natural, rateInfo.rate);
      }
      if (data.finalPrice.lab !== undefined) {
        converted.finalPrice = converted.finalPrice || { ...data.finalPrice };
        converted.finalPrice.lab = exchangeService.convertAmount(data.finalPrice.lab, rateInfo.rate);
      }
      
      // Convert other price fields in metalPricing
      if (data.cost !== undefined) converted.cost = exchangeService.convertAmount(data.cost, rateInfo.rate);
      if (data.shippingCharges !== undefined) converted.shippingCharges = exchangeService.convertAmount(data.shippingCharges, rateInfo.rate);
      if (data.packagingCharges !== undefined) converted.packagingCharges = exchangeService.convertAmount(data.packagingCharges, rateInfo.rate);
      if (data.grandTotal !== undefined) converted.grandTotal = exchangeService.convertAmount(data.grandTotal, rateInfo.rate);
      
      // Convert nested metalCost
      if (data.metalCost && typeof data.metalCost === 'object') {
        converted.metalCost = { ...data.metalCost };
        if (data.metalCost.totalCost) {
          converted.metalCost.totalCost = {
            natural: exchangeService.convertAmount(data.metalCost.totalCost.natural, rateInfo.rate),
            lab: exchangeService.convertAmount(data.metalCost.totalCost.lab, rateInfo.rate)
          };
        }
        if (data.metalCost.pricePerGram) {
          converted.metalCost.pricePerGram = {
            natural: exchangeService.convertAmount(data.metalCost.pricePerGram.natural, rateInfo.rate),
            lab: exchangeService.convertAmount(data.metalCost.pricePerGram.lab, rateInfo.rate)
          };
        }
      }
      
      // Convert nested labourCost
      if (data.labourCost && typeof data.labourCost === 'object') {
        converted.labourCost = { ...data.labourCost };
        if (data.labourCost.pricePerGram !== undefined) {
          converted.labourCost.pricePerGram = exchangeService.convertAmount(data.labourCost.pricePerGram, rateInfo.rate);
        }
        if (data.labourCost.totalCost !== undefined) {
          converted.labourCost.totalCost = exchangeService.convertAmount(data.labourCost.totalCost, rateInfo.rate);
        }
      }
      
      // Convert other nested objects
      if (data.totalMetalLabour) {
        converted.totalMetalLabour = {
          natural: exchangeService.convertAmount(data.totalMetalLabour.natural, rateInfo.rate),
          lab: exchangeService.convertAmount(data.totalMetalLabour.lab, rateInfo.rate)
        };
      }
      if (data.totalMetalLabourGst) {
        converted.totalMetalLabourGst = {
          natural: exchangeService.convertAmount(data.totalMetalLabourGst.natural, rateInfo.rate),
          lab: exchangeService.convertAmount(data.totalMetalLabourGst.lab, rateInfo.rate)
        };
      }
      if (data.diamondRateCost) {
        converted.diamondRateCost = {
          natural: exchangeService.convertAmount(data.diamondRateCost.natural, rateInfo.rate),
          lab: exchangeService.convertAmount(data.diamondRateCost.lab, rateInfo.rate)
        };
      }
      if (data.totalDiamondRate) {
        converted.totalDiamondRate = {
          natural: exchangeService.convertAmount(data.totalDiamondRate.natural, rateInfo.rate),
          lab: exchangeService.convertAmount(data.totalDiamondRate.lab, rateInfo.rate)
        };
      }
      if (data.totalAmount) {
        converted.totalAmount = {
          natural: exchangeService.convertAmount(data.totalAmount.natural, rateInfo.rate),
          lab: exchangeService.convertAmount(data.totalAmount.lab, rateInfo.rate)
        };
      }
      if (data.profit) {
        converted.profit = {
          natural: exchangeService.convertAmount(data.profit.natural, rateInfo.rate),
          lab: exchangeService.convertAmount(data.profit.lab, rateInfo.rate)
        };
      }
      
      // Add currency metadata and formatted price
      converted.currencyCode = rateInfo.currencyCode;
      converted.currencySymbol = rateInfo.symbol;
      converted.formattedPrice = `${rateInfo.symbol}${Number(converted.finalPrice.natural || 0).toFixed(2)}`;
      converted.formattedGrandTotal = `${rateInfo.symbol}${Number(converted.grandTotal || 0).toFixed(2)}`;
      
      return converted;
    }
    
    // Check if this looks like a product/cart item with price fields
    const hasPrice = data.price !== undefined || 
                     data.priceAtTime !== undefined || 
                     data.total !== undefined ||
                     data.subtotal !== undefined ||
                     data.grandTotal !== undefined ||
                     data.amount !== undefined;

    if (hasPrice) {
      // Use exchangeService to convert product-like objects
      return exchangeService.convertProductSnapshot(data, rateInfo);
    }

    // Handle special cases - cart, order, checkout objects
    const converted = {};
    for (const [key, value] of Object.entries(data)) {
      // Convert nested arrays and objects
      if (key === 'items' && Array.isArray(value)) {
        // Cart/order items
        converted[key] = value.map(item => exchangeService.convertProductSnapshot(item, rateInfo));
      } else if (key === 'products' && Array.isArray(value)) {
        // Order products
        converted[key] = value.map(item => exchangeService.convertProductSnapshot(item, rateInfo));
      } else if (key === 'productDetails' && typeof value === 'object') {
        // Product details object
        converted[key] = exchangeService.convertProductSnapshot(value, rateInfo);
      } else if (typeof value === 'object' || Array.isArray(value)) {
        // Recurse into other objects/arrays
        converted[key] = convertDataRecursively(value, rateInfo);
      } else {
        converted[key] = value;
      }
    }

    // Convert monetary fields at this level
    if (converted.subtotal !== undefined) converted.subtotal = exchangeService.convertAmount(converted.subtotal, rateInfo.rate);
    if (converted.total !== undefined && !hasPrice) converted.total = exchangeService.convertAmount(converted.total, rateInfo.rate);
    if (converted.grandTotal !== undefined) converted.grandTotal = exchangeService.convertAmount(converted.grandTotal, rateInfo.rate);
    if (converted.amount !== undefined && !hasPrice) converted.amount = exchangeService.convertAmount(converted.amount, rateInfo.rate);
    if (converted.discountAmount !== undefined) converted.discountAmount = exchangeService.convertAmount(converted.discountAmount, rateInfo.rate);
    if (converted.shippingCost !== undefined) converted.shippingCost = exchangeService.convertAmount(converted.shippingCost, rateInfo.rate);
    if (converted.taxAmount !== undefined) converted.taxAmount = exchangeService.convertAmount(converted.taxAmount, rateInfo.rate);

    // Add currency metadata
    if (Object.keys(converted).length > 0 && hasPrice) {
      converted.currencyCode = rateInfo.currencyCode;
      converted.currencySymbol = rateInfo.symbol;
    }

    return converted;
  }

  // Primitive values - return as-is
  return data;
}

/**
 * Middleware to convert response data based on currency preferences
 * Uses req.currencyInfo set by resolveCurrency middleware
 */
const convertResponse = async (req, res, next) => {
  // Skip conversion if no currency info (shouldn't happen if resolveCurrency ran)
  if (!req.currencyInfo) {
    return next();
  }

  // Skip if USD - USD is the base currency, never convert it
  // This prevents issues with incorrect USD exchange rates in database
  if (req.currencyInfo.currency === 'USD') {
    return next();
  }

  // Intercept res.json to convert data before sending
  const originalJson = res.json.bind(res);

  res.json = async function(data) {
    try {
      console.log('🔸 [ResponseConversion] Starting conversion with currencyInfo:', req.currencyInfo);
      
      // Resolve exchange rate
      const rateInfo = await exchangeService.resolveRate({
        currency: req.currencyInfo.currency,
        country: req.currencyInfo.country,
        exchangeRateId: req.currencyInfo.exchangeRateId
      });

      console.log('🔸 [ResponseConversion] Resolved rate:', rateInfo);

      // Convert data recursively
      const convertedData = convertDataRecursively(data, rateInfo);

      console.log('✅ [ResponseConversion] Conversion complete');

      // Send converted response
      return originalJson(convertedData);
    } catch (error) {
      console.error('❌ [ResponseConversion] Error:', error);
      // On error, send original data
      return originalJson(data);
    }
  };

  next();
};

module.exports = { convertResponse };
