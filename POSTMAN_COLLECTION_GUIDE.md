# Celora Cart & Checkout - Postman Collection Guide

## 📋 Overview

This Postman collection provides comprehensive testing for the Celora jewelry cart and checkout system. It includes **10 test scenarios** covering both success and error cases.

## 🚀 Quick Start

### 1. Import Collection
1. Open Postman
2. Click **Import** button
3. Select file: `Celora_Cart_Checkout_Complete.postman_collection.json`
4. Collection will appear in your Postman sidebar

### 2. Configure Variables

The collection uses variables that auto-update during execution:

| Variable | Default Value | Description |
|----------|--------------|-------------|
| `baseUrl` | `http://localhost:3000` | API base URL |
| `sessionId` | Auto-generated | Cart session ID |
| `productId1` | `68e56601fc1041811bf14f1f` | Engagement Ring ID |
| `productId2` | `68e3b292e0c63062982ac1f0` | Pendant ID |
| `metalId1` | `68e3a745e0c63062982ab7d2` | 925k White Metal |
| `metalId2` | `68afea760686a0c9081db6ad` | 14k Rose Gold |
| `validCard` | `4242424242424242` | Stripe test card |

**To modify variables:**
- Right-click collection → **Edit**
- Go to **Variables** tab
- Update `Current Value` column

## 📝 Test Scenarios

### ✅ Success Cases

#### 1. **Add to Cart - Success**
- **Method:** POST `/cart/add`
- **Test:** Adds engagement ring with full customization
- **Includes:**
  - Metal selection (925k White)
  - Ring size (7)
  - Diamond specs (0.35ct, D, VVS1, Marquise)
  - Customizations (White Gold, gemstone upgrade)
  - Engraving ("Forever & Always", Elegant Script)
- **Expected:** 200 OK, cart created with all variations saved

#### 2. **Get Cart - Success**
- **Method:** GET `/cart`
- **Test:** Retrieves cart by sessionId
- **Expected:** 200 OK, cart with items and pricing

#### 3. **Checkout - Same Address (Success)**
- **Method:** POST `/cart/checkout`
- **Test:** Checkout with identical billing & shipping address
- **Expected:** 
  - 200 OK
  - Order created
  - Both addresses saved separately in database
  - Payment succeeded

#### 4. **Checkout - Different Addresses (Success)**
- **Method:** POST `/cart/checkout`
- **Test:** Checkout with different billing & shipping addresses
- **Addresses:**
  - Billing: San Francisco, CA 94102
  - Shipping: Oakland, CA 94612
- **Expected:** 
  - 200 OK
  - Both addresses stored correctly
  - Cities and zip codes are different

### ❌ Error Cases

#### 5. **Checkout - Empty Cart (Error)**
- **Method:** POST `/cart/checkout`
- **Test:** Attempt checkout with no items in cart
- **Expected:** 
  - 400 Bad Request
  - Error message: "cart is empty"

#### 6. **Checkout - Wrong CVV (Error)**
- **Method:** POST `/cart/checkout`
- **Test:** Use Stripe test card for CVV failure
- **Card:** `4000000000000127` (CVV check fails)
- **Expected:** 
  - 400/402 Error
  - Error message about CVV/CVC/declined

#### 7. **Checkout - Expired Card (Error)**
- **Method:** POST `/cart/checkout`
- **Test:** Use expired card details
- **Card:** `4000000000000069` (Stripe test for expired)
- **Expiry:** 01/2020 (past date)
- **Expected:** 
  - 400/402 Error
  - Error message about expired card

#### 8. **Checkout - Insufficient Funds (Error)**
- **Method:** POST `/cart/checkout`
- **Test:** Use Stripe test card for insufficient funds
- **Card:** `4000000000009995`
- **Expected:** 
  - 400/402 Error
  - Error message about insufficient funds

#### 9. **Checkout - Invalid Card (Error)**
- **Method:** POST `/cart/checkout`
- **Test:** Use completely invalid card number
- **Card:** `1234567890123456`
- **Expected:** 
  - 400 Bad Request
  - Error message about invalid card

#### 10. **Checkout - Missing Fields (Error)**
- **Method:** POST `/cart/checkout`
- **Test:** Send incomplete address/payment data
- **Expected:** 
  - 400 Bad Request
  - Error message about required/missing fields

## 🎯 Product Details Used

### Product 1: Engagement Ring
```json
{
  "jewelryId": "811fa900-a3b1-11f0-b946-3bbc7bbdf38c",
  "title": "df",
  "type": "Premade",
  "jewelryType": "Engagement Ring",
  "metalWeight": {"weight": 45, "metalType": "14K"},
  "engravingAvailable": false,
  "availableMetals": [
    "925k White",
    "Platinum", 
    "14k Rose Gold",
    "14k White Gold",
    "14k Yellow Gold",
    "18k Rose Gold",
    "18k White Gold",
    "18k Yellow Gold"
  ],
  "stoneSize": ["6x3 mm (0.35 ct)", "14x7 mm (3 ct)", "8x4 mm (0.75 ct)"]
}
```

### Product 2: Pendant
```json
{
  "jewelryId": "f73fc981-a2ad-11f0-9fd3-abe04cff71ef",
  "title": "test",
  "type": "Premade",
  "jewelryType": "Pendant",
  "metalWeight": {"weight": 3.3, "metalType": "925k"},
  "engravingAvailable": true,
  "maxCharacters": 20,
  "stoneSize": ["9x11mm (0.4 ct)"]
}
```

## 🔑 Stripe Test Cards

### Success Cases
- `4242424242424242` - Visa (succeeds)
- `5555555555554444` - Mastercard (succeeds)

### Error Cases
- `4000000000000002` - Generic decline
- `4000000000000127` - Incorrect CVV
- `4000000000000069` - Expired card
- `4000000000009995` - Insufficient funds
- `4000000000000119` - Processing error

**All test cards:**
- CVV: Any 3 digits (e.g., 123)
- Expiry: Any future date (e.g., 12/2026)

## 🧪 Running Tests

### Option 1: Individual Requests
1. Select any request from the collection
2. Click **Send**
3. View response and test results in **Test Results** tab

### Option 2: Run Entire Collection
1. Click collection name
2. Click **Run** button
3. Select requests to run
4. Click **Run Celora Cart...**
5. View results summary with pass/fail counts

### Option 3: Newman (CLI)
```bash
# Install Newman
npm install -g newman

# Run collection
newman run Celora_Cart_Checkout_Complete.postman_collection.json

# Run with environment
newman run Celora_Cart_Checkout_Complete.postman_collection.json \
  --env-var "baseUrl=http://localhost:3000"
```

## 📊 Expected Results

### Success Rate
- **Success scenarios:** 4/4 should pass (100%)
- **Error scenarios:** 6/6 should pass (100%)
- **Overall:** 10/10 (100% pass rate)

### Test Coverage
✅ Cart Operations
- Add product with variations
- Retrieve cart
- Update quantity
- Clear cart

✅ Checkout Success
- Same billing & shipping address
- Different billing & shipping addresses
- Multiple products
- Engraving options

✅ Error Handling
- Empty cart validation
- Payment errors (CVV, expired, funds)
- Invalid card detection
- Required field validation

## 🔍 Verification Steps

### 1. Check MongoDB After Checkout
```javascript
// Verify addresses stored separately
db.orders.findOne(
  {orderNumber: "ORD-xxx"},
  {billingAddress: 1, shippingAddress: 1}
)

// Expected result:
{
  "billingAddress": {
    "city": "San Francisco",
    "zipCode": "94102"
  },
  "shippingAddress": {
    "city": "Oakland",  // Different city
    "zipCode": "94612"  // Different zip
  }
}
```

### 2. Check Engraving Saved
```javascript
// Verify engraving options
db.carts.findOne(
  {sessionId: "test-xxx"},
  {"items.engravingOptions": 1}
)

// Expected result:
{
  "items": [{
    "engravingOptions": {
      "engravingText": "Forever & Always",
      "font": "Elegant Script"
    }
  }]
}
```

### 3. Check Price Locking
```javascript
// Verify price stored at add-to-cart time
db.carts.findOne(
  {sessionId: "test-xxx"},
  {"items.priceAtTime": 1}
)

// Expected: priceAtTime field exists with numeric value
```

## 🛠️ Troubleshooting

### Issue: "Cart is empty" on checkout
**Solution:** Ensure you run request #1 (Add to Cart) first to create cart with items

### Issue: Variables not auto-updating
**Solution:** Check that test scripts are enabled:
1. Settings → General → Enable request scripts during runtime ✅

### Issue: 401 Unauthorized
**Solution:** Check if authentication is required:
- Add auth token to headers if needed
- Update collection variables with valid credentials

### Issue: Connection refused
**Solution:** 
1. Start backend server: `node src/app.js`
2. Verify baseUrl variable matches server address

## 📈 Advanced Usage

### Custom Pre-request Scripts
Add to Collection level for auto-login:
```javascript
// Auto-generate session ID
pm.collectionVariables.set("sessionId", "auto-" + Date.now());

// Add authentication token
pm.request.headers.add({
  key: "Authorization",
  value: "Bearer " + pm.environment.get("authToken")
});
```

### Custom Tests
Add assertions to any request:
```javascript
// Check response time
pm.test("Response time < 500ms", () => {
  pm.expect(pm.response.responseTime).to.be.below(500);
});

// Validate schema
pm.test("Valid response schema", () => {
  const schema = {
    type: "object",
    required: ["success", "cart"],
    properties: {
      success: {type: "boolean"},
      cart: {type: "object"}
    }
  };
  pm.response.to.have.jsonSchema(schema);
});
```

## 📝 Notes

1. **Session Management:** Each test auto-generates a unique sessionId to avoid conflicts
2. **Price Locking:** Product prices are locked at time of adding to cart (priceAtTime field)
3. **Engraving Validation:** Max 20 characters, validated on backend
4. **Address Storage:** Both billing and shipping addresses stored separately in Order model
5. **Stripe Integration:** Uses test mode, no real charges

## 🔗 Related Files

- `test-comprehensive-checkout-scenarios.js` - Node.js test suite
- `test-engraving-storage.js` - Engraving verification
- `CART_VARIATION_STORAGE_ANALYSIS.md` - Technical analysis
- `COMPREHENSIVE_CHECKOUT_TEST_RESULTS.md` - Test documentation

## 📞 Support

For issues or questions:
1. Check MongoDB logs: `db.orders.find().sort({createdAt: -1}).limit(5)`
2. Check server logs: `tail -f logs/app.log`
3. Review error responses in Postman console
4. Verify Stripe dashboard for payment attempts

---

**Last Updated:** October 8, 2025  
**Version:** 1.0  
**Author:** Celora Development Team
