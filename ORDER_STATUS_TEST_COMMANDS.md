# Order Status Update with Image Testing Commands
# ===============================================

BASE_URL="http://localhost:3000"

# Test 1: Update order status with image upload (for real order)
# Replace 'your-order-id-here' with an actual order ID from your database
echo "🔄 Test 1: Update real order status with image"
curl -X PUT "${BASE_URL}/api/payments/update-order-status/7d963950-6b78-11f0-a17c-bf15209c08f5" \
  -F "newStatus=Manufacturing" \
  -F "statusMessage=Your jewelry is now being crafted by our skilled artisans" \
  -F "customerEmail=admin@yopmail.com" \
  -F "statusImage=@/path/to/your/test-image.jpg"

echo -e "\n" 

# Test 2: Update order status without image
echo "🔄 Test 2: Update order status without image"
curl -X PUT "${BASE_URL}/api/payments/update-order-status/7d963950-6b78-11f0-a17c-bf15209c08f5" \
  -F "newStatus=Quality Check" \
  -F "statusMessage=Your order is going through our quality assurance process" \
  -F "customerEmail=admin@yopmail.com"

echo -e "\n"

# Test 3: Send test email with image (doesn't require real order)
echo "🔄 Test 3: Send test email with image"
curl -X POST "${BASE_URL}/api/payments/test-order-email" \
  -F "customerEmail=admin@yopmail.com" \
  -F "customerName=Test Customer" \
  -F "orderId=TEST-ORDER-123" \
  -F "newStatus=Shipped" \
  -F "statusMessage=Your beautiful jewelry is on its way to you!" \
  -F "testImage=@/path/to/your/test-image.jpg"

echo -e "\n"

# Test 4: Send test email without image
echo "🔄 Test 4: Send test email without image"
curl -X POST "${BASE_URL}/api/payments/test-order-email" \
  -F "customerEmail=admin@yopmail.com" \
  -F "customerName=Test Customer" \
  -F "orderId=TEST-ORDER-456" \
  -F "newStatus=Delivered" \
  -F "statusMessage=Your order has been successfully delivered!"

echo -e "\n"

# ============================================
# EXPECTED RESPONSES:
# ============================================

# Success Response for Update Order Status:
# {
#   "success": true,
#   "message": "Order status updated successfully and email sent",
#   "order": {
#     "orderId": "7d963950-6b78-11f0-a17c-bf15209c08f5",
#     "oldStatus": "Confirmed",
#     "newStatus": "Manufacturing",
#     "statusMessage": "Your jewelry is now being crafted...",
#     "customer": {
#       "email": "admin@yopmail.com",
#       "name": "Admin User"
#     },
#     "progress": { ... },
#     "updatedOn": "2025-07-28T..."
#   },
#   "uploadedImage": {
#     "filename": "1690527271234-test-image.jpg",
#     "originalname": "test-image.jpg",
#     "path": "/uploads/1690527271234-test-image.jpg",
#     "size": 245760
#   }
# }

# Success Response for Test Email:
# {
#   "success": true,
#   "message": "Test email sent successfully",
#   "testData": {
#     "sentTo": "admin@yopmail.com",
#     "emailData": { ... },
#     "hasImage": true,
#     "uploadedImage": { ... }
#   }
# }

# ============================================
# TESTING INSTRUCTIONS:
# ============================================

# 1. Replace '/path/to/your/test-image.jpg' with actual image file path
# 2. Make sure you have a valid order ID (get one from checkout test)
# 3. Use a valid email address that you can check
# 4. The order status can be: Pending, Confirmed, Manufacturing, Quality Check, Shipped, Delivered, etc.

# ============================================
# AUTOMATED TEST SCRIPT:
# ============================================

# Create a simple test image if you don't have one:
# echo "Creating test image..."
# convert -size 300x200 xc:lightblue -pointsize 20 -draw "text 50,100 'Order Status Image'" test-status-image.jpg

# Or use any existing image file from your system
