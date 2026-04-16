#!/bin/bash

# Production API Base URL
PROD_API="https://celoraapi-cgezcsefa6b5f4gq.centralindia-01.azurewebsites.net"
LOCAL_API="http://localhost:3000"

# Token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NWU4MjU3ZjBlODYzYWEwMzBjMDI5MSIsInJvbGUiOiI2ODc1ZWI2NWNmMmU0NTIwNDQ0YjkzNWIiLCJpYXQiOjE3NTI1NTg1NTAsImV4cCI6MTc1MzE2MzM1MH0.jLe7J6FT6aGW1BVYHkwH6qHrMWYolpUw_fS09JCv4n0"

echo "🧪 Testing Production Cart & Checkout Flow"
echo "=========================================="
echo ""

# Step 1: Get list of products to find a valid product ID
echo "📋 Step 1: Fetching products from production..."
echo "GET $PROD_API/api/jewelry?page=1&limit=1"
echo ""

PRODUCT_RESPONSE=$(curl -s --location "$PROD_API/api/jewelry?page=1&limit=1" \
  --header "Authorization: Bearer $TOKEN")

# Extract first product ID using jq
PRODUCT_ID=$(echo "$PRODUCT_RESPONSE" | jq -r '.data[0]._id // .products[0]._id // .items[0]._id // .[0]._id // empty')

if [ -z "$PRODUCT_ID" ] || [ "$PRODUCT_ID" == "null" ]; then
  echo "❌ Could not find any products in production"
  echo "Response: $PRODUCT_RESPONSE"
  exit 1
fi

echo "✅ Found Product ID: $PRODUCT_ID"
echo ""

# Step 2: Add product to cart
echo "📦 Step 2: Adding product to cart..."
echo "POST $PROD_API/api/cart/add"
echo ""

ADD_CART_RESPONSE=$(curl -s --location "$PROD_API/api/cart/add" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $TOKEN" \
  --data "{
    \"userId\": \"68cfb58bba4299c98af66c87\",
    \"productId\": \"$PRODUCT_ID\",
    \"quantity\": 1,
    \"selectedOptions\": {
      \"ringsize\": \"7\"
    }
  }")

echo "$ADD_CART_RESPONSE" | jq '.'
echo ""

# Extract session ID
SESSION_ID=$(echo "$ADD_CART_RESPONSE" | jq -r '.sessionId // empty')

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" == "null" ]; then
  echo "❌ Failed to add product to cart or get session ID"
  exit 1
fi

echo "✅ Session ID: $SESSION_ID"
echo ""

# Step 3: Get cart
echo "🛒 Step 3: Retrieving cart..."
echo "GET $PROD_API/api/cart/68cfb58bba4299c98af66c87?sessionId=$SESSION_ID"
echo ""

CART_RESPONSE=$(curl -s --location "$PROD_API/api/cart/68cfb58bba4299c98af66c87?sessionId=$SESSION_ID" \
  --header "Authorization: Bearer $TOKEN")

echo "$CART_RESPONSE" | jq '.cart.summary // .summary'
echo ""

# Step 4: Checkout
echo "💳 Step 4: Creating Stripe checkout session..."
echo "POST $PROD_API/api/cart/checkout"
echo ""

CHECKOUT_RESPONSE=$(curl -s --location "$PROD_API/api/cart/checkout" \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $TOKEN" \
  --data "{
    \"sessionId\": \"$SESSION_ID\",
    \"userId\": \"68cfb58bba4299c98af66c87\",
    \"shippingDetails\": {
      \"estimatedDeliveryDays\": 5,
      \"deliveryDateStart\": \"2025-10-12\",
      \"deliveryDateEnd\": \"2025-10-14\",
      \"shippingMethod\": \"Standard\",
      \"shippingCost\": 0
    }
  }")

echo "$CHECKOUT_RESPONSE" | jq '.'
echo ""

# Check if checkout was successful
STRIPE_URL=$(echo "$CHECKOUT_RESPONSE" | jq -r '.url // empty')

if [ -z "$STRIPE_URL" ] || [ "$STRIPE_URL" == "null" ]; then
  echo "❌ Checkout failed"
  exit 1
fi

echo "✅ Checkout successful!"
echo "🔗 Stripe URL: $STRIPE_URL"
echo ""
echo "=========================================="
echo "✨ All tests passed!"
echo ""
echo "💡 Next steps:"
echo "   1. Open the Stripe URL to complete payment"
echo "   2. Test webhook by completing payment"
echo "   3. Verify order creation"
