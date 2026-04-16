/**
 * Test Public Order Tracking API with Real Database Data
 * This script tests the public tracking endpoints using actual orders from the database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

// Create Order model
const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');

async function testPublicOrderTracking() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URI);
    console.log('✅ Connected to database\n');

    // 1. Find a real order from the database
    console.log('📦 Finding orders in database...');
    const orders = await Order.find({ 
      'customerData.email': { $exists: true, $ne: null } 
    })
      .limit(5)
      .lean();

    if (orders.length === 0) {
      console.log('❌ No orders found in database');
      console.log('💡 Create some test orders first using the checkout flow');
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Found ${orders.length} orders\n`);

    // Display available orders
    console.log('📋 Available Orders:');
    console.log('='.repeat(80));
    orders.forEach((order, index) => {
      const customerEmail = order.customerData?.email || 'No email';
      console.log(`${index + 1}. Order ID: ${order.orderId}`);
      console.log(`   Customer Email: ${customerEmail}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Payment Status: ${order.paymentStatus}`);
      console.log(`   Total: $${order.total?.toFixed(2) || '0.00'}`);
      console.log(`   Created: ${new Date(order.createdOn).toLocaleDateString()}`);
      console.log('-'.repeat(80));
    });

    // Test with first order that has an email
    const testOrder = orders.find(o => o.customerData?.email);
    
    if (!testOrder) {
      console.log('❌ No orders with customer email found');
      await mongoose.disconnect();
      return;
    }

    const orderId = testOrder.orderId;
    const customerEmail = testOrder.customerData?.email;

    console.log('\n🧪 TESTING PUBLIC ORDER TRACKING API');
    console.log('='.repeat(80));
    console.log(`Test Order ID: ${orderId}`);
    console.log(`Test Email: ${customerEmail}`);
    console.log('='.repeat(80));

    // Test 1: Track order with correct email
    console.log('\n📝 TEST 1: Track Order with Correct Email');
    console.log('-'.repeat(80));
    await testTrackWithEmail(orderId, customerEmail);

    // Test 2: Track order with wrong email
    console.log('\n📝 TEST 2: Track Order with Wrong Email (Should Fail)');
    console.log('-'.repeat(80));
    await testTrackWithEmail(orderId, 'wrong@example.com');

    // Test 3: Track order with invalid order ID
    console.log('\n📝 TEST 3: Track Order with Invalid Order ID (Should Fail)');
    console.log('-'.repeat(80));
    await testTrackWithEmail('INVALID-ORDER-ID', customerEmail);

    // Test 4: Quick status check
    console.log('\n📝 TEST 4: Quick Status Check (Order ID Only)');
    console.log('-'.repeat(80));
    await testQuickStatus(orderId);

    // Test 5: Quick status with invalid order
    console.log('\n📝 TEST 5: Quick Status with Invalid Order ID (Should Fail)');
    console.log('-'.repeat(80));
    await testQuickStatus('INVALID-ORDER-ID');

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

/**
 * Simulate POST /api/public/track-order
 */
async function testTrackWithEmail(orderId, email) {
  try {
    console.log(`Request: POST /api/public/track-order`);
    console.log(`Body: { orderId: "${orderId}", email: "${email}" }`);
    
    // Simulate the API logic
    if (!orderId) {
      console.log('❌ FAILED: Order ID is required');
      return;
    }

    if (!email) {
      console.log('❌ FAILED: Email is required');
      return;
    }

    // Find order
    const order = await Order.findOne({ orderId })
      .lean();
    
    if (!order) {
      console.log('❌ FAILED: Order not found (404)');
      console.log('Response: { success: false, error: "Order not found" }');
      return;
    }

    // Verify email
    const orderEmail = order.customerData?.email;
    
    if (!orderEmail || orderEmail.toLowerCase() !== email.toLowerCase()) {
      console.log('❌ FAILED: Email verification failed (403)');
      console.log('Response: { success: false, error: "Email verification failed" }');
      return;
    }

    // Success - build response
    console.log('✅ SUCCESS: Order found and email verified');
    
    // Calculate progress
    let completedSteps = 0;
    if (order.progress?.confirmed) completedSteps++;
    if (order.progress?.manufacturing) completedSteps++;
    if (order.progress?.qualityAssurance) completedSteps++;
    if (order.progress?.outForDelivery) completedSteps++;
    if (order.progress?.delivered) completedSteps++;
    
    const progressPercentage = (completedSteps / 5) * 100;

    console.log('\nResponse Data:');
    console.log(`  Order ID: ${order.orderId}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Payment Status: ${order.paymentStatus}`);
    console.log(`  Total: $${order.total?.toFixed(2) || '0.00'} ${order.currency || 'USD'}`);
    console.log(`  Progress: ${progressPercentage}% (${completedSteps}/5 steps)`);
    console.log(`  Products: ${order.products?.length || 0} items`);
    console.log(`  Created: ${new Date(order.createdOn).toLocaleDateString()}`);
    
    // Progress steps
    if (order.progress) {
      console.log('\n  Progress Steps:');
      if (order.progress.confirmed) {
        console.log(`    ✅ Confirmed - ${new Date(order.progress.confirmed.date).toLocaleDateString()}`);
      }
      if (order.progress.manufacturing) {
        console.log(`    🔨 Manufacturing - ${new Date(order.progress.manufacturing.date).toLocaleDateString()}`);
        if (order.progress.manufacturing.manufacturingImages?.length > 0) {
          console.log(`       📷 ${order.progress.manufacturing.manufacturingImages.length} images`);
        }
      }
      if (order.progress.qualityAssurance) {
        console.log(`    🔍 Quality Assurance - ${new Date(order.progress.qualityAssurance.date).toLocaleDateString()}`);
      }
      if (order.progress.outForDelivery) {
        console.log(`    🚚 Out For Delivery - ${new Date(order.progress.outForDelivery.date).toLocaleDateString()}`);
        if (order.progress.outForDelivery.trackingId) {
          console.log(`       📦 Tracking: ${order.progress.outForDelivery.trackingId}`);
          console.log(`       🔗 Link: ${order.progress.outForDelivery.trackingLink || 'N/A'}`);
        }
      }
      if (order.progress.delivered) {
        console.log(`    📦 Delivered - ${new Date(order.progress.delivered.date).toLocaleDateString()}`);
      }
    }

    // Tracking info
    if (order.progress?.outForDelivery) {
      console.log('\n  Tracking Available: ✅ Yes');
      console.log(`    Carrier: ${order.progress.outForDelivery.carrier || 'Standard Delivery'}`);
    } else {
      console.log('\n  Tracking Available: ❌ Not yet shipped');
    }

    // Shipping location (privacy-safe)
    if (order.shippingAddress) {
      console.log('\n  Shipping To:');
      console.log(`    ${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.country}`);
    }

  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
}

/**
 * Simulate GET /api/public/track-order/:orderId
 */
async function testQuickStatus(orderId) {
  try {
    console.log(`Request: GET /api/public/track-order/${orderId}`);
    
    const order = await Order.findOne({ orderId })
      .select('orderId status paymentStatus progress updatedOn total currency')
      .lean();
    
    if (!order) {
      console.log('❌ FAILED: Order not found (404)');
      console.log('Response: { success: false, error: "Order not found" }');
      return;
    }

    // Calculate progress
    let completedSteps = 0;
    if (order.progress?.confirmed) completedSteps++;
    if (order.progress?.manufacturing) completedSteps++;
    if (order.progress?.qualityAssurance) completedSteps++;
    if (order.progress?.outForDelivery) completedSteps++;
    if (order.progress?.delivered) completedSteps++;
    
    const progressPercentage = (completedSteps / 5) * 100;

    // Status message
    let statusMessage = '';
    switch (order.status) {
      case 'Pending':
        statusMessage = 'Your order is being processed';
        break;
      case 'Confirmed':
        statusMessage = 'Your order has been confirmed';
        break;
      case 'Manufacturing':
        statusMessage = 'Your jewelry is being crafted';
        break;
      case 'Quality Assurance':
        statusMessage = 'Final quality inspection';
        break;
      case 'Out For Delivery':
        statusMessage = 'Your order is on its way';
        break;
      case 'Delivered':
        statusMessage = 'Your order has been delivered';
        break;
      default:
        statusMessage = 'Order status: ' + order.status;
    }

    console.log('✅ SUCCESS: Quick status retrieved');
    console.log('\nResponse Data:');
    console.log(`  Order ID: ${order.orderId}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Message: "${statusMessage}"`);
    console.log(`  Progress: ${progressPercentage}%`);
    console.log(`  Last Updated: ${new Date(order.updatedOn).toLocaleDateString()}`);
    console.log(`  Delivered: ${order.progress?.delivered ? '✅ Yes' : '❌ No'}`);
    console.log(`  Has Tracking: ${order.progress?.outForDelivery?.trackingId ? '✅ Yes' : '❌ No'}`);
    console.log('\n  💡 Note: For complete details, customer needs to verify with email');

  } catch (error) {
    console.log('❌ ERROR:', error.message);
  }
}

// Run the test
console.log('\n' + '='.repeat(80));
console.log('🧪 PUBLIC ORDER TRACKING API - REAL DATABASE TEST');
console.log('='.repeat(80));
console.log('Testing with actual orders from MongoDB database');
console.log('='.repeat(80) + '\n');

testPublicOrderTracking();
