/**
 * Test: Verify Packaging & Product Images in Order
 * Run: node test-packaging-images.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Schema = require('./src/models/schema');
const { v4: uuidv4 } = require('uuid');
const { calculateCartSummary } = require('./src/utils/cartHelper');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/celoradb');

// Models
const User = mongoose.models.userModel || mongoose.model('userModel', new mongoose.Schema(Schema.user), 'users');
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const Packaging = mongoose.models.packagingModel || mongoose.model('packagingModel', new mongoose.Schema(Schema.packaging || {}), 'packaging');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function section(title) {
  log(`\n${'═'.repeat(70)}`, 'blue');
  log(`${title}`, 'cyan');
  log(`${'═'.repeat(70)}`, 'blue');
}

async function main() {
  try {
    section('TEST: Packaging & Images in Order');

    // Step 1: Create or find user
    log('\n→ Step 1: Create User', 'yellow');
    let user = await User.findOne({ email: 'test-packaging@celora.com' });
    if (!user) {
      user = new User({
        userId: uuidv4(),
        email: 'test-packaging@celora.com',
        name: 'Test User',
        phone: '9876543210',
        createdOn: new Date()
      });
      await user.save();
      log(`✓ User created: ${user.email}`, 'green');
    } else {
      log(`✓ User found: ${user.email}`, 'green');
    }

    // Step 2: Get a product with images
    log('\n→ Step 2: Get Product with Images', 'yellow');
    const product = await Jewelry.findOne({ images: { $exists: true, $ne: [] } }).lean();
    if (!product) {
      log(`✗ No product with images found`, 'red');
      process.exit(1);
    }
    log(`✓ Product found: ${product.title}`, 'green');
    log(`  Images: ${product.images?.length || 0} images`, 'cyan');
    product.images?.forEach((img, i) => {
      console.log(`    [${i}] ${img.substring(0, 60)}...`);
    });

    // Step 3: Create cart with packaging
    log('\n→ Step 3: Create Cart with Product', 'yellow');
    const cart = new Cart({
      cartId: uuidv4(),
      sessionId: `test-session-${Date.now()}`,
      userId: user._id,
      items: [
        {
          itemId: uuidv4(),
          productId: product._id,
          quantity: 1,
          priceAtTime: product.price || 5000,
          packaging: null,  // No packaging for this test
          selectedVariant: {}
        }
      ],
      currency: 'usd'
    });
    await cart.save();
    log(`✓ Cart created`, 'green');

    // Step 4: Build order like checkout does
    log('\n→ Step 4: Create Order (Simulating Checkout)', 'yellow');
    const summary = await calculateCartSummary(cart);
    
    const orderProducts = [];
    for (const item of cart.items) {
      const prod = await Jewelry.findById(item.productId).lean();
      
      const productDetails = {
        title: prod.title || prod.name,
        name: prod.name,
        description: prod.description,
        images: prod.images || [],  // IMPORTANT: Full array
        imageUrl: (prod.images && prod.images[0]) || null,  // First image
        price: prod.price || item.priceAtTime || 0,
        cadCode: prod.cadCode,
        slug: prod.slug || null,
        material: prod.material,
        metalType: prod.metalType || '-',
        packaging: item.packaging || null,  // IMPORTANT: Packaging ObjectId
        packagingType: prod.packagingType || '-'
      };

      orderProducts.push({
        productId: item.productId,
        productDetails,
        imageUrl: productDetails.imageUrl,
        priceAtTime: item.priceAtTime,
        quantity: item.quantity || 1
      });
    }

    const order = new Order({
      orderId: `TEST-${uuidv4()}`,
      customer: user._id,
      products: orderProducts,
      subOrders: [],
      subtotal: summary.subtotal,
      total: summary.total,
      status: 'Pending',
      paymentStatus: 'pending',
      createdOn: new Date()
    });
    await order.save();
    log(`✓ Order created: ${order.orderId}`, 'green');

    // Step 5: Retrieve and verify
    log('\n→ Step 5: Verify Order Data', 'yellow');
    const savedOrder = await Order.findById(order._id).lean();
    
    if (!savedOrder) {
      log('✗ Order not found', 'red');
      process.exit(1);
    }

    log(`\nOrder ID: ${savedOrder.orderId}`, 'cyan');
    
    savedOrder.products?.forEach((prod, idx) => {
      log(`\n  Product ${idx + 1}:`, 'cyan');
      log(`    Title: ${prod.productDetails?.title}`, 'blue');
      log(`    Price: ${prod.priceAtTime}`, 'blue');
      log(`    Slug: ${prod.productDetails?.slug}`, 'blue');
      
      // Check images
      const images = prod.productDetails?.images;
      if (images && Array.isArray(images) && images.length > 0) {
        log(`    ✓ Images Array: ${images.length} images`, 'green');
        images.slice(0, 2).forEach((img, i) => {
          console.log(`      [${i}] ${img.substring(0, 60)}...`);
        });
      } else {
        log(`    ✗ Images Array: MISSING or empty`, 'red');
      }

      // Check imageUrl
      if (prod.imageUrl) {
        log(`    ✓ Image URL: ${prod.imageUrl.substring(0, 60)}...`, 'green');
      } else {
        log(`    ✗ Image URL: MISSING`, 'red');
      }

      // Check packaging
      if (prod.productDetails?.packaging) {
        log(`    ✓ Packaging ObjectId: ${prod.productDetails.packaging}`, 'green');
      } else {
        log(`    ✗ Packaging ObjectId: MISSING or null`, 'red');
      }

      if (prod.productDetails?.packagingType) {
        log(`    ✓ Packaging Type: ${prod.productDetails.packagingType}`, 'green');
      } else {
        log(`    ✗ Packaging Type: MISSING`, 'red');
      }
    });

    // Final summary
    section('TEST RESULTS');
    const checks = {
      'Order created': !!savedOrder,
      'Product title saved': !!savedOrder.products?.[0]?.productDetails?.title,
      'Images array saved': Array.isArray(savedOrder.products?.[0]?.productDetails?.images) && savedOrder.products?.[0]?.productDetails?.images.length > 0,
      'Image URL saved': !!savedOrder.products?.[0]?.imageUrl,
      'Slug saved': !!savedOrder.products?.[0]?.productDetails?.slug,
      'Packaging type saved': !!savedOrder.products?.[0]?.productDetails?.packagingType
    };

    let passed = 0;
    let failed = 0;
    Object.entries(checks).forEach(([check, result]) => {
      if (result) {
        log(`✓ ${check}`, 'green');
        passed++;
      } else {
        log(`✗ ${check}`, 'red');
        failed++;
      }
    });

    log(`\n✅ Results: ${passed}/${Object.keys(checks).length} checks passed`, passed === Object.keys(checks).length ? 'green' : 'red');

    await mongoose.disconnect();
  } catch (err) {
    log(`✗ Error: ${err.message}`, 'red');
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
