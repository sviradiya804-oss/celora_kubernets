require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const dbUri = process.env.DATABASE_URI;
  await mongoose.connect(dbUri);
  
  const addjewelries = mongoose.connection.collection('addjewelries');
  const p = await addjewelries.findOne({
    _id: mongoose.Types.ObjectId.createFromHexString('6987624bb7b2db8bb2818b49')
  });
  
  if (p) {
    console.log('✅ Found product in addjewelries');
    console.log('Title:', p.title);
    console.log('estimatedDeliveryDays:', p.estimatedDeliveryDays);
    console.log('deliveryDays:', p.deliveryDays);
    console.log('All fields with "day" in name:', 
      Object.keys(p).filter(k => k.toLowerCase().includes('day')));
  } else {
    console.log('❌ Product not found, showing sample:');
    const sample = await addjewelries.findOne({});
    if (sample) {
      console.log('Sample title:', sample.title);
      console.log('Sample delivery fields:');
      console.log('  estimatedDeliveryDays:', sample.estimatedDeliveryDays);
      console.log('  deliveryDays:', sample.deliveryDays);
      console.log('  All "day" fields:', 
        Object.keys(sample).filter(k => k.toLowerCase().includes('day')));
    }
  }
  
  await mongoose.disconnect();
})();
