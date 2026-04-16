require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema');

const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');

(async () => {
  const dbUri = process.env.DATABASE_URI || process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(dbUri);

  const product = await Jewelry.findById('6987624bb7b2db8bb2818b49').lean();
  
  console.log('\n=== Product Image Analysis ===\n');
  console.log('Title:', product.title);
  console.log('Has imageUrl:', !!product.imageUrl);
  console.log('imageUrl value:', product.imageUrl);
  console.log('\nHas images field:', !!product.images);
  console.log('images type:', typeof product.images);
  
  if (product.images) {
    if (Array.isArray(product.images)) {
      console.log('images is an ARRAY with length:', product.images.length);
      if (product.images.length > 0) {
        console.log('First element type:', typeof product.images[0]);
        if (typeof product.images[0] === 'string') {
          console.log('First image URL:', product.images[0].substring(0, 100) + '...');
        } else if (typeof product.images[0] === 'object') {
          console.log('First image is object with keys:', Object.keys(product.images[0]).slice(0, 5));
          const firstKey = Object.keys(product.images[0])[0];
          console.log(`  ${firstKey}:`, Array.isArray(product.images[0][firstKey]) ? `[${product.images[0][firstKey].length} items]` : product.images[0][firstKey]);
          if (Array.isArray(product.images[0][firstKey]) && product.images[0][firstKey].length > 0) {
            console.log(`    First ${firstKey} URL:`, product.images[0][firstKey][0].substring(0, 100) + '...');
          }
        }
      }
    } else if (typeof product.images === 'object') {
      console.log('images is an OBJECT with keys:', Object.keys(product.images).slice(0, 5));
      const firstKey = Object.keys(product.images)[0];
      console.log(`  ${firstKey}:`, Array.isArray(product.images[firstKey]) ? `[${product.images[firstKey].length} items]` : product.images[firstKey]);
      if (Array.isArray(product.images[firstKey]) && product.images[firstKey].length > 0) {
        console.log(`    First ${firstKey} URL:`, product.images[firstKey][0].substring(0, 100) + '...');
      }
    }
  }

  console.log('\n');
  await mongoose.disconnect();
})().catch(async e => {
  console.error(e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
