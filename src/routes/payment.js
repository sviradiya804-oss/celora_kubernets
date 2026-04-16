const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const mongoose = require("mongoose");
const Schema = require('../models/schema.js');
const emailService = require('../utils/emailService');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const { uploadToAzureBlob } = require('../services/azureStorageService');
const authMiddleware = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/permissionMiddleware');
const { calculateCartSummary } = require('../utils/cartHelper');

// Custom middleware to check payment admin permissions
const checkPaymentAdminPermission = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'No user found in request'
      });
    }

    // Get the user with populated role
    const User = require('../models/User');
    const populatedUser = await User.findById(req.user._id).populate('role');

    if (!populatedUser) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: User not found',
        userId: req.user._id
      });
    }

    if (!populatedUser.role) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No role assigned to user',
        userId: populatedUser._id,
        userEmail: populatedUser.email
      });

      // Public order tracking endpoint - returns concise tracking & payment info
      router.get("/track-order/:orderId", async (req, res) => {
        try {
          const { orderId } = req.params;
          const order = await Order.findOne({ orderId })
            .select('orderId status paymentStatus total progress invoicePath paymentDetails products createdOn updatedOn')
            .populate('customer', 'firstName lastName email');

          if (!order) {
            return res.status(404).json({
              success: false,
              message: 'Order not found'
            });
          }

          const trackingId = order.progress?.outForDelivery?.trackingId || order.progress?.trackingId || null;
          const trackingLink = order.progress?.outForDelivery?.trackingLink || null;

          return res.json({
            success: true,
            tracking: {
              orderId: order.orderId,
              status: order.status,
              paymentStatus: order.paymentStatus,
              total: order.total,
              createdOn: order.createdOn,
              updatedOn: order.updatedOn,
              trackingId,
              trackingLink,
              progress: order.progress || {},
              invoiceUrl: order.invoicePath || null,
              itemCount: order.subOrders?.length || 0
            }
          });
        } catch (error) {
          console.error('Track order error:', error);
          return res.status(500).json({
            success: false,
            message: 'Failed to fetch tracking info',
            error: error.message
          });
        }
      });
    }

    const rolePermissions = populatedUser.role.permissions;

    if (!Array.isArray(rolePermissions)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Invalid role permissions structure',
        roleName: populatedUser.role.name,
        roleId: populatedUser.role._id
      });
    }

    // Check if user has admin permission on payments resource
    const paymentPermissions = rolePermissions.filter(p => p.resource === 'payments');
    const hasPaymentAdminPermission = paymentPermissions.some((permission) => {
      return Array.isArray(permission.actions) && permission.actions.includes('admin');
    });

    if (!hasPaymentAdminPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Payment admin permission required',
        requiredPermission: 'payments:admin',
        userRole: populatedUser.role.name,
        availablePaymentActions: paymentPermissions.length > 0 ? paymentPermissions[0].actions : [],
        debug: {
          userId: populatedUser._id,
          roleId: populatedUser.role._id,
          roleName: populatedUser.role.name
        }
      });
    }

    // Add user info to request for use in the route
    req.authenticatedUser = populatedUser;
    next();
  } catch (error) {
    console.error('Error in payment admin permission check:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during permission check',
      error: error.message
    });
  }
};

require("dotenv").config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Payment redirect URLs
const PAYMENT_SUCCESS_URL = process.env.PAYMENT_SUCCESS_URL || 'https://celorajewelry.com/payment-success/thankyou';
const PAYMENT_CANCEL_URL = process.env.PAYMENT_CANCEL_URL || 'https://celorajewelry.com/payment-cancel';

// Debug endpoint to check user permissions (for development/testing)
router.get("/debug/permissions", authMiddleware.protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const populatedUser = await User.findById(req.user._id).populate('role');

    if (!populatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const roleInfo = {
      userId: populatedUser._id,
      userEmail: populatedUser.email,
      roleName: populatedUser.role?.name || 'No role assigned',
      roleId: populatedUser.role?._id,
      permissions: populatedUser.role?.permissions || [],
      paymentPermissions: populatedUser.role?.permissions?.filter(p => p.resource === 'payments') || [],
      hasPaymentAdminPermission: populatedUser.role?.permissions?.some(p =>
        p.resource === 'payments' && p.actions?.includes('admin')
      ) || false
    };

    res.json({
      success: true,
      message: "User permission debug info",
      data: roleInfo
    });

  } catch (error) {
    console.error("Permission debug error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get permission info",
      error: error.message
    });
  }
});

// Configure multer to store files in memory for Azure upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png' && ext !== '.gif') {
    return cb(new Error('Only image files are allowed'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Create models using your schema system
const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', Schema.cart, 'carts');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', Schema.jewelry, 'jewelrys');
const Product = mongoose.models.productModel || mongoose.model('productModel', Schema.product, 'products');

const FlatDiscount = mongoose.models.flatDiscountModel || mongoose.model('flatDiscountModel', new mongoose.Schema(Schema.flatdiscount), 'flatdiscounts');

// Redundant computeCartTotal removed. Using unified src/utils/cartHelper.js instead.

// Create a robust PaymentIntent for Checkout (Server-side calculation)
router.post("/create-checkout-intent", async (req, res) => {
  try {
    const { cartId, userId, currency = "usd" } = req.body; // or get userId from req.user

    // 1. Validate User/Cart
    let query = { isCheckedOut: { $ne: true } }; // Only find active carts
    if (cartId) query._id = cartId;
    else if (userId) query.userId = userId;
    else if (req.user) query.userId = req.user._id;

    if (Object.keys(query).length === 1) { // Only isCheckedOut filter, no user/cart ID
      return res.status(400).json({ error: "Cart ID or User ID required" });
    }

    // Find the most recent active cart
    const cart = await Cart.findOne(query).sort({ updatedOn: -1 });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }


    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // 2. Calculate Amount Securely (Unified Logic)
    const summary = await calculateCartSummary(cart);
    const amountInCents = Math.round(summary.total * 100);

    if (amountInCents < 50) { // Stripe minimum is usually around 50 cents
      return res.status(400).json({ error: "Order amount too low" });
    }

    const stripeCurrency = currency.toLowerCase();

    // 3. Create or Update PaymentIntent
    // If cart has an existing intent that is incomplete, we could reuse it, 
    // but often safer to create new or update if ID exists.

    // Determine valid payment methods based on currency
    let validPaymentMethods = ['card'];
    if (stripeCurrency === 'usd') {
      validPaymentMethods = ['card', 'affirm', 'cashapp', 'amazon_pay'];
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: stripeCurrency,
      payment_method_types: validPaymentMethods,
      metadata: {
        cartId: cart._id.toString(),
        userId: cart.userId ? cart.userId.toString() : (userId || 'guest'),
        orderId: `ORD-${Date.now()}` // Temporary reference
      }
    });

    // 4. Return Client Secret
    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: amountInCents / 100,
      currency: stripeCurrency,
      cartItemCount: cart.items.length,
      summary: {
        subtotal: summary.subtotal,
        flatDiscountAmount: summary.flatDiscountAmount,
        couponDiscountAmount: summary.couponDiscountAmount,
        totalDiscount: summary.totalDiscount,
        total: summary.total
      }
    });

  } catch (error) {
    console.error("Checkout Intent Error:", error);
    res.status(500).json({ error: error.message });
  }
});


// Create a PaymentIntent
router.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, currency = "usd" } = req.body;

    if (!amount) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const stripeCurrency = currency.toLowerCase();

    // Determine valid payment methods based on currency
    let validPaymentMethods = ['card'];
    if (stripeCurrency === 'usd') {
      validPaymentMethods = ['card', 'affirm', 'cashapp', 'amazon_pay'];
    }

    // Create the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: stripeCurrency,
      payment_method_types: validPaymentMethods,
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Stripe error:", error);
    res.status(500).json({ error: error.message });
  }
});
// Refund payment
router.post("/refund", async (req, res) => {
  try {
    const { paymentIntentId, amount } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: "paymentIntentId is required" });
    }

    // Retrieve the PaymentIntent to get the latest charge ID
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const chargeId = paymentIntent.charges.data[0].id;

    // Create the refund
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: amount, // optional, in cents. Omit for full refund
    });

    res.json({
      success: true,
      refund,
    });
  } catch (error) {
    console.error("Refund error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook endpoint for handling payment events
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Check if webhook secret is configured
  if (!endpointSecret) {
    console.error("❌ STRIPE_WEBHOOK_SECRET is not set in environment variables!");
    console.error("   Please add STRIPE_WEBHOOK_SECRET to your .env file");
    console.error("   Current env check:", {
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      nodeEnv: process.env.NODE_ENV
    });
    return res.status(500).send("Webhook Error: STRIPE_WEBHOOK_SECRET not configured");
  }

  let event;
  let rawBody = req.body;

  console.log("Received webhook - raw body type:", typeof req.body);
  console.log("Received webhook - is Buffer:", Buffer.isBuffer(req.body));

  // Handle the case where Express serializes Buffer as {type: 'Buffer', data: [...]}
  if (typeof req.body === 'object' && req.body.type === 'Buffer' && Array.isArray(req.body.data)) {
    rawBody = Buffer.from(req.body.data);
    console.log("✅ Reconstructed Buffer from serialized data");
  }

  console.log("Final body type:", typeof rawBody);
  console.log("Final body is Buffer:", Buffer.isBuffer(rawBody));

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    console.log("✅ Signature verification successful");
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`Received webhook event: ${event.type}`);

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      case "charge.dispute.created":
        await handleChargeDispute(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error handling webhook event ${event.type}:`, error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }

  res.json({ received: true });
});

// Handle successful checkout session completion
async function handleCheckoutSessionCompleted(session) {
  console.log("Processing checkout session completed:", session.id);

  try {
    // Find the order using session ID
    const order = await Order.findOne({ stripeSessionId: session.id });
    if (!order) {
      console.error("Order not found for session:", session.id);
      return;
    }

    // Update order status to confirmed
    order.status = "Confirmed";
    order.paymentStatus = "paid";

    // Update progress safely
    if (!order.progress) order.progress = {};
    order.progress.confirmed = {
      date: new Date(),
      status: "Payment confirmed successfully"
    };
    order.markModified('progress');

    order.updatedOn = new Date();
    order.updatedBy = order.customer;

    // Get payment intent details from Stripe for comprehensive payment information
    let paymentIntentDetails = null;
    if (session.payment_intent) {
      try {
        paymentIntentDetails = await stripe.paymentIntents.retrieve(session.payment_intent);
        console.log("Retrieved payment intent details:", paymentIntentDetails.id);
      } catch (error) {
        console.error("Failed to retrieve payment intent details:", error);
      }
    }

    // Add comprehensive payment details
    order.paymentDetails = {
      stripeSessionId: session.id,
      stripePaymentIntentId: session.payment_intent || paymentIntentDetails?.id,
      amountPaid: session.amount_total / 100, // Convert from cents
      currency: session.currency,
      paymentStatus: session.payment_status,
      paymentMethod: session.payment_method_types[0] || 'card',

      // Additional payment information
      paymentCreatedAt: paymentIntentDetails ? new Date(paymentIntentDetails.created * 1000) : new Date(),
      paymentConfirmedAt: new Date(),

      // Stripe payment intent details
      paymentIntentStatus: paymentIntentDetails?.status,
      paymentIntentAmount: paymentIntentDetails ? paymentIntentDetails.amount / 100 : session.amount_total / 100,
      paymentIntentCurrency: paymentIntentDetails?.currency || session.currency,

      // Customer details from session
      customerStripeId: session.customer,
      customerEmail: session.customer_details?.email,
      customerName: session.customer_details?.name,
      customerPhone: session.customer_details?.phone,

      // Billing details
      billingAddress: session.customer_details?.address ? {
        line1: session.customer_details.address.line1,
        line2: session.customer_details.address.line2,
        city: session.customer_details.address.city,
        state: session.customer_details.address.state,
        postal_code: session.customer_details.address.postal_code,
        country: session.customer_details.address.country
      } : null,

      // Shipping details
      shippingAddress: session.shipping_details?.address ? {
        line1: session.shipping_details.address.line1,
        line2: session.shipping_details.address.line2,
        city: session.shipping_details.address.city,
        state: session.shipping_details.address.state,
        postal_code: session.shipping_details.address.postal_code,
        country: session.shipping_details.address.country
      } : null,

      // Payment method details (if available)
      paymentMethodDetails: paymentIntentDetails?.charges?.data?.[0]?.payment_method_details || null,

      // Transaction fees and net amount
      applicationFee: paymentIntentDetails?.application_fee_amount ? paymentIntentDetails.application_fee_amount / 100 : null,
      stripeFee: paymentIntentDetails?.charges?.data?.[0]?.balance_transaction ? 'Will be calculated' : null,

      // Metadata
      sessionMetadata: session.metadata || {},
      paymentIntentMetadata: paymentIntentDetails?.metadata || {},

      // Receipt information
      receiptEmail: paymentIntentDetails?.receipt_email || session.customer_details?.email,
      receiptUrl: paymentIntentDetails?.charges?.data?.[0]?.receipt_url,

      // Risk assessment
      riskLevel: paymentIntentDetails?.charges?.data?.[0]?.outcome?.risk_level,
      riskScore: paymentIntentDetails?.charges?.data?.[0]?.outcome?.risk_score
    };

    await order.save();

    console.log("Order confirmed successfully:", order.orderId);

    // Get customer details for email
    const customer = await User.findById(order.customer);
    if (customer && customer.email) {
      // Prepare items data for email template from subOrders
      const emailProducts = (order.subOrders || []).map((sub, index) => ({
        productId: sub.productId,
        productTitle: sub.productDetails?.title || sub.productDetails?.name || `Jewelry Item ${index + 1}`,
        productDescription: sub.productDetails?.description || '',
        productCategory: sub.productDetails?.category || '',
        productMaterial: sub.productDetails?.material || '',
        productVariant: sub.productDetails?.selectedVariant || '',
        productQuantity: sub.quantity || 1,
        multipleQuantity: (sub.quantity || 1) > 1,
        formattedPrice: '$' + (sub.priceAtTime || sub.productDetails?.price || 0).toFixed(2),
        formattedItemTotal: '$' + ((sub.priceAtTime || sub.productDetails?.price || 0) * (sub.quantity || 1)).toFixed(2),
        price: sub.priceAtTime || sub.productDetails?.price || 0,
        quantity: sub.quantity || 1,
        images: sub.imageUrl ? [sub.imageUrl] : (sub.productDetails?.images || [])
      }));

      console.log("Sending email with products:", emailProducts.length);

      // Send order confirmation email with properly formatted data
      await emailService.sendEmail(
        customer.email,
        `Order Confirmation #${order.orderId} - Celora Jewelry`,
        'order-confirmed-new',
        {
          customerName: customer.firstName || customer.name || 'Valued Customer',
          orderId: order.orderId,
          orderDate: new Date(order.createdOn).toLocaleDateString(),
          formattedTotal: '$' + order.total.toFixed(2),
          subtotal: '$' + (order.subtotal || order.total).toFixed(2),
          discount: order.discount ? '$' + order.discount.toFixed(2) : null,
          couponCode: order.couponCode || null,
          status: order.status,
          newStatus: 'Confirmed',

          // Customer details
          customerDetails: {
            name: customer.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : customer.name,
            email: customer.email,
            phone: customer.phone || session.customer_details?.phone || null,
            address: session.shipping_details ?
              `${session.shipping_details.address.line1}${session.shipping_details.address.line2 ? ', ' + session.shipping_details.address.line2 : ''}, ${session.shipping_details.address.city}, ${session.shipping_details.address.state} ${session.shipping_details.address.postal_code}, ${session.shipping_details.address.country}` :
              null
          },

          // Payment information
          paymentInfo: {
            method: session.payment_method_types[0] === 'card' ? 'Credit/Debit Card' : session.payment_method_types[0],
            amountPaid: '$' + (session.amount_total / 100).toFixed(2),
            status: 'Paid Successfully'
          },

          // Products data formatted for template
          products: emailProducts,
          hasProducts: emailProducts.length > 0,
          hasMultipleProducts: emailProducts.length > 1,
          productCount: emailProducts.length,

          // Company details
          companyName: 'Celora Jewelry',
          currentYear: new Date().getFullYear(),

          // Track order URL
          trackOrderUrl: `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/track-order/${order.orderId}`,

          trackingInfo: 'Your order is being processed and you will receive tracking information soon.'
        }
      );

      console.log("Order confirmation email sent to:", customer.email);

      // Generate and send invoice PDF - with enhanced error handling and retry logic
      try {
        console.log("Starting invoice generation process for order:", order.orderId);

        const { generateInvoiceToAzure } = require('../utils/generateInvoiceFromHTML');

        // Prepare comprehensive order data for invoice
        const enhancedOrder = {
          ...order.toObject(),
          customer: customer,
          customerData: {
            name: customer.firstName ? `${customer.firstName} ${customer.lastName || ''}`.trim() : customer.name,
            email: customer.email,
            phone: customer.phone || session.customer_details?.phone || null
          },
          shippingAddress: session.shipping_details ?
            `${session.shipping_details.address.line1}${session.shipping_details.address.line2 ? ', ' + session.shipping_details.address.line2 : ''}, ${session.shipping_details.address.city}, ${session.shipping_details.address.state} ${session.shipping_details.address.postal_code}, ${session.shipping_details.address.country}` :
            null,
          paymentDetails: {
            ...order.paymentDetails,
            paymentMethod: session.payment_method_types[0] === 'card' ? 'Credit/Debit Card' : session.payment_method_types[0],
            createdOn: new Date(),
            stripeSessionId: session.id,
            transactionId: session.payment_intent || session.id
          }
        };

        console.log("Generating PDF invoice...");

        // Generate PDF and upload to Azure
        const invoiceResult = await generateInvoiceToAzure(enhancedOrder);

        if (!invoiceResult || !invoiceResult.buffer) {
          throw new Error('Invoice PDF generation failed - no buffer returned');
        }

        console.log("PDF generated successfully, sending invoice email...");

        // Send invoice email with PDF buffer
        await emailService.sendInvoiceEmailWithBuffer(
          customer.email,
          customer.firstName || customer.name || 'Valued Customer',
          order.orderId,
          invoiceResult.buffer,
          invoiceResult.filename
        );

        // Store Azure URL in order for future reference
        if (invoiceResult.url) {
          order.invoicePath = invoiceResult.url;
          await order.save();
        }

        // Log successful invoice email in order
        order.emailLog.push({
          stage: 'invoice_sent',
          sentAt: new Date(),
          success: true,
          message: `Invoice PDF sent successfully to ${customer.email}`,
          invoiceUrl: invoiceResult.url,
          recipient: customer.email
        });
        await order.save();

        console.log("✅ Invoice PDF generated, uploaded to Azure, and emailed successfully to:", customer.email);

      } catch (invoiceError) {
        console.error("❌ Failed to generate or send invoice:", invoiceError);

        // Log failed invoice attempt in order
        order.emailLog.push({
          stage: 'invoice_failed',
          sentAt: new Date(),
          success: false,
          error: invoiceError.message,
          recipient: customer.email
        });
        await order.save();

        // Try to send a simple invoice notification without PDF as fallback
        try {
          console.log("Attempting to send invoice notification without PDF as fallback...");

          await emailService.sendEmail(
            customer.email,
            `Invoice for Order ${order.orderId}`,
            'invoice-notification',
            {
              customerName: customer.firstName || customer.name || 'Valued Customer',
              orderId: order.orderId,
              orderDate: new Date(order.createdOn).toLocaleDateString(),
              total: order.total,
              formattedTotal: '$' + order.total.toFixed(2),
              message: 'Your order has been confirmed. We are processing your invoice and will send it to you shortly.',
              trackOrderUrl: `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/track-order/${order.orderId}`,
              supportEmail: 'support@celorajewelry.com',
              companyName: 'Celora Jewelry',
              currentYear: new Date().getFullYear()
            }
          );

          console.log("✅ Invoice notification fallback sent successfully");

        } catch (fallbackError) {
          console.error("❌ Invoice notification fallback also failed:", fallbackError);
        }
      }
    }

    // Clear the cart after successful payment
    try {
      const cartId = session.metadata.cartId;
      if (cartId) {
        // Option 1: Mark cart as checked out (keeps history)
        await Cart.findOneAndUpdate(
          { _id: cartId },
          {
            isCheckedOut: true,
            items: [], // Clear all items from cart
            updatedOn: new Date(),
            $unset: { pendingCheckoutSessionId: 1 } // Remove pending session
          }
        );

        console.log(`✅ Cart cleared successfully for order ${order.orderId}`);
      }
    } catch (cartError) {
      console.error("Failed to clear cart after successful payment:", cartError);
      // Don't throw - order is already confirmed, cart clearing is not critical
    }

  } catch (error) {
    console.error("Error in handleCheckoutSessionCompleted:", error);
    throw error;
  }
}

// Handle successful payment intent
async function handlePaymentSucceeded(paymentIntent) {
  console.log("Payment succeeded:", paymentIntent.id);

  try {
    // Find order by various identifiers
    const order = await Order.findOne({
      $or: [
        { stripePaymentIntentId: paymentIntent.id },
        { orderId: paymentIntent.metadata?.orderId }, // Added for robust matching
        { stripeSessionId: paymentIntent.metadata?.sessionId },
        { referenceId: paymentIntent.metadata?.orderId }
      ]
    });

    if (!order) {
      console.warn(`[Webhook Warning] No order found for PI ${paymentIntent.id}. Metadata:`, paymentIntent.metadata);
      return;
    }

    // Ensure customer field is set (required by schema)
    if (!order.customer) {
      console.error("Order missing customer field:", order.orderId);
      // Try to find customer from payment intent metadata or session
      if (paymentIntent.metadata?.userId) {
        order.customer = paymentIntent.metadata.userId;
      } else {
        console.error("Cannot update order - customer field is required");
        return;
      }
    }

    if (order.status === "Pending") {
      order.status = "Confirmed";
      order.paymentStatus = "paid";
      order.updatedOn = new Date();

      // Store/update comprehensive payment details from payment intent
      if (!order.paymentDetails) {
        order.paymentDetails = {};
      }

      // Update payment details with payment intent information
      order.paymentDetails = {
        ...order.paymentDetails,
        stripePaymentIntentId: paymentIntent.id,
        paymentIntentStatus: paymentIntent.status,
        amountPaid: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.charges?.data?.[0]?.payment_method_details?.type || paymentIntent.payment_method_types?.[0] || 'card',
        paymentConfirmedAt: new Date(),

        // Payment intent specific details
        paymentIntentCreatedAt: new Date(paymentIntent.created * 1000),
        paymentIntentAmount: paymentIntent.amount / 100,
        paymentIntentCurrency: paymentIntent.currency,

        // Charge details (if available)
        chargeId: paymentIntent.charges?.data?.[0]?.id,
        chargeAmount: paymentIntent.charges?.data?.[0]?.amount ? paymentIntent.charges.data[0].amount / 100 : null,
        chargeCreated: paymentIntent.charges?.data?.[0]?.created ? new Date(paymentIntent.charges.data[0].created * 1000) : null,

        // Payment method details
        paymentMethodDetails: paymentIntent.charges?.data?.[0]?.payment_method_details || null,

        // Customer information
        receiptEmail: paymentIntent.receipt_email,
        receiptUrl: paymentIntent.charges?.data?.[0]?.receipt_url,

        // Risk assessment
        riskLevel: paymentIntent.charges?.data?.[0]?.outcome?.risk_level,
        riskScore: paymentIntent.charges?.data?.[0]?.outcome?.risk_score,
        networkStatus: paymentIntent.charges?.data?.[0]?.outcome?.network_status,
        sellerMessage: paymentIntent.charges?.data?.[0]?.outcome?.seller_message,

        // Transaction details
        balanceTransaction: paymentIntent.charges?.data?.[0]?.balance_transaction,
        applicationFee: paymentIntent.application_fee_amount ? paymentIntent.application_fee_amount / 100 : null,

        // Metadata
        paymentIntentMetadata: paymentIntent.metadata || {},

        // Processing details
        processingMethod: paymentIntent.automatic_payment_methods?.enabled ? 'automatic' : 'manual',
        confirmationMethod: paymentIntent.confirmation_method,
        captureMethod: paymentIntent.capture_method,

        // Additional tracking
        lastUpdated: new Date(),
        paymentSource: 'payment_intent_webhook'
      };

      // Update progress safely
      if (!order.progress) order.progress = {};
      order.progress.confirmed = {
        date: new Date(),
        status: "Payment confirmed via payment intent"
      };
      order.markModified('progress');

      await order.save();
      console.log("Order status updated to Confirmed:", order.orderId);

      // Clear the cart after successful payment
      try {
        const cartId = paymentIntent.metadata?.cartId || order.cartId;
        if (cartId) {
          await Cart.findOneAndUpdate(
            { _id: cartId },
            {
              isCheckedOut: true,
              items: [],
              updatedOn: new Date(),
              $unset: { pendingCheckoutSessionId: 1 }
            }
          );
          console.log(`✅ Cart ${cartId} cleared successfully`);
        }
      } catch (cartError) {
        console.warn("Failed to clear cart after payment (not critical):", cartError.message);
      }
    }
  } catch (error) {
    console.error("Error in handlePaymentSucceeded:", error);
  }
}

// Handle failed payment
async function handlePaymentFailed(paymentIntent) {
  console.log("Payment failed:", paymentIntent.id);

  try {
    // Find order by payment intent ID
    const order = await Order.findOne({
      $or: [
        { stripePaymentIntentId: paymentIntent.id },
        { stripeSessionId: paymentIntent.metadata?.sessionId }
      ]
    });

    if (order) {
      order.status = "Payment Failed";
      order.paymentStatus = "failed";
      order.progress = {
        ...order.progress,
        paymentFailed: {
          date: new Date(),
          reason: paymentIntent.last_payment_error?.message || "Payment failed",
          failureCode: paymentIntent.last_payment_error?.code
        }
      };
      order.updatedOn = new Date();
      await order.save();

      // Preserve cart for retry - clear pending session but keep items
      try {
        const cartId = order.cartId;
        if (cartId) {
          await Cart.updateOne(
            { _id: cartId },
            {
              $unset: { pendingCheckoutSessionId: 1 },
              updatedOn: new Date()
              // Keep items intact so user can retry
            }
          );
          console.log(`✅ Cart preserved for retry after payment failure - Order ${order.orderId}`);
        }
      } catch (cartError) {
        console.error("Failed to update cart after payment failure:", cartError);
      }

      // Get customer details for email notification
      const customer = await User.findById(order.customer);
      if (customer && customer.email) {
        await emailService.sendEmail(
          customer.email,
          `Payment Failed - Order ${order.orderId}`,
          'payment-failed',
          {
            customerName: customer.firstName || customer.name || 'Valued Customer',
            orderId: order.orderId,
            failureReason: paymentIntent.last_payment_error?.message || "Your payment could not be processed",
            retryUrl: `${process.env.CLIENT_URL}/retry-payment/${order.orderId}`,
            cartUrl: `${process.env.CLIENT_URL}/cart`
          }
        );
      }

      console.log("Order marked as payment failed:", order.orderId);
    }
  } catch (error) {
    console.error("Error in handlePaymentFailed:", error);
  }
}

// Handle charge disputes
async function handleChargeDispute(dispute) {
  console.log("Charge dispute created:", dispute.id);

  try {
    // Find order by charge ID
    const order = await Order.findOne({
      "paymentDetails.chargeId": dispute.charge
    });

    if (order) {
      order.status = "Disputed";
      order.progress = {
        ...order.progress,
        disputed: {
          date: new Date(),
          disputeId: dispute.id,
          reason: dispute.reason,
          amount: dispute.amount / 100
        }
      };
      order.updatedOn = new Date();
      await order.save();

      console.log("Order marked as disputed:", order.orderId);
    }
  } catch (error) {
    console.error("Error in handleChargeDispute:", error);
  }
}

// Handle invoice payment failures
async function handleInvoicePaymentFailed(invoice) {
  console.log("Invoice payment failed:", invoice.id);
  // Add custom logic for recurring payments or invoices if needed
}

// Get payment status
router.get("/status/:sessionId", async (req, res) => {
  try {
    console.log("Checking payment status for session:", req.params.sessionId);
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const order = await Order.findOne({ stripeSessionId: sessionId });

    res.json({
      success: true,
      paymentStatus: session.payment_status,
      orderStatus: order?.status || "Unknown",
      order
    });
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Success route - called after successful payment
// Supports both /success/:sessionId and /success?session_id=xxx formats
router.get("/success/:sessionId?", async (req, res) => {
  try {
    // Get session ID from either path parameter or query parameter
    const sessionId = req.params.sessionId || req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required"
      });
    }

    console.log("Checking success for session:", sessionId);

    // Retrieve session details from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Find the corresponding order
    const order = await Order.findOne({ stripeSessionId: sessionId })
      .populate('customer', 'firstName lastName email')
      .populate('subOrders.productDetails.packaging', 'packagingId title description imageUrl');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found for this session"
      });
    }

    // Ensure order is confirmed and mark cart as checked out on successful payment
    if (order.status === "Pending") {
      order.status = "Confirmed";
      order.paymentStatus = "paid";
      order.updatedOn = new Date();
      await order.save();

      // Now that payment is successful, mark the cart as checked out
      const Cart = mongoose.models.cartModel || mongoose.model('cartModel', Schema.cart, 'carts');
      await Cart.updateOne(
        { pendingCheckoutSessionId: sessionId },
        {
          isCheckedOut: true,
          updatedOn: new Date()
        }
      );

      console.log(`Cart marked as checked out for successful payment session: ${sessionId}`);
    }

    res.json({
      success: true,
      message: "Payment successful! Your order has been confirmed.",
      order: {
        orderId: order.orderId,
        status: order.status,
        total: order.total,
        paymentStatus: order.paymentStatus,
        customer: order.customer,
        createdOn: order.createdOn,
        subOrders: (order.subOrders || []).map(sub => ({
          subOrderId: sub.subOrderId,
          quantity: sub.quantity,
          productDetails: {
            productId: sub.productDetails?.productId,
            name: sub.productDetails?.name,
            images: sub.productDetails?.images,
            packaging: sub.productDetails?.packaging
              ? {
                  _id: sub.productDetails.packaging._id,
                  packagingId: sub.productDetails.packaging.packagingId,
                  title: sub.productDetails.packaging.title,
                  description: sub.productDetails.packaging.description,
                  imageUrl: sub.productDetails.packaging.imageUrl
                }
              : null
          }
        }))
      },
      session: {
        id: session.id,
        payment_status: session.payment_status,
        amount_total: session.amount_total / 100,
        currency: session.currency
      }
    });

  } catch (error) {
    console.error("Success route error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process success callback",
      details: error.message
    });
  }
});

// Failed route - called after failed payment
// Supports both /failed/:sessionId and /failed?session_id=xxx formats
router.get("/failed/:sessionId?", async (req, res) => {
  try {
    // Get session ID from either path parameter or query parameter
    const sessionId = req.params.sessionId || req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required"
      });
    }

    // Retrieve session details from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Find the corresponding order
    const order = await Order.findOne({ stripeSessionId: sessionId })
      .populate('customer', 'firstName lastName email');

    if (order) {
      // Update order status to failed
      order.status = "Payment Failed";
      order.paymentStatus = "failed";
      order.progress = {
        ...order.progress,
        paymentFailed: {
          date: new Date(),
          reason: "Payment session failed or cancelled by user"
        }
      };
      order.updatedOn = new Date();
      await order.save();

      // Clear the pending checkout session from cart so user can retry
      // DO NOT clear cart items - user should be able to retry with same cart
      const Cart = mongoose.models.cartModel || mongoose.model('cartModel', Schema.cart, 'carts');
      await Cart.updateOne(
        { pendingCheckoutSessionId: sessionId },
        {
          $unset: { pendingCheckoutSessionId: 1 },
          updatedOn: new Date()
          // Note: We keep cart items intact so user can retry checkout
        }
      );

      console.log(`✅ Cart preserved for retry - cleared pending checkout for failed session: ${sessionId}`);
    }

    res.json({
      success: false,
      message: "Payment failed or was cancelled.",
      order: order ? {
        orderId: order.orderId,
        status: order.status,
        total: order.total,
        paymentStatus: order.paymentStatus
      } : null,
      session: {
        id: session.id,
        payment_status: session.payment_status,
        amount_total: session.amount_total / 100,
        currency: session.currency
      },
      retryUrl: order ? `${process.env.CLIENT_URL}/retry-payment/${order.orderId}` : null
    });

  } catch (error) {
    console.error("Failed route error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process failure callback",
      details: error.message
    });
  }
});

// Cancel route - called when user cancels payment
// Supports both /cancel/:sessionId and /cancel?session_id=xxx formats
router.get("/cancel/:sessionId?", async (req, res) => {
  try {
    // Get session ID from either path parameter or query parameter
    const sessionId = req.params.sessionId || req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: "Session ID is required"
      });
    }

    const order = await Order.findOne({ stripeSessionId: sessionId });

    if (order) {
      order.status = "Cancelled";
      order.paymentStatus = "cancelled";
      order.progress = {
        ...order.progress,
        cancelled: {
          date: new Date(),
          reason: "Payment cancelled by user"
        }
      };
      order.updatedOn = new Date();
      await order.save();

      // Clear pending checkout session from the cart so the user can retry or modify their cart
      try {
        const Cart = mongoose.models.cartModel || mongoose.model('cartModel', Schema.cart, 'carts');
        await Cart.updateOne(
          { pendingCheckoutSessionId: sessionId },
          { $unset: { pendingCheckoutSessionId: 1 }, updatedOn: new Date() }
        );
        console.log(`Cleared pending checkout session from cart for cancelled session: ${sessionId}`);
      } catch (cartClearErr) {
        console.error('Failed to clear pending checkout session from cart on cancel:', cartClearErr);
      }
    }

    res.json({
      success: false,
      message: "Payment was cancelled.",
      order: order ? {
        orderId: order.orderId,
        status: order.status,
        total: order.total,
        paymentStatus: order.paymentStatus
      } : null,
      retryUrl: order ? `${process.env.CLIENT_URL}/retry-payment/${order.orderId}` : null
    });

  } catch (error) {
    console.error("Cancel route error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process cancellation",
      details: error.message
    });
  }
});

// Retry payment for failed orders
router.post("/retry/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({ error: "Order is already paid" });
    }

    // Create new Stripe session for retry
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Order ${order.orderId}`,
            description: `Retry payment for order ${order.orderId}`,
          },
          unit_amount: Math.round(order.total * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${PAYMENT_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PAYMENT_CANCEL_URL}?session_id={CHECKOUT_SESSION_ID}`,

      // Enable automatic receipt emails from Stripe for retry payments
      payment_intent_data: {
        receipt_email: order.customerData?.email || null,
        metadata: {
          orderId: order.orderId,
          customerName: order.customerData?.name || '',
          companyName: 'Celora Jewelry',
          isRetry: 'true'
        }
      },

      metadata: {
        orderId: order.orderId,
        isRetry: "true"
      }
    });

    // Update order with new session ID
    order.stripeSessionId = session.id;
    order.status = "Pending";
    order.paymentStatus = "pending";
    order.updatedOn = new Date();
    await order.save();

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      orderId: order.orderId
    });

  } catch (error) {
    console.error("Retry payment error:", error);
    res.status(500).json({
      error: "Failed to create retry payment session",
      details: error.message
    });
  }
});

// Get order details with payment status
router.get("/order/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate('customer', 'firstName lastName email')
      .lean();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Build pricingBreakdown from subOrders
    const orderTotal = order.total || 0;
    const totalSubOrderItems = (order.subOrders || []).reduce((sum, s) => sum + (s.quantity || 1), 0);

    const subOrderBreakdown = (order.subOrders || []).map((s, idx) => {
      let unitPrice = s.priceAtTime || s.productDetails?.price || s.price || 0;

      if (unitPrice === 0 && orderTotal > 0 && totalSubOrderItems > 0) {
        unitPrice = orderTotal / totalSubOrderItems;
      }

      const quantity = s.quantity || 1;
      const totalPrice = unitPrice * quantity;

      return {
        subOrderId: s.subOrderId,
        productId: s.productId,
        title: s.productDetails?.title || s.productDetails?.name || `Item ${idx + 1}`,
        slug: s.productDetails?.slug || null,
        quantity: quantity,
        unitPrice: Math.round(unitPrice * 100) / 100,
        totalPrice: Math.round(totalPrice * 100) / 100,
        itemAmount: Math.round(totalPrice * 100) / 100,
        status: s.status,
        variant: s.productDetails?.selectedVariant || null,
        metalDetail: s.productDetails?.metalDetail || null,
        metalType: s.productDetails?.metalType || null
      };
    });

    // If order has a Stripe session, get the latest payment status
    let stripeSessionData = null;
    if (order.stripeSessionId) {
      try {
        stripeSessionData = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
      } catch (error) {
        console.error("Error retrieving Stripe session:", error);
      }
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        subtotal: order.subtotal || order.total,
        discount: order.discount || 0,
        customer: order.customer,
        subOrders: order.subOrders,
        createdOn: order.createdOn,
        updatedOn: order.updatedOn,
        progress: order.progress,
        paymentDetails: order.paymentDetails,
        pricingBreakdown: {
          subOrders: subOrderBreakdown,
          subtotal: order.subtotal || order.total,
          discount: order.discount || 0,
          total: order.total
        }
      },
      stripeSession: stripeSessionData ? {
        id: stripeSessionData.id,
        payment_status: stripeSessionData.payment_status,
        amount_total: stripeSessionData.amount_total / 100,
        currency: stripeSessionData.currency
      } : null
    });

  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      error: "Failed to retrieve order details",
      details: error.message
    });
  }
});

// Get detailed payment information for an order (Admin/Debug endpoint)
router.get("/payment-details/:orderId", authMiddleware.protect, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .populate('customer', 'firstName lastName email')
      .select('orderId paymentDetails paymentStatus total status customerData refundDetails emailLog');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Also get the latest information from Stripe if we have payment intent ID
    let stripePaymentIntentData = null;
    let stripeSessionData = null;

    if (order.paymentDetails?.stripePaymentIntentId) {
      try {
        stripePaymentIntentData = await stripe.paymentIntents.retrieve(
          order.paymentDetails.stripePaymentIntentId,
          { expand: ['charges.data.balance_transaction'] }
        );
      } catch (error) {
        console.error("Error retrieving payment intent from Stripe:", error);
      }
    }

    if (order.paymentDetails?.stripeSessionId) {
      try {
        stripeSessionData = await stripe.checkout.sessions.retrieve(order.paymentDetails.stripeSessionId);
      } catch (error) {
        console.error("Error retrieving session from Stripe:", error);
      }
    }

    res.json({
      success: true,
      message: "Payment details retrieved successfully",
      order: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        customer: order.customer,
        customerData: order.customerData
      },
      paymentDetails: order.paymentDetails,
      refundDetails: order.refundDetails,
      emailLog: order.emailLog?.filter(log =>
        log.stage?.includes('payment') ||
        log.stage?.includes('refund') ||
        log.stage?.includes('confirmation')
      ),
      stripeData: {
        paymentIntent: stripePaymentIntentData ? {
          id: stripePaymentIntentData.id,
          status: stripePaymentIntentData.status,
          amount: stripePaymentIntentData.amount / 100,
          currency: stripePaymentIntentData.currency,
          created: new Date(stripePaymentIntentData.created * 1000),
          charges: stripePaymentIntentData.charges?.data?.length || 0,
          receiptUrl: stripePaymentIntentData.charges?.data?.[0]?.receipt_url,
          balanceTransaction: stripePaymentIntentData.charges?.data?.[0]?.balance_transaction
        } : null,
        session: stripeSessionData ? {
          id: stripeSessionData.id,
          payment_status: stripeSessionData.payment_status,
          amount_total: stripeSessionData.amount_total / 100,
          currency: stripeSessionData.currency,
          payment_intent: stripeSessionData.payment_intent
        } : null
      }
    });

  } catch (error) {
    console.error("Get payment details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve payment details",
      error: error.message
    });
  }
});

// Update order status with optional image and send email notification
router.put("/update-order-status/:orderId", upload.single('statusImage'), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { newStatus, statusMessage, customerEmail } = req.body;

    console.log("Updating order status:", { orderId, newStatus, statusMessage, customerEmail });

    // Find the order
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Get customer info
    let customer;
    console.log("Fetching customer data for order:", orderId);
    console.log("Customer email provided:", customerEmail);

    if (customerEmail) {
      customer = await User.findOne({ email: customerEmail });
    } else {
      customer = await User.findById(order.customer);
    }

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Update order status
    const oldStatus = order.status;
    order.status = newStatus || order.status;
    order.updatedOn = new Date();

    // Initialize progress object if it doesn't exist or fix undefined values
    if (!order.progress) {
      order.progress = {};
    }

    // Clean up any undefined values in progress
    if (order.progress.confirmed === undefined) {
      delete order.progress.confirmed;
    }
    if (order.progress.manufacturing === undefined) {
      delete order.progress.manufacturing;
    }
    if (order.progress.qualityAssurance === undefined) {
      delete order.progress.qualityAssurance;
    }
    if (order.progress.outForDelivery === undefined) {
      delete order.progress.outForDelivery;
    }
    if (order.progress.delivered === undefined) {
      delete order.progress.delivered;
    }

    // Add to progress tracking based on status
    const statusLower = newStatus.toLowerCase();

    // Upload image to Azure if provided
    let azureImageUrl = null;
    if (req.file) {
      try {
        console.log("Uploading status image to Azure...");
        azureImageUrl = await uploadToAzureBlob(req.file.buffer, req.file.originalname, 'order-status-images');
        console.log("✅ Status image uploaded to Azure:", azureImageUrl);
      } catch (uploadError) {
        console.error("❌ Failed to upload status image to Azure:", uploadError);
        // Continue without image rather than failing the whole request
      }
    }

    if (statusLower.includes('manufacturing')) {
      order.progress.manufacturing = {
        date: new Date(),
        manufacturingImages: azureImageUrl ? [azureImageUrl] : []
      };
    } else if (statusLower.includes('quality')) {
      order.progress.qualityAssurance = {
        date: new Date(),
        qualityAssuranceImages: azureImageUrl ? [azureImageUrl] : []
      };
    } else if (statusLower.includes('delivery') || statusLower.includes('shipping')) {
      const trackingNumber = `TRK-${Date.now()}`;
      order.progress.outForDelivery = {
        date: new Date(),
        outForDeliveryImages: azureImageUrl ? [azureImageUrl] : [],
        trackingId: trackingNumber,
        trackingLink: `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/track-package/${trackingNumber}`,
        carrier: 'Standard Delivery'
      };
    } else if (statusLower.includes('delivered')) {
      order.progress.delivered = {
        date: new Date()
      };
    } else {
      // For any other status, update confirmed progress
      order.progress.confirmed = {
        date: new Date(),
        confirmedImages: azureImageUrl ? [azureImageUrl] : []
      };
    }

    await order.save();

    // Prepare email data
    const emailData = {
      customerName: customer.name || customer.firstName || 'Valued Customer',
      orderId: order.orderId,
      orderDate: order.createdOn,
      total: order.total,
      trackingId: order.progress?.outForDelivery?.trackingId,
      trackingLink: order.progress?.outForDelivery?.trackingLink,

      // Add order tracking URL for all status updates
      trackOrderUrl: `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/track-order/${order.orderId}`,
      orderStatusUrl: `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/track-order/${order.orderId}`,

      // Additional order information
      orderStatus: newStatus,
      currentYear: new Date().getFullYear(),
      statusDate: new Date().toLocaleDateString()
    };

    // Prepare images for email if uploaded to Azure
    let uploadedImageUrls = [];
    if (azureImageUrl) {
      uploadedImageUrls.push(azureImageUrl);
    }

    // Send stage-specific email with proper templates
    let emailSuccess = false;
    let emailError = null;
    try {
      const stage = newStatus;
      switch (stage) {
        case 'Confirmed':
          await emailService.sendOrderConfirmedEmail(customer.email, emailData, uploadedImageUrls);
          break;
        case 'Manufacturing':
          await emailService.sendManufacturingEmail(customer.email, emailData, uploadedImageUrls);
          break;
        case 'Quality Assurance':
          await emailService.sendQualityAssuranceEmail(customer.email, emailData, uploadedImageUrls);
          break;
        case 'Out For Delivery':
          await emailService.sendOutForDeliveryEmail(customer.email, emailData, uploadedImageUrls);
          break;
        case 'Delivered':
          await emailService.sendDeliveredEmail(customer.email, emailData);
          break;
        default:
          // For any other status, use confirmed email
          await emailService.sendOrderConfirmedEmail(customer.email, emailData, uploadedImageUrls);
          break;
      }

      emailSuccess = true;
      console.log(`Order ${stage} email sent successfully to:`, customer.email);
    } catch (emailErr) {
      emailError = emailErr.message;
      console.error("Failed to send email:", emailErr);
      // Don't fail the whole request if email fails
    }

    // Log the email attempt in order
    order.emailLog.push({
      stage: newStatus.toLowerCase().replace(/\s+/g, '_'),
      sentAt: new Date(),
      success: emailSuccess,
      message: statusMessage,
      error: emailError,
      recipient: customer.email
    });

    // Save the order with email log
    await order.save();

    res.json({
      success: true,
      message: "Order status updated successfully and email sent",
      order: {
        orderId: order.orderId,
        oldStatus: oldStatus,
        newStatus: order.status,
        statusMessage: statusMessage,
        emailStatus: emailSuccess ? 'sent' : 'failed',
        customer: {
          email: customer.email,
          name: customer.name || customer.firstName
        },
        progress: order.progress,
        updatedOn: order.updatedOn
      },
      uploadedImage: req.file && azureImageUrl ? {
        filename: req.file.originalname,
        originalname: req.file.originalname,
        azureUrl: azureImageUrl,
        size: req.file.size
      } : null
    });

  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      error: "Failed to update order status",
      details: error.message
    });
  }
});

// Test email sending endpoint (for development/testing)
router.post("/test-order-email", upload.single('testImage'), async (req, res) => {
  try {
    const {
      customerEmail,
      customerName,
      orderId,
      newStatus,
      statusMessage
    } = req.body;

    if (!customerEmail) {
      return res.status(400).json({ error: "customerEmail is required" });
    }

    // Prepare test email data
    const emailData = {
      customerName: customerName || 'Test Customer',
      orderId: orderId || 'TEST-ORDER-123',
      oldStatus: 'Processing',
      newStatus: newStatus || 'Shipped',
      statusMessage: statusMessage || 'Your order has been shipped and is on its way!',
      orderDate: new Date(),
      total: 299.99,
      trackingInfo: 'Track your order at: https://track.example.com/TEST-ORDER-123'
    };

    // Upload test image to Azure if provided
    let testAzureImageUrl = null;
    if (req.file) {
      try {
        console.log("Uploading test image to Azure...");
        testAzureImageUrl = await uploadToAzureBlob(req.file.buffer, req.file.originalname, 'test-images');
        console.log("✅ Test image uploaded to Azure:", testAzureImageUrl);
      } catch (uploadError) {
        console.error("❌ Failed to upload test image to Azure:", uploadError);
      }
    }

    // Prepare images for email if uploaded to Azure
    let uploadedTestImageUrls = [];
    if (testAzureImageUrl) {
      uploadedTestImageUrls.push(testAzureImageUrl);
    }

    // Send test email using Azure image URLs
    await emailService.sendEmail(
      customerEmail,
      `Test Order Status Update - ${emailData.orderId}`,
      'order-status-update-new',
      emailData,
      [], // No local attachments
      [] // No local images - using Azure URLs in templates
    );

    res.json({
      success: true,
      message: "Test email sent successfully",
      testData: {
        sentTo: customerEmail,
        emailData: emailData,
        hasImage: !!testAzureImageUrl,
        uploadedImage: testAzureImageUrl ? {
          originalname: req.file.originalname,
          azureUrl: testAzureImageUrl,
          size: req.file.size
        } : null
      }
    });

  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({
      error: "Failed to send test email",
      details: error.message
    });
  }
});


// Test email and PDF generation endpoint (for development/testing)
router.post("/test-email-pdf", async (req, res) => {
  try {
    const { testEmail } = req.body;

    if (!testEmail) {
      return res.status(400).json({ error: "testEmail is required" });
    }

    console.log("Testing email images and PDF generation for:", testEmail);

    // Create test order data
    const testOrder = {
      orderId: 'TEST-ORDER-' + Date.now(),
      total: 1299.99,
      subtotal: 1399.99,
      discount: 100.00,
      products: [
        {
          productDetails: {
            title: 'Diamond Ring',
            description: 'Beautiful diamond engagement ring'
          },
          quantity: 1,
          priceAtTime: 999.99
        },
        {
          productDetails: {
            title: 'Gold Necklace',
            description: 'Elegant gold chain necklace'
          },
          quantity: 1,
          priceAtTime: 399.99
        }
      ],
      customerData: {
        name: 'Test Customer',
        email: testEmail
      }
    };

    const results = {
      pdfGeneration: false,
      emailImages: false,
      orderEmail: false,
      invoiceEmail: false,
      errors: []
    };

    // Test 1: PDF Generation and Upload to Azure
    try {
      const { generateInvoiceToAzure } = require('../utils/generateInvoiceFromHTML');

      console.log("🧪 Testing Azure PDF generation and upload...");

      const invoiceResult = await generateInvoiceToAzure(testOrder);

      if (invoiceResult && invoiceResult.buffer && invoiceResult.url) {
        results.pdfGeneration = true;
        console.log("✅ PDF generation and Azure upload successful");
        console.log("Azure URL:", invoiceResult.url);

        // Test 4: Send invoice email with Azure PDF
        try {
          await emailService.sendInvoiceEmailWithBuffer(
            testEmail,
            'Test Customer',
            testOrder.orderId,
            invoiceResult.buffer,
            invoiceResult.filename
          );
          results.invoiceEmail = true;
          console.log("✅ Invoice email sent successfully using Azure PDF");
        } catch (invoiceEmailError) {
          console.error("❌ Invoice email failed:", invoiceEmailError);
          results.errors.push(`Invoice email: ${invoiceEmailError.message}`);
        }
      }
    } catch (pdfError) {
      console.error("❌ PDF generation failed:", pdfError);
      results.errors.push(`PDF generation: ${pdfError.message}`);
    }

    // Test 2: Email images
    try {
      // Test image URLs
      const testImageUrls = [
        'https://via.placeholder.com/300x200/FF6B6B/FFFFFF?text=Test+Image+1',
        'https://via.placeholder.com/300x200/4ECDC4/FFFFFF?text=Test+Image+2'
      ];

      const { inlineImages, attachments, imageData } = await emailService.prepareImagesForEmail(testImageUrls);

      if (imageData.length > 0 && imageData[0].cid && imageData[0].filename) {
        results.emailImages = true;
        console.log("✅ Email image preparation successful");

        // Test 3: Send order email with images
        try {
          const emailData = {
            customerName: 'Test Customer',
            orderId: testOrder.orderId,
            orderDate: new Date().toLocaleDateString(),
            total: testOrder.total,
            formattedTotal: '$' + testOrder.total.toFixed(2)
          };

          await emailService.sendOrderConfirmedEmail(
            testEmail,
            emailData,
            testImageUrls
          );
          results.orderEmail = true;
          console.log("✅ Order confirmation email with images sent successfully");
        } catch (orderEmailError) {
          console.error("❌ Order email failed:", orderEmailError);
          results.errors.push(`Order email: ${orderEmailError.message}`);
        }
      }
    } catch (imageError) {
      console.error("❌ Email image preparation failed:", imageError);
      results.errors.push(`Email images: ${imageError.message}`);
    }

    res.json({
      success: true,
      message: "Email and PDF testing completed",
      results: {
        ...results,
        summary: {
          pdfGeneration: results.pdfGeneration ? "✅ Working" : "❌ Failed",
          emailImages: results.emailImages ? "✅ Working" : "❌ Failed",
          orderEmail: results.orderEmail ? "✅ Working" : "❌ Failed",
          invoiceEmail: results.invoiceEmail ? "✅ Working" : "❌ Failed"
        }
      },
      testOrder: {
        orderId: testOrder.orderId,
        total: testOrder.total
      }
    });

  } catch (error) {
    console.error("Test endpoint error:", error);
    res.status(500).json({
      error: "Test failed",
      details: error.message
    });
  }
});

// Refund route - Admin only (requires payments:admin permission)
router.post("/refund/:orderId", authMiddleware.protect, checkPaymentAdminPermission, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body; // Optional reason, will use default if not provided

    // Find the order
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if order is eligible for refund
    if (order.paymentStatus === 'refunded') {
      return res.status(400).json({
        success: false,
        message: "Order has already been refunded"
      });
    }

    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        message: "Order must be paid before it can be refunded"
      });
    }

    // Get payment intent ID from order - with fallback for older orders
    let paymentIntentId = order.paymentDetails?.stripePaymentIntentId;

    // If no payment intent ID stored, try to get it from Stripe session (fallback for older orders)
    if (!paymentIntentId && order.stripeSessionId) {
      try {
        console.log(`No payment intent ID found in order ${orderId}, attempting to retrieve from Stripe session ${order.stripeSessionId}`);
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        paymentIntentId = session.payment_intent;

        if (paymentIntentId) {
          console.log(`Retrieved payment intent ID from session: ${paymentIntentId}`);

          // Update the order with the payment intent ID for future use
          if (!order.paymentDetails) {
            order.paymentDetails = {};
          }
          order.paymentDetails.stripePaymentIntentId = paymentIntentId;
          order.paymentDetails.lastUpdated = new Date();
          await order.save();

          console.log(`Updated order ${orderId} with payment intent ID: ${paymentIntentId}`);
        }
      } catch (sessionError) {
        console.error(`Failed to retrieve session ${order.stripeSessionId}:`, sessionError);
      }
    }

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "No payment intent found for this order. Cannot process refund without payment intent ID.",
        debug: {
          orderId: orderId,
          stripeSessionId: order.stripeSessionId || 'No session ID',
          paymentStatus: order.paymentStatus,
          hasPaymentDetails: !!order.paymentDetails
        }
      });
    }

    // Use full refund amount (original payment amount)
    const refundAmount = order.paymentDetails?.amountPaid || order.total;

    // Convert to cents for Stripe
    const refundAmountCents = Math.round(refundAmount * 100);

    // Create refund in Stripe (refunds to original payment method automatically)
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: refundAmountCents,
      reason: 'requested_by_customer',
      metadata: {
        orderId: orderId,
        reason: reason || 'Admin initiated refund',
        processedBy: req.authenticatedUser?.email || req.user?.email || req.user?._id
      }
    });

    // Update order status
    order.paymentStatus = 'refunded';
    order.status = 'Cancelled';

    // Add refund details to order
    if (!order.refundDetails) {
      order.refundDetails = [];
    }

    order.refundDetails.push({
      refundId: refund.id,
      amount: refundAmount,
      reason: reason || 'Admin initiated refund',
      processedAt: new Date(),
      processedBy: req.authenticatedUser?.email || req.user?.email || req.user?._id,
      stripeRefundStatus: refund.status
    });

    // Log the refund action
    order.emailLog.push({
      stage: 'refund_processed',
      sentAt: new Date(),
      success: true,
      message: `Refund of $${refundAmount} processed by admin. Reason: ${reason || 'Admin initiated refund'}`
    });

    await order.save();

    // Send refund confirmation email to customer if email exists
    let customerEmailSuccess = false;
    if (order.customerData?.email) {
      try {
        const emailData = {
          customerName: order.customerData.name || 'Valued Customer',
          orderId: order.orderId,
          refundAmount: refundAmount,
          reason: reason || 'Admin initiated refund',
          refundId: refund.id,
          orderDate: order.createdOn,
          processingDate: new Date(),
          refundStatus: refund.status,
          stripeRefundUrl: `https://dashboard.stripe.com/test/payments/${paymentIntentId}`, // This will show refund details
          currentYear: new Date().getFullYear(),
          companyName: 'Celora Jewelry',
          siteUrl: 'https://celorajewelry.com'
        };

        await emailService.sendRefundConfirmationEmail(order.customerData.email, emailData);
        customerEmailSuccess = true;

        // Log successful customer email
        order.emailLog.push({
          stage: 'refund_confirmation_email',
          sentAt: new Date(),
          success: true,
          message: 'Refund confirmation email sent successfully to customer'
        });
        await order.save();

      } catch (emailError) {
        console.error('Failed to send refund confirmation email to customer:', emailError);

        // Log failed customer email
        order.emailLog.push({
          stage: 'refund_confirmation_email',
          sentAt: new Date(),
          success: false,
          error: emailError.message
        });
        await order.save();
      }
    }

    // Send admin notification email
    try {
      const adminEmails = process.env.ADMIN_NOTIFICATION_EMAILS?.split(',') || ['admin@celorajewelry.com'];

      const adminEmailData = {
        orderId: order.orderId,
        customerName: order.customerData?.name || 'Unknown Customer',
        customerEmail: order.customerData?.email || 'No email provided',
        refundAmount: refundAmount,
        reason: reason || 'Admin initiated refund',
        refundId: refund.id,
        orderDate: order.createdOn,
        processedBy: req.authenticatedUser?.email || req.user?.email || req.user?._id,
        stripeRefundStatus: refund.status,
        customerEmailSuccess: customerEmailSuccess
      };

      await emailService.sendAdminRefundNotification(adminEmails, adminEmailData);

      // Log successful admin notification
      order.emailLog.push({
        stage: 'admin_refund_notification',
        sentAt: new Date(),
        success: true,
        message: `Admin notification sent to ${adminEmails.join(', ')}`
      });
      await order.save();

    } catch (adminEmailError) {
      console.error('Failed to send admin refund notification:', adminEmailError);

      // Log failed admin notification (non-critical)
      order.emailLog.push({
        stage: 'admin_refund_notification',
        sentAt: new Date(),
        success: false,
        error: adminEmailError.message
      });
      await order.save();
    }

    res.json({
      success: true,
      message: "Refund processed successfully",
      data: {
        orderId: orderId,
        refundId: refund.id,
        refundAmount: refundAmount,
        refundStatus: refund.status,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        notifications: {
          customerEmailSent: customerEmailSuccess && order.customerData?.email ? true : false,
          customerEmail: order.customerData?.email || null,
          adminNotificationSent: true // We attempt this regardless
        }
      }
    });

  } catch (error) {
    console.error("Refund processing error:", error);

    // Log failed refund attempt if order exists
    try {
      const order = await Order.findOne({ orderId: req.params.orderId });
      if (order) {
        order.emailLog.push({
          stage: 'refund_failed',
          sentAt: new Date(),
          success: false,
          error: error.message
        });
        await order.save();
      }
    } catch (logError) {
      console.error("Failed to log refund error:", logError);
    }

    res.status(500).json({
      success: false,
      message: "Failed to process refund",
      error: error.message
    });
  }
});

// Resend invoice for an order (Admin endpoint)
router.post("/resend-invoice/:orderId", authMiddleware.protect, checkPaymentAdminPermission, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { customerEmail } = req.body; // Optional override email

    console.log(`Attempting to resend invoice for order: ${orderId}`);

    // Find the order
    const order = await Order.findOne({ orderId })
      .populate('customer', 'firstName lastName email name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Determine recipient email
    const recipientEmail = customerEmail || order.customer?.email || order.customerData?.email;

    if (!recipientEmail) {
      return res.status(400).json({
        success: false,
        message: "No customer email found for this order"
      });
    }

    // Get customer name
    const customerName = order.customer?.firstName
      ? `${order.customer.firstName} ${order.customer.lastName || ''}`.trim()
      : order.customer?.name || order.customerData?.name || 'Valued Customer';

    let invoiceResult = null;
    let emailSent = false;
    let method = 'unknown';

    try {
      // Method 1: Try to generate fresh invoice
      console.log("Attempting to generate fresh invoice PDF...");

      const { generateInvoiceToAzure } = require('../utils/generateInvoiceFromHTML');

      // Prepare order data for invoice generation
      const enhancedOrder = {
        ...order.toObject(),
        customer: order.customer,
        customerData: {
          name: customerName,
          email: recipientEmail,
          phone: order.customerData?.phone || order.customer?.phone
        }
      };

      invoiceResult = await generateInvoiceToAzure(enhancedOrder);

      if (invoiceResult && invoiceResult.buffer) {
        await emailService.sendInvoiceEmailWithBuffer(
          recipientEmail,
          customerName,
          order.orderId,
          invoiceResult.buffer,
          invoiceResult.filename
        );

        emailSent = true;
        method = 'fresh_pdf_generated';

        // Update order with new invoice URL if generated
        if (invoiceResult.url) {
          order.invoicePath = invoiceResult.url;
          await order.save();
        }

        console.log("✅ Fresh invoice PDF generated and sent successfully");
      }

    } catch (pdfError) {
      console.log("Fresh PDF generation failed, trying fallback methods...", pdfError.message);

      try {
        // Method 2: Try to send existing invoice if URL exists
        if (order.invoicePath) {
          console.log("Trying to send notification with existing invoice URL...");

          await emailService.sendEmail(
            recipientEmail,
            `Invoice for Order ${order.orderId}`,
            'invoice-notification',
            {
              customerName: customerName,
              orderId: order.orderId,
              orderDate: new Date(order.createdOn).toLocaleDateString(),
              total: order.total,
              formattedTotal: '$' + order.total.toFixed(2),
              message: 'Please find your order invoice details below. You can download your invoice from your order tracking page.',
              trackOrderUrl: `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/track-order/${order.orderId}`,
              invoiceUrl: order.invoicePath,
              supportEmail: 'support@celorajewelry.com',
              companyName: 'Celora Jewelry',
              currentYear: new Date().getFullYear()
            }
          );

          emailSent = true;
          method = 'existing_invoice_notification';
          console.log("✅ Invoice notification sent with existing URL");

        } else {
          // Method 3: Send simple invoice notification
          console.log("No existing invoice URL, sending simple notification...");

          await emailService.sendEmail(
            recipientEmail,
            `Invoice Notification for Order ${order.orderId}`,
            'invoice-notification',
            {
              customerName: customerName,
              orderId: order.orderId,
              orderDate: new Date(order.createdOn).toLocaleDateString(),
              total: order.total,
              formattedTotal: '$' + order.total.toFixed(2),
              message: 'Your order has been confirmed. We are processing your invoice and will send it to you shortly. You can track your order for the latest updates.',
              trackOrderUrl: `${process.env.CLIENT_URL || 'https://celorajewelry.com'}/track-order/${order.orderId}`,
              supportEmail: 'support@celorajewelry.com',
              companyName: 'Celora Jewelry',
              currentYear: new Date().getFullYear()
            }
          );

          emailSent = true;
          method = 'notification_only';
          console.log("✅ Invoice notification sent without PDF");
        }

      } catch (fallbackError) {
        console.error("All fallback methods failed:", fallbackError);
        throw fallbackError;
      }
    }

    // Log the email attempt
    if (emailSent) {
      order.emailLog.push({
        stage: 'invoice_resent',
        sentAt: new Date(),
        success: true,
        message: `Invoice resent using method: ${method}`,
        recipient: recipientEmail,
        sentBy: req.authenticatedUser?.email || req.user?.email || 'admin'
      });
      await order.save();
    }

    res.json({
      success: true,
      message: "Invoice resent successfully",
      data: {
        orderId: order.orderId,
        recipientEmail: recipientEmail,
        customerName: customerName,
        method: method,
        invoiceGenerated: !!invoiceResult,
        invoiceUrl: invoiceResult?.url || order.invoicePath || null,
        sentAt: new Date()
      }
    });

  } catch (error) {
    console.error("Resend invoice error:", error);

    // Log failed attempt if order exists
    try {
      const order = await Order.findOne({ orderId: req.params.orderId });
      if (order) {
        order.emailLog.push({
          stage: 'invoice_resend_failed',
          sentAt: new Date(),
          success: false,
          error: error.message,
          sentBy: req.authenticatedUser?.email || req.user?.email || 'admin'
        });
        await order.save();
      }
    } catch (logError) {
      console.error("Failed to log resend invoice error:", logError);
    }

    res.status(500).json({
      success: false,
      message: "Failed to resend invoice",
      error: error.message
    });
  }
});

// Test email template rendering (for development/testing)
router.post("/test-email-templates", async (req, res) => {
  try {
    const { testEmail, templateType = 'all' } = req.body;

    if (!testEmail) {
      return res.status(400).json({ error: "testEmail is required" });
    }

    console.log("Testing email templates for:", testEmail);

    const results = {
      templates: {},
      success: 0,
      failed: 0,
      errors: []
    };

    // Test data for different email types
    const testData = {
      'refund-confirmation': {
        customerName: 'Test Customer',
        orderId: 'TEST-ORD-' + Date.now(),
        refundId: 're_test123456',
        refundAmount: 299.99,
        reason: 'Test refund for template validation',
        orderDate: new Date(),
        processingDate: new Date(),
        companyName: 'Celora Jewelry',
        currentYear: new Date().getFullYear()
      },
      'order-confirmed-new': {
        customerName: 'Test Customer',
        orderId: 'TEST-ORD-' + Date.now(),
        orderDate: new Date().toLocaleDateString(),
        formattedTotal: '$299.99',
        subtotal: '$299.99',
        status: 'Confirmed',
        newStatus: 'Confirmed',
        companyName: 'Celora Jewelry',
        currentYear: new Date().getFullYear(),
        products: [{
          productTitle: 'Test Diamond Ring',
          productDescription: 'Beautiful test ring',
          formattedPrice: '$299.99',
          quantity: 1
        }],
        hasProducts: true,
        productCount: 1,
        trackOrderUrl: 'https://celorajewelry.com/track-order/TEST-ORD-123'
      },
      'payment-failed': {
        customerName: 'Test Customer',
        orderId: 'TEST-ORD-' + Date.now(),
        failureReason: 'Test payment failure for template validation',
        retryUrl: 'https://celorajewelry.com/retry-payment/TEST-ORD-123',
        companyName: 'Celora Jewelry'
      }
    };

    // Templates to test
    const templatesToTest = templateType === 'all' ?
      Object.keys(testData) :
      [templateType].filter(t => testData[t]);

    for (const template of templatesToTest) {
      try {
        console.log(`Testing template: ${template}`);

        const subject = `Test Email - ${template} Template`;

        if (template === 'refund-confirmation') {
          await emailService.sendRefundConfirmationEmail(testEmail, testData[template]);
        } else {
          await emailService.sendEmail(testEmail, subject, template, testData[template]);
        }

        results.templates[template] = 'success';
        results.success++;
        console.log(`✅ ${template} template sent successfully`);

      } catch (error) {
        results.templates[template] = 'failed';
        results.failed++;
        results.errors.push(`${template}: ${error.message}`);
        console.error(`❌ ${template} template failed:`, error);
      }
    }

    res.json({
      success: true,
      message: "Email template testing completed",
      testEmail: testEmail,
      results: results,
      summary: {
        totalTested: templatesToTest.length,
        successful: results.success,
        failed: results.failed,
        successRate: Math.round((results.success / templatesToTest.length) * 100) + '%'
      },
      note: "Check your email for the test messages. If you see 'This email requires an HTML-enabled client to be viewed.', your email client may not support HTML emails or there's an issue with the template rendering."
    });

  } catch (error) {
    console.error("Email template test error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to test email templates",
      error: error.message
    });
  }
});

// Fix orders missing payment intent IDs (Admin utility endpoint)
router.post("/fix-missing-payment-intents", authMiddleware.protect, checkPaymentAdminPermission, async (req, res) => {
  try {
    const { limit = 50, dryRun = true } = req.body;

    console.log(`Starting payment intent fix process (${dryRun ? 'DRY RUN' : 'LIVE'})`);

    // Find orders with paid status but missing payment intent ID
    const ordersToFix = await Order.find({
      paymentStatus: 'paid',
      stripeSessionId: { $exists: true, $ne: null },
      $or: [
        { 'paymentDetails.stripePaymentIntentId': { $exists: false } },
        { 'paymentDetails.stripePaymentIntentId': null },
        { 'paymentDetails.stripePaymentIntentId': '' }
      ]
    }).limit(limit);

    console.log(`Found ${ordersToFix.length} orders needing payment intent ID fixes`);

    const results = {
      totalFound: ordersToFix.length,
      fixed: 0,
      failed: 0,
      errors: [],
      fixedOrders: []
    };

    for (const order of ordersToFix) {
      try {
        console.log(`Processing order ${order.orderId} with session ${order.stripeSessionId}`);

        // Retrieve session from Stripe
        const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);

        if (session.payment_intent) {
          if (!dryRun) {
            // Actually update the order
            if (!order.paymentDetails) {
              order.paymentDetails = {};
            }
            order.paymentDetails.stripePaymentIntentId = session.payment_intent;
            order.paymentDetails.lastUpdated = new Date();
            order.paymentDetails.fixedAt = new Date();
            order.paymentDetails.fixedBy = req.authenticatedUser?.email || req.user?.email || 'admin';

            await order.save();
          }

          results.fixed++;
          results.fixedOrders.push({
            orderId: order.orderId,
            stripeSessionId: order.stripeSessionId,
            paymentIntentId: session.payment_intent,
            action: dryRun ? 'would-fix' : 'fixed'
          });

          console.log(`✅ ${dryRun ? 'Would fix' : 'Fixed'} order ${order.orderId} with payment intent ${session.payment_intent}`);
        } else {
          results.failed++;
          results.errors.push(`Order ${order.orderId}: Session has no payment intent`);
          console.log(`❌ Order ${order.orderId}: Session has no payment intent`);
        }

      } catch (error) {
        results.failed++;
        results.errors.push(`Order ${order.orderId}: ${error.message}`);
        console.error(`❌ Failed to fix order ${order.orderId}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Payment intent fix process completed (${dryRun ? 'DRY RUN' : 'LIVE'})`,
      results: results,
      note: dryRun ? "This was a dry run. Set dryRun: false to actually apply fixes." : "Changes have been applied to the database."
    });

  } catch (error) {
    console.error("Fix missing payment intents error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fix missing payment intents",
      error: error.message
    });
  }
});

// Cleanup abandoned checkout sessions (carts stuck in pending state)
router.post("/cleanup-abandoned-carts", async (req, res) => {
  try {
    const { maxAgeMinutes = 30 } = req.body; // Default 30 minutes

    const cutoffTime = new Date(Date.now() - (maxAgeMinutes * 60 * 1000));

    // Find carts with pending checkout sessions older than cutoff time
    const Cart = mongoose.models.cartModel || mongoose.model('cartModel', Schema.cart, 'carts');

    const abandonedCarts = await Cart.find({
      pendingCheckoutSessionId: { $exists: true },
      updatedOn: { $lt: cutoffTime },
      isCheckedOut: false
    });

    let cleanedCount = 0;
    let verifiedAbandoned = 0;

    for (const cart of abandonedCarts) {
      try {
        // Verify with Stripe that the session was not completed
        const session = await stripe.checkout.sessions.retrieve(cart.pendingCheckoutSessionId);

        if (session.payment_status !== 'paid') {
          // Session was not paid, safe to clear
          await Cart.updateOne(
            { _id: cart._id },
            {
              $unset: { pendingCheckoutSessionId: 1 },
              updatedOn: new Date()
            }
          );
          cleanedCount++;
        }
        verifiedAbandoned++;
      } catch (stripeError) {
        // If Stripe session doesn't exist, it's definitely abandoned
        await Cart.updateOne(
          { _id: cart._id },
          {
            $unset: { pendingCheckoutSessionId: 1 },
            updatedOn: new Date()
          }
        );
        cleanedCount++;
      }
    }

    res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} abandoned carts`,
      details: {
        totalFound: abandonedCarts.length,
        verifiedWithStripe: verifiedAbandoned,
        cleaned: cleanedCount,
        cutoffTime: cutoffTime,
        maxAgeMinutes: maxAgeMinutes
      }
    });

  } catch (error) {
    console.error("Cleanup abandoned carts error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cleanup abandoned carts",
      details: error.message
    });
  }
});

// Test endpoint for invoice generation and attachment debugging
router.post('/test-invoice-generation', authMiddleware.protect, async (req, res) => {
  try {
    const { testOrder, recipientEmail } = req.body;

    console.log('🧪 Testing invoice generation with attachment...');

    // Generate PDF using the same method as the webhook
    const { generateInvoiceToAzure } = require('../utils/generateInvoiceFromHTML');
    const invoiceResult = await generateInvoiceToAzure(testOrder);

    if (!invoiceResult || !invoiceResult.buffer) {
      return res.json({
        success: false,
        error: 'Invoice PDF generation failed - no buffer returned',
        bufferSize: 0,
        emailSent: false,
        attachmentIncluded: false
      });
    }

    console.log(`📄 PDF generated successfully, buffer size: ${invoiceResult.buffer.length} bytes`);

    // Test email sending with attachment
    const emailSent = await emailService.sendInvoiceEmailWithBuffer(
      recipientEmail,
      testOrder.customerData?.name || 'Test Customer',
      testOrder.orderId,
      invoiceResult.buffer,
      invoiceResult.filename
    );

    res.json({
      success: true,
      message: 'Invoice generation and email test completed',
      bufferSize: invoiceResult.buffer.length,
      emailSent: !!emailSent,
      attachmentIncluded: true,
      filename: invoiceResult.filename,
      azureUrl: invoiceResult.url
    });

  } catch (error) {
    console.error('❌ Invoice generation test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      bufferSize: 0,
      emailSent: false,
      attachmentIncluded: false
    });
  }
});

// Test endpoint for email attachment handling
router.post('/test-email-attachment', authMiddleware.protect, async (req, res) => {
  try {
    const { recipientEmail } = req.body;

    console.log('🧪 Testing email service attachment handling...');

    // Create a simple test PDF buffer
    const testPdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test PDF) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000189 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n285\n%%EOF';
    const testBuffer = Buffer.from(testPdfContent);

    // Test the email sending function
    const result = await emailService.sendInvoiceEmailWithBuffer(
      recipientEmail,
      'Test Customer',
      'TEST-ATTACHMENT-' + Date.now(),
      testBuffer,
      'test-invoice.pdf'
    );

    res.json({
      success: true,
      message: 'Email attachment test completed',
      attachmentProcessed: true,
      base64Conversion: true,
      emailResult: !!result,
      testBufferSize: testBuffer.length
    });

  } catch (error) {
    console.error('❌ Email attachment test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      attachmentProcessed: false,
      base64Conversion: false
    });
  }
});

module.exports = router;
