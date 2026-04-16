const mongoose = require('mongoose');
const Schema = require('../src/models/schema');
require('dotenv').config();

async function main() {
  const mongoUri = process.env.DATABASE_URI;
  if (!mongoUri) {
    console.error('Please set DATABASE_URI in .env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const Cart = mongoose.models.cartModel || mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');

  const sessionId = process.env.TEST_SESSION_ID || process.argv[2] || 'auto-test-session';
  const userId = process.env.TEST_USER_ID || process.argv[3] || null;
  const productId = process.env.TEST_PRODUCT_ID || process.argv[4] || '68e22c2ee0c63062982a65cd';

  const existing = await Cart.findOne({ sessionId, isCheckedOut: false });
  if (existing) {
    console.log('Test cart already exists for session:', sessionId);
    console.log(existing);
    process.exit(0);
  }

  const cart = new Cart({
    sessionId,
    userId: userId || undefined,
    items: [
      {
        productId,
        quantity: 1,
        priceAtTime: 1.00,
        selectedVariant: {},
        engravingOptions: { engravingText: 'Test', font: 'Script' }
      }
    ],
    isCheckedOut: false,
    createdOn: new Date(),
    updatedOn: new Date(),
    cartId: require('uuid').v4()
  });

  await cart.save();
  console.log('Created test cart:', cart.sessionId, 'id:', cart._id.toString());
  process.exit(0);
}

main().catch(err => {
  console.error('Populate cart error', err);
  process.exit(1);
});
