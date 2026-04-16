# 💎 Jewelry API Usage Guide

**Endpoint:** `GET /api/jewelry`

## 1. Standard Parameters
| Param | Default | Example |
|---|---|---|
| `page` | 1 | `?page=2` |
| `limit` | 10 | `?limit=20` |
| `sortBy` | _id | `?sortBy=createdOn` |
| `sortOrder`| desc | `?sortOrder=asc` |
| `priceSort`| - | `?priceSort=lowToHigh` | Sorts by `natural` diamond grand total. |

## 2. Filtering Examples

### A. Simple Filters
Filter by direct fields.
- `?jewelryType=Engagement Ring`
- `?inStock=true`

### B. Nested Filtering (New Feature)
You can now filter inside objects like `availableMetals` or `pricing` using bracket notation.

#### 1. Filter by Metal Type
**Goal:** Show items available in "Yellow Gold".
**Target:** `availableMetals.metalType`

**URL:**
`?availableMetals[metalType]=Yellow+Gold`

**JS Object:**
```js
{ availableMetals: { metalType: 'Yellow Gold' } }
```

#### 2. Filter by Price Range
**Goal:** Show items where Natural Diamond price is $1000 - $5000.
**Target:** `pricing.metalPricing.grandTotal.natural`

**URL:**
`?pricing[metalPricing][grandTotal][natural][from]=1000&pricing[metalPricing][grandTotal][natural][to]=5000`

**JS Object:**
```js
{
  pricing: {
    metalPricing: {
      grandTotal: {
        natural: { from: 1000, to: 5000 }
      }
    }
  }
}
```

## 3. Frontend Example (Axios)
Axios automatically serializes nested objects into the correct bracket notation.

```javascript
// Example: Fetch Yellow Gold rings under $2000
const getJewelry = async () => {
  const res = await axios.get('/api/jewelry', {
    params: {
      page: 1,
      jewelryType: 'Engagement Ring',
      // Nested Metal Filter
      availableMetals: { metalType: 'Yellow Gold' }, 
      // Nested Price Filter
      pricing: {
        metalPricing: {
          grandTotal: {
            natural: { to: 2000 } 
          }
        }
      }
    }
  });
  console.log(res.data);
};
```
