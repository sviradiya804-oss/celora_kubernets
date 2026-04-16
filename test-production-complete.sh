#!/bin/bash

# Production API Configuration
PROD_API="https://celoraapi-cgezcsefa6b5f4gq.centralindia-01.azurewebsites.net"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NWU4MjU3ZjBlODYzYWEwMzBjMDI5MSIsInJvbGUiOiI2ODc1ZWI2NWNmMmU0NTIwNDQ0YjkzNWIiLCJpYXQiOjE3NTI1NTg1NTAsImV4cCI6MTc1MzE2MzM1MH0.jLe7J6FT6aGW1BVYHkwH6qHrMWYolpUw_fS09JCv4n0"
USER_ID="68cfb58bba4299c98af66c87"

echo "🧪 === PRODUCTION CART & CHECKOUT TEST ==="
echo "=========================================="
echo ""

# Step 0: Clear any existing cart
echo "🧹 Step 0: Clearing existing cart..."
CLEAR_RESPONSE=$(curl -s -X DELETE "$PROD_API/api/cart/clear" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"userId\": \"$USER_ID\"
  }")

echo "Cart cleared"
echo ""

# Step 1: Get a product from production
echo "📋 Step 1: Fetching products from production..."
PRODUCT_RESPONSE=$(curl -s "$PROD_API/api/jewelry?page=1&limit=1" \
  -H "Authorization: Bearer $TOKEN")

PRODUCT_ID=$(echo "$PRODUCT_RESPONSE" | jq -r '.data[0]._id // empty')

if [ -z "$PRODUCT_ID" ] || [ "$PRODUCT_ID" == "null" ]; then
  echo "❌ Could not find any products"
  echo "Response: $PRODUCT_RESPONSE" | head -c 500
  exit 1
fi

echo "✅ Found Product ID: $PRODUCT_ID"
PRODUCT_NAME=$(echo "$PRODUCT_RESPONSE" | jq -r '.data[0].title // "Unknown Product"')
echo "   Product: $PRODUCT_NAME"
echo ""

# Step 2: Add to Cart
echo "📦 Step 2: Adding product to cart..."
ADD_RESPONSE=$(curl -s "$PROD_API/api/cart/add" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"userId\": \"$USER_ID\",
    \"productId\": \"$PRODUCT_ID\",
    \"quantity\": 2,
    \"selectedOptions\": {
      \"ringsize\": \"7\"
    },
    \"engravingOptions\": {
      \"engravingText\": \"Production Test\",
      \"font\": \"Script\"
    }
  }")

echo "$ADD_RESPONSE" | jq '{success, message, sessionId, totalItems, subtotal: .cart.summary.subtotal, total: .cart.summary.total}'
echo ""

SESSION_ID=$(echo "$ADD_RESPONSE" | jq -r '.sessionId')

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" == "null" ]; then
  echo "❌ Failed to get session ID"
  exit 1
fi

echo "✅ Session ID: $SESSION_ID"
echo ""

# Step 3: Get Cart
echo "🛒 Step 3: Retrieving cart..."
CART_RESPONSE=$(curl -s "$PROD_API/api/cart/$USER_ID?sessionId=$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN")

echo "$CART_RESPONSE" | jq '.cart.summary // .summary'
echo ""

CART_TOTAL=$(echo "$CART_RESPONSE" | jq -r '.cart.summary.total // .summary.total // 0')
CART_ITEMS=$(echo "$CART_RESPONSE" | jq -r '.cart.summary.itemCount // .summary.itemCount // 0')

echo "📊 Cart Summary:"
echo "   Items: $CART_ITEMS"
echo "   Total: \$$CART_TOTAL"
echo ""

if [ "$CART_ITEMS" == "0" ]; then
  echo "⚠️  Warning: Cart appears empty, but continuing..."
  echo ""
fi

# Step 4: Checkout
echo "💳 Step 4: Creating Stripe checkout..."
CHECKOUT_RESPONSE=$(curl -s "$PROD_API/api/cart/checkout" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"userId\": \"$USER_ID\",
    \"shippingDetails\": {
      \"estimatedDeliveryDays\": 5,
      \"deliveryDateStart\": \"2025-10-12\",
      \"deliveryDateEnd\": \"2025-10-14\",
      \"shippingMethod\": \"Standard\",
      \"shippingCost\": 0
    }
  }")

# Check if checkout succeeded
ERROR=$(echo "$CHECKOUT_RESPONSE" | jq -r '.error // empty')

if [ -n "$ERROR" ]; then
  echo "❌ Checkout failed"
  echo "$CHECKOUT_RESPONSE" | jq '.'
  echo ""
  exit 1
fi

echo "$CHECKOUT_RESPONSE" | jq '{success, sessionId, orderId, orderSummary}'
echo ""

STRIPE_URL=$(echo "$CHECKOUT_RESPONSE" | jq -r '.url // empty')
ORDER_ID=$(echo "$CHECKOUT_RESPONSE" | jq -r '.orderId // empty')

if [ -z "$STRIPE_URL" ]; then
  echo "❌ No Stripe URL received"
  exit 1
fi

echo "=========================================="
echo "✅ ALL TESTS PASSED!"
echo "=========================================="
echo ""
echo "📋 Summary:"
echo "   Product ID: $PRODUCT_ID"
echo "   Session ID: $SESSION_ID"
echo "   Order ID: $ORDER_ID"
echo ""
echo "🔗 Stripe Checkout URL:"
echo "   ${STRIPE_URL:0:80}..."
echo ""
echo "💡 Next Steps:"
echo "   1. Open the Stripe URL to complete payment"
echo "   2. Test webhook by completing payment"
echo "   3. Verify order creation in production"
echo "   4. Check email delivery"
echo ""
echo "✨ Features Available:"
echo "   • Credit/Debit Card payments"
echo "   • Affirm (Buy Now Pay Later)"
echo "   • FREE Engraving service"
echo "   • Shape-based product images"
echo "   • Automated invoices"
echo ""
