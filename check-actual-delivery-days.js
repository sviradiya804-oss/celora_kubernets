require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');

const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora-backend';

mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true }).then(async () => {
  const Jewelry = mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');
  
  console.log('📊 Jewelry Products - Estimated Delivery Days:\n');
  
  const products = await Jewelry.find({}).select('title estimatedDeliveryDays').lean();
  
  if (products.length === 0) {
    console.log('No jewelry products found');
  } else {
    console.log(`Total products: ${products.length}\n`);
    
    products.forEach((p, i) => {
      const days = p.estimatedDeliveryDays || 'NOT SET';
      console.log(`${i+1}. ${p.title || 'Untitled'}: ${days} days`);
    });
    
    console.log('\n' + '='.repeat(60));
    
    const withValue = products.filter(p => p.estimatedDeliveryDays);
    const withoutValue = products.filter(p => !p.estimatedDeliveryDays);
    
    console.log(`✓ Products WITH estimatedDeliveryDays: ${withValue.length}`);
    console.log(`✗ Products WITHOUT estimatedDeliveryDays: ${withoutValue.length}`);
    
    if (withValue.length > 0) {
      const unique = [...new Set(withValue.map(p => p.estimatedDeliveryDays))];
      console.log(`\nUnique delivery day values in DB: ${unique.sort((a,b) => a-b).join(', ')} days`);
      
      console.log('\nBreakdown by delivery days:');
      unique.sort((a,b) => a-b).forEach(days => {
        const count = products.filter(p => p.estimatedDeliveryDays === days).length;
        console.log(`  ${days} days: ${count} product(s)`);
      });
    }
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
