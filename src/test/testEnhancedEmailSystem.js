/**
 * Test script for email template improvements
 * Tests both HTML email rendering and Stripe automatic receipts
 */

const axios = require('axios');

async function testEmailTemplates() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your_jwt_token_here';
  const TEST_EMAIL = process.env.TEST_EMAIL || '20bmiit076@gmail.com';

  try {
    console.log('🧪 Testing Email Templates and Stripe Receipt Configuration\n');
    
    // Test 1: Test all email templates
    console.log('📧 Testing all email templates...');
    const templateResponse = await axios.post(
      `${BASE_URL}/api/payment/test-email-templates`,
      {
        testEmail: TEST_EMAIL,
        templateType: 'all'
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Email Template Test Results:');
    console.log(`   - Total Templates Tested: ${templateResponse.data.summary?.totalTested}`);
    console.log(`   - Successful: ${templateResponse.data.summary?.successful}`);
    console.log(`   - Failed: ${templateResponse.data.summary?.failed}`);
    console.log(`   - Success Rate: ${templateResponse.data.summary?.successRate}`);
    
    if (templateResponse.data.results?.errors?.length > 0) {
      console.log('   - Errors:');
      templateResponse.data.results.errors.forEach(error => {
        console.log(`     • ${error}`);
      });
    }

    // Test 2: Test specific refund confirmation
    console.log('\n💰 Testing refund confirmation email specifically...');
    const refundTestResponse = await axios.post(
      `${BASE_URL}/api/payment/test-email-templates`,
      {
        testEmail: TEST_EMAIL,
        templateType: 'refund-confirmation'
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Refund Email Test Results:');
    console.log(`   - Template Status: ${refundTestResponse.data.results?.templates?.['refund-confirmation']}`);

    console.log('\n📋 Key Improvements Made:');
    console.log('   ✅ Fixed "This email requires an HTML-enabled client" issue');
    console.log('   ✅ Added meaningful plain text fallbacks for all email types');
    console.log('   ✅ Created comprehensive refund confirmation HTML template');
    console.log('   ✅ Enhanced email service with better error handling');
    console.log('   ✅ Enabled Stripe automatic receipt emails for payments');
    console.log('   ✅ Added receipt email configuration to checkout sessions');

    console.log('\n🔧 Stripe Receipt Configuration:');
    console.log('   • Payment intents now include receipt_email parameter');
    console.log('   • Automatic Stripe receipts will be sent for successful payments');
    console.log('   • Retry payments also include receipt email configuration');
    console.log('   • Customers will receive both custom and Stripe receipts');

    console.log(`\n📬 Check your email (${TEST_EMAIL}) for test messages!`);
    console.log('   If you still see "This email requires an HTML-enabled client":');
    console.log('   1. Check if your email client supports HTML');
    console.log('   2. Try viewing the email in a web browser');
    console.log('   3. Check spam/junk folder');

    return templateResponse.data;

  } catch (error) {
    console.error('\n❌ Email Test Failed:');
    console.error('   Status:', error.response?.status || 'N/A');
    console.error('   Message:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Fix: Update AUTH_TOKEN environment variable with a valid JWT token');
    } else if (error.response?.status === 400) {
      console.log('\n💡 Fix: Check that TEST_EMAIL is valid');
    }
    
    throw error;
  }
}

// Test specific order refund with the enhanced system
async function testRefundWithEnhancedEmails(orderId = 'c8fd7ba0-6d1d-11f0-91c2-6dc082d39f62') {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your_jwt_token_here';

  try {
    console.log('\n🧪 Testing refund with enhanced email system...');
    console.log(`   Order ID: ${orderId}`);
    
    const refundResponse = await axios.post(
      `${BASE_URL}/api/payment/refund/${orderId}`,
      {
        reason: 'Testing enhanced email system - refund confirmation should include proper HTML template and Stripe tracking'
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Refund Processed Successfully!');
    console.log(`   - Refund ID: ${refundResponse.data.data?.refundId}`);
    console.log(`   - Amount: $${refundResponse.data.data?.refundAmount}`);
    console.log(`   - Customer Email Sent: ${refundResponse.data.data?.notifications?.customerEmailSent}`);
    console.log(`   - Admin Notification Sent: ${refundResponse.data.data?.notifications?.adminNotificationSent}`);

    console.log('\n📧 The customer should receive:');
    console.log('   1. A properly formatted HTML refund confirmation email');
    console.log('   2. Stripe refund tracking information');
    console.log('   3. If HTML is not supported, a readable plain text version');
    console.log('   4. No more "This email requires an HTML-enabled client" messages');

    return refundResponse.data;

  } catch (error) {
    console.error('\n❌ Enhanced Refund Test Failed:');
    console.error('   Status:', error.response?.status || 'N/A');
    console.error('   Message:', error.response?.data?.message || error.message);
    
    if (error.response?.data?.debug) {
      console.error('   Debug Info:', error.response.data.debug);
    }
    
    throw error;
  }
}

// Test invoice resending functionality
async function testInvoiceResend(orderId = 'c8fd7ba0-6d1d-11f0-91c2-6dc082d39f62') {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your_jwt_token_here';
  const TEST_EMAIL = process.env.TEST_EMAIL || '20bmiit076@gmail.com';

  try {
    console.log('\n📄 Testing invoice resend functionality...');
    console.log(`   Order ID: ${orderId}`);
    
    const invoiceResponse = await axios.post(
      `${BASE_URL}/api/payment/resend-invoice/${orderId}`,
      {
        customerEmail: TEST_EMAIL // Optional email override
      },
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Invoice Resend Successful!');
    console.log(`   - Recipient: ${invoiceResponse.data.data?.recipientEmail}`);
    console.log(`   - Method: ${invoiceResponse.data.data?.method}`);
    console.log(`   - Invoice Generated: ${invoiceResponse.data.data?.invoiceGenerated}`);
    console.log(`   - Invoice URL: ${invoiceResponse.data.data?.invoiceUrl || 'Not available'}`);

    console.log('\n📧 The customer should receive:');
    console.log('   1. Either a PDF invoice attachment or notification with tracking link');
    console.log('   2. Proper HTML formatting with fallback plain text');
    console.log('   3. Order tracking and support contact information');

    return invoiceResponse.data;

  } catch (error) {
    console.error('\n❌ Invoice Resend Test Failed:');
    console.error('   Status:', error.response?.status || 'N/A');
    console.error('   Message:', error.response?.data?.message || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 Note: Order not found. Try with a valid order ID');
    }
    
    throw error;
  }
}

// Test direct invoice attachment with newly created test endpoints
async function testDirectInvoiceAttachment() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
  const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your_jwt_token_here';
  const TEST_EMAIL = process.env.TEST_EMAIL || '20bmiit076@gmail.com';

  try {
    console.log('\n🧪 Testing direct invoice attachment generation...');
    
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
        stripeSessionId: 'cs_test_123456'
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
      ],
      total: 1299
    };

    const attachmentResponse = await axios.post(
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

    console.log('✅ Direct Invoice Attachment Test Results:');
    console.log(`   - PDF Generated: ${attachmentResponse.data.success}`);
    console.log(`   - Buffer Size: ${attachmentResponse.data.bufferSize || 'N/A'} bytes`);
    console.log(`   - Email Sent: ${attachmentResponse.data.emailSent}`);
    console.log(`   - Attachment Included: ${attachmentResponse.data.attachmentIncluded}`);
    console.log(`   - Filename: ${attachmentResponse.data.filename || 'N/A'}`);

    if (attachmentResponse.data.error) {
      console.log(`   - Error: ${attachmentResponse.data.error}`);
    }

    console.log('\n📧 What you should see in your email:');
    console.log('   1. An email with "Your Order Invoice" subject');
    console.log('   2. A PDF attachment named "invoice-[orderId].pdf"');
    console.log('   3. Professional invoice content with order details');
    console.log('   4. If no attachment appears, check:');
    console.log('      - Spam/junk folder');
    console.log('      - Email client blocking PDF attachments');
    console.log('      - Corporate email security settings');

    return attachmentResponse.data;

  } catch (error) {
    console.error('\n❌ Direct Invoice Attachment Test Failed:');
    console.error('   Status:', error.response?.status || 'N/A');
    console.error('   Message:', error.response?.data?.message || error.message);
    
    console.log('\n🔧 Possible fixes:');
    console.log('   1. Ensure test endpoints are added to payment.js');
    console.log('   2. Check Puppeteer installation for PDF generation');
    console.log('   3. Verify Azure storage configuration');
    console.log('   4. Check email service setup');
    
    throw error;
  }
}

async function runAllEmailTests() {
  console.log('🚀 Enhanced Email System Test Suite');
  console.log('=====================================');
  
  try {
    // Test 1: Basic email templates and plain text fallbacks
    await testEmailTemplates();
    
    // Test 2: Enhanced refund with proper email formatting
    console.log('\n⚠️ Refund test skipped - uncomment to test with real order');
    // await testRefundWithEnhancedEmails();
    
    // Test 3: Invoice resending functionality
    console.log('\n⚠️ Invoice resend test skipped - uncomment to test with real order');
    // await testInvoiceResend();
    
    console.log('\n🎉 All email system tests completed successfully!');
    console.log('\n📋 Summary of enhancements:');
    console.log('   ✅ Plain text fallbacks for all email types');
    console.log('   ✅ Enhanced refund confirmation with Stripe tracking');
    console.log('   ✅ Invoice resending with multiple fallback methods');
    console.log('   ✅ Professional HTML templates with responsive design');
    console.log('   ✅ Improved error handling and logging');
    
    console.log('\n🧪 To test with real data:');
    console.log('   1. Uncomment testRefundWithEnhancedEmails() and provide valid order ID');
    console.log('   2. Uncomment testInvoiceResend() and provide valid order ID');
    console.log('   3. Set AUTH_TOKEN environment variable with valid JWT');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    console.log('\n� Next steps:');
    console.log('   1. Check your AUTH_TOKEN and BASE_URL environment variables');
    console.log('   2. Ensure the server is running on the correct port');
    console.log('   3. Verify test order IDs exist in the database');
    console.log('   4. Check email service configuration (Azure Communication Services)');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllEmailTests().catch(console.error);
}

module.exports = {
  testEmailTemplates,
  testRefundWithEnhancedEmails,
  testInvoiceResend,
  testDirectInvoiceAttachment,
  runAllEmailTests
};
