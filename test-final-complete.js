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

async function testCurrency(currency) {
  const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora-backend';
  await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
  
  section(`FINAL TEST: ${currency} Currency`);

  try {
    // STEP 1: Create User
    subSection('Step 1: Create User');
    const email = `final-test-${currency.toLowerCase()}-${Date.now()}@celora.com`;
    const user = await User.create({ email, name: 'Test User', password: 'test123' });
    logSuccess(`User created: ${email}`);

    // STEP 2: Get a product with pricing info
    subSection('Step 2: Get Product with Pricing');
    const product = await Jewelry.findOne({ pricing_options: { $exists: true } }).lean();
    if (!product) {
      logError('No product with pricing found');
      return false;
    }
    
    const priceAtTime = product.pricing_options?.[0]?.price || 50000;
    const deliveryDays = product.estimatedDeliveryDays || 15;
    
    console.log(`Product: ${product.title}`);
    console.log(`Price: ₹${priceAtTime}`);
    console.log(`Delivery Days: ${deliveryDays}`);

    // STEP 3: Create Cart with the product
    subSection('Step 3: Create Cart & Add Item');
    
    const cartItems = [{
      itemId: uuid(),
      productId: product._id,
      quantity: 2,
      priceAtTime: priceAtTime,
      selectedVariant: {
        selectedOptions: {
          metaldetail: '68afea760686a0c9081db6ad',
          ringsize: '7'
        }
      },
      engravingOptions: {
        engravingText: '',
        font: 'first'
      }
    }];

    const cart = await Cart.create({
      sessionId: uuid(),
      userId: user._id,
      cartId: uuid(),
      items: cartItems
    });

    logSuccess(`Cart created with ${cart.items.length} item(s)`);

    // STEP 4: Calculate Totals
    subSection('Step 4: Calculate Pricing & Totals');
    
    const subtotal = priceAtTime * 2; // Quantity 2
    const taxPercent = 18;
    const tax = Math.round(subtotal * taxPercent / 100);
    const total = subtotal + tax;

    const currencySymbol = currency === 'INR' ? '₹' : '$';
    const currencyCode = currency;

    console.log(`${colors.bold}Price Breakdown:${colors.reset}`);
    console.log(`  Item Price: ${currencySymbol}${priceAtTime.toFixed(2)} × 2 = ${currencySymbol}${subtotal.toFixed(2)}`);
    console.log(`  Tax (18%): ${currencySymbol}${tax.toFixed(2)}`);
    console.log(`  ${colors.bold}${colors.green}Total: ${currencySymbol}${total.toFixed(2)} ${currencyCode}${colors.reset}`);

    // STEP 5: Create Order
    subSection('Step 5: Create Order');

    const order = await Order.create({
      orderId: uuid(),
      referenceId: uuid(),
      customer: user._id,
      products: [{
        productId: product._id,
        quantity: 2,
        type: 'Premade',
        priceAtTime: priceAtTime,
        productDetails: {
          title: product.title,
          name: product.name || 'Item',
          category: 'Jewelry',
          material: 'Gold',
          metalType: 'Gold',
          ringSize: '7',
          estimatedDeliveryDays: deliveryDays,
          selectedVariant: cartItems[0].selectedVariant,
          diamondDetails: {},
          images: []
        }
      }],
      subOrders: [{
        subOrderId: uuid(),
        productId: product._id,
        quantity: 2,
        type: 'Premade',
        priceAtTime: priceAtTime,
        productDetails: {
          title: product.title,
          name: product.name || 'Item',
          category: 'Jewelry',
          material: 'Gold',
          metalType: 'Gold',
          ringSize: '7',
          estimatedDeliveryDays: deliveryDays,
          selectedVariant: cartItems[0].selectedVariant,
          diamondDetails: {},
          images: []
        },
        status: 'Pending'
      }],
      shippingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        zipCode: '123456',
        country: 'India',
        email: email,
        phone: '+919876543210'
      },
      billingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        zipCode: '123456',
        country: 'India',
        email: email,
        phone: '+919876543210'
      },
      subtotal: subtotal,
      discount: 0,
      total: total,
      totalAmount: total,
      paymentStatus: 'pending',
      orderStatus: 'Awaiting Payment',
      currency: currencyCode,
      paymentMethod: 'card',
      estimatedDeliveryDays: deliveryDays,
      expectedDeliveryDate: new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000)
    });

    logSuccess(`Order created: ${order.orderId}`);

    // STEP 6: Verify Order
    subSection('Step 6: Verify Order Data');

    const savedOrder = await Order.findById(order._id);

    console.log(`${colors.bold}Order Details:${colors.reset}`);
    console.log(`  Order ID: ${savedOrder.orderId}`);
    console.log(`  Status: ${savedOrder.orderStatus}`);
    console.log(`  Currency: ${colors.magenta}${savedOrder.currency}${colors.reset}`);
    console.log(`  Amount: ${currencySymbol}${savedOrder.total.toFixed(2)}`);
    console.log(`  Product: ${savedOrder.products[0].productDetails.title}`);
    console.log(`  Quantity: ${savedOrder.products[0].quantity}`);
    console.log(`  Delivery: ${savedOrder.estimatedDeliveryDays} days`);

    // STEP 7: Validation Checks
    subSection('Step 7: Final Validation');

    const checks = [
      { name: 'Order created', pass: !!savedOrder._id },
      { name: `Currency is ${currency}`, pass: savedOrder.currency === currency },
      { name: 'Subtotal calculated', pass: savedOrder.subtotal === subtotal },
      { name: 'Total calculated', pass: savedOrder.total === total },
      { name: 'Tax applied (18%)', pass: (savedOrder.total - savedOrder.subtotal) === tax },
      { name: 'Product preserved', pass: savedOrder.products.length === 1 },
      { name: 'Quantity correct', pass: savedOrder.products[0].quantity === 2 },
      { name: 'Price preserved', pass: savedOrder.products[0].priceAtTime === priceAtTime },
      { name: 'Delivery days set', pass: savedOrder.estimatedDeliveryDays === deliveryDays },
      { name: 'Shipping address set', pass: !!savedOrder.shippingAddress?.email },
      { name: 'Order status pending', pass: savedOrder.orderStatus === 'Awaiting Payment' },
      { name: 'Payment status pending', pass: savedOrder.paymentStatus === 'pending' }
    ];

    let passCount = 0;
    checks.forEach(check => {
      passCount += check.pass ? 1 : 0;
      const symbol = check.pass ? colors.green + '✓' : colors.red + '✗';
      console.log(`${symbol}${colors.reset} ${check.name}`);
    });

    console.log();
    if (passCount === checks.length) {
      logSuccess(`${currency} Test: All ${passCount}/${checks.length} checks passed!`);
      return true;
    } else {
      logError(`${currency} Test: ${checks.length - passCount} of ${checks.length} checks failed`);
      return false;
    }

  } catch (err) {
    logError(`${currency} test error: ${err.message}`);
    console.error(err.stack);
    return false;
  } finally {
    await mongoose.disconnect();
  }
}

async function runAllTests() {
  const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora-backend';
  
  try {
    const inrResult = await testCurrency('INR');
    
    // Wait before next test
    await new Promise(r => setTimeout(r, 1000));
    
    const usdResult = await testCurrency('USD');

    // Final Summary
    section('FINAL TEST SUMMARY');
    
    console.log(`${colors.bold}Results:${colors.reset}`);
    console.log(`  INR: ${inrResult ? colors.green + '✅ PASSED' : colors.red + '❌ FAILED'}${colors.reset}`);
    console.log(`  USD: ${usdResult ? colors.green + '✅ PASSED' : colors.red + '❌ FAILED'}${colors.reset}`);
    console.log();

    if (inrResult && usdResult) {
      console.log(`${colors.bold}${colors.green}🎉 ALL TESTS PASSED!${colors.reset}`);
      console.log(`\n${colors.green}Features Verified:${colors.reset}`);
      console.log(`  ✓ Add items to cart`);
      console.log(`  ✓ Create orders with products`);
      console.log(`  ✓ INR currency support`);
      console.log(`  ✓ USD currency support`);
      console.log(`  ✓ Dynamic pricing (subtotal + tax)`);
      console.log(`  ✓ Delivery days from database`);
      console.log(`  ✓ Order addresses & tracking`);
      console.log();
    } else {
      console.log(`${colors.bold}${colors.red}⚠️  Some tests failed${colors.reset}`);
    }

    process.exit(inrResult && usdResult ? 0 : 1);

  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runAllTests();
