/**
 * Comprehensive Invoice Email Test
 * This script will help identify exactly where the issue is
 */

const path = require('path');

async function comprehensiveInvoiceTest() {
  console.log('🔬 Comprehensive Invoice Email Attachment Test');
  console.log('==============================================');
  
  try {
    // Step 1: Test if we can load the email service
    console.log('\n📦 Step 1: Loading email service...');
    const emailService = require('../utils/emailService');
    console.log('✅ Email service loaded successfully');
    
    // Step 2: Test PDF generation
    console.log('\n📄 Step 2: Testing PDF generation...');
    const { generateInvoiceToAzure } = require('../utils/generateInvoiceFromHTML');
    
    const testOrder = {
      orderId: `TEST-${Date.now()}`,
      customerData: {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '+1234567890'
      },
      total: 100.00,
      paymentStatus: 'paid',
      products: [
        {
          productDetails: {
            title: 'Test Product',
            description: 'Test description'
          },
          quantity: 1,
          price: 100.00
        }
      ]
    };
    
    console.log('Generating test PDF...');
    const invoiceResult = await generateInvoiceToAzure(testOrder);
    
    if (invoiceResult && invoiceResult.buffer) {
      console.log('✅ PDF generation successful');
      console.log(`   - Buffer size: ${invoiceResult.buffer.length} bytes`);
      console.log(`   - Filename: ${invoiceResult.filename}`);
      console.log(`   - Azure URL: ${invoiceResult.url}`);
      
      // Step 3: Test email sending with attachment
      console.log('\n📧 Step 3: Testing email with attachment...');
      
      const recipientEmail = process.env.TEST_EMAIL || '20bmiit076@gmail.com';
      console.log(`Sending test email to: ${recipientEmail}`);
      
      const emailResult = await emailService.sendInvoiceEmailWithBuffer(
        recipientEmail,
        'Test Customer',
        testOrder.orderId,
        invoiceResult.buffer,
        invoiceResult.filename
      );
      
      console.log('✅ Email sent successfully!');
      console.log('   - Check your email inbox and spam folder');
      console.log('   - Look for email with PDF attachment');
      
      return {
        success: true,
        pdfGenerated: true,
        emailSent: true,
        bufferSize: invoiceResult.buffer.length,
        filename: invoiceResult.filename
      };
      
    } else {
      throw new Error('PDF generation failed - no buffer returned');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
    
    console.log('\n🔍 Debugging checklist:');
    console.log('1. Check if Puppeteer is installed correctly');
    console.log('2. Verify Azure Storage configuration');
    console.log('3. Check Azure Communication Services setup');
    console.log('4. Verify email template exists');
    console.log('5. Check environment variables');
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Export for module use
module.exports = { comprehensiveInvoiceTest };

// Run test if executed directly
if (require.main === module) {
  comprehensiveInvoiceTest()
    .then(result => {
      console.log('\n📊 Test Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}
