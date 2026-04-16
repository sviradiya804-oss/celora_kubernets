const mongoose = require('mongoose');

async function verifyOrderAddresses() {
  try {
    require('dotenv').config();
    const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora_db';
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB\n');
    
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    
    // Check the order from scenario 5 (different addresses)
    const orderId = '3419b630-a44e-11f0-b79c-e92eb2ff0056';
    const order = await Order.findOne({ orderId }).lean();
    
    if (order) {
      console.log('📋 Order Found!');
      console.log('Order ID:', order.orderId);
      console.log('\n📍 Billing Address:');
      console.log(JSON.stringify(order.billingAddress, null, 2));
      console.log('\n📦 Shipping Address:');
      console.log(JSON.stringify(order.shippingAddress, null, 2));
      
      const billingCity = order.billingAddress?.city;
      const shippingCity = order.shippingAddress?.city;
      
      console.log('\n🎯 Verification:');
      console.log('  Billing City:', billingCity);
      console.log('  Shipping City:', shippingCity);
      console.log('  Are Different?', billingCity !== shippingCity ? '✅ YES' : '❌ NO');
      
      if (billingCity === 'San Francisco' && shippingCity === 'Oakland') {
        console.log('\n✅ SUCCESS: Different addresses stored correctly!');
      } else {
        console.log('\n⚠️ WARNING: Addresses may not match expected values');
      }
    } else {
      console.log('❌ Order not found with ID:', orderId);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verifyOrderAddresses();
