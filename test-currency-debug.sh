#!/bin/bash

# Test Currency Conversion - Debug Script

BASE_URL="http://localhost:3000/api"

echo "======================================"
echo "CURRENCY CONVERSION DEBUG TEST"
echo "======================================"
echo ""

echo "Test 1: Get jewelry WITHOUT currency param (should be USD)"
echo "------------------------------------------------------"
curl -s "$BASE_URL/jewelry?limit=1" | jq '{
  success,
  data: .data[0] | {
    name,
    price,
    currencyCode,
    currencySymbol,
    formattedPrice
  }
}'
echo ""
echo ""

echo "Test 2: Get jewelry WITH currency=EUR"
echo "------------------------------------------------------"
curl -s "$BASE_URL/jewelry?currency=EUR&limit=1" | jq '{
  success,
  data: .data[0] | {
    name,
    price,
    currencyCode,
    currencySymbol,
    formattedPrice
  }
}'
echo ""
echo ""

echo "Test 3: Get jewelry WITH currency=GBP"
echo "------------------------------------------------------"
curl -s "$BASE_URL/jewelry?currency=GBP&limit=1" | jq '{
  success,
  data: .data[0] | {
    name,
    price,
    currencyCode,
    currencySymbol,
    formattedPrice
  }
}'
echo ""
echo ""

echo "Test 4: Get specific jewelry item with EUR"
echo "------------------------------------------------------"
JEWELRY_ID="45c82821-a1c5-11f0-9fd3-abe04cff71ef"
curl -s "$BASE_URL/jewelry/$JEWELRY_ID?currency=EUR" | jq '{
  name,
  price,
  currencyCode,
  currencySymbol,
  formattedPrice
}'
echo ""
echo ""

echo "Test 5: Check server console logs"
echo "Look for these log messages in the server console:"
echo "  🔹 [CurrencyMiddleware] Resolved currency: ..."
echo "  🔸 [ResponseConversion] Starting conversion..."
echo "  🔸 [ResponseConversion] Resolved rate: ..."
echo "  ✅ [ResponseConversion] Conversion complete"
echo ""

echo "======================================"
echo "If prices are NOT changing:"
echo "1. Check server logs for currency middleware messages"
echo "2. Verify exchange rates exist in DB"
echo "3. Check that convertResponse middleware is applied"
echo "======================================"
