# Clear Cart API Documentation

## Overview
The cart system provides multiple ways to clear a user's cart, offering flexibility for different use cases.

## Endpoints

### 1. Clear Cart (Primary Method)
**DELETE** `/api/cart/clear`

Clears all items from the cart. Requires at least one identifier (sessionId or userId).

#### Request Body
```json
{
  "sessionId": "string",  // Optional if userId provided
  "userId": "string"      // Optional if sessionId provided
}
```

#### Response (Success)
```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "cartId": "d27bb000-a447-11f0-a57b-71621b683123",
  "sessionId": "clear-test-session",
  "userId": "68b46ba64d06b352140da590",
  "itemsCleared": 3,
  "couponRemoved": true,
  "cart": {
    "_id": "68e66232657cd9a0542e1b4f",
    "sessionId": "clear-test-session",
    "userId": "68b46ba64d06b352140da590",
    "items": [],
    "summary": {
      "subtotal": 0,
      "total": 0,
      "itemCount": 0,
      "totalItems": 0,
      "hasItems": false
    }
  }
}
```

#### Example cURL Commands

**Clear by sessionId and userId:**
```bash
curl -X DELETE 'http://localhost:3000/api/cart/clear' \
--header 'Content-Type: application/json' \
--data '{
  "sessionId": "your-session-id",
  "userId": "your-user-id"
}'
```

**Clear by userId only:**
```bash
curl -X DELETE 'http://localhost:3000/api/cart/clear' \
--header 'Content-Type: application/json' \
--data '{
  "userId": "68b46ba64d06b352140da590"
}'
```

**Clear by sessionId only:**
```bash
curl -X DELETE 'http://localhost:3000/api/cart/clear' \
--header 'Content-Type: application/json' \
--data '{
  "sessionId": "clear-test-session"
}'
```

---

### 2. Clear Cart by User (Alternative Method)
**POST** `/api/cart/clear-by-user`

Simplified endpoint to clear cart by userId only.

#### Request Body
```json
{
  "userId": "string"  // Required
}
```

#### Response (Success)
```json
{
  "success": true,
  "message": "Cart cleared successfully",
  "itemsCleared": 3,
  "userId": "68b46ba64d06b352140da590"
}
```

#### Example cURL Command
```bash
curl -X POST 'http://localhost:3000/api/cart/clear-by-user' \
--header 'Content-Type: application/json' \
--data '{
  "userId": "68b46ba64d06b352140da590"
}'
```

---

## Error Responses

### 400 Bad Request
**No identifiers provided:**
```json
{
  "error": "At least one of sessionId or userId is required"
}
```

### 404 Not Found
**Cart not found:**
```json
{
  "error": "Cart not found",
  "message": "No active cart found for the provided identifiers"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "Error details here"
}
```

---

## What Gets Cleared

When clearing a cart, the following are removed:

1. ✅ **All cart items** - `items` array is emptied
2. ✅ **Applied coupons** - `coupon` is removed
3. ✅ **Pending checkout sessions** - `pendingCheckoutSessionId` is cleared
4. ✅ **Updated timestamp** - `updatedOn` is set to current time

**The cart document itself is NOT deleted**, only emptied.

---

## Use Cases

### Frontend Checkout Flow
After successful payment, clear the cart:
```javascript
const clearCart = async (userId, sessionId) => {
  const response = await fetch('http://localhost:3000/api/cart/clear', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, sessionId })
  });
  return response.json();
};
```

### User Logout
Clear cart when user logs out (optional):
```javascript
const clearCartOnLogout = async (userId) => {
  const response = await fetch('http://localhost:3000/api/cart/clear-by-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  return response.json();
};
```

### Admin/Support Operations
Clear a specific user's cart:
```bash
curl -X POST 'http://localhost:3000/api/cart/clear-by-user' \
--header 'Content-Type: application/json' \
--data '{ "userId": "USER_ID_HERE" }'
```

---

## Testing the API

### Complete Test Flow

1. **Add items to cart:**
```bash
curl --location 'http://localhost:3000/api/cart/add' \
--header 'Content-Type: application/json' \
--data '{
  "sessionId": "test-session-123",
  "userId": "68b46ba64d06b352140da590",
  "productId": "68b2bb00fd8bd653d20313eb",
  "quantity": 2,
  "price": 500.00
}'
```

2. **Verify cart has items:**
```bash
curl 'http://localhost:3000/api/cart/68b46ba64d06b352140da590?sessionId=test-session-123'
```

3. **Clear the cart:**
```bash
curl -X DELETE 'http://localhost:3000/api/cart/clear' \
--header 'Content-Type: application/json' \
--data '{
  "sessionId": "test-session-123",
  "userId": "68b46ba64d06b352140da590"
}'
```

4. **Verify cart is empty:**
```bash
curl 'http://localhost:3000/api/cart/68b46ba64d06b352140da590?sessionId=test-session-123'
```

---

## Notes

- ✅ Both endpoints require the cart to be **not checked out** (`isCheckedOut: false`)
- ✅ The cart document persists after clearing (can be reused)
- ✅ Clearing removes all items, coupons, and pending checkout sessions
- ✅ Either `sessionId` or `userId` (or both) can be used for identification
- ✅ The `clear-by-user` endpoint is a convenience method for userId-only clearing
