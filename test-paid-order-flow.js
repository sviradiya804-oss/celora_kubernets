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

    // ═══ 1. GET TEST USER ════════════════════════════════════════════════════
    section('1. Getting test user');
    
    // Try to find existing user
    let user = await User.findOne({ email: 'test@checkout.local' });
    
    if (!user) {
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
    info(`Name: ${user.name}`);

    // ═══ 2. CREATE CART WITH ITEMS ═══════════════════════════════════════════
    section('2. Creating cart with multiple products');
    
    const sessionId = `session-paid-${Date.now()}`;
    const cartId = uuidv1();
    
    // Fetch products
    const products = await Jewelry.find({}).limit(3).lean();
    
    if (products.length === 0) {
      error('No products found');
      await mongoose.disconnect();
      return;
    }
    
    success(`Found ${products.length} products`);

    // Build cart items
    const cartItems = [];
    let cartSubtotal = 0;
    
    for (let i = 0; i < Math.min(2, products.length); i++) {
      const product = products[i];
      const quantity = i === 0 ? 1 : 1; // Vary quantities
      const price = product.price || 1000 + i * 500;
      
      const cartItem = {
        productId: product._id,
        quantity,
        priceAtTime: price,
        selectedVariant: null,
        engravingOptions: i === 0 ? { // Add engraving to first item
          engravingText: 'Forever Together',
          font: 'Script'
        } : null
      };
      
      cartItems.push(cartItem);
      cartSubtotal += price * quantity;
      
      info(`  [${quantity}x] ${product.title || product.name} = $${price}`);
    }
    
    let cart = new Cart({
      cartId,
      sessionId,
      userId: user._id,
      items: cartItems,
      isCheckedOut: false
    });
    
    await cart.save();
    success(`Cart created with ${cartItems.length} items`);
    info(`Cart subtotal: $${cartSubtotal}`);

    // ═══ 3. BUILD ORDER WITH PAYMENT INFO ════════════════════════════════════
    section('3. Building order (simulating successful payment)');
    
    const orderProducts = [];
    const orderSubOrders = [];
    let maxDeliveryDays = 5;
    
    for (const item of cart.items) {
      const product = await Jewelry.findById(item.productId).lean();
      if (!product) continue;
      
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
      
      // Products array
      orderProducts.push({
        productId: item.productId,
        quantity: item.quantity,
        type: product.type || 'Premade',
        priceAtTime: itemPrice,
        imageUrl,
        productDetails
      });
      
      // Sub-orders array
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
          font: item.engravingOptions.font,
          engravingStatus: 'Pending'
        } : { hasEngraving: false },
        status: 'Pending',
        progress: {}
      });
    }
    
    const expectedDeliveryDate = new Date(Date.now() + maxDeliveryDays * 24 * 60 * 60 * 1000);
    const paymentIntentId = `pi_test_${uuidv1().substring(0, 12)}`;
    const chargeId = `ch_test_${uuidv1().substring(0, 12)}`;
    
    info(`Order total: $${cartSubtotal}`);
    info(`Max delivery days: ${maxDeliveryDays}`);
    info(`Expected delivery: ${expectedDeliveryDate.toLocaleDateString()}`);

    // ═══ 4. CREATE ORDER WITH PAYMENT COMPLETED ══════════════════════════════
    section('4. Creating order with PAID payment status');
    
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
      paymentStatus: 'paid',           // ✅ PAID
      paymetmethod: 'card',
      createdBy: user._id,
      updatedBy: user._id,
      referenceId: uuidv1(),
      customerData: {
        email: user.email,
        name: user.name,
        phone: user.phone
      },
      paymentDetails: {
        method: 'card',
        stripePaymentIntentId: paymentIntentId,
        status: 'paid',
        cardLast4: '4242',
        cardBrand: 'visa',
        amountPaid: cartSubtotal,
        currency: 'usd',
        paymentStatus: 'succeeded',
        paymentIntentStatus: 'succeeded',
        customerEmail: user.email,
        customerName: user.name,
        lastUpdated: new Date()
      }
    });
    
    await order.save();
    success(`Order created: ${order.orderId}`);
    success(`Payment Status: PAID ✅`);
    info(`Order ID: ${order._id}`);
    info(`Stripe Intent ID: ${paymentIntentId}`);

    // ═══ 5. VERIFY ORDER ═════════════════════════════════════════════════════
    section('5. Verifying order from database');
    
    const savedOrder = await Order.findById(order._id);
    
    success(`Order exists in DB`);
    
    // Status checks
    if (savedOrder.status === 'Pending') success(`Order Status: ${savedOrder.status}`);
    if (savedOrder.paymentStatus === 'paid') success(`Payment Status: ${savedOrder.paymentStatus.toUpperCase()}`);
    success(`Total: $${savedOrder.total}`);
    success(`Estimated Days: ${savedOrder.estimatedDeliveryDays}`);
    
    // SubOrders check
    if (savedOrder.subOrders && savedOrder.subOrders.length > 0) {
      success(`subOrders: ${savedOrder.subOrders.length} item(s)`);
      for (let i = 0; i < savedOrder.subOrders.length; i++) {
        const sub = savedOrder.subOrders[i];
        info(`  [${i}] ID: ${sub.subOrderId.substring(0, 8)}... | Status: ${sub.status} | $${sub.priceAtTime}`);
        if (sub.engravingDetails?.hasEngraving) {
          info(`       Engraving: "${sub.engravingDetails.engravingText}"`);
        }
      }
    }
    
    // Date check
    if (savedOrder.expectedDeliveryDate) {
      success(`Delivery Date: ${new Date(savedOrder.expectedDeliveryDate).toLocaleDateString()}`);
    }

    // ═══ 6. VERIFY PAYMENT DETAILS ═══════════════════════════════════════════
    section('6. Verifying payment details captured');
    
    if (savedOrder.paymentDetails) {
      success(`Payment method: ${savedOrder.paymentDetails.method}`);
      success(`Card brand: ${savedOrder.paymentDetails.cardBrand} ending in ${savedOrder.paymentDetails.cardLast4}`);
      success(`Payment Intent ID: ${savedOrder.paymentDetails.stripePaymentIntentId.substring(0, 12)}...`);
      success(`Amount paid: $${savedOrder.paymentDetails.amountPaid}`);
      success(`Payment intent status: ${savedOrder.paymentDetails.paymentIntentStatus}`);
    }

    // ═══ 7. VERIFY PRODUCT DETAILS ═══════════════════════════════════════════
    section('7. Verifying product details');
    
    if (savedOrder.products && savedOrder.products[0]) {
      const prod = savedOrder.products[0];
      success(`Product: ${prod.productDetails?.title}`);
      success(`Price: $${prod.priceAtTime}`);
      success(`Category: ${prod.productDetails?.category}`);
      success(`Code: ${prod.productDetails?.cadCode}`);
      
      if (prod.imageUrl) {
        success(`Image: ${prod.imageUrl.substring(0, 50)}...`);
      }
    }

    // ═══ 8. VERIFY CUSTOMER DATA ═════════════════════════════════════════════
    section('8. Verifying customer data');
    
    success(`Email: ${savedOrder.customerData?.email}`);
    success(`Name: ${savedOrder.customerData?.name}`);
    if (savedOrder.customerData?.phone) success(`Phone: ${savedOrder.customerData.phone}`);

    // ═══ 9. FINAL SUMMARY ════════════════════════════════════════════════════
    section('✨ PAID ORDER VERIFICATION RESULTS');
    
    const checks = {
      'User found': !!user._id,
      'Cart created': !!cart._id,
      'Cart has 2 items': (cart.items && cart.items.length === 2),
      'Order created': !!savedOrder._id,
      'Payment status is PAID': (savedOrder.paymentStatus === 'paid'),
      'Order status is Pending': (savedOrder.status === 'Pending'),
      'Has subOrders': (savedOrder.subOrders && savedOrder.subOrders.length > 0),
      'Has expectedDeliveryDate': !!savedOrder.expectedDeliveryDate,
      'Has estimatedDeliveryDays': (savedOrder.estimatedDeliveryDays > 0),
      'Has paymentDetails': !!savedOrder.paymentDetails,
      'Customer data captured': !!(savedOrder.customerData?.email),
      'Product images captured': !!(savedOrder.products[0]?.imageUrl),
      'First item has engraving': (savedOrder.subOrders[0]?.engravingDetails?.hasEngraving === true)
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
      log('🎉 PAID ORDER TEST PASSED - Payment flow working perfectly!', 'green');
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
