# Cart to Order Flow - Simple Guide

## 📋 Quick Overview

**Cart** → Add Items → Apply Coupon → **Checkout** → Payment → **Order Created**

---

## 1️⃣ Cart - What is Stored?

```
CART CONTAINS:
├─ cartId (unique ID)
├─ userId (who owns it)
├─ currency (USD or INR)
├─ items (products added)
│  └─ Each item has:
│     ├─ productId (which product)
│     ├─ quantity (how many)
│     ├─ price (locked when added)
│     ├─ variations (metal, ring size, diamond specs)
│     └─ engraving (if any)
├─ coupon (discount code applied)
└─ status (checked out or not)
```

**Simple Example:**
```
Cart ID: cart-123
User: john@example.com
Currency: USD

Items in Cart:
  1. Diamond Pendant ($6,387) × 1 = $6,387
  2. Diamond Bracelet ($1,210) × 1 = $1,210

Subtotal: $7,597
Coupon (SAVE20): -$1,519
Tax (18%): +$1,100
TOTAL: $7,178
```

---

## 2️⃣ Adding Items to Cart - Simple Steps

### What to Send from Frontend:
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "quantity": 1,
  "metalType": "18K Gold",           // Optional: which metal
  "ringSize": "7",                   // Optional: ring size
  "diamondShape": "Round",           // Optional: diamond shape
  "carats": 1.5                      // Optional: carat weight
}
```

### What Happens:
1. ✅ Check if product exists
2. ✅ Get product price
3. ✅ Add custom variations if any
4. ✅ Save to cart
5. ✅ Send back updated cart

### What You Get Back:
```
Success! Item added.

Cart now has:
- 1 Diamond Pendant ($6,387)
- Subtotal: $6,387
- Total: $6,387
```

---

## 3️⃣ Coupons & Discounts

### Types of Discounts:

**1. Flat Discount** (Fixed amount)
```
Code: SAVE100
✓ Save fixed $100
✓ Works: Subtotal $500+

Subtotal: $1000
Discount: -$100
Total: $900
```

**2. Percentage Discount** (Percent off)
```
Code: SAVE20
✓ Save 20% of total
✓ Works: Subtotal $200+

Subtotal: $1000
Discount: -$200 (20% off)
Total: $800
```

**3. Category Discount** (Specific product type)
```
Code: RING15
✓ 15% off rings only
✓ Does NOT apply to earrings/bracelets

Cart:
- Ring A: $500 (apply 15% = -$75) ✓
- Earrings B: $300 (no discount) ✗

Total Discount: $75
```

### How to Apply Coupon:

**Frontend sends:**
```json
{
  "couponCode": "SAVE20"
}
```

**Backend:**
1. Check if coupon exists
2. Check if coupon is active
3. Check if cart qualifies (minimum amount, category match, etc.)
4. Calculate discount amount
5. Update cart

**Response:**
```
Coupon Applied! ✓

Code: SAVE20
Type: Percentage (20% off)
Discount: -$200

New Total: $800 (was $1000)
```

### Remove Coupon:

Just send "remove coupon" request → discount goes away → total updates.

---

## 4️⃣ Cart Math - How Prices Are Calculated

### Simple Formula:

```
STEP 1: Add up all items
  Product 1: $6,387 × 1 = $6,387
  Product 2: $1,210 × 1 = $1,210
  SUBTOTAL = $7,597

STEP 2: Apply coupon discount
  IF SAVE20 coupon:
    Discount = $7,597 × 20% = $1,519
  ELSE:
    Discount = 0

STEP 3: Add tax (only at checkout)
  Tax = (Subtotal - Discount) × 18%
      = ($7,597 - $1,519) × 18%
      = $6,078 × 18%
      = $1,094

STEP 4: Final total
  TOTAL = Subtotal - Discount + Tax
        = $7,597 - $1,519 + $1,094
        = $7,172
```

### What Frontend Sees:

**In Cart:**
```
Subtotal: $7,597
Discount: -$1,519 (SAVE20 coupon)
─────────────────
Subtotal After Discount: $6,078
Tax: (calculated at checkout)
─────────────────
TOTAL WILL BE: ~$7,172
```

**At Checkout:**
```
Subtotal: $7,597
Discount: -$1,519
Tax (18%): +$1,094
─────────────────
TOTAL: $7,172
```

---

## 5️⃣ Checkout - Creating an Order

### Step 1: User Clicks "Pay Now"

Frontend sends card information:
```json
{
  "cardNumber": "4242424242424242",
  "expiryMonth": "12",
  "expiryYear": "2025",
  "cvv": "123",
  "cardholderName": "John Doe",
  "currency": "usd"
}
```

### Step 2: Backend Validates Cart

✓ Cart exists and has items
✓ Cart not already checked out
✓ Total amount is valid

### Step 3: Process Payment

1. Convert total to cents: $7,172 → 717,200 cents
2. Send to Stripe
3. Get response: SUCCESS or FAILED

**If FAILED:** Show error, don't create order
**If SUCCESS:** Continue to Step 4

### Step 4: Create Order

Backend takes everything from cart and converts it to an order:

```
From Cart:
- Item 1: Diamond Pendant
- Item 2: Diamond Bracelet
- Coupon: SAVE20 (-$1,519)
- Total: $7,172

Creates Order:
✓ Order ID: ORD-123456
✓ All items included
✓ Discount applied
✓ Payment proof stored
✓ Delivery date calculated
```

### Step 5: Response to User

```json
{
  "success": true,
  "orderId": "ORD-123456",
  "total": 7172,
  "currency": "USD",
  "estimatedDelivery": "April 13, 2026",
  "message": "Order created! You will receive confirmation email."
}
```

### Step 6: Mark Cart as Used

Cart gets marked as "checked out" so user can't reuse it.

---

## 6️⃣ Order - What Gets Saved?

### Order Contains:

```
ORDER DETAILS:
├─ orderId: "ORD-123456"
├─ customer: user ID
├─ date: when ordered
│
├─ PRODUCTS (copied from cart):
│  ├─ Product 1: Diamond Pendant
│  │  ├─ Quantity: 1
│  │  ├─ Price: $6,387
│  │  ├─ Images: (full gallery)
│  │  └─ Slug: "diamond-pendant"
│  └─ Product 2: Diamond Bracelet
│     ├─ Quantity: 1
│     ├─ Price: $1,210
│     └─ Images: (full gallery)
│
├─ PRICING:
│  ├─ Subtotal: $7,597
│  ├─ Discount: -$1,519
│  ├─ Tax: +$1,094
│  └─ Total: $7,172
│
├─ DELIVERY:
│  ├─ Estimated Days: 14
│  └─ Expected Date: April 13, 2026
│
├─ PAYMENT PROOF:
│  ├─ Method: Card
│  ├─ Amount Paid: $7,172
│  ├─ Currency: USD
│  ├─ Stripe ID: ch_xxxxx
│  └─ Status: Paid
│
├─ ADDRESS:
│  ├─ Billing Address
│  └─ Shipping Address
│
├─ SUB-ORDERS (for tracking each item):
│  ├─ SubOrder 1 (Diamond Pendant):
│  │  ├─ Status: Pending
│  │  ├─ Can be updated independently
│  │  └─ Tracking: (updated when shipped)
│  └─ SubOrder 2 (Diamond Bracelet):
│     ├─ Status: Pending
│     └─ Tracking: (updated when shipped)
│
└─ STATUS: Confirmed, Ready for Processing
```

---

## 7️⃣ Admin Dashboard - Managing Orders

### What Admin Can Do:

#### 1. View All Orders
```
Filter by:
- Status (Pending, Confirmed, Shipped, Delivered)
- Date (from/to)
- Currency (USD, INR)
- Search by order ID

Shows: Order list with customer, total, date, status
```

#### 2. Update Order Status
```
Current: Pending
Change to: Confirmed → Processing → Shipped → Delivered

Auto-alerts: Customer gets email notification
```

#### 3. Update Each Item Individually (SubOrder)
```
Each product in order can be tracked separately:

Diamond Pendant:
  Status: Manufacturing
  Added Notes: "Setting the stone, will be ready in 3 days"

Diamond Bracelet:
  Status: Confirmed
  Added Notes: "Waiting for materials"

Both can have DIFFERENT statuses at same time!
```

#### 4. Add Tracking Information
```
When item ships, add:
- Tracking ID: "TRACK-123456"
- Tracking Link: "https://track.com?id=123"
- Carrier: "FedEx"
- Estimated Delivery: "April 12"

Customer sees tracking link in order details
```

#### 5. Update Delivery Date
```
If delayed:
- Change estimated delivery date
- Add reason (e.g., "Custom work takes longer")
- Customer gets notified
```

#### 6. Apply Manual Discount
```
Issue found with ring (small scratch)?
Admin can:
- Add manual discount: -$500
- Add note: "Discount for small scratch on setting"
- Recalculate total
- Send updated invoice to customer
```

#### 7. Refund Order
```
Customer wants refund?
Admin can:
1. Process refund to original card
2. Mark order as "Refunded"
3. System sends automated email to customer

Total refunded: Full amount or partial
```

---

## 8️⃣ Cart Behaviors - How It Works

### Same Product Added Twice?

```
Cart has: Diamond Pendant (qty: 1)

Add the same Diamond Pendant again →

Result (usually):
Cart now has: Diamond Pendant (qty: 2)

But IF variations are different:
- First: 18K Gold, Ring Size 7
- Second: 14K Gold, Ring Size 8

Result:
Both saved separately as 2 different items
```

### Price Lock - The Most Important Rule!

```
TIME T1 (User adds to cart):
  Diamond Pendant costs: $6,387
  Cart saves: priceAtTime = 6,387

TIME T2 (Price changed to $8,000):
  Cart still shows: $6,387 (LOCKED PRICE)
  At checkout: Charged $6,387 (NOT $8,000)

Why? Price is locked when added. Never changes.
```

### Discount Auto-Apply

```
CART HAS:
- Ring ($500) ← matches category
- Earrings ($300) ← doesn't match

COUPON: "RING15" (15% off rings only)

RESULT:
- Ring discount: $500 × 15% = -$75 ✓
- Earrings discount: $0 ✗
- Total discount: -$75
```

### Tax Only at Checkout

```
CART VIEW:
Subtotal: $7,597
Discount: -$1,519
TAX: not shown
Total: $6,078

CHECKOUT (final):
Subtotal: $7,597
Discount: -$1,519
TAX: +$1,094 (18% GST)
Total: $7,172

Tax always calculated last!
```

### Currency Isolation

```
User views USD prices → Creates USD cart
User switches to INR → Creates NEW INR cart

Two separate carts exist!
USD Cart: Diamond = $6,387
INR Cart: Diamond = ₹523,734 (same product, converted)

Both saved, user can jump between them
```

---

## 9️⃣ Common API Calls

| What | How to Call |
|------|------------|
| **Add to cart** | `POST /api/cart/add-item` |
| **View cart** | `GET /api/cart/view-cart` |
| **Update quantity** | `PUT /api/cart/update-quantity` |
| **Remove item** | `DELETE /api/cart/remove-item/{itemId}` |
| **Apply coupon** | `POST /api/cart/apply-coupon` |
| **Remove coupon** | `POST /api/cart/remove-coupon` |
| **Checkout/Pay** | `POST /api/cart/checkout-with-payment` |
| **Empty cart** | `POST /api/cart/clear-cart` |
| **Get order** | `GET /api/orders/{orderId}` |
| **Admin: View all orders** | `GET /api/admin/orders` |
| **Admin: Update status** | `PUT /api/admin/orders/{orderId}/status` |
| **Admin: Update suborder** | `PUT /api/admin/orders/{orderId}/suborder/{subOrderId}` |
| **Admin: Refund** | `POST /api/admin/orders/{orderId}/refund` |

---

## 🎯 Key Takeaways

✅ **Cart** = Temporary holding area for items
✅ **Coupon** = Discount applied (various types)
✅ **Pricing** = Subtotal → Discount → Tax → Total
✅ **Checkout** = Validate cart → Process payment → Create order
✅ **Order** = Permanent record with payment proof
✅ **SubOrders** = Track each item independently
✅ **Admin** = Update status, add tracking, process refunds
✅ **Price Lock** = Never changes after item added to cart
✅ **Tax** = Only calculated at final checkout
✅ **Currency** = Separate carts for USD/INR

