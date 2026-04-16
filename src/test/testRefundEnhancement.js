/**
 * Test the refund functionality with the specific order that was failing
 */

const axios = require('axios');

async function testRefundWithSpecificOrder() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your_jwt_token_here';
  const ORDER_ID = 'c8fd7ba0-6d1d-11f0-91c2-6dc082d39f62'; // The order from your MongoDB document

  try {
    console.log('🧪 Testing refund for order:', ORDER_ID);
    console.log('🔗 Session ID from order:', 'cs_test_a1JYwAyuinzde6Z2ZKsLTYyjAdawmvJTug1HCC11bXGqNdECU0D075i68f');
    
    // First, let's check the payment details to see what's stored
    console.log('\n📋 Step 1: Checking current payment details...');
    try {
      const paymentDetailsResponse = await axios.get(
        `${BASE_URL}/api/payment/payment-details/${ORDER_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Payment Details Response:');
      console.log('   - Order ID:', paymentDetailsResponse.data.order?.orderId);
      console.log('   - Payment Status:', paymentDetailsResponse.data.order?.paymentStatus);
      console.log('   - Stripe Session ID:', paymentDetailsResponse.data.paymentDetails?.stripeSessionId);
      console.log('   - Stripe Payment Intent ID:', paymentDetailsResponse.data.paymentDetails?.stripePaymentIntentId || 'MISSING');
      console.log('   - Amount Paid:', paymentDetailsResponse.data.paymentDetails?.amountPaid);
      
    } catch (detailsError) {
      console.log('❌ Could not fetch payment details:', detailsError.response?.data?.message || detailsError.message);
    }

    // Now try the refund
    console.log('\n💰 Step 2: Attempting refund...');
    const refundResponse = await axios.post(
      `${BASE_URL}/api/payment/refund/${ORDER_ID}`,
      {
        reason: 'Test refund for missing payment intent ID order'
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Refund Successful!');
    console.log('   - Refund ID:', refundResponse.data.data?.refundId);
    console.log('   - Refund Amount:', refundResponse.data.data?.refundAmount);
    console.log('   - Refund Status:', refundResponse.data.data?.refundStatus);
    console.log('   - Order Status:', refundResponse.data.data?.orderStatus);
    console.log('   - Payment Status:', refundResponse.data.data?.paymentStatus);

    return refundResponse.data;

  } catch (error) {
    console.error('\n❌ Refund Test Failed:');
    console.error('   Status:', error.response?.status || 'N/A');
    console.error('   Message:', error.response?.data?.message || error.message);
    
    if (error.response?.data?.debug) {
      console.error('   Debug Info:', error.response.data.debug);
    }
    
    // Suggestions based on the error
    if (error.response?.status === 401) {
      console.log('\n💡 Fix: Update AUTH_TOKEN environment variable with a valid JWT token');
    } else if (error.response?.status === 403) {
      console.log('\n💡 Fix: Ensure your user has payment admin permissions');
    } else if (error.response?.data?.message?.includes('payment intent')) {
      console.log('\n💡 The enhanced fallback mechanism should help retrieve the payment intent ID from Stripe session');
    }
    
    throw error;
  }
}

// Test the utility endpoint to fix missing payment intents
async function testFixMissingPaymentIntents() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your_jwt_token_here';

  try {
    console.log('\n🔧 Testing fix missing payment intents utility...');
    
    const response = await axios.post(
      `${BASE_URL}/api/payment/fix-missing-payment-intents`,
      {
        limit: 10,
        dryRun: true // Set to false to actually apply fixes
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Fix Utility Response:');
    console.log('   - Total Found:', response.data.results?.totalFound);
    console.log('   - Fixed:', response.data.results?.fixed);
    console.log('   - Failed:', response.data.results?.failed);
    console.log('   - Mode:', response.data.note?.includes('DRY RUN') ? 'DRY RUN' : 'LIVE');
    
    if (response.data.results?.fixedOrders?.length > 0) {
      console.log('\n📝 Orders that would be fixed:');
      response.data.results.fixedOrders.forEach(order => {
        console.log(`   - ${order.orderId}: ${order.paymentIntentId}`);
      });
    }

    return response.data;

  } catch (error) {
    console.error('\n❌ Fix Utility Test Failed:');
    console.error('   Status:', error.response?.status || 'N/A');
    console.error('   Message:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Refund Enhancement Tests\n');
  
  try {
    // Test 1: Fix missing payment intents utility
    await testFixMissingPaymentIntents();
    
    // Test 2: Refund specific order
    await testRefundWithSpecificOrder();
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.log('\n💡 Next Steps:');
    console.log('1. Ensure your JWT token has payment admin permissions');
    console.log('2. Run the fix utility with dryRun: false to update missing payment intent IDs');
    console.log('3. Retry the refund after payment intent IDs are fixed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testRefundWithSpecificOrder,
  testFixMissingPaymentIntents,
  runAllTests
};
