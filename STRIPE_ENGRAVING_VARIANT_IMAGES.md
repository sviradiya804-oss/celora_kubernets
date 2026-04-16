# Stripe Checkout Engraving & Variant Images Update

## Date: October 7, 2025

## Summary
Updated the Stripe checkout to include:
1. **Engraving details** in product name, description, and metadata
2. **Variant-specific images** based on selected metal type/color
3. **Additional metadata** for better order tracking

---

## 1. Engraving Details in Stripe Checkout ✅

### Product Name Enhancement
The product name now includes engraving text:
```javascript
// Before: "test ring"
// After:  "test ring (Engraved: "Forever Yours")"
```

### Product Description Enhancement
Engraving details are included with ✨ emoji for visibility:
```javascript
// Example description:
"Beautiful engagement ring | Metal: 18K White Gold | Size: 7 | 
Diamond: 1.5 carat | ✨ Engraved: "Forever Yours" | Font: Script | Position: Inside Band"
```

### Stripe Metadata
Engraving information is stored in metadata for order processing:
```javascript
metadata: {
  productId: "...",
  category: "Engagement Ring",
  engraving: "Forever Yours (Script font, Inside Band position)",
  metalType: "18K White Gold",
  ringSize: "7",
  variant: "{...full variant JSON...}"
}
```

### Engraving Sources
The system checks multiple locations for engraving data:
1. `item.engravingOptions.engravingText` (primary)
2. `item.selectedVariant.selectedOptions.engraving.text` (fallback)

### Data Captured:
- **Text**: The actual engraving text
- **Font**: Font style (Script, Block, etc.)
- **Position**: Where it's engraved (Inside Band, Outside Band, etc.)

---

## 2. Variant-Specific Images ✅

### Image Selection Priority
The `getProductImages()` function now follows this priority:

1. **Variant-Specific Images** (Highest Priority)
   - Checks `product.availableMetals[].image` based on selected `metaldetail`
   - Checks `product.availableMetals[].images[]` array
   
2. **Metal Type Matching**
   - Searches product images for filenames containing metal type
   - Example: If metal is "18K White Gold", looks for images with "white" in URL
   
3. **Primary Image** (Fallback)
   - Uses `product.imageUrl`
   
4. **Additional Images**
   - Uses `product.images[]` array
   
5. **Gallery Images** (Last Resort)
   - Uses `product.gallery[]` array

### Example Logic:
```javascript
// If user selects "18K White Gold" variant:
// 1. Try to find metal-specific image from availableMetals
// 2. Search images for URLs containing "white"
// 3. Fallback to primary product image
// 4. Add more images up to Stripe's 8 image limit
```

### Image Validation:
- Only valid HTTP/HTTPS URLs are included
- Maximum 8 images (Stripe limit)
- Duplicates are automatically removed

---

## 3. Enhanced Metadata in Stripe

### Additional Fields Now Included:
```javascript
metadata: {
  productId: "68e22c2ee0c63062982a65cd",
  category: "Engagement Ring",
  variant: "{full variant JSON}",
  sku: "product-sku-123",
  engraving: "Forever Yours (Script font, Inside Band position)",
  metalType: "18K White Gold",
  ringSize: "7"
}
```

### Benefits:
- **Order Processing**: Easy access to engraving requirements
- **Production Team**: Clear visibility of customization needs
- **Customer Service**: Quick reference for order details
- **Inventory**: Track which variants are popular

---

## 4. Updated Functions

### `buildProductDescription(product, cartItem)`
**Location:** `src/routes/cart.js` ~line 1620

**Enhanced to include:**
- Metal type from customizations
- Ring size
- Center stone details (carat, color, clarity)
- Engraving text with ✨ emoji
- Font and position details
- Category, weight, dimensions

### `getProductImages(product, selectedVariant)`
**Location:** `src/routes/cart.js` ~line 1680

**Now accepts:**
- `product`: Product object
- `selectedVariant`: Selected variant with metal/customization options

**Returns:**
- Array of up to 8 variant-specific image URLs

### Checkout Endpoint Updates
**Location:** `src/routes/cart.js` ~line 1108-1155

**Changes:**
- Product name includes engraving text
- Calls `getProductImages()` with variant parameter
- Adds engraving, metalType, and ringSize to metadata
- Converts complex objects to strings for Stripe compliance

---

## 5. Testing Examples

### Test Case 1: Product with Engraving
```bash
curl --location 'http://localhost:3000/api/cart/checkout' \
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

**Expected Stripe Checkout:**
- Product Name: `test ring (Engraved: "Forever Yours")`
- Description: Includes engraving details with ✨
- Metadata: Contains full engraving info
- Images: Variant-specific images for "18K White Gold"

---

## 6. API Request Format

### Cart Item with Engraving:
```json
{
  "sessionId": "xxx",
  "userId": "xxx",
  "productId": "xxx",
  "quantity": 1,
  "selectedOptions": {
    "centerStone": {
      "carat": 1.5,
      "color": "D",
      "clarity": "VS1"
    },
    "engraving": {
      "text": "Forever Yours",
      "font": "Script",
      "position": "Inside Band"
    },
    "metaldetail": "68afea760686a0c9081db6ad",
    "ringsize": "7"
  },
  "customizations": {
    "metalType": "18K White Gold",
    "gemstoneUpgrade": true
  },
  "engravingOptions": {
    "engravingText": "Forever Yours",
    "font": "Script"
  }
}
```

---

## 7. Stripe Checkout Display

### What Customers See:
1. **Product Image**: Shows the correct metal color variant
2. **Product Name**: "Engagement Ring (Engraved: "Forever Yours")"
3. **Description**: Full details including metal, size, diamond specs, and engraving
4. **Price**: Variant-aware pricing

### What's in Stripe Dashboard:
- All metadata fields searchable
- Engraving text clearly visible
- Metal type and ring size for fulfillment
- Variant configuration for production

---

## 8. Files Modified

1. **`src/routes/cart.js`**
   - Line ~1108-1155: Updated checkout line item creation
   - Line ~1620-1680: Enhanced `buildProductDescription()`
   - Line ~1680-1760: Enhanced `getProductImages()` with variant support

---

## 9. Future Enhancements

### Potential Additions:
1. **Engraving Preview Image**: Generate and attach preview of engraved text
2. **Font Samples**: Include font sample images in description
3. **3D Preview**: Link to 3D visualization with selected variant
4. **Engraving Cost**: Separate line item for engraving charges
5. **Rush Engraving**: Option for expedited engraving service

### Metal Variant Images:
1. **Dynamic Image Generation**: Auto-generate images for each metal type
2. **360° Views**: Include rotating product views for selected variant
3. **Comparison View**: Show multiple metal types side-by-side
4. **AR Preview**: Augmented reality try-on for selected variant

---

## 10. Troubleshooting

### If Engraving Not Showing:
1. Check `item.engravingOptions.engravingText` exists in cart
2. Check `item.selectedVariant.selectedOptions.engraving.text` exists
3. Verify metadata string length < 500 chars
4. Check Stripe dashboard for metadata

### If Wrong Images Showing:
1. Verify `selectedVariant.selectedOptions.metaldetail` is correct
2. Check if `product.availableMetals` has image field
3. Ensure image URLs are valid HTTP/HTTPS
4. Check if product images include metal type in filename

### If Metadata Errors:
1. Ensure all metadata values are strings
2. Check variant JSON is properly stringified
3. Verify category is extracted from object if needed
4. Keep metadata values under Stripe limits

---

## Success Criteria ✅

- [x] Engraving text appears in product name
- [x] Engraving details in description with ✨ emoji
- [x] Engraving metadata includes text, font, position
- [x] Variant-specific images prioritized
- [x] Metal type metadata included
- [x] Ring size metadata included
- [x] All metadata values are strings
- [x] Checkout creates successfully
- [x] Stripe session URL generated

---

## Testing Checklist

- [ ] Test with engraving text
- [ ] Test without engraving
- [ ] Test with different metal types
- [ ] Test image selection for each variant
- [ ] Verify Stripe dashboard shows metadata
- [ ] Check product name includes engraving
- [ ] Verify description formatting
- [ ] Test with long engraving text
- [ ] Test with special characters in engraving
- [ ] Verify image URLs are valid

---

## Notes
- Stripe has a limit of 8 images per product
- Metadata values must be strings (max 500 chars)
- Product names are shown prominently in checkout
- Images are displayed in order provided
- First image is the primary thumbnail
