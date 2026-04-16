const mongoose = require('mongoose');
require('dotenv').config();

const Schema = require('./src/models/schema.js');

// Create Jewelry model
const Jewelry = mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');

async function checkProducts() {
  try {
    console.log('📡 Connecting to MongoDB...');
    const dbUri = process.env.DATABASE_URI || process.env.MONGODB_URI || process.env.MONGO_URI;
    console.log('Connection string:', dbUri ? '✅ Found in .env' : '❌ NOT FOUND');
    
    if (!dbUri) {
      throw new Error('DATABASE_URI not found in .env file. Please add it.');
    }
    
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB successfully!\n');
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Available collections:');
    collections.forEach(coll => console.log(`   - ${coll.name}`));
    console.log();
    
    // Check if jewelrys collection exists
    const jewelrysExists = collections.some(c => c.name === 'jewelrys');
    
    if (!jewelrysExists) {
      console.log('⚠️  The "jewelrys" collection does NOT exist in your database!');
      console.log('   You need to create jewelry products first.\n');
      console.log('💡 Options:');
      console.log('   1. Import jewelry data from your existing system');
      console.log('   2. Create products using the /api/jewelry POST endpoint');
      console.log('   3. Run a data migration script\n');
    } else {
      // Count and list jewelry products
      const count = await Jewelry.countDocuments();
      console.log(`📦 Total jewelry products: ${count}\n`);
      
      if (count > 0) {
        console.log('📋 Available jewelry products:');
        const products = await Jewelry.find().limit(10).select('_id title name price');
        products.forEach(p => {
          console.log(`   ID: ${p._id}`);
          console.log(`   Name: ${p.title || p.name || 'Unnamed'}`);
          console.log(`   Price: $${p.price || 0}`);
          console.log();
        });
        
        if (count > 10) {
          console.log(`   ... and ${count - 10} more products\n`);
        }
      } else {
        console.log('⚠️  The "jewelrys" collection is EMPTY!');
        console.log('   Add products before trying to add them to cart.\n');
      }
    }
    
    console.log('✅ Database check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 MongoDB connection refused. Make sure:');
      console.error('   1. MONGODB_URI is set correctly in .env file');
      console.error('   2. Your MongoDB cloud database is accessible');
      console.error('   3. IP whitelist is configured (for MongoDB Atlas)');
    }
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

checkProducts();
