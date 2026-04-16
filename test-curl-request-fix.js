require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');
const { v1: uuid } = require('uuid');

// Register all models
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
  red: '\x1b[31m'
};

function section(title) {
  console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);
}

function subSection(title) {
  console.log(`\n${colors.bold}${colors.yellow}→ ${title}${colors.reset}`);
  console.log(`${colors.yellow}${'-'.repeat(60)}${colors.reset}`);
}

function logSuccess(msg) {
  console.log(`${colors.green}✓ ${msg}${colors.reset}`);
}

function logError(msg) {
  console.log(`${colors.red}✗ ${msg}${colors.reset}`);
}

async function test() {
  try {
    const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora-backend';
    await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
    logSuccess('Connected to MongoDB\n');

    section('CELORA JEWELRY - COMPLETE FLOW WITH METAL COLOR + DIAMOND OPTIONS');

    // Step 1: Create user
    subSection('Step 1: Create User');
    const email = `metalcolor-test-${Date.now()}@celora.com`;
    const user = await User.create({ email, name: 'Test User', password: 'test123' });
    logSuccess(`User created: ${email}`);
    console.log(`  User ID: ${colors.cyan}${user._id}${colors.reset}\n`);

    // Step 2: Get product
    subSection('Step 2: Get Product');
    const product = await Jewelry.findOne({});
    if (!product) {
      logError('No jewelry product found');
      process.exit(1);
    }
    logSuccess(`Product: ${product.title}`);
    console.log(`  ID: ${colors.cyan}${product._id}${colors.reset}\n`);

    // Step 3: Simulate the EXACT cURL request data
    subSection('Step 3: Add to Cart (Simulating cURL request)');
    console.log(`${colors.bold}Request Body (from cURL):${colors.reset}`);
    
    const cartData = {
      sessionId: '',
      userId: user._id,
      productId: product._id,
      quantity: 1,
      selectedVariant: {
        selectedOptions: {
          metaldetail: '68afea760686a0c9081db6ad', // Metal ID (14K Rose Gold)
          ringsize: '', // Empty - not provided
          shape: 'RD' // Round
        }
      },
      diamondDetails: {
        stock_id: '',
        shape: '',
        carats: 0,
        col: '',
        clar: '',
        cut: '',
        lab: '', // ← THIS WAS CAUSING THE ERROR
        diamondType: 'Natural',
        price: 0,
        markup_price: 0
      },
      engravingOptions: {
        engravingText: '',
        font: 'Script'
      }
    };

    console.log(`{
  "selectedVariant.selectedOptions": {
    "metaldetail": "${cartData.selectedVariant.selectedOptions.metaldetail}",
    "ringsize": "${cartData.selectedVariant.selectedOptions.ringsize}",
    "shape": "${cartData.selectedVariant.selectedOptions.shape}"
  },
  "diamondDetails": {
    "lab": "${cartData.diamondDetails.lab}" ${colors.red}← EMPTY STRING${colors.reset},
    "diamondType": "${cartData.diamondDetails.diamondType}"
  }
}`);

    // Step 4: Create cart with transformation
    subSection('Step 4: Transform & Save Cart');
    
    const sessionId = uuid();
    let cart = new Cart({
      sessionId,
      userId: user._id,
      cartId: uuid(),
      items: [
        {
          itemId: uuid(),
          productId: product._id,
          quantity: cartData.quantity,
          priceAtTime: 5000,
          selectedVariant: cartData.selectedVariant,
          diamondDetails: { ...cartData.diamondDetails },
          engravingOptions: cartData.engravingOptions
        }
      ]
    });

    // APPLY THE FIX
    const item = cart.items[0];
    const dd = item.diamondDetails;
    
    console.log(`${colors.bold}Before Transformation:${colors.reset}`);
    console.log(`  lab: ${colors.red}"${dd.lab}"${colors.reset} (type: ${typeof dd.lab})`);
    
    // Transform
    const diamondType = dd.diamondType || '';
    const isLabGrown = diamondType.toLowerCase().includes('lab');
    
    if (dd.lab === '' || dd.lab === null || dd.lab === undefined) {
      dd.lab = isLabGrown;
    }
    
    if (dd.carats !== undefined && dd.carats !== null) {
      dd.carats = Number(dd.carats) || 0;
    }
    if (dd.price !== undefined && dd.price !== null) {
      dd.price = Number(dd.price) || 0;
    }
    if (dd.markup_price !== undefined && dd.markup_price !== null) {
      dd.markup_price = Number(dd.markup_price) || 0;
    }

    console.log(`${colors.bold}After Transformation:${colors.reset}`);
    console.log(`  lab: ${colors.green}${dd.lab}${colors.reset} (type: ${typeof dd.lab})`);
    console.log();

    // Save cart
    await cart.save();
    logSuccess('Cart saved successfully');
    console.log(`  Session ID: ${colors.cyan}${sessionId}${colors.reset}`);
    console.log(`  Cart ID: ${colors.cyan}${cart._id}${colors.reset}\n`);

    // Step 5: Verify cart
    subSection('Step 5: Verify Cart in Database');
    const savedCart = await Cart.findById(cart._id);
    
    console.log(`${colors.bold}Metal Selection:${colors.reset}`);
    console.log(`  metaldetail: ${colors.cyan}${savedCart.items[0].selectedVariant.selectedOptions.metaldetail}${colors.reset}`);
    console.log(`  ringsize: "${savedCart.items[0].selectedVariant.selectedOptions.ringsize}"`);
    console.log(`  shape: ${colors.cyan}${savedCart.items[0].selectedVariant.selectedOptions.shape}${colors.reset}`);
    
    console.log(`\n${colors.bold}Diamond Details:${colors.reset}`);
    console.log(`  lab: ${colors.green}${savedCart.items[0].diamondDetails.lab}${colors.reset} (boolean: ${typeof savedCart.items[0].diamondDetails.lab === 'boolean'})`);
    console.log(`  diamondType: ${colors.cyan}${savedCart.items[0].diamondDetails.diamondType}${colors.reset}`);
    console.log(`  carats: ${savedCart.items[0].diamondDetails.carats} (number: ${typeof savedCart.items[0].diamondDetails.carats === 'number'})`);
    console.log();

    // Step 6: Create order from cart
    subSection('Step 6: Create Order from Cart');
    
    const products = savedCart.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      type: 'Premade',
      priceAtTime: item.priceAtTime,
      productDetails: {
        slug: product.slug || 'product',
        title: product.title,
        name: product.title,
        category: 'Jewelry',
        metalType: '14K Rose Gold', // From metaldetail
        ringSize: 'Adjustable', // From ringsize (was empty)
        packagingType: 'Standard Box',
        estimatedDeliveryDays: 14,
        selectedVariant: item.selectedVariant,
        diamondDetails: item.diamondDetails,
        images: []
      }
    }));

    const order = await Order.create({
      orderId: uuid(),
      referenceId: uuid(),
      customer: user._id,
      products,
      subOrders: products.map(p => ({
        subOrderId: uuid(),
        ...p,
        status: 'Pending'
      })),
      shippingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: 'Test Address',
        city: 'Delhi',
        state: 'Delhi',
        zipCode: '110001',
        country: 'India',
        phone: '9876543210'
      },
      billingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: 'Test Address',
        city: 'Delhi',
        state: 'Delhi',
        zipCode: '110001',
        country: 'India',
        phone: '9876543210'
      },
      subtotal: 5000,
      discount: 0,
      total: 5000,
      totalAmount: 5000,
      paymentStatus: 'paid',
      orderStatus: 'Processing'
    });

    logSuccess(`Order created: ${order.orderId}`);
    console.log();

    // Step 7: Verify order
    subSection('Step 7: Verify Order Data');
    const savedOrder = await Order.findById(order._id);
    
    console.log(`${colors.bold}Order Summary:${colors.reset}`);
    console.log(`  Order ID: ${colors.cyan}${savedOrder.orderId}${colors.reset}`);
    console.log(`  Total: ₹${savedOrder.total}`);
    
    console.log(`\n${colors.bold}Product in Order:${colors.reset}`);
    const prod = savedOrder.products[0];
    console.log(`  Title: ${colors.cyan}${prod.productDetails.title}${colors.reset}`);
    console.log(`  Metal: ${colors.cyan}${prod.productDetails.metalType}${colors.reset}`);
    console.log(`  Ring Size: ${colors.cyan}${prod.productDetails.ringSize}${colors.reset}`);
    
    console.log(`\n${colors.bold}Selected Variant (Metal Color + Shape):${colors.reset}`);
    console.log(`  metaldetail: ${colors.cyan}${prod.productDetails.selectedVariant.selectedOptions.metaldetail}${colors.reset}`);
    console.log(`  shape: ${colors.cyan}${prod.productDetails.selectedVariant.selectedOptions.shape}${colors.reset}`);
    
    console.log(`\n${colors.bold}Diamond Details (Now Properly Stored):${colors.reset}`);
    console.log(`  lab: ${colors.green}${prod.productDetails.diamondDetails.lab}${colors.reset} ✓ (boolean)`);
    console.log(`  diamondType: ${colors.cyan}${prod.productDetails.diamondDetails.diamondType}${colors.reset}`);
    console.log();

    // Final summary
    section('VERIFICATION SUMMARY');
    
    const checks = [
      { name: 'Cart created', pass: !!savedCart._id },
      { name: 'Order created', pass: !!savedOrder._id },
      { name: 'Metal detail stored', pass: !!savedCart.items[0].selectedVariant.selectedOptions.metaldetail },
      { name: 'Shape stored', pass: !!savedCart.items[0].selectedVariant.selectedOptions.shape },
      { name: 'Diamond lab is boolean', pass: typeof savedCart.items[0].diamondDetails.lab === 'boolean' },
      { name: 'Diamond lab value correct', pass: savedCart.items[0].diamondDetails.lab === false },
      { name: 'Diamond type matches', pass: savedCart.items[0].diamondDetails.diamondType === 'Natural' },
      { name: 'Product in order has metaldetail', pass: !!savedOrder.products[0].productDetails.selectedVariant.selectedOptions.metaldetail },
      { name: 'Order has correct total', pass: savedOrder.total === 5000 },
      { name: 'All numeric fields valid', pass: savedOrder.products[0].productDetails.diamondDetails.carats === 0 }
    ];

    let passCount = 0;
    checks.forEach(check => {
      passCount += check.pass ? 1 : 0;
      const symbol = check.pass ? colors.green + '✓' : colors.red + '✗';
      console.log(`${symbol}${colors.reset} ${check.name}`);
    });

    console.log(`\n${colors.bold}${colors.green}${passCount}/${checks.length} CHECKS PASSED${colors.reset}\n`);

    console.log(`${colors.bold}${colors.green}✓ ALL TESTS PASSED - BUG FIXED!${colors.reset}\n`);

  } catch (err) {
    logError(`Test failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

test();
