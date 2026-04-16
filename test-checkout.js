// Test script to debug checkout discount issues
const axios = require('axios');

const baseURL = 'http://localhost:3000/api/cart';

async function debugCheckoutFlow() {
  try {
    console.log('=== Debugging Checkout Discount Flow ===');
    console.log();
    
    // Replace these with actual values from your system
    const sessionId = 'session-1753696626775-auq2wt086';
    const userId = '6888b41aecdfc15d639591bd'; // Replace with actual user ID
    
    console.log('Step 1: Check current cart state...');
    try {
      const cartState = await axios.get(`${baseURL}/debug/cart/${userId}/${sessionId}`);
      console.log('Cart State:');
      console.log(JSON.stringify(cartState.data, null, 2));
    } catch (error) {
      console.log('Cart state check failed:', error.response?.data || error.message);
    }
    console.log();
    
    console.log('Step 2: Test discount calculation...');
    try {
      const discountTest = await axios.post(`${baseURL}/debug/discount`, {
        sessionId,
        userId
      });
      console.log('Discount Debug Result:');
      console.log(JSON.stringify(discountTest.data, null, 2));
    } catch (error) {
      console.log('Discount test failed:', error.response?.data || error.message);
    }
    console.log();
    
    console.log('Step 3: Test checkout...');
    try {
      const checkoutTest = await axios.post(`${baseURL}/checkout`, {
        sessionId,
        userId
      });
      console.log('Checkout Result:');
      console.log(JSON.stringify({
        success: checkoutTest.data.success,
        url: checkoutTest.data.url ? 'Generated' : 'None',
        orderSummary: checkoutTest.data.orderSummary
      }, null, 2));
    } catch (error) {
      console.log('Checkout failed:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('General Test Error:', error.message);
  }
}
debugCheckoutFlow();
module.exports = { debugCheckoutFlow };
