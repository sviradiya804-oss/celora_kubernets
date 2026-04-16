/**
 * Quick Address Verification Test
 * Tests that different billing and shipping addresses are stored correctly
 */

const mongoose = require('mongoose');

const API_BASE_URL = 'http://localhost:3000/api';
const userId = '68b46ba64d06b352140da590';
const productId = '68b2bb00fd8bd653d20313eb';

async function apiCall(method, endpoint, data = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  const result = await response.json();

  return {
    status: response.status,
    ok: response.ok,
    data: result,
  };
}

async function testDifferentAddresses() {
  try {
    console.log('🧪 Testing Different Billing & Shipping Addresses\n');
    
    // Step 1: Add product to cart
    const testId = Date.now();
    const addResponse = await apiCall('POST', '/cart/add', {
      sessionId: 'address-test-' + testId,
      userId,
      productId,
      quantity: 1,
      price: 1500,
    });
    
    const sessionId = addResponse.data.sessionId;
    console.log('✅ Cart created with sessionId:', sessionId);
    
    // Step 2: Checkout with different addresses
    const checkoutResponse = await apiCall('POST', '/cart/checkout-with-payment', {
      sessionId,
      userId,
      paymentMethod: 'card',
      cardDetails: { token: 'tok_visa' },
      email: 'test@example.com',
      phone: '+1234567890',
      customerName: 'John Doe',
      billingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        address: '100 Market Street',
        apartment: 'Suite 500',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94105',
        country: 'US',
      },
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        address: '456 Residential Ave',
        apartment: 'Apt 12B',
        city: 'Oakland',
        state: 'CA',
        zipCode: '94601',
        country: 'US',
      },
    });
    
    if (!checkoutResponse.ok) {
      console.error('❌ Checkout failed:', checkoutResponse.data);
      process.exit(1);
    }
    
    const orderId = checkoutResponse.data.order.orderId;
    console.log('✅ Order created:', orderId);
    
    // Step 3: Verify in database
    require('dotenv').config();
    const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora_db';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB\n');
    
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    const order = await Order.findOne({ orderId }).lean();
    
    if (!order) {
      console.error('❌ Order not found in database');
      process.exit(1);
    }
    
    console.log('📋 Order Verification:\n');
    console.log('Order ID:', order.orderId);
    console.log('\n📍 Billing Address:');
    console.log('  ', order.billingAddress);
    console.log('\n📦 Shipping Address:');
    console.log('  ', order.shippingAddress);
    
    const billingCity = order.billingAddress?.city;
    const shippingCity = order.shippingAddress?.city;
    
    console.log('\n🎯 Test Results:');
    console.log('  Billing City:', billingCity);
    console.log('  Shipping City:', shippingCity);
    console.log('  Different?', billingCity !== shippingCity ? '✅ YES' : '❌ NO');
    
    if (billingCity === 'San Francisco' && shippingCity === 'Oakland') {
      console.log('\n✅ SUCCESS: Different addresses stored correctly!');
      console.log('✅ Billing and shipping addresses are properly separated in the database.\n');
      process.exit(0);
    } else {
      console.log('\n❌ FAIL: Addresses not stored as expected');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testDifferentAddresses();
