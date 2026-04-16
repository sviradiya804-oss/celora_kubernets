const express = require('express');
const router = express.Router();
const mongoose = require("mongoose");
const Schema = require('../models/schema.js');
const generateInvoice = require('../utils/generateInvoice');
const { sendInvoiceEmail } = require('../utils/emailService');
const path = require('path');
const multer = require('multer');
const { uploadToAzureBlob } = require('../services/azureStorageService');

// Create models
const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');
// Fallback product models used by cart and other routes
const productSchema = new mongoose.Schema(Schema.product);
const jewelrySchema = new mongoose.Schema(Schema.jewelry);
const Product = mongoose.models.productModel || mongoose.model('productModel', productSchema, 'products');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', jewelrySchema, 'jewelrys');

// Configure multer for file uploads (same as payment.js)
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

// Get user orders
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ customer: userId })
      .sort({ createdOn: -1 });

    res.json({
      success: true,
      orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get single order (returns normalized/expanded view)
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    // Populate customer for richer output
    const order = await Order.findOne({ orderId })
      .populate('customer');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Convert to plain object so we can safely modify/augment before returning
    const fullOrder = order.toObject({ getters: true, virtuals: false });

    function normalizeImagesField(imgs) {
      if (!imgs) return [];
      if (Array.isArray(imgs)) {
        return imgs.filter(i => typeof i === 'string' && (i.startsWith('http') || i.startsWith('/')));
      }
      if (typeof imgs === 'object') {
        // imgs may be an object keyed by shape with arrays of urls
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

    // Enrich subOrders with product details (including slug)
    if (Array.isArray(fullOrder.subOrders)) {
      fullOrder.subOrders = await Promise.all(fullOrder.subOrders.map(async (s) => {
        const existingDetails = s.productDetails || {};

        // If productId is populated, merge selective fields into productDetails
        if (s.productId && typeof s.productId === 'object') {
          const populated = s.productId;
          const rawImages = populated.images || existingDetails.images || populated.imageUrl || existingDetails.imageUrl;
          const imagesArr = normalizeImagesField(rawImages);
          const firstImage = imagesArr.length > 0 ? imagesArr[0] : (populated.imageUrl || existingDetails.imageUrl || null);

          const merged = Object.assign({}, existingDetails, {
            _id: populated._id,
            title: populated.title || populated.name,
            name: populated.name || populated.title,
            description: populated.description || existingDetails.description,
            images: imagesArr,
            imageUrl: firstImage,
            price: existingDetails.price || populated.price || 0,
            category: populated.category || existingDetails.category,
            material: populated.material || existingDetails.material,
            cadCode: populated.cadCode || existingDetails.cadCode,
            slug: populated.slug || existingDetails.slug,
            availableMetals: populated.availableMetals || existingDetails.availableMetals,
            pricing: populated.pricing || existingDetails.pricing
          });

          return Object.assign({}, s, { productDetails: merged, productId: populated, imageUrl: firstImage });
        }

        // Not populated: attempt to fetch from known product collections
        try {
          let doc = null;
          if (s.productId) {
            doc = await Jewelry.findById(s.productId).lean();
            if (!doc) doc = await Product.findById(s.productId).lean();
          }

          if (doc) {
            const rawImages = doc.images || doc.imageUrl || existingDetails.images || existingDetails.imageUrl;
            const imagesArr = normalizeImagesField(rawImages);
            const firstImage = imagesArr.length > 0 ? imagesArr[0] : (doc.imageUrl || existingDetails.imageUrl || null);
            const merged = Object.assign({}, existingDetails, {
              _id: doc._id,
              title: doc.title || doc.name,
              name: doc.name || doc.title,
              description: doc.description || existingDetails.description,
              images: imagesArr,
              imageUrl: firstImage,
              price: existingDetails.price || doc.price || 0,
              category: doc.category || existingDetails.category,
              material: doc.material || existingDetails.material,
              cadCode: doc.cadCode || existingDetails.cadCode,
              slug: doc.slug || existingDetails.slug,
              availableMetals: doc.availableMetals || existingDetails.availableMetals,
              pricing: doc.pricing || existingDetails.pricing
            });

            return Object.assign({}, s, { productDetails: merged, productId: doc, imageUrl: firstImage });
          }
        } catch (e) {
          console.warn('Failed to fetch product doc for suborder merge', e.message);
        }

        // Fallback: normalize whatever exists in productDetails
        const rawImages = existingDetails.images || existingDetails.imageUrl;
        const imagesArr = normalizeImagesField(rawImages);
        const firstImage = imagesArr.length > 0 ? imagesArr[0] : (existingDetails.imageUrl || null);
        return Object.assign({}, s, { productDetails: Object.assign({}, existingDetails, { images: imagesArr, imageUrl: firstImage }), imageUrl: firstImage });
      }));
    }

    // Surface payment details at top level for convenience
    fullOrder.payment = fullOrder.paymentDetails || {};

    // Normalize commonly expected fields
    if (!fullOrder.paymentStatus) {
      fullOrder.paymentStatus = fullOrder.payment?.paymentStatus || fullOrder.paymentDetails?.paymentStatus || fullOrder.paymentStatus;
    }

    // Some older code uses 'paymetmethod' (typo) — provide corrected alias
    if (!fullOrder.paymentMethod && fullOrder.paymetmethod) {
      fullOrder.paymentMethod = fullOrder.paymetmethod;
    }

    // Add pricing breakdown for subOrders
    const orderTotal = fullOrder.total || 0;
    const totalSubOrderItems = (fullOrder.subOrders || []).reduce((sum, s) => sum + (s.quantity || 1), 0);

    const subOrderBreakdown = (fullOrder.subOrders || []).map((s, idx) => {
      // Try multiple sources for price (for backward compatibility)
      let unitPrice = s.priceAtTime || s.productDetails?.price || s.price || 0;
      
      // If no price found and we have order total, estimate from total
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
        unitPrice: Math.round(unitPrice * 100) / 100, // Round to 2 decimals
        totalPrice: Math.round(totalPrice * 100) / 100, // Round to 2 decimals
        itemAmount: Math.round(totalPrice * 100) / 100, // Explicit item total amount
        status: s.status,
        variant: s.productDetails?.selectedVariant || null,
        metalDetail: s.productDetails?.metalDetail || null,
        metalType: s.productDetails?.metalType || null
      };
    });

    // Include pricing summary
    fullOrder.pricingBreakdown = {
      subOrders: subOrderBreakdown,
      subtotal: fullOrder.subtotal || fullOrder.total,
      discount: fullOrder.discount || 0,
      total: fullOrder.total || 0
    };

    res.json({
      success: true,
      order: fullOrder
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.post('/complete-order', async (req, res) => {
  try {
    const orderData = req.body;

    const newOrder = new Order({
      ...orderData,
      orderId: require('uuid').v1(),
      referenceId: require('uuid').v1(),
      createdOn: new Date(),
      updatedOn: new Date()
    });

    await newOrder.save();

    const invoiceFilename = `invoice-${newOrder._id}.pdf`;
    const invoicePath = path.join(__dirname, '../uploads/invoices', invoiceFilename);

    // Ensure directory exists
    const fs = require('fs');
    const dir = path.dirname(invoicePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await generateInvoice(newOrder, invoicePath);

    newOrder.invoicePath = `/invoices/${invoiceFilename}`;
    await newOrder.save();

    // Send email with invoice attached
    let emailStatus = null;
    try {
      // Get customer details for email
      const User = mongoose.models.userModel || mongoose.model('userModel', Schema.user, 'users');
      const customer = await User.findById(newOrder.customer);

      if (customer && customer.email) {
        emailStatus = await sendInvoiceEmail(
          customer.email,
          customer.name || 'Customer',
          newOrder.orderId,
          invoicePath
        );
        console.log('Invoice email sent successfully');
      } else {
        console.warn('Customer email not found for order:', newOrder.orderId);
      }
    } catch (emailError) {
      console.error('Failed to send invoice email:', emailError);
      emailStatus = { error: emailError.message };
    }

    res.status(200).json({
      success: true,
      message: 'Order completed and invoice generated.',
      order: newOrder,
      invoiceUrl: newOrder.invoicePath,
      emailStatus,
    });

  } catch (error) {
    console.error('Order processing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Order processing failed',
      error: error.message
    });
  }
});

// Test email functionality with sample images
router.post('/test-email-with-images', async (req, res) => {
  try {
    const {
      email,
      type = 'manufacturing',
      imageUrls = [
        'https://picsum.photos/400/300?random=1',
        'https://picsum.photos/400/300?random=2'
      ], // Default sample images
      orderId = 'TEST-ORDER-123',
      customerName = 'Test Customer'
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required for testing' });
    }

    const emailData = {
      customerName: customerName,
      orderId: orderId,
      orderDate: new Date().toLocaleDateString(),
      trackingId: 'TEST-TRACK-456',
      trackingLink: 'https://tracking.example.com/TEST-TRACK-456'
    };

    const {
      sendOrderConfirmedEmail,
      sendManufacturingEmail,
      sendQualityAssuranceEmail,
      sendOutForDeliveryEmail,
      sendDeliveredEmail,
      sendInvoiceEmail
    } = require('../utils/emailService');

    let emailResult;
    switch (type.toLowerCase()) {
      case 'confirmed':
        emailResult = await sendOrderConfirmedEmail(email, emailData, imageUrls);
        break;
      case 'manufacturing':
        emailResult = await sendManufacturingEmail(email, emailData, imageUrls);
        break;
      case 'quality':
        emailResult = await sendQualityAssuranceEmail(email, emailData, imageUrls);
        break;
      case 'delivery':
        emailResult = await sendOutForDeliveryEmail(email, emailData, imageUrls);
        break;
      case 'delivered':
        emailResult = await sendDeliveredEmail(email, emailData);
        break;
      case 'invoice':
        emailResult = await sendInvoiceEmail(email, customerName, orderId, null);
        break;
      default:
        return res.status(400).json({
          error: 'Invalid type. Use: confirmed, manufacturing, quality, delivery, delivered, invoice'
        });
    }

    res.json({
      success: true,
      message: `Test ${type} email sent successfully with embedded images`,
      emailResult,
      testData: {
        email,
        type,
        imagesUsed: imageUrls,
        imageCount: imageUrls.length,
        emailData
      }
    });

  } catch (error) {
    console.error('Error sending test email with images:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error.message
    });
  }
});
router.post('/test-email', async (req, res) => {
  try {
    const {
      email,
      type = 'confirmed',
      imageUrls = [],
      orderId = 'TEST-ORDER-123',
      customerName = 'Test Customer'
    } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required for testing' });
    }

    const emailData = {
      customerName: customerName,
      orderId: orderId,
      orderDate: new Date().toLocaleDateString(),
      trackingId: 'TEST-TRACK-456',
      trackingLink: 'https://tracking.example.com/TEST-TRACK-456',
      date: new Date().toLocaleDateString()
    };

    const {
      sendOrderConfirmedEmail,
      sendManufacturingEmail,
      sendQualityAssuranceEmail,
      sendOutForDeliveryEmail,
      sendDeliveredEmail,
      sendInvoiceEmail
    } = require('../utils/emailService');

    let emailResult;
    switch (type.toLowerCase()) {
      case 'confirmed':
        emailResult = await sendOrderConfirmedEmail(email, emailData, imageUrls);
        break;
      case 'manufacturing':
        emailResult = await sendManufacturingEmail(email, emailData, imageUrls);
        break;
      case 'quality':
        emailResult = await sendQualityAssuranceEmail(email, emailData, imageUrls);
        break;
      case 'delivery':
        emailResult = await sendOutForDeliveryEmail(email, emailData, imageUrls);
        break;
      case 'delivered':
        emailResult = await sendDeliveredEmail(email, emailData);
        break;
      case 'invoice':
        // For testing invoice without actual PDF
        emailResult = await sendInvoiceEmail(email, customerName, orderId, null);
        break;
      default:
        return res.status(400).json({
          error: 'Invalid type. Use: confirmed, manufacturing, quality, delivery, delivered, invoice'
        });
    }

    res.json({
      success: true,
      message: `Test ${type} email sent successfully`,
      emailResult,
      testData: {
        email,
        type,
        imagesAttached: imageUrls.length,
        emailData
      }
    });

  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error.message
    });
  }
});

// Update order status with email notification (PUT /api/orders/:orderId/status)
router.put('/:orderId/status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const {
      newStatus,
      statusMessage,
      customerEmail,
      images = []
    } = req.body;

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        error: 'newStatus is required'
      });
    }

    // Find order
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Update order status
    order.status = newStatus;
    order.updatedOn = new Date();
    await order.save();

    // Get customer information
    let customer = null;
    if (customerEmail) {
      // Use provided email
      customer = { email: customerEmail, name: 'Customer' };
    } else {
      // Try to get customer from order
      const User = mongoose.models.userModel || mongoose.model('userModel', Schema.user, 'users');
      customer = await User.findById(order.customer);
    }

    if (!customer || !customer.email) {
      return res.status(400).json({
        success: false,
        error: 'Customer email not found'
      });
    }

    // Send unified email notification
    const { sendUnifiedOrderEmail } = require('../utils/unifiedEmailService');

    const emailData = {
      customerEmail: customer.email,
      customerName: customer.name || 'Customer',
      orderId: order.orderId,
      newStatus: newStatus,
      statusMessage: statusMessage || `Your order status has been updated to ${newStatus}.`,
      total: order.total || 0,
      subOrders: order.subOrders || [],
      images: images,
      showNextSteps: true
    };

    const emailResult = await sendUnifiedOrderEmail(emailData);

    res.json({
      success: true,
      message: `Order status updated to ${newStatus} and email notification sent`,
      order: {
        orderId: order.orderId,
        status: order.status,
        updatedOn: order.updatedOn
      },
      emailSent: emailResult.success,
      emailResult: emailResult
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
      details: error.message
    });
  }
});

// Manual email trigger for order status (useful for testing)
router.post('/send-status-email', async (req, res) => {
  try {
    const { orderId, status, imageUrls = [] } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({
        error: 'orderId and status are required'
      });
    }

    const order = await Order.findOne({ orderId }).populate('customer');
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get customer email
    const User = mongoose.models.userModel || mongoose.model('userModel', Schema.user, 'users');
    const customer = await User.findById(order.customer);

    if (!customer || !customer.email) {
      return res.status(400).json({ error: 'Customer email not found' });
    }

    const emailData = {
      customerName: customer.name || 'Customer',
      orderId: order.orderId,
      trackingId: order.progress?.outForDelivery?.trackingId || '',
      trackingLink: order.progress?.outForDelivery?.trackingLink || ''
    };

    // Import email functions
    const {
      sendOrderConfirmedEmail,
      sendManufacturingEmail,
      sendQualityAssuranceEmail,
      sendOutForDeliveryEmail,
      sendDeliveredEmail
    } = require('../utils/emailService');

    let emailResult;
    switch (status) {
      case 'Confirmed':
        emailResult = await sendOrderConfirmedEmail(customer.email, emailData, imageUrls);
        break;
      case 'Manufacturing':
        emailResult = await sendManufacturingEmail(customer.email, emailData, imageUrls);
        break;
      case 'Quality Assurance':
        emailResult = await sendQualityAssuranceEmail(customer.email, emailData, imageUrls);
        break;
      case 'Out For Delivery':
        emailResult = await sendOutForDeliveryEmail(customer.email, emailData, imageUrls);
        break;
      case 'Delivered':
        emailResult = await sendDeliveredEmail(customer.email, emailData);
        break;
      default:
        return res.status(400).json({ error: 'Invalid status' });
    }

    res.json({
      success: true,
      message: `${status} email sent successfully`,
      emailResult,
      imagesAttached: imageUrls.length
    });

  } catch (error) {
    console.error('Error sending status email:', error);
    res.status(500).json({
      error: 'Failed to send status email',
      details: error.message
    });
  }
});

// ─── Sub-order routes ─────────────────────────────────────────────────────────

// GET /:orderId/suborders — list all sub-orders for a main order
router.get('/:orderId/suborders', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Smart price calculation for backward compatibility
    const orderTotal = order.total || 0;
    const totalSubOrderItems = (order.subOrders || []).reduce((sum, s) => sum + (s.quantity || 1), 0);

    // Enhance suborders with pricing details
    const enhancedSubOrders = (order.subOrders || []).map((s, idx) => {
      let unitPrice = s.priceAtTime || s.productDetails?.price || s.price || 0;
      
      // If no price found and we have order total, estimate from total
      if (unitPrice === 0 && orderTotal > 0 && totalSubOrderItems > 0) {
        unitPrice = orderTotal / totalSubOrderItems;
      }
      
      const quantity = s.quantity || 1;
      const totalPrice = unitPrice * quantity;
      
      return {
        ...s.toObject ? s.toObject() : s,
        unitPrice: Math.round(unitPrice * 100) / 100,
        totalPrice: Math.round(totalPrice * 100) / 100,
        itemAmount: Math.round(totalPrice * 100) / 100, // Explicit item total
        title: s.productDetails?.title || s.productDetails?.name || `Item ${idx + 1}`,
        slug: s.productDetails?.slug || null,
        metalDetail: s.productDetails?.metalDetail || null,
        metalType: s.productDetails?.metalType || null
      };
    });

    res.json({
      success: true,
      orderId: order.orderId,
      mainStatus: order.status,
      totalAmount: order.total,
      subOrderCount: enhancedSubOrders.length,
      subOrders: enhancedSubOrders
    });
  } catch (error) {
    console.error('Error fetching sub-orders:', error);
    res.status(500).json({ error: 'Failed to fetch sub-orders', details: error.message });
  }
});

// PUT /:orderId/suborder/:subOrderId/status — update one sub-order's status and send email
// Also auto-updates the main order:
//   • If ALL sub-orders are Delivered → main order → Delivered
//   • Otherwise main order stays as-is (managed separately via /:orderId/status)
//   • Sends email with MAIN ORDER ID prominent in all communications
const subOrderStatusHandler = async (req, res) => {
  try {
    const { orderId, subOrderId } = req.params;
    const {
      newStatus: _newStatus,
      status: _status,
      trackingId,
      trackingLink,
      statusMessage
    } = req.body;
    const newStatus = _newStatus || _status;

    // DEBUG LOGGING
    console.log(`[DEBUG] PUT /orders/${orderId}/suborder/${subOrderId}/status`);
    console.log(`[DEBUG] Looking for order: "${orderId}"`);
    console.log(`[DEBUG] Looking for suborder: "${subOrderId}"`);

    const VALID_STATUSES = ['Pending', 'Confirmed', 'Manufacturing', 'Quality Assurance', 'Out For Delivery', 'Delivered', 'Cancelled'];
    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return res.status(400).json({
        error: `newStatus is required and must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    console.log(`[DEBUG] Found order: ${orderId}, suborders: ${order.subOrders.length}`);
    order.subOrders.forEach((sub, idx) => {
      console.log(`[DEBUG]   [${idx}] subOrderId: "${sub.subOrderId}" | Match: ${sub.subOrderId === subOrderId}`);
    });

    const subOrder = order.subOrders.find(s => s.subOrderId === subOrderId);
    if (!subOrder) return res.status(404).json({ error: 'Sub-order not found' });

    // Upload image to Azure if provided (multipart/form-data file upload)
    // Accepts any field name (statusImage, progress[confirmed][confirmedImages], etc.)
    const uploadedFile = req.file || (req.files && req.files[0]);
    let azureImageUrl = null;
    let images = [];
    if (uploadedFile) {
      try {
        console.log("✅ Uploading sub-order status image to Azure...");
        azureImageUrl = await uploadToAzureBlob(uploadedFile.buffer, uploadedFile.originalname, 'order-status-images');
        images = [azureImageUrl];
        console.log("✅ Sub-order status image uploaded to Azure:", azureImageUrl);
      } catch (uploadError) {
        console.error("❌ Failed to upload sub-order status image to Azure:", uploadError);
        // Continue without image rather than failing the whole request
      }
    }

    // Update sub-order status
    subOrder.status = newStatus;

    // Update sub-order progress timestamps (mirrors main order progress logic)
    const now = new Date();
    if (!subOrder.progress) subOrder.progress = {};

    switch (newStatus) {
      case 'Confirmed':
        subOrder.progress.confirmed = { date: now, confirmedImages: images };
        break;
      case 'Manufacturing':
        subOrder.progress.manufacturing = { date: now, manufacturingImages: images };
        break;
      case 'Quality Assurance':
        subOrder.progress.qualityAssurance = { date: now, qualityAssuranceImages: images };
        break;
      case 'Out For Delivery':
        subOrder.progress.outForDelivery = {
          date: now,
          outForDeliveryImages: images,
          trackingId: trackingId || '',
          trackingLink: trackingLink || ''
        };
        break;
      case 'Delivered':
        subOrder.progress.delivered = { date: now };
        break;
    }

    // Auto-update main order status:
    // If every sub-order is Delivered → main order becomes Delivered
    const allDelivered = order.subOrders.every(s => s.status === 'Delivered');
    if (allDelivered) {
      order.status = 'Delivered';
    }

    order.updatedOn = new Date();
    await order.save();

    // ========== SEND EMAIL WITH MAIN ORDER ID ==========
    let emailSent = false;
    let emailLog = null;

    try {
      const User = mongoose.models.userModel || mongoose.model('userModel', Schema.user, 'users');
      const customer = await User.findById(order.customer);

      if (customer && customer.email) {
        const { sendUnifiedOrderEmail } = require('../utils/unifiedEmailService');

        // Prepare email data with MAIN ORDER ID prominent
        const emailData = {
          customerEmail: customer.email,
          customerName: customer.name || 'Valued Customer',
          orderId: order.orderId,                    // ← MAIN ORDER ID (REQUIRED in all emails)
          subOrderId: subOrder.subOrderId,           // ← SUB-ORDER ID reference
          newStatus: newStatus,
          statusMessage: statusMessage || getDefaultStatusMessage(newStatus),
          total: order.total || 0,
          
          // Include context showing other sub-orders
          subOrderCount: order.subOrders.length,
          updatedSubOrderCount: 1,  // This specific sub-order is being updated
          subOrders: order.subOrders.map(s => ({
            subOrderId: s.subOrderId,
            status: s.status,
            productId: s.productId,
            isCurrentSubOrder: s.subOrderId === subOrderId,
            // Add item display info for template
            itemCount: order.subOrders.length,
            updatedItemCount: 1
          })),
          
          // Product details
          products: [subOrder],
          images: images || [],
          
          // Tracking info for delivery stages
          trackingInfo: {
            trackingId: trackingId || null,
            trackingLink: trackingLink || null,
            hasTracking: !!(trackingId || trackingLink)
          },
          
          showNextSteps: true,
          isSubOrderUpdate: true  // Flag for template to show this is sub-order specific
        };

        // Send email
        const emailResult = await sendUnifiedOrderEmail(emailData);
        emailSent = emailResult.success;

        // Log email in order's emailLog
        if (!order.emailLog) order.emailLog = [];
        emailLog = {
          stage: `SubOrder-${subOrderId}-${newStatus}`,
          sentAt: new Date(),
          success: emailResult.success,
          subOrderId: subOrderId,
          imagesCount: images.length,
          error: emailResult.success ? null : emailResult.error
        };
        order.emailLog.push(emailLog);
        await order.save();

        console.log(`✅ Email sent for sub-order ${subOrderId} update to ${newStatus} with main Order ID: ${orderId}`);
      }
    } catch (emailError) {
      console.error(`⚠️ Email failed for sub-order ${subOrderId}:`, emailError.message);
      // Don't fail the request if email fails - order is still updated
    }

    res.json({
      success: true,
      message: `Sub-order ${subOrderId} updated to ${newStatus}`,
      mainOrderStatus: order.status,
      subOrder: {
        subOrderId: subOrder.subOrderId,
        status: subOrder.status,
        progress: subOrder.progress
      },
      allSubOrders: order.subOrders.map(s => ({
        subOrderId: s.subOrderId,
        status: s.status,
        productId: s.productId
      })),
      emailSent: emailSent,
      emailLog: emailLog || null
    });
  } catch (error) {
    console.error('Error updating sub-order status:', error);
    res.status(500).json({ error: 'Failed to update sub-order status', details: error.message });
  }
};

router.put('/:orderId/suborder/:subOrderId/status', upload.any(), subOrderStatusHandler);
router.patch('/:orderId/suborder/:subOrderId/status', upload.any(), subOrderStatusHandler);

/**
 * Helper function to get default status message
 */
function getDefaultStatusMessage(status) {
  const messages = {
    'Confirmed': 'Your order has been confirmed and is being prepared for manufacturing.',
    'Manufacturing': 'Your jewelry is being carefully crafted by our master artisans.',
    'Quality Assurance': 'We are conducting quality checks to ensure your piece meets our standards.',
    'Out For Delivery': 'Your precious item is on its way to you!',
    'Delivered': 'Your order has been delivered. Thank you for your business!',
    'Cancelled': 'This order has been cancelled.'
  };
  return messages[status] || `Your order status has been updated to ${status}.`;
}

module.exports = router;