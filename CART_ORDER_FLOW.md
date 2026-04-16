# Cart and Order Flow Documentation

## Overview
This document outlines the complete cart, checkout, and order management flow for the Celora Backend application.

## API Endpoints

### Cart Management
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update` - Update item quantity 
- `DELETE /api/cart/remove/:id` - Remove item from cart
- `DELETE /api/cart/clear` - Clear entire cart
- `POST /api/cart/apply-coupon` - Apply discount coupon
- `POST /api/cart/checkout` - Create Stripe checkout session

### Order Management
- `GET /api/orders/user/:userId` - Get user's orders
- `GET /api/orders/:orderId` - Get specific order
- `POST /api/orders/complete-order` - Complete order (internal)

### Payment
- `POST /api/payments/create-payment-intent` - Create payment intent
- `POST /api/payments/webhook` - Stripe webhook handler
- `GET /api/payments/status/:sessionId` - Check payment status
- `POST /api/payments/refund` - Process refund

## Complete Flow

### 1. Add Items to Cart
```javascript
POST /api/cart/add
{
  "sessionId": "unique-session-id",
  "userId": "user-object-id", 
  "productId": "product-object-id",
  "quantity": 2,
  "selectedVariant": "18k Yellow Gold"
}
```

### 2. Apply Coupon (Optional)
```javascript
POST /api/cart/apply-coupon
{
  "sessionId": "unique-session-id",
  "userId": "user-object-id",
  "code": "SAVE10"
}
```

### 3. Checkout
```javascript
POST /api/cart/checkout
{
  "sessionId": "unique-session-id", 
  "userId": "user-object-id"
}
```

This creates:
- Stripe checkout session
- Marks cart as checked out
- Creates order record with "Pending" status

### 4. Payment Processing
- User completes payment on Stripe
- Stripe webhook `/api/payments/webhook` receives `checkout.session.completed`
- Order status updated to "Confirmed"
- Confirmation email sent

### 5. Order Status Updates
Use the common controller to update order status:
```javascript
PUT /api/order/{orderId}
{
  "status": "Manufacturing",
  "trackingId": "ABC123" // for delivery status
}
```

Available statuses:
- Pending
- Confirmed  
- Manufacturing
- Quality Assurance
- Out For Delivery
- Delivered
- Cancelled

## Environment Variables Required

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend URLs
FRONTEND_URL=https://yourdomain.com

# Database
DATABASE_URI=mongodb://...

# Other existing variables...
```

## Models Used

### Cart Schema
- cartId, sessionId, userId
- items[] with productId, quantity, selectedVariant, priceAtTime
- coupon with code and discount
- UTM and tracking data
- isCheckedOut flag

### Order Schema  
- orderId, customer (userId)
- products[] with productId, quantity, type
- total, paymentMethod, status
- stripeSessionId for payment tracking
- progress tracking for each status
- emailLog for audit trail

## Error Handling

The implementation includes comprehensive error handling for:
- Missing required fields
- Product not found
- Cart not found  
- Payment failures
- Database errors
- Email delivery failures

## Production Considerations

1. **Webhook Security**: Stripe webhook signature verification implemented
2. **Price Lock-in**: Cart items lock price at time of addition
3. **Inventory Check**: Should add inventory validation before checkout
4. **Email Templates**: Order status email templates included
5. **Invoice Generation**: PDF invoice generation on order completion
6. **Audit Trail**: Complete logging of order status changes
7. **Error Logging**: Comprehensive error logging throughout

## Security Features

- Input validation on all endpoints
- Authentication required for cart operations
- Webhook signature verification
- SQL injection protection via mongoose
- XSS protection

## Next Steps for Production

1. Add inventory checking before checkout
2. Implement proper error monitoring
3. Add order cancellation functionality
4. Implement webhook retry logic
5. Add order search and filtering
6. Implement admin order management dashboard
