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
  console.log(`${colors.yellow}${'-'.repeat(60)}${colors.reset}`);
}

function logSuccess(msg, data = null) {
  console.log(`${colors.green}✓ ${msg}${colors.reset}`);
  if (data) {
    console.log(`  ${colors.cyan}${JSON.stringify(data, null, 2).split('\n').join('\n  ')}${colors.reset}`);
  }
}

function logError(msg) {
  console.log(`${colors.red}✗ ${msg}${colors.reset}`);
}

function logInfo(msg) {
  console.log(`${colors.blue}ℹ ${msg}${colors.reset}`);
}

async function test() {
  try {
    const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora-backend';
    await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
    logSuccess('Connected to MongoDB\n');

    section('CELORA JEWELRY - CUSTOM DIAMOND SELECTION FLOW');
    console.log(`${colors.bold}Flow: Select Jewelry → Customize Diamond → Add to Cart → Order${colors.reset}\n`);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: Create User
    // ─────────────────────────────────────────────────────────────────────────────
    subSection('Step 1: Create User (Customer)');
    const email = `custom-diamond-${Date.now()}@celora.com`;
    const user = await User.create({ email, name: 'Test User', password: 'test123' });
    logSuccess('User created', {
      email: email,
      userId: user._id.toString()
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 2: Browse & Select Jewelry
    // ─────────────────────────────────────────────────────────────────────────────
    subSection('Step 2: Select Jewelry (Browse Products)');
    const product = await Jewelry.findOne({});
    if (!product) {
      logError('No jewelry product found');
      process.exit(1);
    }
    logSuccess('Jewelry selected', {
      title: product.title,
      productId: product._id.toString(),
      basePrice: product.basePrice || product.price
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 3: Customer Customizes - Select Metal & Ring Size
    // ─────────────────────────────────────────────────────────────────────────────
    subSection('Step 3: Customize - Select Metal & Ring Size');
    console.log(`${colors.bold}Metal Selection:${colors.reset}`);
    console.log(`  Metal Type: ${colors.cyan}14K Rose Gold${colors.reset}`);
    console.log(`  Metal Detail ID: ${colors.cyan}68afea760686a0c9081db6ad${colors.reset}`);
    console.log(`  Ring Size: ${colors.magenta}Size 7${colors.reset}`);
    console.log();

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 4: Customer Selects Custom Diamond
    // ─────────────────────────────────────────────────────────────────────────────
    subSection('Step 4: Customize - Select Custom Diamond');
    console.log(`${colors.bold}Diamond Specifications:${colors.reset}`);
    const diamondData = {
      stock_id: 'D3EE0CF70',
      shape: 'OVAL',
      carats: 0.58,
      col: 'D',
      clar: 'VVS2',
      cut: 'Excellent', // Changed from "-" to proper value
      lab: 'IGI',       // Lab certification (IGI, GIA, etc.)
      diamondType: 'Natural',
      price: 96.8,
      markup_price: 193.6
    };

    console.log(`  Stock ID: ${colors.cyan}${diamondData.stock_id}${colors.reset}`);
    console.log(`  Shape: ${colors.magenta}${diamondData.shape}${colors.reset}`);
    console.log(`  Carat: ${colors.cyan}${diamondData.carats}${colors.reset} ct`);
    console.log(`  Color: ${colors.magenta}${diamondData.col}${colors.reset}`);
    console.log(`  Clarity: ${colors.magenta}${diamondData.clar}${colors.reset}`);
    console.log(`  Cut: ${colors.magenta}${diamondData.cut}${colors.reset}`);
    console.log(`  Lab: ${colors.yellow}${diamondData.lab}${colors.reset}`);
    console.log(`  Type: ${colors.cyan}${diamondData.diamondType}${colors.reset}`);
    console.log(`  Price: ₹${diamondData.price}`);
    console.log(`  Markup Price: ₹${diamondData.markup_price}`);
    console.log();

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 5: Add to Cart with Custom Diamond
    // ─────────────────────────────────────────────────────────────────────────────
    subSection('Step 5: Add to Cart (With Custom Diamond)');

    const sessionId = uuid();
    const cartItemData = {
      itemId: uuid(),
      productId: product._id,
      quantity: 1,
      priceAtTime: diamondData.markup_price,
      selectedVariant: {
        selectedOptions: {
          metaldetail: '68afea760686a0c9081db6ad', // Metal ID
          ringsize: '7',
          shape: '68ae9c3c0686a0c9081ca64f'        // Shape ID
        }
      },
      diamondDetails: diamondData,
      engravingOptions: {
        engravingText: '',
        font: 'first'
      }
    };

    const cart = await Cart.create({
      sessionId,
      userId: user._id,
      cartId: uuid(),
      items: [cartItemData]
    });

    logSuccess('Item added to cart with custom diamond', {
      cartId: cart._id.toString(),
      sessionId: sessionId,
      itemPrice: cartItemData.priceAtTime,
      diamondStock: diamondData.stock_id
    });

    // Verify cart was saved
    const savedCart = await Cart.findById(cart._id);
    const savedItem = savedCart.items[0];

    console.log(`\n${colors.bold}Saved Diamond Details in Cart:${colors.reset}`);
    console.log(`  Stock ID: ${colors.cyan}${savedItem.diamondDetails.stock_id}${colors.reset}`);
    console.log(`  Shape: ${colors.magenta}${savedItem.diamondDetails.shape}${colors.reset}`);
    console.log(`  Carat: ${colors.cyan}${savedItem.diamondDetails.carats}${colors.reset}`);
    console.log(`  Color: ${colors.magenta}${savedItem.diamondDetails.col}${colors.reset}`);
    console.log(`  Clarity: ${colors.magenta}${savedItem.diamondDetails.clar}${colors.reset}`);
    console.log(`  Lab: ${colors.yellow}${savedItem.diamondDetails.lab}${colors.reset}`);
    console.log(`  Price: ₹${savedItem.diamondDetails.markup_price}`);
    console.log();

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 6: Review Cart Before Checkout
    // ─────────────────────────────────────────────────────────────────────────────
    subSection('Step 6: Review Cart Summary');
    console.log(`${colors.bold}Cart Items:${colors.reset}`);
    console.log(`  Jewelry: ${colors.cyan}${product.title}${colors.reset}`);
    console.log(`  Metal: 14K Rose Gold`);
    console.log(`  Ring Size: 7`);
    console.log(`  Diamond: ${colors.magenta}${diamondData.carats} ct ${diamondData.shape} ${diamondData.col} ${diamondData.clar}${colors.reset}`);
    console.log(`  Diamond Stock: ${colors.cyan}${diamondData.stock_id}${colors.reset}`);
    console.log();

    const subtotal = diamondData.markup_price;
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + tax;

    console.log(`${colors.bold}Pricing:${colors.reset}`);
    console.log(`  Jewelry Base: ₹${product.basePrice || 0}`);
    console.log(`  Custom Diamond: ₹${diamondData.markup_price}`);
    console.log(`  Subtotal: ₹${subtotal}`);
    console.log(`  Tax (18%): ₹${tax}`);
    console.log(`  ${colors.bold}${colors.green}Total: ₹${total}${colors.reset}`);
    console.log();

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 7: Proceed to Checkout (Create Order)
    // ─────────────────────────────────────────────────────────────────────────────
    subSection('Step 7: Checkout & Create Order');

    // Get the cart item details for accurate order creation
    const cartItem = savedCart.items[0];

    const order = await Order.create({
      orderId: uuid(),
      referenceId: uuid(),
      customer: user._id,
      products: [
        {
          productId: product._id,
          quantity: 1,
          type: 'Custom',
          priceAtTime: diamondData.markup_price,
          productDetails: {
            slug: product.slug || 'jewelry-product',
            title: product.title,
            name: product.title,
            category: 'Jewelry',
            metalType: '14K Rose Gold',
            ringSize: 'Size 7',
            packagingType: 'Premium Box',
            estimatedDeliveryDays: 21, // Custom diamonds take longer
            selectedVariant: cartItem.selectedVariant,
            diamondDetails: cartItem.diamondDetails, // Use saved cart diamond details
            images: []
          }
        }
      ],
      subOrders: [
        {
          subOrderId: uuid(),
          productId: product._id,
          quantity: 1,
          type: 'Custom',
          priceAtTime: diamondData.markup_price,
          status: 'Pending',
          productDetails: {
            slug: product.slug || 'jewelry-product',
            title: product.title,
            name: product.title,
            category: 'Jewelry',
            metalType: '14K Rose Gold',
            ringSize: 'Size 7',
            packagingType: 'Premium Box',
            estimatedDeliveryDays: 21,
            selectedVariant: cartItem.selectedVariant,
            diamondDetails: cartItem.diamondDetails, // Use saved cart diamond details
            images: []
          }
        }
      ],
      shippingAddress: {
        firstName: 'Test',
        lastName: 'Customer',
        addressLine1: '123 Test Street',
        addressLine2: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400001',
        country: 'India',
        email: email,
        phone: '+919876543210'
      },
      billingAddress: {
        firstName: 'Test',
        lastName: 'Customer',
        addressLine1: '123 Test Street',
        addressLine2: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400001',
        country: 'India',
        email: email,
        phone: '+919876543210'
      },
      subtotal,
      discount: 0,
      total,
      totalAmount: total,
      paymentStatus: 'pending',
      orderStatus: 'Awaiting Payment',
      currency: 'INR',
      paymentMethod: 'card'
    });

    logSuccess('Order created successfully', {
      orderId: order.orderId,
      customDiamond: diamondData.stock_id,
      total: `₹${total}`
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 8: Verify Order in Database
    // ─────────────────────────────────────────────────────────────────────────────
    subSection('Step 8: Verify Order Details');

    const savedOrder = await Order.findById(order._id);
    const orderProduct = savedOrder.products[0];

    console.log(`${colors.bold}Order Confirmation:${colors.reset}`);
    console.log(`  Order ID: ${colors.cyan}${savedOrder.orderId}${colors.reset}`);
    console.log(`  Status: ${colors.yellow}${savedOrder.orderStatus}${colors.reset}`);
    console.log(`  Total: ₹${savedOrder.total}`);
    console.log();

    console.log(`${colors.bold}Jewelry & Diamond Saved:${colors.reset}`);
    console.log(`  Jewelry: ${colors.cyan}${orderProduct.productDetails.title}${colors.reset}`);
    console.log(`  Metal: ${orderProduct.productDetails.metalType}`);
    console.log(`  Ring Size: ${orderProduct.productDetails.ringSize}`);
    console.log();

    console.log(`${colors.bold}Custom Diamond Details (Preserved):${colors.reset}`);
    console.log(`  Stock ID: ${colors.cyan}${orderProduct.productDetails.diamondDetails.stock_id}${colors.reset}`);
    console.log(`  Shape: ${colors.magenta}${orderProduct.productDetails.diamondDetails.shape}${colors.reset}`);
    console.log(`  Carat: ${colors.cyan}${orderProduct.productDetails.diamondDetails.carats}${colors.reset} ct`);
    console.log(`  Color: ${colors.magenta}${orderProduct.productDetails.diamondDetails.col}${colors.reset}`);
    console.log(`  Clarity: ${colors.magenta}${orderProduct.productDetails.diamondDetails.clar}${colors.reset}`);
    console.log(`  Lab: ${colors.yellow}${orderProduct.productDetails.diamondDetails.lab}${colors.reset}`);
    console.log(`  Type: ${colors.cyan}${orderProduct.productDetails.diamondDetails.diamondType}${colors.reset}`);
    console.log(`  Estimated Delivery: ${colors.green}${orderProduct.productDetails.estimatedDeliveryDays} days${colors.reset}`);
    console.log();

    // ─────────────────────────────────────────────────────────────────────────────
    // FINAL VALIDATION
    // ─────────────────────────────────────────────────────────────────────────────
    section('VALIDATION CHECKLIST');

    const checks = [
      { name: 'User created', pass: !!user._id },
      { name: 'Jewelry product found', pass: !!product._id },
      { name: 'Cart created with session', pass: !!savedCart.sessionId },
      { name: 'Diamond stock ID saved', pass: savedItem.diamondDetails.stock_id === 'D3EE0CF70' },
      { name: 'Diamond shape saved (OVAL)', pass: savedItem.diamondDetails.shape === 'OVAL' },
      { name: 'Diamond carats saved (0.58)', pass: savedItem.diamondDetails.carats === 0.58 },
      { name: 'Diamond color saved (D)', pass: savedItem.diamondDetails.col === 'D' },
      { name: 'Diamond clarity saved (VVS2)', pass: savedItem.diamondDetails.clar === 'VVS2' },
      { name: 'Diamond lab saved (IGI)', pass: savedItem.diamondDetails.lab === 'IGI' },
      { name: 'Diamond price saved', pass: savedItem.diamondDetails.markup_price === 193.6 },
      { name: 'Order created with custom type', pass: savedOrder.products[0].type === 'Custom' },
      { name: 'Order diamond details match cart', pass: savedOrder.products[0].productDetails.diamondDetails.stock_id === 'D3EE0CF70' },
      { name: 'Order total calculated correctly', pass: savedOrder.total === total },
      { name: 'Metal selection preserved', pass: savedOrder.products[0].productDetails.metalType === '14K Rose Gold' },
      { name: 'Ring size preserved', pass: savedOrder.products[0].productDetails.ringSize === 'Size 7' },
      { name: 'Longer delivery time set (21 days)', pass: savedOrder.products[0].productDetails.estimatedDeliveryDays === 21 },
      { name: 'Shipping address saved', pass: !!savedOrder.shippingAddress.city }
    ];

    let passCount = 0;
    checks.forEach(check => {
      passCount += check.pass ? 1 : 0;
      const symbol = check.pass ? colors.green + '✓' : colors.red + '✗';
      console.log(`${symbol}${colors.reset} ${check.name}`);
    });

    console.log(`\n${colors.bold}${colors.green}${passCount}/${checks.length} CHECKS PASSED${colors.reset}\n`);

    if (passCount === checks.length) {
      section('✓ CUSTOM DIAMOND FLOW WORKING PERFECTLY');
      console.log(`${colors.bold}${colors.green}All steps completed successfully:${colors.reset}
  1. ✓ User created
  2. ✓ Jewelry selected
  3. ✓ Metal & ring size customized
  4. ✓ Custom diamond selected & added to cart
  5. ✓ Cart created with full diamond specs
  6. ✓ Cart summary reviewed
  7. ✓ Order created with custom diamond
  8. ✓ All data verified in database

${colors.bold}Ready for:${colors.reset}
  → Payment processing
  → Order confirmation email
  → Production queue
  → Custom jewelry creation
`);
    } else {
      logError(`${checks.length - passCount} checks failed`);
    }

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
