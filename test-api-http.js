/**
 * HTTP Test for Public Order Tracking API
 * Tests actual API endpoints with real data
 * 
 * Usage:
 * 1. Start the backend server: npm start or node src/app.js
 * 2. Run this test: node test-api-http.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3003';

async function httpTest() {
  try {
    console.log('\n' + '='.repeat(100));
    console.log('🌐 HTTP API TEST - Public Order Tracking');
    console.log('='.repeat(100));
    console.log(`API URL: ${API_BASE_URL}`);
    console.log('='.repeat(100) + '\n');

    // 1. Get real order data from database
    console.log('📦 Step 1: Fetching real order data from database...');
    await mongoose.connect(process.env.DATABASE_URI);
    
    const order = await Order.findOne({ 
      'customerData.email': { $exists: true, $ne: null } 
    }).lean();
    
    if (!order) {
      console.log('❌ No orders with email found in database');
      console.log('💡 Please create an order using the checkout flow first');
      await mongoose.disconnect();
      return;
    }

    const testOrderId = order.orderId;
    const testEmail = order.customerData.email;
    
    console.log(`✅ Found test order`);
    console.log(`   Order ID: ${testOrderId}`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Total: $${order.total}\n`);
    
    await mongoose.disconnect();

    // 2. Test POST /api/public/track-order with correct email
    console.log('🧪 TEST 1: POST /api/public/track-order (Correct Email)');
    console.log('-'.repeat(100));
    
    const response1 = await fetch(`${API_BASE_URL}/api/public/track-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: testOrderId,
        email: testEmail
      })
    });

    const data1 = await response1.json();
    console.log(`Status: ${response1.status}`);
    console.log(`Success: ${data1.success ? '✅' : '❌'}`);
    
    if (data1.success) {
      console.log(`\n📦 Order Details:`);
      console.log(`   Order ID: ${data1.data.orderId}`);
      console.log(`   Status: ${data1.data.status}`);
      console.log(`   Payment: ${data1.data.paymentStatus}`);
      console.log(`   Progress: ${data1.data.progressPercentage}%`);
      console.log(`   Total: ${data1.data.formattedTotal}`);
      console.log(`   Items: ${data1.data.products?.length || 0}`);
      
      if (data1.data.progress && data1.data.progress.length > 0) {
        console.log(`\n   Progress Steps:`);
        data1.data.progress.forEach(step => {
          const icon = step.completed ? '✅' : '⭕';
          console.log(`   ${icon} ${step.label} - ${step.status}`);
        });
      }
      
      if (data1.data.tracking) {
        console.log(`\n   🚚 Tracking: ${data1.data.tracking.trackingId || 'Not available'}`);
      }
    } else {
      console.log(`   Error: ${data1.error}`);
    }

    // 3. Test POST /api/public/track-order with wrong email
    console.log('\n\n🧪 TEST 2: POST /api/public/track-order (Wrong Email - Should Fail)');
    console.log('-'.repeat(100));
    
    const response2 = await fetch(`${API_BASE_URL}/api/public/track-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: testOrderId,
        email: 'wrong@example.com'
      })
    });

    const data2 = await response2.json();
    console.log(`Status: ${response2.status}`);
    console.log(`Success: ${data2.success ? '✅' : '❌'}`);
    console.log(`Error: ${data2.error || 'N/A'}`);
    
    if (response2.status === 403) {
      console.log('✅ Correctly rejected wrong email');
    }

    // 4. Test GET /api/public/track-order/:orderId (Quick status)
    console.log('\n\n🧪 TEST 3: GET /api/public/track-order/:orderId (Quick Status)');
    console.log('-'.repeat(100));
    
    const response3 = await fetch(`${API_BASE_URL}/api/public/track-order/${testOrderId}`);
    const data3 = await response3.json();
    
    console.log(`Status: ${response3.status}`);
    console.log(`Success: ${data3.success ? '✅' : '❌'}`);
    
    if (data3.success) {
      console.log(`\n📦 Quick Status:`);
      console.log(`   Order ID: ${data3.data.orderId}`);
      console.log(`   Status: ${data3.data.status}`);
      console.log(`   Message: "${data3.data.statusMessage}"`);
      console.log(`   Progress: ${data3.data.progressPercentage}%`);
      console.log(`   Delivered: ${data3.data.isDelivered ? '✅ Yes' : '❌ No'}`);
      console.log(`   Has Tracking: ${data3.data.hasTracking ? '✅ Yes' : '❌ No'}`);
    }

    // 5. Test GET with invalid order ID
    console.log('\n\n🧪 TEST 4: GET /api/public/track-order/:orderId (Invalid ID - Should Fail)');
    console.log('-'.repeat(100));
    
    const response4 = await fetch(`${API_BASE_URL}/api/public/track-order/INVALID-ORDER-ID`);
    const data4 = await response4.json();
    
    console.log(`Status: ${response4.status}`);
    console.log(`Success: ${data4.success ? '✅' : '❌'}`);
    console.log(`Error: ${data4.error || 'N/A'}`);
    
    if (response4.status === 404) {
      console.log('✅ Correctly returned 404 for invalid order');
    }

    // 6. Test POST without email
    console.log('\n\n🧪 TEST 5: POST /api/public/track-order (Missing Email - Should Fail)');
    console.log('-'.repeat(100));
    
    const response5 = await fetch(`${API_BASE_URL}/api/public/track-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderId: testOrderId
      })
    });

    const data5 = await response5.json();
    console.log(`Status: ${response5.status}`);
    console.log(`Success: ${data5.success ? '✅' : '❌'}`);
    console.log(`Error: ${data5.error || 'N/A'}`);
    
    if (response5.status === 400) {
      console.log('✅ Correctly rejected missing email');
    }

    // 7. Test with currency conversion (if available)
    console.log('\n\n🧪 TEST 6: POST /api/public/track-order (With Currency Conversion)');
    console.log('-'.repeat(100));
    
    const response6 = await fetch(`${API_BASE_URL}/api/public/track-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'currency': 'EUR'  // Test currency header
      },
      body: JSON.stringify({
        orderId: testOrderId,
        email: testEmail
      })
    });

    const data6 = await response6.json();
    console.log(`Status: ${response6.status}`);
    console.log(`Success: ${data6.success ? '✅' : '❌'}`);
    
    if (data6.success) {
      console.log(`   Total: ${data6.data.formattedTotal} (Requested: EUR)`);
      console.log(`   Currency: ${data6.data.currency || 'USD'}`);
    }

    // Summary
    console.log('\n\n' + '='.repeat(100));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(100));
    console.log(`✅ TEST 1: Track with correct email - ${data1.success ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ TEST 2: Track with wrong email - ${!data2.success && response2.status === 403 ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ TEST 3: Quick status check - ${data3.success ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ TEST 4: Invalid order ID - ${!data4.success && response4.status === 404 ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ TEST 5: Missing email - ${!data5.success && response5.status === 400 ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ TEST 6: Currency conversion - ${data6.success ? 'PASSED' : 'FAILED'}`);
    console.log('='.repeat(100));

    const totalPassed = [
      data1.success,
      !data2.success && response2.status === 403,
      data3.success,
      !data4.success && response4.status === 404,
      !data5.success && response5.status === 400,
      data6.success
    ].filter(Boolean).length;

    console.log(`\n🎯 ${totalPassed}/6 tests passed`);
    console.log('='.repeat(100) + '\n');

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure the backend server is running:');
      console.error('   npm start  OR  node src/app.js');
    }
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  }
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
  console.error('❌ fetch is not available. Please use Node.js v18 or higher, or install node-fetch');
  process.exit(1);
}

httpTest();
