const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const mongoose = require('mongoose');
const schemas = require('../src/models/schema');
const ApiError = require('../src/utils/ApiError');
const path = require('path');

const shapegemstoneDR = mongoose.model('shapegemstoneDR', new mongoose.Schema(schemas.shapegemstoneDR));
const shapegemstonelc = mongoose.model('shapegemstonelc', new mongoose.Schema(schemas.shapegemstonelc));
const DiamondRate = mongoose.model('DiamondRate', new mongoose.Schema(schemas.diamondRates));
const Shape = mongoose.model('shape', new mongoose.Schema(schemas.shape));

// Global color code mapping
const COLOR_CODE_MAP = {
  BS: 'Black Sapphire (DRBLS)',
  WS: 'White Sapphire (DRWS)',
  PS: 'Pink Sapphire (DRPS)',
  YS: 'Yellow Sapphire (DRYS)',
  BD: 'Blue Diamond(DRBD)',
  RD: 'Red Diamond(DRRD)', // Fixed typo: "Diamonf" -> "Diamond"
  BL: 'Black Diamond(DRBLD)',
  EM: 'Emerald (DREM)',
  RY: 'Ruby (DRRY)',
  K:  'White Diamond (K)',
  CV: 'Lab White Diamond (CV)',
  MG: 'Morganite (DRMG)',
  PD: 'Peridot (DRPD)',
  CT: 'Citrine(DRCT)',
  GN: 'Garnet(DRGN)',
  TZ: 'Tanzanite (DRTZ)',
  AQ: 'Aquamarine (DRAQ)',
  AM: 'Amethyst (DRAM)',
  BT: 'Blue Topaz(DRBT)',
  CD: 'Champagne Diamond(DRCD)',
  LCBS: 'Blue Sapphire (LCBS)',
  LCPS: 'Pink Sapphire (LCPS)',
  LCWS: 'White Sapphire(LCWS)',
  LCRY: 'Ruby(LCRY)',
  DRCT: 'Citrine (DRCT)',
};

exports.importDiamondRate = async (req, res, next) => {
   
  try {
    const { source, diamond_type } = req.body;
     // Debug: Log received diamond_type and source
    console.log('[DEBUG] importDiamondRate received:', {
      diamond_type,
      source
    });
    
    if (!req.files || req.files.length === 0) {
      return next(new ApiError(400, 'No file uploaded.'));
    }

    // STEP 1: Validate and map diamond_type
    const diamondTypeFull = diamond_type;
    const diamondTypeMap = {
      'Natural': 'Natural',
      'Labgrown': 'Labgrown',
      'Natural Gem Stone': 'NaturalGemStone',
      'Lab Grown Gem Stone': 'LabGrownGemStone'
    };

    const diamondTypeCode = diamondTypeMap[diamondTypeFull];
    if (!diamondTypeCode) {
      return next(new ApiError(400, 'Invalid or missing diamond_type in form data.'));
    }

    // STEP 2: Setup color model and default colors based on diamond type
    let colorModel = null;
    let defaultColorDoc = null;
    let defaultColorName = null;
    
    if (diamondTypeCode === 'Natural') {
      colorModel = shapegemstoneDR;
      // Find White Diamond (K)
      defaultColorDoc = await colorModel.findOne({ name: /white diamond/i, shapeCode: 'K' });
      defaultColorName = 'White Diamond (K)';
      if (!defaultColorDoc) {
        return next(new ApiError(400, 'Default color White Diamond (K) not found in shapegemstoneDR.'));
      }
    } else if (diamondTypeCode === 'Labgrown') {
      colorModel = shapegemstonelc;
      // Find Lab White Diamond (CV)
      defaultColorDoc = await colorModel.findOne({ name: /lab white diamond/i, shapeCode: 'CV' });
      defaultColorName = 'Lab White Diamond (CV)';
      if (!defaultColorDoc) {
        return next(new ApiError(400, 'Default color Lab White Diamond (CV) not found in shapegemstonelc.'));
      }
    } else if (['NaturalGemStone', 'LabGrownGemStone'].includes(diamondTypeCode)) {
      if (!source || !['shapegemstoneDR', 'shapegemstonelc'].includes(source)) {
        return next(new ApiError(400, 'Source is required and must be either shapegemstoneDR or shapegemstonelc for gem stones.'));
      }
      colorModel = source === 'shapegemstoneDR' ? shapegemstoneDR : shapegemstonelc;
    }
    
    // Attach default color info to colorModel for downstream usage
    if (colorModel) {
      colorModel.defaultColorDoc = defaultColorDoc;
      colorModel.defaultColorName = defaultColorName;
    }

    // STEP 3: Parse the uploaded file
    const filePath = req.files[0].path;
    const fileExtension = filePath.split('.').pop().toLowerCase();
    
    let rows = [];

    // Parse file based on extension
    if (fileExtension === 'csv') {
      rows = await parseCSVFile(filePath);
    } else if (['xlsx', 'xls'].includes(fileExtension)) {
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    } else {
      return next(new ApiError(400, 'Unsupported file format. Please upload CSV or Excel file.'));
    }

    if (!rows || rows.length === 0) {
      return next(new ApiError(400, 'No data found in the uploaded file.'));
    }

    // STEP 4: Get shape documents from database
    const shapeDocs = await Shape.find({}, { _id: 1, name: 1 });
    const shapeNameToId = {};
    shapeDocs.forEach(doc => {
      shapeNameToId[doc.name?.trim().toUpperCase()] = doc._id;
    });

    // STEP 5: Get color documents (needed for multi-color format or gem stones)
    let keywordToId = {};
    if (colorModel) {
      const colorDocs = await colorModel.find({}, { _id: 1, like_keyword: 1 });
      colorDocs.forEach(doc => {
        if (doc.like_keyword) {
          keywordToId[doc.like_keyword.trim().toUpperCase()] = doc._id;
        }
      });
    }

    // STEP 6: Process data based on file format
    const entries = [];
    const headers = Object.keys(rows[0]);

    // Detect file structure based on headers and diamond type
    const isSimpleFormat = detectSimpleFormat(headers, diamondTypeCode);

    if (isSimpleFormat) {
      // Handle simple format (Natural: shape, size, weight, cv_rate OR Labgrown: shape, size, weight, gold_14_18k)
      const simpleEntries = await processSimpleFormat(rows, diamondTypeCode, shapeNameToId, colorModel, source || 'default');
      entries.push(...simpleEntries);
    } else {
      // Handle complex format (multiple color columns)
      const complexEntries = await processComplexFormat(rows, headers, diamondTypeCode, shapeNameToId, keywordToId, source || 'default');
      entries.push(...complexEntries);
    }

    if (entries.length === 0) {
      return next(new ApiError(400, 'No valid data found to import.'));
    }

    // STEP 7: Insert data into database
    await DiamondRate.insertMany(entries);

    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.warn('Failed to clean up uploaded file:', cleanupError);
    }

    return res.status(200).json({
      message: 'Diamond rate data imported successfully.',
      insertedCount: entries.length
    });
  } catch (err) {
    console.error('Import Error:', err);
    return next(new ApiError(500, `Failed to import diamond rate data: ${err.message}`));
  }
};

// Helper function to parse CSV file
function parseCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Helper function to create header mapping for case-insensitive access
function createHeaderMapping(headers) {
  const mapping = {};
  headers.forEach(header => {
    const normalizedKey = header.toLowerCase().trim().replace(/\s+/g, '_');
    mapping[normalizedKey] = header; // Store original header name
  });
  return mapping;
}

// Helper function to get value from row using case-insensitive header lookup
function getRowValue(row, possibleHeaders, headerMapping) {
  for (const header of possibleHeaders) {
    const normalizedHeader = header.toLowerCase().trim().replace(/\s+/g, '_');
    const originalHeader = headerMapping[normalizedHeader];
    if (originalHeader && row[originalHeader] !== undefined && row[originalHeader] !== null) {
      return row[originalHeader];
    }
  }
  return null;
}

// Helper function to detect file format
function detectSimpleFormat(headers, diamondTypeCode) {
  const headerMapping = createHeaderMapping(headers);
  const mappingKeys = Object.keys(headerMapping);
  
  if (diamondTypeCode === 'Natural') {
    // Check for Natural format: shape, size, weight, cv_rate
    const requiredHeaders = ['shape', 'size', 'weight', 'cv_rate'];
    return requiredHeaders.every(header => 
      mappingKeys.includes(header) || 
      mappingKeys.includes(header.replace('_', '')) ||
      mappingKeys.some(key => key.includes(header.replace('_', '')))
    );
  } else if (diamondTypeCode === 'Labgrown') {
    // Check for Labgrown format: shape, size, weight, gold_14_18k
    const requiredHeaders = ['shape', 'size', 'weight'];
    const rateHeaders = ['gold_14_18k', 'gold14_18k', 'gold_1418k', 'gold1418k'];
    
    const hasBasicHeaders = requiredHeaders.every(header => mappingKeys.includes(header));
    const hasRateHeader = rateHeaders.some(rateHeader => 
      mappingKeys.includes(rateHeader) ||
      mappingKeys.some(key => key.includes('gold') && key.includes('14') && key.includes('18'))
    );
    
    return hasBasicHeaders && hasRateHeader;
  }
  
  return false;
}

// Helper function to process simple format
async function processSimpleFormat(rows, diamondTypeCode, shapeNameToId, colorModel, source) {
  const entries = [];
  
  // Create header mapping from first row
  const headers = Object.keys(rows[0]);
  const headerMapping = createHeaderMapping(headers);
  
  // For simple format, we use default color for Natural/Labgrown
  let defaultColor = null;
  let defaultColorName = null;
  if (colorModel && colorModel.defaultColorDoc) {
    defaultColor = colorModel.defaultColorDoc;
    defaultColorName = colorModel.defaultColorName;
  }

  for (const row of rows) {
    try {
      // Use case-insensitive header lookup
      const shape = getRowValue(row, ['shape', 'Shape', 'SHAPE'], headerMapping);
      const size = getRowValue(row, ['size', 'Size', 'SIZE'], headerMapping);
      const weight = getRowValue(row, ['weight', 'Weight', 'WEIGHT'], headerMapping);
      const color = getRowValue(row, ['color', 'Color', 'COLOR'], headerMapping);
      const colorName = getRowValue(row, ['colorname', 'color_name', 'ColorName', 'Color_Name', 'COLORNAME', 'COLOR_NAME'], headerMapping);
      
      const shapeId = shapeNameToId[shape?.trim().toUpperCase()];
      
      if (!shapeId) {
        console.warn(`Shape not found: ${shape}`);
        continue; // Skip if shape not found
      }

      // Get rate based on diamond type with case-insensitive lookup
      let rate;
      if (diamondTypeCode === 'Natural') {
        rate = getRowValue(row, ['cv_rate', 'cvrate', 'CV_Rate', 'CVRate', 'CV_RATE', 'CVRATE'], headerMapping);
      } else if (diamondTypeCode === 'Labgrown') {
        rate = getRowValue(row, [
          'gold_14_18k', 'gold14_18k', 'gold_1418k', 'gold1418k',
          'Gold_14_18k', 'Gold14_18k', 'Gold_1418k', 'Gold1418k',
          'GOLD_14_18K', 'GOLD14_18K', 'GOLD_1418K', 'GOLD1418K'
        ], headerMapping);
      }

      // Handle color selection
      let colorDoc = defaultColor;
      let colorNameFinal = defaultColorName;
      
      // If user passes color, validate it
      if (color && colorModel) {
        colorDoc = await colorModel.findOne({ 
          $or: [ 
            { name: new RegExp(color, 'i') }, 
            { shapeCode: color } 
          ] 
        });
        if (!colorDoc) {
          console.warn(`Invalid color selection: ${color}`);
          continue; // Skip this row instead of throwing error
        }
        colorNameFinal = colorDoc.name + ' (' + colorDoc.shapeCode + ')';
      }
      
      // If user passes colorName, validate it
      if (colorName && colorDoc) {
        if (colorDoc.name && colorDoc.name.trim().toLowerCase() !== colorName.trim().toLowerCase()) {
          console.warn(`Invalid colorName selection: ${colorName}`);
          continue; // Skip this row instead of throwing error
        }
        colorNameFinal = colorName;
      }

      // Validate numeric fields
      const weightNum = parseFloat(weight);
      const rateNum = parseFloat(rate);
      
      if (!isNaN(weightNum) && !isNaN(rateNum) && weightNum > 0 && rateNum > 0) {
        const entry = {
          Shapename: shapeId,
          weight: weightNum,
          size: size || null,
          Price: rateNum,
          colorModel: source,
          diamondType: diamondTypeCode,
          color: colorDoc ? colorDoc._id : undefined,
          colorName: colorNameFinal,
        };
        entries.push(entry);
      } else {
        console.warn(`Invalid weight or rate for row: weight=${weight}, rate=${rate}`);
      }
    } catch (rowError) {
      console.warn(`Error processing row:`, rowError);
      continue; // Skip problematic rows
    }
  }
  return entries;
}

// Helper function to process complex format (original logic for gem stones)
async function processComplexFormat(rows, headers, diamondTypeCode, shapeNameToId, keywordToId, source) {
  const entries = [];
  
  // Create header mapping for case-insensitive access
  const headerMapping = createHeaderMapping(headers);
  
  // Parse headers to extract color information with case-insensitive matching
  const colorData = {};
  headers.forEach(header => {
    // Handle different separator patterns: underscore, space, dash, etc.
    const separators = ['_', '-', ' ', '.'];
    let parts = null;
    
    for (const sep of separators) {
      const tempParts = header.split(sep);
      if (tempParts.length === 2) {
        parts = tempParts;
        break;
      }
    }
    
    if (parts && parts.length === 2) {
      const color = parts[0].trim().toUpperCase();
      const type = parts[1].trim().toLowerCase();
      
      if (!colorData[color]) {
        colorData[color] = {};
      }
      colorData[color][type] = header; // Store original header name
    }
  });

  for (const row of rows) {
    try {
      // Use case-insensitive header lookup for basic fields
      const shape = getRowValue(row, ['shape', 'Shape', 'SHAPE'], headerMapping);
      const size = getRowValue(row, ['size', 'Size', 'SIZE'], headerMapping);
      const colorName = getRowValue(row, ['colorname', 'color_name', 'ColorName', 'Color_Name', 'COLORNAME', 'COLOR_NAME'], headerMapping);
      
      const shapeId = shapeNameToId[shape?.trim().toUpperCase()];
      
      if (!shapeId) {
        console.warn(`Shape not found: ${shape}`);
        continue; // Skip if shape not found
      }

      for (const colorPrefix in colorData) {
        const colorInfo = colorData[colorPrefix];
        
        // Look for weight and rate columns with flexible naming
        let weightColumn = null;
        let rateColumn = null;
        
        // Check for weight column variations
        const weightKeys = ['weight', 'wt', 'w'];
        for (const key of weightKeys) {
          if (colorInfo[key]) {
            weightColumn = colorInfo[key];
            break;
          }
        }
        
        // Check for rate column variations
        const rateKeys = ['rate', 'price', 'cost', 'amount', 'r', 'p'];
        for (const key of rateKeys) {
          if (colorInfo[key]) {
            rateColumn = colorInfo[key];
            break;
          }
        }
        
        if (weightColumn && rateColumn) {
          const code = COLOR_CODE_MAP[colorPrefix];
          if (!code || !keywordToId[code]) {
            console.warn(`Color code not found: ${colorPrefix}`);
            continue;
          }

          const weight = row[weightColumn];
          const rate = row[rateColumn];

          let colorId = keywordToId[code];
          let colorNameFinal = code;
          
          // If user passes colorName, validate
          if (colorName) {
            if (colorName.trim().toLowerCase() !== code.trim().toLowerCase()) {
              console.warn(`Invalid colorName selection: ${colorName} for ${code}`);
              continue;
            }
            colorNameFinal = colorName;
          }

          // Validate numeric fields
          const weightNum = parseFloat(weight);
          const rateNum = parseFloat(rate);

          if (!isNaN(weightNum) && !isNaN(rateNum) && weightNum > 0 && rateNum > 0) {
            entries.push({
              Shapename: shapeId,
              weight: weightNum,
              size: size || null,
              Price: rateNum,
              color: colorId,
              colorModel: source,
              diamondType: diamondTypeCode,
              colorName: colorNameFinal,
            });
          }
        }
      }
    } catch (rowError) {
      console.warn(`Error processing row:`, rowError);
      continue; // Skip problematic rows
    }
  }
  return entries;
}