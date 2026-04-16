const mongoose = require('mongoose');

// MongoDB connection configuration
const DB_CONFIG = {
  // Replace with your actual MongoDB connection string
  CONNECTION_STRING: process.env.MONGODB_URI ,
  OPTIONS: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
};

// Define Schemas
const diamondRateSchema = new mongoose.Schema({
  diamondRateId: { type: String, unique: true },
  Shapename: { type: mongoose.Schema.Types.ObjectId, ref: 'shape' },
  diamondType: {
    type: String,
    enum: ['Natural', 'Labgrown', 'NaturalGemStone', 'LabGrownGemStone'],
    required: true
  },
  color: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'colorModel'
  },
  colorName: { type: String },
  colorModel: {
    type: String,
    enum: ['shapegemstoneDR', 'shapegemstonelc'],
    required: true
  },
  shape: { type: String },
  size: { type: String, required: true },
  weight: { type: Number, required: true },
  Price: { type: Number, required: true },
  createdOn: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedOn: { type: Date },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

const shapeGemstoneDRSchema = new mongoose.Schema({
  sequence: { type: Number },
  shapegemstoneDRId: { type: String },
  name: { type: String, required: true },
  shapeCode: { type: String }, // Made optional as per your schema
  shapesubCode: [{ type: String, required: true }], // Array elements are required
  shapeImgeurl: { type: String },
  subTitle: { type: String },
  description: { type: String },
  Option: { type: String },
  isActive: { type: Boolean, default: true },
  createdOn: { type: Date }, // Removed default as per your schema
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedOn: { type: Date },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false }
});

const shapeGemstoneLCSchema = new mongoose.Schema({
  sequence: { type: Number },
  shapegemstoneLCId: { type: String },
  name: { type: String, required: true },
  shapeCode: { type: String }, // Made optional as per your schema
  shapesubCode: [{ type: String, required: true }], // Array elements are required
  shapeImgeurl: { type: String },
  subTitle: { type: String },
  description: { type: String },
  Option: { type: String },
  isActive: { type: Boolean, default: true },
  createdOn: { type: Date }, // Removed default as per your schema
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedOn: { type: Date },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDeleted: { type: Boolean, default: false }
});

// Define Models
const DiamondRate = mongoose.model('DiamondRate', diamondRateSchema, 'diamondrates');
const ShapeGemStoneDR = mongoose.model('ShapeGemStoneDR', shapeGemstoneDRSchema, 'shapegemstoneDRs');
const ShapeGemStoneLC = mongoose.model('ShapeGemStoneLC', shapeGemstoneLCSchema, 'shapegemstoneLCs');

// Database connection function
async function connectToDatabase() {
  try {
    await mongoose.connect(DB_CONFIG.CONNECTION_STRING, DB_CONFIG.OPTIONS);
    console.log('✅ Connected to MongoDB successfully');
    return true;
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    return false;
  }
}

// Function to disconnect from database
async function disconnectFromDatabase() {
  try {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB successfully');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
  }
}

// Method 1: Individual record updates (safer for error handling)
async function updateDiamondRatesWithColorNames() {
  try {
    console.log('🔄 Starting individual record updates...');
    
    // Get all diamond rates that need color name updates
    const diamondRates = await DiamondRate.find({
      color: { $exists: true },
      isDeleted: { $ne: true },
      $or: [
        { colorName: { $exists: false } },
        { colorName: null },
        { colorName: "" }
      ]
    });

    console.log(`📊 Found ${diamondRates.length} diamond rates to update`);

    let successCount = 0;
    let errorCount = 0;

    // Process each diamond rate
    for (const diamondRate of diamondRates) {
      try {
        let colorData = null;
        let colorId = diamondRate.color;
        // Convert color to ObjectId if it's a string
        if (typeof colorId === 'string') {
          try {
            colorId = mongoose.Types.ObjectId(colorId);
          } catch (e) {
            console.log(`   ⚠️ Invalid color ID format: ${diamondRate.color}`);
            errorCount++;
            continue;
          }
        }
        console.log(`🔄 Processing: ${diamondRate.diamondRateId} (${diamondRate.colorModel}) | Color ID: ${colorId} (${typeof colorId})`);
        // Fetch color data based on colorModel
        if (diamondRate.colorModel === 'shapegemstoneDR') {
          // Ensure colorId is ObjectId for lookup
          if (!(colorId instanceof mongoose.Types.ObjectId)) {
            try {
              colorId = mongoose.Types.ObjectId(colorId);
            } catch (e) {
              console.log(`   ⚠️ Invalid color ID format for DR: ${diamondRate.color}`);
              errorCount++;
              continue;
            }
          }
          colorData = await ShapeGemStoneDR.findById(colorId);
          console.log(`   📋 Looking up in shapegemstoneDR collection...`);
          console.log(colorData);
        } else if (diamondRate.colorModel === 'shapegemstonelc') {
          colorData = await ShapeGemStoneLC.findById(colorId);
          console.log(`   📋 Looking up in shapegemstonelc collection...`);
        }

        if (colorData) {
          console.log(`   📋 Found color data:`, {
            name: colorData.name,
            shapeCode: colorData.shapeCode,
            id: colorData._id
          });

          let colorName;
          
          if (colorData.name && colorData.shapeCode) {
            // Create colorName in format: "name (shapeCode)"
            colorName = `${colorData.name} (${colorData.shapeCode})`;
          } else if (colorData.name) {
            // Handle case where shapeCode is missing but name exists
            colorName = colorData.name;
          } else {
            console.log(`   ❌ Invalid color data - missing name`);
            errorCount++;
            continue;
          }
          
          // Update the diamond rate record
          const updateResult = await DiamondRate.findByIdAndUpdate(
            diamondRate._id,
            {
              colorName: colorName,
              updatedOn: new Date(),
              updatedBy: diamondRate.createdBy
            },
            { new: true }
          );

          if (updateResult) {
            console.log(`   ✅ Updated: ${diamondRate.diamondRateId} -> "${colorName}"`);
            successCount++;
          } else {
            console.log(`   ❌ Failed to update record`);
            errorCount++;
          }
        } else {
          console.log(`   ❌ Color data not found for ID: ${diamondRate.color}`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating ${diamondRate.diamondRateId}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📈 Update Summary:`);
    console.log(`✅ Successful updates: ${successCount}`);
    console.log(`❌ Failed updates: ${errorCount}`);
    console.log(`📊 Total processed: ${diamondRates.length}`);

  } catch (error) {
    console.error('❌ Error in updateDiamondRatesWithColorNames:', error);
  }
}

// Method 2: Bulk update using aggregation (better performance)
async function bulkUpdateDiamondRatesWithColorNames() {
  try {
    console.log('🔄 Starting bulk updates with aggregation...');

    // Update records with colorModel 'shapegemstoneDR'
    const drResult = await DiamondRate.aggregate([
      {
        $match: {
          colorModel: 'shapegemstoneDR',
          color: { $exists: true },
          isDeleted: { $ne: true },
          $or: [
            { colorName: { $exists: false } },
            { colorName: null },
            { colorName: "" }
          ]
        }
      },
      {
        $lookup: {
          from: 'shapegemstonedr',
          localField: 'color',
          foreignField: '_id',
          as: 'colorInfo'
        }
      },
      {
        $unwind: '$colorInfo'
      },
      {
        $addFields: {
          colorName: {
            $concat: ['$colorInfo.name', ' (', '$colorInfo.shapeCode', ')']
          },
          updatedOn: new Date()
        }
      },
      {
        $merge: {
          into: 'diamondrates',
          on: '_id',
          whenMatched: 'merge'
        }
      }
    ]);

    // Update records with colorModel 'shapegemstonelc'
    const lcResult = await DiamondRate.aggregate([
      {
        $match: {
          colorModel: 'shapegemstonelc',
          color: { $exists: true },
          isDeleted: { $ne: true },
          $or: [
            { colorName: { $exists: false } },
            { colorName: null },
            { colorName: "" }
          ]
        }
      },
      {
        $lookup: {
          from: 'shapegemstonelc',
          localField: 'color',
          foreignField: '_id',
          as: 'colorInfo'
        }
      },
      {
        $unwind: '$colorInfo'
      },
      {
        $addFields: {
          colorName: {
            $concat: ['$colorInfo.name', ' (', '$colorInfo.shapeCode', ')']
          },
          updatedOn: new Date()
        }
      },
      {
        $merge: {
          into: 'diamondrates',
          on: '_id',
          whenMatched: 'merge'
        }
      }
    ]);

    console.log('✅ Bulk update completed successfully');
    
    // Get count of updated records
    const updatedCount = await DiamondRate.countDocuments({
      colorName: { $exists: true, $ne: null, $ne: "" }
    });
    
    console.log(`📊 Total records with colorName: ${updatedCount}`);

  } catch (error) {
    console.error('❌ Error in bulk update:', error);
  }
}

// Function to test a single record (helpful for debugging)
async function testSingleRecord(diamondRateId) {
  try {
    console.log(`🔍 Testing single record: ${diamondRateId}`);
    
    const diamondRate = await DiamondRate.findOne({ diamondRateId: diamondRateId });
    
    if (!diamondRate) {
      console.log('❌ Diamond rate not found');
      return;
    }

    console.log('📋 Diamond Rate Data:', {
      id: diamondRate._id,
      diamondRateId: diamondRate.diamondRateId,
      colorModel: diamondRate.colorModel,
      color: diamondRate.color,
      currentColorName: diamondRate.colorName
    });

    let colorData = null;
    
    if (diamondRate.colorModel === 'shapegemstoneDR') {
      colorData = await ShapeGemStoneDR.findById(diamondRate.color);
      console.log('📋 Looking in shapegemstoneDR collection...');
    } else if (diamondRate.colorModel === 'shapegemstonelc') {
      colorData = await ShapeGemStoneLC.findById(diamondRate.color);
      console.log('📋 Looking in shapegemstonelc collection...');
    }

    if (colorData) {
      console.log('✅ Found color data:', {
        name: colorData.name,
        shapeCode: colorData.shapeCode,
        _id: colorData._id
      });

      let colorName;
      if (colorData.name && colorData.shapeCode) {
        colorName = `${colorData.name} (${colorData.shapeCode})`;
      } else if (colorData.name) {
        colorName = colorData.name;
      }

      console.log(`🎯 Proposed colorName: "${colorName}"`);
      
      // Actually update the record
      const updateResult = await DiamondRate.findByIdAndUpdate(
        diamondRate._id,
        {
          colorName: colorName,
          updatedOn: new Date()
        },
        { new: true }
      );

      console.log('✅ Update successful:', updateResult.colorName);
    } else {
      console.log('❌ No color data found');
    }

  } catch (error) {
    console.error('❌ Error in testSingleRecord:', error);
  }
}
// Function to verify updates
async function verifyUpdates() {
  try {
    console.log('\n🔍 Verifying updates...');
    
    const totalRecords = await DiamondRate.countDocuments({ isDeleted: { $ne: true } });
    const recordsWithColorName = await DiamondRate.countDocuments({ 
      colorName: { $exists: true, $ne: null, $ne: "" },
      isDeleted: { $ne: true }
    });
    const recordsWithoutColorName = await DiamondRate.countDocuments({
      $or: [
        { colorName: { $exists: false } },
        { colorName: null },
        { colorName: "" }
      ],
      isDeleted: { $ne: true }
    });

    console.log(`📊 Verification Results:`);
    console.log(`📈 Total active records: ${totalRecords}`);
    console.log(`✅ Records with colorName: ${recordsWithColorName}`);
    console.log(`❌ Records without colorName: ${recordsWithoutColorName}`);

    // Show some examples
    const examples = await DiamondRate.find({
      colorName: { $exists: true, $ne: null, $ne: "" }
    }).limit(5).select('diamondRateId colorName colorModel');

    console.log('\n📝 Sample updated records:');
    examples.forEach((record, index) => {
      console.log(`${index + 1}. ${record.diamondRateId}: "${record.colorName}" (${record.colorModel})`);
    });

    // Show records that still need updating
    const needUpdate = await DiamondRate.find({
      $or: [
        { colorName: { $exists: false } },
        { colorName: null },
        { colorName: "" }
      ],
      isDeleted: { $ne: true }
    }).limit(3).select('diamondRateId colorModel color');

    if (needUpdate.length > 0) {
      console.log('\n⚠️  Records still needing updates:');
      needUpdate.forEach((record, index) => {
        console.log(`${index + 1}. ${record.diamondRateId} (${record.colorModel}) - Color ID: ${record.color}`);
      });
    }

  } catch (error) {
    console.error('❌ Error in verification:', error);
  }
}

// Main execution function
async function main() {
  console.log('🚀 Starting Diamond Rates Color Name Update Process');
  console.log('================================================\n');

  // Connect to database
  const connected = await connectToDatabase();
  if (!connected) {
    console.log('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  try {
    // Test with a specific record first (uncomment to test)
    // await testSingleRecord('38b89ef9-717f-4403-840a-831157da53e3');
    
    // Choose your preferred method:
    
    // Method 1: Individual updates (recommended for smaller datasets)
    await updateDiamondRatesWithColorNames();
    
    // Method 2: Bulk updates (uncomment for better performance with large datasets)
    // await bulkUpdateDiamondRatesWithColorNames();

    // Verify the updates
    await verifyUpdates();

  } catch (error) {
    console.error('❌ Error in main process:', error);
  } finally {
    // Disconnect from database
    await disconnectFromDatabase();
    console.log('\n🏁 Process completed');
  }
}

// Export functions for modular usage
module.exports = {
  connectToDatabase,
  disconnectFromDatabase,
  updateDiamondRatesWithColorNames,
  bulkUpdateDiamondRatesWithColorNames,
  testSingleRecord,
  verifyUpdates,
  DiamondRate,
  ShapeGemStoneDR,
  ShapeGemStoneLC
};

// Run the script if called directly
if (require.main === module) {
  main().catch(console.error);
}