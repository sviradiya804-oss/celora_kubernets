const mongoose = require('mongoose');
require('dotenv').config();

const Schema = require('./src/models/schema.js');

// Create Jewelry model
const Jewelry = mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');

async function findProduct() {
  try {
    await mongoose.connect(process.env.DATABASE_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    // Get a valid product with price
    const product = await Jewelry.findOne({ price: { $exists: true, $gt: 0 } });
    
    if (product) {
      console.log('✅ Found a valid product to use for testing:\n');
      console.log(`   Product ID: ${product._id}`);
      console.log(`   Name: ${product.title || product.name || 'Unnamed'}`);
      console.log(`   Price: $${product.price || 0}`);
      console.log(`   Category: ${product.category || 'N/A'}`);
      console.log('\n📝 Use this curl command to add to cart:\n');
      console.log(`curl --location 'http://localhost:3000/api/cart/add' \\`);
      console.log(`--header 'Content-Type: application/json' \\`);
      console.log(`--data '{`);
      console.log(`  "sessionId": "9da02895-cd66-402e-b810-3320d8d29c6c",`);
      console.log(`  "userId": "68b46ba64d06b352140da590",`);
      console.log(`  "productId": "${product._id}",`);
      console.log(`  "quantity": 1`);
      console.log(`}'`);
    } else {
      console.log('⚠️  No products found with valid prices');
      
      // Show any product
      const anyProduct = await Jewelry.findOne();
      if (anyProduct) {
        console.log('\n📦 Sample product (may not have price):\n');
        console.log(`   Product ID: ${anyProduct._id}`);
        console.log(`   Name: ${anyProduct.title || anyProduct.name || 'Unnamed'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

findProduct();
