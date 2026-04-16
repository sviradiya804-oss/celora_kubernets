# Payment Flow Testing - Individual Curl Commands
# ==============================================

BASE_URL="http://localhost:3000"

## 1. CART OPERATIONS
# Add Product 1 to cart
curl -X POST $BASE_URL/api/cart/add \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "userId": "685cd5ad2169d032519eeb3f",
    "productId": "25402955-5189-4bdc-b777-8d68c666b7a6",
    "quantity": 2,
    "selectedVariant": "standard"
  }'

# Add Product 0 to cart
curl -X POST $BASE_URL/api/cart/add \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "userId": "685cd5ad2169d032519eeb3f",
    "productId": "4ac82a2b-faf5-4bf7-8f56-9ca249b187b9",
    "quantity": 1,
    "selectedVariant": "premium"
  }'

# Update cart item quantity
curl -X PUT $BASE_URL/api/cart/update \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "userId": "685cd5ad2169d032519eeb3f",
    "productId": "25402955-5189-4bdc-b777-8d68c666b7a6",
    "quantity": 3
  }'

# Apply coupon
curl -X POST $BASE_URL/api/cart/apply-coupon \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "userId": "685cd5ad2169d032519eeb3f",
    "code": "SAVE10"
  }'

# Checkout - Create Stripe session
curl -X POST $BASE_URL/api/cart/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "userId": "685cd5ad2169d032519eeb3f"
  }'

## 2. PAYMENT STATUS & MANAGEMENT
# Check payment status by session ID
curl -X GET "$BASE_URL/api/payments/status/cs_test_your_session_id_here"

# Payment success route
curl -X GET "$BASE_URL/api/payments/success/cs_test_your_session_id_here"

# Payment failed route  
curl -X GET "$BASE_URL/api/payments/failed/cs_test_your_session_id_here"

# Payment cancel route
curl -X GET "$BASE_URL/api/payments/cancel/cs_test_your_session_id_here"

# Get order details by order ID
curl -X GET "$BASE_URL/api/payments/order/your-order-id-here"

# Retry payment for failed order
curl -X POST "$BASE_URL/api/payments/retry/your-order-id-here"

## 3. PAYMENT INTENTS
# Create payment intent
curl -X POST $BASE_URL/api/payments/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50000,
    "currency": "usd",
    "orderId": "your-order-id-here"
  }'

# Process refund
curl -X POST $BASE_URL/api/payments/refund \
  -H "Content-Type: application/json" \
  -d '{
    "paymentIntentId": "pi_your_payment_intent_id",
    "amount": 25000
  }'

## 4. WEBHOOK TESTING (for development)
# Test webhook endpoint (this simulates Stripe sending a webhook)
curl -X POST $BASE_URL/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: your_test_signature" \
  -d '{
    "id": "evt_test_webhook",
    "object": "event",
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_test_session_id",
        "payment_status": "paid",
        "amount_total": 50000,
        "currency": "usd",
        "metadata": {
          "cartId": "test_cart_id",
          "userId": "685cd5ad2169d032519eeb3f"
        }
      }
    }
  }'

## 5. CART MANAGEMENT
# Remove item from cart
curl -X DELETE $BASE_URL/api/cart/remove/25402955-5189-4bdc-b777-8d68c666b7a6 \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "userId": "685cd5ad2169d032519eeb3f"
  }'

# Clear entire cart
curl -X DELETE $BASE_URL/api/cart/clear \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "userId": "685cd5ad2169d032519eeb3f"
  }'

## 6. HEALTH CHECKS
# API health check
curl -X GET $BASE_URL/health

# API status (requires auth)
curl -X GET $BASE_URL/api/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# ============================================
# EXPECTED RESPONSES:
# ============================================

# Successful cart add:
# {
#   "success": true,
#   "message": "Item added to cart",
#   "cart": { ... }
# }

# Successful checkout:
# {
#   "success": true,
#   "url": "https://checkout.stripe.com/pay/cs_...",
#   "sessionId": "cs_test_...",
#   "orderId": "uuid-order-id"
# }

# Payment success:
# {
#   "success": true,
#   "message": "Payment successful! Your order has been confirmed.",
#   "order": { ... },
#   "session": { ... }
# }

# Payment failed:
# {
#   "success": false,
#   "message": "Payment failed or was cancelled.",
#   "order": { ... },
#   "retryUrl": "https://yoursite.com/retry-payment/order-id"
# }
