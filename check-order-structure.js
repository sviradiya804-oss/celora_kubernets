/**
 * Check actual order structure in database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');

async function checkOrderStructure() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URI);
    console.log('✅ Connected\n');

    // Get one order to see its structure
    const order = await Order.findOne().lean();
    
    if (!order) {
      console.log('No orders found');
      await mongoose.disconnect();
      return;
    }

    console.log('📦 Sample Order Structure:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(order, null, 2));
    console.log('='.repeat(80));

    // Check which email field exists
    console.log('\n📧 Email Fields Check:');
    console.log(`order.customer: ${order.customer}`);
    console.log(`order.customerData: ${JSON.stringify(order.customerData, null, 2)}`);
    console.log(`order.shippingAddress: ${JSON.stringify(order.shippingAddress, null, 2)}`);
    console.log(`order.billingAddress: ${JSON.stringify(order.billingAddress, null, 2)}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

checkOrderStructure();
