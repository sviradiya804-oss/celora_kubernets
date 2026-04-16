# 🚀 QUICK START - Currency Conversion System

## 🎯 For Frontend Developers

### 1. **Set User's Preferred Currency**
```javascript
PUT /api/currency/preference
Headers: { Authorization: 'Bearer <token>' }
Body: { "currency": "EUR" }

// User's preference is now saved
// All future API calls will return EUR prices
```

### 2. **Get User's Current Preference**
```javascript
GET /api/currency/preference
Headers: { Authorization: 'Bearer <token>' }

Response:
{
  "preference": {
    "currency": "EUR",
    "country": "Germany",
    "exchangeRate": { ... }
  }
}
```

### 3. **Browse Products (Authenticated)**
```javascript
GET /api/jewelry
Headers: { Authorization: 'Bearer <token>' }

// Automatically returns prices in user's preferred currency
// No need to pass currency param!
```

### 4. **Browse Products (Guest)**
```javascript
GET /api/jewelry?currency=EUR

// Returns prices in EUR
// Works without login
```

### 5. **Get Available Currencies for Dropdown**
```javascript
GET /api/currency/available

Response:
{
  "currencies": [
    { "currencyCode": "EUR", "symbol": "€", "country": "Germany", "rate": 0.92 },
    { "currencyCode": "GBP", "symbol": "£", "country": "United Kingdom", "rate": 0.79 },
    { "currencyCode": "INR", "symbol": "₹", "country": "India", "rate": 83.12 }
  ]
}
```

---

## 🛒 For Testing

### Test Jewelry in EUR:
```bash
curl "http://localhost:3000/api/jewelry?currency=EUR&limit=2"
```

### Test Cart in GBP:
```bash
curl "http://localhost:3000/api/cart/:userId?currency=GBP"
```

### Test Order in INR:
```bash
curl "http://localhost:3000/api/orders/:orderId?currency=INR"
```

---

## 📱 Frontend Integration Example

```javascript
// Currency selector component
class CurrencySelector {
  async loadCurrencies() {
    const res = await fetch('/api/currency/available');
    const data = await res.json();
    this.currencies = data.currencies;
  }

  async setUserCurrency(currencyCode) {
    await fetch('/api/currency/preference', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ currency: currencyCode })
    });

    // Refresh to show new prices
    window.location.reload();
  }
}
```

---

## ✅ What's Automatic

Once user sets currency preference:
- ✅ All jewelry/product prices convert automatically
- ✅ Cart prices convert automatically  
- ✅ Checkout totals convert automatically
- ✅ Order history converts automatically
- ✅ No need to pass `?currency=` param

---

## 🔑 Key Endpoints

| Purpose | Method | Endpoint |
|---------|--------|----------|
| Get user preference | GET | `/api/currency/preference` |
| Set user preference | PUT | `/api/currency/preference` |
| Reset to USD | DELETE | `/api/currency/preference` |
| List currencies | GET | `/api/currency/available` |

---

## 💡 Pro Tips

1. **For logged-in users:** Set preference once, works everywhere
2. **For guests:** Use `?currency=EUR` on any endpoint
3. **Override preference:** Query param takes priority over profile
4. **Default:** Everything defaults to USD if nothing specified

---

**That's it! Your complete currency system is ready.** 🎉
