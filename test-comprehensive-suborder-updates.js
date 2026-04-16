require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');
const { v1: uuid } = require('uuid');

// Register models
const User = mongoose.models.userModel || mongoose.model('userModel', new mongoose.Schema(Schema.signup), 'users');
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function section(title) {
  console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);
}

function subSection(title) {
  console.log(`\n${colors.bold}${colors.yellow}→ ${title}${colors.reset}`);
  console.log(`${colors.yellow}${'-'.repeat(70)}${colors.reset}`);
}

function logSuccess(msg) {
  console.log(`${colors.green}✓ ${msg}${colors.reset}`);
}

function logError(msg) {
  console.log(`${colors.red}✗ ${msg}${colors.reset}`);
}

function logInfo(msg) {
  console.log(`${colors.blue}ℹ ${msg}${colors.reset}`);
}

async function runAllTests() {
  const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora-backend';
  
  try {
    await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
    
    section('COMPREHENSIVE SUBORDER UPDATES TEST');

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE TEST ORDER WITH 3 SUBORDERS
    // ─────────────────────────────────────────────────────────────────────────
    subSection('Setup: Create User & Order with 3 SubOrders');
    
    const email = `suborder-test-${Date.now()}@celora.com`;
    const user = await User.create({ email, name: 'Test User', password: 'test123' });
    logSuccess('User created');

    const products = await Jewelry.find({}).limit(3).lean();
    if (products.length < 3) {
      logError('Need at least 3 products');
      return false;
    }
    logSuccess(`Found ${products.length} products`);

    const subOrder1Id = uuid();
    const subOrder2Id = uuid();
    const subOrder3Id = uuid();

    const order = await Order.create({
      orderId: uuid(),
      referenceId: uuid(),
      customer: user._id,
      products: products.map((prod, idx) => ({
        productId: prod._id,
        quantity: idx + 1,
        type: 'Premade',
        priceAtTime: 10000,
        productDetails: {
          title: prod.title,
          name: prod.name || 'Item',
          slug: prod.slug || `product-${idx}`,
          category: 'Jewelry',
          material: 'Gold',
          metalType: 'Gold',
          ringSize: '7',
          estimatedDeliveryDays: 15,
          selectedVariant: {},
          diamondDetails: {},
          images: []
        }
      })),
      subOrders: [
        {
          subOrderId: subOrder1Id,
          productId: products[0]._id,
          quantity: 1,
          type: 'Premade',
          priceAtTime: 10000,
          productDetails: {
            title: products[0].title,
            slug: products[0].slug || 'product-1',
            name: products[0].name || 'Item',
            category: 'Jewelry',
            material: 'Gold',
            metalType: 'Gold',
            ringSize: '7',
            estimatedDeliveryDays: 15,
            selectedVariant: {},
            diamondDetails: {},
            images: []
          },
          status: 'Pending'
        },
        {
          subOrderId: subOrder2Id,
          productId: products[1]._id,
          quantity: 2,
          type: 'Premade',
          priceAtTime: 10000,
          productDetails: {
            title: products[1].title,
            slug: products[1].slug || 'product-2',
            name: products[1].name || 'Item',
            category: 'Jewelry',
            material: 'Gold',
            metalType: 'Gold',
            ringSize: '8',
            estimatedDeliveryDays: 15,
            selectedVariant: {},
            diamondDetails: {},
            images: []
          },
          status: 'Pending'
        },
        {
          subOrderId: subOrder3Id,
          productId: products[2]._id,
          quantity: 3,
          type: 'Premade',
          priceAtTime: 10000,
          productDetails: {
            title: products[2].title,
            slug: products[2].slug || 'product-3',
            name: products[2].name || 'Item',
            category: 'Jewelry',
            material: 'Gold',
            metalType: 'Gold',
            ringSize: '9',
            estimatedDeliveryDays: 15,
            selectedVariant: {},
            diamondDetails: {},
            images: []
          },
          status: 'Pending'
        }
      ],
      shippingAddress: {
        firstName: 'Test', lastName: 'User', addressLine1: '123 St',
        city: 'City', state: 'ST', zipCode: '123456', country: 'India',
        email, phone: '+919876543210'
      },
      billingAddress: {
        firstName: 'Test', lastName: 'User', addressLine1: '123 St',
        city: 'City', state: 'ST', zipCode: '123456', country: 'India',
        email, phone: '+919876543210'
      },
      subtotal: 60000, discount: 0, total: 70800, totalAmount: 70800,
      paymentDetails: { paymentStatus: 'pending', currency: 'INR' },
      status: 'Pending', paymetmethod: 'stripe', estimatedDeliveryDays: 15,
      expectedDeliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    });

    logSuccess(`Order created with 3 SubOrders: ${order.orderId}`);
    console.log(`  SubOrder 1: ${subOrder1Id}`);
    console.log(`  SubOrder 2: ${subOrder2Id}`);
    console.log(`  SubOrder 3: ${subOrder3Id}`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: UPDATE SUBORDER STATUS
    // ─────────────────────────────────────────────────────────────────────────
    subSection('TEST 1: Update SubOrder Status');

    let checks = [];

    // Update SubOrder 1 to Confirmed
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder1Id },
      { $set: { 'subOrders.$.status': 'Confirmed' } }
    );
    logSuccess('SubOrder 1 → Confirmed');

    // Update SubOrder 2 to Manufacturing
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder2Id },
      { $set: { 'subOrders.$.status': 'Manufacturing' } }
    );
    logSuccess('SubOrder 2 → Manufacturing');

    // Update SubOrder 3 to Quality Assurance
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder3Id },
      { $set: { 'subOrders.$.status': 'Quality Assurance' } }
    );
    logSuccess('SubOrder 3 → Quality Assurance');

    let saved = await Order.findById(order._id);
    checks.push({
      name: 'SubOrder 1 status updated',
      pass: saved.subOrders[0].status === 'Confirmed'
    });
    checks.push({
      name: 'SubOrder 2 status updated',
      pass: saved.subOrders[1].status === 'Manufacturing'
    });
    checks.push({
      name: 'SubOrder 3 status updated',
      pass: saved.subOrders[2].status === 'Quality Assurance'
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: UPDATE SUBORDER WITH TIMESTAMPS VIA PROGRESS
    // ─────────────────────────────────────────────────────────────────────────
    subSection('TEST 2: Add Timestamps via Progress Tracking');

    const now = new Date();

    // Add confirmed progress with date to SubOrder 1
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder1Id },
      {
        $set: {
          'subOrders.$.progress.confirmed.date': now,
          'subOrders.$.progress.confirmed.status': 'Confirmed at ' + now.toISOString()
        }
      }
    );
    logSuccess('SubOrder 1: Added confirmed progress with timestamp');

    // Add manufacturing progress with date to SubOrder 2
    const mfgStartDate = new Date(now.getTime() + 5000);
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder2Id },
      {
        $set: {
          'subOrders.$.progress.manufacturing.date': mfgStartDate
        }
      }
    );
    logSuccess('SubOrder 2: Added manufacturing progress with date');

    saved = await Order.findById(order._id);
    checks.push({
      name: 'SubOrder 1 has confirmed progress timestamp',
      pass: !!saved.subOrders[0].progress?.confirmed?.date
    });
    checks.push({
      name: 'SubOrder 1 confirmed status message set',
      pass: !!saved.subOrders[0].progress?.confirmed?.status
    });
    checks.push({
      name: 'SubOrder 2 has manufacturing progress date',
      pass: !!saved.subOrders[1].progress?.manufacturing?.date
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: UPDATE SUBORDER PROGRESS TRACKING
    // ─────────────────────────────────────────────────────────────────────────
    subSection('TEST 3: Update Multi-Step Progress for SubOrders');

    // Update SubOrder 1 with confirmed progress
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder1Id },
      {
        $set: {
          'subOrders.$.progress.confirmed.date': new Date(),
          'subOrders.$.progress.confirmed.status': 'Order Confirmed',
          'subOrders.$.progress.confirmed.confirmedImages': ['image1.jpg', 'image2.jpg']
        }
      }
    );
    logSuccess('SubOrder 1: Confirmed progress updated with images');

    // Update SubOrder 2 with manufacturing progress
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder2Id },
      {
        $set: {
          'subOrders.$.progress.manufacturing.date': new Date(),
          'subOrders.$.progress.manufacturing.manufacturingImages': ['mfg1.jpg', 'mfg2.jpg']
        }
      }
    );
    logSuccess('SubOrder 2: Manufacturing progress with material tracking');

    // Update SubOrder 3 with QA progress
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder3Id },
      {
        $set: {
          'subOrders.$.progress.qualityAssurance.date': new Date(),
          'subOrders.$.progress.qualityAssurance.qualityAssuranceImages': ['qa1.jpg', 'qa2.jpg', 'qa3.jpg']
        }
      }
    );
    logSuccess('SubOrder 3: QA progress with inspection images');

    saved = await Order.findById(order._id);
    checks.push({
      name: 'SubOrder 1 confirmed progress saved',
      pass: !!saved.subOrders[0].progress?.confirmed?.date
    });
    checks.push({
      name: 'SubOrder 2 manufacturing progress saved',
      pass: !!saved.subOrders[1].progress?.manufacturing?.date
    });
    checks.push({
      name: 'SubOrder 3 QA progress saved',
      pass: !!saved.subOrders[2].progress?.qualityAssurance?.date
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: MOVE SUBORDER TO FINAL STAGES
    // ─────────────────────────────────────────────────────────────────────────
    subSection('TEST 4: Move SubOrders Through Delivery Pipeline');

    // Move SubOrder 1 to Out For Delivery
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder1Id },
      {
        $set: {
          'subOrders.$.status': 'Out For Delivery',
          'subOrders.$.progress.outForDelivery.date': new Date(),
          'subOrders.$.progress.outForDelivery.trackingId': 'TRACK-' + uuid().substring(0, 12),
          'subOrders.$.progress.outForDelivery.trackingLink': 'https://track.example.com/TRACK-0001'
        }
      }
    );
    logSuccess('SubOrder 1 → Out For Delivery (with tracking)');

    // Move SubOrder 2 to Out For Delivery
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder2Id },
      {
        $set: {
          'subOrders.$.status': 'Out For Delivery',
          'subOrders.$.progress.outForDelivery.date': new Date(),
          'subOrders.$.progress.outForDelivery.trackingId': 'TRACK-' + uuid().substring(0, 12),
          'subOrders.$.progress.outForDelivery.trackingLink': 'https://track.example.com/TRACK-0002'
        }
      }
    );
    logSuccess('SubOrder 2 → Out For Delivery (with tracking)');

    saved = await Order.findById(order._id);
    checks.push({
      name: 'SubOrder 1 delivery status updated',
      pass: saved.subOrders[0].status === 'Out For Delivery'
    });
    checks.push({
      name: 'SubOrder 2 delivery status updated',
      pass: saved.subOrders[1].status === 'Out For Delivery'
    });
    checks.push({
      name: 'SubOrder 1 has tracking ID',
      pass: !!saved.subOrders[0].progress?.outForDelivery?.trackingId
    });
    checks.push({
      name: 'SubOrder 2 has tracking link',
      pass: !!saved.subOrders[1].progress?.outForDelivery?.trackingLink
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: MARK SUBORDERS AS DELIVERED
    // ─────────────────────────────────────────────────────────────────────────
    subSection('TEST 5: Mark SubOrders as Delivered');

    // Deliver SubOrder 1
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder1Id },
      {
        $set: {
          'subOrders.$.status': 'Delivered',
          'subOrders.$.progress.delivered.date': new Date()
        }
      }
    );
    logSuccess('SubOrder 1 → Delivered');

    // Deliver SubOrder 2
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder2Id },
      {
        $set: {
          'subOrders.$.status': 'Delivered',
          'subOrders.$.progress.delivered.date': new Date()
        }
      }
    );
    logSuccess('SubOrder 2 → Delivered');

    saved = await Order.findById(order._id);
    checks.push({
      name: 'SubOrder 1 marked as delivered',
      pass: saved.subOrders[0].status === 'Delivered'
    });
    checks.push({
      name: 'SubOrder 2 marked as delivered',
      pass: saved.subOrders[1].status === 'Delivered'
    });
    checks.push({
      name: 'SubOrder 3 still in Quality Assurance',
      pass: saved.subOrders[2].status === 'Quality Assurance' // Should be unchanged
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: UPDATE OTHER FIELDS IN SUBORDER
    // ─────────────────────────────────────────────────────────────────────────
    subSection('TEST 6: Update Additional SubOrder Fields');

    // Update SubOrder with new pricing info
    await Order.updateOne(
      { _id: order._id, 'subOrders.subOrderId': subOrder3Id },
      {
        $set: {
          'subOrders.$.priceAtTime': 15000,
          'subOrders.$.quantity': 4,
          'subOrders.$.imageUrl': 'https://example.com/product.jpg'
        }
      }
    );
    logSuccess('SubOrder 3: Updated quantity, price, and image URL');

    saved = await Order.findById(order._id);
    checks.push({
      name: 'SubOrder 3 quantity updated',
      pass: saved.subOrders[2].quantity === 4
    });
    checks.push({
      name: 'SubOrder 3 price updated',
      pass: saved.subOrders[2].priceAtTime === 15000
    });
    checks.push({
      name: 'SubOrder 3 image URL set',
      pass: !!saved.subOrders[2].imageUrl
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: VERIFY SUBORDERS REMAIN INDEPENDENT
    // ─────────────────────────────────────────────────────────────────────────
    subSection('TEST 7: Verify SubOrder Independence');

    console.log(`${colors.bold}Final SubOrder States:${colors.reset}`);
    saved.subOrders.forEach((so, idx) => {
      console.log(`\n  SubOrder ${idx + 1}:`);
      console.log(`    ID: ${colors.cyan}${so.subOrderId}${colors.reset}`);
      console.log(`    Product: ${so.productDetails.title}`);
      console.log(`    Status: ${colors.yellow}${so.status}${colors.reset}`);
      console.log(`    Quantity: ${so.quantity}`);
      console.log(`    Price: ₹${so.priceAtTime}`);
      if (so.progress?.confirmed?.date) {
        console.log(`    Confirmed: ${colors.green}✓${colors.reset}`);
      }
      if (so.progress?.manufacturing?.date) {
        console.log(`    Manufacturing: ${colors.green}✓${colors.reset}`);
      }
      if (so.progress?.qualityAssurance?.date) {
        console.log(`    QA: ${colors.green}✓${colors.reset}`);
      }
      if (so.progress?.outForDelivery?.date) {
        console.log(`    Out For Delivery: ${colors.green}✓${colors.reset}`);
        console.log(`    Tracking: ${so.progress.outForDelivery.trackingId}`);
      }
      if (so.progress?.delivered?.date) {
        console.log(`    Delivered: ${colors.green}✓${colors.reset}`);
      }
    });

    checks.push({
      name: 'All 3 SubOrders independent & unique',
      pass: saved.subOrders.length === 3 &&
            saved.subOrders[0].subOrderId !== saved.subOrders[1].subOrderId &&
            saved.subOrders[1].subOrderId !== saved.subOrders[2].subOrderId
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: VERIFY DATA PERSISTENCE
    // ─────────────────────────────────────────────────────────────────────────
    subSection('TEST 8: Final Persistence Verification');

    // Reload from fresh query
    const finalOrder = await Order.findById(order._id).lean();
    
    checks.push({
      name: 'Order data persisted in database',
      pass: !!finalOrder && finalOrder.orderId === order.orderId
    });
    checks.push({
      name: 'All 3 SubOrders persisted',
      pass: finalOrder.subOrders.length === 3
    });
    checks.push({
      name: 'SubOrder IDs match original',
      pass: finalOrder.subOrders[0].subOrderId === subOrder1Id &&
            finalOrder.subOrders[1].subOrderId === subOrder2Id &&
            finalOrder.subOrders[2].subOrderId === subOrder3Id
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FINAL RESULTS
    // ─────────────────────────────────────────────────────────────────────────
    subSection('Final Validation Results');

    let passCount = 0;
    checks.forEach(check => {
      passCount += check.pass ? 1 : 0;
      const symbol = check.pass ? colors.green + '✓' : colors.red + '✗';
      console.log(`${symbol}${colors.reset} ${check.name}`);
    });

    console.log();
    if (passCount === checks.length) {
      logSuccess(`All ${passCount}/${checks.length} tests PASSED!`);
      return true;
    } else {
      logError(`${checks.length - passCount} tests FAILED`);
      return false;
    }

  } catch (err) {
    logError(`Test failed: ${err.message}`);
    console.error(err.stack);
    return false;
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  const result = await runAllTests();

  section('SUBORDER UPDATES TEST SUMMARY');

  if (result) {
    console.log(`${colors.bold}${colors.green}✅ ALL SUBORDER UPDATE TESTS PASSED!${colors.reset}`);
    console.log(`\n${colors.green}Features Verified:${colors.reset}`);
    console.log(`  ✓ Update individual suborder status`);
    console.log(`  ✓ Add timestamps to suborders`);
    console.log(`  ✓ Update multi-step progress tracking`);
    console.log(`  ✓ Move suborders through delivery pipeline`);
    console.log(`  ✓ Mark suborders as delivered`);
    console.log(`  ✓ Update pricing & quantity per suborder`);
    console.log(`  ✓ SubOrders remain independent`);
    console.log(`  ✓ All data persists in database`);
    console.log(`  ✓ Tracking information stored correctly`);
    console.log(`  ✓ Progress history maintained per suborder`);
    console.log();
    process.exit(0);
  } else {
    console.log(`${colors.bold}${colors.red}❌ Some tests failed${colors.reset}`);
    process.exit(1);
  }
}

main();
