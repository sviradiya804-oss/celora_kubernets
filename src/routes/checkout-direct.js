const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const mongoose = require('mongoose');
const Schema = require('../models/schema');
const { v4: uuidv4, v1: uuidv1 } = require('uuid');
const { calculateCartSummary, calculateProductPrice } = require('../utils/cartHelper');
const { generateOrderId, generateSubOrderId } = require('../utils/idGenerator');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Success URL for frontend redirect after payment
const PAYMENT_SUCCESS_URL = process.env.PAYMENT_SUCCESS_URL || 'https://celorajewelry.com/payment-success/thankyou';
const PAYMENT_CANCEL_URL = process.env.PAYMENT_CANCEL_URL || 'https://celorajewelry.com/payment-cancel';

// Models
const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const Coupon = mongoose.models.couponModel || mongoose.model('couponModel', new mongoose.Schema(Schema.coupon), 'coupons');
const FlatDiscount = mongoose.models.flatDiscountModel || mongoose.model('flatDiscountModel', new mongoose.Schema(Schema.flatdiscount), 'flatdiscounts');
const MetalPrice = mongoose.models.MetalPrice || mongoose.model('MetalPrice', new mongoose.Schema(Schema.metalPrice), 'metalprices');

// User model
let User;
try {
  User = mongoose.model('userModel');
} catch (error) {
  try {
    const userSchema = require('../models/User');
    User = mongoose.model('userModel', userSchema, 'users');
  } catch (importError) {
    const basicUserSchema = new mongoose.Schema({
      name: String,
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      stripeCustomerId: String,
      _id: mongoose.Schema.Types.ObjectId
    });
    User = mongoose.model('userModel', basicUserSchema, 'users');
  }
}

// Helper: compute amount (in cents) from order document
function computeOrderAmountInCents(order) {
  if (!order) return 0;
  // Prefer order.total if present, otherwise sum product totals
  const total = typeof order.total === 'number' && order.total > 0
    ? order.total
    : (order.subOrders || []).reduce((sum, s) => {
      const price = s.priceAtTime || (s.productDetails && s.productDetails.price) || 0;
      const qty = s.quantity || 1;
      return sum + (price * qty);
    }, 0);
  return Math.round(Number(total) * 100);
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

// Helper: compute cart total with discounts (centralized logic)
// wrapper for compatibility with rest of file
async function computeCartTotal(cart) {
  const summary = await calculateCartSummary(cart);
  return {
    ...summary,
    itemsWithPrices: summary.itemsWithDetails
  };
}

// Helper: Resolve metaldetail ID to actual metal details
async function resolveMetalDetail(metalIdOrObject) {
  if (!metalIdOrObject) return null;
  
  // If already an object with name, return it
  if (typeof metalIdOrObject === 'object' && metalIdOrObject.name) {
    return {
      id: metalIdOrObject._id || metalIdOrObject.id,
      name: metalIdOrObject.name,
      type: metalIdOrObject.MetalType || metalIdOrObject.type,
      original: metalIdOrObject
    };
  }
  
  // If it's an ID string/ObjectId, fetch from DB
  if (typeof metalIdOrObject === 'string' || mongoose.Types.ObjectId.isValid(metalIdOrObject)) {
    try {
      const metalDoc = await MetalPrice.findById(metalIdOrObject).lean();
      if (metalDoc) {
        return {
          id: metalDoc._id,
          name: metalDoc.MetalName || metalDoc.name,
          type: metalDoc.MetalType || metalDoc.type,
          original: metalDoc
        };
      }
    } catch (e) {
      console.warn('Failed to fetch metal details:', e.message);
    }
  }
  
  return null;
}

// ============================================================
// EXISTING ENDPOINTS
// ============================================================

// Create PaymentIntent from existing order and return client_secret
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { orderId, currency = 'usd' } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const order = await Order.findOne({ orderId }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const amount = computeOrderAmountInCents(order);
    if (amount <= 0) return res.status(400).json({ error: 'Order amount invalid' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method_types: ['card'],
      metadata: { orderId }
    });

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (err) {
    console.error('create-payment-intent error', err);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Process payment server-side using a PaymentMethod id (recommended) or token
// This endpoint DOES NOT accept raw card numbers. The frontend must send a Stripe payment method id (from Elements) or a token.
router.post('/process-payment', async (req, res) => {
  try {
    const { orderId, paymentMethodId, paymentMethodType = 'card', billingDetails } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    if (!paymentMethodId) return res.status(400).json({ error: 'paymentMethodId is required' });

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const amount = computeOrderAmountInCents(order);
    if (amount <= 0) return res.status(400).json({ error: 'Order amount invalid' });

    // Create and confirm PaymentIntent server-side using paymentMethodId
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: order.currency || 'usd',
      payment_method: paymentMethodId,
      confirm: true,
      off_session: false,
      metadata: { orderId }
    });

    // Handle statuses
    if (paymentIntent.status === 'succeeded') {
      // Update order payment status and details
      order.paymentStatus = 'paid';
      order.status = 'Confirmed';
      order.paymentDetails = {
        paymentMethod: paymentMethodType,
        amountPaid: amount / 100,
        currency: paymentIntent.currency,
        createdOn: new Date(),
        stripePaymentIntentId: paymentIntent.id
      };
      await order.save();

      return res.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        redirectUrl: PAYMENT_SUCCESS_URL
      });
    }

    // If additional action required (3DS), return the client_secret and status for frontend to handle
    if (paymentIntent.status === 'requires_action' || paymentIntent.status === 'requires_payment_method') {
      return res.json({
        success: false,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status
      });
    }

    // Other statuses
    res.json({ success: false, status: paymentIntent.status, paymentIntent });
  } catch (err) {
    console.error('process-payment error', err);
    // Try to surface Stripe errors
    return res.status(500).json({ error: err.raw?.message || err.message || 'Payment processing failed' });
  }
});

// ============================================================
// NEW ENDPOINTS FOR CART-BASED PAYMENT INTENT FLOW
// ============================================================

/**
 * Create PaymentIntent from cart contents
 * POST /api/checkout-direct/create-payment-intent-from-cart
 * 
 * Request body:
 * - sessionId: Cart session ID (for guest users)
 * - userId: User ID (for authenticated users)
 * - currency: Optional, defaults to 'usd'
 * - shippingDetails: Optional shipping information
 * 
 * Response:
 * - clientSecret: Stripe client secret for frontend confirmation
 * - paymentIntentId: Payment Intent ID
 * - orderId: Created order ID
 * - orderSummary: Order totals breakdown
 */
router.post('/create-payment-intent-from-cart', async (req, res) => {
  try {
    const { sessionId, userId, currency = 'usd', shippingDetails, billingAddress, shippingAddress } = req.body;

    if (!sessionId && !userId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId or userId is required'
      });
    }

    // Find cart
    const cartQuery = userId
      ? { userId: new mongoose.Types.ObjectId(userId), isCheckedOut: { $ne: true } }
      : { sessionId, isCheckedOut: { $ne: true } };

    const cart = await Cart.findOne(cartQuery);

    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    // Get customer info if userId provided
    let customer = null;
    if (userId) {
      customer = await User.findById(userId);
    }

    // Compute cart totals (now includes auto flat discounts and coupons)
    const cartAnalysis = await computeCartTotal(cart);
    const { subtotal, flatDiscountAmount, couponDiscountAmount, total: finalAmountUSD, itemsWithPrices } = cartAnalysis;

    const models = require('../models');
    const Exchangerate = models.Exchangerate;

    // Apply currency conversion to the FINAL amount calculated by computeCartTotal
    let finalTotal = finalAmountUSD;
    let discountAmount = flatDiscountAmount + couponDiscountAmount;

    // --- Currency Conversion Logic ---
    let convertedTotal = finalTotal;
    let appliedRate = 1;
    let targetCurrency = currency.toUpperCase();

    if (targetCurrency !== 'USD') {
      const exchangeRateDoc = await Exchangerate.findOne({
        currencyCode: targetCurrency,
        isActive: true
      }).lean();

      if (exchangeRateDoc) {
        appliedRate = exchangeRateDoc.rate;
        convertedTotal = finalTotal * appliedRate;
        console.log(`💱 Converting payment: ${finalTotal} USD * ${appliedRate} = ${convertedTotal} ${targetCurrency}`);
      } else {
        console.warn(`⚠️ No exchange rate found for ${targetCurrency}. Using USD value as nominal (May be incorrect if intentional).`);
      }
    }

    const amountInCents = Math.round(convertedTotal * 100);

    if (amountInCents <= 0) {
      return res.status(400).json({ success: false, error: 'Order amount invalid' });
    }

    // ============================================================
    // CHECK FOR EXISTING VALID PAYMENT INTENT (RESUME LOGIC)
    // ============================================================
    if (cart.pendingCheckoutSessionId) {
      try {
        const existingPI = await stripe.paymentIntents.retrieve(cart.pendingCheckoutSessionId);
        const lastUpdated = cart.updatedOn || new Date();
        const diffMinutes = (Date.now() - lastUpdated.getTime()) / (1000 * 60);

        // Check if intent is still valid (not cancelled/succeeded) and within the 10-min window
        // Also check if the amount matches; if not, we'll try to update it
        if (['requires_payment_method', 'requires_action', 'requires_confirmation'].includes(existingPI.status) && diffMinutes < 10) {

          let updatedPI = existingPI;
          // If amount or currency changed, update the payment intent
          const stripeCurrency = currency.toLowerCase();

          // Determine valid payment methods based on currency
          let validPaymentMethods = ['card'];
          if (stripeCurrency === 'usd') {
            validPaymentMethods = ['card', 'affirm', 'cashapp', 'amazon_pay'];
          }

          if (existingPI.amount !== amountInCents || existingPI.currency !== stripeCurrency) {
            updatedPI = await stripe.paymentIntents.update(existingPI.id, {
              amount: amountInCents,
              currency: stripeCurrency,
              payment_method_types: validPaymentMethods
            });
            console.log(`🔄 Updated existing Payment Intent ${updatedPI.id} with new amount: ${amountInCents} and currency: ${stripeCurrency}`);
          }

          console.log(`♻️ Reusing existing Payment Intent ${updatedPI.id} for Order ${updatedPI.metadata.orderId}`);

          const resumeUrl = `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/checkout?orderId=${updatedPI.metadata.orderId}&resume=true`;

          return res.json({
            success: true,
            isResume: true,
            clientSecret: updatedPI.client_secret,
            paymentIntentId: updatedPI.id,
            orderId: updatedPI.metadata.orderId,
            resumeUrl: resumeUrl,
            orderSummary: {
              subtotal,
              flatDiscountAmount,
              couponDiscountAmount,
              discount: discountAmount,
              total: finalTotal,
              itemCount: cart.items.length,
              couponApplied: cart.coupon?.code || null
            },
            successUrl: PAYMENT_SUCCESS_URL
          });
        }
      } catch (e) {
        console.log("Could not retrieve or update existing PI, will create new one:", e.message);
      }
    }

    // Create order first
    const orderSubOrders = [];
    let maxDeliveryDays = 5; // accumulate max across all products
    for (const itemData of itemsWithPrices) {
      const { product, quantity, selectedVariant, productId } = itemData;
      if (product && product.estimatedDeliveryDays && product.estimatedDeliveryDays > maxDeliveryDays) {
        maxDeliveryDays = product.estimatedDeliveryDays;
      }
      const calculatedPrice = itemData.unitPrice || itemData.priceAtTime || 0;
      if (product) {
        // Extract Details
        const variant = selectedVariant || {};
        const options = variant.selectedOptions || {};
        const customs = variant.customizations || {};

        // Ring Size
        const ringSize = options.ringsize || customs.ringSize || null;

        // Metal Type - Resolve metaldetail to get actual metal name
        let metalType = customs.metalType || options.metalType;
        let resolvedMetal = null;
        
        if (!metalType && options.metaldetail) {
          // Try to resolve the metaldetail ID to get actual metal details
          resolvedMetal = await resolveMetalDetail(options.metaldetail);
          if (resolvedMetal) {
            metalType = resolvedMetal.name || resolvedMetal.type;
          } else {
            // Fallback: if it's an object, use the name property
            metalType = typeof options.metaldetail === 'object' ? options.metaldetail.name : options.metaldetail;
          }
        }

        // Diamond Type logic (DR/LC)
        // Check customizations or product attributes
        let diamondType = product.diamondType;
        if (customs.diamondType) diamondType = customs.diamondType;

        // Try to infer from centerStone if available
        if (options.centerStone) {
          if (options.centerStone.type) diamondType = options.centerStone.type;
          else if (options.centerStone.name && options.centerStone.name.includes('Lab')) diamondType = 'Lab';
          else if (options.centerStone.name && options.centerStone.name.includes('Natural')) diamondType = 'Natural';
        }

        // Determine DR/LC code if needed
        const diamondCode = (diamondType === 'Lab' || diamondType === 'Lab Grown' || diamondType === 'LC') ? 'LC' : 'DR';

        // Engraving Mapping
        const engravingData = itemData.engravingOptions || (options.engraving ? {
          engravingText: options.engraving.text,
          font: options.engraving.font
        } : null);

        let engravingDetails = { hasEngraving: false };
        if (engravingData && engravingData.engravingText) {
          engravingDetails = {
            hasEngraving: true,
            engravingText: engravingData.engravingText,
            font: engravingData.font,
            engravingType: 'Text', // Default to Text since we only have text/font
            engravingCost: 0,
            engravingStatus: 'Pending'
          };
        }

        orderSubOrders.push({
          subOrderId: generateSubOrderId(),
          productId: productId,
          quantity: quantity,
          type: product.type || 'Premade',
          priceAtTime: calculatedPrice,
          imageUrl: product.images?.[0] || null,
          productDetails: {
            title: product.title || product.name,
            name: product.name || product.title,
            description: product.description,
            images: normalizeImages(product.images || product.imageUrl),
            category: (typeof product.category === 'string' && product.category.startsWith('{'))
              ? (JSON.parse(product.category).value || product.category)
              : product.category,
            material: product.material,
            price: calculatedPrice,
            cadCode: product.cadCode,
            slug: product.slug || null,
            selectedVariant: selectedVariant,
            ringSize: ringSize,
            metalType: metalType,
            metalDetail: resolvedMetal ? {
              id: resolvedMetal.id,
              name: resolvedMetal.name,
              type: resolvedMetal.type
            } : null,
            diamondType: diamondType,
            packaging: itemData.packaging || null,
            packagingType: product.packagingType || '-',
            estimatedDeliveryDays: product.estimatedDeliveryDays || 5,
            // Diamond details from cart item (custom diamond stock_id, prices, specs)
            diamondDetails: {
              ...(itemData.diamondDetails || {}),
              shape: itemData.diamondDetails?.shape || product.shape || '-',
              diamondType: itemData.diamondDetails?.diamondType || product.diamondType || diamondType || '-',
              cut: itemData.diamondDetails?.cut || product.cut || '-',
              clarity: itemData.diamondDetails?.clarity || itemData.diamondDetails?.clar || product.clarity || '-',
              caratSize: itemData.diamondDetails?.caratSize || itemData.diamondDetails?.carats || product.caratSize || '-',
              color: itemData.diamondDetails?.color || itemData.diamondDetails?.col || product.color || '-',
              stock_id: itemData.diamondDetails?.stock_id || undefined,
              price: itemData.diamondDetails?.price || undefined,
              markup_price: itemData.diamondDetails?.markup_price || undefined,
              lab: itemData.diamondDetails?.lab || undefined
            }
          },
          engravingDetails: engravingDetails,
          status: 'Pending',
          progress: {}
        });
      }
    }

    const expectedDeliveryDate = new Date(Date.now() + maxDeliveryDays * 24 * 60 * 60 * 1000);

    const order = new Order({
      orderId: generateOrderId(),
      customer: userId || cart.userId || null,
      subOrders: orderSubOrders,
      total: finalTotal,
      subtotal: subtotal,
      discount: discountAmount,
      coupon: cart.coupon || null,
      expectedDeliveryDate,
      estimatedDeliveryDays: maxDeliveryDays,
      shippingDetails: shippingDetails || {
        estimatedDeliveryDays: maxDeliveryDays,
        shippingMethod: 'Standard',
        shippingCost: 0
      },
      paymetmethod: 'stripe',
      status: 'Pending',
      paymentStatus: 'pending',
      customerData: {
        email: customer?.email,
        name: customer?.name || customer?.firstName,
        phone: customer?.phone
      },
      paymentDetails: {
        currency: currency.toLowerCase()
      },
      billingAddress: billingAddress || null,
      shippingAddress: shippingAddress || null,
      cartId: cart._id,
      createdBy: userId || null,
      updatedBy: userId || null,
      referenceId: uuidv1()
    });

    await order.save();

    // Determine valid payment methods based on currency
    const stripeCurrency = currency.toLowerCase();
    let validPaymentMethods = ['card'];
    if (stripeCurrency === 'usd') {
      validPaymentMethods = ['card', 'affirm', 'cashapp', 'amazon_pay'];
    }

    // Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: stripeCurrency,
      payment_method_types: validPaymentMethods,
      metadata: {
        orderId: order.orderId,
        cartId: cart._id.toString(),
        userId: userId?.toString() || 'guest',
        sessionId: sessionId || ''
      },
      receipt_email: customer?.email || null,
      description: `Celora Jewelry - Order ${order.orderId}`
    });

    // Store payment intent ID on order
    order.stripePaymentIntentId = paymentIntent.id;
    await order.save();

    // Mark cart with pending checkout
    cart.pendingCheckoutSessionId = paymentIntent.id;
    cart.updatedOn = new Date();
    await cart.save();

    console.log(`✅ Created Payment Intent ${paymentIntent.id} for Order ${order.orderId}`);

    const resumeUrl = `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/checkout?orderId=${order.orderId}&resume=true`;

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId: order.orderId,
      resumeUrl: resumeUrl,
      orderSummary: {
        subtotal,
        flatDiscountAmount,
        couponDiscountAmount,
        discount: discountAmount,
        total: finalTotal,
        itemCount: cart.items.length,
        couponApplied: cart.coupon?.code || null
      },
      successUrl: PAYMENT_SUCCESS_URL
    });

  } catch (err) {
    console.error('create-payment-intent-from-cart error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent',
      details: err.message
    });
  }
});

/**
 * Confirm payment after frontend Stripe confirmation
 * POST /api/checkout-direct/confirm-payment
 * 
 * This endpoint is called after the frontend successfully confirms the payment with Stripe.
 * It updates the order status and marks the cart as checked out.
 * 
 * Request body:
 * - paymentIntentId: Stripe Payment Intent ID
 * - orderId: Order ID (optional, will be looked up from payment intent metadata)
 * 
 * Response:
 * - success: boolean
 * - order: Order details
 * - redirectUrl: URL to redirect to after confirmation
 */
router.post('/confirm-payment', async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'paymentIntentId is required'
      });
    }

    // Retrieve payment intent from Stripe to verify status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: 'Payment not successful',
        status: paymentIntent.status
      });
    }

    // Find order by payment intent ID or orderId
    const orderQuery = orderId
      ? { orderId }
      : { stripePaymentIntentId: paymentIntentId };

    const order = await Order.findOne(orderQuery);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Update order status
    order.status = 'Confirmed';
    order.paymentStatus = 'paid';

    // Dynamically determine the payment method used (e.g., 'card', 'affirm', 'cashapp')
    const charge = paymentIntent.charges?.data?.[0];
    const actualPaymentMethod = charge?.payment_method_details?.type ||
      paymentIntent.payment_method_types?.[0] ||
      'card';

    order.paymentDetails = {
      paymentMethod: actualPaymentMethod,
      amountPaid: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      createdOn: new Date(),
      stripePaymentIntentId: paymentIntent.id,
      receiptUrl: charge?.receipt_url,

      // Detailed fields for a "proper" update
      chargeId: charge?.id,
      paymentIntentStatus: paymentIntent.status,
      paymentConfirmedAt: new Date(),

      // Card specific info (works for cards, ignores for BNPL like Affirm)
      cardLast4: charge?.payment_method_details?.card?.last4,
      cardBrand: charge?.payment_method_details?.card?.brand,

      // Risk & Transaction tracking
      riskLevel: charge?.outcome?.risk_level,
      riskScore: charge?.outcome?.risk_score,
      balanceTransaction: charge?.balance_transaction,
      receiptEmail: paymentIntent.receipt_email || order.customerData?.email,

      // Audit
      paymentSource: 'direct_confirmation'
    };

    // Safety check for progress object to avoid validation errors
    if (!order.progress) {
      order.progress = {};
    }

    order.progress.confirmed = {
      date: new Date(),
      status: `Payment confirmed via ${actualPaymentMethod}`
    };

    // Explicitly mark as modified since we changed a nested property
    order.markModified('progress');
    order.updatedOn = new Date();
    await order.save();

    // Mark cart as checked out
    // Mark cart as checked out and clear items
    if (order.cartId) {
      await Cart.updateOne(
        { _id: order.cartId },
        {
          isCheckedOut: true,
          items: [], // Clear items to match old flow behavior
          $unset: { pendingCheckoutSessionId: 1 },
          updatedOn: new Date()
        }
      );
    } else {
      // Try to find cart by pending checkout session ID
      await Cart.updateOne(
        { pendingCheckoutSessionId: paymentIntentId },
        {
          isCheckedOut: true,
          items: [], // Clear items to match old flow behavior
          $unset: { pendingCheckoutSessionId: 1 },
          updatedOn: new Date()
        }
      );
    }

    console.log(`✅ Payment confirmed for Order ${order.orderId}`);

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      order: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        customerData: order.customerData
      },
      redirectUrl: PAYMENT_SUCCESS_URL
    });

  } catch (err) {
    console.error('confirm-payment error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm payment',
      details: err.message
    });
  }
});

/**
 * Get payment intent status
 * GET /api/checkout-direct/payment-status/:paymentIntentId
 */
router.get('/payment-status/:paymentIntentId', async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const order = await Order.findOne({ stripePaymentIntentId: paymentIntentId });

    res.json({
      success: true,
      status: paymentIntent.status,
      order: order ? {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus
      } : null
    });
  } catch (err) {
    console.error('payment-status error:', err);
    res.status(500).json({ success: false, error: 'Failed to get payment status' });
  }
});

/**
 * Resume an existing checkout session
 * GET /api/checkout-direct/resume
 * 
 * Logic:
 * 1. Find cart for user/session
 * 2. Check for pendingCheckoutSessionId
 * 3. Retrieve PI and check status & time window
 */
router.get('/resume', async (req, res) => {
  try {
    const { sessionId, userId } = req.query;

    if (!sessionId && !userId) {
      return res.status(400).json({ success: false, error: 'sessionId or userId is required' });
    }

    const cartQuery = userId
      ? { userId: new mongoose.Types.ObjectId(userId), isCheckedOut: { $ne: true } }
      : { sessionId, isCheckedOut: { $ne: true } };

    const cart = await Cart.findOne(cartQuery);

    if (!cart || !cart.pendingCheckoutSessionId) {
      return res.json({ success: false, error: 'No pending checkout session found', canResume: false });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(cart.pendingCheckoutSessionId);

    // Check timing
    const lastUpdated = cart.updatedOn || new Date();
    const diffMinutes = (Date.now() - lastUpdated.getTime()) / (1000 * 60);

    const isPayable = ['requires_payment_method', 'requires_action', 'requires_confirmation'].includes(paymentIntent.status);
    const inWindow = diffMinutes < 10; // 10 minute window

    if (isPayable && inWindow) {
      const resumeUrl = `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/checkout?orderId=${paymentIntent.metadata.orderId}&resume=true`;

      return res.json({
        success: true,
        canResume: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId: paymentIntent.metadata.orderId,
        resumeUrl: resumeUrl,
        diffMinutes: Math.round(diffMinutes)
      });
    }

    res.json({
      success: false,
      canResume: false,
      reason: !inWindow ? 'Session window expired' : 'Payment intent status not resumable',
      status: paymentIntent.status
    });

  } catch (err) {
    console.error('resume-checkout error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/checkout-direct/pending-checkouts
 * 
 * Returns all carts with pending checkout sessions for admin monitoring.
 * Shows remaining time in the 10-minute window.
 */
router.get('/pending-checkouts', async (req, res) => {
  try {
    const pendingCarts = await Cart.find({
      pendingCheckoutSessionId: { $exists: true, $ne: null },
      isCheckedOut: { $ne: true }
    }).select('cartId sessionId userId pendingCheckoutSessionId updatedOn items').lean();

    let activeCount = 0;
    let expiredCount = 0;

    const carts = pendingCarts.map(cart => {
      const updatedOn = new Date(cart.updatedOn || Date.now());
      const diffMins = (Date.now() - updatedOn.getTime()) / 60000;
      const remainingMins = Math.max(0, 10 - diffMins);
      const isActive = remainingMins > 0;

      if (isActive) activeCount++;
      else expiredCount++;

      return {
        cartId: cart.cartId || cart._id.toString(),
        sessionId: cart.pendingCheckoutSessionId,
        items: cart.items?.length || 0,
        age: diffMins < 60 ? `${diffMins.toFixed(1)} mins` : `${(diffMins / 60).toFixed(1)} hrs`,
        remaining: isActive ? `${remainingMins.toFixed(1)} mins` : '0 mins',
        isActive,
        updatedOn: updatedOn.toISOString()
      };
    });

    res.json({
      success: true,
      stats: {
        total: pendingCarts.length,
        active: activeCount,
        expired: expiredCount
      },
      carts
    });
  } catch (err) {
    console.error('pending-checkouts error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch pending checkouts' });
  }
});

module.exports = router;

