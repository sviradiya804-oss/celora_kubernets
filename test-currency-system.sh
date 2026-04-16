#!/bin/bash

# Complete Currency Conversion System - Testing Script
# Run this after starting the server

BASE_URL="http://localhost:3000/api"
# Change this to your actual API URL
# BASE_URL="https://celoraapi-cgezcsefa6b5f4gq.centralindia-01.azurewebsites.net/api"

echo "========================================="
echo "CURRENCY CONVERSION SYSTEM - TEST SUITE"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Get available currencies
echo -e "${YELLOW}Test 1: Get Available Currencies${NC}"
curl -s "$BASE_URL/currency/available" | jq '.'
echo ""

# Test 2: Browse jewelry with EUR (guest user)
echo -e "${YELLOW}Test 2: Browse Jewelry in EUR (Guest)${NC}"
curl -s "$BASE_URL/jewelry?currency=EUR&limit=2" | jq '.data[] | {name, price, currencyCode, currencySymbol, formattedPrice}'
echo ""

# Test 3: Browse jewelry with GBP
echo -e "${YELLOW}Test 3: Browse Jewelry in GBP (Guest)${NC}"
curl -s "$BASE_URL/jewelry?currency=GBP&limit=2" | jq '.data[] | {name, price, currencyCode, currencySymbol, formattedPrice}'
echo ""

# Test 4: Browse jewelry with INR
echo -e "${YELLOW}Test 4: Browse Jewelry in INR (Guest)${NC}"
curl -s "$BASE_URL/jewelry?currency=INR&limit=2" | jq '.data[] | {name, price, currencyCode, currencySymbol, formattedPrice}'
echo ""

# Test 5: Get specific jewelry item with currency
echo -e "${YELLOW}Test 5: Get Specific Jewelry Item in EUR${NC}"
JEWELRY_ID="45c82821-a1c5-11f0-9fd3-abe04cff71ef"
curl -s "$BASE_URL/jewelry/$JEWELRY_ID?currency=EUR" | jq '{name, price, currencyCode, currencySymbol, formattedPrice}'
echo ""

# Test 6: Default USD (no currency param)
echo -e "${YELLOW}Test 6: Default USD (No Currency Param)${NC}"
curl -s "$BASE_URL/jewelry?limit=1" | jq '.data[] | {name, price, currencyCode, currencySymbol, formattedPrice}'
echo ""

echo ""
echo "========================================="
echo -e "${GREEN}AUTHENTICATED USER TESTS (Requires Login)${NC}"
echo "========================================="
echo ""
echo "To test with authenticated user:"
echo "1. Login: POST $BASE_URL/v1/auth/login"
echo "2. Save token from response"
echo "3. Set currency: PUT $BASE_URL/currency/preference -H 'Authorization: Bearer <token>' -d '{\"currency\":\"EUR\"}'"
echo "4. Browse: GET $BASE_URL/jewelry -H 'Authorization: Bearer <token>'"
echo "5. All responses will be in EUR automatically!"
echo ""

echo "========================================="
echo -e "${GREEN}CART & CHECKOUT TESTS${NC}"
echo "========================================="
echo ""
echo "Cart operations with currency:"
echo "- GET $BASE_URL/cart/:userId?currency=EUR"
echo "- POST $BASE_URL/cart/add?currency=EUR"
echo "- GET $BASE_URL/orders/:orderId?currency=GBP"
echo ""

echo "========================================="
echo "✅ Test suite complete!"
echo "========================================="
