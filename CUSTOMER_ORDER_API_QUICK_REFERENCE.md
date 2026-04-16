# Customer Order API - Quick Reference

## 📋 Overview
Customer-facing API for authenticated users to view and track their orders.

---

## 🔐 Authentication
All endpoints require JWT Bearer token:
```
Authorization: Bearer <token>
```

---

## 🚀 Quick Start

### 1. Get All Orders
```bash
GET /api/customer/orders?page=1&limit=10
```

### 2. Get Order Details
```bash
GET /api/customer/orders/:orderId
```

### 3. Get Tracking Info
```bash
GET /api/customer/orders/:orderId/tracking
```

### 4. Get Invoice
```bash
GET /api/customer/orders/:orderId/invoice
```

### 5. Get Statistics
```bash
GET /api/customer/orders/stats/summary
```

---

## 📊 Response Structure

### Order List Response
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalOrders": 25,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### Order Details Response
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-12345",
    "status": "Manufacturing",
    "products": [...],
    "progress": [...],
    "currentStep": {...},
    "nextStep": {...},
    "total": 1350.00,
    "formattedTotal": "$1,350.00",
    "tracking": {...},
    "shippingAddress": {...},
    "payment": {...}
  }
}
```

---

## 🔄 Order Status Flow

```
Pending → Confirmed → Manufacturing → Quality Assurance → Out For Delivery → Delivered
                                    ↓
                               Cancelled (possible at any stage)
```

---

## 📦 Product Details Included

Each product includes:
- ✅ Title, description, category
- ✅ Material and metal information
- ✅ Pricing (price at time of order)
- ✅ Images and thumbnails
- ✅ Quantity and totals
- ✅ Engraving details (if applicable)
- ✅ Selected variations

---

## 🎯 Filtering & Sorting

### Filter by Status
```bash
GET /api/customer/orders?status=Delivered
GET /api/customer/orders?status=Pending
GET /api/customer/orders?status=Manufacturing
```

### Pagination
```bash
GET /api/customer/orders?page=2&limit=20
```

### Sorting
```bash
GET /api/customer/orders?sortBy=total&sortOrder=desc
GET /api/customer/orders?sortBy=createdOn&sortOrder=asc
```

---

## 🚚 Tracking Information

Available when order status is "Out For Delivery":
- Tracking ID
- Tracking link (clickable URL to carrier)
- Carrier name
- Shipped date
- Estimated delivery date
- Shipping address

---

## 📈 Progress Tracking

Each order includes:
- **Progress array** - All completed steps
- **Current step** - Latest completed milestone
- **Next step** - What's coming next
- **Progress percentage** - Overall completion (0-100%)
- **Step icons** - Visual indicators (✅ 🔨 🔍 🚚 📦)

---

## 💰 Pricing Breakdown

All orders include:
- **Subtotal** - Product costs
- **Discount** - Any discounts applied
- **Shipping** - Delivery charges
- **Tax** - Applicable taxes
- **Total** - Final amount
- **Formatted values** - Currency-formatted strings

---

## 📱 Frontend Integration

### React Example
```javascript
// Fetch orders
const orders = await fetch('/api/customer/orders', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// Get order details
const order = await fetch(`/api/customer/orders/${orderId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// Track order
const tracking = await fetch(`/api/customer/orders/${orderId}/tracking`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());
```

---

## ✨ Key Features

✅ **Automatic Currency Formatting** - All prices formatted with symbols  
✅ **Rich Product Data** - Complete product information with images  
✅ **Progress Visualization** - Step-by-step order tracking  
✅ **Secure Access** - Users can only see their own orders  
✅ **Pagination Support** - Handle large order histories  
✅ **Image Support** - Product images and manufacturing photos  
✅ **Invoice Access** - Direct invoice download links  
✅ **Real-time Status** - Current order status and next steps  

---

## 🛡️ Security

- ✅ JWT authentication required for all endpoints
- ✅ Users can only access their own orders
- ✅ Automatic ownership verification
- ✅ Limited payment information exposure
- ✅ Secure token validation

---

## 🧪 Testing

Use the Postman collection:
```
Celora_Complete_API.postman_collection.json
```

Includes:
- All customer order endpoints
- Automatic token management
- Test assertions
- Example requests

---

## 📞 Support

For questions or issues:
- 📧 Email: support@celorajewelry.com
- 📚 Full Docs: `CUSTOMER_ORDER_API_GUIDE.md`
- 🔧 API Status: `GET /api/status`

---

## 🎨 Example Use Cases

### 1. Order History Page
```bash
GET /api/customer/orders?page=1&limit=10&sortBy=createdOn&sortOrder=desc
```

### 2. Order Details Page
```bash
GET /api/customer/orders/ORD-12345
```

### 3. Track My Order
```bash
GET /api/customer/orders/ORD-12345/tracking
```

### 4. Active Orders Dashboard
```bash
GET /api/customer/orders?status=Manufacturing
GET /api/customer/orders?status=Out For Delivery
```

### 5. Order Statistics Widget
```bash
GET /api/customer/orders/stats/summary
```

---

## 🔑 Environment Variables

Ensure these are set in Postman:
- `base_url` - API base URL (http://localhost:3000)
- `auth_token` - Customer JWT token
- `order_id` - Order ID for testing

---

## ⚡ Performance Tips

1. Use pagination for large order lists
2. Cache order details client-side
3. Implement infinite scroll for better UX
4. Show loading states during API calls
5. Handle errors gracefully

---

**Last Updated:** November 13, 2025  
**API Version:** 1.0  
**Status:** ✅ Production Ready
