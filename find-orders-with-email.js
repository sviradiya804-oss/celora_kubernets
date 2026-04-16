/**
 * Find orders with customer email from checkout flow
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

const Order = mongoose.models.orderModel || mongoose.model('orderModel', Schema.order, 'orders');

async function findOrdersWithEmail() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.DATABASE_URI);
    console.log('✅ Connected\n');

    // Try different queries to find orders with email
    console.log('🔍 Searching for orders with email fields...\n');

    // 1. Orders with customerData.email
    const withCustomerData = await Order.find({ 
      'customerData.email': { $exists: true, $ne: null } 
    }).limit(2).lean();
    
    console.log(`Found ${withCustomerData.length} orders with customerData.email`);
    if (withCustomerData.length > 0) {
      console.log('Sample:', JSON.stringify(withCustomerData[0], null, 2).substring(0, 500));
    }

    // 2. Orders with shippingAddress.email
    const withShippingEmail = await Order.find({ 
      'shippingAddress.email': { $exists: true, $ne: null } 
    }).limit(2).lean();
    
    console.log(`\nFound ${withShippingEmail.length} orders with shippingAddress.email`);
    if (withShippingEmail.length > 0) {
      console.log('Sample:', JSON.stringify(withShippingEmail[0], null, 2).substring(0, 1000));
    }

    // 3. Orders with billingAddress.email
    const withBillingEmail = await Order.find({ 
      'billingAddress.email': { $exists: true, $ne: null } 
    }).limit(2).lean();
    
    console.log(`\nFound ${withBillingEmail.length} orders with billingAddress.email`);
    if (withBillingEmail.length > 0) {
      console.log('Sample:', JSON.stringify(withBillingEmail[0], null, 2).substring(0, 1000));
    }

    // 4. Count all orders
    const totalOrders = await Order.countDocuments();
    console.log(`\n📊 Total orders in database: ${totalOrders}`);

    // 5. Show all unique fields from sample orders
    const sampleOrders = await Order.find().limit(3).lean();
    console.log('\n📋 Available fields in orders:');
    if (sampleOrders.length > 0) {
      const fields = Object.keys(sampleOrders[0]);
      fields.forEach(field => {
        const value = sampleOrders[0][field];
        const type = Array.isArray(value) ? 'array' : typeof value;
        console.log(`  - ${field}: ${type}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

findOrdersWithEmail();
