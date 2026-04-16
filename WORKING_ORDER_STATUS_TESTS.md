# Order Status Update Testing Commands
# ===================================

# Valid Order Statuses:
# - Pending
# - Confirmed  
# - Manufacturing
# - Quality Assurance
# - Out For Delivery
# - Delivered
# - Cancelled

BASE_URL="http://localhost:3000"

# Test 1: Update to Manufacturing
curl -X PUT "${BASE_URL}/api/payments/update-order-status/7d963950-6b78-11f0-a17c-bf15209c08f5" \
  -F "newStatus=Manufacturing" \
  -F "statusMessage=Your jewelry is now being crafted by our skilled artisans" \
  -F "customerEmail=demo@yopmail.com"

# Test 2: Update to Quality Assurance  
curl -X PUT "${BASE_URL}/api/payments/update-order-status/7d963950-6b78-11f0-a17c-bf15209c08f5" \
  -F "newStatus=Quality Assurance" \
  -F "statusMessage=Your order is going through our quality assurance process" \
  -F "customerEmail=demo@yopmail.com"

# Test 3: Update to Out For Delivery
curl -X PUT "${BASE_URL}/api/payments/update-order-status/7d963950-6b78-11f0-a17c-bf15209c08f5" \
  -F "newStatus=Out For Delivery" \
  -F "statusMessage=Your order is out for delivery and will arrive soon" \
  -F "customerEmail=demo@yopmail.com"

# Test 4: Update to Delivered
curl -X PUT "${BASE_URL}/api/payments/update-order-status/7d963950-6b78-11f0-a17c-bf15209c08f5" \
  -F "newStatus=Delivered" \
  -F "statusMessage=Your order has been successfully delivered!" \
  -F "customerEmail=demo@yopmail.com"

# Test 5: With Image Upload (replace with actual image path)
curl -X PUT "${BASE_URL}/api/payments/update-order-status/7d963950-6b78-11f0-a17c-bf15209c08f5" \
  -F "newStatus=Manufacturing" \
  -F "statusMessage=Here's a photo of your jewelry being crafted" \
  -F "customerEmail=demo@yopmail.com" \
  -F "statusImage=@/path/to/your/test-image.jpg"

# Test 6: Simple Test Email (doesn't need real order)
curl -X POST "${BASE_URL}/api/payments/test-order-email" \
  -F "customerEmail=demo@yopmail.com" \
  -F "customerName=Test Customer" \
  -F "orderId=TEST-ORDER-123" \
  -F "newStatus=Delivered" \
  -F "statusMessage=Test order delivery confirmation!"

# Expected Success Response:
# {
#   "success": true,
#   "message": "Order status updated successfully and email sent",
#   "order": {
#     "orderId": "7d963950-6b78-11f0-a17c-bf15209c08f5",
#     "oldStatus": "Confirmed",
#     "newStatus": "Manufacturing",
#     "statusMessage": "Your jewelry is now being crafted...",
#     "customer": {
#       "email": "demo@yopmail.com",
#       "name": "demo"
#     },
#     "progress": {
#       "manufacturing": {
#         "date": "2025-07-28T06:19:01.651Z",
#         "manufacturingImages": []
#       }
#     },
#     "updatedOn": "2025-07-28T06:19:01.651Z"
#   },
#   "uploadedImage": null
# }
