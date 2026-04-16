# Shape-Based Image Selection for Stripe Checkout

## Date: October 7, 2025

## Summary
Updated the Stripe checkout to display images based on the **selected center stone shape** (oval, round, pear, cushion, marquise, etc.) from the jewelry product.

---

## How It Works

### Image Selection Priority (in order):

1. **Selected Shape from Cart** (Highest Priority)
   - Checks `selectedVariant.selectedOptions.centerStone.shape`
   - Checks `selectedVariant.selectedOptions.centerStone.shapeValue`

2. **Product's Default Shape**
   - Uses `product.stoneConfiguration.shapeValue`

3. **First Available Shape**
   - Uses first item from `product.availableShapes[0].name`
   - Or uses `product.availableShapes[0].shapeCode`

4. **First Available Shape Images**
   - If product has shape-organized images, uses first available

5. **Metal-Specific Images**
   - Images from `availableMetals[].image`
   - Images from `availableMetals[].images[]`

6. **Metal Color Match**
   - Searches for metal type in image URLs

7. **Primary Image** (Fallback)
   - Uses `product.imageUrl`

8. **All Available Images**
   - Uses `product.images[]` or all shape images

9. **Gallery Images** (Last Resort)
   - Uses `product.gallery[]`

---

## Image Organization Structure

### Jewelry Product Schema:
```javascript
{
  "images": {
    "oval": [
      "https://celora4images.blob.core.windows.net/jewelry/xxx-oval-a.png",
      "https://celora4images.blob.core.windows.net/jewelry/xxx-oval-b.png",
      "https://celora4images.blob.core.windows.net/jewelry/xxx-oval-c.png"
    ],
    "round": [
      "https://celora4images.blob.core.windows.net/jewelry/xxx-round-a.png",
      "https://celora4images.blob.core.windows.net/jewelry/xxx-round-b.png"
    ],
    "pear": [...],
    "cushion": [...],
    "marquise": [...]
  },
  "availableShapes": [
    {
      "enabled": true,
      "shape": "68aea5ef0686a0c9081cac4b",
      "name": "MARQUISE",
      "_id": "68e22c2ee0c63062982a65d5"
    }
  ]
}
```

---

## Shape Matching Logic

### Exact Match:
```javascript
// If selected shape is "marquise"
// Looks for product.images["marquise"]
```

### Partial Match:
```javascript
// If selected shape is "Round Brilliant"
// Matches product.images["round"]

// If selected shape is "oval"
// Matches "Oval", "OVAL", "oval brilliant", etc.
```

### Case-Insensitive:
- All shape names are normalized to lowercase
- Trims whitespace for accurate matching

---

## Updated Function

### Location: `src/routes/cart.js` ~line 1688

```javascript
function getProductImages(product, selectedVariant) {
  const images = [];
  
  // Get shape from cart selection, product config, or first available
  let selectedShape = null;
  
  if (selectedVariant?.selectedOptions?.centerStone?.shape) {
    selectedShape = selectedVariant.selectedOptions.centerStone.shape;
  }
  else if (product.stoneConfiguration?.shapeValue) {
    selectedShape = product.stoneConfiguration.shapeValue;
  }
  else if (product.availableShapes?.length > 0) {
    selectedShape = product.availableShapes[0].name || 
                   product.availableShapes[0].shapeCode;
  }
  
  // Match shape images...
  if (selectedShape) {
    selectedShape = selectedShape.toLowerCase().trim();
    
    // Exact match
    if (product.images[selectedShape]) {
      // Add all images for this shape
    }
    
    // Partial match
    Object.keys(product.images).forEach(shapeKey => {
      if (shapeKey.includes(selectedShape) || 
          selectedShape.includes(shapeKey)) {
        // Add matching images
      }
    });
  }
  
  // Fallback to first available shape images
  if (images.length === 0) {
    const firstShapeKey = Object.keys(product.images)[0];
    // Use first shape images
  }
  
  // Continue with metal images, primary image, etc.
  // ...
}
```

---

## Example: How Images Are Selected

### Scenario 1: Shape Selected in Cart
```javascript
// Cart item has:
selectedVariant: {
  selectedOptions: {
    centerStone: {
      shape: "oval",  // <-- Shape selected
      carat: 1.5
    }
  }
}

// Result: Uses product.images["oval"] array
// Shows oval-specific product images in Stripe
```

### Scenario 2: No Shape in Cart, Uses Product Default
```javascript
// Cart doesn't have shape, but product has:
stoneConfiguration: {
  shapeValue: "round"
}

// Result: Uses product.images["round"] array
// Shows round-specific product images in Stripe
```

### Scenario 3: Uses First Available Shape
```javascript
// No shape in cart or config, but:
availableShapes: [
  { name: "MARQUISE", enabled: true }
]

// Result: Uses product.images["marquise"] array (case-insensitive)
// Shows marquise-specific product images in Stripe
```

### Scenario 4: No Shape Data Available
```javascript
// No shape info anywhere

// Result: Uses first available shape images from product.images object
// If product.images = { oval: [...], round: [...] }
// Uses product.images["oval"] (first key)
```

---

## Console Logging

The function now logs:
```javascript
console.log("Looking for images for shape:", selectedShape);
console.log("Added shape-specific image:", img);
console.log("Added partial shape match image:", img);
console.log("Using first available shape images:", firstShapeKey);
```

Check server console to see which shape is being used!

---

## Testing Examples

### Test Case 1: With Shape in Cart
```javascript
// Add to cart with shape
{
  "productId": "68e22c2ee0c63062982a65cd",
  "selectedOptions": {
    "centerStone": {
      "shape": "oval",  // <-- Specify shape
      "carat": 1.5
    },
    "metaldetail": "68afea760686a0c9081db6ad",
    "ringsize": "7"
  }
}

// Checkout shows: Oval-specific images
```

### Test Case 2: No Shape in Cart
```javascript
// Add to cart without shape
{
  "productId": "68e22c2ee0c63062982a65cd",
  "selectedOptions": {
    "centerStone": {
      "carat": 1.5
    }
  }
}

// Checkout shows: First available shape images (from product)
```

---

## Shape Names Supported

Based on your product structure:
- `oval` - Oval shapes
- `round` - Round shapes
- `pear` - Pear shapes
- `cushion` - Cushion shapes
- `marquise` - Marquise shapes
- `emerald` - Emerald cut (if available)
- `princess` - Princess cut (if available)
- `radiant` - Radiant cut (if available)
- And any other shapes in `product.images` object

---

## Current Behavior

### Product: test ring (ID: 68e22c2ee0c63062982a65cd)
- Has images organized by: `oval`, `round`, `pear`, `cushion`
- Available shapes: `MARQUISE`
- Since cart doesn't have shape selected, uses first available

**Result in Stripe:**
- Shows images from first available shape in `product.images`
- Includes engraving details: `(Engraved: "Forever Yours")`
- Shows metal type: `18K White Gold`

---

## To Add Shape Selection in Cart

Update the add-to-cart request:
```javascript
{
  "sessionId": "xxx",
  "userId": "xxx",
  "productId": "68e22c2ee0c63062982a65cd",
  "selectedOptions": {
    "centerStone": {
      "shape": "oval",        // <-- Add this
      "shapeValue": "Oval",   // <-- Or this
      "carat": 1.5,
      "color": "D",
      "clarity": "VS1"
    },
    "metaldetail": "68afea760686a0c9081db6ad",
    "ringsize": "7"
  }
}
```

---

## Files Modified

1. **`src/routes/cart.js`**
   - Line ~1688-1835: Updated `getProductImages()` function
   - Added shape detection logic
   - Added fallback to first available shape
   - Improved matching for shape names

---

## Benefits

✅ **Accurate Product Display**: Shows correct shape images in Stripe
✅ **Flexible Fallbacks**: Works even without shape selection
✅ **Better Customer Experience**: Customers see exactly what they're ordering
✅ **Shape Variety**: Supports all shapes in product catalog
✅ **Case-Insensitive**: Handles "OVAL", "Oval", "oval" equally
✅ **Partial Matching**: "Round Brilliant" matches "round"

---

## Success Criteria

- [x] Detects shape from cart selection
- [x] Falls back to product configuration
- [x] Falls back to first available shape
- [x] Uses first shape images if no match
- [x] Case-insensitive matching
- [x] Partial name matching
- [x] Console logging for debugging
- [x] Handles missing shape gracefully
- [x] Prioritizes shape over metal images
- [x] Works with existing engraving features

---

## Future Enhancements

1. **Shape Selection UI**: Add shape selector in frontend
2. **Shape Preview**: Show shape-specific preview before adding to cart
3. **Shape Validation**: Ensure selected shape is available for product
4. **Shape-Metal Combinations**: Show specific images for shape+metal combos
5. **Shape Metadata**: Include shape name in Stripe metadata

---

## Troubleshooting

### If wrong shape images showing:
1. Check server console for: `"Looking for images for shape: xxx"`
2. Verify shape name matches a key in `product.images`
3. Check `product.availableShapes[0].name`
4. Verify images array has valid URLs

### If no images showing:
1. Check if `product.images` is an object with shape keys
2. Verify image URLs start with `http` or `https`
3. Check if images array is empty
4. Verify Stripe session was created successfully

### If wrong shape detected:
1. Check cart item's `centerStone.shape` value
2. Verify product's `stoneConfiguration.shapeValue`
3. Check `availableShapes` array
4. Look at console logs for actual shape used
