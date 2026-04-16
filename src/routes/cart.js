// routes/cart.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Schema = require('../models/schema.js');
const Stripe = require("stripe");
const jwt = require('jsonwebtoken');
const { calculateCartSummary, calculateProductPrice } = require('../utils/cartHelper');
const { generateOrderId, generateSubOrderId } = require('../utils/idGenerator');
require("dotenv").config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Payment redirect URLs
const PAYMENT_SUCCESS_URL = process.env.PAYMENT_SUCCESS_URL || 'https://celorajewelry.com/payment-success/thankyou';
const PAYMENT_CANCEL_URL = process.env.PAYMENT_CANCEL_URL || 'https://celorajewelry.com/payment-cancel';

// Create schemas and models using your schema definitions
const cartSchema = new mongoose.Schema(Schema.cart);
const orderSchema = new mongoose.Schema(Schema.order);
const couponSchema = new mongoose.Schema(Schema.coupon);
const productSchema = new mongoose.Schema(Schema.product);

// Create models
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', cartSchema, 'carts');
const Order = mongoose.models.orderModel || mongoose.model('orderModel', orderSchema, 'orders');
const Coupon = mongoose.models.couponModel || mongoose.model('couponModel', couponSchema, 'coupons');
const Product = mongoose.models.productModel || mongoose.model('productModel', productSchema, 'products');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const FlatDiscount = mongoose.models.flatDiscountModel || mongoose.model('flatDiscountModel', new mongoose.Schema(Schema.flatdiscount), 'flatdiscounts');

// User model - check if it exists or create from User schema file
let User;
try {
  User = mongoose.model('userModel');
} catch (error) {
  // If model doesn't exist, try to import and create it
  try {
    const userSchema = require('../models/User');
    User = mongoose.model('userModel', userSchema, 'users');
  } catch (importError) {
    // If User schema file doesn't exist, create a basic schema
    const basicUserSchema = new mongoose.Schema({
      name: String,
      email: String,
      phone: String,
      _id: mongoose.Schema.Types.ObjectId
    });
    User = mongoose.model('userModel', basicUserSchema, 'users');
  }
}

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Extracts userId from the JWT Authorization header.
// Throws with .status = 401 on missing/invalid token.
function getUserIdFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    const err = new Error('Authorization token is required');
    err.status = 401;
    throw err;
  }
  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET); // throws on invalid
  return decoded.id;
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Pricing helper ───────────────────────────────────────────────────────────
// Two-rule pricing engine matching the live site logic:
//   Engagement rings  → pricing.metalPricing[n].finalPrice.{natural|lab}
//   All other jewelry → addedDiamonds.selectedDiamonds[n].metalPricing[n].priceNatural|priceLab
function getJewelryPrice(product, item) {
  const selectedMetalId = item.selectedVariant?.selectedOptions?.metaldetail;
  const diamondType = item.diamondDetails?.diamondType
    || item.selectedVariant?.selectedOptions?.diamondType
    || 'Natural';
  const isNatural = diamondType.toLowerCase() !== 'lab';
  const priceKey = isNatural ? 'natural' : 'lab';

  // Resolve category value (may be object like {value:'engagement-rings'} or plain string)
  const cat = product.category;
  const catValue = (cat && typeof cat === 'object' && cat.value) ? cat.value : (typeof cat === 'string' ? cat : '');
  const isEngagement = catValue.toLowerCase().includes('engagement');

  if (isEngagement && Array.isArray(product.pricing?.metalPricing) && product.pricing.metalPricing.length > 0) {
    // Engagement ring path
    if (selectedMetalId) {
      const entry = product.pricing.metalPricing.find(p => {
        const id = p.metal?.id || p.metal;
        return id && id.toString() === selectedMetalId.toString();
      });
      if (entry?.finalPrice?.[priceKey]) return entry.finalPrice[priceKey];
    }
    // Fallback: first metal entry
    const first = product.pricing.metalPricing[0];
    if (first?.finalPrice?.[priceKey]) return first.finalPrice[priceKey];
  }

  // Non-engagement: addedDiamonds path
  const diamonds = product.addedDiamonds?.selectedDiamonds;
  if (Array.isArray(diamonds) && diamonds.length > 0) {
    const diamond = diamonds[0];
    if (Array.isArray(diamond?.metalPricing) && diamond.metalPricing.length > 0) {
      if (selectedMetalId) {
        const metalEntry = diamond.metalPricing.find(m =>
          m.metal && m.metal.toString() === selectedMetalId.toString()
        );
        if (metalEntry) return isNatural ? metalEntry.priceNatural : metalEntry.priceLab;
      }
      const firstMetal = diamond.metalPricing[0];
      return isNatural ? firstMetal.priceNatural : firstMetal.priceLab;
    }
  }

  // Last resort: stored price or product base price
  return item.priceAtTime || product.price || null;
}
// ─────────────────────────────────────────────────────────────────────────────

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

// Helper function to auto-apply category coupons
async function autoApplyCategoryCoupons(cart, ProductModel) {
  try {
    // Get categories from cart items
    const cartCategories = new Set();
    for (let item of cart.items) {
      const product = await ProductModel.findById(item.productId);
      if (product && product.category) {
        cartCategories.add(product.category);
      }
    }

    if (cartCategories.size === 0) return;

    // Find active category-wide coupons
    const categoryCoupons = await Coupon.find({
      isActive: true,
      categoryWise: true,
      'selectedCategory.categoryName': { $in: Array.from(cartCategories) }
    }).sort({ discountValue: -1 }); // Apply highest discount first

    for (let coupon of categoryCoupons) {
      const isValid = await validateCouponForCart(coupon, cart, ProductModel);
      if (isValid.valid) {
        cart.coupon = {
          code: coupon.couponCode,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discountAmount: 0, // Will be calculated in checkout
          couponId: coupon._id
        };
        await cart.save(); // Save the cart with the applied coupon
        console.log(`Auto-applied category coupon: ${coupon.couponCode}`);
        break; // Apply only one coupon
      }
    }
  } catch (error) {
    console.error('Error auto-applying category coupons:', error);
  }
}

// Helper function to validate coupon for cart
async function validateCouponForCart(coupon, cart, ProductModel) {
  try {
    // Check if coupon is active
    if (!coupon.isActive) {
      return { valid: false, reason: 'Coupon is not active' };
    }

    // Check expiry date
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      return { valid: false, reason: 'Coupon has expired' };
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, reason: 'Coupon usage limit reached' };
    }

    // For category-wise coupons
    if (coupon.categoryWise && coupon.selectedCategory && coupon.selectedCategory.length > 0) {
      const cartCategories = new Set();
      for (let item of cart.items) {
        const product = await ProductModel.findById(item.productId);
        if (product && product.category) {
          cartCategories.add(product.category);
        }
      }

      const couponCategories = coupon.selectedCategory.map(cat => cat.categoryName);
      const hasMatchingCategory = couponCategories.some(cat => cartCategories.has(cat));

      if (!hasMatchingCategory) {
        return { valid: false, reason: 'No matching categories in cart' };
      }
    }

    // For product-wise coupons
    if (coupon.productWise && coupon.selectedProducts && coupon.selectedProducts.length > 0) {
      const cartProductIds = cart.items.map(item => item.productId.toString());
      const couponProductIds = coupon.selectedProducts.map(prod => prod.productObjectId.toString());

      const hasMatchingProduct = couponProductIds.some(prodId => cartProductIds.includes(prodId));

      if (!hasMatchingProduct) {
        return { valid: false, reason: 'No matching products in cart' };
      }
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating coupon:', error);
    return { valid: false, reason: 'Validation error' };
  }
}

// calculateProductPrice moved to src/utils/cartHelper.js

// Helper function to build detailed product description
function buildProductDescription(product, item) {
  let description = [];

  if (product.description) {
    description.push(product.description.substring(0, 100));
  }

  if (item.selectedVariant && item.selectedVariant !== 'Standard') {
    description.push(`Variant: ${item.selectedVariant}`);
  }

  if (product.category) {
    description.push(`Category: ${product.category}`);
  }

  if (product.material) {
    description.push(`Material: ${product.material}`);
  }

  return description.join(' | ');
}

// Add item to cart
router.post("/add", async (req, res) => {
  try {
    let { sessionId, userId, productId, _id, productType, quantity = 1, selectedOptions, customizations, price, engravingOptions, packagingId, packaging, diamondDetails, ringsize } = req.body;

    // Normalize packaging ID
    const selectedPackagingId = packagingId || packaging;

    // Accept both 'productId' and '_id' parameter names for flexibility
    productId = productId || _id;

    // ─── Transform diamondDetails to fix boolean casting issues ───────────────────
    // Frontend may send lab as empty string "", but schema expects boolean
    if (diamondDetails) {
      const diamondType = diamondDetails.diamondType || '';
      const isLabGrown = diamondType.toLowerCase().includes('lab');
      
      // Convert empty string to proper boolean
      if (diamondDetails.lab === '' || diamondDetails.lab === null || diamondDetails.lab === undefined) {
        diamondDetails.lab = isLabGrown;
      }
      
      // Ensure all numeric fields are proper numbers
      if (diamondDetails.carats !== undefined && diamondDetails.carats !== null) {
        diamondDetails.carats = Number(diamondDetails.carats) || 0;
      }
      if (diamondDetails.price !== undefined && diamondDetails.price !== null) {
        diamondDetails.price = Number(diamondDetails.price) || 0;
      }
      if (diamondDetails.markup_price !== undefined && diamondDetails.markup_price !== null) {
        diamondDetails.markup_price = Number(diamondDetails.markup_price) || 0;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    console.log("Received productId:", productId);

    if (!productId) {
      return res.status(400).json({ error: "Product ID (_id or productId) is required" });
    }

    // Always resolve userId from the JWT token (token is the single source of truth)
    try {
      userId = getUserIdFromToken(req);
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message || "Invalid or expired token" });
    }

    // Remember whether client provided a sessionId
    const clientProvidedSession = !!req.body.sessionId;

    // Generate sessionId if not provided
    if (!sessionId) {
      sessionId = require('uuid').v4();
    }

    // Determine the model to use based on productType
    const ProductModel = Jewelry;
    console.log("Finding product by id:", productId);

    // Find product using the Jewelry model (only jewelry products can be added to cart)
    const product = await ProductModel.findById(productId);
    console.log("Product result:", product ? product._id : null);

    if (!product) {
      return res.status(404).json({
        error: "Product not found in Jewelry collection",
        message: "The specified product ID does not exist in the Jewelry collection. Please provide a valid jewelry product _id."
      });
    }

    // Calculate the correct price based on selected variations
    // 1. Client-provided price (most specific)
    // 2. calculateProductPrice (uses metaldetail if present)
    // 3. getJewelryPrice (two-rule engine: engagement-ring path or addedDiamonds path)
    const draftItem = { selectedVariant: { selectedOptions, customizations }, diamondDetails };
    let calculatedPrice = price
      || calculateProductPrice(product, selectedOptions)
      || getJewelryPrice(product, draftItem)
      || 0;

    // For Custom-type jewelry (e.g. engagement rings with user-selected diamonds),
    // add the diamond's price (as shown on product page) to the setting price.
    // Premade jewelry already has the diamond baked into its price — don't double-count.
    if (product.type === 'Custom' && diamondDetails?.price > 0) {
      // If no explicit price was provided by the frontend, add diamond price to setting price
      // If frontend already sent a combined price, trust it (don't double-add)
      if (!price) {
        calculatedPrice += Number(diamondDetails.price);
      }
    }

    console.log("Product pricing info:", {
      productId: product._id,
      providedPrice: price,
      basePrice: product.price,
      selectedOptions,
      calculatedPrice
    });

    // Find an existing active cart. Prefer matching by sessionId when provided by client,
    // but fall back to matching by userId so repeated adds by the same user merge into the
    // same cart even if a sessionId wasn't provided or a new session was generated.
    let cart = null;

    if (clientProvidedSession) {
      // If client supplied a sessionId, prefer finding by that session only.
      // This prevents unintentionally adopting another existing cart tied to the same user.
      cart = await Cart.findOne({ isCheckedOut: false, sessionId });
      // If no cart exists for this session but there's an existing cart for the user, we may
      // optionally fallback to that user's cart. We'll only fallback if no session cart exists.
      if (!cart && userId) {
        cart = await Cart.findOne({ userId, isCheckedOut: false });
        if (cart && cart.sessionId) {
          // Adopt existing cart's session so the client is informed of it.
          sessionId = cart.sessionId;
        }
      }
    } else {
      // No sessionId from client: prefer an existing cart for this user
      cart = await Cart.findOne({ userId, isCheckedOut: false });
      if (cart) {
        // adopt the existing cart's sessionId so future calls include the same session
        sessionId = cart.sessionId;
      }
    }

    if (!cart) {
      cart = new Cart({
        sessionId,
        userId, // Explicitly set userId
        items: [],
        cartId: require('uuid').v1()
      });
    }

    // Check if cart has a pending checkout session
    if (cart.pendingCheckoutSessionId) {
      // Check if the session is still within the 10-minute window
      const lastUpdated = cart.updatedOn || new Date();
      const diffMinutes = (Date.now() - lastUpdated.getTime()) / (1000 * 60);

      if (diffMinutes < 10) {
        // Session is still active, block modifications
        return res.status(400).json({
          error: "Cart is currently in checkout. Please complete or cancel your current checkout before making changes.",
          pendingCheckout: true,
          checkoutSessionId: cart.pendingCheckoutSessionId,
          remainingMinutes: Math.ceil(10 - diffMinutes)
        });
      } else {
        // Session expired, clear it and allow modifications
        console.log(`Clearing expired checkout session ${cart.pendingCheckoutSessionId} (${diffMinutes.toFixed(1)} mins old)`);
        cart.pendingCheckoutSessionId = undefined;
      }
    }


    // Check if item already exists in cart - merge duplicate items
    const existingItem = cart.items.find(item => item.productId.toString() === productId);

    if (existingItem) {
      // If item already exists, increase quantity instead of adding new item
      existingItem.quantity += quantity;
      if (engravingOptions) {
        existingItem.engravingOptions = engravingOptions; // Update engraving options if provided
      }
      // Update price with calculated price
      existingItem.priceAtTime = calculatedPrice;

      console.log(`Updated existing cart item: quantity=${existingItem.quantity}, price=${calculatedPrice}`);
    } else {
      // Add new item to cart with calculated price
      cart.items.push({
        itemId: require('uuid').v4(),
        productId,
        quantity,
        selectedVariant: { selectedOptions, customizations },
        engravingOptions,
        packaging: selectedPackagingId,
        diamondDetails: diamondDetails || undefined,
        priceAtTime: calculatedPrice
      });

      console.log(`Added new cart item: quantity=${quantity}, price=${calculatedPrice}`);
    }

    // Store ring size at cart level if provided
    if (ringsize) cart.ringsize = ringsize;

    cart.updatedOn = new Date();
    await cart.save();
    // Reload cart from DB to ensure latest data
    const freshCart = await Cart.findOne({ sessionId, userId, isCheckedOut: false });
    const cartSummary = await calculateCartSummary(freshCart);
    res.json({
      success: true,
      message: "Item added to cart",
      sessionId, // Include sessionId in the response
      totalItems: cartSummary.totalItems, // Total quantity of all items at root level
      cart: {
        ...freshCart.toObject(),
        summary: cartSummary
      }
    });
  } catch (err) {
    console.error("Cart add error:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: err.errors
      });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// calculateCartSummary moved to src/utils/cartHelper.js for global consistency.

// Update quantity
router.put("/update", async (req, res) => {
  try {
    const { sessionId, itemId, productId, quantity, engravingOptions, diamondDetails, packagingId } = req.body;

    let userId;
    try {
      userId = getUserIdFromToken(req);
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message || "Invalid or expired token" });
    }

    // Prefer sessionId (most specific) when provided, else fall back to userId
    const query = sessionId
      ? { sessionId, isCheckedOut: { $ne: true } }
      : { userId, isCheckedOut: { $ne: true } };
    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    // Check if cart has a pending checkout session
    if (cart.pendingCheckoutSessionId) {
      const lastUpdated = cart.updatedOn || new Date();
      const diffMinutes = (Date.now() - lastUpdated.getTime()) / (1000 * 60);

      if (diffMinutes < 10) {
        return res.status(400).json({
          error: "Cart is currently in checkout. Please complete or cancel your current checkout before making changes.",
          pendingCheckout: true,
          checkoutSessionId: cart.pendingCheckoutSessionId,
          remainingMinutes: Math.ceil(10 - diffMinutes)
        });
      } else {
        console.log(`Clearing expired checkout session ${cart.pendingCheckoutSessionId}`);
        cart.pendingCheckoutSessionId = undefined;
      }
    }

    // Find by itemId first, fallback to productId for old clients
    const item = itemId
      ? cart.items.find(i => i.itemId === itemId)
      : cart.items.find(i => i.productId.toString() === productId);
    if (!item) return res.status(404).json({ error: "Item not found in cart" });

    item.quantity = quantity;
    if (packagingId) item.packaging = packagingId;
    if (engravingOptions) item.engravingOptions = engravingOptions;
    
    // Transform diamondDetails to fix boolean casting issues
    if (diamondDetails) {
      const diamondType = diamondDetails.diamondType || '';
      const isLabGrown = diamondType.toLowerCase().includes('lab');
      
      // Convert empty string to proper boolean
      if (diamondDetails.lab === '' || diamondDetails.lab === null || diamondDetails.lab === undefined) {
        diamondDetails.lab = isLabGrown;
      }
      
      // Ensure all numeric fields are proper numbers
      if (diamondDetails.carats !== undefined && diamondDetails.carats !== null) {
        diamondDetails.carats = Number(diamondDetails.carats) || 0;
      }
      if (diamondDetails.price !== undefined && diamondDetails.price !== null) {
        diamondDetails.price = Number(diamondDetails.price) || 0;
      }
      if (diamondDetails.markup_price !== undefined && diamondDetails.markup_price !== null) {
        diamondDetails.markup_price = Number(diamondDetails.markup_price) || 0;
      }
      
      item.diamondDetails = diamondDetails;
    }
    
    await cart.save();

    res.json({ message: "Quantity updated", cart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Clear entire cart - DELETE /api/cart/clear
router.delete("/clear", async (req, res) => {
  try {
    let userId;
    try {
      userId = getUserIdFromToken(req);
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message || "Invalid or expired token" });
    }

    const { sessionId } = req.body;
    const query = { userId, isCheckedOut: false };
    if (sessionId) query.sessionId = sessionId;

    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    // Check if cart has a pending checkout session
    if (cart.pendingCheckoutSessionId) {
      const lastUpdated = cart.updatedOn || new Date();
      const diffMinutes = (Date.now() - lastUpdated.getTime()) / (1000 * 60);
      if (diffMinutes < 10) {
        return res.status(400).json({
          error: "Cart is currently in checkout. Please complete or cancel your current checkout before making changes.",
          pendingCheckout: true,
          checkoutSessionId: cart.pendingCheckoutSessionId,
          remainingMinutes: Math.ceil(10 - diffMinutes)
        });
      }
      cart.pendingCheckoutSessionId = undefined;
    }

    cart.items = [];
    cart.coupon = undefined;
    cart.updatedOn = new Date();
    await cart.save();

    res.json({ success: true, message: "Cart cleared successfully", cart });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove item from cart (Legacy POST /api/cart/remove)
router.post("/remove", async (req, res) => {
  try {
    const { sessionId, itemId, productId } = req.body;
    if (!itemId && !productId) return res.status(400).json({ error: "itemId or productId is required" });

    let userId;
    try {
      userId = getUserIdFromToken(req);
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message || "Invalid or expired token" });
    }

    const query = { userId, isCheckedOut: false };
    if (sessionId) query.sessionId = sessionId;

    const cart = await Cart.findOne(query);
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    // Checkout safety
    if (cart.pendingCheckoutSessionId) {
      const lastUpdated = cart.updatedOn || new Date();
      if ((Date.now() - lastUpdated.getTime()) / (1000 * 60) < 10) {
        return res.status(400).json({ error: "Cart is in checkout" });
      }
      cart.pendingCheckoutSessionId = undefined;
    }

    // Find by itemId first, then _id, then productId (old clients)
    const itemIndex = cart.items.findIndex(item =>
      (itemId && item.itemId === itemId) ||
      item._id.toString() === productId ||
      item.productId.toString() === productId
    );

    if (itemIndex === -1) return res.status(404).json({ error: "Item not found" });

    cart.items.splice(itemIndex, 1);
    cart.updatedOn = new Date();
    await cart.save();

    const summary = await calculateCartSummary(cart);
    res.json({ success: true, message: "Item removed", cart: { ...cart.toObject(), summary } });
  } catch (err) {
    console.error("Remove POST error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove item OR clear cart - DELETE /api/cart/:id
//
// Auth  : JWT in Authorization header — no body required
// Param : cartId | sessionId | itemId (UUID v4) | item _id | productId
//
// Resolution order:
//   1. If param is cartId/sessionId AND itemId/productId is also given
//      (query string or body)  → remove that specific item
//   2. If param is cartId/sessionId and NO item specified → clear entire cart
//   3. If param is itemId / item _id / productId → remove that item
router.delete("/:id", async (req, res) => {
  try {
    const paramId = req.params.id;

    // Extract userId from JWT — no body required
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Authorization token is required" });

    let userId;
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const cart = await Cart.findOne({ userId, isCheckedOut: false });
    if (!cart) return res.status(404).json({ error: "Cart not found" });

    // Checkout safety
    if (cart.pendingCheckoutSessionId) {
      const diffMinutes = (Date.now() - (cart.updatedOn || new Date()).getTime()) / (1000 * 60);
      if (diffMinutes < 10) {
        return res.status(400).json({
          error: "Cart is in checkout. Cannot modify.",
          remainingMinutes: Math.ceil(10 - diffMinutes)
        });
      }
      cart.pendingCheckoutSessionId = undefined;
    }

    const isCartIdentifier = (paramId === cart.cartId || paramId === cart.sessionId);

    // Item identifier from query string (?itemId=...) or body — whichever is provided
    const itemTarget = req.query.itemId || req.query.productId
      || req.body?.itemId || req.body?.productId;

    // ── Helper: find item index by any identifier ─────────────────────────────
    function findItemIndex(id) {
      if (!id) return -1;
      return cart.items.findIndex(item =>
        (item.itemId && item.itemId === id) ||
        item._id.toString() === id ||
        item.productId.toString() === id
      );
    }

    // ── Case 1: cartId/sessionId in URL + item specified → remove that item ───
    if (isCartIdentifier && itemTarget) {
      const idx = findItemIndex(itemTarget);
      if (idx === -1) return res.status(404).json({ error: "Item not found in cart" });

      cart.items.splice(idx, 1);
      cart.updatedOn = new Date();
      await cart.save();
      const summary = await calculateCartSummary(cart);
      return res.json({ success: true, message: "Item removed successfully", cart: { ...cart.toObject(), summary } });
    }

    // ── Case 2: cartId/sessionId in URL, no item specified → clear entire cart ─
    if (isCartIdentifier) {
      cart.items = [];
      cart.coupon = undefined;
      cart.updatedOn = new Date();
      await cart.save();
      return res.json({
        success: true,
        message: "Cart cleared successfully",
        cart: { ...cart.toObject(), summary: { subtotal: 0, total: 0, totalItems: 0, flatDiscountAmount: 0, couponDiscountAmount: 0, totalDiscount: 0 } }
      });
    }

    // ── Case 3: param is directly an itemId / item _id / productId ─────────────
    const itemIndex = findItemIndex(paramId);
    if (itemIndex === -1) {
      return res.status(404).json({
        error: "Item not found in cart",
        hint: "Use DELETE /api/cart/:cartId?itemId=<itemId> to remove a specific item, or DELETE /api/cart/:cartId to clear the whole cart"
      });
    }

    cart.items.splice(itemIndex, 1);
    cart.updatedOn = new Date();
    await cart.save();
    const summary = await calculateCartSummary(cart);
    res.json({ success: true, message: "Item removed successfully", cart: { ...cart.toObject(), summary } });

  } catch (err) {
    console.error("Remove DELETE error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Alternative: Clear cart by userId (GET with query params or dedicated endpoint)
router.post("/clear-by-user", async (req, res) => {
  try {
    let userId;
    try {
      userId = getUserIdFromToken(req);
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message || "Invalid or expired token" });
    }

    const cart = await Cart.findOne({ userId, isCheckedOut: false });

    if (!cart) {
      return res.status(404).json({
        error: "Cart not found",
        message: "No active cart found for this user"
      });
    }

    const itemsCleared = cart.items.length;

    cart.items = [];
    cart.coupon = undefined;
    cart.pendingCheckoutSessionId = undefined;
    cart.updatedOn = new Date();
    await cart.save();

    res.json({
      success: true,
      message: "Cart cleared successfully",
      itemsCleared,
      userId: cart.userId
    });
  } catch (err) {
    console.error("Clear cart by user error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message
    });
  }
});

// Get cart contents
// Accepts userId in the URL param OR from the JWT Authorization header.
router.get("/:userId", async (req, res) => {
  try {
    // Prefer token-based userId; fall back to URL param for backwards compatibility
    let userId = req.params.userId;
    try {
      const tokenUserId = getUserIdFromToken(req);
      if (tokenUserId) userId = tokenUserId; // token wins
    } catch (_) { /* no token — use URL param */ }

    if (!userId) {
      return res.status(400).json({ error: "UserId is required" });
    }

    const { sessionId } = req.query;
    // Find cart
    const query = { userId, isCheckedOut: false };
    if (sessionId) {
      query.sessionId = sessionId;
    }

    const cart = await Cart.findOne(query).populate({
      path: 'items.productId',
      select: 'title name description price images category material weight dimensions cadCode jewelryName pricing addedDiamonds'
    });

    if (!cart) {
      return res.json({
        success: true,
        totalItems: 0, // No items in empty cart
        cart: {
          items: [],
          coupon: null,
          total: 0
        },
        message: "Cart is empty"
      });
    }

    // Prepare items for response
    const validItems = [];
    for (const item of cart.items) {
      if (item.productId) {
        // Use stored priceAtTime first (it already includes custom diamond markup set at add-to-cart time)
        // Only fall back to getJewelryPrice if no price was stored
        const price = item.priceAtTime || getJewelryPrice(item.productId, item) || item.productId.price || 0;
        const itemTotal = price * item.quantity;

        // Normalize category if it's stringified JSON
        let category = item.productId.category;
        try {
          if (typeof category === 'string' && category.trim().startsWith('{')) {
            const parsed = JSON.parse(category);
            category = parsed.value || category;
          }
        } catch (e) { }

        const images = normalizeImages(item.productId.images || item.productId.imageUrl);

        validItems.push({
          ...item.toObject(),
          itemTotal,
          productDetails: {
            title: item.productId.title || item.productId.name,
            name: item.productId.name || item.productId.title,
            description: item.productId.description,
            price: price,
            images: images,
            category: category,
            material: item.productId.material,
            cadCode: item.productId.cadCode
          },
          priceAtTime: price
        });
      }
    }

    // Calculate totals using centralized helper
    const summary = await calculateCartSummary(cart);

    res.json({
      success: true,
      totalItems: summary.totalItems, // Total quantity at root level
      cart: {
        ...cart.toObject(),
        items: validItems,
        summary
      }
    });
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get cart by sessionId (alternative endpoint)
router.get("/session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: "SessionId is required" });
    }

    // Find cart
    const query = { sessionId, isCheckedOut: false };
    if (userId) {
      query.userId = userId;
    }

    const cart = await Cart.findOne(query).populate({
      path: 'items.productId',
      select: 'title description price images category material weight dimensions cadCode'
    });

    if (!cart) {
      return res.json({
        success: true,
        totalItems: 0, // No items in empty cart
        cart: {
          items: [],
          coupon: null,
          total: 0
        },
        message: "Cart is empty"
      });
    }

    // Calculate cart summary
    const summary = await calculateCartSummary(cart);

    res.json({
      success: true,
      totalItems: summary.totalItems, // Total quantity at root level
      cart: {
        ...cart.toObject(),
        summary
      }
    });
  } catch (err) {
    console.error("Get cart by session error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Apply coupon with enhanced logic
router.post("/apply-coupon", async (req, res) => {
  try {
    const { sessionId, userId, code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Coupon code is required" });
    }

    // Use your schema for coupon
    const coupon = await Coupon.findOne({ couponCode: code, isActive: true });

    if (!coupon) {
      return res.status(400).json({ error: "Invalid or inactive coupon code" });
    }

    // Check if coupon is within date range
    const now = new Date();
    if (coupon.dateRange && coupon.dateRange.start && coupon.dateRange.end) {
      if (now < coupon.dateRange.start || now > coupon.dateRange.end) {
        return res.status(400).json({ error: "Coupon has expired or is not yet active" });
      }
    }

    // Build cart query: prefer sessionId+userId match, fall back to userId-only
    const cartQuery = userId
      ? (sessionId ? { sessionId, userId, isCheckedOut: false } : { userId, isCheckedOut: false })
      : { sessionId, isCheckedOut: false };
    const cart = await Cart.findOne(cartQuery);
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // Check if cart has a pending checkout session
    if (cart.pendingCheckoutSessionId) {
      const lastUpdated = cart.updatedOn || new Date();
      const diffMinutes = (Date.now() - lastUpdated.getTime()) / (1000 * 60);

      if (diffMinutes < 10) {
        return res.status(400).json({
          error: "Cart is currently in checkout. Please complete or cancel your current checkout before applying coupons.",
          pendingCheckout: true,
          checkoutSessionId: cart.pendingCheckoutSessionId,
          remainingMinutes: Math.ceil(10 - diffMinutes)
        });
      } else {
        console.log(`Clearing expired checkout session ${cart.pendingCheckoutSessionId}`);
        cart.pendingCheckoutSessionId = undefined;
      }
    }


    // Calculate cart total and determine eligible items
    let cartTotal = 0;
    let eligibleTotal = 0;
    const eligibleItems = [];
    const ineligibleItems = [];

    for (let item of cart.items) {
      const product = await Jewelry.findById(item.productId) || await Product.findById(item.productId);
      if (!product) continue;

      const itemPrice = getJewelryPrice(product, item) || item.priceAtTime || product.price || 0;
      const itemTotal = itemPrice * item.quantity;
      cartTotal += itemTotal;

      let isEligible = false;

      // Check coupon type specificity (category takes priority over product if both are set)
      if (coupon.categoryWise && coupon.selectedCategory && coupon.selectedCategory.length > 0) {
        // Category-specific coupon
        // Jewelry category may be stored as an object {value, label} or a plain string
        const productCatValue = (product.category && typeof product.category === 'object' && product.category.value)
          ? product.category.value
          : (typeof product.category === 'string' ? product.category : '');
        
        const isEligibleCategory = coupon.selectedCategory.some(cat => {
          // selectedCategory items may be plain strings ("Pendant") or objects ({ categoryName: "Pendant" })
          const catName = typeof cat === 'string' ? cat : (cat.categoryName || cat.value || '');
          return catName && productCatValue.toLowerCase().trim() === catName.toLowerCase().trim();
        });
        if (isEligibleCategory) {
          isEligible = true;
        }
      } else if (coupon.productWise && coupon.selectedProducts && coupon.selectedProducts.length > 0) {
        // Product-specific coupon
        // selectedProducts may be ObjectId strings or objects ({ productObjectId: '...' })
        const isEligibleProduct = coupon.selectedProducts.some(prod => {
          const prodId = typeof prod === 'string' ? prod : (prod.productObjectId || prod._id || prod.id || '');
          return prodId && prodId.toString() === product._id.toString();
        });
        if (isEligibleProduct) {
          isEligible = true;
        }
      } else if (!coupon.categoryWise && !coupon.productWise) {
        // General coupon (applies to entire cart)
        isEligible = true;
      }

      if (isEligible) {
        eligibleItems.push({
          ...item,
          product: product,
          itemTotal: itemTotal
        });
        eligibleTotal += itemTotal;
      } else {
        ineligibleItems.push({
          ...item,
          product: product,
          itemTotal: itemTotal
        });
      }
    }

    // Check minimum amount requirement (based on eligible items for specific coupons, or cart total for general)
    const amountToCheck = (coupon.categoryWise || coupon.productWise) ? eligibleTotal : cartTotal;
    if (coupon.minimumAmount && amountToCheck < coupon.minimumAmount) {
      const couponType = coupon.categoryWise ? 'category-specific' :
        coupon.productWise ? 'product-specific' : 'general';
      return res.status(400).json({
        error: `Minimum order amount of $${coupon.minimumAmount} required for this ${couponType} coupon. Current eligible amount: $${amountToCheck.toFixed(2)}`
      });
    }

    if (eligibleItems.length === 0) {
      let errorMessage = "This coupon is not applicable to items in your cart";
      if (coupon.categoryWise) {
        const categories = coupon.selectedCategory.map(cat => cat.categoryName).join(', ');
        errorMessage = `This coupon only applies to products in categories: ${categories}`;
      } else if (coupon.productWise) {
        errorMessage = `This coupon only applies to specific selected products`;
      }
      return res.status(400).json({ error: errorMessage });
    }

    // Calculate discount based on eligible items only
    let discountAmount = 0;
    if (coupon.discountType === 'Percentage') {
      discountAmount = (eligibleTotal * coupon.discountValue) / 100;
    } else if (coupon.discountType === 'Flat') {
      discountAmount = Math.min(coupon.discountValue, eligibleTotal); // Don't exceed eligible total
    }

    // Remove any existing coupon (only one coupon allowed)
    cart.coupon = {
      code: coupon.couponCode,
      discount: coupon.discountValue,
      discountType: coupon.discountType,
      discountAmount: discountAmount,
      couponId: coupon._id,
      eligibleTotal: eligibleTotal,
      appliedTo: coupon.categoryWise ? 'category' :
        coupon.productWise ? 'product' : 'cart'
    };

    cart.updatedOn = new Date();
    await cart.save();

    // Re-calculate summary with the new coupon applied and flat discounts
    const summary = await calculateCartSummary(cart);

    res.json({
      success: true,
      message: "Coupon applied successfully",
      coupon: {
        code: coupon.couponCode,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: summary.couponDiscountAmount
      },
      cartSummary: summary
    });
  } catch (err) {
    console.error("Apply coupon error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Auto-apply category coupons
router.post("/auto-apply-coupons", async (req, res) => {
  try {
    const { sessionId, userId } = req.body;

    const cart = await Cart.findOne({ sessionId, userId, isCheckedOut: false });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // Skip if cart already has a coupon
    if (cart.coupon && cart.coupon.code) {
      return res.json({
        message: "Cart already has a coupon applied",
        currentCoupon: cart.coupon
      });
    }

    // Get all active category-wise coupons
    const categoryCoupons = await Coupon.find({
      isActive: true,
      categoryWise: true,
      $or: [
        { 'dateRange.start': { $exists: false } },
        {
          'dateRange.start': { $lte: new Date() },
          'dateRange.end': { $gte: new Date() }
        }
      ]
    });

    let bestCoupon = null;
    let maxDiscount = 0;
    let cartTotal = 0;

    // Calculate cart total and find categories
    const cartCategories = new Set();
    for (let item of cart.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        cartTotal += product.price * item.quantity;
        if (product.category) {
          cartCategories.add(product.category.toLowerCase());
        }
      }
    }

    // Find best applicable coupon
    for (let coupon of categoryCoupons) {
      if (coupon.minimumAmount && cartTotal < coupon.minimumAmount) continue;

      const isApplicable = coupon.selectedCategory && coupon.selectedCategory.some(cat =>
        cat.categoryName && cartCategories.has(cat.categoryName.toLowerCase())
      );

      if (isApplicable) {
        let discountAmount = 0;
        if (coupon.discountType === 'Percentage') {
          discountAmount = (cartTotal * coupon.discountValue) / 100;
        } else if (coupon.discountType === 'Flat') {
          discountAmount = coupon.discountValue;
        }

        if (discountAmount > maxDiscount) {
          maxDiscount = discountAmount;
          bestCoupon = coupon;
        }
      }
    }

    if (bestCoupon) {
      cart.coupon = {
        code: bestCoupon.couponCode,
        discount: bestCoupon.discountValue,
        discountType: bestCoupon.discountType,
        discountAmount: maxDiscount,
        couponId: bestCoupon._id,
        autoApplied: true
      };
      cart.updatedOn = new Date();
      await cart.save();

      res.json({
        success: true,
        message: "Best coupon automatically applied",
        coupon: cart.coupon,
        cartSummary: {
          subtotal: cartTotal,
          discount: maxDiscount,
          total: cartTotal - maxDiscount
        }
      });
    } else {
      res.json({
        success: true,
        message: "No applicable coupons found"
      });
    }
  } catch (err) {
    console.error("Auto-apply coupons error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove coupon
router.post("/remove-coupon", async (req, res) => {
  try {
    const { sessionId, userId } = req.body;

    const cart = await Cart.findOne({ sessionId, userId, isCheckedOut: false });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    cart.coupon = undefined;
    cart.updatedOn = new Date();
    await cart.save();

    res.json({
      success: true,
      message: "Coupon removed successfully"
    });
  } catch (err) {
    console.error("Remove coupon error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update customer information for faster checkout
router.post("/update-customer-info", async (req, res) => {
  try {
    const {
      userId,
      phone,
      billingAddress,
      shippingAddress,
      sameAsShipping = false
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const updateData = {};

    if (phone) updateData.phone = phone;
    if (billingAddress) updateData.billingAddress = billingAddress;
    if (shippingAddress) updateData.shippingAddress = shippingAddress;

    // If same as shipping is true, copy shipping to billing
    if (sameAsShipping && shippingAddress) {
      updateData.billingAddress = shippingAddress;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken');

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      message: "Customer information updated successfully",
      user: updatedUser
    });
  } catch (err) {
    console.error("Update customer info error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get customer information for checkout pre-filling
router.get("/customer-info/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const customer = await User.findById(userId)
      .select('-password -resetPasswordToken -resetPasswordExpire');

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({
      success: true,
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
        hasStripeCustomer: !!customer.stripeCustomerId
      }
    });
  } catch (err) {
    console.error("Get customer info error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Checkout (creates Stripe session)
router.post("/checkout", async (req, res) => {
  try {
    const { sessionId, userId, shippingDetails, currency = "usd" } = req.body;
    const stripeCurrency = currency.toLowerCase();

    if (!sessionId || !userId) {
      return res.status(400).json({ error: "SessionId and userId are required" });
    }
    console.log(userId, sessionId, stripeCurrency);

    // Find cart and populate customer data
    const cart = await Cart.findOne({
      sessionId,
      userId,
      isCheckedOut: false
    });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // ✅ DYNAMIC: Calculate max estimatedDeliveryDays from products (not static)
    let maxDeliveryDays = 5; // safe default
    for (const item of cart.items) {
      const product = await Jewelry.findById(item.productId);
      if (product && product.estimatedDeliveryDays) {
        if (product.estimatedDeliveryDays > maxDeliveryDays) {
          maxDeliveryDays = product.estimatedDeliveryDays;
        }
      }
    }
    console.log(`[CHECKOUT] Calculated maxDeliveryDays from products: ${maxDeliveryDays} days`);

    // Parse shipping details if provided (using dynamic maxDeliveryDays)
    let parsedShippingDetails = null;
    if (shippingDetails) {
      parsedShippingDetails = {
        estimatedDeliveryDays: shippingDetails.estimatedDeliveryDays || maxDeliveryDays,
        deliveryDateRange: {
          start: shippingDetails.deliveryDateStart ? new Date(shippingDetails.deliveryDateStart) : null,
          end: shippingDetails.deliveryDateEnd ? new Date(shippingDetails.deliveryDateEnd) : null
        },
        shippingMethod: shippingDetails.shippingMethod || 'Standard',
        shippingCost: shippingDetails.shippingCost || 0
      };
      console.log("Parsed shipping details:", parsedShippingDetails);
    }

    // If a pending checkout session already exists, return it (idempotent behavior)
    if (cart.pendingCheckoutSessionId) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(cart.pendingCheckoutSessionId);
        // Try find the order linked to this session
        const existingOrder = await Order.findOne({ stripeSessionId: cart.pendingCheckoutSessionId });
        return res.json({
          success: true,
          message: "Checkout already in progress for this cart",
          url: existingSession.url,
          sessionId: existingSession.id,
          orderId: existingOrder ? existingOrder.orderId : null
        });
      } catch (err) {
        // If retrieving Stripe session failed, fall through and allow creating a new one
        console.warn('Failed to retrieve existing Stripe session, creating new one:', err.message);
      }
    }

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Get user data for pre-filling Stripe checkout
    const customer = await User.findById(userId);
    console.log("Finding customer with userId:", userId);
    console.log("Customer data for checkout:", customer);

    // Log initial cart state
    console.log(`\n=== INITIAL CART STATE ===`);
    console.log(`Cart ID: ${cart._id}`);
    console.log(`Items count: ${cart.items.length}`);
    console.log(`Has coupon: ${!!cart.coupon}`);
    if (cart.coupon) {
      console.log(`Coupon details:`, cart.coupon);
    }
    console.log(`=== END INITIAL CART STATE ===\n`);

    // Auto-apply category coupons if no coupon is applied
    if (!cart.coupon || !cart.coupon.code) {
      console.log("No coupon applied, checking for auto-apply...");
      await autoApplyCategoryCoupons(cart, Product);

      // Re-check cart after auto-apply and reload from DB to get updated coupon
      const updatedCart = await Cart.findById(cart._id);
      if (updatedCart && updatedCart.coupon && updatedCart.coupon.code) {
        cart.coupon = updatedCart.coupon;
        console.log("Auto-applied coupon:", cart.coupon);
      } else {
        console.log("No coupons auto-applied");
      }
    }

    // Validate and update cart items with current prices (including variant pricing)
    const updatedItems = [];
    let subtotalAmount = 0;

    for (let item of cart.items) {
      const product = await Jewelry.findById(item.productId);
      if (!product) {
        return res.status(400).json({
          error: `Product not found: ${item.productId}`
        });
      }
      console.log(item)
      console.log("Processing cart item:", { product });

      // Calculate price based on selected variant (metal detail) or use existing priceAtTime
      let finalPrice = item.priceAtTime || product.price || null; // Use priceAtTime first, then base price

      // Try to derive variant/metal-specific pricing when product.price is not available
      const selectedMetalId = item.selectedVariant?.selectedOptions?.metaldetail;
      if (selectedMetalId) {
        // 1) Try product.pricing.metalPricing structure (preferred)
        try {
          if (product.pricing && Array.isArray(product.pricing.metalPricing)) {
            const pricingEntry = product.pricing.metalPricing.find(p => {
              // p.metal may be an object with id or a primitive id string
              const metalId = p.metal?.id || p.metal;
              return metalId && metalId.toString() === selectedMetalId.toString();
            });
            if (pricingEntry && pricingEntry.finalPrice) {
              // Prefer natural price, fallback to lab
              finalPrice = pricingEntry.finalPrice.natural || pricingEntry.finalPrice.lab || finalPrice;
            }
          }
        } catch (e) {
          console.warn('Error reading product.pricing for variant price fallback', e.message);
        }

        // 2) Fallback to availableMetals entries
        if ((!finalPrice || finalPrice <= 0) && product.availableMetals && product.availableMetals.length > 0) {
          const selectedMetal = product.availableMetals.find(m => m.metal && m.metal.toString() === selectedMetalId.toString());
          if (selectedMetal) {
            if (selectedMetal.price) {
              finalPrice = selectedMetal.price;
            }
          }
        }
      }

      // 3) If still no price, try first available pricing entry as a last resort
      if ((!finalPrice || finalPrice <= 0) && product.pricing && Array.isArray(product.pricing.metalPricing) && product.pricing.metalPricing.length > 0) {
        const first = product.pricing.metalPricing[0];
        finalPrice = finalPrice || (first.finalPrice?.natural || first.finalPrice?.lab || null);
      }

      // 4) Final fallback: use any numeric product.price if present
      if ((!finalPrice || finalPrice <= 0) && product.price) {
        finalPrice = product.price;
      }

      // Validate we have a valid price
      if (!finalPrice || isNaN(finalPrice) || finalPrice <= 0) {
        console.error("No valid price available for product:", product._id);
        return res.status(400).json({
          error: `Invalid price for product: ${product.title || product._id}. Please contact support.`
        });
      }

      // Update price to calculated variant price
      item.priceAtTime = finalPrice;
      const itemTotal = finalPrice * item.quantity;
      subtotalAmount += itemTotal;

      // Enhanced product data for Stripe checkout
      let productName = product.title || product.name || "Jewelry Product";

      const productDescription = buildProductDescription(product, item);
      console.log("Here is the Product ", product);

      // Get variant-specific images based on selected metal
      const productImages = getProductImages(product, item.selectedVariant);

      // Ensure unit_amount is a valid positive integer (in cents)
      const unitAmount = Math.round(Number(finalPrice) * 100);

      if (isNaN(unitAmount) || unitAmount <= 0) {
        console.error("Invalid unit amount calculated:", unitAmount, "from price:", finalPrice);
        return res.status(400).json({
          error: `Cannot calculate valid price for product: ${productName}`
        });
      }

      // Build engraving metadata string
      let engravingInfo = 'none';
      let engravingText = null;
      let engravingFont = null;
      let engravingPosition = null;

      if (item.engravingOptions?.engravingText) {
        engravingText = item.engravingOptions.engravingText;
        engravingFont = item.engravingOptions.font || 'default';
        engravingInfo = `${engravingText} (${engravingFont} font)`;
      } else if (item.selectedVariant?.selectedOptions?.engraving?.text) {
        const eng = item.selectedVariant.selectedOptions.engraving;
        engravingText = eng.text;
        engravingFont = eng.font || 'default';
        engravingPosition = eng.position || 'standard';
        engravingInfo = `${engravingText} (${engravingFont} font, ${engravingPosition} position)`;
      }

      // Add main product to Stripe line items
      updatedItems.push({
        price_data: {
          currency: stripeCurrency,
          product_data: {
            name: productName,
            description: productDescription,
            images: productImages || [], // Variant-specific product images for Stripe checkout
            metadata: {
              productId: product._id.toString(),
              category: (product.category && product.category.value) ? product.category.value : (typeof product.category === 'string' ? product.category : "Jewelry"),
              variant: typeof item.selectedVariant === 'string' ? item.selectedVariant : JSON.stringify(item.selectedVariant || {}),
              sku: product.sku || product._id.toString(),
              engraving: engravingInfo,
              metalType: item.selectedVariant?.customizations?.metalType || item.customizations?.metalType || 'Not specified',
              ringSize: item.selectedVariant?.selectedOptions?.ringsize || 'Not specified'
            }
          },
          unit_amount: unitAmount, // Already validated positive integer in cents
        },
        quantity: item.quantity,
      });

      // Add engraving as a SEPARATE line item if engraving exists and has a cost
      // Note: Engraving is FREE, so we include it in the product description instead of a separate line item
      // Stripe doesn't allow $0 line items
      if (engravingText) {
        console.log(`Engraving detected: "${engravingText}" - Complimentary (FREE)`);
        // Engraving details are already in product description and metadata
        // No additional cost or line item needed
      }
    }

    let totalAmount = subtotalAmount;
    let discountAmount = 0;
    let coupon = null; // Initialize coupon variable at proper scope

    // Apply coupon discount if exists and valid
    if (cart.coupon && cart.coupon.code) {
      console.log(`\n=== COUPON PROCESSING ===`);
      console.log(`Cart has coupon: ${cart.coupon.code}`);

      coupon = await Coupon.findOne({
        couponCode: cart.coupon.code,
        isActive: true
      });

      console.log(`Coupon found in database:`, !!coupon);
      if (coupon) {
        console.log(`Coupon details:`, {
          code: coupon.couponCode,
          type: coupon.discountType,
          value: coupon.discountValue,
          isActive: coupon.isActive
        });
      }

      if (coupon) {
        // Validate coupon is still applicable
        const isValidCoupon = await validateCouponForCart(coupon, cart, Product);
        console.log(`Coupon validation result:`, isValidCoupon);

        if (isValidCoupon.valid) {
          console.log(`\n=== CALCULATING DISCOUNT ===`);
          console.log(`Subtotal amount: $${subtotalAmount}`);
          console.log(`Coupon type: ${coupon.discountType}`);
          console.log(`Coupon value: ${coupon.discountValue}`);

          if (coupon.discountType === 'Percentage') {
            discountAmount = (subtotalAmount * coupon.discountValue) / 100;
            console.log(`Percentage calculation: ${subtotalAmount} * ${coupon.discountValue}% = $${discountAmount}`);
          } else if (coupon.discountType === 'Flat') {
            discountAmount = Math.min(coupon.discountValue, subtotalAmount);
            console.log(`Flat calculation: min(${coupon.discountValue}, ${subtotalAmount}) = $${discountAmount}`);
          }

          // Round discount and total to 2 decimal places to avoid floating-point artifacts
          discountAmount = Math.round(discountAmount * 100) / 100;
          totalAmount = Math.round((subtotalAmount - discountAmount) * 100) / 100;
          
          console.log(`Final total: ${subtotalAmount} - ${discountAmount} = $${totalAmount}`);
          console.log(`=== END DISCOUNT CALCULATION ===\n`);

          // Apply discount proportionally to each line item
          if (discountAmount > 0) {
            const discountRatio = discountAmount / subtotalAmount;
            console.log(`\n=== APPLYING DISCOUNT TO LINE ITEMS ===`);
            console.log(`Discount ratio: ${discountRatio.toFixed(4)} (${(discountRatio * 100).toFixed(2)}%)`);
            console.log(`Original line items:`, updatedItems.length);

            // Apply proportional discount to products and add discount info
            for (let item of updatedItems) {
              const originalUnitAmount = item.price_data.unit_amount;
              const discountedUnitAmount = Math.round(originalUnitAmount * (1 - discountRatio));

              // Ensure the discounted amount is still positive
              if (discountedUnitAmount > 0) {
                item.price_data.unit_amount = discountedUnitAmount;

                // Add discount info to product name and description
                const originalPrice = originalUnitAmount / 100;
                const discountedPrice = discountedUnitAmount / 100;
                const savings = originalPrice - discountedPrice;

                // Update product name to show discount
                item.price_data.product_data.name = `${item.price_data.product_data.name} (${coupon.couponCode} Applied)`;

                // Update description to show savings
                const baseDescription = item.price_data.product_data.description || '';
                item.price_data.product_data.description = `${baseDescription} | 🎉 ${coupon.discountType === 'Percentage' ?
                  `${coupon.discountValue}% OFF` :
                  `$${coupon.discountValue} OFF`} | Was: $${originalPrice.toFixed(2)} | You Save: $${savings.toFixed(2)}`;

                console.log(`✓ "${item.price_data.product_data.name}": $${originalPrice.toFixed(2)} → $${discountedPrice.toFixed(2)} (saved $${savings.toFixed(2)})`);
              } else {
                console.warn(`⚠️ "${item.price_data.product_data.name}" would be free/negative, setting to $0.01`);
                item.price_data.unit_amount = 1;
              }
            }

            console.log(`✓ Updated all products to show coupon: ${coupon.couponCode}`);
            console.log(`=== END LINE ITEM DISCOUNT APPLICATION ===\n`);
          } else {
            console.log(`❌ No discount to apply (discountAmount: ${discountAmount})`);
          }

          console.log(`Applied discount: ${discountAmount} (${coupon.discountType}: ${coupon.discountValue})`);
          console.log(`Subtotal: ${subtotalAmount}, Final total: ${totalAmount}`);

          // Update cart with final discount amount
          cart.coupon.discountAmount = discountAmount;
        } else {
          // Remove invalid coupon
          cart.coupon = undefined;
          console.log("Coupon became invalid, removed from cart");
        }
      } else {
        // Remove non-existent coupon
        cart.coupon = undefined;
        console.log("Coupon not found, removed from cart");
      }
    } else {
      console.log(`\n=== NO COUPON TO PROCESS ===`);
      console.log(`Cart coupon:`, cart.coupon);
      console.log(`Has coupon code:`, !!(cart.coupon && cart.coupon.code));
      console.log(`=== END NO COUPON ===\n`);
    }

    // Prepare customer information for Stripe
    const customerData = {};
    let useStripeCustomer = false;

    if (customer) {
      console.log("Customer found:", {
        id: customer._id,
        email: customer.email,
        name: customer.name,
        stripeCustomerId: customer.stripeCustomerId
      });

      // Check if customer has existing Stripe customer ID
      if (customer.stripeCustomerId) {
        useStripeCustomer = true;
        console.log("Using existing Stripe customer:", customer.stripeCustomerId);
      } else if (customer.email) {
        console.log("Setting customer email for new Stripe session:", customer.email);
        customerData.customer_email = customer.email;
      }

      // Pre-fill billing address if available
      if (customer.billingAddress) {
        customerData.billing_address_collection = 'auto';
      } else {
        customerData.billing_address_collection = 'required';
      }

      // Shipping address collection
      customerData.shipping_address_collection = {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES']
      };

      // Custom text with customer name
      if (customer.name) {
        customerData.custom_text = {
          submit: {
            message: `Thank you ${customer.name} for choosing Celora Jewelry! Your order will be processed within 1-2 business days.`
          }
        };
      }

      // Phone number collection
      customerData.phone_number_collection = {
        enabled: true
      };
    } else {
      console.log("No customer found for userId:", userId);
      // Set defaults for guest checkout
      customerData.billing_address_collection = 'required';
      customerData.shipping_address_collection = {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES']
      };
      customerData.phone_number_collection = {
        enabled: true
      };
    }
    console.log("Customer data for Stripe:", customerData);
    console.log("Use existing Stripe customer:", useStripeCustomer, customer?.stripeCustomerId);

    // Determine valid payment methods based on currency
    let validPaymentMethods = ["card"];
    if (stripeCurrency === 'usd') {
      validPaymentMethods = ["card", "affirm"];
    }

    // Create enhanced Stripe checkout session with customer pre-filling
    const sessionConfig = {
      payment_method_types: validPaymentMethods, // Dynamic payment options
      line_items: updatedItems,
      mode: "payment",
      success_url: `${PAYMENT_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PAYMENT_CANCEL_URL}?session_id={CHECKOUT_SESSION_ID}`,

      // Enable automatic receipt emails from Stripe
      payment_intent_data: {
        receipt_email: customer?.email || null, // Stripe will send automatic receipts
        metadata: {
          orderId: 'pending', // Will be updated when order is created
          customerName: customer?.name || '',
          companyName: 'Celora Jewelry'
        }
      },

      // Enhanced metadata
      metadata: {
        cartId: cart._id.toString(),
        userId: userId.toString(),
        sessionId: sessionId,
        originalSubtotal: subtotalAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        finalTotal: totalAmount.toFixed(2),
        itemCount: cart.items.length.toString(),
        couponCode: cart.coupon?.code || 'none',
        couponType: cart.coupon?.code ? (coupon?.discountType || 'unknown') : 'none',
        couponValue: cart.coupon?.code ? (coupon?.discountValue?.toString() || '0') : '0',
        discountApplied: discountAmount > 0 ? 'yes' : 'no'
      },

      // Custom branding message with coupon info
      custom_text: customerData.custom_text || {
        submit: {
          message: discountAmount > 0 ?
            `🎉 Congratulations! You saved $${discountAmount.toFixed(2)} with coupon ${coupon?.couponCode}! Thank you for choosing Celora Jewelry! Your order will be processed within 1-2 business days.` :
            'Thank you for choosing Celora Jewelry! Your order will be processed within 1-2 business days.'
        }
      },

      // Allow promotion codes in Stripe (optional)
      allow_promotion_codes: false, // We handle coupons in our system

      // Automatic tax calculation (if configured in Stripe)
      automatic_tax: {
        enabled: false, // Set to true if you have Stripe Tax configured
      },

      // Customer information pre-filling
      ...customerData
    };

    // If customer has a Stripe customer ID, use it for saved payment methods
    if (useStripeCustomer && customer.stripeCustomerId) {
      try {
        // Verify and update the Stripe customer if needed
        const stripeCustomer = await stripe.customers.retrieve(customer.stripeCustomerId);

        // Update Stripe customer email if it's different from our database
        if (stripeCustomer.email !== customer.email && customer.email) {
          await stripe.customers.update(customer.stripeCustomerId, {
            email: customer.email,
            name: customer.name || stripeCustomer.name,
            phone: customer.phone || stripeCustomer.phone
          });
          console.log("Updated Stripe customer email:", customer.email);
        }

        sessionConfig.customer = customer.stripeCustomerId;
        sessionConfig.customer_update = {
          address: 'auto',
          name: 'auto'
        };

        console.log("Using existing Stripe customer:", customer.stripeCustomerId, "with email:", customer.email);
      } catch (stripeError) {
        console.log("Error updating Stripe customer:", stripeError.message);
        // Fallback: create new customer if existing one is invalid
        if (customer.email) {
          sessionConfig.customer_email = customer.email;
          console.log("Falling back to customer_email due to Stripe customer error:", customer.email);
        }
      }
    } else if (customer && customer.email) {
      // Create or retrieve Stripe customer for future use
      try {
        const stripeCustomer = await stripe.customers.create({
          email: customer.email,
          name: customer.name || '',
          phone: customer.phone || '',
          metadata: {
            userId: userId.toString(),
            source: 'celora_checkout'
          }
        });

        // Save Stripe customer ID to user record for future use
        await User.findByIdAndUpdate(userId, {
          stripeCustomerId: stripeCustomer.id
        });

        sessionConfig.customer = stripeCustomer.id;
        sessionConfig.customer_update = {
          address: 'auto',
          name: 'auto'
        };

        // Remove customer_email since we're now using customer ID
        delete sessionConfig.customer_email;

        console.log("Created new Stripe customer:", stripeCustomer.id);
      } catch (stripeError) {
        console.log('Error creating Stripe customer:', stripeError.message);
        // Fallback to customer_email if customer creation fails
        if (customer.email) {
          sessionConfig.customer_email = customer.email;
          console.log("Falling back to customer_email:", customer.email);
        }
      }
    } else {
      console.log("No customer data available for Stripe session");
    }

    console.log("Final session config customer info:", {
      hasCustomer: !!sessionConfig.customer,
      hasCustomerEmail: !!sessionConfig.customer_email,
      customer: sessionConfig.customer,
      customer_email: sessionConfig.customer_email,
      customerDataFromDB: {
        email: customer?.email,
        name: customer?.name,
        stripeCustomerId: customer?.stripeCustomerId
      }
    });

    // Debug: Log all line items before creating Stripe session
    console.log("=== STRIPE SESSION DEBUG ===");
    console.log("Total line items:", updatedItems.length);
    console.log("Line items details:", JSON.stringify(updatedItems.map(item => ({
      name: item.price_data.product_data.name,
      unit_amount: item.price_data.unit_amount,
      quantity: item.quantity,
      total_for_item: item.price_data.unit_amount * item.quantity
    })), null, 2));

    // Calculate final Stripe total
    const stripeTotalCents = updatedItems.reduce((sum, item) =>
      sum + (item.price_data.unit_amount * item.quantity), 0);
    const stripeTotalDollars = stripeTotalCents / 100;

    console.log("Cart totals:", {
      originalSubtotal: subtotalAmount,
      discountAmount,
      expectedTotal: totalAmount,
      stripeCalculatedTotal: stripeTotalDollars,
      hasDiscount: discountAmount > 0,
      couponCode: cart.coupon?.code,
      discountMatches: Math.abs(totalAmount - stripeTotalDollars) < 0.01
    });

    // Validate all line items have positive unit_amount
    const invalidItems = updatedItems.filter(item =>
      !item.price_data.unit_amount ||
      item.price_data.unit_amount <= 0 ||
      isNaN(item.price_data.unit_amount)
    );

    if (invalidItems.length > 0) {
      console.error("Invalid line items found:", invalidItems);
      return res.status(400).json({
        error: "Invalid pricing data",
        details: "One or more items have invalid prices",
        invalidItems: invalidItems.map(item => ({
          name: item.price_data.product_data.name,
          unit_amount: item.price_data.unit_amount
        }))
      });
    }
    console.log("=== END STRIPE SESSION DEBUG ===");

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // DO NOT mark cart as checked out here - only mark it after successful payment
    // Instead, we'll add a checkout session ID to track the pending checkout
    cart.pendingCheckoutSessionId = session.id;
    cart.updatedOn = new Date();
    await cart.save();

    // Create order record with enhanced data
    const orderProducts = [];
    const orderSubOrders = [];
    const { v1: uuidv1 } = require('uuid');

    // Track max estimatedDeliveryDays across all items to compute expectedDeliveryDate
    maxDeliveryDays = 5; // reset before full product loop

    for (let item of cart.items) {
      const product = await Jewelry.findById(item.productId);
      if (product) {
        // Use the priceAtTime that was calculated with variant pricing
        const itemPrice = item.priceAtTime || product.price;
        const firstImage = (product.images && product.images.length > 0) ? product.images[0] : null;

        // Accumulate max delivery days from product config (default 5 if not set)
        // Fully dynamic: uses whatever value is in the database for this product
        const productDeliveryDays = product.estimatedDeliveryDays || 5;
        if (productDeliveryDays > maxDeliveryDays) maxDeliveryDays = productDeliveryDays;

        const productDetailsSnapshot = {
          title: product.title || product.name,
          name: product.name || product.title,
          description: product.description,
          images: product.images || [],
          category: product.category,
          material: product.material,
          metalType: product.metalType || product.metal || '-',
          price: itemPrice,
          cadCode: product.cadCode,
          slug: product.slug || null,        // SEO slug for product URL
          selectedVariant: item.selectedVariant,
          // Diamond/Stone Details
          diamondDetails: {
            shape: product.shape || item.selectedVariant?.shape || '-',
            diamondType: product.diamondType || item.selectedVariant?.diamondType || '-',
            cut: product.cut || item.selectedVariant?.cut || '-',
            clarity: product.clarity || item.selectedVariant?.clarity || '-',
            caratSize: product.caratSize || item.selectedVariant?.caratSize || item.selectedVariant?.carat || '-',
            color: product.color || item.selectedVariant?.color || '-',
            priceWithMargin: item.selectedVariant?.priceWithMargin || itemPrice || '-'
          },
          // Additional Details
          ringSize: item.selectedVariant?.ringSize || item.selectedVariant?.size || '-',
          estimatedDeliveryDays: productDeliveryDays,
          packagingType: product.packagingType || '-'
        };

        // Legacy products array — kept for backwards compatibility
        orderProducts.push({
          productId: item.productId,
          quantity: item.quantity,
          type: product.type || 'Premade',
          priceAtTime: itemPrice,
          imageUrl: firstImage,
          productDetails: productDetailsSnapshot
        });

        // Sub-order: one per cart item, each with its own status & progress
        orderSubOrders.push({
          subOrderId: generateSubOrderId(),
          productId: item.productId,
          quantity: item.quantity,
          type: product.type || 'Premade',
          priceAtTime: itemPrice,
          imageUrl: firstImage,
          productDetails: productDetailsSnapshot,
          engravingDetails: item.engravingOptions ? {
            hasEngraving: true,
            engravingText: item.engravingOptions.engravingText,
            font: item.engravingOptions.font
          } : { hasEngraving: false },
          status: 'Pending',
          progress: {}
        });
      }
    }

    // expectedDeliveryDate: today + max estimatedDeliveryDays across all items
    const expectedDeliveryDate = new Date(Date.now() + maxDeliveryDays * 24 * 60 * 60 * 1000);

    const order = new Order({
      orderId: generateOrderId(),
      customer: userId,
      products: orderProducts,
      subOrders: orderSubOrders,
      total: totalAmount,
      subtotal: subtotalAmount,
      discount: discountAmount,
      coupon: cart.coupon || null,
      expectedDeliveryDate,
      estimatedDeliveryDays: maxDeliveryDays,
      shippingDetails: parsedShippingDetails || {
        estimatedDeliveryDays: maxDeliveryDays,
        shippingMethod: 'Standard',
        shippingCost: 0
      },
      paymetmethod: 'stripe',
      status: 'Pending',
      stripeSessionId: session.id,
      customerData: {
        email: customer?.email,
        name: customer?.name,
        phone: customer?.phone
      },
      createdBy: userId,
      updatedBy: userId,
      referenceId: uuidv1()
    });

    await order.save();

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      orderId: order.orderId,
      orderSummary: {
        subtotal: subtotalAmount,
        discount: discountAmount,
        total: totalAmount,
        itemCount: cart.items.length,
        couponApplied: cart.coupon?.code || null
      }
    });

  } catch (err) {
    console.error("Checkout error:", err);
    res.status(500).json({
      error: "Checkout failed",
      details: err.message
    });
  }
});

// Checkout with direct card payment (no Stripe redirect)
router.post("/checkout-with-payment", async (req, res) => {
  try {
    const {
      sessionId,
      userId,
      paymentMethod,
      cardDetails: _cardDetails,
      billingAddress,
      shippingAddress,
      email,
      phone,
      customerName,
      // allow top-level card fields as alternative shape
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      cardholderName,
      token
    } = req.body;

    // Accept either nested cardDetails or top-level card fields
    const cardDetails = _cardDetails || (cardNumber || expiryMonth || expiryYear || cvv || cardholderName || token ? {
      cardNumber: cardNumber || undefined,
      expiryMonth: expiryMonth || undefined,
      expiryYear: expiryYear || undefined,
      cvv: cvv || undefined,
      cardholderName: cardholderName || undefined,
      token: token || undefined,
      paymentMethodId: undefined
    } : undefined);

    // If paymentMethod not provided but card details or token exist, assume card
    let resolvedPaymentMethod = paymentMethod;
    if (!resolvedPaymentMethod && (cardDetails || token || (cardNumber && cardNumber.startsWith && cardNumber.startsWith('tok_')))) {
      resolvedPaymentMethod = 'card';
    }

    // Use resolvedPaymentMethod for further validation
    const effectivePaymentMethod = resolvedPaymentMethod;

    // === VALIDATION ===

    // Required fields validation
    if (!sessionId || !userId) {
      return res.status(400).json({
        success: false,
        error: "SessionId and userId are required"
      });
    }

    // Email/phone are optional; validate only when provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, error: 'Invalid email format' });
      }
    }

    if (phone) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 10) {
        return res.status(400).json({ success: false, error: 'Invalid phone number. Must be at least 10 digits' });
      }
    }

    // Payment method validation
    if (!effectivePaymentMethod || !['card', 'affirm'].includes(effectivePaymentMethod)) {
      return res.status(400).json({ success: false, error: "Invalid payment method. Must be 'card' or 'affirm'" });
    }

    // Card validation (for card payments)
    if (effectivePaymentMethod === 'card') {
      if (!cardDetails) {
        return res.status(400).json({ success: false, error: 'Card details are required for card payment' });
      }

      const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName } = cardDetails;

      // Card number validation (13-19 digits OR Stripe test token OR payment method ID)
      const tokenFromDetails = cardDetails && cardDetails.token;
      const pmFromDetails = cardDetails && cardDetails.paymentMethodId;
      const topToken = token;
      const isTestToken = (cardNumber && String(cardNumber).startsWith('tok_')) ||
        (tokenFromDetails && String(tokenFromDetails).startsWith('tok_')) ||
        (topToken && String(topToken).startsWith('tok_'));
      const isPaymentMethodId = (cardNumber && String(cardNumber).startsWith('pm_')) ||
        (pmFromDetails && String(pmFromDetails).startsWith('pm_'));

      // Check if we have any valid card source
      const hasValidSource = cardNumber || tokenFromDetails || topToken || pmFromDetails;

      if (!hasValidSource) {
        return res.status(400).json({
          success: false,
          error: "Card details required: provide cardNumber, token, or paymentMethodId"
        });
      }

      // If raw card number provided (not token/pm_id), validate it
      if (cardNumber && !isTestToken && !isPaymentMethodId && !/^\d{13,19}$/.test(String(cardNumber).replace(/\s/g, ''))) {
        return res.status(400).json({
          success: false,
          error: "Invalid card number. Must be 13-19 digits or a valid Stripe token/payment method ID"
        });
      }

      // Skip detailed validation for test tokens and payment method IDs
      if (!isTestToken && !isPaymentMethodId) {
        // Expiry validation (only for raw card numbers)
        if (cardNumber && /^\d{13,19}$/.test(String(cardNumber).replace(/\s/g, ''))) {
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth() + 1;

          if (!expiryMonth || !expiryYear || expiryMonth < 1 || expiryMonth > 12) {
            return res.status(400).json({
              success: false,
              error: "Invalid expiry month"
            });
          }

          if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
            return res.status(400).json({
              success: false,
              error: "Card has expired"
            });
          }

          // CVV validation (3-4 digits)
          if (!cvv || !/^\d{3,4}$/.test(cvv)) {
            return res.status(400).json({
              success: false,
              error: "Invalid CVV. Must be 3 or 4 digits"
            });
          }
        }
      }

      // Cardholder name validation (optional for tokens/pm_ids)
      if (!isTestToken && !isPaymentMethodId && (!cardholderName || cardholderName.trim().length < 2)) {
        return res.status(400).json({
          success: false,
          error: "Cardholder name is required"
        });
      }
    }

    // Billing and shipping address validation are optional; if provided validate required fields
    if (billingAddress) {
      const requiredBillingFields = ['firstName', 'lastName', 'address1', 'city', 'state', 'zipCode', 'country', 'email', 'phone'];
      for (const field of requiredBillingFields) {
        if (!billingAddress[field] || billingAddress[field].trim().length === 0) {
          return res.status(400).json({ success: false, error: `Billing address ${field} is required` });
        }
      }
      if (billingAddress.country === 'US' && !/^\d{5}(-\d{4})?$/.test(billingAddress.zipCode)) {
        return res.status(400).json({ success: false, error: 'Invalid US zip code format. Must be 5 digits or 5+4 digits' });
      }
    }

    if (shippingAddress) {
      const requiredShippingFields = ['firstName', 'lastName', 'address1', 'city', 'state', 'zipCode', 'country', 'email', 'phone'];
      for (const field of requiredShippingFields) {
        if (!shippingAddress[field] || shippingAddress[field].trim().length === 0) {
          return res.status(400).json({ success: false, error: `Shipping address ${field} is required` });
        }
      }
      if (shippingAddress.country === 'US' && !/^\d{5}(-\d{4})?$/.test(shippingAddress.zipCode)) {
        return res.status(400).json({ success: false, error: 'Invalid shipping zip code format. Must be 5 digits or 5+4 digits' });
      }
    }

    // === CART RETRIEVAL ===

    const cart = await Cart.findOne({
      sessionId,
      userId,
      isCheckedOut: false
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        error: "Cart not found"
      });
    }

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Cart is empty"
      });
    }

    // === PRICE CALCULATION ===

    let subtotal = 0;
    const orderProducts = [];

    for (const item of cart.items) {
      const product = await Jewelry.findById(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Product not found: ${item.productId}`
        });
      }

      // Determine item price with fallbacks (priceAtTime -> product.price -> pricing.metalPricing -> availableMetals)
      let itemPrice = item.priceAtTime || product.price || null;

      const selectedMetalId = item.selectedVariant?.selectedOptions?.metaldetail;
      if (selectedMetalId) {
        // Try pricing.metalPricing
        try {
          if (product.pricing && Array.isArray(product.pricing.metalPricing)) {
            const pricingEntry = product.pricing.metalPricing.find(p => {
              const metalId = p.metal?.id || p.metal;
              return metalId && metalId.toString() === selectedMetalId.toString();
            });
            if (pricingEntry && pricingEntry.finalPrice) {
              itemPrice = itemPrice || pricingEntry.finalPrice.natural || pricingEntry.finalPrice.lab || itemPrice;
            }
          }
        } catch (e) {
          console.warn('Error reading product.pricing for variant price fallback', e.message);
        }

        // Fallback to availableMetals
        if ((!itemPrice || itemPrice <= 0) && product.availableMetals && product.availableMetals.length > 0) {
          const selectedMetal = product.availableMetals.find(m => m.metal && m.metal.toString() === selectedMetalId.toString());
          if (selectedMetal && selectedMetal.price) {
            itemPrice = selectedMetal.price;
          }
        }
      }

      // Last resort: first pricing entry
      if ((!itemPrice || itemPrice <= 0) && product.pricing && Array.isArray(product.pricing.metalPricing) && product.pricing.metalPricing.length > 0) {
        const first = product.pricing.metalPricing[0];
        itemPrice = itemPrice || (first.finalPrice?.natural || first.finalPrice?.lab || itemPrice);
      }

      // Final fallback to product.price
      if ((!itemPrice || itemPrice <= 0) && product.price) {
        itemPrice = product.price;
      }

      if (!itemPrice || isNaN(itemPrice)) {
        return res.status(400).json({ success: false, error: `Invalid price for product: ${product.title || product._id}. Please contact support.` });
      }

      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;

      // Fully dynamic: uses whatever value is in the database for this product
      const productDeliveryDays = product.estimatedDeliveryDays || 5;
      
      // Build complete product details snapshot
      const productDetails = {
        title: product.title || product.name,
        name: product.name || product.title,
        description: product.description,
        images: product.images || [],
        category: product.category,
        material: product.material,
        metalType: product.metalType || product.metal || '-',
        cadCode: product.cadCode,
        slug: product.slug || null,
        // Diamond/Stone Details
        diamondDetails: {
          shape: product.shape || item.selectedVariant?.shape || '-',
          diamondType: product.diamondType || item.selectedVariant?.diamondType || '-',
          cut: product.cut || item.selectedVariant?.cut || '-',
          clarity: product.clarity || item.selectedVariant?.clarity || '-',
          caratSize: product.caratSize || item.selectedVariant?.caratSize || item.selectedVariant?.carat || '-',
          color: product.color || item.selectedVariant?.color || '-',
          priceWithMargin: item.selectedVariant?.priceWithMargin || itemPrice || '-'
        },
        // Additional Details
        ringSize: item.selectedVariant?.ringSize || item.selectedVariant?.size || '-',
        estimatedDeliveryDays: productDeliveryDays,
        packagingType: product.packagingType || '-'
      };

      const firstImage = (product.images && product.images.length > 0) ? product.images[0] : null;

      orderProducts.push({
        productId: item.productId,
        quantity: item.quantity,
        price: itemPrice,
        total: itemTotal,
        selectedVariant: item.selectedVariant,
        engravingOptions: item.engravingOptions,
        imageUrl: firstImage,
        productDetails: productDetails
      });
    }

    // Apply coupon discount
    let discountAmount = 0;
    if (cart.coupon && cart.coupon.code) {
      const coupon = await Coupon.findOne({
        couponCode: cart.coupon.code,
        isActive: true
      });

      if (coupon) {
        if (coupon.discountType === 'Percentage') {
          discountAmount = (subtotal * coupon.discountValue) / 100;
        } else if (coupon.discountType === 'Flat') {
          discountAmount = Math.min(coupon.discountValue, subtotal);
        }
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    // === STRIPE PAYMENT PROCESSING ===

    let paymentIntentId = null;
    let paymentStatus = 'pending';
    let cardLast4 = null;
    let cardBrand = null;

    if (effectivePaymentMethod === 'card') {
      try {
        let paymentMethodObj = null;

        // 1) If frontend provided a paymentMethodId (pm_...), use it directly
        if (cardDetails && cardDetails.paymentMethodId) {
          paymentMethodObj = await stripe.paymentMethods.retrieve(cardDetails.paymentMethodId);
        }

        // 2) Determine token source (cardDetails.token, top-level token, or cardDetails.cardNumber token)
        const tokenFromDetails = cardDetails && cardDetails.token;
        const topToken = token;
        const possibleToken = tokenFromDetails || topToken || (cardDetails && cardDetails.cardNumber && String(cardDetails.cardNumber).startsWith('tok_') ? cardDetails.cardNumber : null);

        if (!paymentMethodObj && possibleToken) {
          paymentMethodObj = await stripe.paymentMethods.create({ type: 'card', card: { token: possibleToken } });
        }

        // 3) If still no paymentMethodObj, but raw numeric card details were provided, create a token then payment method
        if (!paymentMethodObj && cardDetails && cardDetails.cardNumber && /^\d{12,19}$/.test(cardDetails.cardNumber.replace(/\s/g, ''))) {
          const tokenPayload = {
            card: {
              number: cardDetails.cardNumber.replace(/\s/g, ''),
              exp_month: parseInt(cardDetails.expiryMonth),
              exp_year: parseInt(cardDetails.expiryYear),
              cvc: cardDetails.cvv,
              name: cardDetails.cardholderName || 'Test User'
            }
          };
          if (billingAddress) {
            tokenPayload.card.address_line1 = billingAddress.address1;
            tokenPayload.card.address_line2 = billingAddress.address2 || null;
            tokenPayload.card.address_city = billingAddress.city;
            tokenPayload.card.address_state = billingAddress.state;
            tokenPayload.card.address_zip = billingAddress.zipCode;
            tokenPayload.card.address_country = billingAddress.country;
          }

          const tokenObj = await stripe.tokens.create(tokenPayload);
          const pmCreatePayload = { type: 'card', card: { token: tokenObj.id } };
          if (email || phone || cardDetails.cardholderName || billingAddress) {
            pmCreatePayload.billing_details = {
              name: cardDetails.cardholderName,
              email: email || undefined,
              phone: phone || undefined,
              address: billingAddress ? {
                line1: billingAddress.address1,
                line2: billingAddress.address2 || null,
                city: billingAddress.city,
                state: billingAddress.state,
                postal_code: billingAddress.zipCode,
                country: billingAddress.country,
              } : undefined
            };
          }
          paymentMethodObj = await stripe.paymentMethods.create(pmCreatePayload);
        }

        if (!paymentMethodObj) {
          return res.status(400).json({ success: false, error: 'No valid card source provided (token, paymentMethodId or card details required)' });
        }

        // Store card details (last 4 digits and brand only - PCI compliant)
        cardLast4 = paymentMethodObj.card?.last4 || null;
        cardBrand = paymentMethodObj.card?.brand || null;

        // Create payment intent - validate amount first to avoid NaN being sent to Stripe
        const stripeAmount = Math.round(Number(total) * 100);
        if (!Number.isFinite(stripeAmount) || isNaN(stripeAmount)) {
          console.error('Invalid payment amount calculated:', total);
          return res.status(400).json({ success: false, error: 'Invalid total amount for payment' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: stripeAmount,
          currency: 'usd',
          payment_method_types: ['card'],
          payment_method: paymentMethodObj.id,
          confirm: true,
          description: `Order for ${customerName || email || 'customer'}`,
          receipt_email: email || undefined,
          metadata: {
            userId: userId ? String(userId) : '',
            cartId: cart._id ? String(cart._id) : '',
            sessionId: sessionId || '',
            customerEmail: email || '',
            orderTotal: total.toFixed(2),
          },
        });

        paymentIntentId = paymentIntent.id;
        paymentStatus = paymentIntent.status === 'succeeded' ? 'completed' : 'failed';

        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({ success: false, error: 'Payment failed. Please check your card details and try again.', paymentStatus: paymentIntent.status });
        }
      } catch (stripeError) {
        console.error('Stripe payment error:', stripeError);
        return res.status(400).json({ success: false, error: stripeError.message || 'Payment processing failed', details: stripeError.type || null });
      }
    } else if (effectivePaymentMethod === 'affirm') {
      // Create Affirm checkout session
      try {
        const affirmSession = await stripe.checkout.sessions.create({
          payment_method_types: ['affirm'],
          line_items: orderProducts.map(item => ({
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Product ${item.productId}`,
              },
              unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
          })),
          mode: 'payment',
          success_url: `${PAYMENT_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${PAYMENT_CANCEL_URL}?session_id={CHECKOUT_SESSION_ID}`,
        });

        return res.json({
          success: true,
          affirmCheckoutUrl: affirmSession.url,
          sessionId: affirmSession.id,
        });
      } catch (affirmError) {
        console.error("Affirm checkout error:", affirmError);
        return res.status(400).json({
          success: false,
          error: "Affirm checkout failed",
          details: affirmError.message
        });
      }
    }

    // === BUILD SUB-ORDERS ===
    const orderSubOrders = [];
    let maxDeliveryDays = 5; // default
    for (const item of orderProducts) {
      const product = await Jewelry.findById(item.productId).lean();
      // Fully dynamic: uses whatever value is in the database for this product
      const productDeliveryDays = product?.estimatedDeliveryDays || 5;
      
      if (productDeliveryDays > maxDeliveryDays) maxDeliveryDays = productDeliveryDays;
      
      orderSubOrders.push({
        subOrderId: generateSubOrderId(),
        productId: item.productId,
        quantity: item.quantity,
        type: product?.type || 'Premade',
        priceAtTime: item.price || item.priceAtTime,
        imageUrl: item.imageUrl,
        productDetails: item.productDetails,
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

    // === ORDER CREATION ===

    const order = new Order({
      orderId: generateOrderId(),
      customer: userId,
      products: orderProducts,
      subOrders: orderSubOrders,
      total: total,
      subtotal: subtotal,
      discount: discountAmount,
      coupon: cart.coupon || null,
      expectedDeliveryDate,
      estimatedDeliveryDays: maxDeliveryDays,
      paymentDetails: {
        method: paymentMethod,
        stripePaymentIntentId: paymentIntentId,
        status: paymentStatus,
        cardLast4: cardLast4, // Only last 4 digits (PCI compliant)
        cardBrand: cardBrand, // Card brand (Visa, Mastercard, etc.)
      },
      billingAddress: {
        firstName: billingAddress.firstName,
        lastName: billingAddress.lastName,
        address1: billingAddress.address1,
        address2: billingAddress.address2,
        city: billingAddress.city,
        state: billingAddress.state,
        zipCode: billingAddress.zipCode,
        country: billingAddress.country,
        email: billingAddress.email,
        phone: billingAddress.phone,
      },
      shippingAddress: {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zipCode: shippingAddress.zipCode,
        country: shippingAddress.country,
        email: shippingAddress.email,
        phone: shippingAddress.phone,
      },
      customerData: {
        email: email,
        phone: phone,
        name: customerName || `${billingAddress.firstName} ${billingAddress.lastName}`,
      },
      status: 'Confirmed',
      paymetmethod: paymentMethod,
      createdBy: userId,
      updatedBy: userId,
      referenceId: require('uuid').v1(),
    });

    await order.save();

    // Mark cart as checked out
    cart.isCheckedOut = true;
    cart.checkoutDate = new Date();
    cart.orderId = order.orderId;
    await cart.save();

    // Send confirmation email (optional - implement if email service is configured)
    // await sendOrderConfirmationEmail(email, order);

    res.json({
      success: true,
      message: "Order placed successfully",
      order: {
        orderId: order.orderId,
        total: total,
        subtotal: subtotal,
        discount: discountAmount,
        paymentStatus: paymentStatus,
        cardLast4: cardLast4,
        cardBrand: cardBrand,
      },
    });

  } catch (err) {
    console.error("Checkout with payment error:", err);
    res.status(500).json({
      success: false,
      error: "Checkout failed",
      details: err.message
    });
  }
});

/**
 * Helper function to build comprehensive product description for Stripe
 * @param {Object} product - Product object from database
 * @param {Object} cartItem - Cart item with selected options
 * @returns {string} Formatted product description
 */
function buildProductDescription(product, cartItem) {
  let description = product.description || product.shortDescription || '';

  // Add product details
  const details = [];

  // Metal type from customizations
  if (cartItem.selectedVariant?.customizations?.metalType || cartItem.customizations?.metalType) {
    const metalType = cartItem.selectedVariant?.customizations?.metalType || cartItem.customizations?.metalType;
    details.push(`Metal: ${metalType}`);
  } else if (product.material) {
    details.push(`Material: ${product.material}`);
  }

  // Ring size
  if (cartItem.selectedVariant?.selectedOptions?.ringsize) {
    details.push(`Size: ${cartItem.selectedVariant.selectedOptions.ringsize}`);
  }

  // Center stone details
  if (cartItem.selectedVariant?.selectedOptions?.centerStone) {
    const stone = cartItem.selectedVariant.selectedOptions.centerStone;
    if (stone.carat) {
      details.push(`Diamond: ${stone.carat} carat${stone.color ? ', ' + stone.color : ''}${stone.clarity ? ', ' + stone.clarity : ''}`);
    }
  }

  // Engraving details - prominently show it's FREE
  if (cartItem.engravingOptions?.engravingText) {
    details.push(`✨ FREE Engraving: "${cartItem.engravingOptions.engravingText}"`);
    if (cartItem.engravingOptions.font) {
      details.push(`Font: ${cartItem.engravingOptions.font}`);
    }
    details.push(`🎁 Complimentary Service - No Extra Charge`);
  } else if (cartItem.selectedVariant?.selectedOptions?.engraving?.text) {
    const eng = cartItem.selectedVariant.selectedOptions.engraving;
    details.push(`✨ FREE Engraving: "${eng.text}"`);
    if (eng.font) details.push(`Font: ${eng.font}`);
    if (eng.position) details.push(`Position: ${eng.position}`);
    details.push(`🎁 Complimentary Service - No Extra Charge`);
  }

  // Category
  if (product.category) {
    const categoryValue = (product.category.value) ? product.category.value : (typeof product.category === 'string' ? product.category : '');
    if (categoryValue) {
      details.push(`Category: ${categoryValue}`);
    }
  }

  // Weight
  if (product.weight) {
    details.push(`Weight: ${product.weight}`);
  }

  // Dimensions
  if (product.dimensions) {
    details.push(`Dimensions: ${product.dimensions}`);
  }

  // Combine description with details
  if (details.length > 0) {
    description += (description ? ' | ' : '') + details.join(' | ');
  }

  // Limit description length for Stripe (max 5000 characters)
  return description.length > 500 ? description.substring(0, 497) + '...' : description;
}

/**
 * Helper function to get product images for Stripe based on selected variant
 * @param {Object} product - Product object from database
 * @param {Object} selectedVariant - Selected variant with metal/color/shape options
 * @returns {Array} Array of image URLs prioritizing variant-specific images
 */
function getProductImages(product, selectedVariant) {
  const images = [];

  // PRIORITY 1: Get images based on selected center stone SHAPE
  let selectedShape = null;

  // Try to get shape from centerStone selection
  if (selectedVariant?.selectedOptions?.centerStone?.shape ||
    selectedVariant?.selectedOptions?.centerStone?.shapeValue) {
    selectedShape = selectedVariant.selectedOptions.centerStone.shape ||
      selectedVariant.selectedOptions.centerStone.shapeValue;
  }
  // If no shape in selection, try to get from product's stoneConfiguration
  else if (product.stoneConfiguration?.shapeValue) {
    selectedShape = product.stoneConfiguration.shapeValue;
  }
  // Or try first available shape from product
  else if (product.availableShapes && product.availableShapes.length > 0) {
    const firstShape = product.availableShapes[0];
    selectedShape = firstShape.name || firstShape.shapeCode;
  }

  // Normalize shape name to lowercase for matching
  if (selectedShape && typeof selectedShape === 'string') {
    selectedShape = selectedShape.toLowerCase().trim();
    console.log("Looking for images for shape:", selectedShape);

    // Check if product has images organized by shape (oval, round, pear, cushion, etc.)
    if (product.images && typeof product.images === 'object' && !Array.isArray(product.images)) {
      // Try exact match first
      if (product.images[selectedShape] && Array.isArray(product.images[selectedShape])) {
        product.images[selectedShape].forEach(img => {
          if (img && typeof img === 'string' && img.startsWith('http')) {
            if (!images.includes(img)) {
              images.push(img);
              console.log("Added shape-specific image:", img);
            }
          }
        });
      }

      // If no exact match, try partial match (e.g., "Round Brilliant" matches "round")
      if (images.length === 0) {
        Object.keys(product.images).forEach(shapeKey => {
          if (shapeKey.toLowerCase().includes(selectedShape) ||
            selectedShape.includes(shapeKey.toLowerCase())) {
            if (Array.isArray(product.images[shapeKey])) {
              product.images[shapeKey].forEach(img => {
                if (img && typeof img === 'string' && img.startsWith('http')) {
                  if (!images.includes(img)) {
                    images.push(img);
                    console.log("Added partial shape match image:", img);
                  }
                }
              });
            }
          }
        });
      }
    }
  }

  // If still no images and product.images is an object with shape keys, use first available
  if (images.length === 0 && product.images && typeof product.images === 'object' && !Array.isArray(product.images)) {
    const shapeKeys = Object.keys(product.images).filter(key =>
      Array.isArray(product.images[key]) && product.images[key].length > 0
    );

    if (shapeKeys.length > 0) {
      const firstShapeKey = shapeKeys[0];
      console.log("Using first available shape images:", firstShapeKey);
      product.images[firstShapeKey].forEach(img => {
        if (img && typeof img === 'string' && img.startsWith('http')) {
          if (!images.includes(img)) {
            images.push(img);
          }
        }
      });
    }
  }

  // PRIORITY 2: Get images based on selected metal type
  if (selectedVariant?.selectedOptions?.metaldetail && product.availableMetals) {
    const selectedMetalId = selectedVariant.selectedOptions.metaldetail.toString();
    const selectedMetal = product.availableMetals.find(m =>
      m.metal && m.metal.toString() === selectedMetalId
    );

    // If metal has specific images, use them
    if (selectedMetal) {
      if (selectedMetal.image) {
        if (!images.includes(selectedMetal.image)) {
          images.push(selectedMetal.image);
        }
      }
      if (selectedMetal.images && Array.isArray(selectedMetal.images)) {
        selectedMetal.images.forEach(img => {
          if (img && typeof img === 'string' && img.startsWith('http')) {
            if (!images.includes(img)) {
              images.push(img);
            }
          }
        });
      }
    }
  }

  // PRIORITY 3: Try to match metal color images from product images array
  if (selectedVariant?.customizations?.metalType && product.images && Array.isArray(product.images)) {
    const metalType = selectedVariant.customizations.metalType.toLowerCase();

    // Look for images with metal type in the name/path
    product.images.forEach(img => {
      if (images.length >= 8) return; // Stripe limit

      const imgUrl = typeof img === 'string' ? img : img?.url;
      if (imgUrl && imgUrl.toLowerCase().includes(metalType.toLowerCase())) {
        if (!images.includes(imgUrl)) {
          images.push(imgUrl);
        }
      }
    });
  }

  // PRIORITY 4: Fallback - Primary image
  if (product.imageUrl && !images.includes(product.imageUrl)) {
    images.push(product.imageUrl);
  }

  // PRIORITY 5: Additional images as fallback (if we don't have enough variant-specific images)
  if (images.length < 3 && product.images) {
    // Handle array of images
    if (Array.isArray(product.images)) {
      product.images.forEach(img => {
        if (images.length >= 8) return; // Stripe limit

        if (img && typeof img === 'string') {
          if (!images.includes(img) && img.startsWith('http')) {
            images.push(img);
          }
        } else if (img && img.url) {
          if (!images.includes(img.url) && img.url.startsWith('http')) {
            images.push(img.url);
          }
        }
      });
    }
    // Handle object with shape keys - add remaining shapes if needed
    else if (typeof product.images === 'object') {
      Object.keys(product.images).forEach(shapeKey => {
        if (images.length >= 8) return; // Stripe limit

        if (Array.isArray(product.images[shapeKey])) {
          product.images[shapeKey].forEach(img => {
            if (images.length >= 8) return;
            if (img && typeof img === 'string' && img.startsWith('http')) {
              if (!images.includes(img)) {
                images.push(img);
              }
            }
          });
        }
      });
    }
  }

  // PRIORITY 6: Gallery images (if still need more)
  if (images.length < 3 && product.gallery && Array.isArray(product.gallery)) {
    product.gallery.forEach(img => {
      if (images.length >= 8) return; // Stripe limit

      if (img && typeof img === 'string') {
        if (!images.includes(img) && img.startsWith('http')) {
          images.push(img);
        }
      } else if (img && img.url) {
        if (!images.includes(img.url) && img.url.startsWith('http')) {
          images.push(img.url);
        }
      }
    });
  }

  // Limit to 8 images (Stripe limit) and return only valid URLs
  return images
    .filter(url => url && (url.startsWith('http') || url.startsWith('https')))
    .slice(0, 8);
}

// Debug endpoint to check cart state
router.get("/debug/cart/:userId/:sessionId", async (req, res) => {
  try {
    const { userId, sessionId } = req.params;

    const cart = await Cart.findOne({ sessionId, userId, isCheckedOut: false });

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // Get products for the cart items
    const itemsWithProducts = [];
    for (let item of cart.items) {
      const product = await Product.findById(item.productId);
      itemsWithProducts.push({
        cartItem: item,
        product: product ? {
          id: product._id,
          title: product.title,
          price: product.price,
          category: product.category
        } : null
      });
    }

    // Check if coupon exists and is valid
    let couponDetails = null;
    if (cart.coupon && cart.coupon.code) {
      const coupon = await Coupon.findOne({
        couponCode: cart.coupon.code,
        isActive: true
      });

      if (coupon) {
        const validation = await validateCouponForCart(coupon, cart, Product);
        couponDetails = {
          found: true,
          coupon: {
            code: coupon.couponCode,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            isActive: coupon.isActive,
            categoryWise: coupon.categoryWise,
            productWise: coupon.productWise
          },
          validation
        };
      } else {
        couponDetails = {
          found: false,
          searchedCode: cart.coupon.code
        };
      }
    }

    res.json({
      success: true,
      cart: {
        id: cart._id,
        sessionId: cart.sessionId,
        userId: cart.userId,
        itemCount: cart.items.length,
        isCheckedOut: cart.isCheckedOut,
        coupon: cart.coupon,
        items: itemsWithProducts
      },
      couponDetails
    });
  } catch (err) {
    console.error("Debug cart error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.get("/debug/customer/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const customer = await User.findById(userId);

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    let stripeCustomerData = null;
    if (customer.stripeCustomerId) {
      try {
        stripeCustomerData = await stripe.customers.retrieve(customer.stripeCustomerId);
      } catch (err) {
        stripeCustomerData = { error: err.message };
      }
    }

    res.json({
      success: true,
      databaseCustomer: {
        id: customer._id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        stripeCustomerId: customer.stripeCustomerId
      },
      stripeCustomer: stripeCustomerData
    });
  } catch (err) {
    console.error("Debug customer error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Debug endpoint to test discount calculation
router.post("/debug/discount", async (req, res) => {
  try {
    const { sessionId, userId } = req.body;

    const cart = await Cart.findOne({ sessionId, userId, isCheckedOut: false });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // Calculate totals like in checkout
    let subtotalAmount = 0;
    const itemDetails = [];

    for (let item of cart.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        const itemTotal = product.price * item.quantity;
        subtotalAmount += itemTotal;
        itemDetails.push({
          productId: product._id,
          title: product.title,
          price: product.price,
          quantity: item.quantity,
          itemTotal,
          unitAmountCents: Math.round(product.price * 100)
        });
      }
    }

    let discountAmount = 0;
    let discountDetails = null;

    if (cart.coupon && cart.coupon.code) {
      const coupon = await Coupon.findOne({
        couponCode: cart.coupon.code,
        isActive: true
      });

      if (coupon) {
        if (coupon.discountType === 'Percentage') {
          discountAmount = (subtotalAmount * coupon.discountValue) / 100;
        } else if (coupon.discountType === 'Flat') {
          discountAmount = Math.min(coupon.discountValue, subtotalAmount);
        }

        discountDetails = {
          couponCode: coupon.couponCode,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          calculatedDiscount: discountAmount
        };
      }
    }

    const totalAmount = subtotalAmount - discountAmount;

    // Calculate what would be sent to Stripe
    const discountRatio = discountAmount > 0 ? discountAmount / subtotalAmount : 0;
    const stripeItems = itemDetails.map(item => {
      const originalUnitAmount = item.unitAmountCents;
      const discountedUnitAmount = discountAmount > 0 ?
        Math.round(originalUnitAmount * (1 - discountRatio)) : originalUnitAmount;

      return {
        ...item,
        originalUnitAmount,
        discountedUnitAmount,
        finalItemTotal: (discountedUnitAmount * item.quantity) / 100
      };
    });

    const stripeTotalCents = stripeItems.reduce((sum, item) =>
      sum + (item.discountedUnitAmount * item.quantity), 0);

    res.json({
      success: true,
      cartSummary: {
        subtotalAmount,
        discountAmount,
        totalAmount,
        hasDiscount: discountAmount > 0
      },
      discountDetails,
      itemDetails,
      stripeCalculation: {
        discountRatio,
        stripeItems,
        stripeTotalCents,
        stripeTotalDollars: stripeTotalCents / 100,
        calculationMatches: Math.abs(totalAmount - (stripeTotalCents / 100)) < 0.01
      }
    });
  } catch (err) {
    console.error("Debug discount error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Debug endpoint to check product prices
router.get("/debug/products", async (req, res) => {
  try {
    const products = await Product.find().limit(10).select('title price _id');

    const productInfo = products.map(product => ({
      id: product._id,
      title: product.title,
      price: product.price,
      priceType: typeof product.price,
      isValid: !isNaN(product.price) && product.price > 0,
      unitAmount: Math.round(Number(product.price || 0) * 100)
    }));

    res.json({
      success: true,
      products: productInfo,
      totalProducts: products.length
    });
  } catch (err) {
    console.error("Debug products error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
// End of consolidated deletion routes

// Helper function to calculate coupon discount (moved here for reuse)
async function calculateCouponDiscount(cart, coupon) {
  let discount = 0;

  if (coupon.categoryWise && coupon.selectedCategory.length > 0) {
    // Category-specific discount
    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (product && coupon.selectedCategory.some(cat => cat.categoryName === product.category)) {
        const itemTotal = product.price * item.quantity;
        if (coupon.discountType === 'Percentage') {
          discount += itemTotal * (coupon.discountValue / 100);
        } else {
          discount += coupon.discountValue;
        }
      }
    }
  } else if (coupon.productWise && coupon.selectedProducts.length > 0) {
    // Product-specific discount
    for (const item of cart.items) {
      const isSelectedProduct = coupon.selectedProducts.some(prod =>
        prod.productObjectId.toString() === item.productId.toString()
      );

      if (isSelectedProduct) {
        const product = await Product.findById(item.productId);
        if (product) {
          const itemTotal = product.price * item.quantity;
          if (coupon.discountType === 'Percentage') {
            discount += itemTotal * (coupon.discountValue / 100);
          } else {
            discount += coupon.discountValue;
          }
        }
      }
    }
  } else {
    // General discount on entire cart
    if (coupon.discountType === 'Percentage') {
      discount = cart.subtotal * (coupon.discountValue / 100);
    } else {
      discount = coupon.discountValue;
    }
  }

  return Math.min(discount, cart.subtotal); // Don't exceed subtotal
}

// Cancel pending checkout and restore cart availability
router.post("/cancel-pending-checkout", async (req, res) => {
  try {
    const { sessionId, userId, checkoutSessionId } = req.body;

    if (!sessionId && !userId) {
      return res.status(400).json({
        success: false,
        message: "Session ID or User ID is required"
      });
    }

    // Find the cart
    const query = { isCheckedOut: false };
    if (userId) query.userId = userId;
    if (sessionId) query.sessionId = sessionId;

    const cart = await Cart.findOne(query);

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found"
      });
    }

    if (!cart.pendingCheckoutSessionId) {
      return res.status(400).json({
        success: false,
        message: "No pending checkout found for this cart"
      });
    }

    // Optionally verify the checkout session ID matches
    if (checkoutSessionId && cart.pendingCheckoutSessionId !== checkoutSessionId) {
      return res.status(400).json({
        success: false,
        message: "Checkout session ID does not match"
      });
    }

    // Clear the pending checkout session
    cart.pendingCheckoutSessionId = undefined;
    cart.updatedOn = new Date();
    await cart.save();

    res.json({
      success: true,
      message: "Pending checkout cancelled. Cart is now available for modification.",
      cart: {
        items: cart.items,
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total,
        itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        coupon: cart.coupon,
        isAvailable: true
      }
    });

  } catch (err) {
    console.error("Cancel pending checkout error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to cancel pending checkout",
      error: err.message
    });
  }
});

// New Checkout Endpoint - Checkout with Card Payment
router.post("/checkout-with-payment", async (req, res) => {
  try {
    const {
      sessionId,
      userId,
      shippingDetails,
      billingAddress,
      shippingAddress,
      cardDetails,
      paymentMethod = 'card' // 'card' or 'affirm'
    } = req.body;

    // === VALIDATION ===

    // 1. Basic validation
    if (!sessionId || !userId) {
      return res.status(400).json({
        success: false,
        error: "SessionId and userId are required"
      });
    }

    // 2. Payment method validation
    if (!['card', 'affirm'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment method. Must be 'card' or 'affirm'"
      });
    }

    // 3. Card details validation (only for card payment)
    if (paymentMethod === 'card') {
      if (!cardDetails) {
        return res.status(400).json({
          success: false,
          error: "Card details are required for card payment"
        });
      }

      const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName } = cardDetails;

      // Card number validation
      if (!cardNumber || !/^\d{13,19}$/.test(cardNumber.replace(/\s/g, ''))) {
        return res.status(400).json({
          success: false,
          error: "Invalid card number. Must be 13-19 digits"
        });
      }

      // Expiry validation
      if (!expiryMonth || !expiryYear) {
        return res.status(400).json({
          success: false,
          error: "Card expiry month and year are required"
        });
      }

      const expMonth = parseInt(expiryMonth);
      const expYear = parseInt(expiryYear);
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      if (expMonth < 1 || expMonth > 12) {
        return res.status(400).json({
          success: false,
          error: "Invalid expiry month. Must be between 1 and 12"
        });
      }

      if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
        return res.status(400).json({
          success: false,
          error: "Card has expired"
        });
      }

      // CVV validation
      if (!cvv || !/^\d{3,4}$/.test(cvv)) {
        return res.status(400).json({
          success: false,
          error: "Invalid CVV. Must be 3 or 4 digits"
        });
      }

      // Cardholder name validation
      if (!cardholderName || cardholderName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: "Cardholder name is required"
        });
      }
    }

    // 4. Billing address validation
    if (!billingAddress) {
      return res.status(400).json({
        success: false,
        error: "Billing address is required"
      });
    }

    const requiredBillingFields = ['firstName', 'lastName', 'address1', 'city', 'state', 'zipCode', 'country'];
    for (const field of requiredBillingFields) {
      if (!billingAddress[field] || billingAddress[field].trim() === '') {
        return res.status(400).json({
          success: false,
          error: `Billing address ${field} is required`
        });
      }
    }

    // Email and phone validation
    if (!billingAddress.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingAddress.email)) {
      return res.status(400).json({
        success: false,
        error: "Valid billing email is required"
      });
    }

    if (!billingAddress.phone || !/^\+?[\d\s\-()]{10,}$/.test(billingAddress.phone)) {
      return res.status(400).json({
        success: false,
        error: "Valid billing phone number is required"
      });
    }

    // Zip code validation for US
    if (billingAddress.country.toUpperCase() === 'US' && !/^\d{5}(-\d{4})?$/.test(billingAddress.zipCode)) {
      return res.status(400).json({
        success: false,
        error: "Invalid US zip code format"
      });
    }

    // 5. Shipping address validation
    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        error: "Shipping address is required"
      });
    }

    const requiredShippingFields = ['firstName', 'lastName', 'address1', 'city', 'state', 'zipCode', 'country'];
    for (const field of requiredShippingFields) {
      if (!shippingAddress[field] || shippingAddress[field].trim() === '') {
        return res.status(400).json({
          success: false,
          error: `Shipping address ${field} is required`
        });
      }
    }

    // Shipping phone validation
    if (!shippingAddress.phone || !/^\+?[\d\s\-()]{10,}$/.test(shippingAddress.phone)) {
      return res.status(400).json({
        success: false,
        error: "Valid shipping phone number is required"
      });
    }

    // Zip code validation for US shipping
    if (shippingAddress.country.toUpperCase() === 'US' && !/^\d{5}(-\d{4})?$/.test(shippingAddress.zipCode)) {
      return res.status(400).json({
        success: false,
        error: "Invalid US shipping zip code format"
      });
    }

    // === CART PROCESSING ===

    // Find cart and populate customer data
    const cart = await Cart.findOne({
      sessionId,
      userId,
      isCheckedOut: false
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        error: "Cart not found"
      });
    }

    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Cart is empty"
      });
    }

    // Get user data
    const customer = await User.findById(userId);

    console.log(`\n=== CHECKOUT WITH PAYMENT ===`);
    console.log(`User: ${customer?.name || customer?.email}`);
    console.log(`Payment Method: ${paymentMethod}`);
    console.log(`Cart Items: ${cart.items.length}`);

    // Auto-apply category coupons if no coupon is applied
    if (!cart.coupon || !cart.coupon.code) {
      await autoApplyCategoryCoupons(cart, Product);
      const updatedCart = await Cart.findById(cart._id);
      if (updatedCart && updatedCart.coupon && updatedCart.coupon.code) {
        cart.coupon = updatedCart.coupon;
        console.log("Auto-applied coupon:", cart.coupon);
      }
    }

    // Calculate cart totals with variant pricing
    const updatedItems = [];
    let subtotalAmount = 0;

    for (let item of cart.items) {
      const product = await Jewelry.findById(item.productId);
      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Product not found: ${item.productId}`
        });
      }

      let finalPrice = item.priceAtTime || product.price;

      // Calculate variant-specific pricing if metaldetail is selected
      if (item.selectedVariant?.selectedOptions?.metaldetail && product.availableMetals) {
        const selectedMetalId = item.selectedVariant.selectedOptions.metaldetail;
        const selectedMetal = product.availableMetals.find(m =>
          m.metal && m.metal.toString() === selectedMetalId.toString()
        );

        if (selectedMetal && selectedMetal.price) {
          finalPrice = selectedMetal.price;
        }
      }

      if (!finalPrice || isNaN(finalPrice) || finalPrice <= 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid price for product: ${product.title || product._id}`
        });
      }

      item.priceAtTime = finalPrice;
      const itemTotal = finalPrice * item.quantity;
      subtotalAmount += itemTotal;

      updatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtTime: finalPrice,
        selectedVariant: item.selectedVariant,
        engravingOptions: item.engravingOptions,
        productDetails: {
          title: product.title || product.name,
          name: product.name || product.title,
          description: product.description,
          images: product.images || [],
          category: product.category,
          material: product.material,
          price: finalPrice
        },
        imageUrl: (product.images && product.images.length > 0) ? product.images[0] : null
      });
    }

    // Apply coupon discount
    let totalAmount = subtotalAmount;
    let discountAmount = 0;
    let coupon = null;

    if (cart.coupon && cart.coupon.code) {
      coupon = await Coupon.findOne({
        couponCode: cart.coupon.code,
        isActive: true
      });

      if (coupon) {
        const isValidCoupon = await validateCouponForCart(coupon, cart, Product);

        if (isValidCoupon.valid) {
          if (coupon.discountType === 'Percentage') {
            discountAmount = (subtotalAmount * coupon.discountValue) / 100;
          } else if (coupon.discountType === 'Flat') {
            discountAmount = Math.min(coupon.discountValue, subtotalAmount);
          }

          // Round discount and total to 2 decimal places to avoid floating-point artifacts
          discountAmount = Math.round(discountAmount * 100) / 100;
          totalAmount = Math.round((subtotalAmount - discountAmount) * 100) / 100;
          
          cart.coupon.discountAmount = discountAmount;
        }
      }
    }

    console.log(`Subtotal: $${subtotalAmount.toFixed(2)}`);
    console.log(`Discount: $${discountAmount.toFixed(2)}`);
    console.log(`Total: $${totalAmount.toFixed(2)}`);

    // === STRIPE PAYMENT PROCESSING ===

    let paymentIntentId = null;
    let paymentMethodId = null;
    let last4 = null;
    let cardBrand = null;

    if (paymentMethod === 'card') {
      // Create Stripe payment method with card details
      try {
        const rawNumber = (cardDetails.cardNumber || '').toString();
        const isTestToken = rawNumber.startsWith('tok_');
        const isPaymentMethodId = rawNumber.startsWith('pm_');

        // Validate total amount before calling Stripe
        const stripeAmount = Math.round(Number(totalAmount) * 100);
        if (!Number.isFinite(stripeAmount) || isNaN(stripeAmount)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid total amount for payment'
          });
        }

        let paymentMethodResponse;

        // Handle Stripe test tokens (tok_...) or pre-created payment method IDs (pm_...)
        if (isTestToken) {
          paymentMethodResponse = await stripe.paymentMethods.create({
            type: 'card',
            card: { token: rawNumber },
            billing_details: {
              name: cardDetails.cardholderName,
              email: billingAddress.email,
              phone: billingAddress.phone
            }
          });
        } else if (isPaymentMethodId) {
          // Use existing payment method ID
          paymentMethodResponse = await stripe.paymentMethods.retrieve(rawNumber);
        } else {
          // Parse expiry month/year and validate
          const expMonth = parseInt(cardDetails.expiryMonth, 10);
          const expYear = parseInt(cardDetails.expiryYear, 10);

          if (isNaN(expMonth) || isNaN(expYear)) {
            return res.status(400).json({
              success: false,
              error: 'Invalid card expiry month or year'
            });
          }

          paymentMethodResponse = await stripe.paymentMethods.create({
            type: 'card',
            card: {
              number: rawNumber.replace(/\s/g, ''),
              exp_month: expMonth,
              exp_year: expYear,
              cvc: cardDetails.cvv
            },
            billing_details: {
              name: cardDetails.cardholderName,
              email: billingAddress.email,
              phone: billingAddress.phone,
              address: {
                line1: billingAddress.address1,
                line2: billingAddress.address2 || null,
                city: billingAddress.city,
                state: billingAddress.state,
                postal_code: billingAddress.zipCode,
                country: billingAddress.country
              }
            }
          });
        }

        paymentMethodId = paymentMethodResponse.id;
        last4 = paymentMethodResponse.card?.last4 || null;
        cardBrand = paymentMethodResponse.card?.brand || null;

        console.log(`Payment Method Created: ${paymentMethodId} (${cardBrand} ending in ${last4})`);

        // Create payment intent - ensure amount is valid integer cents
        const paymentIntent = await stripe.paymentIntents.create({
          amount: stripeAmount, // integer cents
          currency: 'usd',
          payment_method: paymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never'
          },
          metadata: {
            cartId: cart._id.toString(),
            userId: userId.toString(),
            sessionId: sessionId,
            subtotal: subtotalAmount.toFixed(2),
            discount: discountAmount.toFixed(2),
            total: totalAmount.toFixed(2),
            couponCode: cart.coupon?.code || 'none'
          },
          description: `Order for ${customer?.name || billingAddress.firstName + ' ' + billingAddress.lastName}`,
          receipt_email: billingAddress.email,
          shipping: {
            name: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
            phone: shippingAddress.phone,
            address: {
              line1: shippingAddress.address1,
              line2: shippingAddress.address2 || null,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postal_code: shippingAddress.zipCode,
              country: shippingAddress.country
            }
          }
        });

        paymentIntentId = paymentIntent.id;

        console.log(`Payment Intent Created: ${paymentIntentId} - Status: ${paymentIntent.status}`);

        if (paymentIntent.status !== 'succeeded') {
          return res.status(400).json({
            success: false,
            error: "Payment failed. Please check your card details and try again.",
            paymentStatus: paymentIntent.status
          });
        }

      } catch (stripeError) {
        console.error("Stripe payment error:", stripeError);
        return res.status(400).json({
          success: false,
          error: stripeError.message || "Payment processing failed",
          type: stripeError.type
        });
      }
    } else if (paymentMethod === 'affirm') {
      // For Affirm, we'll create a checkout session similar to the original implementation
      try {
        const sessionConfig = {
          payment_method_types: ["affirm"],
          line_items: updatedItems.map(item => ({
            price_data: {
              currency: "usd",
              product_data: {
                name: item.productDetails.title,
                description: item.productDetails.description,
                images: Array.isArray(item.productDetails.images) ? item.productDetails.images.slice(0, 8) : []
              },
              unit_amount: Math.round(item.priceAtTime * 100)
            },
            quantity: item.quantity
          })),
          mode: "payment",
          success_url: `${PAYMENT_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${PAYMENT_CANCEL_URL}?session_id={CHECKOUT_SESSION_ID}`,
          customer_email: billingAddress.email,
          metadata: {
            cartId: cart._id.toString(),
            userId: userId.toString(),
            sessionId: sessionId,
            paymentMethod: 'affirm'
          }
        };

        const session = await stripe.checkout.sessions.create(sessionConfig);

        // For Affirm, return the checkout URL
        return res.json({
          success: true,
          paymentMethod: 'affirm',
          checkoutUrl: session.url,
          sessionId: session.id,
          message: "Redirecting to Affirm checkout..."
        });

      } catch (stripeError) {
        console.error("Affirm checkout error:", stripeError);
        return res.status(400).json({
          success: false,
          error: stripeError.message || "Affirm checkout creation failed"
        });
      }
    }

    // === BUILD SUB-ORDERS ===
    const orderSubOrders = [];
    let maxDeliveryDays = 5; // default
    for (const item of updatedItems) {
      const product = await Jewelry.findById(item.productId).lean();
      // Fully dynamic: uses whatever value is in the database for this product
      const productDeliveryDays = product?.estimatedDeliveryDays || 5;
      
      if (productDeliveryDays > maxDeliveryDays) maxDeliveryDays = productDeliveryDays;
      
      orderSubOrders.push({
        subOrderId: generateSubOrderId(),
        productId: item.productId,
        quantity: item.quantity,
        type: product?.type || 'Premade',
        priceAtTime: item.priceAtTime,
        imageUrl: item.imageUrl,
        productDetails: item.productDetails,
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

    // === CREATE ORDER ===

    const order = new Order({
      orderId: generateOrderId(),
      referenceId: require('uuid').v1(),
      customer: userId,
      products: updatedItems,
      subOrders: orderSubOrders,
      total: totalAmount,
      subtotal: subtotalAmount,
      discount: discountAmount,
      coupon: cart.coupon || null,
      expectedDeliveryDate,
      shippingDetails: shippingDetails || {
        estimatedDeliveryDays: maxDeliveryDays,
        shippingMethod: 'Standard',
        shippingCost: 0
      },
      paymentMethod: paymentMethod,
      status: 'Confirmed',
      paymentStatus: 'paid',
      paymentDetails: {
        stripePaymentIntentId: paymentIntentId,
        paymentMethod: paymentMethod,
        amountPaid: totalAmount,
        currency: 'usd',
        paymentStatus: 'succeeded',
        paymentConfirmedAt: new Date(),

        // Card details (only last 4 and brand, NEVER full number)
        cardLast4: last4,
        cardBrand: cardBrand,

        // Billing address
        billingAddress: {
          line1: billingAddress.address1,
          line2: billingAddress.address2 || null,
          city: billingAddress.city,
          state: billingAddress.state,
          postal_code: billingAddress.zipCode,
          country: billingAddress.country
        },

        // Shipping address
        shippingAddress: {
          line1: shippingAddress.address1,
          line2: shippingAddress.address2 || null,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postal_code: shippingAddress.zipCode,
          country: shippingAddress.country
        },

        // Customer details
        customerEmail: billingAddress.email,
        customerName: `${billingAddress.firstName} ${billingAddress.lastName}`,
        customerPhone: billingAddress.phone,

        paymentSource: 'direct_card_payment'
      },
      customerData: {
        email: billingAddress.email,
        name: `${billingAddress.firstName} ${billingAddress.lastName}`,
        phone: billingAddress.phone
      },
      createdBy: userId,
      updatedBy: userId,
      createdOn: new Date(),
      updatedOn: new Date()
    });

    await order.save();

    console.log(`Order Created: ${order.orderId}`);

    // Mark cart as checked out
    cart.isCheckedOut = true;
    cart.updatedOn = new Date();
    await cart.save();

    // Send confirmation email
    if (customer && customer.email) {
      try {
        await emailService.sendEmail(
          customer.email,
          `Order Confirmation #${order.orderId} - Celora Jewelry`,
          'order-confirmed-new',
          {
            customerName: billingAddress.firstName || customer.name || 'Valued Customer',
            orderId: order.orderId,
            orderDate: new Date().toLocaleDateString(),
            formattedTotal: '$' + totalAmount.toFixed(2),
            subtotal: '$' + subtotalAmount.toFixed(2),
            discount: discountAmount > 0 ? '$' + discountAmount.toFixed(2) : null,
            couponCode: cart.coupon?.code || null,
            status: 'Confirmed',
            products: updatedItems.map(item => ({
              productTitle: item.productDetails.title,
              quantity: item.quantity,
              formattedPrice: '$' + item.priceAtTime.toFixed(2),
              formattedItemTotal: '$' + (item.priceAtTime * item.quantity).toFixed(2)
            })),
            shippingAddress: `${shippingAddress.address1}, ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zipCode}`,
            trackOrderUrl: `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/track-order/${order.orderId}`
          }
        );
        console.log("Confirmation email sent");
      } catch (emailError) {
        console.error("Email error:", emailError);
      }
    }

    res.json({
      success: true,
      message: "Order placed successfully",
      order: {
        orderId: order.orderId,
        total: totalAmount,
        subtotal: subtotalAmount,
        discount: discountAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: paymentMethod,
        cardLast4: last4,
        cardBrand: cardBrand
      },
      billingAddress: {
        firstName: billingAddress.firstName,
        lastName: billingAddress.lastName,
        address1: billingAddress.address1,
        city: billingAddress.city,
        state: billingAddress.state,
        zipCode: billingAddress.zipCode,
        country: billingAddress.country
      },
      shippingAddress: {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        address1: shippingAddress.address1,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zipCode: shippingAddress.zipCode,
        country: shippingAddress.country
      }
    });

  } catch (err) {
    console.error("Checkout with payment error:", err);
    res.status(500).json({
      success: false,
      error: "Checkout failed",
      details: err.message
    });
  }
});

module.exports = router;
