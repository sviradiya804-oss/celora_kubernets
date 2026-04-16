require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

(async () => {
  const dbUri = process.env.DATABASE_URI;
  await mongoose.connect(dbUri);
  
  const Order = mongoose.models.orderModel || mongoose.model('orderModel', new mongoose.Schema(Schema.order), 'orders');
  
  // Get the latest order
  const order = await Order.findOne({}).sort({ createdOn: -1 }).lean();
  
  if (order) {
    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log('📋 COMPLETE ORDER DETAILS');
    console.log('═════════════════════════════════════════════════════════════════\n');
    
    console.log('📌 BASIC INFO');
    console.log(`  Order ID: ${order.orderId}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Payment Status: ${order.paymentStatus}`);
    console.log(`  Total: $${order.total}`);
    
    console.log('\n⏳ DELIVERY');
    console.log(`  Est. Delivery Days: ${order.estimatedDeliveryDays || '?'} days`);
    console.log(`  Expected Delivery: ${new Date(order.expectedDeliveryDate).toLocaleDateString()}`);
    
    console.log('\n👤 CUSTOMER');
    console.log(`  Email: ${order.customerData?.email || 'N/A'}`);
    console.log(`  Name: ${order.customerData?.name || 'N/A'}`);
    
    if (order.products && order.products[0]) {
      console.log('\n💍 PRODUCT DETAILS');
      const prod = order.products[0];
      console.log(`  Title: ${prod.productDetails?.title}`);
      console.log(`  Price: $${prod.priceAtTime}`);
      console.log(`  Cadence Code: ${prod.productDetails?.cadCode}`);
      console.log(`  Category: ${prod.productDetails?.category}`);
      console.log(`  Metal Type: ${prod.productDetails?.metalType}`);
      console.log(`  Packaging: ${prod.productDetails?.packagingType}`);
      console.log(`  Ring Size: ${prod.productDetails?.ringSize}`);
      
      console.log('\n💎 DIAMOND DETAILS');
      const diamond = prod.productDetails?.diamondDetails || {};
      console.log(`  Shape: ${diamond.shape || '-'}`);
      console.log(`  Diamond Type: ${diamond.diamondType || '-'}`);
      console.log(`  Cut: ${diamond.cut || '-'}`);
      console.log(`  Clarity: ${diamond.clarity || '-'}`);
      console.log(`  Carat Size: ${diamond.caratSize || '-'}`);
      console.log(`  Color: ${diamond.color || '-'}`);
      console.log(`  Price With Margin: ${diamond.priceWithMargin || '-'}`);
      
      console.log('\n🖼️  IMAGE');
      console.log(`  Image URL: ${prod.imageUrl ? prod.imageUrl.substring(0, 80) + '...' : 'N/A'}`);
    }
    
    if (order.subOrders && order.subOrders[0]) {
      console.log('\n📦 SUB-ORDER DETAILS');
      const subOrder = order.subOrders[0];
      console.log(`  Sub-Order ID: ${subOrder.subOrderId}`);
      console.log(`  Status: ${subOrder.status}`);
      console.log(`  Price: $${subOrder.priceAtTime}`);
      console.log(`  Product Details Title: ${subOrder.productDetails?.title}`);
      
      const diamond = subOrder.productDetails?.diamondDetails || {};
      console.log(`  Diamond Shape: ${diamond.shape || '-'}`);
      console.log(`  Diamond Type: ${diamond.diamondType || '-'}`);
    }
    
    console.log('\n═════════════════════════════════════════════════════════════════\n');
  } else {
    console.log('No orders found');
  }
  
  await mongoose.disconnect();
})();
