// Test script for cart with multiple products
const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/celoradb', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Schema = require('./src/models/schema.js');

// Create schemas
const cartSchema = new mongoose.Schema(Schema.cart);
const productSchema = new mongoose.Schema(Schema.product);

// Create models
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', cartSchema, 'carts');
const Product = mongoose.models.productModel || mongoose.model('productModel', productSchema, 'products');

async function testMultipleProducts() {
  try {
    console.log('Testing cart with multiple products...');
    
    // Find some test products
    const products = await Product.find().limit(3);
    console.log('Found products:', products.length);
    
    if (products.length === 0) {
      console.log('No products found in database. Creating test products...');
      
      // Create test products
      const testProducts = [
        {
          title: 'Diamond Ring',
          description: 'Beautiful diamond engagement ring',
          price: 2500.00,
          category: 'Rings',
          material: 'Gold',
          images: ['https://example.com/ring1.jpg'],
          isActive: true
        },
        {
          title: 'Pearl Necklace',
          description: 'Elegant pearl necklace',
          price: 850.00,
          category: 'Necklaces',
          material: 'Pearl',
          images: ['https://example.com/necklace1.jpg'],
          isActive: true
        },
        {
          title: 'Gold Earrings',
          description: 'Classic gold drop earrings',
          price: 450.00,
          category: 'Earrings',
          material: 'Gold',
          images: ['https://example.com/earrings1.jpg'],
          isActive: true
        }
      ];
      
      for (let productData of testProducts) {
        const product = new Product(productData);
        await product.save();
        products.push(product);
      }
      
      console.log('Created test products:', products.length);
    }
    
    // Create a test cart with multiple products
    const testUserId = new mongoose.Types.ObjectId();
    const testSessionId = 'test-session-' + Date.now();
    
    const testCart = new Cart({
      sessionId: testSessionId,
      userId: testUserId,
      items: products.map((product, index) => ({
        productId: product._id,
        quantity: index + 1, // Different quantities: 1, 2, 3
        selectedVariant: index === 0 ? 'Premium' : 'Standard',
        priceAtTime: product.price
      })),
      cartId: require('uuid').v1(),
      isCheckedOut: false
    });
    
    await testCart.save();
    console.log('Created test cart with ID:', testCart._id);
    
    // Test cart summary calculation
    const { calculateCartSummary } = require('./src/routes/cart.js');
    
    // Note: We can't import the function directly, so let's test the cart retrieval
    const cartWithProducts = await Cart.findById(testCart._id).populate({
      path: 'items.productId',
      select: 'title description price images category material'
    });
    
    console.log('Cart with populated products:');
    console.log('Items count:', cartWithProducts.items.length);
    
    let totalPrice = 0;
    cartWithProducts.items.forEach((item, index) => {
      console.log(`Product ${index + 1}:`);
      console.log('  Title:', item.productId.title);
      console.log('  Price:', item.productId.price);
      console.log('  Quantity:', item.quantity);
      console.log('  Item Total:', item.productId.price * item.quantity);
      totalPrice += item.productId.price * item.quantity;
    });
    
    console.log('Total Cart Value:', totalPrice);
    
    // Test email data preparation
    const emailProducts = cartWithProducts.items.map(item => ({
      productId: item.productId._id,
      quantity: item.quantity,
      priceAtTime: item.productId.price,
      productDetails: {
        title: item.productId.title,
        description: item.productId.description,
        price: item.productId.price,
        category: item.productId.category,
        material: item.productId.material,
        images: item.productId.images
      }
    }));
    
    console.log('\nEmail products data:');
    console.log(JSON.stringify(emailProducts, null, 2));
    
    // Clean up test data
    await Cart.findByIdAndDelete(testCart._id);
    console.log('\nTest completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

testMultipleProducts();
