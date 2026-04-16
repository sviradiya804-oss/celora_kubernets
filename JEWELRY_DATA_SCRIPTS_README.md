# Jewelry Data Creation Scripts

This directory contains scripts to populate your Celora backend with comprehensive jewelry data, including proper references and realistic product information.

## 📁 Files Overview

### `create-jewelry-data.js`
Main script that creates:
- 5 complete jewelry items with real references
- All necessary supporting data (categories, subcategories, collections, etc.)
- Proper MongoDB ObjectId references
- Realistic pricing, weights, and specifications

### `create-development-data.js`
Extended script that includes:
- All items from the main script
- Additional development utilities
- Database counting functions
- Command-line interface for easy management

## 🚀 Quick Start

### 1. Basic Usage
```bash
# Create all jewelry data with proper references
node create-jewelry-data.js
```

### 2. Development Usage
```bash
# Create development data
node create-development-data.js create

# Check current jewelry count
node create-development-data.js count
```

## 📊 What Gets Created

### Jewelry Items (5 items)
1. **Classic Diamond Engagement Ring** - $2,500
   - 18K White Gold, 1.0ct Diamond
   - Customizable, Featured
   
2. **Vintage Pearl Necklace** - $850
   - Sterling Silver, AAA Pearls
   - Featured item
   
3. **Men's Gold Chain Bracelet** - $1,200
   - 14K Yellow Gold
   - Customizable sizes
   
4. **Sapphire Drop Earrings** - $1,800
   - 18K White Gold, Sapphire + Diamond
   - Luxury collection
   
5. **Wedding Band Set** - $3,200
   - Platinum, Diamond accents
   - Unisex, Customizable

### Supporting Data Created
- **Categories**: Engagement, Necklace, Bracelet, Earrings, Wedding
- **Subcategories**: Solitaire, Pearl, Chain, Drop, Band
- **Collections**: Classic, Vintage, Modern, Luxury, Bridal
- **Metal Details**: Various gold purities, silver, platinum
- **Metal Colors**: White Gold, Yellow Gold, Rose Gold, etc.
- **Shapes**: Round, Oval

## 🔧 Technical Details

### Database Schema Compliance
All items are created following your existing schema structure:
- Proper ObjectId references for related collections
- UUID generation for unique identifiers
- Timestamp management (createdOn, updatedOn)
- Proper field types and validation

### Image References
Uses Azure Blob Storage URLs:
```
https://celora4images.blob.core.windows.net/jewelry/[filename]
```

### Stock Management
- Real stock quantities (3-25 items per product)
- Weight specifications in grams
- Dimensional data (length, width, height)

## 🎯 Features Included

### Customization Options
- Metal type variations
- Size options for rings and bracelets
- Engraving availability
- Length options for necklaces

### Gemstone Details
- Weight, color, clarity specifications
- Cut and shape information
- Certification details (GIA, etc.)

### Search & Filter Support
- Comprehensive tagging system
- Gender-specific categorization
- Price range variety ($450 - $4,500)
- Featured item designation

## 📋 Prerequisites

Ensure your environment has:
- MongoDB connection configured
- Required Node.js packages (mongoose, uuid)
- Proper schema.js file in `./src/models/`

## 🔍 Verification

After running the script, verify creation:

```bash
# Check count
node create-development-data.js count

# Or check in MongoDB directly
db.jewelries.count()
db.productcategories.count()
db.collections.count()
```

## 🛠 Customization

### Adding More Items
Edit the `jewelryData` array in `create-jewelry-data.js`:

```javascript
const jewelryData = [
  {
    name: "Your New Item",
    description: "Item description",
    type: "Ring", // Ring, Necklace, Bracelet, Earrings
    gender: "Female", // Male, Female, Unisex
    category: "YourCategory",
    // ... other properties
  }
];
```

### Modifying References
The script automatically creates references if they don't exist:
- Categories and subcategories
- Collections
- Metal details and colors
- Shapes

## 🔐 Environment Setup

Set your MongoDB connection:
```bash
export MONGODB_URI="mongodb://localhost:27017/celoradb"
# or
export MONGODB_URI="your-remote-mongodb-uri"
```

## 🚨 Important Notes

1. **Idempotent**: Safe to run multiple times - won't create duplicates
2. **References**: Creates proper ObjectId relationships
3. **Images**: Uses placeholder Azure URLs - update with real images
4. **Pricing**: All prices in USD, realistic market values
5. **Stock**: Realistic quantities for e-commerce testing

## 🧪 Testing Integration

After creation, test with your existing APIs:
- Common controller endpoints
- Search functionality
- Filter operations
- Wishlist integration

## 📞 Support

If you encounter issues:
1. Check MongoDB connection
2. Verify schema.js exists and is properly formatted
3. Ensure all required npm packages are installed
4. Check console output for specific error messages

---

🎉 **Ready to populate your jewelry database with realistic, comprehensive data!**
