const mongoose = require('mongoose');
const { createJewelryData } = require('./create-jewelry-data.js');

// Additional test data for development
const additionalJewelryData = [
  {
    name: "Rose Gold Tennis Bracelet",
    description: "Elegant rose gold tennis bracelet with continuous diamond line",
    type: "Bracelet",
    gender: "Female",
    category: "Bracelet",
    subCategory: "Tennis",
    collection: "Luxury",
    price: 4500.00,
    weight: 12.8,
    stockQuantity: 3,
    isFeatured: true,
    isCustomizable: false,
    tags: ["rose gold", "tennis", "diamond", "luxury"],
    images: [
      "https://celora4images.blob.core.windows.net/jewelry/rose-gold-tennis-1.jpg"
    ],
    metalDetails: {
      type: "Gold",
      purity: "18K",
      weight: 10.5,
      color: "Rose Gold"
    },
    gemstoneDetails: [{
      type: "Diamond",
      weight: 2.3,
      color: "G",
      clarity: "VS1",
      cut: "Round"
    }],
    dimensions: {
      length: 18.0,
      width: 4.0,
      height: 2.5
    }
  },
  {
    name: "Emerald Pendant Necklace",
    description: "Stunning emerald pendant with gold chain, perfect statement piece",
    type: "Necklace",
    gender: "Female",
    category: "Necklace",
    subCategory: "Pendant",
    collection: "Classic",
    price: 2800.00,
    weight: 8.5,
    stockQuantity: 7,
    isFeatured: false,
    isCustomizable: true,
    tags: ["emerald", "pendant", "gold", "statement"],
    images: [
      "https://celora4images.blob.core.windows.net/jewelry/emerald-pendant-1.jpg",
      "https://celora4images.blob.core.windows.net/jewelry/emerald-pendant-2.jpg"
    ],
    metalDetails: {
      type: "Gold",
      purity: "14K",
      weight: 6.0,
      color: "Yellow Gold"
    },
    gemstoneDetails: [{
      type: "Emerald",
      weight: 2.5,
      color: "Green",
      clarity: "VS",
      cut: "Emerald"
    }],
    dimensions: {
      length: 40.0,
      width: 12.0,
      height: 8.0
    },
    customizationOptions: {
      metalTypes: ["Yellow Gold", "White Gold", "Rose Gold"],
      chainLengths: ["16", "18", "20", "22"],
      engravingAvailable: false
    }
  },
  {
    name: "Men's Signet Ring",
    description: "Classic men's signet ring in sterling silver with customizable engraving",
    type: "Ring",
    gender: "Male",
    category: "Ring",
    subCategory: "Signet",
    collection: "Classic",
    price: 450.00,
    weight: 12.0,
    stockQuantity: 20,
    isFeatured: false,
    isCustomizable: true,
    tags: ["signet", "silver", "men", "classic"],
    images: [
      "https://celora4images.blob.core.windows.net/jewelry/signet-ring-1.jpg"
    ],
    metalDetails: {
      type: "Silver",
      purity: "925",
      weight: 12.0,
      color: "Sterling Silver"
    },
    dimensions: {
      length: 18.0,
      width: 16.0,
      height: 8.0
    },
    sizeOptions: ["8", "9", "10", "11", "12", "13"],
    customizationOptions: {
      engravingAvailable: true,
      engravingOptions: ["Initials", "Family Crest", "Custom Design"]
    }
  },
  {
    name: "Diamond Stud Earrings",
    description: "Classic diamond stud earrings, timeless and elegant",
    type: "Earrings",
    gender: "Female",
    category: "Earrings",
    subCategory: "Stud",
    collection: "Classic",
    price: 1200.00,
    weight: 2.0,
    stockQuantity: 25,
    isFeatured: true,
    isCustomizable: false,
    tags: ["diamond", "stud", "classic", "everyday"],
    images: [
      "https://celora4images.blob.core.windows.net/jewelry/diamond-studs-1.jpg"
    ],
    metalDetails: {
      type: "Gold",
      purity: "14K",
      weight: 1.0,
      color: "White Gold"
    },
    gemstoneDetails: [{
      type: "Diamond",
      weight: 1.0,
      color: "H",
      clarity: "SI1",
      cut: "Round"
    }],
    dimensions: {
      length: 6.0,
      width: 6.0,
      height: 4.0
    }
  },
  {
    name: "Vintage Art Deco Ring",
    description: "Beautiful vintage-inspired art deco ring with intricate metalwork",
    type: "Ring",
    gender: "Female",
    category: "Ring",
    subCategory: "Vintage",
    collection: "Vintage",
    price: 1800.00,
    weight: 4.5,
    stockQuantity: 5,
    isFeatured: true,
    isCustomizable: false,
    tags: ["vintage", "art deco", "unique", "intricate"],
    images: [
      "https://celora4images.blob.core.windows.net/jewelry/art-deco-ring-1.jpg",
      "https://celora4images.blob.core.windows.net/jewelry/art-deco-ring-2.jpg"
    ],
    metalDetails: {
      type: "Platinum",
      purity: "950",
      weight: 3.5,
      color: "Platinum"
    },
    gemstoneDetails: [
      {
        type: "Diamond",
        weight: 0.5,
        color: "F",
        clarity: "VVS2",
        cut: "Round"
      },
      {
        type: "Sapphire",
        weight: 0.5,
        color: "Blue",
        clarity: "VS",
        cut: "Baguette"
      }
    ],
    dimensions: {
      length: 15.0,
      width: 12.0,
      height: 8.0
    },
    sizeOptions: ["5", "6", "7", "8", "9"]
  }
];

async function createDevelopmentData() {
  try {
    console.log('🚀 Starting development data creation...\n');
    
    // First create the main jewelry data
    await createJewelryData();
    
    console.log('\n📊 Development data creation completed!');
    console.log('💎 Your jewelry database now has comprehensive sample data');
    console.log('🔧 Ready for testing and development');
    
  } catch (error) {
    console.error('❌ Error creating development data:', error);
    process.exit(1);
  }
}

// Helper function to check current jewelry count
async function checkJewelryCount() {
  try {
    const Schema = require('./src/models/schema.js');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/celoradb');
    
    const Jewelry = mongoose.models['jewelryModel'] || mongoose.model('jewelryModel', Schema['jewelry'], 'jewelries');
    const count = await Jewelry.countDocuments();
    
    console.log(`📈 Current jewelry items in database: ${count}`);
    
    if (count > 0) {
      const featured = await Jewelry.countDocuments({ isFeatured: true });
      const customizable = await Jewelry.countDocuments({ isCustomizable: true });
      console.log(`⭐ Featured items: ${featured}`);
      console.log(`🎨 Customizable items: ${customizable}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking jewelry count:', error);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'create':
    createDevelopmentData();
    break;
  case 'count':
    checkJewelryCount();
    break;
  default:
    console.log('📋 Available commands:');
    console.log('  node create-development-data.js create  - Create all development data');
    console.log('  node create-development-data.js count   - Check current jewelry count');
    process.exit(0);
}

module.exports = { createDevelopmentData, additionalJewelryData };
