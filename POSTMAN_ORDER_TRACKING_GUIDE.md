# Order Tracking API - Postman Collection Guide

## 📦 Collection File
**File**: `Order_Tracking_API.postman_collection.json`

## 🚀 Quick Start

### 1. Import Collection
1. Open Postman
2. Click **Import** button
3. Select `Order_Tracking_API.postman_collection.json`
4. Collection will appear in your sidebar

### 2. Configure Variables

The collection uses these variables (click on collection → Variables tab):

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3003` | Your backend API URL |
| `order_id` | `a9c58960-6c89-11f0-a2cf-a39f555992d0` | Test order ID from database |
| `customer_email` | `20bmiit076@gmail.com` | Test customer email |
| `auth_token` | _(empty)_ | JWT token for authenticated requests |

**Update these values** based on your environment:
- For production: Change `base_url` to your production URL
- For testing: Use real order IDs from your database

### 3. Get Authentication Token (For Authenticated Endpoints)

Before using authenticated endpoints, you need a JWT token:

1. **Login as Customer**:
   ```json
   POST {{base_url}}/api/auth/login
   Body:
   {
     "email": "20bmiit076@gmail.com",
     "password": "your_password"
   }
   ```

2. **Copy the token** from response
3. **Set variable**: Paste token into `auth_token` variable

## 📋 Collection Structure

### Folder 1: Public Order Tracking (No Auth) - 5 Requests

These endpoints **don't require authentication**:

#### 1️⃣ Track Order with Email
- **Method**: POST
- **Endpoint**: `/api/public/track-order`
- **Use**: Track order using Order ID + Email verification
- **Returns**: Full order details, progress, products, tracking

**Body**:
```json
{
  "orderId": "{{order_id}}",
  "email": "{{customer_email}}"
}
```

#### 2️⃣ Quick Status Check
- **Method**: GET
- **Endpoint**: `/api/public/track-order/{{order_id}}`
- **Use**: Get basic order status without email
- **Returns**: Limited info (status, progress %, delivery status)

#### 3️⃣ Track Order - Wrong Email (Test)
- **Purpose**: Test security - should fail with 403
- **Expected**: Email verification failed error

#### 4️⃣ Track Order - Invalid Order ID (Test)
- **Purpose**: Test validation - should fail with 404
- **Expected**: Order not found error

#### 5️⃣ Track Order with Currency Conversion
- **Method**: POST
- **Header**: `currency: EUR`
- **Use**: Get order details with currency conversion
- **Returns**: Prices converted to requested currency

---

### Folder 2: Customer Order API (Authenticated) - 7 Requests

These endpoints **require JWT Bearer token**:

#### 1️⃣ Get All My Orders
- **Method**: GET
- **Endpoint**: `/api/customer/orders`
- **Query Params**:
  - `page=1` - Page number
  - `limit=10` - Orders per page
  - `status=Confirmed` (optional) - Filter by status
  - `sortBy=createdOn` (optional) - Sort field
  - `sortOrder=desc` (optional) - Sort direction

#### 2️⃣ Get Order Details
- **Method**: GET
- **Endpoint**: `/api/customer/orders/{{order_id}}`
- **Returns**: Complete order details with products, addresses, progress

#### 3️⃣ Get Order Tracking
- **Method**: GET
- **Endpoint**: `/api/customer/orders/{{order_id}}/tracking`
- **Returns**: Tracking info, carrier, tracking number, delivery updates

#### 4️⃣ Get Order Invoice
- **Method**: GET
- **Endpoint**: `/api/customer/orders/{{order_id}}/invoice`
- **Returns**: Invoice URL

#### 5️⃣ Get Order Statistics
- **Method**: GET
- **Endpoint**: `/api/customer/orders/stats/summary`
- **Returns**: Total orders, breakdown by status, total spent, recent orders

#### 6️⃣ Filter Orders by Status
- **Method**: GET
- **Endpoint**: `/api/customer/orders?status=Confirmed`
- **Statuses**: Pending, Confirmed, Manufacturing, Quality Assurance, Out For Delivery, Delivered, Cancelled

#### 7️⃣ Sort Orders by Date
- **Method**: GET
- **Endpoint**: `/api/customer/orders?sortBy=createdOn&sortOrder=desc`
- **Sort Fields**: createdOn, total, status

---

## 🧪 Testing Workflow

### Test Public Endpoints (No Login Required)

1. **Update variables**:
   - Set `order_id` to a real order from your database
   - Set `customer_email` to the email associated with that order

2. **Run tests in order**:
   ```
   ✅ Quick Status Check          (Should work)
   ✅ Track Order with Email       (Should work)
   ❌ Track Order - Wrong Email    (Should fail - 403)
   ❌ Invalid Order ID             (Should fail - 404)
   ✅ Currency Conversion          (Should work)
   ```

### Test Authenticated Endpoints (Login Required)

1. **Get auth token**:
   - Login with customer credentials
   - Copy JWT token
   - Paste into `auth_token` variable

2. **Run tests**:
   ```
   ✅ Get All My Orders            (Lists all orders)
   ✅ Get Order Details            (Full order info)
   ✅ Get Order Tracking           (Tracking details)
   ✅ Get Order Invoice            (Invoice URL)
   ✅ Get Order Statistics         (Summary stats)
   ✅ Filter Orders by Status      (Filtered list)
   ✅ Sort Orders by Date          (Sorted list)
   ```

---

## 🎯 Common Use Cases

### Use Case 1: Guest Customer Tracking Order
**User**: Customer who checked out as guest (no account)

**Steps**:
1. Customer receives order confirmation email with Order ID
2. Use **"Track Order with Email"** request
3. Provide Order ID + Email used during checkout
4. View order status, progress, and tracking

**Endpoint**: `POST /api/public/track-order`

---

### Use Case 2: Quick Order Status Check
**User**: Anyone with Order ID (e.g., from tracking link)

**Steps**:
1. Use **"Quick Status Check"** request
2. Only provide Order ID in URL
3. Get basic status (limited info for privacy)

**Endpoint**: `GET /api/public/track-order/:orderId`

---

### Use Case 3: Logged-In Customer Viewing All Orders
**User**: Registered customer with account

**Steps**:
1. Login to get JWT token
2. Use **"Get All My Orders"** request
3. View paginated list of all orders
4. Filter or sort as needed

**Endpoint**: `GET /api/customer/orders`

---

### Use Case 4: Customer Viewing Specific Order
**User**: Logged-in customer

**Steps**:
1. Use **"Get Order Details"** request
2. Provide Order ID
3. View complete order information

**Endpoint**: `GET /api/customer/orders/:orderId`

---

## 🔧 Environment Setup

### Local Development
```
base_url: http://localhost:3003
```

### Production
```
base_url: https://api.celorajewelry.com
```

### Test Real Data

To test with real data from your database:

1. **Find a real order**:
   ```bash
   node get-complete-order.js
   ```

2. **Update variables**:
   - Copy the `orderId` from output
   - Copy the `email` from customerData
   - Paste into Postman variables

3. **Run requests**!

---

## 📊 Response Examples

### Public Track Order Response
```json
{
  "success": true,
  "data": {
    "orderId": "a9c58960-6c89-11f0-a2cf-a39f555992d0",
    "status": "Confirmed",
    "paymentStatus": "paid",
    "total": 1500,
    "formattedTotal": "$1,500.00",
    "currency": "USD",
    "progressPercentage": 20,
    "progress": [
      {
        "step": 1,
        "label": "Order Confirmed",
        "icon": "✅",
        "completed": true,
        "date": "2025-07-29T14:38:28.879Z",
        "status": "Payment confirmed successfully"
      },
      // ... 4 more steps
    ],
    "products": [ /* product details */ ],
    "tracking": { /* tracking info if available */ },
    "shippingLocation": {
      "city": "New York",
      "state": "NY",
      "country": "USA"
    }
  }
}
```

### Quick Status Response
```json
{
  "success": true,
  "data": {
    "orderId": "a9c58960-6c89-11f0-a2cf-a39f555992d0",
    "status": "Confirmed",
    "statusMessage": "Your order has been confirmed",
    "progressPercentage": 20,
    "lastUpdated": "2025-07-29T14:38:28.880Z",
    "isDelivered": false,
    "hasTracking": false
  }
}
```

---

## ✅ Built-in Tests

Each request includes automated tests:

- ✅ Status code validation (200, 403, 404)
- ✅ Response structure validation
- ✅ Data type checks
- ✅ Error message validation

**View test results** in the **Test Results** tab after running each request.

---

## 🔐 Security Notes

### Public Endpoints
- Email verification required for full details
- Limited info without email verification
- Case-insensitive email matching
- No authentication needed

### Authenticated Endpoints
- Require valid JWT Bearer token
- Customer can only view their own orders
- Token expires based on JWT_SECRET settings

---

## 🚨 Troubleshooting

### Error: "Order not found"
- ✅ Check Order ID is correct
- ✅ Verify order exists in database
- ✅ Run `node get-complete-order.js` to find valid order

### Error: "Email verification failed"
- ✅ Check email matches order's customerData.email
- ✅ Email is case-insensitive but must be exact match
- ✅ Verify order has email in customerData

### Error: "Unauthorized" (401)
- ✅ Check auth_token is set correctly
- ✅ Token might be expired - login again
- ✅ Token format: Just the token, no "Bearer" prefix in variable

### Connection Refused
- ✅ Ensure backend server is running: `node src/app.js`
- ✅ Check base_url matches your server
- ✅ Verify port 3003 is correct

---

## 📚 Additional Resources

- **API Documentation**: See `PUBLIC_ORDER_TRACKING_API.md`
- **Test Results**: See `PUBLIC_ORDER_TRACKING_TEST_RESULTS.md`
- **Implementation Guide**: See `CUSTOMER_ORDER_API_GUIDE.md`

---

## 🎉 Ready to Use!

The collection is production-ready with:
- ✅ Real database validation
- ✅ Comprehensive tests
- ✅ Error handling
- ✅ Currency conversion support
- ✅ Security validation

Import and start testing! 🚀
