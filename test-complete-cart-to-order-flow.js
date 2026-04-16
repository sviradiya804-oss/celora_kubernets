require('dotenv').config();
const mongoose = require('mongoose');
const { v1: uuidv1 } = require('uuid');
const Schema = require('./src/models/schema.js');

// Models
const User = mongoose.models.userModel || mongoose.model('userModel', new mongoose.Schema(Schema.user), 'users');
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = (msg, color = 'reset') => console.log(`${colors[color]}${msg}${colors.reset}`);
const section = (title) => log(`\n${'─'.repeat(65)}\n📋 ${title}\n${'─'.repeat(65)}`, 'cyan');
const success = (msg) => log(`  ✅ ${msg}`, 'green');
const info = (msg) => log(`  ℹ️  ${msg}`, 'blue');
const warn = (msg) => log(`  ⚠️  ${msg}`, 'yellow');
const error = (msg) => log(`  ❌ ${msg}`, 'red');

(async () => {
  try {
    // ═══ CONNECT TO DB ═══════════════════════════════════════════════════════
    log('\n🔌 Connecting to MongoDB...', 'bright');
    const dbUri = process.env.DATABASE_URI;
    await mongoose.connect(dbUri);
    success('Connected');

    // ═══ 1. CREATE TEST USER ═════════════════════════════════════════════════
    section('1. Getting test user');
    
    // Try to find existing user first
    let user = await User.findOne({ email: 'test@checkout.local' });
    
    if (!user) {
      // Create a new test user with all required fields
      user = await User.findOne({}).lean();
      if (!user) {
        error('No users found in database');
        await mongoose.disconnect();
        return;
      }
      info(`Using existing user: ${user.email}`);
    } else {
      success(`Found user: ${user.email}`);
    }
    info(`User ID: ${user._id}`);

    // ═══ 2. CREATE CART ══════════════════════════════════════════════════════
    section('2. Creating new cart');
    
    const sessionId = `session-${Date.now()}`;
    const cartId = uuidv1();
    let cart = new Cart({
      cartId,
      sessionId,
      userId: user._id,
      items: [],
      isCheckedOut: false
    });
    
    info(`Cart ID: ${cartId}`);
    info(`Session ID: ${sessionId}`);

    // ═══ 3. FETCH ACTUAL PRODUCTS ════════════════════════════════════════════
    section('3. Fetching actual products from database');
    
    const products = await Jewelry.find({}).limit(3).lean();
    
    if (products.length === 0) {
      error('No products found in database!');
      await mongoose.disconnect();
      return;
    }
    
    success(`Found ${products.length} products to add to cart`);

    // ═══ 4. ADD PRODUCTS TO CART ═════════════════════════════════════════════
    section('4. Adding products to cart');
    
    let cartSubtotal = 0;
    const cartItems = [];
    
    for (let i = 0; i < Math.min(2, products.length); i++) {
      const product = products[i];
      const quantity = 1;
      const price = product.price || 1000 + i * 100;
      
      const cartItem = {
        productId: product._id,
        quantity,
        priceAtTime: price,
        selectedVariant: null,
        engravingOptions: null
      };
      
      cartItems.push(cartItem);
      cartSubtotal += price * quantity;
      
      info(`Added: "${product.title || product.name}" (${quantity}x) = $${price}`);
    }
    
    cart.items = cartItems;
    await cart.save();
    success(`Cart saved with ${cart.items.length} items | Subtotal: $${cartSubtotal}`);
    info(`Cart ID: ${cart._id}`);

    // ═══ 5. BUILD ORDER FROM CART ════════════════════════════════════════════
    section('5. Building order from cart (simulating checkout)');
    
    const orderProducts = [];
    const orderSubOrders = [];
    let maxDeliveryDays = 5;
    
    for (const item of cart.items) {
      const product = await Jewelry.findById(item.productId).lean();
      if (!product) {
        warn(`Product not found: ${item.productId}`);
        continue;
      }
      
      const productDeliveryDays = product.estimatedDeliveryDays || 5;
      if (productDeliveryDays > maxDeliveryDays) maxDeliveryDays = productDeliveryDays;
      
      const itemPrice = item.priceAtTime || product.price || 0;
      
      // Extract image
      let imageUrl = null;
      if (product.imageUrl && typeof product.imageUrl === 'string') {
        imageUrl = product.imageUrl;
      } else if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        imageUrl = product.images[0];
      } else if (product.images && typeof product.images === 'object') {
        const shapeKeys = ['oval', 'round', 'pear', 'cushion', 'emerald', 'radiant'];
        for (const key of shapeKeys) {
          if (product.images[key] && Array.isArray(product.images[key]) && product.images[key].length > 0) {
            imageUrl = product.images[key][0];
            break;
          }
        }
      }
      
      let category = product.category;
      if (typeof category === 'object' && category.value) {
        category = category.value;
      }
      
      const productDetails = {
        title: product.title || product.name,
        name: product.name || product.title,
        description: product.description,
        images: Array.isArray(product.images) ? product.images : [],
        category: String(category || 'Other'),
        material: product.material,
        metalType: product.metalType || product.metal || '-',
        cadCode: product.cadCode,
        slug: product.slug || null,
        diamondDetails: {
          shape: product.shape || '-',
          diamondType: product.diamondType || '-',
          cut: product.cut || '-',
          clarity: product.clarity || '-',
          caratSize: product.caratSize || '-',
          color: product.color || '-',
          priceWithMargin: product.priceWithMargin || itemPrice || '-'
        },
        ringSize: product.ringSize || '-',
        estimatedDeliveryDays: productDeliveryDays,
        packagingType: product.packagingType || '-'
      };
      
      // Products array (legacy)
      orderProducts.push({
        productId: item.productId,
        quantity: item.quantity,
        type: product.type || 'Premade',
        priceAtTime: itemPrice,
        imageUrl,
        productDetails
      });
      
      // Sub-orders array (new)
      orderSubOrders.push({
        subOrderId: uuidv1(),
        productId: item.productId,
        quantity: item.quantity,
        type: product.type || 'Premade',
        priceAtTime: itemPrice,
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
      
      info(`  [${item.quantity}x] ${product.title || product.name} - $${itemPrice}`);
    }
    
    const expectedDeliveryDate = new Date(Date.now() + maxDeliveryDays * 24 * 60 * 60 * 1000);
    info(`Max delivery days: ${maxDeliveryDays}`);
    info(`Expected delivery date: ${expectedDeliveryDate.toLocaleDateString()}`);

    // ═══ 6. CREATE ORDER ═════════════════════════════════════════════════════
    section('6. Creating order from cart data');
    
    const order = new Order({
      orderId: uuidv1(),
      customer: user._id,
      products: orderProducts,
      subOrders: orderSubOrders,
      total: cartSubtotal,
      subtotal: cartSubtotal,
      discount: 0,
      estimatedDeliveryDays: maxDeliveryDays,
      expectedDeliveryDate,
      status: 'Pending',
      paymentStatus: 'pending',
      paymetmethod: 'test',
      createdBy: user._id,
      updatedBy: user._id,
      referenceId: uuidv1(),
      customerData: {
        email: user.email,
        name: user.name,
        phone: user.phone
      }
    });
    
    await order.save();
    success(`Order created: ${order.orderId}`);
    info(`Order ID: ${order._id}`);

    // ═══ 7. VERIFY ORDER ═════════════════════════════════════════════════════
    section('7. Verifying order from database');
    
    const savedOrder = await Order.findById(order._id);
    
    success(`Order exists in DB`);
    success(`Status: ${savedOrder.status}`);
    success(`Total: $${savedOrder.total}`);
    success(`Estimated Delivery Days: ${savedOrder.estimatedDeliveryDays}`);
    
    if (savedOrder.subOrders && savedOrder.subOrders.length > 0) {
      success(`✅ subOrders present: ${savedOrder.subOrders.length} item(s)`);
      for (let i = 0; i < savedOrder.subOrders.length; i++) {
        const sub = savedOrder.subOrders[i];
        info(`  [${i}] ID: ${sub.subOrderId} | Status: ${sub.status} | Price: $${sub.priceAtTime}`);
      }
    } else {
      error('❌ subOrders missing!');
    }
    
    if (savedOrder.expectedDeliveryDate) {
      success(`✅ expectedDeliveryDate: ${new Date(savedOrder.expectedDeliveryDate).toLocaleDateString()}`);
    } else {
      error('❌ expectedDeliveryDate missing!');
    }

    // ═══ 8. VERIFY PRODUCT DETAILS ═══════════════════════════════════════════
    section('8. Verifying product details captured');
    
    if (savedOrder.products && savedOrder.products[0]) {
      const prod = savedOrder.products[0];
      
      success(`Product Title: ${prod.productDetails?.title}`);
      success(`Price: $${prod.priceAtTime}`);
      success(`Category: ${prod.productDetails?.category}`);
      success(`Cadence Code: ${prod.productDetails?.cadCode}`);
      
      // Image check
      if (prod.imageUrl) {
        success(`✅ Image URL captured: ${prod.imageUrl.substring(0, 60)}...`);
      } else {
        warn(`Image URL not captured`);
      }
      
      // Diamond details check
      const diamond = prod.productDetails?.diamondDetails || {};
      if (diamond.shape && diamond.shape !== '-') {
        success(`Diamond Details captured:`);
        info(`  Shape: ${diamond.shape}`);
        info(`  Type: ${diamond.diamondType}`);
      } else {
        info(`Diamond details not available on product`);
      }
    }

    // ═══ 9. VERIFY SUB-ORDER DETAILS ═════════════════════════════════════════
    section('9. Verifying sub-order details');
    
    if (savedOrder.subOrders && savedOrder.subOrders[0]) {
      const subOrder = savedOrder.subOrders[0];
      
      success(`Sub-Order ID: ${subOrder.subOrderId}`);
      success(`Status: ${subOrder.status}`);
      success(`Product Title: ${subOrder.productDetails?.title}`);
      success(`Has productDetails: ${!!subOrder.productDetails}`);
      success(`Has diamondDetails: ${!!subOrder.productDetails?.diamondDetails}`);
    }

    // ═══ 10. VERIFY CUSTOMER DATA ════════════════════════════════════════════
    section('10. Verifying customer data');
    
    success(`Email: ${savedOrder.customerData?.email}`);
    success(`Name: ${savedOrder.customerData?.name}`);
    success(`Phone: ${savedOrder.customerData?.phone}`);

    // ═══ FINAL SUMMARY ═══════════════════════════════════════════════════════
    section('✨ COMPLETE CART-TO-ORDER FLOW TEST RESULTS');
    
    const checks = {
      'User created': !!user._id,
      'Cart created': !!cart._id,
      'Cart has items': (cart.items && cart.items.length > 0),
      'Order created': !!savedOrder._id,
      'Order has products': (savedOrder.products && savedOrder.products.length > 0),
      'Order has subOrders': (savedOrder.subOrders && savedOrder.subOrders.length > 0),
      'Order has expectedDeliveryDate': !!savedOrder.expectedDeliveryDate,
      'Order has estimatedDeliveryDays': savedOrder.estimatedDeliveryDays > 0,
      'Customer data captured': !!(savedOrder.customerData?.email && savedOrder.customerData?.name),
      'Product details in order': !!(savedOrder.products[0]?.productDetails?.title),
      'Image URL captured': !!savedOrder.products[0]?.imageUrl
    };
    
    let passCount = 0;
    for (const [check, passed] of Object.entries(checks)) {
      if (passed) {
        success(check);
        passCount++;
      } else {
        error(check);
      }
    }
    
    log(`\n${'═'.repeat(65)}`, 'bright');
    log(`  Results: ${passCount}/${Object.keys(checks).length} checks passed`, passCount === Object.keys(checks).length ? 'green' : 'yellow');
    log(`${'═'.repeat(65)}\n`, 'bright');
    
    if (passCount === Object.keys(checks).length) {
      log('🎉 COMPLETE FLOW TEST PASSED - All systems working!', 'green');
    } else {
      log('⚠️  Some checks failed - review above', 'yellow');
    }

    await mongoose.disconnect();

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
})();
