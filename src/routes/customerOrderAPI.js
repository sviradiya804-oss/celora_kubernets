const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Schema = require('../models/schema.js');
const { protect } = require('../middlewares/authMiddleware');

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
 * Helper function to detect if diamond is Natural or Lab-grown
 * Checks variant metadata and price hints to determine diamond type
 */
function detectDiamondType(selectedVariant, product, price) {
  if (!selectedVariant) return 'Not Specified';
  
  // Check if variant contains explicit diamond type flag
  if (selectedVariant.diamondType) {
    const dType = selectedVariant.diamondType.toLowerCase();
    if (dType.includes('natural') || dType.includes('dr')) return 'Natural (DR)';
    if (dType.includes('lab') || dType.includes('lc') || dType.includes('lab grown')) return 'Lab Grown (LC)';
  }
  
  // Check if variant contains price info indicating natural vs lab
  if (selectedVariant.priceNatural && selectedVariant.priceLab) {
    // If price matches lab price more closely, it's lab
    if (Math.abs(price - selectedVariant.priceLab) < Math.abs(price - selectedVariant.priceNatural)) {
      return 'Lab Grown (LC)';
    }
    return 'Natural (DR)';
  }
  
  // Check product details for hints
  if (product?.productDetails?.selectedVariant) {
    const sv = product.productDetails.selectedVariant;
    if (sv.diamondType) {
      const dType = sv.diamondType.toLowerCase();
      if (dType.includes('natural') || dType.includes('dr')) return 'Natural (DR)';
      if (dType.includes('lab') || dType.includes('lc')) return 'Lab Grown (LC)';
    }
  }
  
  return 'Not Specified';
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

  // Detect diamond type from variant selection
  const diamondTypeDetected = detectDiamondType(
    existingDetails.selectedVariant || prodDoc?.selectedVariant,
    product,
    price
  );

  // Build diamond details with all info
  const baseDiamondDetails = existingDetails.diamondDetails || {
    shape: prodDoc?.shape || '-',
    diamondType: prodDoc?.diamondType || '-',
    cut: prodDoc?.cut || '-',
    clarity: prodDoc?.clarity || '-',
    caratSize: prodDoc?.caratSize || '-',
    color: prodDoc?.color || '-',
    priceWithMargin: prodDoc?.priceWithMargin || '-'
  };

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
    slug: existingDetails.slug || prodDoc?.slug || null,  // ✅ ADD SLUG
    // Include engraving details if present
    engraving: product.engravingDetails?.hasEngraving ? {
      text: product.engravingDetails.engravingText,
      type: product.engravingDetails.engravingType,
      location: product.engravingDetails.engravingLocation,
      cost: product.engravingDetails.engravingCost || 0,
      status: product.engravingDetails.engravingStatus
    } : null,
    // Include metal/variation selection if available
    selectedMetal: existingDetails.selectedMetal || prodDoc?.selectedMetal,
    selectedVariation: existingDetails.selectedVariation || prodDoc?.selectedVariation,
    selectedVariant: existingDetails.selectedVariant || prodDoc?.selectedVariant,  // ✅ INCLUDE VARIANT WITH DIAMOND TYPE
    cadCode: existingDetails.cadCode || prodDoc?.cadCode,
    // Product details from order snapshot
    metalType: existingDetails.metalType || prodDoc?.metalType || '-',
    ringSize: existingDetails.ringSize || prodDoc?.ringSize || '-',
    packagingType: existingDetails.packagingType || prodDoc?.packagingType || '-',
    estimatedDeliveryDays: existingDetails.estimatedDeliveryDays || prodDoc?.estimatedDeliveryDays || 5,
    // Diamond/Stone details with actual type (Natural/Lab)
    diamondDetails: {
      ...baseDiamondDetails,
      actualType: diamondTypeDetected // "Natural (DR)" or "Lab Grown (LC)"
    }
  };
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
        step.trackingId = progress[config.key].trackingId;
        step.trackingLink = progress[config.key].trackingLink;
        step.carrier = progress[config.key].carrier || 'Standard Delivery';
      }

      progressSteps.push(step);
    }
  });

  return progressSteps;
}

/**
 * GET /api/customer/orders
 * Get all orders for authenticated customer
 */
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'createdOn',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { customer: userId };
    if (status) {
      query.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Fetch orders with pagination
    const orders = await Order.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v -updatedBy')
      .lean();

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);

    // Format orders for response
    const formattedOrders = orders.map(order => {
      const progressSteps = formatProgress(order.progress);
      const currentStep = progressSteps.length > 0 ? progressSteps[progressSteps.length - 1] : null;

      return {
        orderId: order.orderId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        formattedTotal: formatCurrency(order.total, order.currency),
        itemCount: order.subOrders?.length || 0,
        createdOn: order.createdOn,
        updatedOn: order.updatedOn,
        orderDate: new Date(order.createdOn).toLocaleDateString(),
        currentStep: currentStep,
        progressPercentage: (progressSteps.length / 5) * 100,
        isDelivered: !!order.progress?.delivered?.date,
        canTrack: !!order.progress?.outForDelivery?.trackingId,
        // Include first sub-order image as order thumbnail
        thumbnail: order.subOrders?.[0]?.imageUrl || order.subOrders?.[0]?.productDetails?.images?.[0] || null,
        // Sub-orders summary for list view
        subOrders: (order.subOrders || []).map(sub => ({
          subOrderId: sub.subOrderId,
          status: sub.status,
          productName: sub.productDetails?.title || sub.productDetails?.name,
          imageUrl: sub.imageUrl,
          priceAtTime: sub.priceAtTime
        })),
        subOrderCount: order.subOrders?.length || 0
      };
    });

    res.json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalOrders / parseInt(limit)),
          totalOrders: totalOrders,
          hasNextPage: skip + formattedOrders.length < totalOrders,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching customer orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

/**
 * GET /api/customer/orders/:orderId
 * Get detailed information about a specific order
 */
router.get('/:orderId', protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    // Build query
    const query = { orderId };

    // Check for SUPERADMIN role (case-insensitive)
    const roleName = req.user.role && req.user.role.name ? req.user.role.name : '';
    const isSuperAdmin = roleName.toUpperCase() === 'SUPERADMIN';

    if (!isSuperAdmin) {
      query.customer = userId;
    }

    console.log(`[OrderAPI] Fetching order ${orderId} for user ${userId} (Role: ${roleName}, IsSuperAdmin: ${isSuperAdmin})`);

    // Find order and verify ownership
    const order = await Order.findOne(query)
      .select('-__v -updatedBy')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

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

    // Calculate totals
    const subtotal = order.subtotal || order.total;
    const discount = order.discount || 0;
    const shippingCost = order.shippingCost || 0;
    const tax = order.tax || 0;

    // Format response
    const orderDetails = {
      orderId: order.orderId,
      referenceId: order.referenceId,
      status: order.status,
      paymentStatus: order.paymentStatus,

      // Dates
      createdOn: order.createdOn,
      updatedOn: order.updatedOn,
      orderDate: new Date(order.createdOn).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),

      // Items (from subOrders)
      itemCount: (order.subOrders || []).length,
      hasMultipleItems: (order.subOrders || []).length > 1,

      // Pricing
      subtotal: subtotal,
      formattedSubtotal: formatCurrency(subtotal, order.currency),
      discount: discount,
      formattedDiscount: formatCurrency(discount, order.currency),
      coupon: order.coupon ? {
        code: order.coupon.code,
        discountType: order.coupon.discountType,
        discountValue: order.coupon.discountValue,
        appliedDiscount: order.coupon.discount,
        formattedDiscount: formatCurrency(order.coupon.discount || 0, order.currency)
      } : null,
      shippingCost: shippingCost,
      formattedShippingCost: formatCurrency(shippingCost, order.currency),
      tax: tax,
      formattedTax: formatCurrency(tax, order.currency),
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
      tracking: order.progress?.outForDelivery ? {
        trackingId: order.progress.outForDelivery.trackingId,
        trackingLink: order.progress.outForDelivery.trackingLink,
        carrier: order.progress.outForDelivery.carrier || 'Standard Delivery',
        shippedDate: order.progress.outForDelivery.date,
        estimatedDelivery: order.estimatedDeliveryDate ||
          new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString()
      } : null,

      // Addresses
      shippingAddress: order.shippingAddress ? {
        name: `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim(),
        address1: order.shippingAddress.address1,
        address2: order.shippingAddress.address2,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zipCode: order.shippingAddress.zipCode,
        country: order.shippingAddress.country,
        email: order.shippingAddress.email,
        phone: order.shippingAddress.phone,
        fullAddress: [
          order.shippingAddress.address1,
          order.shippingAddress.address2,
          `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`,
          order.shippingAddress.country
        ].filter(Boolean).join(', ')
      } : null,

      billingAddress: order.billingAddress ? {
        name: `${order.billingAddress.firstName || ''} ${order.billingAddress.lastName || ''}`.trim(),
        address1: order.billingAddress.address1,
        address2: order.billingAddress.address2,
        city: order.billingAddress.city,
        state: order.billingAddress.state,
        zipCode: order.billingAddress.zipCode,
        country: order.billingAddress.country,
        email: order.billingAddress.email,
        phone: order.billingAddress.phone,
        fullAddress: [
          order.billingAddress.address1,
          order.billingAddress.address2,
          `${order.billingAddress.city}, ${order.billingAddress.state} ${order.billingAddress.zipCode}`,
          order.billingAddress.country
        ].filter(Boolean).join(', ')
      } : null,

      // Payment details (limited for security)
      payment: order.paymentDetails ? {
        method: order.paymentDetails.paymentMethod || order.paymetmethod || 'card',
        status: order.paymentStatus,
        amountPaid: order.paymentDetails.amountPaid || order.total,
        formattedAmountPaid: formatCurrency(order.paymentDetails.amountPaid || order.total, order.currency),
        currency: order.paymentDetails.currency || order.currency || 'USD',
        paidAt: order.paymentDetails.createdOn || order.createdOn
      } : null,

      // Sub-orders — one per item, each with its own status & progress
      subOrders: (order.subOrders || []).map((sub, idx) => {
        const unitPrice = sub.priceAtTime || sub.productDetails?.price || sub.price || 0;
        const quantity = sub.quantity || 1;
        const totalPrice = unitPrice * quantity;
        return {
          subOrderId: sub.subOrderId,
          status: sub.status,
          productId: sub.productId,
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          itemAmount: totalPrice, // Total amount for this item
          priceAtTime: sub.priceAtTime,
          imageUrl: sub.imageUrl,
          productDetails: sub.productDetails,
          progress: sub.progress || {},
          engravingDetails: sub.engravingDetails
        };
      }),
      hasSubOrders: Array.isArray(order.subOrders) && order.subOrders.length > 0,

      // Pricing breakdown by sub-order
      pricingBreakdown: {
        subOrders: (order.subOrders || []).map((sub, idx) => {
          const unitPrice = sub.priceAtTime || sub.productDetails?.price || sub.price || 0;
          const quantity = sub.quantity || 1;
          return {
            subOrderId: sub.subOrderId,
            productId: sub.productId,
            title: sub.productDetails?.title || sub.productDetails?.name || `Item ${idx + 1}`,
            slug: sub.productDetails?.slug || null,
            quantity: quantity,
            unitPrice: unitPrice,
            totalPrice: unitPrice * quantity,
            status: sub.status,
            metalDetail: sub.productDetails?.metalDetail || null,
            currency: order.currency || 'USD'
          };
        }),
        summary: {
          subtotal: subtotal,
          discount: discount,
          shipping: shippingCost,
          tax: tax,
          total: order.total,
          currency: order.currency || 'USD'
        }
      },

      // Additional info
      invoiceUrl: order.invoicePath,
      hasInvoice: !!order.invoicePath,
      customerNotes: order.customerNotes || order.notes,
      specialInstructions: order.specialInstructions,
      estimatedDeliveryDays: order.estimatedDeliveryDays || 5,
      expectedDeliveryDate: order.expectedDeliveryDate
    };

    res.json({
      success: true,
      data: orderDetails
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details',
      message: error.message
    });
  }
});

/**
 * GET /api/customer/orders/:orderId/tracking
 * Get tracking information for an order
 */
router.get('/:orderId/tracking', protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const query = { orderId };

    const roleName = req.user.role && req.user.role.name ? req.user.role.name : '';
    const isSuperAdmin = roleName.toUpperCase() === 'SUPERADMIN';

    if (!isSuperAdmin) {
      query.customer = userId;
    }

    const order = await Order.findOne(query)
      .select('orderId status progress shippingAddress estimatedDeliveryDate')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (!order.progress?.outForDelivery) {
      return res.status(400).json({
        success: false,
        error: 'Order has not been shipped yet',
        message: 'Tracking information will be available once the order is shipped'
      });
    }

    const tracking = {
      orderId: order.orderId,
      status: order.status,
      trackingId: order.progress.outForDelivery.trackingId,
      trackingLink: order.progress.outForDelivery.trackingLink,
      carrier: order.progress.outForDelivery.carrier || 'Standard Delivery',
      shippedDate: order.progress.outForDelivery.date,
      estimatedDelivery: order.estimatedDeliveryDate ||
        new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
      shippingAddress: order.shippingAddress ? {
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        country: order.shippingAddress.country
      } : null,
      isDelivered: !!order.progress?.delivered?.date,
      deliveredDate: order.progress?.delivered?.date
    };

    res.json({
      success: true,
      data: tracking
    });

  } catch (error) {
    console.error('Error fetching tracking info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tracking information',
      message: error.message
    });
  }
});

/**
 * GET /api/customer/orders/:orderId/invoice
 * Get invoice for an order (returns URL or file)
 */
router.get('/:orderId/invoice', protect, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    const query = { orderId };

    const roleName = req.user.role && req.user.role.name ? req.user.role.name : '';
    const isSuperAdmin = roleName.toUpperCase() === 'SUPERADMIN';

    if (!isSuperAdmin) {
      query.customer = userId;
    }

    const order = await Order.findOne(query)
      .select('orderId invoicePath paymentStatus')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (!order.invoicePath) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not available',
        message: 'Invoice will be generated after payment confirmation'
      });
    }

    res.json({
      success: true,
      data: {
        orderId: order.orderId,
        invoiceUrl: order.invoicePath,
        paymentStatus: order.paymentStatus
      }
    });

  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice',
      message: error.message
    });
  }
});

/**
 * GET /api/customer/orders/stats/summary
 * Get order statistics summary for the customer
 */
router.get('/stats/summary', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const [totalOrders, pendingOrders, deliveredOrders, totalSpent] = await Promise.all([
      Order.countDocuments({ customer: userId }),
      Order.countDocuments({ customer: userId, status: { $in: ['Pending', 'Confirmed'] } }),
      Order.countDocuments({ customer: userId, status: 'Delivered' }),
      Order.aggregate([
        { $match: { customer: userId, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])
    ]);

    // Get recent orders
    const recentOrders = await Order.find({ customer: userId })
      .sort({ createdOn: -1 })
      .limit(5)
      .select('orderId status total createdOn')
      .lean();

    res.json({
      success: true,
      data: {
        summary: {
          totalOrders,
          pendingOrders,
          deliveredOrders,
          totalSpent: totalSpent[0]?.total || 0,
          formattedTotalSpent: formatCurrency(totalSpent[0]?.total || 0)
        },
        recentOrders: recentOrders.map(order => ({
          orderId: order.orderId,
          status: order.status,
          total: order.total,
          formattedTotal: formatCurrency(order.total),
          orderDate: new Date(order.createdOn).toLocaleDateString()
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order statistics',
      message: error.message
    });
  }
});

module.exports = router;
