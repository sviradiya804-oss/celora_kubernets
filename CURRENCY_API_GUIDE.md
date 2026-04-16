# Currency Management API - Quick Reference

## 📦 Postman Collection
**File**: `Currency_Management.postman_collection.json`

**Import Instructions**:
1. Open Postman
2. Click "Import" button
3. Select `Currency_Management.postman_collection.json`
4. Update environment variables:
   - `base_url`: Your API URL (default: `http://localhost:3000`)
   - `auth_token`: Your JWT token for authenticated requests

---

## 🔑 API Endpoints Summary

### Public Endpoints (No Authentication Required)

#### 1. Get Available Currencies
```http
GET /api/currency/available
```
Returns list of all supported currencies with exchange rates.

**Response Example**:
```json
{
  "success": true,
  "currencies": [
    {
      "country": "European Union",
      "currencyCode": "EUR",
      "rate": 0.86393,
      "symbol": "€"
    },
    {
      "country": "India",
      "currencyCode": "INR",
      "rate": 88.49,
      "symbol": "₹"
    }
  ],
  "baseCurrency": "USD",
  "note": "All prices are stored in USD. Use the rate as multiplier to convert."
}
```

---

#### 2. Validate Currency
```http
POST /api/currency/validate
Content-Type: application/json

{
  "currency": "EUR"
}
```

**Response**:
```json
{
  "success": true,
  "valid": true,
  "currency": {
    "code": "EUR",
    "symbol": "€",
    "rate": 0.86393,
    "country": "European Union"
  },
  "usage": {
    "queryParam": "?currency=EUR",
    "header": "X-Currency: EUR"
  }
}
```

---

### Guest User - Currency Usage (No Profile Saving)

#### Option 1: Query Parameter (Recommended)
```http
GET /api/jewelry?currency=EUR&limit=1
GET /api/cart?currency=INR
GET /api/checkout?currency=AUD
GET /api/order?currency=EUR
```

#### Option 2: Request Header
```http
GET /api/jewelry
X-Currency: INR
```

**Priority**: Query param > Header > User profile > USD default

---

### Authenticated User Endpoints

#### 3. Set Currency Preference (Saves to Profile)
```http
POST /api/currency/set
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "currency": "EUR"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Currency preference EUR saved to profile",
  "preference": {
    "currency": "EUR",
    "country": "European Union",
    "symbol": "€",
    "rate": 0.86393
  }
}
```

---

#### 4. Get User's Saved Preference
```http
GET /api/currency/preference
Authorization: Bearer YOUR_JWT_TOKEN
```

---

#### 5. Update Preference
```http
PUT /api/currency/preference
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "currency": "INR",
  "country": "India"
}
```

---

#### 6. Reset to Default (USD)
```http
DELETE /api/currency/preference
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🎯 How Currency Conversion Works

### For Guest Users:
1. Add `?currency=EUR` to any API endpoint
2. All prices automatically converted to EUR
3. Response includes: `currencyCode`, `currencySymbol`, `formattedPrice`
4. No data saved (preference only valid for that request)

### For Authenticated Users:
1. **Option A**: Save preference via `/api/currency/set`
   - Stored in user profile
   - Applied to ALL future requests automatically
   - Can override per-request with query param

2. **Option B**: Use query param (same as guest)
   - Temporary for that request only
   - Doesn't update saved preference

---

## 💰 Supported Currencies

| Currency | Code | Symbol | Rate (1 USD =) |
|----------|------|--------|----------------|
| US Dollar | USD | $ | 1.0 |
| Euro | EUR | € | 0.86393 |
| Indian Rupee | INR | ₹ | 88.49 |
| Australian Dollar | AUD | @ | 1.5324 |

---

## 📝 Example Test Flow

### Test 1: Guest User Shopping in EUR
```bash
# Step 1: Browse jewelry in EUR
curl "http://localhost:3000/api/jewelry?currency=EUR&limit=2"

# Step 2: Add to cart (prices still in EUR via query param)
curl "http://localhost:3000/api/cart?currency=EUR"

# Step 3: Checkout in EUR
curl "http://localhost:3000/api/checkout?currency=EUR"
```

---

### Test 2: Authenticated User Sets Preference
```bash
# Step 1: Login and get token
# ... (existing login flow)

# Step 2: Set currency to INR
curl -X POST http://localhost:3000/api/currency/set \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currency":"INR"}'

# Step 3: All subsequent requests automatically in INR
curl http://localhost:3000/api/jewelry \
  -H "Authorization: Bearer YOUR_TOKEN"
# Returns prices in INR automatically!

# Step 4: Cart also in INR (no currency param needed)
curl http://localhost:3000/api/cart \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### Test 3: Compare Prices Across Currencies
```bash
# Same product in different currencies
curl "http://localhost:3000/api/jewelry/PRODUCT_ID?currency=USD"
curl "http://localhost:3000/api/jewelry/PRODUCT_ID?currency=EUR"
curl "http://localhost:3000/api/jewelry/PRODUCT_ID?currency=INR"
```

Expected Results:
- **USD**: $4,531.36
- **EUR**: €3,914.78 (×0.86393)
- **INR**: ₹400,980.05 (×88.49)

---

## 🔍 Response Format

### Jewelry Product Response (with EUR conversion):
```json
{
  "success": true,
  "data": [
    {
      "title": "Diamond Ring",
      "pricing": {
        "baseCurrency": "USD",
        "metalPricing": [
          {
            "metal": { "name": "14K" },
            "finalPrice": {
              "natural": 3914.78,  // ← Converted to EUR
              "lab": 3914.78
            },
            "currencyCode": "EUR",  // ← Added
            "currencySymbol": "€",  // ← Added
            "formattedPrice": "€3914.78",  // ← Added
            "cost": 2713.73,  // All prices converted
            "shippingCharges": 77.75,
            "packagingCharges": 17.28
          }
        ]
      }
    }
  ]
}
```

---

## ⚠️ Important Notes

1. **Base Currency**: All prices stored in USD
2. **Conversion**: Multiply by exchange rate (e.g., 4531.36 × 0.86393 = 3914.78 EUR)
3. **Priority**: Query param > Header > User profile > USD default
4. **Guest Users**: Must use `?currency=XXX` on every request
5. **Authenticated Users**: Can save preference once, applied to all requests
6. **Invalid Currency**: Falls back to USD gracefully

---

## 🚀 Production Checklist

Before deploying:
- [ ] Fix USD exchange rate to 1.0 in database
- [ ] Update middleware to skip conversion for USD
- [ ] Test all endpoints with Postman collection
- [ ] Verify guest user flow
- [ ] Verify authenticated user flow
- [ ] Test invalid currency handling
- [ ] Set up exchange rate auto-update cron job

---

## 📧 Support

For issues or questions, contact the development team.
