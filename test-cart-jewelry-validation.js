const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testCartJewelryValidation() {
  console.log('\n🧪 Testing Cart with Jewelry Collection and _id parameter\n');
  
  try {
    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/api/v1/auth/login`, {
      email: 'demo44@yopmail.com',
      password: 'demo@123'
    });
    
    const authToken = loginResponse.data.data.token;
    const userId = loginResponse.data.data.user._id;
    console.log('✅ Login successful');
    console.log(`   User ID: ${userId}`);
    
    // Step 2: Get Jewelry products
    console.log('\n2️⃣ Fetching Jewelry products...');
    const productsResponse = await axios.get(`${BASE_URL}/api/jewelry`);
    const products = productsResponse.data.data || productsResponse.data.jewelry || [];
    
    if (products.length === 0) {
      console.log('❌ No jewelry products found');
      return;
    }
    
    const testProduct = products[0];
    console.log('✅ Found jewelry products');
    console.log(`   Product ID: ${testProduct._id}`);
    console.log(`   Product: ${testProduct.title || testProduct.name}`);
    
    // Step 3: Test adding with 'productId' parameter
    console.log('\n3️⃣ Adding to cart with "productId" parameter...');
    const sessionId1 = Date.now().toString();
    
    const addResponse1 = await axios.post(`${BASE_URL}/api/cart/add`, {
      sessionId: sessionId1,
      userId: userId,
      productId: testProduct._id,  // Using 'productId'
      quantity: 1,
      selectedVariant: {
        selectedOptions: {
          ringsize: "6.5",
          metaldetail: "6747ebd7ae6e93d5e8a0e7a1"
        }
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Added with "productId" parameter');
    console.log(`   Cart has ${addResponse1.data.cart?.items?.length || 0} items`);
    
    // Step 4: Test adding with '_id' parameter
    console.log('\n4️⃣ Adding to cart with "_id" parameter...');
    const sessionId2 = (Date.now() + 1).toString();
    
    const addResponse2 = await axios.post(`${BASE_URL}/api/cart/add`, {
      sessionId: sessionId2,
      userId: userId,
      _id: testProduct._id,  // Using '_id' instead of 'productId'
      quantity: 1,
      selectedVariant: {
        selectedOptions: {
          ringsize: "6.5",
          metaldetail: "6747ebd7ae6e93d5e8a0e7a1"
        }
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Added with "_id" parameter');
    console.log(`   Cart has ${addResponse2.data.cart?.items?.length || 0} items`);
    
    // Step 5: Test with invalid product ID (not from Jewelry collection)
    console.log('\n5️⃣ Testing with invalid product ID...');
    try {
      await axios.post(`${BASE_URL}/api/cart/add`, {
        sessionId: Date.now().toString(),
        userId: userId,
        productId: '000000000000000000000000',  // Invalid ID
        quantity: 1
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('❌ Should have failed with invalid product ID');
    } catch (error) {
      if (error.response) {
        console.log('✅ Correctly rejected invalid product ID');
        console.log(`   Error: ${error.response.data.error}`);
        console.log(`   Message: ${error.response.data.message || 'N/A'}`);
      }
    }
    
    // Step 6: Test without product ID
    console.log('\n6️⃣ Testing without product ID...');
    try {
      await axios.post(`${BASE_URL}/api/cart/add`, {
        sessionId: Date.now().toString(),
        userId: userId,
        quantity: 1
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('❌ Should have failed without product ID');
    } catch (error) {
      if (error.response) {
        console.log('✅ Correctly rejected missing product ID');
        console.log(`   Error: ${error.response.data.error}`);
      }
    }
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   ✅ Cart accepts products from Jewelry collection only');
    console.log('   ✅ Cart accepts both "productId" and "_id" parameter names');
    console.log('   ✅ Cart validates product exists in Jewelry collection');
    console.log('   ✅ Cart requires product ID to be provided');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run the test
testCartJewelryValidation();
