const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Schema = require('../models/schema.js');
const { getAnalyticsData } = require("../utils/googleAnalytics");
const { authenticate } = require('../middlewares/authMiddleware');
const { checkPermissionWithGroups } = require('../middlewares/groupPermissionMiddleware');

// Create models using the correct schema system
const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', Schema.cart, 'carts');
const Inventory = mongoose.models.inventoryModel || mongoose.model('inventoryModel', Schema.inventory, 'inventories');

// Utility: Parse date or default
function parseDate(dateStr, fallback) {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? fallback : date;
}

// Custom middleware to check dashboard permission
const checkDashboardPermission = (action) => {
  return async (req, res, next) => {
    // Temporarily set indexName for permission check
    req.params.indexName = 'dashboard';
    return checkPermissionWithGroups(action)(req, res, next);
  };
};

router.get("/", authenticate, checkDashboardPermission('read'), async (req, res) => {
  try {
    // Prevent caching of sensitive authenticated responses
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    const from = parseDate(req.query.from, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const to = parseDate(req.query.to, new Date());

    console.log(`Dashboard query range: ${from.toISOString()} to ${to.toISOString()}`);

    // Reset totals for each request (fix accumulation bug)
    let totalInventoryValue = 0;
    let totalCarats = 0;
    let totalDiamonds = 0;

    // Get inventory data
    const inventoryDocs = await Inventory.find();
    console.log(`Found ${inventoryDocs.length} inventory items`);

    inventoryDocs.forEach(item => {
      if (item.price) {
        totalInventoryValue += item.price;
      }

      // Check for center stone data
      if (item.centerStone?.stoneSizes && Array.isArray(item.centerStone.stoneSizes)) {
        totalCarats += item.centerStone.stoneSizes.reduce((sum, c) => sum + (c || 0), 0);
        totalDiamonds += item.centerStone.stoneSizes.length;
      }
    });

    // Get orders within date range
    const orders = await Order.find({ 
      createdOn: { $gte: from, $lte: to } 
    });
    console.log(`Found ${orders.length} orders in date range`);

    // Filter orders by status (using correct field names from schema)
    const confirmedOrders = orders.filter(order => 
      ['Confirmed', 'Manufacturing', 'Quality Assurance', 'Out For Delivery', 'Delivered'].includes(order.status)
    );
    const cancelledOrders = orders.filter(order => order.status === 'Cancelled');
    const pendingOrders = orders.filter(order => order.status === 'Pending');

    // Calculate order metrics
    const activeOrdersMetrics = {
      amount: confirmedOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      count: confirmedOrders.length,
      // Calculate total products and quantities
      totalProducts: confirmedOrders.reduce((sum, o) => sum + (o.products?.length || 0), 0),
      totalQuantity: confirmedOrders.reduce((sum, o) => 
        sum + (o.products?.reduce((pSum, p) => pSum + (p.quantity || 0), 0) || 0), 0
      )
    };

    // Get product analytics from inventory (since products are stored there)
    const productAnalytics = inventoryDocs.reduce((acc, product) => {
      const category = product.category || "Uncategorized";
      acc[category] = acc[category] || { count: 0, totalValue: 0 };
      acc[category].count += 1;
      acc[category].totalValue += product.price || 0;
      return acc;
    }, {});

    // Get recent carts data
    const recentCarts = await Cart.find({
      updatedOn: { $gte: from, $lte: to }
    });

    const cartMetrics = {
      totalCarts: recentCarts.length,
      activeCarts: recentCarts.filter(cart => !cart.isCheckedOut && cart.items?.length > 0).length,
      checkedOutCarts: recentCarts.filter(cart => cart.isCheckedOut).length,
      pendingCheckouts: recentCarts.filter(cart => cart.pendingCheckoutSessionId).length
    };

    // Google Analytics Data (with error handling)
    let gaData = null;
    try {
      gaData = await getAnalyticsData(
        from.toISOString().split("T")[0], 
        to.toISOString().split("T")[0]
      );
    } catch (gaError) {
      console.error("Google Analytics error:", gaError.message);
      gaData = { error: "Analytics data unavailable" };
    }

    res.json({
      success: true,
      dateRange: {
        from: from.toISOString(),
        to: to.toISOString(),
        daysCount: Math.ceil((to - from) / (1000 * 60 * 60 * 24))
      },
      inventory: {
        totalValue: totalInventoryValue || 0,
        totalCarats: totalCarats || 0,
        totalDiamonds: totalDiamonds || 0,
        totalItems: inventoryDocs.length || 0
      },
      orders: {
        total: orders.length,
        confirmed: confirmedOrders.length,
        pending: pendingOrders.length,
        cancelled: cancelledOrders.length,
        revenue: activeOrdersMetrics.amount,
        totalProducts: activeOrdersMetrics.totalProducts,
        totalQuantity: activeOrdersMetrics.totalQuantity
      },
      carts: cartMetrics,
      productAnalytics: productAnalytics,
      googleAnalytics: gaData,
      systemStatus: {
        timestamp: new Date().toISOString(),
        dataProcessed: true,
        inventoryLoaded: inventoryDocs.length > 0,
        ordersLoaded: orders.length >= 0,
        analyticsLoaded: gaData !== null
      }
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ 
      success: false,
      error: "Dashboard data error",
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint to debug dashboard data
router.get("/health", async (req, res) => {
  try {
    const inventoryCount = await Inventory.countDocuments();
    const orderCount = await Order.countDocuments();
    const cartCount = await Cart.countDocuments();

    // Sample documents to check structure
    const sampleInventory = await Inventory.findOne();
    const sampleOrder = await Order.findOne();
    const sampleCart = await Cart.findOne();

    res.json({
      success: true,
      collections: {
        inventory: {
          count: inventoryCount,
          sample: sampleInventory ? {
            id: sampleInventory._id,
            hasPrice: !!sampleInventory.price,
            hasCategory: !!sampleInventory.category,
            hasCenterStone: !!sampleInventory.centerStone,
            fields: Object.keys(sampleInventory.toObject || sampleInventory)
          } : null
        },
        orders: {
          count: orderCount,
          sample: sampleOrder ? {
            id: sampleOrder._id,
            status: sampleOrder.status,
            total: sampleOrder.total,
            hasProducts: !!sampleOrder.products?.length,
            fields: Object.keys(sampleOrder.toObject || sampleOrder)
          } : null
        },
        carts: {
          count: cartCount,
          sample: sampleCart ? {
            id: sampleCart._id,
            hasItems: !!sampleCart.items?.length,
            isCheckedOut: sampleCart.isCheckedOut,
            fields: Object.keys(sampleCart.toObject || sampleCart)
          } : null
        }
      },
      models: {
        inventoryModel: !!mongoose.models.inventoryModel,
        orderModel: !!mongoose.models.orderModel,
        cartModel: !!mongoose.models.cartModel
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
