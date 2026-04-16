# Checkout with Card Payment - Implementation Guide

## Overview

This document describes the new checkout flow that handles card payment details directly, including billing and shipping address validation. The system supports both direct card payments and Affirm payment methods.

## Features Implemented

### 1. **Direct Card Payment Processing**
- Accept card details securely
- Process payments through Stripe
- Support for Visa, Mastercard, Amex, and other major cards
- PCI compliance - **NEVER stores full card numbers**, only last 4 digits and brand

### 2. **Payment Methods Supported**
- **Card Payment**: Direct card processing with Stripe
- **Affirm**: Buy now, pay later option via Stripe Checkout

### 3. **Comprehensive Validation**
- Card number validation (13-19 digits)
- Expiry date validation (not expired)
- CVV validation (3-4 digits)
- Cardholder name validation
- Billing address validation (all required fields)
- Shipping address validation (all required fields)
- Email format validation
- Phone number validation
- US zip code format validation

### 4. **Address Management**
- Separate billing and shipping addresses
- Full address validation with required fields
- Support for international addresses
- Phone number validation for both addresses

### 5. **Order Management**
- Automatic order creation on successful payment
- Payment details stored securely
- Billing and shipping addresses saved with order
- Card information (only last 4 digits and brand)
- Email confirmation sent automatically

## API Endpoint

### POST `/api/cart/checkout-with-payment`

Process checkout with card payment or Affirm.

#### Request Headers
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

#### Request Body

```json
{
  "sessionId": "string (required)",
  "userId": "string (required)",
  "paymentMethod": "card|affirm (default: card)",
  "cardDetails": {
    "cardNumber": "string (13-19 digits, required for card)",
    "expiryMonth": "string (1-12, required for card)",
    "expiryYear": "string (YYYY, required for card)",
    "cvv": "string (3-4 digits, required for card)",
    "cardholderName": "string (required for card)"
  },
  "billingAddress": {
    "firstName": "string (required)",
    "lastName": "string (required)",
    "email": "string (required, valid format)",
    "phone": "string (required, min 10 digits)",
    "address1": "string (required)",
    "address2": "string (optional)",
    "city": "string (required)",
    "state": "string (required)",
    "zipCode": "string (required, US format if country is US)",
    "country": "string (required, 2-letter code)"
  },
  "shippingAddress": {
    "firstName": "string (required)",
    "lastName": "string (required)",
    "phone": "string (required, min 10 digits)",
    "address1": "string (required)",
    "address2": "string (optional)",
    "city": "string (required)",
    "state": "string (required)",
    "zipCode": "string (required, US format if country is US)",
    "country": "string (required, 2-letter code)"
  },
  "shippingDetails": {
    "estimatedDeliveryDays": "number (optional)",
    "shippingMethod": "string (optional)",
    "shippingCost": "number (optional)"
  }
}
```

#### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Order placed successfully",
  "order": {
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "total": 4915,
    "subtotal": 4915,
    "discount": 0,
    "status": "Confirmed",
    "paymentStatus": "paid",
    "paymentMethod": "card",
    "cardLast4": "4242",
    "cardBrand": "visa"
  },
  "billingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "address1": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "US"
  },
  "shippingAddress": {
    "firstName": "John",
    "lastName": "Doe",
    "address1": "456 Oak Avenue",
    "city": "Brooklyn",
    "state": "NY",
    "zipCode": "11201",
    "country": "US"
  }
}
```

#### Affirm Response (200 OK)

```json
{
  "success": true,
  "paymentMethod": "affirm",
  "checkoutUrl": "https://checkout.stripe.com/...",
  "sessionId": "cs_test_...",
  "message": "Redirecting to Affirm checkout..."
}
```

#### Error Responses

**400 Bad Request** - Validation errors:
```json
{
  "success": false,
  "error": "Invalid card number. Must be 13-19 digits"
}
```

**400 Bad Request** - Payment failed:
```json
{
  "success": false,
  "error": "Payment failed. Please check your card details and try again.",
  "paymentStatus": "requires_payment_method"
}
```

**404 Not Found** - Cart not found:
```json
{
  "success": false,
  "error": "Cart not found"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": "Checkout failed",
  "details": "Error message"
}
```

## Validation Rules

### Card Details (for card payment method)
- **Card Number**: 13-19 digits, no spaces allowed in validation
- **Expiry Month**: 1-12
- **Expiry Year**: Current year or future, not expired
- **CVV**: 3-4 digits
- **Cardholder Name**: Minimum 2 characters

### Billing Address
- **First Name**: Required, non-empty
- **Last Name**: Required, non-empty
- **Email**: Valid email format (contains @ and domain)
- **Phone**: Minimum 10 characters, supports international formats
- **Address Line 1**: Required, non-empty
- **Address Line 2**: Optional
- **City**: Required, non-empty
- **State**: Required, non-empty
- **Zip Code**: Required, US format (5 or 5+4 digits) if country is US
- **Country**: Required, 2-letter country code

### Shipping Address
- **First Name**: Required, non-empty
- **Last Name**: Required, non-empty
- **Phone**: Minimum 10 characters, supports international formats
- **Address Line 1**: Required, non-empty
- **Address Line 2**: Optional
- **City**: Required, non-empty
- **State**: Required, non-empty
- **Zip Code**: Required, US format (5 or 5+4 digits) if country is US
- **Country**: Required, 2-letter country code

## Testing

### Test Cards (Stripe Test Mode)

| Card Brand | Card Number | CVV | Expiry |
|------------|-------------|-----|--------|
| Visa | 4242424242424242 | 123 | Any future date |
| Mastercard | 5555555555554444 | 123 | Any future date |
| Amex | 378282246310005 | 1234 | Any future date |

### Running Tests

1. **Update Test Credentials**:
   ```bash
   # Edit test-checkout-with-payment.js
   # Update TEST_USER.email and TEST_USER.password with valid credentials
   ```

2. **Run Test Suite**:
   ```bash
   node test-checkout-with-payment.js
   ```

3. **Test Coverage**:
   - ✅ Successful checkout with valid card
   - ✅ Invalid card number validation
   - ✅ Expired card validation
   - ✅ Invalid CVV validation
   - ✅ Invalid billing address validation
   - ✅ Mastercard payment processing
   - ✅ Payment method validation
   - ✅ Empty cart validation

## Postman Collection

Import the Postman collection: `Celora_Checkout_With_Payment.postman_collection.json`

### Setup Variables:
1. **baseUrl**: `http://localhost:3000` (or your server URL)
2. **authToken**: JWT token from login response
3. **userId**: User ID from login response
4. **sessionId**: Cart session ID (timestamp or UUID)

### Test Scenarios:
1. ✅ Checkout with Card Payment - Success
2. ✅ Checkout with Mastercard
3. ✅ Checkout with Affirm
4. ❌ Invalid Card Number
5. ❌ Expired Card
6. ❌ Invalid CVV
7. ❌ Missing Billing Address Fields
8. ❌ Invalid Email Format
9. ❌ Invalid US Zip Code
10. ❌ Invalid Payment Method

## Security Considerations

### PCI Compliance
- ✅ **NEVER** stores full card numbers
- ✅ Only stores last 4 digits and card brand
- ✅ Card details transmitted securely to Stripe
- ✅ CVV is never stored (required by PCI DSS)

### Data Protection
- ✅ All payment processing through Stripe's secure API
- ✅ TLS/SSL encryption for data transmission
- ✅ JWT authentication required for checkout
- ✅ Input validation and sanitization
- ✅ Rate limiting on checkout endpoint

## Order Flow

1. **Cart Validation**: Check cart exists and has items
2. **Auto-Apply Coupons**: Apply category coupons if applicable
3. **Price Calculation**: Calculate with variant pricing and discounts
4. **Payment Validation**: Validate card details and addresses
5. **Stripe Payment**: Create payment method and process payment
6. **Order Creation**: Create order with payment details
7. **Cart Cleanup**: Mark cart as checked out
8. **Email Notification**: Send confirmation email to customer

## Database Schema Updates

### Order.paymentDetails
```javascript
{
  // Stripe identifiers
  stripePaymentIntentId: String,
  
  // Payment method
  paymentMethod: String, // 'card', 'affirm'
  
  // Card details (SECURE - only last 4 and brand)
  cardLast4: String,
  cardBrand: String, // 'visa', 'mastercard', 'amex'
  
  // Billing address
  billingAddress: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postal_code: String,
    country: String
  },
  
  // Shipping address
  shippingAddress: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postal_code: String,
    country: String
  },
  
  // Customer details
  customerEmail: String,
  customerName: String,
  customerPhone: String,
  
  // Payment status
  paymentStatus: String,
  paymentConfirmedAt: Date,
  amountPaid: Number,
  currency: String
}
```

## Frontend Integration

### Example JavaScript (React/Vue/Angular)

```javascript
// Checkout with card payment
const checkoutWithCard = async () => {
  try {
    const response = await fetch('/api/cart/checkout-with-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        sessionId: cartSessionId,
        userId: currentUserId,
        paymentMethod: 'card',
        cardDetails: {
          cardNumber: '4242424242424242',
          expiryMonth: '12',
          expiryYear: '2025',
          cvv: '123',
          cardholderName: 'John Doe'
        },
        billingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+1-234-567-8900',
          address1: '123 Main St',
          address2: '',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'US'
        },
        shippingAddress: {
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1-234-567-8900',
          address1: '456 Oak Ave',
          address2: '',
          city: 'Brooklyn',
          state: 'NY',
          zipCode: '11201',
          country: 'US'
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Order placed successfully
      console.log('Order ID:', data.order.orderId);
      // Redirect to success page
      window.location.href = `/order-confirmation/${data.order.orderId}`;
    } else {
      // Show error message
      alert(data.error);
    }
  } catch (error) {
    console.error('Checkout failed:', error);
  }
};

// Checkout with Affirm
const checkoutWithAffirm = async () => {
  try {
    const response = await fetch('/api/cart/checkout-with-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        sessionId: cartSessionId,
        userId: currentUserId,
        paymentMethod: 'affirm',
        billingAddress: { /* ... */ },
        shippingAddress: { /* ... */ }
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.checkoutUrl) {
      // Redirect to Affirm checkout
      window.location.href = data.checkoutUrl;
    }
  } catch (error) {
    console.error('Affirm checkout failed:', error);
  }
};
```

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid card number" | Card number too short/long | Use 13-19 digit card number |
| "Card has expired" | Expiry date in the past | Use future expiry date |
| "Invalid CVV" | CVV not 3-4 digits | Use 3 digits (4 for Amex) |
| "Invalid email format" | Email doesn't match pattern | Use valid email format |
| "Invalid US zip code format" | Wrong zip format for US | Use 5 or 5+4 digit format |
| "Cart not found" | Invalid session/user ID | Verify cart exists first |
| "Cart is empty" | No items in cart | Add items before checkout |
| "Payment failed" | Stripe declined payment | Check card details, try different card |

## Support and Troubleshooting

### Debug Logs
The system logs detailed information during checkout:
- Cart state and items
- Coupon application
- Price calculations
- Payment method creation
- Payment intent status
- Order creation

### Common Issues

1. **Payment Declined**: Check Stripe dashboard for decline reason
2. **Email Not Sent**: Verify email service configuration
3. **Order Not Created**: Check database connection and schema
4. **Invalid Token**: Ensure JWT token is valid and not expired

## Files Modified/Created

### Modified Files
1. `/src/routes/cart.js` - Added checkout-with-payment endpoint
2. `/src/models/schema.js` - Added cardLast4 and cardBrand fields

### New Files
1. `/test-checkout-with-payment.js` - Comprehensive test suite
2. `/Celora_Checkout_With_Payment.postman_collection.json` - Postman collection
3. `/CHECKOUT_WITH_PAYMENT_GUIDE.md` - This documentation

## Changelog

### Version 1.0.0 (Current)
- ✅ Direct card payment processing via Stripe
- ✅ Affirm payment method support
- ✅ Comprehensive card and address validation
- ✅ Secure payment processing (PCI compliant)
- ✅ Billing and shipping address handling
- ✅ Email confirmation on successful payment
- ✅ Complete test suite
- ✅ Postman collection for API testing
- ✅ Detailed error handling and validation messages

## Future Enhancements

- [ ] 3D Secure (SCA) support for EU cards
- [ ] Save card for future use (with tokenization)
- [ ] Multiple payment methods per order
- [ ] Partial payments and installments
- [ ] Digital wallets (Apple Pay, Google Pay)
- [ ] Cryptocurrency payment options
- [ ] Subscription and recurring payments
