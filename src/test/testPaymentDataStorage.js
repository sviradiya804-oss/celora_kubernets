const axios = require('axios');

/**
 * Test script to validate payment data storage enhancement
 * This script tests the new payment details endpoint
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your_jwt_token_here';

async function testPaymentDetailsEndpoint(orderId = 'ORD-123456') {
  try {
    console.log(`\n🧪 Testing Payment Details Endpoint`);
    console.log(`Order ID: ${orderId}`);
    console.log(`Endpoint: GET ${BASE_URL}/api/payment/payment-details/${orderId}`);

    const response = await axios.get(
      `${BASE_URL}/api/payment/payment-details/${orderId}`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`\n✅ Response Status: ${response.status}`);
    console.log(`📊 Response Data:`, JSON.stringify(response.data, null, 2));

    // Validate response structure
    const { paymentDetails, stripeData } = response.data;
    
    console.log(`\n📋 Payment Details Validation:`);
    console.log(`- Stripe Payment Intent ID: ${paymentDetails?.stripePaymentIntentId || 'Not found'}`);
    console.log(`- Amount Paid: ${paymentDetails?.amountPaid || 'Not found'}`);
    console.log(`- Currency: ${paymentDetails?.currency || 'Not found'}`);
    console.log(`- Customer Email: ${paymentDetails?.customerEmail || 'Not found'}`);
    console.log(`- Payment Status: ${paymentDetails?.paymentStatus || 'Not found'}`);
    console.log(`- Risk Level: ${paymentDetails?.riskLevel || 'Not found'}`);
    console.log(`- Receipt URL: ${paymentDetails?.receiptUrl || 'Not found'}`);

    console.log(`\n🔗 Stripe Data Validation:`);
    console.log(`- Live Payment Intent Data: ${stripeData?.paymentIntent ? '✅ Available' : '❌ Not available'}`);
    console.log(`- Live Session Data: ${stripeData?.session ? '✅ Available' : '❌ Not available'}`);

    return response.data;

  } catch (error) {
    console.error(`\n❌ Test Failed:`);
    console.error(`Status: ${error.response?.status || 'N/A'}`);
    console.error(`Message: ${error.response?.data?.message || error.message}`);
    
    if (error.response?.status === 401) {
      console.log(`\n💡 Note: Update AUTH_TOKEN environment variable with a valid JWT token`);
    } else if (error.response?.status === 404) {
      console.log(`\n💡 Note: Order not found. Try with a valid order ID`);
    }
    
    throw error;
  }
}

async function runTests() {
  console.log(`🚀 Starting Payment Data Storage Enhancement Tests\n`);
  
  // Test cases
  const testCases = [
    'ORD-123456',  // Example order ID
    // Add more test order IDs here
  ];

  for (const orderId of testCases) {
    try {
      await testPaymentDetailsEndpoint(orderId);
      console.log(`\n✅ Test passed for Order ID: ${orderId}`);
    } catch (error) {
      console.log(`\n❌ Test failed for Order ID: ${orderId}`);
    }
  }

  console.log(`\n🎉 Test suite completed!`);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testPaymentDetailsEndpoint,
  runTests
};
