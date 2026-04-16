const mongoose = require('mongoose');

require('dotenv').config();
const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora_db';

mongoose.connect(dbUri)
  .then(async () => {
    console.log('Connected to MongoDB');
    const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }));
    
    const order = await Order.findOne({ orderId: '3419b630-a44e-11f0-b79c-e92eb2ff0056' }).lean();
    
    if (order) {
      console.log('\n✅ Order Found!');
      console.log('\nOrder ID:', order.orderId);
      console.log('\n📍 Billing Address:');
      console.log(JSON.stringify(order.billingAddress, null, 2));
      console.log('\n📦 Shipping Address:');
      console.log(JSON.stringify(order.shippingAddress, null, 2));
      console.log('\n🎯 Verification:');
      console.log('  Billing City:', order.billingAddress?.city);
      console.log('  Shipping City:', order.shippingAddress?.city);
      console.log('  Are Different?', order.billingAddress?.city !== order.shippingAddress?.city ? '✅ YES' : '❌ NO');
    } else {
      console.log('❌ Order not found');
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
