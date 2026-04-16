# 🎨 Currency Conversion System - Visual Flow

## 🔄 Complete Request-Response Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER MAKES REQUEST                          │
│  GET /api/jewelry?currency=EUR   (or without ?currency)            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   CURRENCY MIDDLEWARE (Step 1)                      │
│  Priority Check:                                                    │
│    1. Query param (?currency=EUR) → Found? Use EUR ✅              │
│    2. Header (x-currency: EUR)    → Found? Use EUR ✅              │
│    3. User Profile (preferredCurrency) → Found? Use Profile ✅     │
│    4. Default → Use USD                                            │
│                                                                     │
│  Result: req.currencyInfo = { currency: 'EUR', ... }              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 ROUTE HANDLER (Existing Logic)                      │
│  - Fetch jewelry from database                                     │
│  - Apply filters, pagination                                       │
│  - Prepare response data                                           │
│                                                                     │
│  Data: { name: "Ring", price: 1000, ... }  (USD in DB)            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│            RESPONSE CONVERSION MIDDLEWARE (Step 2)                  │
│  - Intercepts res.json()                                           │
│  - Reads req.currencyInfo                                          │
│  - Fetches exchange rate (EUR = 0.92)                             │
│  - Converts all price fields:                                      │
│      price: 1000 * 0.92 = 920                                     │
│      productDetails.price: 500 * 0.92 = 460                       │
│  - Adds metadata:                                                  │
│      currencyCode: "EUR"                                           │
│      currencySymbol: "€"                                           │
│      formattedPrice: "€920.00"                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RESPONSE TO CLIENT                             │
│  {                                                                  │
│    "name": "Diamond Ring",                                         │
│    "price": 920,           ← Converted!                           │
│    "currencyCode": "EUR",  ← Added!                               │
│    "currencySymbol": "€",  ← Added!                               │
│    "formattedPrice": "€920.00"  ← Added!                          │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 👤 User Profile Currency Flow

```
┌───────────────────────────────────────────────────────────────────┐
│  USER LOGS IN                                                     │
│  POST /api/v1/auth/login                                         │
│  Returns: { token, user: { preferredCurrency: 'USD' } }         │
└────────────────┬──────────────────────────────────────────────────┘
                 │
                 ▼
┌───────────────────────────────────────────────────────────────────┐
│  USER CHANGES CURRENCY PREFERENCE                                 │
│  PUT /api/currency/preference                                     │
│  Body: { "currency": "EUR" }                                     │
│                                                                   │
│  Updates MongoDB User Document:                                   │
│    user.preferredCurrency = 'EUR'                                │
│    user.preferredCountry = 'Germany'                             │
│    user.exchangeRate = ObjectId('...')                           │
└────────────────┬──────────────────────────────────────────────────┘
                 │
                 ▼
┌───────────────────────────────────────────────────────────────────┐
│  ALL FUTURE REQUESTS USE EUR                                      │
│  GET /api/jewelry  (no ?currency needed)                         │
│  GET /api/cart/:userId                                           │
│  GET /api/orders/:orderId                                        │
│                                                                   │
│  Currency Middleware fetches user.preferredCurrency = 'EUR'      │
│  → All responses automatically in EUR ✅                         │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🛒 Complete Shopping Journey

```
BROWSE                    ADD TO CART              CHECKOUT                 VIEW ORDER
   │                          │                        │                        │
   ▼                          ▼                        ▼                        ▼
┌──────┐                 ┌──────┐               ┌──────┐               ┌──────┐
│ EUR  │                 │ EUR  │               │ EUR  │               │ EUR  │
│ €920 │ ──────────────> │ €920 │ ───────────> │ €920 │ ───────────> │ €920 │
│      │                 │ x2   │               │ Total│               │ Total│
│      │                 │€1840 │               │€1840 │               │€1840 │
└──────┘                 └──────┘               └──────┘               └──────┘
   ↑                          ↑                        ↑                        ↑
   └──────────────────────────┴────────────────────────┴────────────────────────┘
              SAME CURRENCY THROUGHOUT (EUR) ✅
```

---

## 🌍 Multi-Currency Support

```
DATABASE (USD Base)          CONVERSION              USER SEES
     ┌──────┐                   │                    ┌──────┐
     │$1000 │ ──── EUR 0.92 ───>                    │ €920 │
     │      │                   │                    └──────┘
     │      │                   │
     │      │ ──── GBP 0.79 ───>                    ┌──────┐
     │      │                   │                    │ £790 │
     │      │                   │                    └──────┘
     │      │                   │
     │      │ ──── INR 83.12 ──>                    ┌───────┐
     │      │                                        │₹83120 │
     └──────┘                                        └───────┘

  All prices stored in USD in database
  Converted on-the-fly based on user preference
  Original data never modified ✅
```

---

## 🔐 Authentication Flow

```
┌────────────────────────────────────────────────────────────────┐
│  GUEST USER (Not Logged In)                                   │
│  - Uses ?currency=EUR query parameter                         │
│  - Currency not persisted                                     │
│  - Must pass ?currency on every request                       │
└────────────────────────────────────────────────────────────────┘

                              VS

┌────────────────────────────────────────────────────────────────┐
│  AUTHENTICATED USER (Logged In)                                │
│  - Sets preference once: PUT /api/currency/preference         │
│  - Stored in user.preferredCurrency                           │
│  - Persists across sessions                                   │
│  - No need to pass ?currency param                            │
│  - Can override with ?currency if needed                      │
└────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Conversion Detail

```
INPUT (from database):                  OUTPUT (to user):
{                                       {
  "jewelryId": "JWL001",                 "jewelryId": "JWL001",
  "name": "Diamond Ring",                "name": "Diamond Ring",
  "price": 1000,           ──────────>   "price": 920,           ✅
  "quantity": 2                          "quantity": 2,
}                                        "total": 1840,          ✅ NEW
                                         "currencyCode": "EUR",  ✅ NEW
                                         "currencySymbol": "€",  ✅ NEW
                                         "formattedPrice": "€920.00", ✅ NEW
                                         "formattedTotal": "€1840.00" ✅ NEW
                                       }

Conversion Formula: EUR_price = USD_price × 0.92
Rounded to 2 decimals
```

---

## 🔄 Exchange Rate Update Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  CRON JOB (Runs Daily)                                          │
│  - Fetches latest rates from Frankfurter API                   │
│  - Updates MongoDB exchangerate collection                      │
│  - Base currency: USD                                           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  EXCHANGERATE COLLECTION (MongoDB)                              │
│  [                                                              │
│    { country: 'Germany', currencyCode: 'EUR', rate: 0.92 },   │
│    { country: 'United Kingdom', currencyCode: 'GBP', rate: 0.79 },│
│    { country: 'India', currencyCode: 'INR', rate: 83.12 }     │
│  ]                                                              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  USED BY CONVERSION MIDDLEWARE                                  │
│  - Looks up rate for user's currency                           │
│  - Applies to all price fields                                 │
│  - Real-time conversion on every request                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Route Coverage Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    ALL API ROUTES                               │
│                                                                 │
│  /api/jewelry         ────> ✅ Currency Conversion Active      │
│  /api/product         ────> ✅ Currency Conversion Active      │
│  /api/cart            ────> ✅ Currency Conversion Active      │
│  /api/orders          ────> ✅ Currency Conversion Active      │
│  /api/wishlist        ────> ✅ Currency Conversion Active      │
│  /api/checkout-*      ────> ✅ Currency Conversion Active      │
│  /api/payments        ────> ✅ Currency Conversion Active      │
│  /api/dashboard       ────> ✅ Currency Conversion Active      │
│  /api/customer-order  ────> ✅ Currency Conversion Active      │
│                                                                 │
│  Coverage: 100% ✅                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Middleware Chain

```
Request
   │
   ▼
┌──────────────────────┐
│ CORS Middleware      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Auth Middleware      │ ← Identifies user (if logged in)
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Currency Middleware  │ ← Resolves currency preference
│ (resolveCurrency)    │   Sets req.currencyInfo
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Route Handler        │ ← Your existing code
│ (Get data from DB)   │   No changes needed!
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Response Conversion  │ ← Converts prices before sending
│ (convertResponse)    │   Adds currency metadata
└──────┬───────────────┘
       │
       ▼
    Response
```

---

**Visual guide created to help understand the complete currency conversion flow!** 🎨
