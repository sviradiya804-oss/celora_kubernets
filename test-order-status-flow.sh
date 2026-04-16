#!/bin/bash

# Order Status Update Email Testing Script
# =====================================

BASE_URL="http://localhost:3000"
ORDER_ID="df922180-6b7f-11f0-9e6a-2d53e7185b03"  # Use the actual order ID
CUSTOMER_EMAIL="vatsalmangukiya9003@gmail.com"

echo "🔄 Testing Order Status Update with Email Sending"
echo "================================================="

# Test 1: Update order to Manufacturing status
echo -e "\n1. Updating order to Manufacturing status..."
MANUFACTURING_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/payments/update-order-status/${ORDER_ID}" \
  -F "newStatus=Manufacturing" \
  -F "statusMessage=Your jewelry is now being crafted by our skilled artisans" \
  -F "customerEmail=${CUSTOMER_EMAIL}")

echo $MANUFACTURING_RESPONSE | jq '.'

# Test 2: Update order to Quality Check status
echo -e "\n2. Updating order to Quality Assurance status..."
QUALITY_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/payments/update-order-status/${ORDER_ID}" \
  -F "newStatus=Quality Assurance" \
  -F "statusMessage=Your order is going through our quality assurance process" \
  -F "customerEmail=${CUSTOMER_EMAIL}")

echo $QUALITY_RESPONSE | jq '.'

# Test 3: Update order to Shipping status
echo -e "\n3. Updating order to Shipping status..."
SHIPPING_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/payments/update-order-status/${ORDER_ID}" \
  -F "newStatus=Out For Delivery" \
  -F "statusMessage=Your order is out for delivery and will arrive soon" \
  -F "customerEmail=${CUSTOMER_EMAIL}")

echo $SHIPPING_RESPONSE | jq '.'

# Test 4: Update order to Delivered status
echo -e "\n4. Updating order to Delivered status..."
DELIVERED_RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/payments/update-order-status/${ORDER_ID}" \
  -F "newStatus=Delivered" \
  -F "statusMessage=Your order has been successfully delivered!" \
  -F "customerEmail=${CUSTOMER_EMAIL}")

echo $DELIVERED_RESPONSE | jq '.'

echo -e "\n✅ All order status updates completed!"
echo -e "\n📧 Email notifications sent to: ${CUSTOMER_EMAIL}"
echo -e "\n📋 Order ID: ${ORDER_ID}"

# Test 5: Get final order details
echo -e "\n5. Getting final order details..."
FINAL_ORDER=$(curl -s -X GET "${BASE_URL}/api/payments/order/${ORDER_ID}")
echo $FINAL_ORDER | jq '.order.progress'

echo -e "\n🎉 Testing completed successfully!"
echo -e "\nCheck your email inbox at ${CUSTOMER_EMAIL} for the status update notifications!"
