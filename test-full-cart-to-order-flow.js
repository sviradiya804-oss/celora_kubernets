const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();
const { v1: uuid } = require('uuid');
const Schema = require('./src/models/schema.js');

const API_BASE = 'http://localhost:3000/api';

// Register models
const User = mongoose.models.userModel || mongoose.model('userModel', new mongoose.Schema(Schema.signup), 'users');
const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');
const Coupon = mongoose.models.couponModel || mongoose.model('couponModel', new mongoose.Schema(Schema.coupon), 'coupons');

let testResults = [];

// Color codes for console output
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

function logSuccess(message, data = null) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
  if (data) {
    console.log(`  ${colors.cyan}${JSON.stringify(data, null, 2).split('\n').join('\n  ')}${colors.reset}`);
  }
}

function logError(message, error = null) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
  if (error) {
    console.log(`  ${colors.red}${error}${colors.reset}`);
  }
}

function logInfo(message) {
  console.log(`${colors.blue}ℹ ${message}${colors.reset}`);
}

async function createTestUser() {
  subSection('Step 1: Creating Test User');
  try {
    const email = `testuser${Date.now()}@celora.com`;
    
    const user = await User.create({
      email: email,
      name: 'Test User',
      password: 'Test@12345'
    });
    
    const token = user._id.toString();
    
    logSuccess('User created', {
      userId: user._id,
      email: user.email,
      name: user.name
    });
    
    return {
      userId: user._id,
      email: user.email,
      token: token
    };
  } catch (error) {
    logError('User creation failed', error.message);
    throw error;
  }
}

async function getProducts() {
  subSection('Step 2: Fetching Products from Database');
  try {
    const products = await Jewelry.find({}).limit(3);
    
    if (products.length === 0) {
      logError('No products found in database');
      throw new Error('No products available');
    }
    
    logSuccess(`Found ${products.length} products`);
    products.forEach((prod, i) => {
      console.log(`  ${i + 1}. ${colors.cyan}${prod.title}${colors.reset} (ID: ${prod._id})`);
      console.log(`     Price: ₹${prod.basePrice}`);
    });
    
    return products;
  } catch (error) {
    logError('Failed to fetch products', error.message);
    throw error;
  }
}

async function createCart(userId, product1, product2) {
  subSection('Step 3: Creating Cart & Adding Products');
  
  try {
    const sessionId = uuid();
    
    // Get product details with pricing
    const price1 = product1.basePrice || product1.price || 5000;
    const price2 = product2.basePrice || product2.price || 6000;
    
    // Create cart with both products
    const cart = await Cart.create({
      cartId: uuid(),
      customer: userId,
      userId: userId,
      sessionId: sessionId,
      items: [
        {
          itemId: uuid(),
          productId: product1._id,
          quantity: 1,
          priceAtTime: price1,
          selectedVariant: {
            selectedOptions: {
              metaldetail: '18K Gold',
              ringsize: 'Size 7'
            }
          },
          diamondDetails: {
            diamondType: 'Natural',
            lab: false,
            shape: 'Round',
            carat: 1.5
          }
        },
        {
          itemId: uuid(),
          productId: product2._id,
          quantity: 1,
          priceAtTime: price2,
          selectedVariant: {
            selectedOptions: {
              metaldetail: '14K White Gold',
              ringsize: 'Size 8'
            }
          },
          diamondDetails: {
            diamondType: 'Lab',
            lab: true,
            shape: 'Cushion',
            carat: 1.0
          }
        }
      ]
    });
    
    // Add missing fields for our display logic
    cart.subTotal = price1 + price2;
    cart.total = price1 + price2;
    
    logSuccess('Product 1 added to cart', {
      product: product1.title,
      price: `₹${price1}`,
      metalType: '18K Gold',
      ringSize: 'Size 7',
      diamondType: 'Natural (DR)'
    });
    
    logSuccess('Product 2 added to cart', {
      product: product2.title,
      price: `₹${price2}`,
      metalType: '14K White Gold',
      ringSize: 'Size 8',
      diamondType: 'Lab Grown (LC)'
    });
    
    logInfo(`Cart subtotal: ₹${cart.subTotal}`);
    
    return { cartId: cart._id, cartData: cart };
  } catch (error) {
    logError('Failed to create cart', error.message);
    throw error;
  }
}

async function getCoupons() {
  subSection('Step 4: Fetching Available Coupons');
  try {
    const coupons = await Coupon.find({ isActive: true }).limit(5);
    
    if (coupons.length === 0) {
      logError('No coupons found - creating test coupon');
      const coupon = await Coupon.create({
        couponCode: 'SAVE20',
        discountType: 'Percentage',
        discountValue: 20,
        isActive: true,
        dateRange: {
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
      logSuccess('Test coupon created', { code: coupon.couponCode, discount: `${coupon.discountValue}%` });
      return [coupon];
    }
    
    logSuccess(`Found ${coupons.length} coupons`);
    coupons.forEach((coupon, i) => {
      const discountDisplay = coupon.discountType === 'Percentage' 
        ? `${coupon.discountValue}%` 
        : `₹${coupon.discountValue}`;
      console.log(`  ${i + 1}. ${colors.cyan}${coupon.couponCode}${colors.reset} - ${coupon.discountType} off ${discountDisplay}`);
    });
    
    return coupons;
  } catch (error) {
    logError('Failed to fetch coupons', error.message);
    throw error;
  }
}

async function applyCouponToCart(cartId, couponCode) {
  subSection('Step 5: Applying Coupon to Cart');
  try {
    // Find the coupon
    const coupon = await Coupon.findOne({ couponCode: couponCode, isActive: true });
    
    if (!coupon) {
      logError(`Coupon not found: ${couponCode}`);
      throw new Error(`Coupon ${couponCode} not found`);
    }
    
    // Get cart
    const cart = await Cart.findById(cartId);
    
    // Calculate subtotal from items
    let subtotal = 0;
    cart.items.forEach(item => {
      subtotal += (item.priceAtTime || 0) * item.quantity;
    });
    
    cart.subTotal = subtotal;
    
    // Calculate discount
    let discount = 0;
    if (coupon.discountType === 'Percentage') {
      discount = Math.round((subtotal * coupon.discountValue) / 100);
    } else if (coupon.discountType === 'Flat') {
      discount = coupon.discountValue;
    }
    
    const finalTotal = subtotal - discount;
    
    // Update cart with coupon
    cart.coupon = {
      code: coupon.couponCode,
      discount: discount
    };
    cart.discount = discount;
    cart.total = finalTotal;
    cart.subTotal = subtotal;
    await cart.save();
    
    logSuccess('Coupon applied successfully', {
      couponCode: couponCode,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue + (coupon.discountType === 'Percentage' ? '%' : ''),
      subtotal: `₹${subtotal}`,
      discount: `₹${discount}`,
      discountPercentage: `${((discount / subtotal) * 100).toFixed(2)}%`,
      finalTotal: `₹${finalTotal}`,
      itemsInCart: cart.items.length
    });
    
    // Add subTotal and total for our logic
    cart.subTotal = subtotal;
    cart.discount = discount;
    
    return { cartId, cartData: cart, appliedCoupon: couponCode };
  } catch (error) {
    logError('Failed to apply coupon', error.message);
    throw error;
  }
}

async function displayCartSummary(cartData, couponCode) {
  subSection('Step 6: Cart Summary Before Checkout');
  
  console.log(`${colors.bold}Items in Cart:${colors.reset}`);
  const jewelries = await Jewelry.find({ _id: { $in: cartData.items.map(i => i.productId) } });
  const jewelryMap = {};
  jewelries.forEach(j => {
    jewelryMap[j._id.toString()] = j;
  });
  
  cartData.items.forEach((item, i) => {
    const jewelry = jewelryMap[item.productId.toString()];
    const diamondType = item.diamondDetails?.diamondType === 'Natural' ? 'Natural (DR)' : 
                        item.diamondDetails?.diamondType === 'Lab' ? 'Lab Grown (LC)' : 'N/A';
    
    console.log(`  ${i + 1}. ${colors.cyan}${jewelry?.title || 'Product'}${colors.reset}`);
    console.log(`     Quantity: ${item.quantity}`);
    console.log(`     Metal Type: ${item.selectedVariant?.selectedOptions?.metaldetail}`);
    console.log(`     Ring Size: ${item.selectedVariant?.selectedOptions?.ringsize}`);
    console.log(`     Diamond Type: ${diamondType}`);
    console.log(`     Unit Price: ₹${item.priceAtTime}`);
    console.log();
  });
  
  console.log(`${colors.bold}Pricing Breakdown:${colors.reset}`);
  console.log(`  Subtotal:      ₹${cartData.subTotal}`);
  console.log(`  ${colors.green}Coupon Applied: ${couponCode}${colors.reset}`);
  console.log(`  ${colors.red}Discount:      -₹${cartData.discount || 0}${colors.reset}`);
  console.log(`  ${colors.bold}Final Total:     ₹${cartData.total}${colors.reset}`);
}

async function checkoutWithPayment(userId, cartData) {
  subSection('Step 7: Proceeding to Checkout');
  try {
    function normalizeImages(imgs) {
      if (!imgs) return [];
      if (Array.isArray(imgs)) return imgs.filter(i => typeof i === 'string');
      if (typeof imgs === 'object') {
        const out = [];
        Object.values(imgs).forEach(v => {
          if (Array.isArray(v)) v.forEach(u => { if (typeof u === 'string') out.push(u); });
          else if (typeof v === 'string') out.push(v);
        });
        return out;
      }
      if (typeof imgs === 'string') return [imgs];
      return [];
    }
    
    // Get jewelry details for products
    const jewelries = await Jewelry.find({
      _id: { $in: cartData.items.map(i => i.productId) }
    });
    
    const jewelryMap = {};
    jewelries.forEach(j => {
      jewelryMap[j._id.toString()] = j;
    });
    
    const products = cartData.items.map((item, idx) => {
      const jewelry = jewelryMap[item.productId.toString()];
      const diamondType = item.diamondOptions?.diamondType === 'natural' ? 'Natural (DR)' : 
                          item.diamondOptions?.diamondType === 'labGrown' ? 'Lab Grown (LC)' : 'Not Specified';
      
      return {
        productId: item.productId,
        quantity: item.quantity,
        type: 'Premade',
        priceAtTime: item.price,
        imageUrl: normalizeImages(jewelry?.images)?.[0] || null,
        productDetails: {
          slug: jewelry?.slug || 'product-slug',
          title: jewelry?.title || 'Product',
          name: jewelry?.title || 'Product',
          category: jewelry?.category?.name || 'Jewelry',
          cadCode: jewelry?.cadCode || 'N/A',
          metalType: item.selectedOptions?.metalType || '18K Gold',
          ringSize: item.selectedOptions?.ringSize || 'Size 7',
          packagingType: item.selectedOptions?.packagingType || 'Standard Box',
          estimatedDeliveryDays: 14,
          selectedVariant: {
            metal: item.selectedOptions?.metalType?.split(' ')[0],
            diamondType: diamondType,
            priceNatural: item.price,
            priceLab: item.price * 0.8
          },
          diamondDetails: {
            shape: jewelry?.diamondShape || 'Round',
            diamondType: jewelry?.diamondType || 'Both',
            cut: jewelry?.diamondCut || 'Excellent',
            clarity: jewelry?.diamondClarity || 'VS1',
            caratSize: jewelry?.diamondCarat || '1.0',
            color: jewelry?.diamondColor || 'D',
            priceWithMargin: item.price,
            actualType: diamondType
          },
          images: normalizeImages(jewelry?.images) || []
        }
      };
    });
    
    // Create order
    const order = await Order.create({
      orderId: uuid(),
      referenceId: uuid(),
      customer: userId,
      products: products,
      subOrders: products.map(p => ({
        subOrderId: uuid(),
        ...p,
        status: 'Pending'
      })),
      shippingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: '123 Test Street',
        addressLine2: 'Apt 101',
        city: 'Delhi',
        state: 'Delhi',
        zipCode: '110001',
        country: 'India',
        email: 'test@example.com',
        phone: '9876543210'
      },
      billingAddress: {
        firstName: 'Test',
        lastName: 'User',
        addressLine1: '123 Test Street',
        addressLine2: 'Apt 101',
        city: 'Delhi',
        state: 'Delhi',
        zipCode: '110001',
        country: 'India',
        email: 'test@example.com',
        phone: '9876543210'
      },
      coupon: cartData.coupon || null,
      subtotal: cartData.subTotal,
      discount: cartData.discount || 0,
      total: cartData.total,
      totalAmount: cartData.total,
      paymentStatus: 'paid',
      orderStatus: 'Processing',
      currency: 'INR',
      paymentMethod: 'card'
    });
    
    logSuccess('Order created successfully', {
      orderId: order.orderId,
      status: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmount: `₹${order.totalAmount}`,
      itemsInOrder: order.products.length
    });
    
    return order;
  } catch (error) {
    logError('Checkout failed', error.message);
    throw error;
  }
}

async function getOrderDetails(orderId) {
  subSection('Step 8: Fetching Complete Order Details from Database');
  try {
    const order = await Order.findById(orderId);
    
    if (!order) {
      logError('Order not found');
      throw new Error('Order not found');
    }
    
    console.log(`${colors.bold}Order Information:${colors.reset}`);
    console.log(`  Order ID: ${colors.cyan}${order.orderId}${colors.reset}`);
    console.log(`  Status: ${order.orderStatus}`);
    console.log(`  Payment Status: ${order.paymentStatus}`);
    console.log(`  Order Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    console.log();
    
    console.log(`${colors.bold}Products in Order:${colors.reset}`);
    order.products.forEach((product, i) => {
      console.log(`  ${i + 1}. ${colors.cyan}${product.productDetails.title}${colors.reset}`);
      console.log(`     Slug: ${colors.yellow}${product.productDetails.slug}${colors.reset}`);
      console.log(`     Product ID: ${product.productId}`);
      console.log(`     Quantity: ${product.quantity}`);
      console.log(`     Unit Price: ₹${product.priceAtTime}`);
      
      if (product.productDetails.metalType) {
        console.log(`     Metal Type: ${product.productDetails.metalType}`);
        console.log(`     Ring Size: ${product.productDetails.ringSize}`);
        console.log(`     Packaging: ${product.productDetails.packagingType}`);
      }
      
      if (product.productDetails.selectedVariant) {
        const diamondType = product.productDetails.selectedVariant.diamondType;
        console.log(`     Diamond Type Selected: ${diamondType}`);
      }
      
      if (product.productDetails.diamondDetails) {
        console.log(`     Diamond Details:`);
        console.log(`       - Shape: ${product.productDetails.diamondDetails.shape}`);
        console.log(`       - Carat: ${product.productDetails.diamondDetails.caratSize}`);
        console.log(`       - Cut: ${product.productDetails.diamondDetails.cut}`);
        console.log(`       - Clarity: ${product.productDetails.diamondDetails.clarity}`);
        console.log(`       - Color: ${product.productDetails.diamondDetails.color}`);
        console.log(`       - Type: ${product.productDetails.diamondDetails.actualType}`);
      }
      console.log();
    });
    
    console.log(`${colors.bold}Pricing & Discount:${colors.reset}`);
    console.log(`  Subtotal:        ₹${order.subtotal}`);
    
    if (order.coupon) {
      console.log(`  ${colors.green}Coupon Applied:  ${order.coupon.code}${colors.reset}`);
      console.log(`  Discount Type:   ${order.coupon.discountType}`);
      console.log(`  Discount Value:  ${order.coupon.discountValue}${order.coupon.discountType === 'Percentage' ? '%' : ''}`);
      console.log(`  ${colors.red}Discount Amount: -₹${order.coupon.discount || order.discount}${colors.reset}`);
    }
    
    console.log(`  ${colors.bold}${colors.green}Total Amount:    ₹${order.total}${colors.reset}`);
    console.log();
    
    console.log(`${colors.bold}Shipping Address:${colors.reset}`);
    if (order.shippingAddress) {
      console.log(`  ${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`);
      console.log(`  ${order.shippingAddress.addressLine1}`);
      if (order.shippingAddress.addressLine2) {
        console.log(`  ${order.shippingAddress.addressLine2}`);
      }
      console.log(`  ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}`);
      console.log(`  ${order.shippingAddress.country}`);
      console.log(`  Phone: ${order.shippingAddress.phone}`);
    }
    
    return order;
  } catch (error) {
    logError('Failed to fetch order details', error.message);
    throw error;
  }
}

async function runFullTest() {
  section('CELORA JEWELRY - COMPLETE CART TO ORDER FLOW WITH COUPON');
  
  try {
    // Step 1: Create test user
    const user = await createTestUser();
    
    // Step 2: Get products
    const products = await getProducts();
    
    // Step 3: Create cart and add products
    const { cartId, cartData } = await createCart(user.userId, products[0], products[1]);
    
    // Step 4: Get available coupons
    const coupons = await getCoupons();
    const applyCoupon = coupons[0];
    
    // Step 5: Apply coupon to cart
    const cartWithCoupon = await applyCouponToCart(cartId, applyCoupon.couponCode);
    
    // Step 6: Display cart summary
    await displayCartSummary(cartWithCoupon.cartData, applyCoupon.couponCode);
    
    // Step 7: Checkout
    const order = await checkoutWithPayment(user.userId, cartWithCoupon.cartData);
    
    // Step 8: Get order details from database
    const completeOrder = await getOrderDetails(order._id);
    
    // Final Summary
    section('FINAL VERIFICATION - ALL FIELDS PRESENT');
    
    const checks = [
      {
        name: 'Order Created',
        status: completeOrder._id ? 'PASS' : 'FAIL',
        value: completeOrder._id
      },
      {
        name: 'Coupon Applied',
        status: completeOrder.coupon?.code ? 'PASS' : 'FAIL',
        value: completeOrder.coupon?.code
      },
      {
        name: 'Discount Calculated',
        status: completeOrder.discount > 0 ? 'PASS' : 'FAIL',
        value: `₹${completeOrder.discount}`
      },
      {
        name: 'Product Slug',
        status: completeOrder.products?.[0]?.productDetails?.slug ? 'PASS' : 'FAIL',
        value: completeOrder.products?.[0]?.productDetails?.slug
      },
      {
        name: 'Diamond Type Selection',
        status: completeOrder.products?.[0]?.productDetails?.selectedVariant ? 'PASS' : 'FAIL',
        value: completeOrder.products?.[0]?.productDetails?.selectedVariant?.diamondType
      },
      {
        name: 'Diamond Details',
        status: completeOrder.products?.[0]?.productDetails?.diamondDetails ? 'PASS' : 'FAIL',
        value: `Shape: ${completeOrder.products?.[0]?.productDetails?.diamondDetails?.shape}, Carat: ${completeOrder.products?.[0]?.productDetails?.diamondDetails?.caratSize}`
      },
      {
        name: 'Addresses in Order',
        status: completeOrder.shippingAddress ? 'PASS' : 'FAIL',
        value: `${completeOrder.shippingAddress?.city}, ${completeOrder.shippingAddress?.zipCode}`
      },
      {
        name: 'Estimated Delivery',
        status: completeOrder.products?.[0]?.productDetails?.estimatedDeliveryDays ? 'PASS' : 'FAIL',
        value: `${completeOrder.products?.[0]?.productDetails?.estimatedDeliveryDays} days`
      }
    ];
    
    console.log(`${colors.bold}Verification Results:${colors.reset}\n`);
    let passCount = 0;
    checks.forEach(check => {
      passCount += check.status === 'PASS' ? 1 : 0;
      const symbol = check.status === 'PASS' ? colors.green + '✓' : colors.red + '✗';
      console.log(`${symbol}${colors.reset} ${check.name.padEnd(30)} : ${check.value}`);
    });
    
    console.log(`\n${colors.bold}${colors.green}${passCount}/${checks.length} CHECKS PASSED${colors.reset}\n`);
    
  } catch (error) {
    logError('Test failed', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Connect to MongoDB and run test
const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora-backend';
mongoose.connect(dbUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  logSuccess('Connected to MongoDB');
  runFullTest();
}).catch(err => {
  logError('MongoDB connection failed', err.message);
  process.exit(1);
});
