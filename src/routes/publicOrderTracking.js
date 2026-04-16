const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Schema = require('../models/schema.js');
const path = require('path');

// Create models
const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');
const Product = mongoose.models.productModel || mongoose.model('productModel', Schema.product, 'products');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', Schema.jewelry, 'jewelrys');

/**
 * Helper function to normalize images from different storage formats
 */
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

/**
 * Helper function to format currency
 */
function formatCurrency(amount, currency = 'USD') {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$'
  };
  const symbol = symbols[currency] || '$';
  return `${symbol}${parseFloat(amount || 0).toFixed(2)}`;
}

/**
 * Helper function to format progress tracking
 */
function formatProgress(progress) {
  if (!progress) return [];

  const progressSteps = [];
  const stepConfigs = [
    {
      key: 'confirmed',
      title: 'Order Confirmed',
      icon: '✅',
      description: 'Your order has been confirmed and payment received'
    },
    {
      key: 'manufacturing',
      title: 'Manufacturing',
      icon: '🔨',
      description: 'Your jewelry is being crafted with care',
      imagesKey: 'manufacturingImages'
    },
    {
      key: 'qualityAssurance',
      title: 'Quality Assurance',
      icon: '🔍',
      description: 'Final quality check and polishing',
      imagesKey: 'qualityAssuranceImages'
    },
    {
      key: 'outForDelivery',
      title: 'Out for Delivery',
      icon: '🚚',
      description: 'Your order is on its way to you',
      imagesKey: 'outForDeliveryImages'
    },
    {
      key: 'delivered',
      title: 'Delivered',
      icon: '📦',
      description: 'Your order has been delivered successfully'
    }
  ];

  stepConfigs.forEach(config => {
    if (progress[config.key] && progress[config.key].date) {
      const step = {
        step: config.key,
        title: config.title,
        status: 'completed',
        date: progress[config.key].date,
        description: progress[config.key].status || config.description,
        icon: config.icon
      };

      // Add images if available
      if (config.imagesKey && progress[config.key][config.imagesKey]) {
        step.images = normalizeImages(progress[config.key][config.imagesKey]);
      }

      // Add tracking info for delivery
      if (config.key === 'outForDelivery') {
        step.tracking = {
          trackingNumber: progress[config.key].trackingId,
          trackingUrl: progress[config.key].trackingLink,
          carrier: progress[config.key].carrier || 'Standard Delivery',
          isShipped: true
        };
      }

      progressSteps.push(step);
    }
  });

  return progressSteps;
}

/**
 * Helper function to enrich product data
 * @param {Object} product - Product from order
 * @param {number} index - Product index
 * @param {string} currency - Order currency (USD, INR, etc.) - defaults to 'USD'
 */
async function enrichProductData(product, index, currency = 'USD') {
  let prodDoc = product.productId && typeof product.productId === 'object' ? product.productId : null;
  const existingDetails = product.productDetails || {};

  // If not populated, try to fetch from database
  if (!prodDoc && product.productId) {
    try {
      prodDoc = await Jewelry.findById(product.productId).lean();
      if (!prodDoc) {
        prodDoc = await Product.findById(product.productId).lean();
      }
    } catch (e) {
      console.warn('Failed to fetch product:', e.message);
    }
  }

  // Resolve images
  let images = [];
  if (product.imageUrl) {
    images = [product.imageUrl];
  } else if (existingDetails.images && existingDetails.images.length) {
    images = normalizeImages(existingDetails.images);
  } else if (prodDoc) {
    images = normalizeImages(prodDoc.images || prodDoc.imageUrl || existingDetails.images || existingDetails.imageUrl);
  }

  const price = product.priceAtTime || existingDetails.price || prodDoc?.price || 0;
  const quantity = product.quantity || 1;

  return {
    id: prodDoc?._id || product.productId || `product-${index}`,
    title: existingDetails.title || existingDetails.name || prodDoc?.title || prodDoc?.name || `Product ${index + 1}`,
    description: existingDetails.description || prodDoc?.description || '',
    category: existingDetails.category || prodDoc?.category || '',
    material: existingDetails.material || prodDoc?.material || '',
    quantity: quantity,
    price: price,
    formattedPrice: formatCurrency(price, currency),
    total: price * quantity,
    formattedTotal: formatCurrency(price * quantity, currency),
    images: images,
    primaryImage: images.length > 0 ? images[0] : null,
    type: product.type || 'jewelry',
    slug: existingDetails.slug || prodDoc?.slug
  };
}

/**
 * POST /api/public/track-order
 * Public endpoint - Track order by Order ID and Email (for verification)
 */
router.post('/track-order', async (req, res) => {
  try {
    const { orderId, email } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required',
        message: 'Please provide your order ID'
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        message: 'Please provide the email address used for this order'
      });
    }

    // Find order by orderId and populate customer
    const order = await Order.findOne({ orderId })
      .populate('customer', 'email firstName lastName name')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
        message: 'No order found with this Order ID. Please check and try again.'
      });
    }

    // Verify email matches (case-insensitive)
    const orderEmail = order.customer?.email || order.customerData?.email;

    if (!orderEmail || orderEmail.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Email verification failed',
        message: 'The email address does not match our records for this order.'
      });
    }

    // Build items from subOrders
    const enrichedProducts = (order.subOrders || []).map((sub, index) => {
      const unitPrice = sub.priceAtTime || sub.productDetails?.price || 0;
      const quantity = sub.quantity || 1;
      return {
        id: sub.productId || `item-${index}`,
        title: sub.productDetails?.title || sub.productDetails?.name || `Item ${index + 1}`,
        description: sub.productDetails?.description || '',
        category: sub.productDetails?.category || '',
        material: sub.productDetails?.material || '',
        quantity,
        price: unitPrice,
        total: unitPrice * quantity,
        images: sub.imageUrl ? [sub.imageUrl] : (sub.productDetails?.images || []),
        primaryImage: sub.imageUrl || sub.productDetails?.images?.[0] || null,
        metalType: sub.productDetails?.metalType || '-',
        ringSize: sub.productDetails?.ringSize || '-',
        diamondDetails: sub.productDetails?.diamondDetails || {}
      };
    });

    // Format progress
    const progressSteps = formatProgress(order.progress);
    const currentStep = progressSteps.length > 0 ? progressSteps[progressSteps.length - 1] : null;

    // Determine next step
    let nextStep = null;
    if (!order.progress?.confirmed) {
      nextStep = {
        step: 'confirmed',
        title: 'Order Confirmation',
        description: 'Waiting for payment confirmation'
      };
    } else if (!order.progress?.manufacturing) {
      nextStep = {
        step: 'manufacturing',
        title: 'Manufacturing',
        description: 'Your jewelry will begin production soon'
      };
    } else if (!order.progress?.qualityAssurance) {
      nextStep = {
        step: 'qualityAssurance',
        title: 'Quality Assurance',
        description: 'Final inspection and polishing'
      };
    } else if (!order.progress?.outForDelivery) {
      nextStep = {
        step: 'outForDelivery',
        title: 'Shipping',
        description: 'Preparing for shipment'
      };
    } else if (!order.progress?.delivered) {
      nextStep = {
        step: 'delivered',
        title: 'Delivery',
        description: 'On the way to you'
      };
    }

    // Calculate estimated delivery
    let estimatedDelivery = null;
    if (order.estimatedDeliveryDate) {
      estimatedDelivery = new Date(order.estimatedDeliveryDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else if (order.progress?.outForDelivery) {
      // 3 days from shipping date
      estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // Build public-safe response
    const trackingData = {
      orderId: order.orderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      orderDate: new Date(order.createdOn).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      lastUpdated: new Date(order.updatedOn).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),

      // Customer info (limited)
      customerName: order.customer?.firstName || order.customer?.name || order.customerData?.name || 'Valued Customer',

      // Items
      items: enrichedProducts,
      itemCount: enrichedProducts.length,

      // Pricing
      total: order.total,
      formattedTotal: formatCurrency(order.total, order.currency),
      currency: order.currency || 'USD',

      // Progress tracking
      progress: progressSteps,
      currentStep: currentStep,
      nextStep: nextStep,
      progressPercentage: (progressSteps.length / 5) * 100,
      isDelivered: !!order.progress?.delivered?.date,

      // Tracking information
      // Tracking information
      tracking: {
        isActive: !!order.progress?.outForDelivery,
        status: order.progress?.outForDelivery ? 'Shipped' : 'Processing',
        details: order.progress?.outForDelivery ? {
          trackingNumber: order.progress.outForDelivery.trackingId || null,
          trackingUrl: order.progress.outForDelivery.trackingLink || null,
          carrier: order.progress.outForDelivery.carrier || 'Standard Delivery',
          shippedDate: new Date(order.progress.outForDelivery.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          estimatedDelivery: estimatedDelivery
        } : null,
        message: order.progress?.outForDelivery
          ? 'Your order is on its way'
          : 'Tracking information will be available once your order is shipped'
      },

      // Shipping address (limited - just city/state for privacy)
      shippingLocation: order.shippingAddress ? {
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        country: order.shippingAddress.country
      } : null,

      // Support info
      supportEmail: 'support@celorajewelry.com',
      supportMessage: 'For any questions about your order, please contact our support team.'
    };

    res.json({
      success: true,
      data: trackingData
    });

  } catch (error) {
    console.error('Public order tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track order',
      message: 'An error occurred while tracking your order. Please try again later.'
    });
  }
});

/**
 * GET /api/public/track-order/:orderId
 * Quick status check - requires order ID only (no email verification)
 * Returns limited information for quick status display
 */
router.get('/track-order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .select('orderId status paymentStatus progress updatedOn total currency')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found',
        message: 'No order found with this Order ID'
      });
    }

    // Calculate progress
    let completedSteps = 0;
    const totalSteps = 5;

    if (order.progress?.confirmed?.date) completedSteps++;
    if (order.progress?.manufacturing?.date) completedSteps++;
    if (order.progress?.qualityAssurance?.date) completedSteps++;
    if (order.progress?.outForDelivery?.date) completedSteps++;
    if (order.progress?.delivered?.date) completedSteps++;

    // Get current status message
    let statusMessage = '';
    switch (order.status) {
      case 'Pending':
        statusMessage = 'Your order is being processed';
        break;
      case 'Confirmed':
        statusMessage = 'Your order has been confirmed';
        break;
      case 'Manufacturing':
        statusMessage = 'Your jewelry is being crafted';
        break;
      case 'Quality Assurance':
        statusMessage = 'Final quality inspection';
        break;
      case 'Out For Delivery':
        statusMessage = 'Your order is on its way';
        break;
      case 'Delivered':
        statusMessage = 'Your order has been delivered';
        break;
      case 'Cancelled':
        statusMessage = 'This order has been cancelled';
        break;
      default:
        statusMessage = 'Order status: ' + order.status;
    }

    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        status: order.status,
        statusMessage: statusMessage,
        progressPercentage: (completedSteps / totalSteps) * 100,
        lastUpdated: new Date(order.updatedOn).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        isDelivered: !!order.progress?.delivered?.date,
        hasTracking: !!order.progress?.outForDelivery?.trackingId,
        message: 'For complete tracking details, please verify with your email address'
      }
    });

  } catch (error) {
    console.error('Quick status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order status'
    });
  }
});

/**
 * GET /api/public/track
 * Serve the order tracking HTML page
 */
router.get('/track', (req, res) => {
  const trackingPagePath = path.join(__dirname, '../templates/track-order.html');
  res.sendFile(trackingPagePath);
});

module.exports = router;
