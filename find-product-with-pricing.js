const mongoose = require('mongoose');
require('dotenv').config();

const Schema = require('./src/models/schema.js');

// Create Jewelry model
const Jewelry = mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');

async function findProductWithPricing() {
  try {
    await mongoose.connect(process.env.DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    // Find products with pricing structure
    const products = await Jewelry.find({
      $or: [
        { 'pricing.metalPricing': { $exists: true, $ne: [] } },
        { 'availableMetals': { $exists: true, $ne: [] } },
        { 'price': { $exists: true, $gt: 0 } }
      ]
    }).limit(5);
    
    console.log(`📦 Found ${products.length} products with pricing:\n`);
    
    for (const product of products) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Product ID: ${product._id}`);
      console.log(`Name: ${product.title || product.name || 'Unnamed'}`);
      console.log(`Base Price: $${product.price || 0}`);
      
      if (product.pricing && product.pricing.metalPricing) {
        console.log(`\n💎 Metal Pricing (${product.pricing.metalPricing.length} options):`);
        product.pricing.metalPricing.slice(0, 3).forEach((mp, i) => {
          const metalId = mp.metal?.id || mp.metal;
          const naturalPrice = mp.finalPrice?.natural;
          const labPrice = mp.finalPrice?.lab;
          console.log(`   ${i+1}. Metal ID: ${metalId}`);
          console.log(`      Natural: $${naturalPrice || 0}`);
          console.log(`      Lab: $${labPrice || 0}`);
        });
      }
      
      if (product.availableMetals && product.availableMetals.length > 0) {
        console.log(`\n🔧 Available Metals (${product.availableMetals.length} options):`);
        product.availableMetals.slice(0, 3).forEach((am, i) => {
          console.log(`   ${i+1}. Metal ID: ${am.metal}`);
          console.log(`      Price: $${am.price || 0}`);
        });
      }
      
      // Generate curl command
      if (product.pricing?.metalPricing && product.pricing.metalPricing[0]) {
        const firstMetal = product.pricing.metalPricing[0];
        const metalId = firstMetal.metal?.id || firstMetal.metal;
        
        console.log(`\n📝 Test curl command with variation:`);
        console.log(`\ncurl --location 'http://localhost:3000/api/cart/add' \\`);
        console.log(`--header 'Content-Type: application/json' \\`);
        console.log(`--data '{`);
        console.log(`  "sessionId": "test-session-${Date.now()}",`);
        console.log(`  "userId": "68b46ba64d06b352140da590",`);
        console.log(`  "productId": "${product._id}",`);
        console.log(`  "quantity": 1,`);
        console.log(`  "selectedOptions": {`);
        console.log(`    "metaldetail": "${metalId}",`);
        console.log(`    "ringsize": "6.5"`);
        console.log(`  }`);
        console.log(`}'`);
      } else if (product.availableMetals && product.availableMetals[0]) {
        const firstMetal = product.availableMetals[0];
        
        console.log(`\n📝 Test curl command with variation:`);
        console.log(`\ncurl --location 'http://localhost:3000/api/cart/add' \\`);
        console.log(`--header 'Content-Type: application/json' \\`);
        console.log(`--data '{`);
        console.log(`  "sessionId": "test-session-${Date.now()}",`);
        console.log(`  "userId": "68b46ba64d06b352140da590",`);
        console.log(`  "productId": "${product._id}",`);
        console.log(`  "quantity": 1,`);
        console.log(`  "selectedOptions": {`);
        console.log(`    "metaldetail": "${firstMetal.metal}"`);
        console.log(`  }`);
        console.log(`}'`);
      }
      
      console.log();
    }
    
    if (products.length === 0) {
      console.log('⚠️  No products found with pricing structures');
      console.log('   Products may need to have pricing data added\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

findProductWithPricing();
