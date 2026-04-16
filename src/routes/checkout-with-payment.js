const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const mongoose = require('mongoose');
const Schema = require('../models/schema');
const { generateOrderId, generateSubOrderId } = require('../utils/idGenerator');
const { v4: uuidv4 } = require('uuid');
const { calculateCartSummary } = require('../utils/cartHelper');
const FlatDiscount = mongoose.models.flatDiscountModel || mongoose.model('flatDiscountModel', new mongoose.Schema(Schema.flatdiscount), 'flatdiscounts');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Models
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const Product = mongoose.models.productModel || mongoose.model('productModel', new mongoose.Schema(Schema.product), 'products');

// Compute cart summary (same logic as cart.js) - returns { subtotal, total, totalItems }
// Redundant computeCartSummary removed. Using unified src/utils/cartHelper.js instead.

// Map common Stripe card error codes to friendly messages
function mapStripeCardError(err) {
  const code = err.code || '';
  switch (code) {
    case 'incorrect_number': return 'The card number is incorrect.';
    case 'invalid_number': return 'The card number is not a valid credit card number.';
    case 'invalid_expiry_month': return 'The card expiration month is invalid.';
    case 'invalid_expiry_year': return 'The card expiration year is invalid.';
    case 'invalid_cvc': return 'The card CVC is invalid.';
    case 'incorrect_cvc': return 'The card CVC is incorrect.';
    case 'expired_card': return 'The card has expired.';
    case 'card_declined': return 'The card was declined.';
    case 'processing_error': return 'An error occurred while processing the card.';
    default: return err.message || 'Payment failed';
  }
}

// Helper to normalize images
function normalizeImages(imgs) {
  if (!imgs) return [];
  if (Array.isArray(imgs)) {
    return imgs.filter(i => typeof i === 'string' && (i.startsWith('http') || i.startsWith('/')));
  }
  if (typeof imgs === 'object') {
    const out = [];
    Object.values(imgs).forEach(v => {
      if (Array.isArray(v)) v.forEach(u => { if (typeof u === 'string') out.push(u); });
      else if (typeof v === 'string') out.push(v);
    });
    return out.filter(i => typeof i === 'string' && (i.startsWith('http') || i.startsWith('/')));
  }
  if (typeof imgs === 'string') return [imgs];
  return [];
}

// POST /api/cart/checkout-with-payment
// Accepts either a Stripe token (tok_...) or raw card details (test use only)
router.post('/', async (req, res) => {
  try {
    const { sessionId, userId, cardNumber, expiryMonth, expiryYear, cvv, cardholderName, token, currency = 'usd' } = req.body;

    if (!sessionId && !userId) {
      return res.status(400).json({ success: false, error: 'sessionId or userId is required' });
    }

    // Find cart
    const cart = await Cart.findOne({ sessionId, userId, isCheckedOut: false });
    if (!cart) return res.status(404).json({ success: false, error: 'Cart not found or already checked out' });

    const summary = await calculateCartSummary(cart);
    if (!summary.totalItems || summary.totalItems <= 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    const amountInCents = Math.round(Number(summary.total) * 100);
    if (amountInCents <= 0) return res.status(400).json({ success: false, error: 'Invalid order amount' });

    // Determine source: token passed explicitly, or cardNumber provided as tok_... or raw digits
    let sourceToken = token || null;
    if (!sourceToken && typeof cardNumber === 'string' && cardNumber.startsWith('tok_')) {
      sourceToken = cardNumber;
    }

    // If no token, and raw card details provided, create a token (test mode only)
    if (!sourceToken) {
      if (!cardNumber || !expiryMonth || !expiryYear || !cvv) {
        return res.status(400).json({ success: false, error: 'Card details are required when token is not provided' });
      }

      // Basic validation: numeric checks
      const numDigits = (cardNumber || '').replace(/\s+/g, '');
      if (!/^[0-9]{12,19}$/.test(numDigits)) {
        return res.status(400).json({ success: false, error: 'Invalid card number format' });
      }
      if (!/^[0-9]{1,2}$/.test(String(expiryMonth)) || !/^[0-9]{2,4}$/.test(String(expiryYear))) {
        return res.status(400).json({ success: false, error: 'Invalid expiry date' });
      }
      if (!/^[0-9]{3,4}$/.test(String(cvv))) {
        return res.status(400).json({ success: false, error: 'Invalid CVV' });
      }

      // Expiry check
      const expMonth = parseInt(expiryMonth, 10);
      const expYear = parseInt(expiryYear, 10);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
        return res.status(400).json({ success: false, error: 'Card has expired' });
      }

      // Create token via Stripe (server-side). This will accept Stripe test card numbers like 4242424242424242
      try {
        const tokenObj = await stripe.tokens.create({
          card: {
            number: numDigits,
            exp_month: expMonth,
            exp_year: expYear,
            cvc: String(cvv),
            name: cardholderName || undefined
          }
        });
        sourceToken = tokenObj.id;
      } catch (err) {
        // Map Stripe token errors
        const msg = mapStripeCardError(err);
        return res.status(402).json({ success: false, error: msg });
      }
    }

    // Create charge (Charges API) for simplicity in test flows
    let charge;
    try {
      charge = await stripe.charges.create({
        amount: amountInCents,
        currency,
        source: sourceToken,
        description: `Charge for cart ${cart._id}`,
        metadata: { cartId: cart._id.toString(), sessionId: cart.sessionId || '', userId: cart.userId ? cart.userId.toString() : '' }
      });
    } catch (err) {
      const msg = mapStripeCardError(err);
      return res.status(402).json({ success: false, error: msg, raw: err.message });
    }

    if (!charge || charge.status !== 'succeeded') {
      return res.status(402).json({ success: false, error: 'Charge failed', charge });
    }

    // Build sub-orders
    const orderSubOrders = [];
    let maxDeliveryDays = 5;
    
    console.log('\n[CHECKOUT DEBUG] Cart items:', cart.items.length);
    
    for (const item of cart.items) {
      console.log('\n[CHECKOUT] Processing item:', item.productId);
      console.log('  item.priceAtTime:', item.priceAtTime);
      console.log('  item.diamondDetails:', item.diamondDetails ? Object.keys(item.diamondDetails) : 'UNDEFINED');
      
      const prod = await Jewelry.findById(item.productId).lean() || await Product.findById(item.productId).lean();
      console.log('  prod found:', !!prod);
      if (prod) {
        console.log('  prod.price:', prod.price);
        console.log('  prod.name/title:', prod.title || prod.name);
      }
      
      // Fully dynamic: uses whatever value is in the database for this product
      const productDeliveryDays = prod?.estimatedDeliveryDays || 5;
      if (productDeliveryDays > maxDeliveryDays) maxDeliveryDays = productDeliveryDays;
      
      let category = prod?.category;
      try {
        if (typeof category === 'string' && category.trim().startsWith('{')) {
          const parsed = JSON.parse(category);
          category = parsed.value || category;
        }
      } catch (e) { }

      const productDetails = prod ? {
        title: prod.title || prod.name,
        name: prod.name,
        description: prod.description,
        images: normalizeImages(prod.images || prod.imageUrl),
        imageUrl: (prod.images && prod.images[0]) || prod.imageUrl || null,
        price: prod.price || item.priceAtTime || 0,
        cadCode: prod.cadCode,
        category: category,
        material: prod.material,
        metalType: prod.metalType || prod.metal || '-',
        slug: prod.slug || null,
        // Diamond/Stone Details - Merge custom diamond from cart with product fallback
        diamondDetails: {
          // First use custom diamond from cart (has stock_id, custom prices)
          ...(item.diamondDetails || {}),
          // Then fallback to product details if not in custom diamond
          shape: item.diamondDetails?.shape || prod.shape || item.selectedVariant?.shape || '-',
          diamondType: item.diamondDetails?.diamondType || prod.diamondType || item.selectedVariant?.diamondType || '-',
          cut: item.diamondDetails?.cut || prod.cut || item.selectedVariant?.cut || '-',
          clarity: item.diamondDetails?.clarity || item.diamondDetails?.clar || prod.clarity || item.selectedVariant?.clarity || '-',
          caratSize: item.diamondDetails?.caratSize || item.diamondDetails?.carats || prod.caratSize || item.selectedVariant?.caratSize || item.selectedVariant?.carat || '-',
          color: item.diamondDetails?.color || item.diamondDetails?.col || prod.color || item.selectedVariant?.color || '-',
          // Price from custom diamond takes precedence (markup_price for customer-facing price)
          priceWithMargin: item.diamondDetails?.markup_price || item.diamondDetails?.priceWithMargin || item.selectedVariant?.priceWithMargin || prod.price || '-',
          // Stock ID is critical for custom diamonds
          stock_id: item.diamondDetails?.stock_id || undefined
        },
        // Additional Details
        ringSize: item.selectedVariant?.ringSize || item.selectedVariant?.size || '-',
        estimatedDeliveryDays: productDeliveryDays,
        packaging: item.packaging || null,  // Store packaging ObjectId reference
        packagingType: prod.packagingType || '-'
      } : {
        // CRITICAL FIX: When prod not found (e.g., jewelry deleted), 
        // ensure we preserve pricing data from cartitem + diamondDetails from custom diamond
        ...(item.productDetails || {}),
        // Override with cart values if they exist
        price: item.priceAtTime || (item.productDetails?.price) || 0,
        // Merge diamondDetails from cart item (has custom prices & stock_id)
        diamondDetails: {
          ...(item.productDetails?.diamondDetails || {}),
          ...(item.diamondDetails || {})
        }
      };
      
      const priceAtTime = item.priceAtTime || productDetails.price || 0;
      const imageUrl = productDetails.imageUrl || null;
      
      console.log('  Final priceAtTime:', priceAtTime);
      console.log('  Final diamondDetails keys:', productDetails.diamondDetails ? Object.keys(productDetails.diamondDetails) : 'UNDEFINED');
      if (!prod) {
        console.log('  ⚠️ JEWELRY NOT FOUND - using fallback:');
        console.log('    item.priceAtTime:', item.priceAtTime);
        console.log('    item.productDetails exists:', !!item.productDetails);
        console.log('    item.diamondDetails exists:', !!item.diamondDetails);
      }
      
      orderSubOrders.push({
        subOrderId: generateSubOrderId(),
        productId: item.productId,
        quantity: item.quantity || 1,
        type: prod?.type || 'Premade',
        priceAtTime,
        imageUrl,
        productDetails,
        engravingDetails: item.engravingOptions ? {
          hasEngraving: true,
          engravingText: item.engravingOptions.engravingText,
          font: item.engravingOptions.font
        } : { hasEngraving: false },
        status: 'Pending',
        progress: {}
      });
    }
    const expectedDeliveryDate = new Date(Date.now() + maxDeliveryDays * 24 * 60 * 60 * 1000);

    // Create Order from cart
    const newOrder = new Order({
      orderId: generateOrderId(),
      customer: cart.userId || null,
      subOrders: orderSubOrders,
      subtotal: summary.subtotal,
      discount: summary.totalDiscount,
      total: summary.total,
      expectedDeliveryDate,
      estimatedDeliveryDays: maxDeliveryDays,
      paymentStatus: 'paid',
      paymentDetails: {
        paymentMethod: 'card',
        amountPaid: summary.total,
        currency,
        stripeChargeId: charge.id,
        cardChecksum: typeof cardNumber === 'string' && cardNumber.startsWith('tok_') ? cardNumber : undefined
      },
      status: 'Confirmed',
      createdOn: new Date()
    });



    await newOrder.save();

    // Mark cart checked out
    cart.isCheckedOut = true;
    cart.updatedOn = new Date();
    await cart.save();

    return res.json({ success: true, orderId: newOrder.orderId, chargeId: charge.id, amount: summary.total });
  } catch (error) {
    console.error('checkout-with-payment error', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
