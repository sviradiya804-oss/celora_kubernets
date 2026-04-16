/**
 * Get complete order with email for testing
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');

async function getCompleteOrder() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URI);
    console.log('✅ Connected\n');

    const order = await Order.findOne({ 
      'customerData.email': { $exists: true, $ne: null } 
    }).lean();
    
    if (!order) {
      console.log('No order found');
      await mongoose.disconnect();
      return;
    }

    console.log('📦 COMPLETE ORDER WITH EMAIL:');
    console.log('='.repeat(100));
    console.log(JSON.stringify(order, null, 2));
    console.log('='.repeat(100));

    console.log('\n🎯 TEST DATA:');
    console.log(`Order ID: ${order.orderId}`);
    console.log(`Email: ${order.customerData?.email || 'Not found'}`);
    console.log(`Status: ${order.status}`);
    console.log(`Total: ${order.total}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

getCompleteOrder();
