# 🚀 Order API - Quick Reference Card

## Two APIs Available

### 🌐 PUBLIC (No Login) - `/api/public`
**For anyone with Order ID**

```bash
# Full tracking (needs email)
POST /api/public/track-order
Body: { "orderId": "ORD-123", "email": "customer@email.com" }

# Quick status (no email)
GET /api/public/track-order/ORD-123
```

**Use when:**
- Customer wants to track without login
- Email tracking links
- Guest checkout follow-up

---

### 🔐 AUTHENTICATED (Login Required) - `/api/customer/orders`
**For logged-in customers**

```bash
# All orders
GET /api/customer/orders?page=1&limit=10
Header: Authorization: Bearer <token>

# Order details
GET /api/customer/orders/ORD-123
Header: Authorization: Bearer <token>

# Tracking
GET /api/customer/orders/ORD-123/tracking
Header: Authorization: Bearer <token>

# Invoice
GET /api/customer/orders/ORD-123/invoice
Header: Authorization: Bearer <token>

# Statistics
GET /api/customer/orders/stats/summary
Header: Authorization: Bearer <token>
```

**Use when:**
- Customer dashboard
- Account "My Orders" page
- Full order history

---

## Quick Integration

### Public Tracking Page (No Auth)
```javascript
const response = await fetch('/api/public/track-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    orderId: 'ORD-12345', 
    email: 'customer@example.com' 
  })
});
const data = await response.json();
console.log('Status:', data.data.status);
console.log('Progress:', data.data.progressPercentage + '%');
```

### Customer Dashboard (With Auth)
```javascript
const response = await fetch('/api/customer/orders', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
console.log('Total Orders:', data.data.pagination.totalOrders);
```

---

## Response Structure

### Public API Returns:
```json
{
  "orderId": "ORD-12345",
  "status": "Manufacturing",
  "progress": [...],
  "progressPercentage": 40,
  "tracking": { "hasTracking": true, ... },
  "products": [...],
  "total": 1350.00
}
```

### Authenticated API Returns:
```json
{
  "orders": [...],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalOrders": 25
  }
}
```

---

## Key Differences

| Feature | Public | Authenticated |
|---------|--------|---------------|
| Login | ❌ No | ✅ Yes |
| Verification | Email | Token |
| Scope | 1 order | All orders |
| Filtering | ❌ | ✅ |
| Statistics | ❌ | ✅ |
| Invoice | ❌ | ✅ |

---

## Testing

**Postman:** Import `Celora_Complete_API.postman_collection.json`
- Public Order Tracking (4 requests)
- Customer Order API (7 requests)

---

## Documentation

📖 **Public API:** `PUBLIC_ORDER_TRACKING_API.md`  
📖 **Authenticated API:** `CUSTOMER_ORDER_API_GUIDE.md`  
📖 **Complete Summary:** `COMPLETE_ORDER_API_SUMMARY.md`

---

**Status:** ✅ Production Ready  
**Last Updated:** Nov 13, 2025
