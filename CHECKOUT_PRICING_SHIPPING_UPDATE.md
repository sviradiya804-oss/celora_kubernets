# Checkout Pricing & Shipping Updates

## Summary of Changes

This document outlines the updates made to fix variant pricing, shipping details, and coupon structure in the checkout flow.

---

## 1. **Variant-Based Pricing** ✅

### Problem
- Checkout was using base product price instead of selected metal variant price
- Price calculation didn't consider `metaldetail` selection from cart items

### Solution
The checkout now:
1. Checks if a `metaldetail` variant is selected in `item.selectedVariant.selectedOptions.metaldetail`
2. Searches for the metal in `product.availableMetals` array
3. Uses variant-specific price if available
4. Falls back to base price if variant price not found

### Code Location
**File:** `src/routes/cart.js`
**Lines:** ~1000-1060 (in checkout endpoint)

```javascript
// Calculate price based on selected variant (metal detail)
let finalPrice = product.price; // Default to base price

if (item.selectedVariant?.selectedOptions?.metaldetail) {
  const selectedMetalId = item.selectedVariant.selectedOptions.metaldetail;
  
  if (product.availableMetals?.length > 0) {
    const selectedMetal = product.availableMetals.find(m => 
      m.metal?.toString() === selectedMetalId.toString()
    );
    
    if (selectedMetal?.price) {
      finalPrice = selectedMetal.price;
    }
  }
}

item.priceAtTime = finalPrice;
```

---

## 2. **Shipping Details in Orders** ✅

### Problem
- Orders didn't store shipping information like delivery dates, shipping method, etc.

### Solution
Added `shippingDetails` object to order schema with:
- `estimatedDeliveryDays`: Number of days for delivery
- `deliveryDateRange`: { start: Date, end: Date }
- `shippingMethod`: 'Standard', 'Express', 'Overnight', etc.
- `shippingCost`: Shipping cost amount
- `trackingNumber`: To be added when shipped
- `carrier`: FedEx, UPS, USPS, etc.

### Schema Update
**File:** `src/models/schema.js`
**Lines:** ~270-280

```javascript
shippingDetails: {
  estimatedDeliveryDays: { type: Number },
  deliveryDateRange: {
    start: { type: Date },
    end: { type: Date }
  },
  shippingMethod: { type: String },
  shippingCost: { type: Number, default: 0 },
  trackingNumber: { type: String },
  carrier: { type: String }
}
```

### Checkout API Update
The checkout endpoint now accepts `shippingDetails` in request body:

```json
{
  "sessionId": "xxx",
  "userId": "xxx",
  "shippingDetails": {
    "estimatedDeliveryDays": 5,
    "deliveryDateStart": "2025-10-12",
    "deliveryDateEnd": "2025-10-14",
    "shippingMethod": "Standard",
    "shippingCost": 0
  }
}
```

---

## 3. **Fixed Auto-Apply Coupon Structure** ✅

### Problem
- Auto-applied coupons had incomplete structure: `{ discount: 0 }`
- Missing `code`, `discountType`, `discountValue` fields

### Solution
Updated `autoApplyCategoryCoupons` function to save complete coupon object:

```javascript
cart.coupon = {
  code: coupon.couponCode,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  discountAmount: 0, // Calculated in checkout
  couponId: coupon._id
};
await cart.save(); // Save immediately
```

**File:** `src/routes/cart.js`
**Function:** `autoApplyCategoryCoupons` (lines ~65-75)

---

## 4. **Order Creation Updates** ✅

### Changes
1. Uses variant-aware pricing (`item.priceAtTime`) instead of base product price
2. Includes `shippingDetails` in order document
3. Uses `Jewelry` model instead of `Product` model for lookups

**File:** `src/routes/cart.js`
**Lines:** ~1495-1545

```javascript
const order = new Order({
  orderId: require('uuid').v1(),
  customer: userId,
  products: orderProducts,
  total: totalAmount,
  subtotal: subtotalAmount,
  discount: discountAmount,
  coupon: cart.coupon || null,
  shippingDetails: parsedShippingDetails || {
    estimatedDeliveryDays: 5,
    shippingMethod: 'Standard',
    shippingCost: 0
  },
  // ... rest of order fields
});
```

---

## API Usage Examples

### 1. Checkout with Shipping Details

```bash
curl --location 'https://celoraapi-cgezcsefa6b5f4gq.centralindia-01.azurewebsites.net/api/cart/checkout' \
--header 'Content-Type: application/json' \
--data '{
  "sessionId": "aebe15d0-681d-43b1-b5b9-4a28be8b4773",
  "userId": "68cfb58bba4299c98af66c87",
  "shippingDetails": {
    "estimatedDeliveryDays": 5,
    "deliveryDateStart": "2025-10-12",
    "deliveryDateEnd": "2025-10-14",
    "shippingMethod": "Standard",
    "shippingCost": 0
  }
}'
```

### 2. Add to Cart with Metal Variant

```bash
curl --location 'https://celoraapi-cgezcsefa6b5f4gq.centralindia-01.azurewebsites.net/api/cart/add' \
--header 'Content-Type: application/json' \
--data '{
  "sessionId": "session-123",
  "userId": "68cfb58bba4299c98af66c87",
  "productId": "68e22c2ee0c63062982a65cd",
  "quantity": 1,
  "selectedOptions": {
    "metaldetail": "68afea760686a0c9081db6ad",
    "ringsize": "7"
  }
}'
```

---

## Testing Checklist

- [ ] Add item to cart with metal variant selection
- [ ] Verify correct variant price is used in checkout
- [ ] Test auto-apply coupon with proper structure
- [ ] Checkout with shipping details
- [ ] Verify order contains shipping information
- [ ] Check order products have variant-aware pricing

---

## Notes for Future Development

### Metal Variant Pricing
If you need to calculate price based on metal weight + metal rate:
1. Populate the `metaldetail` reference to get metal rates
2. Use `product.metalWeight.weight * metalRate` for calculation
3. Update the pricing logic in lines ~1025-1050 of `cart.js`

### Additional Shipping Features
Consider adding:
- Real-time shipping rate calculation via carrier APIs
- Multiple shipping options in checkout
- International shipping support
- Shipping insurance options

---

## Files Modified

1. **`src/models/schema.js`** - Added `shippingDetails` to order schema
2. **`src/routes/cart.js`** - Updated:
   - Variant pricing calculation
   - Auto-apply coupon structure
   - Checkout endpoint to accept shipping details
   - Order creation with shipping info

---

## Date
October 7, 2025
