# Payment Data Storage Enhancement

## Summary of Changes

### 1. Enhanced Payment Detail Storage

**Webhook Handlers Updated:**
- `handleCheckoutSessionCompleted()`: Now stores comprehensive payment details from Stripe checkout session
- `handlePaymentSucceeded()`: Enhanced to capture detailed payment intent information

**New Payment Fields Stored:**

#### Core Payment Information
- ✅ `stripePaymentIntentId` - Primary payment intent identifier
- ✅ `chargeId` - Stripe charge identifier  
- ✅ `amountPaid` - Actual amount paid
- ✅ `currency` - Payment currency
- ✅ `paymentMethod` - Payment method type
- ✅ `paymentStatus` - Current payment status

#### Customer Information
- ✅ `customerStripeId` - Customer ID in Stripe
- ✅ `customerEmail` - Customer email from payment
- ✅ `customerName` - Customer name from payment
- ✅ `customerPhone` - Customer phone from payment

#### Address Information
- ✅ `billingAddress` - Complete billing address
- ✅ `shippingAddress` - Complete shipping address

#### Financial Details
- ✅ `applicationFee` - Any application fees
- ✅ `stripeFee` - Stripe processing fees
- ✅ `netAmount` - Net amount after fees

#### Risk & Security
- ✅ `riskLevel` - Payment risk assessment
- ✅ `riskScore` - Numerical risk score
- ✅ `networkStatus` - Network response status
- ✅ `sellerMessage` - Risk assessment message

#### Transaction Tracking
- ✅ `receiptEmail` - Receipt email address
- ✅ `receiptUrl` - Stripe receipt URL
- ✅ `balanceTransaction` - Transaction ID for accounting
- ✅ `paymentIntentMetadata` - Custom metadata
- ✅ `sessionMetadata` - Session metadata

#### Processing Details
- ✅ `processingMethod` - How payment was processed
- ✅ `confirmationMethod` - Payment confirmation method
- ✅ `captureMethod` - When payment was captured
- ✅ `paymentSource` - Source of payment data

### 2. Enhanced Database Schema

Updated `order.paymentDetails` schema in `/src/models/schema.js`:

```javascript
paymentDetails: {
  // Stripe identifiers
  stripeSessionId: { type: String },
  stripePaymentIntentId: { type: String },
  chargeId: { type: String },
  
  // Amount and currency
  amountPaid: { type: Number },
  currency: { type: String, default: 'usd' },
  
  // Payment method information
  paymentMethod: { type: String },
  paymentMethodDetails: { type: mongoose.Schema.Types.Mixed },
  
  // Customer information from payment
  customerStripeId: { type: String },
  customerEmail: { type: String },
  customerName: { type: String },
  customerPhone: { type: String },
  
  // Address information
  billingAddress: { /* full address object */ },
  shippingAddress: { /* full address object */ },
  
  // Financial details
  applicationFee: { type: Number },
  stripeFee: { type: Number },
  netAmount: { type: Number },
  
  // Risk assessment
  riskLevel: { type: String },
  riskScore: { type: Number },
  networkStatus: { type: String },
  sellerMessage: { type: String },
  
  // And many more fields...
}
```

### 3. New API Endpoints

#### Get Payment Details
**Endpoint:** `GET /api/payment/payment-details/:orderId`
**Authentication:** Required
**Purpose:** Retrieve comprehensive payment information for an order

**Response includes:**
- Complete payment details from database
- Live Stripe payment intent data
- Live Stripe session data
- Refund history
- Email logs related to payments

### 4. Enhanced Refund Details

Updated `refundDetails` schema:
```javascript
refundDetails: [{
  refundId: { type: String },
  amount: { type: Number },
  reason: { type: String },
  processedAt: { type: Date },
  processedBy: { type: String }, // Admin who processed
  stripeRefundStatus: { type: String },
  refundMethod: { type: String },
  refundMetadata: { type: mongoose.Schema.Types.Mixed }
}]
```

## Testing

### Test Comprehensive Payment Storage:
1. Create a test payment through Stripe checkout
2. Check webhook processing in logs
3. Verify payment details via: `GET /api/payment/payment-details/ORDER_ID`
4. Confirm all fields are populated correctly

### Expected Data Flow:
1. **Customer completes payment** → Stripe sends webhook
2. **`checkout.session.completed`** → Stores session data + retrieves payment intent
3. **`payment_intent.succeeded`** → Updates with payment intent details
4. **Database contains** → Complete payment information for reporting/analysis

## Benefits

✅ **Complete Audit Trail**: Every payment detail stored for compliance
✅ **Enhanced Reporting**: Rich data for financial analysis  
✅ **Better Customer Service**: Access to full payment history
✅ **Fraud Prevention**: Risk scores and assessment data stored
✅ **Refund Management**: Comprehensive refund tracking
✅ **Stripe Integration**: Live data comparison with stored data

## Usage Examples

```javascript
// Get comprehensive payment details
GET /api/payment/payment-details/ORD-123456
Authorization: Bearer YOUR_TOKEN

// Response includes all payment information plus live Stripe data
{
  "success": true,
  "paymentDetails": {
    "stripePaymentIntentId": "pi_...",
    "amountPaid": 299.99,
    "currency": "usd",
    "riskLevel": "normal",
    "receiptUrl": "https://pay.stripe.com/receipts/...",
    // ... all other fields
  },
  "stripeData": {
    "paymentIntent": { /* live data from Stripe */ },
    "session": { /* live session data */ }
  }
}
```

The system now captures and stores comprehensive payment information automatically when payments are processed through Stripe webhooks! 🎉
