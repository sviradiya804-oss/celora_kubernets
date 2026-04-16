# 💎 Celora Jewelry API Guide (Frontend)

This guide provides the **complete integration details** for the `/api/jewelry` endpoint.

---

## 🚀 Integration Code: `JewelryService.js`
Copy this file into your frontend project. It handles all filtering, sorting, and nested parameter logic.

```javascript
// services/JewelryService.js
import axios from 'axios';

const API_URL = 'https://api.celorajewelry.com/api/jewelry';

export const fetchJewelry = async ({
  page = 1,
  limit = 20,
  sortOrder = 'desc',
  priceSort = null,
  filters = {}
}) => {
  const params = { page, limit, sortOrder };

  if (priceSort) params.priceSort = priceSort;
  if (filters.diamondType) params.diamondType = filters.diamondType;
  if (filters.jewelryType) params.jewelryType = filters.jewelryType; 
  if (filters.inStock) params.inStock = true;

  // Nested Filters
  if (filters.metalType) params.availableMetals = { metalType: filters.metalType };
  if (filters.shape) params.availableShapes = { name: filters.shape };

  // Price Logic
  if (filters.minPrice || filters.maxPrice) {
    const priceType = filters.diamondType === 'Lab' ? 'lab' : 'natural';
    params.pricing = { metalPricing: { grandTotal: { [priceType]: {} } } };
    if (filters.minPrice) params.pricing.metalPricing.grandTotal[priceType].from = filters.minPrice;
    if (filters.maxPrice) params.pricing.metalPricing.grandTotal[priceType].to = filters.maxPrice;
  }

  try {
    const response = await axios.get(API_URL, { params });
    return response.data;
  } catch (error) {
    console.error('Fetch Error:', error);
    throw error;
  }
};
```

---

## 🧪 Verified Curl Examples
Directly test these in your terminal to verify backend logic.

### 1. ⬆️ Price Low to High
Sorts by Natural Diamond Price (ascending).
```bash
curl "https://api.celorajewelry.com/api/jewelry?priceSort=lowToHigh&limit=1"
```

### 2. ⬇️ Price High to Low
Sorts by Natural Diamond Price (descending).
```bash
curl "https://api.celorajewelry.com/api/jewelry?priceSort=highToLow&limit=1"
```

### 3. Price Range ($100 - $500)
Filters Natural Diamond price.
```bash
curl "https://api.celorajewelry.com/api/jewelry?pricing[metalPricing][grandTotal][natural][from]=100&pricing[metalPricing][grandTotal][natural][to]=500&limit=1"
```

### 4. Metal: Yellow Gold
```bash
curl "https://api.celorajewelry.com/api/jewelry?availableMetals[metalType]=Yellow+Gold&limit=1"
```

### 5. Shape: Round
```bash
curl "https://api.celorajewelry.com/api/jewelry?availableShapes[name]=Round&limit=1"
```

---

## 📋 Supported Filter Values

### 🛡️ Metal Types
- `Yellow Gold`
- `White Gold`
- `Rose Gold`
- `Platinum`

### 💍 Jewelry Types
- `Engagement Ring`
- `Wedding Bands`
- `Pendant`
- `Earrings`
- `Bracelet`

### 🔷 Shapes
- `Round`, `Oval`, `Emerald`, `Princess`, `Cushion`, `Pear`, `Radiant`, `Asscher`, `Marquise`, `Heart`
