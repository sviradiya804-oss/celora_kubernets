/**
 * Manual Invoice Attachment Test
 * Run this with your server running to test invoice attachments directly
 */

const axios = require('axios');

async function manualInvoiceTest() {
  console.log('📧 Manual Invoice Attachment Test');
  console.log('=================================');
  
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const AUTH_TOKEN = process.env.AUTH_TOKEN || 'YOUR_JWT_TOKEN_HERE';
  const TEST_EMAIL = process.env.TEST_EMAIL || 'YOUR_EMAIL_HERE';

  console.log(`🔧 Configuration:`);
  console.log(`   Server: ${BASE_URL}`);
  console.log(`   Email: ${TEST_EMAIL}`);
  console.log(`   Token: ${AUTH_TOKEN.substring(0, 20)}...`);

  if (AUTH_TOKEN === 'YOUR_JWT_TOKEN_HERE' || TEST_EMAIL === 'YOUR_EMAIL_HERE') {
    console.log('\n❌ Please set your environment variables:');
    console.log('   export AUTH_TOKEN="your_actual_jwt_token"');
    console.log('   export TEST_EMAIL="your@email.com"');
    console.log('   export BASE_URL="http://localhost:3000"  # if different');
    return;
  }

  try {
    console.log('\n🧪 Testing invoice generation with attachment...');
    
    const testOrder = {
      orderId: `MANUAL-TEST-${Date.now()}`,
      customerData: {
        name: 'Manual Test Customer',
        email: TEST_EMAIL,
        phone: '+1234567890'
      },
      shippingAddress: '123 Test Street, Test City, TC 12345',
      paymentStatus: 'paid',
      paymentDetails: {
        totalAmount: 99.99,
        paymentMethod: 'stripe',
        createdOn: new Date(),
        stripeSessionId: 'cs_manual_test_123'
      },
      products: [
        {
          productDetails: {
            title: 'Manual Test Product',
            description: 'Test product for invoice attachment testing',
            category: 'Test',
            material: 'Test Material'
          },
          type: 'jewelry',
          quantity: 1,
          price: 99.99
        }
      ],
      total: 99.99
    };

    const response = await axios.post(
      `${BASE_URL}/api/payment/test-invoice-generation`,
      {
        testOrder: testOrder,
        recipientEmail: TEST_EMAIL
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ Test completed successfully!');
    console.log(`   - PDF Generated: ${response.data.success}`);
    console.log(`   - Buffer Size: ${response.data.bufferSize} bytes`);
    console.log(`   - Email Sent: ${response.data.emailSent}`);
    console.log(`   - Attachment Included: ${response.data.attachmentIncluded}`);
    console.log(`   - Filename: ${response.data.filename}`);

    console.log('\n📧 Check your email now!');
    console.log(`   Looking for: Email to ${TEST_EMAIL}`);
    console.log(`   Subject: "Your Order Invoice"`);
    console.log(`   Attachment: ${response.data.filename}`);
    
    console.log('\n🔍 If you don\'t see the attachment:');
    console.log('   1. Check spam/junk folder');
    console.log('   2. Try a different email address (gmail.com, outlook.com)');
    console.log('   3. Check if your email client blocks PDF attachments');
    console.log('   4. Look for attachment icon in the email');
    console.log('   5. Try viewing the email on desktop vs mobile');

  } catch (error) {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n🔑 Authentication Error:');
      console.log('   Your JWT token may be invalid or expired');
      console.log('   Get a new token by logging into your application');
    } else if (error.response?.status === 404) {
      console.log('\n🚫 Endpoint Not Found:');
      console.log('   The test endpoint may not be available');
      console.log('   Make sure you\'ve added the test endpoints to payment.js');
    } else {
      console.log('\n🔧 Server Error:');
      console.log('   Check server logs for more details');
      console.log('   Verify all dependencies are installed');
    }
  }
}

if (require.main === module) {
  manualInvoiceTest();
}

module.exports = { manualInvoiceTest };
