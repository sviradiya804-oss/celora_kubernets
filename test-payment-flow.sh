#!/bin/bash

# Comprehensive Payment Flow Testing Script
# ========================================

BASE_URL="http://localhost:3000"
SESSION_ID="test-session-$(date +%s)"
USER_ID="685b7da5b4057cc3a3daadbd"

echo "🔄 Testing Complete Payment Flow with Webhooks"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
v7
# Function to print colored output
print_step() {
    echo -e "${YELLOW}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Health Check
print_step "1. Health Check"
curl -s -X GET $BASE_URL/health | jq '.'

# Step 2: Add products to cart
print_step "2. Adding products to cart..."
CART_RESPONSE=$(curl -s -X POST $BASE_URL/api/cart/add \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"userId\": \"$USER_ID\",
    \"productId\": \"6874ab1e6da13d33f67e7cfe\",
    \"quantity\": 2
  }")

echo $CART_RESPONSE | jq '.'

if [[ $(echo $CART_RESPONSE | jq -r '.success') == "true" ]]; then
    print_success "Product added to cart"
else
    print_error "Failed to add product to cart"
    exit 1
fi

# Step 3: Add second product
print_step "3. Adding second product..."
curl -s -X POST $BASE_URL/api/cart/add \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"userId\": \"$USER_ID\",
    \"productId\": \"6874ab1e6da13d33f67e7cfe\",
    \"quantity\": 1
  }" | jq '.'

# Step 4: Checkout
print_step "4. Processing checkout..."
CHECKOUT_RESPONSE=$(curl -s -X POST $BASE_URL/api/cart/checkout \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"userId\": \"$USER_ID\"
  }")

echo $CHECKOUT_RESPONSE | jq '.'

# Extract session ID and order ID
STRIPE_SESSION_ID=$(echo $CHECKOUT_RESPONSE | jq -r '.sessionId // empty')
ORDER_ID=$(echo $CHECKOUT_RESPONSE | jq -r '.orderId // empty')

if [ ! -z "$STRIPE_SESSION_ID" ] && [ "$STRIPE_SESSION_ID" != "null" ]; then
    print_success "Checkout successful - Session ID: $STRIPE_SESSION_ID"
    print_success "Order created - Order ID: $ORDER_ID"
else
    print_error "Checkout failed"
    exit 1
fi

# Step 5: Check payment status
print_step "5. Checking payment status..."
curl -s -X GET "$BASE_URL/api/payments/status/$STRIPE_SESSION_ID" | jq '.'

# Step 6: Test success route
print_step "6. Testing payment success route..."
curl -s -X GET "$BASE_URL/api/payments/success/$STRIPE_SESSION_ID" | jq '.'

# Step 7: Test failed route
print_step "7. Testing payment failed route..."
curl -s -X GET "$BASE_URL/api/payments/failed/$STRIPE_SESSION_ID" | jq '.'

# Step 8: Test cancel route
print_step "8. Testing payment cancel route..."
curl -s -X GET "$BASE_URL/api/payments/cancel/$STRIPE_SESSION_ID" | jq '.'

# Step 9: Get order details
print_step "9. Getting order details..."
curl -s -X GET "$BASE_URL/api/payments/order/$ORDER_ID" | jq '.'

# Step 10: Test retry payment
print_step "10. Testing retry payment..."
curl -s -X POST "$BASE_URL/api/payments/retry/$ORDER_ID" | jq '.'

echo ""
print_success "Payment flow testing completed!"
echo ""
echo "📋 Summary:"
echo "- Session ID: $STRIPE_SESSION_ID"
echo "- Order ID: $ORDER_ID"
echo "- Stripe Checkout URL: $(echo $CHECKOUT_RESPONSE | jq -r '.url')"
echo ""
echo "🔗 Test URLs:"
echo "- Success: $BASE_URL/api/payments/success/$STRIPE_SESSION_ID"
echo "- Failed: $BASE_URL/api/payments/failed/$STRIPE_SESSION_ID"
echo "- Cancel: $BASE_URL/api/payments/cancel/$STRIPE_SESSION_ID"
echo "- Order Details: $BASE_URL/api/payments/order/$ORDER_ID"
echo ""
echo "💡 To test webhook functionality:"
echo "1. Use ngrok to expose your local server: ngrok http 3000"
echo "2. Add the webhook URL to Stripe Dashboard"
echo "3. Complete a real payment to trigger webhooks"
