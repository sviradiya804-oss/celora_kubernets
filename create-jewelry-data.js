const mongoose = require('mongoose');
const Schema = require('./src/models/schema.js');
const uuid = require('uuid');
const fs = require('fs');
const path = require('path');

// Sample jewelry data with real references
const jewelryData = [
  {
    name: "Classic Diamond Engagement Ring",
    description: "Beautiful classic diamond engagement ring with solitaire setting",
    type: "Ring",
    gender: "Female",
    category: "Engagement",
    subCategory: "Solitaire",
    collection: "Classic",
    price: 2500.00,
    weight: 3.5,
    stockQuantity: 15,
    isFeatured: true,
    isCustomizable: true,
    tags: ["diamond", "engagement", "classic", "solitaire"],
    images: [
      "https://celora4images.blob.core.windows.net/jewelry/diamond-ring-1.jpg",
      "https://celora4images.blob.core.windows.net/jewelry/diamond-ring-2.jpg"
    ],
    metalDetails: {
      type: "Gold",
      purity: "18K",
      weight: 2.8,
      color: "White Gold"
    },
    gemstoneDetails: [{
      type: "Diamond",
      weight: 1.0,
      color: "D",
      clarity: "VS1",
      cut: "Round",
      certification: "GIA"
    }],
    dimensions: {
      length: 12.5,
      width: 8.2,
      height: 6.1
    },
    sizeOptions: ["5", "6", "7", "8", "9"],
    customizationOptions: {
      metalTypes: ["White Gold", "Yellow Gold", "Rose Gold", "Platinum"],
      gemstoneOptions: ["Diamond", "Emerald", "Ruby", "Sapphire"],
      engravingAvailable: true
    }
  },
  {
    name: "Vintage Pearl Necklace",
    description: "Elegant vintage-style pearl necklace perfect for special occasions",
    type: "Necklace",
    gender: "Female",
    category: "Necklace",
    subCategory: "Pearl",
    collection: "Vintage",
    price: 850.00,
    weight: 25.0,
    stockQuantity: 8,
    isFeatured: true,
    isCustomizable: false,
    tags: ["pearl", "vintage", "necklace", "elegant"],
    images: [
      "https://celora4images.blob.core.windows.net/jewelry/pearl-necklace-1.jpg",
      "https://celora4images.blob.core.windows.net/jewelry/pearl-necklace-2.jpg"
    ],
    metalDetails: {
      type: "Silver",
      purity: "925",
      weight: 5.0,
      color: "Sterling Silver"
    },
    gemstoneDetails: [{
      type: "Pearl",
      weight: 20.0,
      color: "White",
      clarity: "AAA",
      cut: "Round",
      size: "8-9mm"
    }],
    dimensions: {
      length: 45.0,
      width: 9.0,
      height: 9.0
    }
  },
  {
    name: "Men's Gold Chain Bracelet",
    description: "Stylish gold chain bracelet for men with secure clasp",
    type: "Bracelet",
    gender: "Male",
    category: "Bracelet",
    subCategory: "Chain",
    collection: "Modern",
    price: 1200.00,
    weight: 15.5,
    stockQuantity: 12,
    isFeatured: false,
    isCustomizable: true,
    tags: ["gold", "chain", "bracelet", "men"],
    images: [
      "https://celora4images.blob.core.windows.net/jewelry/gold-bracelet-1.jpg"
    ],
    metalDetails: {
      type: "Gold",
      purity: "14K",
      weight: 15.5,
      color: "Yellow Gold"
    },
    dimensions: {
      length: 20.0,
      width: 8.0,
      height: 3.0
    },
    sizeOptions: ["7", "7.5", "8", "8.5", "9"],
    customizationOptions: {
      metalTypes: ["Yellow Gold", "White Gold", "Rose Gold"],
      engravingAvailable: true,
      lengthOptions: ["7", "7.5", "8", "8.5", "9"]
    }
  },
  {
    name: "Sapphire Drop Earrings",
    description: "Stunning blue sapphire drop earrings with diamond accents",
    type: "Earrings",
    gender: "Female",
    category: "Earrings",
    subCategory: "Drop",
    collection: "Luxury",
    price: 1800.00,
    weight: 4.2,
    stockQuantity: 6,
    isFeatured: true,
    isCustomizable: false,
    tags: ["sapphire", "diamond", "earrings", "luxury"],
    images: [
      "https://celora4images.blob.core.windows.net/jewelry/sapphire-earrings-1.jpg",
      "https://celora4images.blob.core.windows.net/jewelry/sapphire-earrings-2.jpg"
    ],
    metalDetails: {
      type: "Gold",
      purity: "18K",
      weight: 2.2,
      color: "White Gold"
    },
    gemstoneDetails: [
      {
        type: "Sapphire",
        weight: 1.5,
        color: "Blue",
        clarity: "VS",
        cut: "Oval"
      },
      {
        type: "Diamond",
        weight: 0.5,
        color: "G",
        clarity: "VS2",
        cut: "Round"
      }
    ],
    dimensions: {
      length: 25.0,
      width: 8.0,
      height: 6.0
    }
  },
  {
    name: "Wedding Band Set",
    description: "Matching wedding band set for couples with diamond details",
    type: "Ring",
    gender: "Unisex",
    category: "Wedding",
    subCategory: "Band",
    collection: "Bridal",
    price: 3200.00,
    weight: 8.0,
    stockQuantity: 4,
    isFeatured: true,
    isCustomizable: true,
    tags: ["wedding", "band", "couple", "diamond"],
    images: [
      "https://celora4images.blob.core.windows.net/jewelry/wedding-bands-1.jpg",
      "https://celora4images.blob.core.windows.net/jewelry/wedding-bands-2.jpg"
    ],
    metalDetails: {
      type: "Platinum",
      purity: "950",
      weight: 8.0,
      color: "Platinum"
    },
    gemstoneDetails: [{
      type: "Diamond",
      weight: 0.3,
      color: "F",
      clarity: "VS1",
      cut: "Round"
    }],
    dimensions: {
      length: 12.0,
      width: 4.0,
      height: 2.0
    },
    sizeOptions: ["4", "5", "6", "7", "8", "9", "10", "11", "12"],
    customizationOptions: {
      metalTypes: ["Platinum", "White Gold", "Yellow Gold", "Rose Gold"],
      widthOptions: ["2mm", "3mm", "4mm", "5mm", "6mm"],
      engravingAvailable: true
    }
  }
];

async function createJewelryData() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/celoradb');
    console.log('Connected to database');

    // Get required models
    const Jewelry = mongoose.models['jewelryModel'] || mongoose.model('jewelryModel', Schema['jewelry'], 'jewelries');
    const ProductCategory = mongoose.models['productcategoryModel'] || mongoose.model('productcategoryModel', Schema['productcategory'], 'productcategories');
    const ProductSubCategory = mongoose.models['productsubcategoryModel'] || mongoose.model('productsubcategoryModel', Schema['productsubcategory'], 'productsubcategories');
    const Collection = mongoose.models['collectionModel'] || mongoose.model('collectionModel', Schema['collection'], 'collections');
    const MetalDetail = mongoose.models['metaldetailModel'] || mongoose.model('metaldetailModel', Schema['metaldetail'], 'metaldetails');
    const MetalColor = mongoose.models['metalcolorModel'] || mongoose.model('metalcolorModel', Schema['metalcolor'], 'metalcolors');
    const Shape = mongoose.models['shapeModel'] || mongoose.model('shapeModel', Schema['shape'], 'shapes');

    // Get existing references or create them
    const references = {};

    // Get or create categories
    const categories = ['Engagement', 'Necklace', 'Bracelet', 'Earrings', 'Wedding'];
    for (const categoryName of categories) {
      let category = await ProductCategory.findOne({ name: categoryName });
      if (!category) {
        category = await ProductCategory.create({
          productcategoryId: uuid.v1(),
          referenceId: uuid.v1(),
          name: categoryName,
          description: `${categoryName} jewelry category`,
          createdOn: new Date().toISOString(),
          updatedOn: new Date().toISOString()
        });
        console.log(`Created category: ${categoryName}`);
      }
      references[categoryName] = category._id;
    }

    // Get or create subcategories
    const subcategories = ['Solitaire', 'Pearl', 'Chain', 'Drop', 'Band'];
    for (const subCategoryName of subcategories) {
      let subCategory = await ProductSubCategory.findOne({ name: subCategoryName });
      if (!subCategory) {
        subCategory = await ProductSubCategory.create({
          productsubcategoryId: uuid.v1(),
          referenceId: uuid.v1(),
          name: subCategoryName,
          description: `${subCategoryName} jewelry subcategory`,
          createdOn: new Date().toISOString(),
          updatedOn: new Date().toISOString()
        });
        console.log(`Created subcategory: ${subCategoryName}`);
      }
      references[subCategoryName] = subCategory._id;
    }

    // Get or create collections
    const collections = ['Classic', 'Vintage', 'Modern', 'Luxury', 'Bridal'];
    for (const collectionName of collections) {
      let collection = await Collection.findOne({ name: collectionName });
      if (!collection) {
        collection = await Collection.create({
          collectionId: uuid.v1(),
          referenceId: uuid.v1(),
          name: collectionName,
          description: `${collectionName} jewelry collection`,
          createdOn: new Date().toISOString(),
          updatedOn: new Date().toISOString()
        });
        console.log(`Created collection: ${collectionName}`);
      }
      references[collectionName] = collection._id;
    }

    // Get or create metal details
    const metalTypes = [
      { type: 'Gold', purity: '18K', color: 'White Gold' },
      { type: 'Silver', purity: '925', color: 'Sterling Silver' },
      { type: 'Gold', purity: '14K', color: 'Yellow Gold' },
      { type: 'Platinum', purity: '950', color: 'Platinum' }
    ];
    
    for (const metal of metalTypes) {
      let metalDetail = await MetalDetail.findOne({ 
        metalType: metal.type, 
        purity: metal.purity 
      });
      if (!metalDetail) {
        metalDetail = await MetalDetail.create({
          metaldetailId: uuid.v1(),
          referenceId: uuid.v1(),
          metalType: metal.type,
          purity: metal.purity,
          description: `${metal.purity} ${metal.type}`,
          createdOn: new Date().toISOString(),
          updatedOn: new Date().toISOString()
        });
        console.log(`Created metal detail: ${metal.purity} ${metal.type}`);
      }
      references[`${metal.type}_${metal.purity}`] = metalDetail._id;
    }

    // Get or create metal colors
    const metalColors = ['White Gold', 'Yellow Gold', 'Rose Gold', 'Sterling Silver', 'Platinum'];
    for (const colorName of metalColors) {
      let metalColor = await MetalColor.findOne({ colorName: colorName });
      if (!metalColor) {
        metalColor = await MetalColor.create({
          metalcolorId: uuid.v1(),
          referenceId: uuid.v1(),
          colorName: colorName,
          description: `${colorName} color`,
          createdOn: new Date().toISOString(),
          updatedOn: new Date().toISOString()
        });
        console.log(`Created metal color: ${colorName}`);
      }
      references[colorName] = metalColor._id;
    }

    // Get or create shapes
    const shapes = ['Round', 'Oval'];
    for (const shapeName of shapes) {
      let shape = await Shape.findOne({ name: shapeName });
      if (!shape) {
        shape = await Shape.create({
          shapeId: uuid.v1(),
          referenceId: uuid.v1(),
          name: shapeName,
          description: `${shapeName} shape`,
          createdOn: new Date().toISOString(),
          updatedOn: new Date().toISOString()
        });
        console.log(`Created shape: ${shapeName}`);
      }
      references[shapeName] = shape._id;
    }

    // Create jewelry items
    const createdJewelry = [];
    
    for (const item of jewelryData) {
      // Map references
      const jewelryItem = {
        jewelryId: uuid.v1(),
        referenceId: uuid.v1(),
        name: item.name,
        description: item.description,
        type: item.type,
        gender: item.gender,
        category: references[item.category],
        subCategory: references[item.subCategory],
        collection: references[item.collection],
        price: item.price,
        weight: item.weight,
        stockQuantity: item.stockQuantity,
        isFeatured: item.isFeatured,
        isCustomizable: item.isCustomizable,
        tags: item.tags,
        images: item.images,
        metalDetail: references[`${item.metalDetails.type}_${item.metalDetails.purity}`],
        metalColor: references[item.metalDetails.color],
        metalWeight: item.metalDetails.weight,
        dimensions: item.dimensions,
        sizeOptions: item.sizeOptions || [],
        customizationOptions: item.customizationOptions || {},
        createdOn: new Date().toISOString(),
        updatedOn: new Date().toISOString(),
        isDeleted: false
      };

      // Add gemstone details if available
      if (item.gemstoneDetails && item.gemstoneDetails.length > 0) {
        jewelryItem.gemstones = item.gemstoneDetails.map(gem => ({
          type: gem.type,
          weight: gem.weight,
          color: gem.color,
          clarity: gem.clarity,
          cut: gem.cut,
          shape: references[gem.cut] || null,
          certification: gem.certification,
          size: gem.size
        }));
      }

      const created = await Jewelry.create(jewelryItem);
      createdJewelry.push(created);
      console.log(`Created jewelry: ${item.name}`);
    }

    console.log(`\n✅ Successfully created ${createdJewelry.length} jewelry items`);
    console.log(`✅ Created ${Object.keys(references).length} reference items`);
    
    // Display created items
    console.log('\n📋 Created Jewelry Items:');
    createdJewelry.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} - $${item.price} (ID: ${item.jewelryId})`);
    });

    console.log('\n🎯 All jewelry data created successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error creating jewelry data:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createJewelryData();
}

module.exports = { createJewelryData, jewelryData };
