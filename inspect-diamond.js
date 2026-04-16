require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

(async () => {
  const dbUri = process.env.DATABASE_URI;
  await mongoose.connect(dbUri);
  
  const Jewelry = mongoose.models.jewelryModel || 
    mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
  
  const product = await Jewelry.findOne({ diamondType: { $exists: true } }).lean();
  
  if (product) {
    console.log('Product:', product.title);
    console.log('diamondType:', product.diamondType);
    console.log('\naddedDiamonds:', JSON.stringify(product.addedDiamonds, null, 2));
    console.log('\notherDiamonds:', JSON.stringify(product.otherDiamonds, null, 2));
  } else {
    console.log('No product with diamonds found');
  }
  
  await mongoose.disconnect();
})();
