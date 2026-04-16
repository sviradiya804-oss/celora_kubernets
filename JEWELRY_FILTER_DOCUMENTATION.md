# 💍 Jewelry API Filter Documentation

This guide explains how to use the `/api/jewelry` endpoint for filtering, sorting, and searching.

> **⚠️ SHELL TIP**: Always wrap your URL in **double quotes** (e.g., `"http://..."`) when using `curl` to avoid "zsh: no matches found" errors.

---

## 🛠️ Base Request Parameters

These apply to all requests.

| Parameter | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `page` | `Number` | Page number (Default: 1). **Logic**: Skips `(page-1) * limit`. | `?page=2` |
| `limit` | `Number` | Records per page (Default: 10). | `?limit=50` |
| `fromDate` | `Date` (ISO) | Filters items created **on or after** this date. | `?fromDate=2024-01-01` |
| `toDate` | `Date` (ISO) | Filters items created **on or before** this date. | `?toDate=2024-12-31` |
| `globalSearch` | `String` | Fuzzy search across: Name, ID, Category, Descriptions. | `?globalSearch=Engagement` |
| `searchField` | `String` | Specific field to search in. | `?searchField=jewelryName` |
| `search` | `String` | Value for `searchField`. | `?search=Camille` |
| **`diamondType`** | `Enum` | **CRITICAL**: Controls price logic. `Natural` (default) or `Lab`. | `?diamondType=Lab` |

---

## 💎 Dynamic Pricing & Sorting

The backend dynamically selects the price path based on `diamondType`.

| Parameter | Values | Description |
| :--- | :--- | :--- |
| `minPrice` | `Number` | Minimum price filter. |
| `maxPrice` | `Number` | Maximum price filter. |
| `priceSort` | `lowToHigh` | Sort by Lowest "Starting At" Price. |
| `priceSort` | `highToLow` | Sort by Highest "Starting At" Price. |

**Logic Table:**
| Diamond Type Context | Field Used |
| :--- | :--- |
| `?diamondType=Natural` (Default) | `pricing.metalPricing.grandTotal.natural` |
| `?diamondType=Lab` | `pricing.metalPricing.grandTotal.lab` |



### 🔍 Response Metadata: `priceRange`
The API now returns a `priceRange` object in the root response, calculated **based on current filters** (excluding the price filter itself). Use this to power your price slider.

```json
{
  "priceRange": {
    "min": 500,
    "max": 15000
  }
}
```

---

## 🎨 Jewelry Attribute Filters (Aliases)

We map user-friendly query parameters to complex nested database paths.

### 1. Classification & Style
| Parameter | Mapped Path | Description | Example |
| :--- | :--- | :--- | :--- |
| **`style`** | `subCategory.value` | Filter by the "Style" tab options. | `?style=Forever` |
| **`subType`** | `subType` | **Smart Filter**: Accepts ID **OR** Name. | `?subType=Curved` |
| **`subTypeModel`** | `subTypeModel` | **Optional if category is set**. The collection to lookup. | `?subTypeModel=weddingbandssubtypelist` |
| `category` | `category.value` | Main category. | `?category=Rings` |
| `subCategory` | `subCategory.value` | Sub-category name. | `?subCategory=Solitaire` |
| `occasion` | `occasionNames` | Occasion tagging. | `?occasion=Anniversary` |
| `relation` | `relationshipNames` | Relationship tagging. | `?relation=Wife` |

### 2. Physical Specifications
| Parameter | Mapped Path | Description | Example |
| :--- | :--- | :--- | :--- |
| `shape` | `stoneRateData.shape` | Diamond Shape. | `?shape=Round` |
| `carat` | `caratWeight` | Total Carat Weight. | `?carat=1.5` |
| `width` | `averageWidth` | Band width in mm. | `?width=2.5` |
| `metal` | `availableMetals.metalType` | Full metal string. | `?metal=18K White Gold` |
| `metalType` | `availableMetals.metalType` | Metal shorthand. | `?metalType=18K` |
| `metalColor` | `availableMetals.metalType` | Metal color search. | `?metalColor=*Rose*` |

### 3. Identity & Inventory
| Parameter | Mapped Path | Description | Example |
| :--- | :--- | :--- | :--- |
| `id` | `jewelryId` | Custom Jewelry ID. | `?id=J-1001` |
| `name` | `jewelryName` | Product Name. | `?name=Camille` |
| `stock` | `stockQuantity` | Exact stock count. | `?stock=5` |
| `onSale` | `sale.saleActive` | Sale status boolean. | `?onSale=true` |

---

## � Advanced Search Capabilities

### 1. Wildcards (Partial Match)
Use `*` to perform a case-insensitive "contains" search on any string field.
*   `?metalColor=*Yellow*` → Matches "14K Yellow Gold", "18K Yellow Gold".
*   `?name=*Ring*` → Matches "Engagement Ring", "Ring Setting".

### 2. Multiple Values (OR Logic)
Pass a parameter multiple times to select **ANY** of the values.
*   `?shape=Round&shape=Pear` → Returns items that are Round **OR** Pear.
*   `?style=Forever&style=Essence` → Returns items in Forever **OR** Essence style.

### 3. Date Ranges
Filter by creation date using `fromDate` and `toDate`.
*   **New Arrivals (Last 30 Days)**: `?fromDate=2025-12-01`

---

## 🚀 Complete Implementation Examples

### 1. "Style" Slider Filter (Frontend Use Case)
Scenario: User clicks "Forever" style on the Wedding Bands page.
```bash
curl -s "http://localhost:3000/api/jewelry?category=Wedding%20Bands&style=Forever"
```

### 2. User Filters by Price & Diamond Type
Scenario: User selects "Lab Grown" and sets budget max $1500.
```bash
curl -s "http://localhost:3000/api/jewelry?diamondType=Lab&maxPrice=1500&priceSort=lowToHigh"
```

### 3. Complex Multi-Attribute Search
Scenario: Finding a "Round" or "Oval" Engagement Ring in "Rose Gold".
```bash
curl -s "http://localhost:3000/api/jewelry?category=Engagement%20Ring&shape=Round&shape=Oval&metalColor=*Rose*"
```

### 4. SubType Lookup by Name (Resolved Internally)
Scenario: "Curved" wedding bands (Server looks up the ID for "Curved").
```bash
curl -s "http://localhost:3000/api/jewelry?subType=Curved&subTypeModel=weddingbandssubtypelist"
```

### 5. Pagination (Page 2)
Scenario: Loading next 20 items.
```bash
curl -s "http://localhost:3000/api/jewelry?page=2&limit=20"
```

---

## 💡 Technical Notes for Developers
1.  **Field Validations**: The API validates that fields exist in the schema. Invalid fields are ignored.
2.  **ObjectId Handling**: When filtering by aliases like `subType`, the backend automatically attempts to cast strings to MongoDB `ObjectId` if applicable.
3.  **Array Filtering**: For array fields (like `availableMetals`), if **any** element in the array matches your criteria, the parent document is returned.
4.  **Prefix Matching**: Pagination `skip` is calculated as `(page - 1) * limit`.
5.  **Soft Deletes**: Automatically filters out `isDeleted: true` documents unless specified otherwise.
