# Customer Order API Guide

## Overview
This API provides authenticated customers with comprehensive access to view their orders, track shipments, and access order details.

## Base URL
```
http://localhost:3000/api/customer/orders
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### 1. Get All Customer Orders
Get a paginated list of all orders for the authenticated customer.

**Endpoint:** `GET /api/customer/orders`

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 10) - Items per page
- `status` (optional) - Filter by order status
  - Values: `Pending`, `Confirmed`, `Manufacturing`, `Quality Assurance`, `Out For Delivery`, `Delivered`, `Cancelled`
- `sortBy` (optional, default: `createdOn`) - Field to sort by
- `sortOrder` (optional, default: `desc`) - Sort order (`asc` or `desc`)

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/customer/orders?page=1&limit=10&status=Delivered" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "orderId": "ORD-12345",
        "status": "Delivered",
        "paymentStatus": "paid",
        "total": 1500.00,
        "formattedTotal": "$1,500.00",
        "productCount": 2,
        "createdOn": "2025-11-10T10:30:00Z",
        "updatedOn": "2025-11-12T15:45:00Z",
        "orderDate": "11/10/2025",
        "currentStep": {
          "step": "delivered",
          "title": "Delivered",
          "status": "completed",
          "icon": "📦"
        },
        "progressPercentage": 100,
        "isDelivered": true,
        "canTrack": true,
        "thumbnail": "https://example.com/product-image.jpg"
      }
    ],
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

---

### 2. Get Order Details
Get comprehensive details about a specific order.

**Endpoint:** `GET /api/customer/orders/:orderId`

**Path Parameters:**
- `orderId` (required) - The order ID

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/customer/orders/ORD-12345" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-12345",
    "referenceId": "REF-67890",
    "status": "Manufacturing",
    "paymentStatus": "paid",
    "createdOn": "2025-11-10T10:30:00Z",
    "updatedOn": "2025-11-12T15:45:00Z",
    "orderDate": "November 10, 2025",
    
    "products": [
      {
        "id": "prod_123",
        "title": "Diamond Engagement Ring",
        "description": "18K white gold engagement ring with 1.5ct diamond",
        "category": "Rings",
        "material": "18K White Gold",
        "quantity": 1,
        "price": 1200.00,
        "formattedPrice": "$1,200.00",
        "total": 1200.00,
        "formattedTotal": "$1,200.00",
        "images": [
          "https://example.com/ring-1.jpg",
          "https://example.com/ring-2.jpg"
        ],
        "primaryImage": "https://example.com/ring-1.jpg",
        "type": "jewelry",
        "engraving": {
          "text": "Forever & Always",
          "type": "Text",
          "location": "Inside Band",
          "cost": 50.00,
          "status": "Completed"
        },
        "selectedMetal": "18K White Gold",
        "selectedVariation": "Size 7"
      }
    ],
    "productCount": 1,
    "hasMultipleProducts": false,
    
    "subtotal": 1200.00,
    "formattedSubtotal": "$1,200.00",
    "discount": 0,
    "formattedDiscount": "$0.00",
    "shippingCost": 50.00,
    "formattedShippingCost": "$50.00",
    "tax": 100.00,
    "formattedTax": "$100.00",
    "total": 1350.00,
    "formattedTotal": "$1,350.00",
    "currency": "USD",
    
    "progress": [
      {
        "step": "confirmed",
        "title": "Order Confirmed",
        "status": "completed",
        "date": "2025-11-10T10:35:00Z",
        "description": "Your order has been confirmed and payment received",
        "icon": "✅"
      },
      {
        "step": "manufacturing",
        "title": "Manufacturing",
        "status": "completed",
        "date": "2025-11-11T09:00:00Z",
        "description": "Your jewelry is being crafted with care",
        "icon": "🔨",
        "images": [
          "https://example.com/manufacturing-1.jpg",
          "https://example.com/manufacturing-2.jpg"
        ]
      }
    ],
    "currentStep": {
      "step": "manufacturing",
      "title": "Manufacturing"
    },
    "nextStep": {
      "step": "qualityAssurance",
      "title": "Quality Assurance",
      "description": "Final inspection and polishing"
    },
    "progressPercentage": 40,
    "isDelivered": false,
    
    "tracking": null,
    
    "shippingAddress": {
      "name": "John Doe",
      "address": "123 Main St",
      "apartment": "Apt 4B",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA",
      "fullAddress": "123 Main St, Apt 4B, New York, NY 10001, USA"
    },
    
    "billingAddress": {
      "name": "John Doe",
      "address": "123 Main St",
      "apartment": "Apt 4B",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA",
      "fullAddress": "123 Main St, Apt 4B, New York, NY 10001, USA"
    },
    
    "payment": {
      "method": "card",
      "status": "paid",
      "amountPaid": 1350.00,
      "formattedAmountPaid": "$1,350.00",
      "currency": "USD",
      "paidAt": "2025-11-10T10:32:00Z"
    },
    
    "invoiceUrl": "/invoices/invoice-123.pdf",
    "hasInvoice": true,
    "customerNotes": "Please handle with care",
    "specialInstructions": "Gift wrap requested"
  }
}
```

---

### 3. Get Order Tracking
Get tracking information for a shipped order.

**Endpoint:** `GET /api/customer/orders/:orderId/tracking`

**Path Parameters:**
- `orderId` (required) - The order ID

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/customer/orders/ORD-12345/tracking" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-12345",
    "status": "Out For Delivery",
    "trackingId": "TRACK123456789",
    "trackingLink": "https://tracking.carrier.com/TRACK123456789",
    "carrier": "FedEx",
    "shippedDate": "2025-11-12T08:00:00Z",
    "estimatedDelivery": "November 15, 2025",
    "shippingAddress": {
      "city": "New York",
      "state": "NY",
      "country": "USA"
    },
    "isDelivered": false,
    "deliveredDate": null
  }
}
```

**Error Response (Not Shipped Yet):**
```json
{
  "success": false,
  "error": "Order has not been shipped yet",
  "message": "Tracking information will be available once the order is shipped"
}
```

---

### 4. Get Order Invoice
Get invoice URL for an order.

**Endpoint:** `GET /api/customer/orders/:orderId/invoice`

**Path Parameters:**
- `orderId` (required) - The order ID

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/customer/orders/ORD-12345/invoice" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-12345",
    "invoiceUrl": "/invoices/invoice-123.pdf",
    "paymentStatus": "paid"
  }
}
```

**Error Response (Invoice Not Available):**
```json
{
  "success": false,
  "error": "Invoice not available",
  "message": "Invoice will be generated after payment confirmation"
}
```

---

### 5. Get Order Statistics
Get summary statistics about customer's orders.

**Endpoint:** `GET /api/customer/orders/stats/summary`

**Example Request:**
```bash
curl -X GET "http://localhost:3000/api/customer/orders/stats/summary" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalOrders": 25,
      "pendingOrders": 3,
      "deliveredOrders": 20,
      "totalSpent": 12500.50,
      "formattedTotalSpent": "$12,500.50"
    },
    "recentOrders": [
      {
        "orderId": "ORD-12345",
        "status": "Delivered",
        "total": 1500.00,
        "formattedTotal": "$1,500.00",
        "orderDate": "11/10/2025"
      },
      {
        "orderId": "ORD-12344",
        "status": "Manufacturing",
        "total": 800.00,
        "formattedTotal": "$800.00",
        "orderDate": "11/08/2025"
      }
    ]
  }
}
```

---

## Order Status Flow

Orders follow this progression:

1. **Pending** - Order created, awaiting payment
2. **Confirmed** - Payment received, order confirmed
3. **Manufacturing** - Item is being crafted
4. **Quality Assurance** - Final inspection and quality check
5. **Out For Delivery** - Order shipped and in transit
6. **Delivered** - Order successfully delivered
7. **Cancelled** - Order cancelled (can happen at any stage)

---

## Progress Tracking

Each order includes a `progress` array showing completed steps:

```json
{
  "progress": [
    {
      "step": "confirmed",
      "title": "Order Confirmed",
      "status": "completed",
      "date": "2025-11-10T10:35:00Z",
      "icon": "✅"
    }
  ],
  "currentStep": { /* Latest completed step */ },
  "nextStep": { /* Next expected step */ },
  "progressPercentage": 40 // 40% complete (2 of 5 steps)
}
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed explanation (optional)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid or missing token)
- `404` - Not Found (order doesn't exist or doesn't belong to user)
- `500` - Internal Server Error

---

## Security Notes

1. **Authentication Required** - All endpoints require valid JWT token
2. **User Isolation** - Customers can only access their own orders
3. **Automatic Verification** - System automatically verifies order ownership
4. **Limited Payment Info** - Sensitive payment details are not exposed

---

## Usage Examples

### Frontend Integration Example (React)

```javascript
// Get all orders
const fetchOrders = async (page = 1) => {
  const response = await fetch(
    `http://localhost:3000/api/customer/orders?page=${page}&limit=10`,
    {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }
  );
  const data = await response.json();
  return data;
};

// Get order details
const fetchOrderDetails = async (orderId) => {
  const response = await fetch(
    `http://localhost:3000/api/customer/orders/${orderId}`,
    {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }
  );
  const data = await response.json();
  return data;
};

// Get tracking info
const fetchTracking = async (orderId) => {
  const response = await fetch(
    `http://localhost:3000/api/customer/orders/${orderId}/tracking`,
    {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    }
  );
  const data = await response.json();
  return data;
};
```

---

## Testing

Use the updated Postman collection `Celora_Complete_API.postman_collection.json` which includes all customer order endpoints with proper authentication and test cases.

---

## Support

For issues or questions, please refer to:
- API Documentation: `/api/swagger`
- Support: support@celorajewelry.com
