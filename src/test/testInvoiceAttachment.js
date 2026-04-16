/**
 * Invoice Attachment Debugging Script
 * This script specifically tests if invoices are being attached to emails properly
 */

const axios = require('axios');

async function testInvoiceAttachment() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const AUTH_TOKEN = process.env.AUTH_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ODhiNDFhZWNkZmMxNWQ2Mzk1OTFiZCIsInJvbGUiOiI2ODc1ZWI2NWNmMmU0NTIwNDQ0YjkzNWIiLCJpYXQiOjE3NTM4NjM0ODIsImV4cCI6MTc1NDQ2ODI4Mn0.6qqjlGbxUGJucgryGSNExqQOgnj932bAoFs7TBS9hV0';
  const TEST_EMAIL = process.env.TEST_EMAIL || '20bmiit076@gmail.com';

  console.log('🔍 Invoice Attachment Debugging Test');
  console.log('====================================');

  try {
    // Test 1: Check if invoice generation works with a test order
    console.log('\n📊 Step 1: Testing invoice generation...');
    
    const testOrder = {
      orderId: `TEST-INVOICE-${Date.now()}`,
      customerData: {
        name: 'Test Customer',
        email: TEST_EMAIL,
        phone: '+1234567890'
      },
      shippingAddress: '123 Test Street, Test City, TC 12345',
      paymentStatus: 'paid',
      paymentDetails: {
        totalAmount: 1299,
        paymentMethod: 'stripe',
        createdOn: new Date(),
        stripeSessionId: 'cs_test_123456',
        stripePaymentIntentId: 'pi_test_123456'
      },
      products: [
        {
          productDetails: {
            title: 'Test Diamond Ring',
            description: 'Beautiful test diamond ring',
            category: 'Rings',
            material: 'Gold'
          },
          type: 'jewelry',
          quantity: 1,
          price: 1299
        }
      ]
    };

    // Test direct invoice generation
    const directInvoiceResponse = await axios.post(
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

    console.log('✅ Invoice generation test results:');
    console.log(`   - PDF Generated: ${directInvoiceResponse.data.success}`);
    console.log(`   - Buffer Size: ${directInvoiceResponse.data.bufferSize || 'N/A'} bytes`);
    console.log(`   - Email Sent: ${directInvoiceResponse.data.emailSent}`);
    console.log(`   - Attachment Included: ${directInvoiceResponse.data.attachmentIncluded}`);

    if (directInvoiceResponse.data.error) {
      console.log(`   - Error: ${directInvoiceResponse.data.error}`);
    }

    // Test 2: Try with a real order if available
    console.log('\n📋 Step 2: Testing with existing order (if available)...');
    
    try {
      const existingOrderTest = await axios.post(
        `${BASE_URL}/api/payment/resend-invoice/c8fd7ba0-6d1d-11f0-91c2-6dc082d39f62`,
        {
          customerEmail: TEST_EMAIL,
          debugMode: true
        },
        {
          headers: {
            'Authorization': `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Existing order invoice test:');
      console.log(`   - Method Used: ${existingOrderTest.data.data?.method}`);
      console.log(`   - Invoice Generated: ${existingOrderTest.data.data?.invoiceGenerated}`);
      console.log(`   - Attachment Size: ${existingOrderTest.data.data?.attachmentSize || 'N/A'}`);

    } catch (orderError) {
      console.log('⚠️ Existing order test skipped (order not found)');
    }

    // Test 3: Email service debugging
    console.log('\n📧 Step 3: Testing email service attachment handling...');
    
    const emailServiceTest = await axios.post(
      `${BASE_URL}/api/payment/test-email-attachment`,
      {
        recipientEmail: TEST_EMAIL,
        attachmentTest: true
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Email service attachment test:');
    console.log(`   - Email Sent: ${emailServiceTest.data.success}`);
    console.log(`   - Attachment Processed: ${emailServiceTest.data.attachmentProcessed}`);
    console.log(`   - Base64 Conversion: ${emailServiceTest.data.base64Conversion}`);

    console.log('\n🎯 Summary:');
    console.log('If you are still not receiving invoice attachments, check:');
    console.log('1. Your email client settings (some block PDF attachments)');
    console.log('2. Spam/junk folder');
    console.log('3. Email provider attachment size limits');
    console.log('4. PDF generation errors in server logs');
    console.log('5. Azure email service attachment configuration');

  } catch (error) {
    console.error('\n❌ Invoice Attachment Test Failed:');
    console.error('   Status:', error.response?.status || 'N/A');
    console.error('   Message:', error.response?.data?.message || error.message);
    
    if (error.response?.data?.details) {
      console.error('   Details:', error.response.data.details);
    }

    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Check if the test endpoints exist in payment.js');
    console.log('2. Verify AUTH_TOKEN has proper permissions');
    console.log('3. Check server logs for PDF generation errors');
    console.log('4. Verify Azure Communication Services configuration');
    console.log('5. Test email sending without attachments first');
  }
}

// Export for module use
module.exports = { testInvoiceAttachment };

// Run test if executed directly
if (require.main === module) {
  testInvoiceAttachment().catch(console.error);
}
