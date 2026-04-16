const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Schema = require('../models/schema.js');
const path = require('path');

// Create Order model
const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');

// Serve the order tracking page
router.get("/track/:orderId?", (req, res) => {
  const trackingPagePath = path.join(__dirname, '../templates/track-order.html');
  res.sendFile(trackingPagePath);
});

// Serve the order tracking page (alternative route)
router.get("/track-order/:orderId?", (req, res) => {
  const trackingPagePath = path.join(__dirname, '../templates/track-order.html');
  res.sendFile(trackingPagePath);
});

// Get order details by order ID (public route for customers)
router.get("/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    // Helper to normalize images stored in multiple shapes
    function normalizeImagesField(imgs) {
      if (!imgs) return [];
      if (Array.isArray(imgs)) return imgs.filter(i => typeof i === 'string');
      if (typeof imgs === 'object') {
        const out = [];
        Object.values(imgs).forEach(v => {
          if (Array.isArray(v)) v.forEach(u => { if (typeof u === 'string') out.push(u); });
          else if (typeof v === 'string') out.push(v);
        });
        return out;
      }
      if (typeof imgs === 'string') return [imgs];
      return [];
    }

    // Find order by orderId and populate customer
    const order = await Order.findOne({ orderId })
      .populate('customer', 'firstName lastName email')
      .select('-__v -updatedBy'); // Exclude internal fields

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found"
      });
    }

    // Format progress data for frontend display
    const formatProgress = (progress) => {
      if (!progress) return [];

      const progressSteps = [];

      if (progress.confirmed && progress.confirmed.date) {
        progressSteps.push({
          step: 'confirmed',
          title: 'Order Confirmed',
          status: 'completed',
          date: progress.confirmed.date,
          description: progress.confirmed.status || 'Your order has been confirmed and payment received',
          icon: '✅'
        });
      }

      if (progress.manufacturing && progress.manufacturing.date) {
        progressSteps.push({
          step: 'manufacturing',
          title: 'Manufacturing',
          status: 'completed',
          date: progress.manufacturing.date,
          description: 'Your jewelry is being crafted with care',
          icon: '🔨',
          images: progress.manufacturing.manufacturingImages || []
        });
      }

      if (progress.qualityAssurance && progress.qualityAssurance.date) {
        progressSteps.push({
          step: 'qualityAssurance',
          title: 'Quality Assurance',
          status: 'completed',
          date: progress.qualityAssurance.date,
          description: 'Final quality check and polishing',
          icon: '🔍',
          images: progress.qualityAssurance.qualityAssuranceImages || []
        });
      }

      if (progress.outForDelivery && progress.outForDelivery.date) {
        progressSteps.push({
          step: 'outForDelivery',
          title: 'Out for Delivery',
          status: 'completed',
          date: progress.outForDelivery.date,
          description: 'Your order is on its way to you',
          icon: '🚚',
          tracking: {
            trackingNumber: progress.outForDelivery.trackingId || null,
            trackingUrl: progress.outForDelivery.trackingLink || null,
            carrier: progress.outForDelivery.carrier || 'Standard Delivery'
          },
          images: progress.outForDelivery.outForDeliveryImages || []
        });
      }

      if (progress.delivered && progress.delivered.date) {
        progressSteps.push({
          step: 'delivered',
          title: 'Delivered',
          status: 'completed',
          date: progress.delivered.date,
          description: 'Your order has been delivered successfully',
          icon: '📦'
        });
      }

      return progressSteps;
    };

    // Format items from subOrders for display
    const formattedProducts = (order.subOrders || []).map((sub, index) => {
      const existingDetails = sub.productDetails || {};
      const images = sub.imageUrl ? [sub.imageUrl] : (existingDetails.images || []);
      const priceVal = sub.priceAtTime || existingDetails.price || 0;

      return {
        id: sub.productId || `item-${index}`,
        title: existingDetails.title || existingDetails.name || `Item ${index + 1}`,
        description: existingDetails.description || '',
        category: existingDetails.category || '',
        material: existingDetails.material || '',
        quantity: sub.quantity || 1,
        price: priceVal,
        formattedPrice: '$' + priceVal.toFixed(2),
        total: priceVal * (sub.quantity || 1),
        formattedTotal: '$' + (priceVal * (sub.quantity || 1)).toFixed(2),
        images,
        type: sub.type || 'jewelry',
        slug: existingDetails.slug,
        cadCode: existingDetails.cadCode,
        diamondDetails: existingDetails.diamondDetails || {}
      };
    });

    // Determine current step and next expected step
    const progressSteps = formatProgress(order.progress);
    const currentStep = progressSteps.length > 0 ? progressSteps[progressSteps.length - 1] : null;

    let nextStep = null;
    if (!order.progress?.confirmed) {
      nextStep = { step: 'confirmed', title: 'Order Confirmation', description: 'Waiting for payment confirmation' };
    } else if (!order.progress?.manufacturing) {
      nextStep = { step: 'manufacturing', title: 'Manufacturing', description: 'Your jewelry will begin production soon' };
    } else if (!order.progress?.qualityAssurance) {
      nextStep = { step: 'qualityAssurance', title: 'Quality Assurance', description: 'Final inspection and polishing' };
    } else if (!order.progress?.outForDelivery) {
      nextStep = { step: 'outForDelivery', title: 'Shipping', description: 'Preparing for shipment' };
    } else if (!order.progress?.delivered) {
      nextStep = { step: 'delivered', title: 'Delivery', description: 'On the way to you' };
    }

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        formattedTotal: '$' + order.total.toFixed(2),
        subtotal: order.subtotal || order.total,
        formattedSubtotal: '$' + (order.subtotal || order.total).toFixed(2),
        discount: order.discount || 0,
        formattedDiscount: order.discount ? '$' + order.discount.toFixed(2) : '$0.00',
        createdOn: order.createdOn,
        updatedOn: order.updatedOn,
        orderDate: new Date(order.createdOn).toLocaleDateString(),

        // Customer information (limited)
        customer: {
          name: order.customer?.firstName || order.customer?.name || 'Valued Customer',
          email: order.customer?.email
        },

        // Items information
        items: formattedProducts,
        hasItems: formattedProducts.length > 0,
        itemCount: formattedProducts.length,
        hasMultipleItems: formattedProducts.length > 1,

        // Progress tracking
        progress: progressSteps,
        currentStep: currentStep,
        nextStep: nextStep,
        progressPercentage: progressSteps.length * 20, // 5 steps = 100%

        // Tracking information
        trackingInfo: order.progress?.outForDelivery ? {
          trackingNumber: order.progress.outForDelivery.trackingId || null,
          trackingUrl: order.progress.outForDelivery.trackingLink || null,
          carrier: order.progress.outForDelivery.carrier || 'Standard Delivery',
          shippedDate: order.progress.outForDelivery.date
        } : null,

        // Payment details (limited)
        paymentDetails: order.paymentDetails ? {
          paymentMethod: order.paymentDetails.paymentMethod || 'card',
          amountPaid: order.paymentDetails.amountPaid,
          formattedAmountPaid: '$' + (order.paymentDetails.amountPaid || 0).toFixed(2),
          currency: order.paymentDetails.currency || 'usd',
          paymentDate: order.paymentDetails.createdOn || order.createdOn
        } : null
      }
    });

  } catch (error) {
    console.error("Get order status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve order status",
      message: "Please try again later or contact support"
    });
  }
});

// Get order status by email and order ID (alternative lookup method)
router.post("/lookup", async (req, res) => {
  try {
    const { orderId, email } = req.body;

    if (!orderId || !email) {
      return res.status(400).json({
        success: false,
        error: "Order ID and email are required"
      });
    }

    // Find order by orderId and customer email
    const order = await Order.findOne({ orderId })
      .populate('customer', 'firstName lastName email');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found"
      });
    }

    // Verify email matches
    if (order.customer?.email?.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: "Email does not match order records"
      });
    }

    // Redirect to the status endpoint with the verified order
    return res.redirect(`/api/customer-order/status/${orderId}`);

  } catch (error) {
    console.error("Order lookup error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to lookup order",
      message: "Please try again later"
    });
  }
});

// Get simplified order status for quick checks
router.get("/quick-status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .select('orderId status paymentStatus progress updatedOn total expectedDeliveryDate')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found"
      });
    }

    // Simple progress calculation
    let completedSteps = 0;
    const totalSteps = 5;

    if (order.progress?.confirmed?.date) completedSteps++;
    if (order.progress?.manufacturing?.date) completedSteps++;
    if (order.progress?.qualityAssurance?.date) completedSteps++;
    if (order.progress?.outForDelivery?.date) completedSteps++;
    if (order.progress?.delivered?.date) completedSteps++;

    res.json({
      success: true,
      orderId: order.orderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      progressPercentage: (completedSteps / totalSteps) * 100,
      lastUpdated: order.updatedOn,
      formattedTotal: '$' + order.total.toFixed(2),
      isDelivered: !!order.progress?.delivered?.date,
      // Use the date stored at checkout (computed from product estimatedDeliveryDays)
      estimatedDelivery: order.expectedDeliveryDate
        ? new Date(order.expectedDeliveryDate).toLocaleDateString()
        : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString() // fallback +5 days for old orders
    });

  } catch (error) {
    console.error("Quick status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get order status"
    });
  }
});

module.exports = router;
