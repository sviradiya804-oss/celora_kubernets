/**
 * Engraving Storage Verification Test
 * 
 * Verifies that engraving options (text + font) are properly saved to cart and database
 */

const mongoose = require('mongoose');
require('dotenv').config();

const API_BASE_URL = 'http://localhost:3000/api';
const userId = '68b46ba64d06b352140da590';
const productId = '68b2bb00fd8bd653d20313eb';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

async function apiCall(method, endpoint, data = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  const result = await response.json();

  return {
    status: response.status,
    ok: response.ok,
    data: result,
  };
}

async function testEngravingStorage() {
  try {
    console.log(`\n${colors.cyan}╔════════════════════════════════════════════╗`);
    console.log(`║  ENGRAVING STORAGE VERIFICATION TEST       ║`);
    console.log(`╚════════════════════════════════════════════╝${colors.reset}\n`);

    const testId = Date.now();
    const sessionId = 'engraving-test-' + testId;

    // Step 1: Add product with engraving
    console.log(`${colors.yellow}Step 1: Adding product with engraving...${colors.reset}`);
    
    const engravingData = {
      engravingText: 'Forever & Always',
      font: 'Elegant Script'
    };

    const addResponse = await apiCall('POST', '/cart/add', {
      sessionId,
      userId,
      productId,
      quantity: 1,
      price: 1500,
      engravingOptions: engravingData
    });

    if (!addResponse.ok) {
      console.error(`${colors.red}❌ Failed to add product:${colors.reset}`, addResponse.data);
      process.exit(1);
    }

    const returnedSessionId = addResponse.data.sessionId || sessionId;
    console.log(`${colors.green}✅ Product added to cart${colors.reset}`);
    console.log(`   Session ID: ${returnedSessionId}`);
    console.log(`   Engraving sent: ${JSON.stringify(engravingData)}\n`);

    // Step 2: Get cart via API
    console.log(`${colors.yellow}Step 2: Retrieving cart via API...${colors.reset}`);
    
    const cartResponse = await apiCall('GET', `/cart?sessionId=${returnedSessionId}&userId=${userId}`);
    
    if (!cartResponse.ok) {
      console.error(`${colors.red}❌ Failed to get cart:${colors.reset}`, cartResponse.data);
      process.exit(1);
    }

    const cart = cartResponse.data.data?.[0] || cartResponse.data;
    const firstItem = cart.items?.[0];

    console.log(`${colors.green}✅ Cart retrieved${colors.reset}`);
    console.log(`   Cart ID: ${cart._id}`);
    console.log(`   Items: ${cart.items?.length}\n`);

    // Step 3: Check engraving in API response
    console.log(`${colors.yellow}Step 3: Checking engraving in API response...${colors.reset}`);
    
    const apiEngraving = firstItem?.engravingOptions;
    console.log(`   Engraving Options (item level):`, apiEngraving);
    console.log(`   Selected Options:`, firstItem?.selectedVariant?.selectedOptions);
    
    if (apiEngraving) {
      console.log(`${colors.green}✅ Engraving found in API response${colors.reset}`);
      console.log(`   Text: ${apiEngraving.engravingText}`);
      console.log(`   Font: ${apiEngraving.font}\n`);
    } else {
      console.log(`${colors.red}❌ Engraving NOT found in API response${colors.reset}\n`);
    }

    // Step 4: Verify in database
    console.log(`${colors.yellow}Step 4: Verifying in MongoDB...${colors.reset}`);
    
    const dbUri = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora_db';
    await mongoose.connect(dbUri);
    console.log(`${colors.green}✅ Connected to MongoDB${colors.reset}\n`);

    const Cart = mongoose.model('Cart', new mongoose.Schema({}, { strict: false }));
    const dbCart = await Cart.findOne({ sessionId: returnedSessionId }).lean();

    if (!dbCart) {
      console.error(`${colors.red}❌ Cart not found in database${colors.reset}`);
      process.exit(1);
    }

    const dbItem = dbCart.items?.[0];
    const dbEngraving = dbItem?.engravingOptions;

    console.log(`${colors.cyan}📊 Database Cart Item:${colors.reset}`);
    console.log(JSON.stringify(dbItem, null, 2));

    // Step 5: Validation
    console.log(`\n${colors.cyan}╔════════════════════════════════════════════╗`);
    console.log(`║           VALIDATION RESULTS               ║`);
    console.log(`╚════════════════════════════════════════════╝${colors.reset}\n`);

    const results = {
      apiHasEngraving: !!apiEngraving,
      dbHasEngraving: !!dbEngraving,
      textMatches: apiEngraving?.engravingText === dbEngraving?.engravingText,
      fontMatches: apiEngraving?.font === dbEngraving?.font,
      textCorrect: dbEngraving?.engravingText === engravingData.engravingText,
      fontCorrect: dbEngraving?.font === engravingData.font
    };

    console.log(`API Response:`);
    console.log(`  Has engraving: ${results.apiHasEngraving ? colors.green + '✅' : colors.red + '❌'}${colors.reset}`);
    
    console.log(`\nDatabase:`);
    console.log(`  Has engraving: ${results.dbHasEngraving ? colors.green + '✅' : colors.red + '❌'}${colors.reset}`);
    console.log(`  Text matches: ${results.textCorrect ? colors.green + '✅' : colors.red + '❌'}${colors.reset} (Expected: "${engravingData.engravingText}", Got: "${dbEngraving?.engravingText || 'undefined'}")`);
    console.log(`  Font matches: ${results.fontCorrect ? colors.green + '✅' : colors.red + '❌'}${colors.reset} (Expected: "${engravingData.font}", Got: "${dbEngraving?.font || 'undefined'}")`);

    // Step 6: Final verdict
    const allPassed = results.apiHasEngraving && results.dbHasEngraving && results.textCorrect && results.fontCorrect;

    console.log(`\n${colors.cyan}╔════════════════════════════════════════════╗`);
    console.log(`║              FINAL RESULT                  ║`);
    console.log(`╚════════════════════════════════════════════╝${colors.reset}\n`);

    if (allPassed) {
      console.log(`${colors.green}✅ SUCCESS: Engraving is properly saved to database!${colors.reset}`);
      console.log(`${colors.green}✅ Text and font are both stored correctly${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.red}❌ FAILURE: Engraving is NOT properly saved${colors.reset}`);
      
      if (!results.apiHasEngraving) {
        console.log(`${colors.red}   - API response missing engravingOptions${colors.reset}`);
      }
      if (!results.dbHasEngraving) {
        console.log(`${colors.red}   - Database missing engravingOptions${colors.reset}`);
      }
      if (!results.textCorrect) {
        console.log(`${colors.red}   - Engraving text mismatch${colors.reset}`);
      }
      if (!results.fontCorrect) {
        console.log(`${colors.red}   - Engraving font mismatch${colors.reset}`);
      }
      
      console.log(`\n${colors.yellow}⚠️  Check CART_VARIATION_STORAGE_ANALYSIS.md for fixes${colors.reset}\n`);
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n${colors.red}❌ Error:${colors.reset}`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testEngravingStorage();
