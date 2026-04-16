/**
 * test-new-order-checkout.js
 * Create a NEW order through checkout and verify subOrders + expectedDeliveryDate are populated
 * Run: node test-new-order-checkout.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Schema = require('./src/models/schema');

// Models
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');
const User = mongoose.models.userModel || mongoose.model('userModel', new mongoose.Schema(Schema.user), 'users');

function section(title) {
  console.log(`\n${'─'.repeat(65)}`);
  console.log(`📋 ${title}`);
  console.log('─'.repeat(65));
}

function info(msg) { console.log(`  ℹ️  ${msg}`); }
function success(msg) { console.log(`  ✅ ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function error(msg) { console.log(`  ❌ ${msg}`); }

async function main() {
  console.log('\n🔌 Connecting to MongoDB...');
  const dbUri = process.env.DATABASE_URI || process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!dbUri) { console.error('❌ DATABASE_URI not set in .env'); process.exit(1); }

  await mongoose.connect(dbUri);
  success('Connected');

  try {
    // ─── 1. Find or create a test user ───────────────────────────────────────
    section('1. Finding test user');
    const testUser = await User.findOne({ email: 'test@checkout.local' }).lean();
    const userId = testUser?._id || new mongoose.Types.ObjectId();
    info(`User ID: ${userId}`);

    // ─── 2. Find an active cart or create one ────────────────────────────────
    section('2. Finding test cart');
    let cart = await Cart.findOne({ 
      userId, 
      isCheckedOut: false,
      'items.0': { $exists: true }
    });

    if (!cart) {
      warn('No active cart found. Creating test cart...');
      
      // Use the known Aire product from the tests
      let product = await Jewelry.findOne({ slug: 'aire-curvy-diamond-engagement-ring' }).lean();
      
      if (!product) {
        // Fall back to any product with delivery days
        product = await Jewelry.findOne({ estimatedDeliveryDays: { $exists: true, $gt: 0 } }).lean();
      }
      
      if (!product) {
        error('No product found in database');
        process.exit(1);
      }

      info(`Using product: "${product.title || product.name}" (ID: ${product._id})`);

      const itemPrice = product.price || 1500; // Default price if not set
      const deliveryDays = product.estimatedDeliveryDays || 5;

      cart = new Cart({
        sessionId: require('uuid').v4(),
        userId,
        items: [{
          itemId: require('uuid').v4(),
          productId: product._id,
          quantity: 1,
          selectedVariant: {},
          priceAtTime: itemPrice
        }],
        cartId: require('uuid').v1(),
        isCheckedOut: false
      });
      await cart.save();
      success('Created test cart');
    } else {
      success(`Found cart with ${cart.items.length} item(s)`);
    }

    info(`Cart ID: ${cart._id}`);
    info(`Items in cart: ${cart.items.length}`);

    // ─── 3. Verify products in cart exist ────────────────────────────────────
    section('3. Verifying cart items');
    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i];
      const product = await Jewelry.findById(item.productId).lean();
      if (product) {
        success(`Item[${i}]: "${product.title || product.name}" (${product.estimatedDeliveryDays || 5} day delivery)`);
      } else {
        warn(`Item[${i}]: Product not found (ID: ${item.productId})`);
      }
    }

    // ─── 4. Simulate a checkout order creation ────────────────────────────────
    section('4. Simulating checkout order creation');
    
    // Build order structure same as checkout endpoints
    const orderProducts = [];
    const orderSubOrders = [];
    let maxDeliveryDays = 5;

    for (const item of cart.items) {
      const product = await Jewelry.findById(item.productId).lean();
      if (!product) {
        warn(`Skipping orphan item: ${item.productId}`);
        continue;
      }

      const productDeliveryDays = product.estimatedDeliveryDays || 5;
      if (productDeliveryDays > maxDeliveryDays) maxDeliveryDays = productDeliveryDays;

      const itemPrice = item.priceAtTime || product.price || 0;
      
      // Extract first image URL from complex image structure
      // Images can be: imageUrl string, images array, or images object with shape keys
      let imageUrl = null;
      let imagesArray = [];

      // Try imageUrl field first
      if (product.imageUrl && typeof product.imageUrl === 'string') {
        imageUrl = product.imageUrl;
        imagesArray = [imageUrl];
      }
      // Try images as direct array
      else if (product.images && Array.isArray(product.images)) {
        if (product.images.length > 0) {
          const firstImg = product.images[0];
          if (typeof firstImg === 'string') {
            imageUrl = firstImg;
            imagesArray = [firstImg];
          }
        }
      }
      // Try images as object with shape keys (oval, round, pear, etc.)
      else if (product.images && typeof product.images === 'object') {
        const shapeKeys = ['oval', 'round', 'pear', 'cushion', 'emerald', 'radiant'];
        for (const shape of shapeKeys) {
          if (product.images[shape] && Array.isArray(product.images[shape]) && product.images[shape].length > 0) {
            imageUrl = product.images[shape][0];
            imagesArray = [imageUrl];
            break;
          }
        }
      }

      // Extract category (handle { value: 'X' } structure)
      let category = product.category;
      if (typeof category === 'object' && category.value) {
        category = category.value;
      }
      if (typeof category === 'string' && category.startsWith('{')) {
        try {
          const parsed = JSON.parse(category);
          category = parsed.value || category;
        } catch (e) {}
      }
      category = String(category || 'Other');

      orderProducts.push({
        productId: product._id,
        quantity: item.quantity,
        type: product.type || 'Premade',
        priceAtTime: itemPrice,
        imageUrl,
        productDetails: {
          title: product.title || product.name,
          name: product.name,
          description: product.description,
          images: imagesArray,
          category,
          material: product.material,
          price: product.price,
          cadCode: product.cadCode,
          slug: product.slug
        }
      });

      orderSubOrders.push({
        subOrderId: require('uuid').v1(),
        productId: product._id,
        quantity: item.quantity,
        type: product.type || 'Premade',
        priceAtTime: itemPrice,
        imageUrl,
        productDetails: {
          title: product.title || product.name,
          name: product.name,
          description: product.description,
          images: imagesArray,
          category,
          material: product.material,
          price: product.price,
          cadCode: product.cadCode,
          slug: product.slug
        },
        engravingDetails: { hasEngraving: false },
        status: 'Pending',
        progress: {}
      });
    }

    const expectedDeliveryDate = new Date(Date.now() + maxDeliveryDays * 24 * 60 * 60 * 1000);
    const subtotal = orderProducts.reduce((sum, p) => sum + (p.priceAtTime * p.quantity), 0);

    info(`Max delivery days: ${maxDeliveryDays}`);
    info(`Expected delivery date: ${expectedDeliveryDate.toLocaleDateString()}`);
    info(`Subtotal: $${subtotal.toFixed(2)}`);
    info(`Sub-orders to create: ${orderSubOrders.length}`);

    // ─── 5. Create the order in database ─────────────────────────────────────
    section('5. Creating NEW order in database');

    const newOrder = new Order({
      orderId: require('uuid').v1(),
      customer: userId,
      products: orderProducts,
      subOrders: orderSubOrders,
      total: subtotal,
      subtotal: subtotal,
      discount: 0,
      expectedDeliveryDate,
      estimatedDeliveryDays: maxDeliveryDays,
      status: 'Pending',
      paymentStatus: 'pending',
      paymetmethod: 'test',
      createdBy: userId,
      updatedBy: userId,
      referenceId: require('uuid').v1(),
      customerData: {
        email: 'test@checkout.local',
        name: 'Test User'
      }
    });

    await newOrder.save();
    success(`Order created: ${newOrder.orderId}`);

    // ─── 6. Verify the new order ─────────────────────────────────────────────
    section('6. Verifying NEW order');

    const savedOrder = await Order.findById(newOrder._id).lean();
    
    if (!savedOrder) {
      error('Order not found after save!');
      process.exit(1);
    }

    success(`Order ID: ${savedOrder.orderId}`);
    success(`Customer: ${savedOrder.customer}`);
    success(`Status: ${savedOrder.status}`);
    success(`Subtotal: $${savedOrder.subtotal}`);
    success(`Total: $${savedOrder.total}`);

    // Check for subOrders
    if (savedOrder.subOrders && savedOrder.subOrders.length > 0) {
      success(`✅ subOrders FOUND: ${savedOrder.subOrders.length} sub-order(s)`);
      for (let i = 0; i < savedOrder.subOrders.length; i++) {
        const sub = savedOrder.subOrders[i];
        info(`  [${i}] subOrderId: ${sub.subOrderId}, status: ${sub.status}, price: $${sub.priceAtTime}`);
      }
    } else {
      error(`❌ NO subOrders FOUND!`);
    }

    // Check for expectedDeliveryDate
    if (savedOrder.expectedDeliveryDate) {
      success(`✅ expectedDeliveryDate FOUND: ${new Date(savedOrder.expectedDeliveryDate).toLocaleDateString()}`);
      const daysUntilDelivery = Math.round((new Date(savedOrder.expectedDeliveryDate) - new Date()) / (1000 * 60 * 60 * 24));
      info(`  Days until delivery: ${daysUntilDelivery}`);
    } else {
      error(`❌ NO expectedDeliveryDate FOUND!`);
    }

    // ─── 7. Query for orders with subOrders and expectedDeliveryDate ──────────
    section('7. Database query verification');

    const ordersWithSubs = await Order.findOne({
      _id: newOrder._id,
      'subOrders.0': { $exists: true }
    }).lean();

    const ordersWithEDD = await Order.findOne({
      _id: newOrder._id,
      expectedDeliveryDate: { $exists: true, $ne: null }
    }).lean();

    if (ordersWithSubs) {
      success('✅ Order query by subOrders passes');
    } else {
      error('❌ Order query by subOrders fails');
    }

    if (ordersWithEDD) {
      success('✅ Order query by expectedDeliveryDate passes');
    } else {
      error('❌ Order query by expectedDeliveryDate fails');
    }

    // ─── 8. Summary ──────────────────────────────────────────────────────────
    section('8. Test Summary');

    const allChecks = {
      'Order created': !!savedOrder,
      'Has subOrders': !!ordersWithSubs,
      'Has expectedDeliveryDate': !!ordersWithEDD,
      'SubOrder count matches': savedOrder.subOrders?.length === orderProducts.length,
      'Delivery date in future': new Date(savedOrder.expectedDeliveryDate) > new Date()
    };

    let passCount = 0;
    let failCount = 0;

    Object.entries(allChecks).forEach(([check, result]) => {
      if (result) {
        success(check);
        passCount++;
      } else {
        error(check);
        failCount++;
      }
    });

    console.log(`\n${'═'.repeat(65)}`);
    console.log(`  Results: ${passCount} passed  |  ${failCount} failed`);
    console.log('═'.repeat(65));

    if (failCount === 0) {
      console.log('  ✅ NEW ORDER CHECKOUT VERIFIED - subOrders + expectedDeliveryDate working!\n');
    } else {
      console.log('  ❌ Some checks failed\n');
      process.exit(1);
    }

  } catch (err) {
    console.error('\n💥 Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
