const mongoose = require('mongoose');
require('dotenv').config();
const Schema = require('./src/models/schema');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/celoradb');

const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');

setTimeout(async () => {
  const product = await Jewelry.findOne({}).lean();
  if (product) {
    console.log('Product Title:', product.title);
    console.log('Has images:', !!product.images);
    console.log('Image count:', product.images?.length || 0);
    console.log('Has imageUrl:', !!product.imageUrl);
    console.log('Has slug:', !!product.slug);
    console.log('Has packaging:', !!product.packaging);
    console.log('Has packagingType:', !!product.packagingType);
  }
  process.exit(0);
}, 500);
