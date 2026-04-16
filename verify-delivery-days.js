require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

(async () => {
  const dbUri = process.env.DATABASE_URI;
  await mongoose.connect(dbUri);
  
  const Jewelry = mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
  
  // Find the product from the order
  const product = await Jewelry.findById('6987624bb7b2db8bb2818b49').select('title estimatedDeliveryDays deliveryDays').lean();
  
  if (product) {
    console.log('✅ Found product:');
    console.log('  Title:', product.title);
    console.log('  estimatedDeliveryDays:', product.estimatedDeliveryDays);
    console.log('  deliveryDays:', product.deliveryDays);
  } else {
    console.log('❌ Product not found');
    const sample = await Jewelry.findOne({}).select('title estimatedDeliveryDays deliveryDays').lean();
    if (sample) {
      console.log('Sample product:');
      console.log('  Title:', sample.title);
      console.log('  estimatedDeliveryDays:', sample.estimatedDeliveryDays);
    }
  }
  
  await mongoose.disconnect();
})();
