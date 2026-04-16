// Script to clear pending checkout sessions from carts
const mongoose = require('mongoose');
require('dotenv').config();

const Schema = require('./src/models/schema.js');

async function clearPendingCheckouts() {
  try {
    const mongoUri = process.env.DATABASE_URI || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/celoradb';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const Cart = mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');

    // Find all carts with pending checkout sessions
    const cartsWithPending = await Cart.find({ 
      pendingCheckoutSessionId: { $exists: true, $ne: null } 
    });

    console.log(`Found ${cartsWithPending.length} carts with pending checkout sessions`);

    if (cartsWithPending.length > 0) {
      // Clear pending checkout sessions
      const result = await Cart.updateMany(
        { pendingCheckoutSessionId: { $exists: true, $ne: null } },
        { $unset: { pendingCheckoutSessionId: "" } }
      );

      console.log(`✅ Cleared ${result.modifiedCount} pending checkout sessions`);
    } else {
      console.log('ℹ️  No pending checkouts to clear');
    }

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearPendingCheckouts();
