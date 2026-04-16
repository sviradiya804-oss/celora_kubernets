# Celora Backend — Cart, Order & Sub-Order Flow

## Overview

```
Frontend → POST /api/cart/add  →  Cart (MongoDB)
                                       ↓
Frontend → POST /api/checkout/create-payment-intent-from-cart
                  OR POST /api/checkout-with-payment
                       ↓  (payment success)
                    Order created with subOrders[]
                       ↓
           Admin: PUT /api/orders/:orderId/suborder/:subOrderId/status
```

---

## 1. Add to Cart

**`POST /api/cart/add`**
Requires `Authorization: Bearer <JWT>` header.

### Request Body

```json
{
  "userId":      "64abc...",
  "sessionId":   "optional-uuid-v4",
  "productId":   "64def...",
  "quantity":    1,

  "selectedOptions": {
    "metaldetail": "64metal_id",
    "ringsize":    "7",
    "shape":       "64shape_id"
  },

  "diamondDetails": {
    "shape":        "Round",
    "carat":        1.01,
    "cut":          "Excellent",
    "clarity":      "VS1",
    "color":        "G",
    "diamondType":  "Natural",
    "lab":          false,
    "price":        3200,
    "markup_price": 4500
  },

  "engravingOptions": {
    "engravingText": "Forever Yours",
    "font":          "Script"
  },

  "ringsize": "7",
  "price":    4500
}
```

### diamondDetails Fields

| Field | Type | Description |
|---|---|---|
| `shape` | String | e.g. `"Round"`, `"Princess"`, `"Oval"` |
| `carat` | Number | Diamond carat weight |
| `cut` | String | e.g. `"Excellent"`, `"Very Good"` |
| `clarity` | String | e.g. `"VS1"`, `"SI2"` |
| `color` | String | e.g. `"G"`, `"H"` |
| `diamondType` | `"Natural"` \| `"Lab"` | Drives the pricing AND discount path |
| `lab` | Boolean | `false` = Natural, `true` = Lab |
| `price` | Number | Base diamond cost |
| `markup_price` | Number | Customer-facing price after markup |

### Pricing Logic (Two-Rule Engine)

```
Is category "engagement-rings"?
  YES → pricing.metalPricing[metalId].finalPrice.{natural|lab}
  NO  → addedDiamonds.selectedDiamonds[0].metalPricing[metalId].priceNatural|priceLab

diamondType is read from:
  1. item.diamondDetails.diamondType       ← user's actual selection (most specific)
  2. item.selectedVariant.selectedOptions.diamondType
  3. product.diamondType                   ← fallback only
```

### Response

```json
{
  "success": true,
  "message": "Item added to cart",
  "sessionId": "uuid-v4",
  "totalItems": 1,
  "cart": {
    "_id": "...",
    "items": [
      {
        "itemId":         "uuid-v4",
        "productId":      "64def...",
        "quantity":       1,
        "priceAtTime":    4500,
        "diamondDetails": { "shape": "Round", "carat": 1.01, "diamondType": "Natural" },
        "selectedVariant": { "selectedOptions": { "metaldetail": "...", "ringsize": "7" } },
        "engravingOptions": { "engravingText": "Forever Yours", "font": "Script" }
      }
    ],
    "summary": {
      "subtotal":             4500,
      "flatDiscountAmount":   0,
      "couponDiscountAmount": 0,
      "totalDiscount":        0,
      "total":                4500,
      "totalItems":           1,
      "appliedDiscounts":     []
    }
  }
}
```

---

## 2. Other Cart Endpoints

| Method | Path | Key Body Fields |
|---|---|---|
| `PUT` | `/api/cart/update` | `userId`, `sessionId`, `itemId` (preferred) or `productId`, `quantity`, `diamondDetails?`, `engravingOptions?` |
| `DELETE` | `/api/cart/remove` | `userId`, `sessionId`, `itemId` (preferred) or `productId` |
| `DELETE` | `/api/cart/clear` | `userId` or `sessionId` |
| `GET` | `/api/cart?userId=&sessionId=` | Returns cart + summary |

> **Important:** Always use `itemId` (returned when adding to cart) for update and remove — `productId` is only a fallback for old clients.

---

## 3. Checkout & Order Creation

### Flow A — Direct Charge (simpler / test-friendly)

**`POST /api/cart/checkout-with-payment`**

```json
{
  "userId":    "64abc...",
  "sessionId": "uuid-v4",
  "token":     "tok_visa"
}
```

- Charges cart total via Stripe Charges API
- Creates `Order` with `status: "Confirmed"`, `paymentStatus: "paid"`
- Returns `{ orderId, chargeId, amount }`

---

### Flow B — PaymentIntent (recommended for production)

**Step 1** — Create PaymentIntent from cart

`POST /api/checkout/create-payment-intent-from-cart`

```json
{ "sessionId": "uuid-v4", "userId": "64abc...", "currency": "usd" }
```

Response: `{ "clientSecret": "pi_..._secret_...", "paymentIntentId": "pi_...", "amount": 4500, "orderId": "ORD-uuid" }`

**Step 2** — Frontend confirms payment with Stripe Elements using `clientSecret`

**Step 3** — `POST /api/checkout/process-payment`

```json
{ "orderId": "ORD-uuid", "paymentMethodId": "pm_..." }
```

---

## 4. Order Structure

```json
{
  "orderId":              "ORD-uuid",
  "customer":             "userId_ObjectId",
  "status":               "Confirmed",
  "paymentStatus":        "paid",
  "total":                4500,
  "subtotal":             4500,
  "discount":             0,
  "expectedDeliveryDate": "2026-04-15T00:00:00Z",

  "products": [
    {
      "productId":   "64def...",
      "quantity":    1,
      "priceAtTime": 4500,
      "imageUrl":    "https://cdn.celora.com/ring.jpg",
      "productDetails": {
        "title":    "Aire Curvy Diamond Ring",
        "slug":     "aire-curvy-diamond-engagement-ring",
        "category": "engagement-rings",
        "cadCode":  "CAD-001",
        "images":   ["https://cdn.celora.com/ring.jpg"],
        "price":    4500
      },
      "engravingDetails": {
        "hasEngraving":    true,
        "engravingText":   "Forever Yours",
        "font":            "Script",
        "engravingStatus": "Pending"
      }
    }
  ],

  "subOrders": [
    {
      "subOrderId":  "uuid-v1",
      "productId":   "64def...",
      "quantity":    1,
      "priceAtTime": 4500,
      "status":      "Confirmed",
      "productDetails": {
        "slug":  "aire-curvy-diamond-engagement-ring",
        "title": "Aire Curvy Diamond Ring"
      },
      "progress": {
        "confirmed":        { "date": "2026-03-23T10:00:00Z", "confirmedImages": [] },
        "manufacturing":    { "date": null, "manufacturingImages": [] },
        "qualityAssurance": { "date": null, "qualityAssuranceImages": [] },
        "outForDelivery":   { "date": null, "trackingId": "", "trackingLink": "" },
        "delivered":        { "date": null }
      }
    }
  ],

  "paymentDetails": {
    "paymentMethod":         "card",
    "amountPaid":            4500,
    "currency":              "usd",
    "stripePaymentIntentId": "pi_..."
  }
}
```

> One sub-order is created per cart item. Each tracks status independently.

---

## 5. Sub-Order Status Flow

```
Pending → Confirmed → Manufacturing → Quality Assurance → Out For Delivery → Delivered
                                                                            ↘ Cancelled
```

### Update a Sub-Order

`PUT /api/orders/:orderId/suborder/:subOrderId/status`

```json
{
  "newStatus":    "Manufacturing",
  "images":       ["https://cdn.celora.com/progress1.jpg"],
  "trackingId":   "TRK123",
  "trackingLink": "https://shipper.com/track/TRK123"
}
```

- `images` — stored in `progress.*Images` for that stage
- `trackingId` / `trackingLink` — only used for `"Out For Delivery"`

> **Auto-escalation:** When all non-cancelled sub-orders reach `Delivered`, the main order automatically becomes `Delivered`.

### Update the Main Order

`PUT /api/orders/:orderId/status`

```json
{
  "newStatus":     "Manufacturing",
  "statusMessage": "Your ring is being crafted.",
  "images":        ["https://cdn.celora.com/workshop.jpg"]
}
```

---

## 6. Order Fetch Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/orders/user/:userId` | All orders for a user (newest first) |
| `GET` | `/api/orders/:orderId` | Full order with populated product details |
| `GET` | `/api/orders/:orderId/suborders` | All sub-orders for a given order |

---

## 7. Flat Discount System

Flat discounts are automatic — applied at cart summary time with no coupon code needed.

### Targeting Modes (`allowThisDiscount`)

| Mode | Field to set | How it works |
|---|---|---|
| `"all"` | — | Applies to every cart item |
| `"all"` + `discountCategory` | `discountCategory` | Applies only to items in that category |
| `"selectProducts"` | `selectedProductIds: [ObjectId]` | Applies only to listed product IDs |
| `"cadCode"` | `selectedCadCodes: ["CAD-001"]` | Applies only to products matching CAD code |

> Category comparison is **slug-normalised** — `"Engagement Rings"` and `"engagement-rings"` both match. Case and hyphens vs spaces are handled automatically.

### FlatDiscount Document Shape

```json
{
  "discountName":       "Spring Sale",
  "description":        "10% off all engagement rings",
  "status":             true,
  "allowThisDiscount":  "all",
  "discountCategory":   "Engagement Rings",
  "selectedProductIds": [],
  "selectedCadCodes":   [],
  "discountUnit":       "%",
  "naturalDiscount":    10,
  "labDiscount":        20,
  "minimumOrderValue":  500,
  "validTill":          "2026-12-31T00:00:00Z"
}
```

### Rules Applied at Checkout

1. `status: true` — discount must be active
2. `validTill` — if set, must be today or future (expired discounts are excluded at DB query level)
3. `minimumOrderValue` — checked against the **full cart subtotal**, not per-item
4. Targeting mode + optional category filter must match the product
5. **Diamond type** — `naturalDiscount` is used when `diamondDetails.diamondType === "Natural"`, `labDiscount` when `"Lab"`
6. **Best wins** — if multiple discounts apply to the same item, the one giving the highest saving is used
7. Each item is evaluated independently — one item can get a discount while another in the same cart does not

### Cart Summary Response with Discount

```json
{
  "subtotal":             9000,
  "flatDiscountAmount":   900,
  "couponDiscountAmount": 0,
  "totalDiscount":        900,
  "total":                8100,
  "totalItems":           2,
  "appliedDiscounts": [
    {
      "productId":    "64def...",
      "discountName": "Spring Sale",
      "amount":       900,
      "type":         "Automatic"
    }
  ]
}
```

### Example: Category-wide Discount

```json
{
  "allowThisDiscount": "all",
  "discountCategory":  "Engagement Rings",
  "discountUnit":      "%",
  "naturalDiscount":   10,
  "labDiscount":       15,
  "minimumOrderValue": 0,
  "status":            true
}
```
→ Every engagement ring in the cart gets 10% off (Natural) or 15% off (Lab).

### Example: CAD Code Discount

```json
{
  "allowThisDiscount": "cadCode",
  "selectedCadCodes":  ["CAD-001", "CAD-007"],
  "discountUnit":      "$",
  "naturalDiscount":   200,
  "labDiscount":       200,
  "minimumOrderValue": 1000,
  "status":            true
}
```
→ $200 off any product with CAD code `CAD-001` or `CAD-007`, only when cart ≥ $1000.

### Example: Specific Products Discount

```json
{
  "allowThisDiscount":  "selectProducts",
  "selectedProductIds": ["64def...", "64ghi..."],
  "discountUnit":       "%",
  "naturalDiscount":    5,
  "labDiscount":        5,
  "status":             true
}
```
→ 5% off those two specific products only.

---

## 8. Frontend: What Needs to Be Updated

### 8.1 — Always Send `diamondDetails` When Adding to Cart

```js
await fetch('/api/cart/add', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId,
    productId: jewelry._id,
    quantity: 1,
    selectedOptions: { metaldetail: selectedMetal._id, ringsize: '7' },
    diamondDetails: {
      shape:        selectedDiamond.shape,
      carat:        selectedDiamond.carats,
      cut:          selectedDiamond.cut,
      clarity:      selectedDiamond.clar,
      color:        selectedDiamond.col,
      diamondType:  selectedDiamond.lab ? 'Lab' : 'Natural',
      lab:          !!selectedDiamond.lab,
      price:        selectedDiamond.price,
      markup_price: selectedDiamond.markup_price
    }
  })
})
```

> `diamondType` in `diamondDetails` also drives which discount value (`naturalDiscount` vs `labDiscount`) is applied at checkout.

---

### 8.2 — Use `slug` to Build Product URLs

```js
// Order confirmation / history
const url = `/jewelry/${order.products[0].productDetails.slug}`;
// → /jewelry/aire-curvy-diamond-engagement-ring

order.subOrders.forEach(sub => {
  const link = `/jewelry/${sub.productDetails.slug}`;
});
```

---

### 8.3 — Use `itemId` for Cart Updates and Removes

```js
const { cart } = await addToCart(payload);
const itemId = cart.items[cart.items.length - 1].itemId;

// Update
await fetch('/api/cart/update', { method: 'PUT',
  body: JSON.stringify({ userId, sessionId, itemId, quantity: 2 }) });

// Remove
await fetch('/api/cart/remove', { method: 'DELETE',
  body: JSON.stringify({ userId, sessionId, itemId }) });
```

---

### 8.4 — Display Sub-Order Status in Order History

```js
order.subOrders.forEach(sub => {
  const steps = ['Pending','Confirmed','Manufacturing','Quality Assurance','Out For Delivery','Delivered'];
  const step = steps.indexOf(sub.status); // 0-based

  // Show product link + current step
  console.log(`${sub.productDetails.title} — ${sub.status} (${step + 1}/${steps.length})`);
  console.log(`  /jewelry/${sub.productDetails.slug}`);

  if (sub.progress.outForDelivery?.trackingLink) {
    console.log(`  Tracking: ${sub.progress.outForDelivery.trackingLink}`);
  }
});
```

---

### 8.5 — Show Correct Price Based on `diamondType`

```js
// Engagement ring
const price = jewelry.pricing.metalPricing
  .find(m => m.metal.id === selectedMetalId)
  ?.finalPrice[diamondType === 'Lab' ? 'lab' : 'natural'];

// Non-engagement jewelry
const price = jewelry.addedDiamonds.selectedDiamonds[0]
  .metalPricing.find(m => m.metal === selectedMetalId)
  ?.[diamondType === 'Lab' ? 'priceLab' : 'priceNatural'];
```

---

## 9. Status & Enum Reference

| Field | Valid Values |
|---|---|
| `order.status` / `subOrder.status` | `Pending`, `Confirmed`, `Manufacturing`, `Quality Assurance`, `Out For Delivery`, `Delivered`, `Cancelled` |
| `order.paymentStatus` | `pending`, `paid`, `failed`, `refunded` |
| `flatDiscount.allowThisDiscount` | `all`, `selectProducts`, `cadCode` |
| `flatDiscount.discountCategory` | `Engagement Rings`, `Wedding Bands`, `Earrings`, `Bracelet`, `Pendant`, `Diamond` |
| `flatDiscount.discountUnit` | `%`, `$` |
| `diamondDetails.diamondType` | `Natural`, `Lab` |
| `engravingDetails.engravingType` | `Text`, `Symbol`, `Date`, `Initials`, `Custom Design` |
| `engravingDetails.engravingLocation` | `Inside Band`, `Outside Band`, `Back`, `Front`, `Side`, `Custom Location` |
| `engravingDetails.engravingStatus` | `Pending`, `In Progress`, `Completed`, `Approved`, `Cancelled` |

---

## 10. Open Bug (Not Yet Fixed)

### Sub-order Auto-Escalation: Cancelled blocks Delivered

**File:** `src/routes/order.js:642`

```js
// Current — fails when any sub-order is Cancelled
const allDelivered = order.subOrders.every(s => s.status === 'Delivered');
```

If one sub-order is `Cancelled`, `.every()` returns `false` and the main order never reaches `Delivered` even when all remaining items are delivered.

**Fix:**
```js
const nonCancelled = order.subOrders.filter(s => s.status !== 'Cancelled');
const allDelivered = nonCancelled.length > 0 && nonCancelled.every(s => s.status === 'Delivered');
if (allDelivered) order.status = 'Delivered';
```

---

## 11. Key Points Summary

| # | What | Where |
|---|---|---|
| 1 | Send `diamondDetails` on every add-to-cart — drives both price AND discount | `POST /api/cart/add` body |
| 2 | Use `slug` from order/product data to build product page URLs | `productDetails.slug` in order & sub-order |
| 3 | Use `itemId` (not `productId`) for cart update/remove | Returned in cart item after add |
| 4 | Each cart item becomes a sub-order with independent status tracking | `order.subOrders[]` |
| 5 | When all non-cancelled sub-orders reach Delivered, main order auto-updates | Backend auto-logic (see §10 for known edge case) |
| 6 | Flat discounts are automatic — no coupon needed, applied per-item at summary | `src/utils/cartHelper.js` |
| 7 | Discount targeting: `all` / `selectProducts` / `cadCode` + optional category filter | `FlatDiscount.allowThisDiscount` |
| 8 | Expired discounts (`validTill` < today) are excluded at DB query level | Filtered in `calculateCartSummary` |
| 9 | `diamondType: "Lab"` → `labDiscount`; `"Natural"` → `naturalDiscount` | Read from `item.diamondDetails.diamondType` |
