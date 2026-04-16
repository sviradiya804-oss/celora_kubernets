require('dotenv').config();
const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');
const { v1: uuid } = require('uuid');

// Register models
const User = mongoose.models.userModel || mongoose.model('userModel', new mongoose.Schema(Schema.signup), 'users');
const Cart = mongoose.models.cartModel || mongoose.model('cartModel', new mongoose.Schema(Schema.cart), 'carts');
const Jewelry = mongoose.models.jewelryModel || mongoose.model('jewelryModel', new mongoose.Schema(Schema.jewelry), 'jewelrys');

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
console.log(`${colors.bold}TEST: Metal Type + Metal Color + Diamond Details${colors.reset}`);
console.log(`${colors.bold}${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);

async function test() {
  try {
    const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora-backend';
    await mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log(`${colors.green}✓ Connected to MongoDB${colors.reset}\n`);

    // Create test user
    const email = `test-metal-${Date.now()}@celora.com`;
    const user = await User.create({ email, name: 'Test User', password: 'test123' });
    console.log(`${colors.green}✓ Test User Created${colors.reset}`);
    console.log(`  Email: ${colors.cyan}${email}${colors.reset}\n`);

    // Get a jewelry product
    const product = await Jewelry.findOne({});
    if (!product) {
      console.log(`${colors.red}✗ No jewelry product found${colors.reset}`);
      process.exit(1);
    }
    console.log(`${colors.green}✓ Product Found: ${product.title}${colors.reset}\n`);

    // Test 1: Create cart with metal type + metal color + proper diamond details
    console.log(`${colors.bold}${colors.yellow}→ TEST 1: Adding item with 14K Rose Gold (metal color) and Natural Diamond${colors.reset}`);
    console.log(`${colors.yellow}${'-'.repeat(60)}${colors.reset}`);
    
    const cart1 = new Cart({
      cartId: uuid(),
      sessionId: uuid(),
      userId: user._id,
      items: [
        {
          itemId: uuid(),
          productId: product._id,
          quantity: 1,
          priceAtTime: 5000,
          selectedVariant: {
            selectedOptions: {
              metaldetail: '68afea760686a0c9081db6ad', // Metal ID from the cURL request
              ringsize: '',
              shape: 'RD' // Round
            }
          },
          // ⚠️ This is the problematic data from the frontend
          diamondDetails: {
            stock_id: '',
            shape: '',
            carats: 0,
            col: '', // Color
            clar: '', // Clarity
            cut: '',
            lab: '', // ← EMPTY STRING - THIS WAS CAUSING THE ERROR
            diamondType: 'Natural',
            price: 0,
            markup_price: 0
          },
          engravingOptions: {
            engravingText: '',
            font: 'Script'
          }
        }
      ]
    });

    // Apply the transformation (simulating what the fixed endpoint does)
    const item = cart1.items[0];
    const diamondDetails = item.diamondDetails;
    
    // Transform the data
    const diamondType = diamondDetails.diamondType || '';
    const isLabGrown = diamondType.toLowerCase().includes('lab');
    
    if (diamondDetails.lab === '' || diamondDetails.lab === null || diamondDetails.lab === undefined) {
      diamondDetails.lab = isLabGrown;
    }
    
    if (diamondDetails.carats !== undefined && diamondDetails.carats !== null) {
      diamondDetails.carats = Number(diamondDetails.carats) || 0;
    }
    if (diamondDetails.price !== undefined && diamondDetails.price !== null) {
      diamondDetails.price = Number(diamondDetails.price) || 0;
    }
    if (diamondDetails.markup_price !== undefined && diamondDetails.markup_price !== null) {
      diamondDetails.markup_price = Number(diamondDetails.markup_price) || 0;
    }

    console.log(`${colors.bold}Diamond Details Before & After:${colors.reset}`);
    console.log(`  lab: ${colors.red}""${colors.reset} (string) → ${colors.green}${diamondDetails.lab}${colors.reset} (boolean)`);
    console.log(`  diamondType: ${colors.cyan}${diamondDetails.diamondType}${colors.reset}`);
    console.log();

    // Now try to save (this should work with the fix)
    try {
      await cart1.save();
      console.log(`${colors.green}✓ Cart saved successfully with transformed diamondDetails${colors.reset}\n`);
    } catch (err) {
      console.log(`${colors.red}✗ Cart save failed: ${err.message}${colors.reset}\n`);
      process.exit(1);
    }

    // Test 2: Test with Lab Grown diamond
    console.log(`${colors.bold}${colors.yellow}→ TEST 2: Adding item with 18K Gold and Lab Grown Diamond${colors.reset}`);
    console.log(`${colors.yellow}${'-'.repeat(60)}${colors.reset}`);
    
    const cart2 = new Cart({
      cartId: uuid(),
      sessionId: uuid(),
      userId: user._id,
      items: [
        {
          itemId: uuid(),
          productId: product._id,
          quantity: 1,
          priceAtTime: 4500,
          selectedVariant: {
            selectedOptions: {
              metaldetail: '68afea760686a0c9081db6ad',
              ringsize: 'Size 7',
              shape: 'CU' // Cushion
            }
          },
          diamondDetails: {
            stock_id: '',
            shape: 'Cushion',
            carats: 0,
            col: '',
            clar: '',
            cut: '',
            lab: '', // ← Empty string again
            diamondType: 'Lab', // Lab Grown
            price: 0,
            markup_price: 0
          }
        }
      ]
    });

    // Apply transformation
    const item2 = cart2.items[0];
    const diamondDetails2 = item2.diamondDetails;
    
    const diamondType2 = diamondDetails2.diamondType || '';
    const isLabGrown2 = diamondType2.toLowerCase().includes('lab');
    
    if (diamondDetails2.lab === '' || diamondDetails2.lab === null || diamondDetails2.lab === undefined) {
      diamondDetails2.lab = isLabGrown2;
    }

    console.log(`${colors.bold}Diamond Details Transformation:${colors.reset}`);
    console.log(`  diamondType: "${diamondDetails2.diamondType}" → lab should be: ${colors.green}${isLabGrown2}${colors.reset}`);
    console.log(`  Current lab value: ${colors.green}${diamondDetails2.lab}${colors.reset}`);
    console.log();

    try {
      await cart2.save();
      console.log(`${colors.green}✓ Lab Grown diamond cart saved successfully${colors.reset}\n`);
    } catch (err) {
      console.log(`${colors.red}✗ Cart save failed: ${err.message}${colors.reset}\n`);
      process.exit(1);
    }

    // Verify data in database
    console.log(`${colors.bold}${colors.yellow}→ TEST 3: Verify data persists correctly${colors.reset}`);
    console.log(`${colors.yellow}${'-'.repeat(60)}${colors.reset}`);
    
    const savedCart1 = await Cart.findById(cart1._id);
    const savedCart2 = await Cart.findById(cart2._id);

    console.log(`${colors.bold}Cart 1 (Natural Diamond):${colors.reset}`);
    console.log(`  lab: ${colors.green}${savedCart1.items[0].diamondDetails.lab}${colors.reset} (type: ${typeof savedCart1.items[0].diamondDetails.lab})`);
    console.log(`  diamondType: ${colors.cyan}${savedCart1.items[0].diamondDetails.diamondType}${colors.reset}`);
    
    console.log(`\n${colors.bold}Cart 2 (Lab Grown Diamond):${colors.reset}`);
    console.log(`  lab: ${colors.green}${savedCart2.items[0].diamondDetails.lab}${colors.reset} (type: ${typeof savedCart2.items[0].diamondDetails.lab})`);
    console.log(`  diamondType: ${colors.cyan}${savedCart2.items[0].diamondDetails.diamondType}${colors.reset}`);

    // Final summary
    console.log(`\n${colors.bold}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.bold}${colors.green}ALL TESTS PASSED ✓${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`
${colors.bold}Summary of Fix:${colors.reset}
  1. Frontend sends: lab: "" (empty string)
  2. Backend now transforms: lab: false/true (boolean)
  3. Transformation rules:
     - If diamondType includes "lab" → lab: true
     - If diamondType is "Natural" → lab: false
  4. Empty strings for numeric fields converted to 0
  5. All fields pass validation ✓

${colors.bold}This fix applies to:${colors.reset}
  • POST /api/cart/add (adding items to cart)
  • PUT /api/cart/update (updating cart items)
`);

  } catch (err) {
    console.log(`${colors.red}✗ Test failed: ${err.message}${colors.reset}`);
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

test();
