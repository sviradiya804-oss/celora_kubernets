#!/bin/bash

# Security Test Script for Celora Backend
# This script tests for common security vulnerabilities in the cart/payment flow

echo "🔒 Celora Backend Security Test Suite"
echo "======================================"

# Check if LOCAL_URL is set
if [ -z "$LOCAL_URL" ]; then
    LOCAL_URL="http://localhost:3000"
    echo "⚠️  LOCAL_URL not set, using default: $LOCAL_URL"
fi

echo "🔍 Testing against: $LOCAL_URL"
echo ""

# Test 1: NoSQL Injection Attempts
echo "📊 Test 1: NoSQL Injection Prevention"
echo "------------------------------------"

# Test cart add with NoSQL injection
echo "Testing cart add with NoSQL injection..."
curl -s -X POST "$LOCAL_URL/api/cart/add" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session",
    "userId": {"$ne": null},
    "productId": {"$where": "this.price < 1000"},
    "quantity": 1
  }' | jq '.'

echo ""

# Test cart search with injection
echo "Testing cart search with NoSQL injection..."
curl -s -X POST "$LOCAL_URL/api/cart/search" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": {"$regex": ".*"},
    "userId": {"$exists": true}
  }' | jq '.'

echo ""

# Test 2: XSS Prevention
echo "📊 Test 2: XSS Prevention"
echo "-------------------------"

echo "Testing cart add with XSS payload..."
curl -s -X POST "$LOCAL_URL/api/cart/add" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "<script>alert(\"XSS\")</script>",
    "userId": "66b123456789abcdef123456",
    "productId": "66b123456789abcdef123456",
    "quantity": 1,
    "selectedVariant": "<img src=x onerror=alert(1)>"
  }' | jq '.'

echo ""

# Test 3: Required Field Bypass
echo "📊 Test 3: Required Field Validation"
echo "-----------------------------------"

echo "Testing cart add without required fields..."
curl -s -X POST "$LOCAL_URL/api/cart/add" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'

echo ""

echo "Testing checkout without required fields..."
curl -s -X POST "$LOCAL_URL/api/cart/checkout" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'

echo ""

# Test 4: Authentication Bypass
echo "📊 Test 4: Authentication Validation"
echo "-----------------------------------"

echo "Testing protected routes without auth..."
curl -s -X POST "$LOCAL_URL/api/orders/complete-order" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "66b123456789abcdef123456",
    "products": [{"productId": "66b123456789abcdef123456", "quantity": 1}],
    "total": 100
  }' | jq '.'

echo ""

# Test 5: SQL/NoSQL Injection in Order Status
echo "📊 Test 5: Order Status Injection"
echo "--------------------------------"

echo "Testing order status update with injection..."
curl -s -X PUT "$LOCAL_URL/api/payments/update-order-status/TEST-ORDER" \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": {"$ne": null},
    "statusMessage": "<script>alert(\"inject\")</script>",
    "customerEmail": "test@example.com"
  }' | jq '.'

echo ""

# Test 6: Payment Intent Manipulation
echo "📊 Test 6: Payment Intent Security"
echo "---------------------------------"

echo "Testing payment intent with invalid data..."
curl -s -X POST "$LOCAL_URL/api/payments/create-payment-intent" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": -100,
    "currency": {"$ne": "usd"}
  }' | jq '.'

echo ""

# Test 7: File Upload Security
echo "📊 Test 7: File Upload Security"
echo "------------------------------"

echo "Testing malicious file upload..."
response=$(curl -s -X POST "$LOCAL_URL/api/payments/update-order-status/TEST-ORDER" \
  -H "Content-Type: multipart/form-data" \
  -F "statusImage=@/dev/null;filename=../../../etc/passwd" \
  -F "newStatus=Manufacturing" \
  -F "customerEmail=test@example.com")

if echo "$response" | jq . >/dev/null 2>&1; then
  echo "$response" | jq '.'
else
  echo "Response (raw): $response"
fi

echo ""

# Test 8: Rate Limiting
echo "📊 Test 8: Rate Limiting"
echo "-----------------------"

echo "Testing rate limiting (sending 10 rapid requests)..."
for i in {1..10}; do
  curl -s -X POST "$LOCAL_URL/api/cart/add" \
    -H "Content-Type: application/json" \
    -d '{
      "sessionId": "rate-test-'$i'",
      "userId": "66b123456789abcdef123456",
      "productId": "66b123456789abcdef123456",
      "quantity": 1
    }' &
done
wait

echo ""

# Test 9: CORS Policy
echo "📊 Test 9: CORS Policy"
echo "---------------------"

echo "Testing CORS with unauthorized origin..."
curl -s -X OPTIONS "$LOCAL_URL/api/cart/add" \
  -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" -I

echo ""

# Test 10: Parameter Pollution
echo "📊 Test 10: Parameter Pollution"
echo "------------------------------"

echo "Testing parameter pollution..."
curl -s -X POST "$LOCAL_URL/api/cart/add" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session",
    "sessionId": {"$ne": null},
    "userId": "66b123456789abcdef123456",
    "productId": "66b123456789abcdef123456",
    "quantity": 1,
    "quantity": 999999
  }' | jq '.'

echo ""

echo "🔒 Security Test Complete!"
echo "=========================="
echo ""
echo "💡 How to interpret results:"
echo "- ❌ Error responses (400, 401, 403, 500) indicate proper security measures"
echo "- ✅ Success responses (200, 201) to malicious payloads indicate vulnerabilities"
echo "- 📝 Check for data sanitization in response bodies"
echo "- 🔍 Monitor server logs for injection attempts"
echo ""
echo "🛡️  Security Recommendations:"
echo "- Ensure all inputs are validated and sanitized"
echo "- Implement proper authentication on all endpoints"
echo "- Use parameterized queries for database operations"
echo "- Validate file uploads and restrict file types"
echo "- Implement rate limiting on all public endpoints"
echo "- Use HTTPS in production"
echo "- Regularly update dependencies"
