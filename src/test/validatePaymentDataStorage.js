/**
 * Webhook Processing Validation Script
 * This script helps validate that Stripe webhooks are properly storing payment data
 */

const mongoose = require('mongoose');

// Import your schema
const OrderSchema = require('../models/schema');

async function validatePaymentDataStorage() {
  try {
    console.log('🔍 Validating Payment Data Storage...\n');

    // Connect to database (adjust connection string as needed)
    if (!mongoose.connection.readyState) {
      console.log('⚠️  Note: Ensure database connection is established');
    }

    // Find recent orders with payment details
    const recentOrders = await OrderSchema.find({
      'paymentDetails.stripePaymentIntentId': { $exists: true }
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

    console.log(`📊 Found ${recentOrders.length} orders with payment intent IDs\n`);

    for (const order of recentOrders) {
      const payment = order.paymentDetails;
      
      console.log(`Order: ${order.orderId || order._id}`);
      console.log(`├── Payment Intent ID: ${payment.stripePaymentIntentId || 'Missing'}`);
      console.log(`├── Amount Paid: ${payment.amountPaid || 'Missing'}`);
      console.log(`├── Customer Email: ${payment.customerEmail || 'Missing'}`);
      console.log(`├── Payment Status: ${payment.paymentStatus || 'Missing'}`);
      console.log(`├── Risk Level: ${payment.riskLevel || 'Missing'}`);
      console.log(`├── Receipt URL: ${payment.receiptUrl ? 'Available' : 'Missing'}`);
      console.log(`├── Billing Address: ${payment.billingAddress ? 'Available' : 'Missing'}`);
      console.log(`├── Shipping Address: ${payment.shippingAddress ? 'Available' : 'Missing'}`);
      console.log(`└── Processing Method: ${payment.processingMethod || 'Missing'}\n`);

      // Calculate completeness score
      const fields = [
        'stripePaymentIntentId', 'amountPaid', 'customerEmail', 'paymentStatus',
        'riskLevel', 'receiptUrl', 'billingAddress', 'shippingAddress'
      ];
      
      const completedFields = fields.filter(field => payment[field]);
      const completeness = Math.round((completedFields.length / fields.length) * 100);
      
      console.log(`   📈 Data Completeness: ${completeness}% (${completedFields.length}/${fields.length} fields)\n`);
    }

    // Summary statistics
    const totalOrders = await OrderSchema.countDocuments();
    const ordersWithPaymentIntents = await OrderSchema.countDocuments({
      'paymentDetails.stripePaymentIntentId': { $exists: true }
    });
    
    const coverage = totalOrders > 0 ? Math.round((ordersWithPaymentIntents / totalOrders) * 100) : 0;

    console.log(`📈 Summary Statistics:`);
    console.log(`├── Total Orders: ${totalOrders}`);
    console.log(`├── Orders with Payment Intent IDs: ${ordersWithPaymentIntents}`);
    console.log(`└── Coverage: ${coverage}%\n`);

    if (coverage < 50) {
      console.log(`⚠️  Low coverage detected. This might indicate:`);
      console.log(`   • Webhooks not properly configured`);
      console.log(`   • Recent enhancement not yet processing payments`);
      console.log(`   • Test payments needed to validate implementation\n`);
    } else {
      console.log(`✅ Good coverage! Payment data storage is working correctly.\n`);
    }

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    console.error('Make sure database connection is established and schema is imported correctly');
  }
}

// Sample webhook payload validation
function validateWebhookPayload(webhookData) {
  console.log('🔍 Validating Webhook Payload Structure...\n');
  
  const requiredFields = {
    'checkout.session.completed': [
      'id', 'payment_intent', 'customer', 'amount_total', 'currency'
    ],
    'payment_intent.succeeded': [
      'id', 'amount', 'currency', 'status', 'charges'
    ]
  };

  const eventType = webhookData.type;
  const data = webhookData.data.object;

  console.log(`Event Type: ${eventType}`);
  
  if (requiredFields[eventType]) {
    const missing = requiredFields[eventType].filter(field => !data[field]);
    
    if (missing.length === 0) {
      console.log('✅ All required fields present in webhook payload');
    } else {
      console.log(`❌ Missing required fields: ${missing.join(', ')}`);
    }
  } else {
    console.log('⚠️  Unknown event type for validation');
  }
}

module.exports = {
  validatePaymentDataStorage,
  validateWebhookPayload
};

// Run validation if script is executed directly
if (require.main === module) {
  validatePaymentDataStorage().catch(console.error);
}
