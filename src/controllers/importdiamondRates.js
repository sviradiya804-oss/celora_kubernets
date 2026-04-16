const XLSX = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const mongoose = require('mongoose');
const schemas = require('../models/schema');
const ApiError = require('../utils/ApiError');
const path = require('path');

const shapegemstoneDR = mongoose.model('shapegemstoneDR', new mongoose.Schema(schemas.shapegemstoneDR), 'shapegemstoneDRs');

const shapegemstonelc = mongoose.model('shapegemstoneLC', new mongoose.Schema(schemas.shapegemstoneLC), 'shapegemstoneLCs');
const DiamondRate = mongoose.model('DiamondRate', new mongoose.Schema(schemas.diamondrate), 'diamondrates');
const Shape = mongoose.model('shape', new mongoose.Schema(schemas.shape));

// Global color code mapping
const COLOR_CODE_MAP = {
  BS: 'Black Sapphire (DRBLS)',
  WS: 'White Sapphire (DRWS)',
  PS: 'Pink Sapphire (DRPS)',
  YS: 'Yellow Sapphire (DRYS)',
  BD: 'Blue Diamond(DRBD)',
  RD: 'Red Diamond(DRRD)',
  BL: 'Black Diamond(DRBLD)',
  EM: 'Emerald (DREM)',
  RY: 'Ruby (DRRY)',
  K: 'White Diamond (K)',
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
      console.log('[DEBUG] req.files:', req.files);
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
      console.log('[DEBUG] Default color doc for Natural:', defaultColorDoc);
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
    const fileBuffer = req.files[0].buffer;
    const fileOriginalName = req.files[0].originalname;
    const fileExtension = fileOriginalName.split('.').pop().toLowerCase();
    console.log('[DEBUG] fileExtension:', fileExtension);

    let rows = [];

    // Parse file based on extension
    if (fileExtension === 'csv') {
      // Parse CSV from buffer
      const csvString = fileBuffer.toString('utf8');
      const csv = require('csv-parser');
      const { Readable } = require('stream');
      rows = await new Promise((resolve, reject) => {
        const results = [];
        Readable.from(csvString)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', (error) => reject(error));
      });
    } else if (['xlsx', 'xls'].includes(fileExtension)) {
      // Parse Excel from buffer
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
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
    let colorCodeToId = {};
    let colorCodeToName = {};
    if (colorModel) {
      const colorDocs = await colorModel.find({}, { _id: 1, shapeCode: 1, name: 1 });
      colorDocs.forEach(doc => {
        if (doc.shapeCode) {
          colorCodeToId[doc.shapeCode.trim().toUpperCase()] = doc._id;
          colorCodeToName[doc.shapeCode.trim().toUpperCase()] = doc.name;
        }
      });
    }

    // STEP 6: Process data based on file format
    const entries = [];
    const skippedRecords = [];
    const headers = Object.keys(rows[0]);

    // Detect file structure based on headers and diamond type
    const isSimpleFormat = detectSimpleFormat(headers, diamondTypeCode);

    if (isSimpleFormat) {
      // Handle simple format (Natural: shape, size, weight, cv_rate OR Labgrown: shape, size, weight, gold_14_18k)
      const simpleEntries = await processSimpleFormat(rows, diamondTypeCode, shapeNameToId, colorModel, source || 'default', skippedRecords);
      entries.push(...simpleEntries);
    } else {
      // Handle complex format (multiple color columns)
      const complexEntries = await processComplexFormat(rows, headers, diamondTypeCode, shapeNameToId, colorCodeToId, colorCodeToName, source || 'default', skippedRecords);
      entries.push(...complexEntries);
    }

    if (entries.length === 0) {
      return next(new ApiError(400, 'No valid data found to import.', skippedRecords));
    }

    console.log(`[DEBUG] Total valid entries to insert: ${entries.length}`);

    // Debug: Print schema to verify field names
    console.log('[DEBUG] DiamondRate Schema paths:', Object.keys(DiamondRate.schema.paths));

    // Debug: Print a few sample entries
    console.log('[DEBUG] Sample entries (first 3):');
    entries.slice(0, 3).forEach((entry, idx) => {
      console.log(`[DEBUG] Entry #${idx}:`, JSON.stringify(entry, null, 2));
    });

    // STEP 7: Test validation with a single entry first
    try {
      const testEntry = new DiamondRate(entries[0]);
      const validationError = testEntry.validateSync();
      if (validationError) {
        console.error('[DEBUG] Validation Error:', validationError.errors);
        return next(new ApiError(400, `Schema validation failed: ${Object.keys(validationError.errors).join(', ')}`));
      } else {
        console.log('[DEBUG] Single entry validation passed');
      }
    } catch (testError) {
      console.error('[DEBUG] Test Entry Error:', testError);
      return next(new ApiError(400, `Entry creation failed: ${testError.message}`));
    }

    // STEP 8: Insert data into database with better error handling
    let insertedCount = 0;
    try {
      // Try inserting one by one to see which entries fail
      console.log('[DEBUG] Attempting to insert entries...');

      // Method 1: Try bulk insert first
      try {
        const insertResult = await DiamondRate.insertMany(entries, {
          ordered: false, // Continue inserting even if some fail
          rawResult: false // Get simple result
        });
        insertedCount = insertResult.length;
        console.log(`[DEBUG] Bulk insert successful: ${insertedCount} entries.`);
      } catch (bulkError) {
        console.error('[DEBUG] Bulk insert failed, trying individual inserts:', bulkError.message);

        // Method 2: Insert one by one
        for (let i = 0; i < entries.length; i++) {
          try {
            const result = await DiamondRate.create(entries[i]);
            insertedCount++;
            if (i < 3) {
              console.log(`[DEBUG] Individual insert ${i} successful:`, result._id);
            }
          } catch (individualError) {
            console.error(`[DEBUG] Individual insert ${i} failed:`, individualError.message);
            if (individualError.errors) {
              console.error(`[DEBUG] Validation errors for entry ${i}:`, Object.keys(individualError.errors));
            }
          }
        }
      }

    } catch (insertError) {
      console.error('[DEBUG] Insert Error Details:', {
        name: insertError.name,
        message: insertError.message,
        errors: insertError.errors ? Object.keys(insertError.errors) : 'No validation errors'
      });

      if (insertError.name === 'ValidationError') {
        console.error('[DEBUG] Validation errors:', insertError.errors);
      }
      return next(new ApiError(500, `Failed to insert diamond rate data: ${insertError.message}`));
    }

    console.log(`[DEBUG] Final insert count: ${insertedCount}`);

    // STEP 9: Verify what was actually inserted
    try {
      const insertedDocs = await DiamondRate.find({}).sort({ _id: -1 }).limit(3);
      console.log('[DEBUG] Last 3 inserted documents from database:');
      insertedDocs.forEach((doc, idx) => {
        console.log(`[DEBUG] DB Doc ${idx}:`, doc.toJSON());
      });
    } catch (verifyError) {
      console.warn('[DEBUG] Could not verify inserted documents:', verifyError.message);
    }

    // Collect error summary for easier diagnosis
    const errorSummary = skippedRecords.map(rec => ({
      rowIndex: rec.rowIndex,
      reason: rec.reason,
      row: rec.row
    }));

    return res.status(200).json({
      message: 'Diamond rate data imported successfully.',
      insertedCount: insertedCount,
      skippedCount: skippedRecords.length,
      totalParsedRows: rows.length,
      errorSummary: errorSummary
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

// Helper function to process simple format - ENHANCED DEBUG VERSION
async function processSimpleFormat(rows, diamondTypeCode, shapeNameToId, colorModel, source, skippedRecords) {
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
  let rowIndex = 0;
  for (const row of rows) {
    try {
      // Use case-insensitive header lookup
      const shape = getRowValue(row, ['shape', 'Shape', 'SHAPE'], headerMapping);
      const size = getRowValue(row, ['size', 'Size', 'SIZE'], headerMapping);
      const weight = getRowValue(row, ['weight', 'Weight', 'WEIGHT'], headerMapping);
      const color = getRowValue(row, ['color', 'Color', 'COLOR'], headerMapping);
      const colorName = getRowValue(row, ['colorname', 'color_name', 'ColorName', 'Color_Name', 'COLORNAME', 'COLOR_NAME'], headerMapping);
      // VALIDATION: Check required fields first
      if (!shape) {
        skippedRecords.push({ rowIndex, row, reason: 'Missing required field: shape' });
        rowIndex++;
        continue;
      }
      if (!size) {
        skippedRecords.push({ rowIndex, row, reason: 'Missing required field: size' });
        rowIndex++;
        continue;
      }
      if (weight === null || weight === undefined) {
        skippedRecords.push({ rowIndex, row, reason: 'Missing required field: weight' });
        rowIndex++;
        continue;
      }
      const shapeId = shapeNameToId[shape?.trim().toUpperCase()];
      if (!shapeId) {
        skippedRecords.push({ rowIndex, row, reason: `Shape not found in DB: ${shape}` });
        rowIndex++;
        continue;
      }
      // Get rate based on diamond type with case-insensitive lookup
      let rate;
      if (diamondTypeCode === 'Natural') {
        rate = getRowValue(row, [
          'cv_rate', 'cvrate', 'CV_Rate', 'CVRate', 'CV_RATE', 'CVRATE',
          'rate', 'Rate', 'RATE', 'price', 'Price', 'PRICE', 'amount', 'Amount', 'AMOUNT', 'cost', 'Cost', 'COST'
        ], headerMapping);
      } else if (diamondTypeCode === 'Labgrown') {
        rate = getRowValue(row, [
          'gold_14_18k', 'gold14_18k', 'gold_1418k', 'gold1418k',
          'Gold_14_18k', 'Gold14_18k', 'Gold_1418k', 'Gold1418k',
          'GOLD_14_18K', 'GOLD14_18K', 'GOLD_1418K', 'GOLD1418K'
        ], headerMapping);
      }
      if (rate === null || rate === undefined) {
        skippedRecords.push({ rowIndex, row, reason: 'Missing required field: rate' });
        rowIndex++;
        continue;
      }
      // Handle color selection
      let colorDoc = defaultColor;
      let colorNameFinal = defaultColorName;
      if (color && colorModel) {
        colorDoc = await colorModel.findOne({
          $or: [
            { name: new RegExp(color, 'i') },
            { shapeCode: color }
          ]
        });
        if (!colorDoc) {
          skippedRecords.push({ rowIndex, row, reason: `Color not found in DB: ${color}` });
          rowIndex++;
          continue;
        }
        colorNameFinal = colorDoc.name + ' (' + colorDoc.shapeCode + ')';
      }
      if (colorName && colorDoc) {
        if (colorDoc.name && colorDoc.name.trim().toLowerCase() !== colorName.trim().toLowerCase()) {
          skippedRecords.push({ rowIndex, row, reason: `Color name mismatch: ${colorName}` });
          rowIndex++;
          continue;
        }
        colorNameFinal = colorName;
      }
      // VALIDATION: Validate numeric fields - Allow -1 for weight and 0 for rate
      const weightNum = parseFloat(weight);
      const rateNum = parseFloat(rate);
      if (isNaN(weightNum)) {
        skippedRecords.push({ rowIndex, row, reason: `Invalid value for weight: ${weight}` });
        rowIndex++;
        continue;
      }
      if (isNaN(rateNum)) {
        skippedRecords.push({ rowIndex, row, reason: `Invalid value for rate: ${rate}` });
        rowIndex++;
        continue;
      }
      if (weightNum === 0 && rateNum === 0) {
        skippedRecords.push({ rowIndex, row, reason: 'Both weight and rate are zero' });
        rowIndex++;
        continue;
      }
      let finalColorModel;
      if (diamondTypeCode === 'Natural') {
        finalColorModel = 'shapegemstoneDR';
      } else if (diamondTypeCode === 'Labgrown') {
        finalColorModel = 'shapegemstonelc';
      } else {
        finalColorModel = source;
      }
      if (!finalColorModel || !['shapegemstoneDR', 'shapegemstonelc'].includes(finalColorModel)) {
        skippedRecords.push({ rowIndex, row, reason: `Invalid colorModel: ${finalColorModel}` });
        rowIndex++;
        continue;
      }
      if (!diamondTypeCode || !colorDoc || !colorDoc._id) {
        skippedRecords.push({ rowIndex, row, reason: 'Missing required color or diamondType' });
        rowIndex++;
        continue;
      }
      // CREATE ENTRY - Match your exact schema field names
      const entry = {
        Shapename: new mongoose.Types.ObjectId(shapeId.toString()), // Note: Capital S in Shapename
        weight: weightNum,
        size: size.toString().replace(/\*/g, 'x').trim(),
        Price: rateNum, // Note: Capital P in Price  
        colorModel: finalColorModel,
        diamondType: diamondTypeCode,
        color: new mongoose.Types.ObjectId(colorDoc._id.toString()),
        colorName: colorNameFinal || colorDoc.name,
        shape: shape, // String name
        createdOn: new Date(),
        isDeleted: false
      };
      // FINAL VALIDATION: Try schema validation and collect error if fails
      try {
        const testEntry = new mongoose.models.DiamondRate(entry);
        const validationError = testEntry.validateSync();
        if (validationError) {
          skippedRecords.push({
            rowIndex,
            row,
            reason: Object.keys(validationError.errors).map(field => `${field}: ${validationError.errors[field].message}`).join(', ')
          });
        } else {
          entries.push(entry);
        }
      } catch (err) {
        skippedRecords.push({ rowIndex, row, reason: `Schema error: ${err.message}` });
      }
      rowIndex++;
    } catch (rowError) {
      skippedRecords.push({ rowIndex, row, reason: `Error processing row: ${rowError.message}` });
      rowIndex++;
      continue;
    }
  }
  console.log(`[DEBUG] processSimpleFormat created ${entries.length} valid entries`);
  return entries;
}

// Helper function to resolve shapeCode from header prefix
function getShapeCodeForPrefix(prefix, source) {
  const p = prefix.toUpperCase();
  if (source === 'shapegemstoneDR') {
    // Natural Gemstone Mappings
    switch (p) {
      case 'BS': return 'DRBLS';  // Black Sapphire (Note: User map overrides standard BS=Blue)
      case 'WS': return 'DRWS';   // White Sapphire
      case 'PS': return 'DRPS';   // Pink Sapphire
      case 'YS': return 'DRYS';   // Yellow Sapphire
      case 'BD': return 'DRBD';   // Blue Diamond
      case 'RD': return 'DRRD';   // Red Diamond
      case 'BL': return 'DRBLD';  // Black Diamond
      case 'EM': return 'DREM';   // Emerald
      case 'RY': return 'DRRY';   // Ruby
      case 'K': return 'K';      // White Diamond (Natural)
      case 'MG': return 'DRMG';   // Morganite
      case 'PD': return 'DRPD';   // Peridot
      case 'CT': return 'DRCT';   // Citrine
      case 'GN': return 'DRGN';   // Garnet
      case 'TZ': return 'DRTZ';   // Tanzanite
      case 'AQ': return 'DRAQ';   // Aquamarine
      case 'AM': return 'DRAM';   // Amethyst
      case 'BT': return 'DRBT';   // Blue Topaz
      case 'CD': return 'DRCD';   // Champagne Diamond

      // Explicit LC codes if they appear in Natural file (optional support)
      case 'LCBS': return 'LCBS';
      case 'LCPS': return 'LCPS';
      case 'LCWS': return 'LCWS';
      case 'LCRY': return 'LCRY';
      case 'CV': return 'CV';

      default: return null;
    }
  } else if (source === 'shapegemstonelc') {
    // Lab Grown Gemstone Mappings
    switch (p) {
      // Explicit LC keys from map
      case 'LCBS': return 'LCBS'; // Blue Sapphire
      case 'LCPS': return 'LCPS'; // Pink Sapphire
      case 'LCWS': return 'LCWS'; // White Sapphire
      case 'LCRY': return 'LCRY'; // Ruby

      // Mappings for standard prefixes to Lab codes
      // NOTE: BS here maps to Blue Sapphire (LCBS) for Lab grown, unlike Black Sapphire (DRBLS) in Natural if that was the intent.
      // Standard gem colors:
      case 'BS': return 'LCBS';   // Blue Sapphire
      case 'WS': return 'LCWS';   // White Sapphire
      case 'PS': return 'LCPS';   // Pink Sapphire
      case 'RY': return 'LCRY';   // Ruby
      case 'EM': return 'LCEM';   // Emerald

      case 'YS': return 'LCYS';   // Yellow Sapphire
      case 'BD': return 'LCBD';   // Blue Diamond
      case 'RD': return 'LCRD';   // Red Diamond
      case 'BL': return 'LCBLD';  // Black Diamond
      case 'K': return 'CV';     // White Diamond -> Lab White (CV)
      case 'CV': return 'CV';     // Lab White
      case 'MG': return 'LCMG';   // Morganite
      case 'PD': return 'LCPD';   // Peridot
      case 'CT': return 'LCCT';   // Citrine
      case 'GN': return 'LCGN';   // Garnet
      case 'TZ': return 'LCTZ';   // Tanzanite
      case 'AQ': return 'LCAQ';   // Aquamarine
      case 'AM': return 'LCAM';   // Amethyst
      case 'BT': return 'LCBT';   // Blue Topaz
      case 'CD': return 'LCCD';   // Champagne Diamond

      default: return null;
    }
  }
  return null;
}


// Helper function to process complex format - ENHANCED DEBUG VERSION
async function processComplexFormat(rows, headers, diamondTypeCode, shapeNameToId, colorCodeToId, colorCodeToName, source, skippedRecords) {
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
      if (tempParts.length === 2 &&
        (tempParts[1].toLowerCase().includes('weight') || tempParts[1].toLowerCase().includes('rate') ||
          tempParts[1].toLowerCase().includes('price') || tempParts[1].toLowerCase().includes('wt'))) {
        parts = tempParts;
        break;
      }
    }
    if (parts && parts.length === 2) {
      const colorPrefix = parts[0].trim().toUpperCase();
      const type = parts[1].trim().toLowerCase();
      if (!colorData[colorPrefix]) {
        colorData[colorPrefix] = {};
      }
      // Normalize type keys
      if (type.includes('weight') || type === 'wt' || type === 'w') {
        colorData[colorPrefix]['weight'] = header;
      } else if (type.includes('rate') || type.includes('price') || type === 'amount' || type === 'p' || type === 'r') {
        colorData[colorPrefix]['rate'] = header;
      }
    }
  });

  let rowIndex = 0;
  console.log('[DEBUG] Available code keys in colorCodeToId:', Object.keys(colorCodeToId).join(', '));

  for (const row of rows) {
    try {
      // Use case-insensitive header lookup for basic fields
      const shape = getRowValue(row, ['shape', 'Shape', 'SHAPE'], headerMapping);
      const size = getRowValue(row, ['size', 'Size', 'SIZE'], headerMapping);
      const colorName = getRowValue(row, ['colorname', 'color_name', 'ColorName', 'Color_Name', 'COLORNAME', 'COLOR_NAME'], headerMapping);
      // VALIDATION: Check required fields
      if (!shape || !size) {
        skippedRecords.push({ rowIndex, row, reason: `Missing required fields - shape: ${shape}, size: ${size}` });
        rowIndex++;
        continue;
      }
      const shapeId = shapeNameToId[shape?.trim().toUpperCase()];
      if (!shapeId) {
        skippedRecords.push({ rowIndex, row, reason: `Shape not found: ${shape}` });
        rowIndex++;
        continue;
      }
      for (const colorPrefix in colorData) {
        const colorInfo = colorData[colorPrefix];

        const weightColumn = colorInfo['weight'];
        const rateColumn = colorInfo['rate'];

        if (weightColumn && rateColumn) {
          // Resolve code based on prefix and source
          const code = getShapeCodeForPrefix(colorPrefix, source);

          if (!code) {
            console.log(`[DEBUG] No code mapping found for prefix: ${colorPrefix} with source: ${source}`);
            // Only skip this color, not the whole row
            continue;
          }

          if (!colorCodeToId[code]) {
            console.log(`[DEBUG] Code not found in DB: ${code}`);
            skippedRecords.push({ rowIndex, row, reason: `Color code not found in DB: ${code}` });
            continue;
          }

          const weight = row[weightColumn];
          const rate = row[rateColumn];
          // VALIDATION: Check if weight and rate exist
          if (weight === null || weight === undefined || rate === null || rate === undefined) {
            // Just empty cells, skip
            continue;
          }


          // VALIDATION: Validate numeric fields - Allow -1 for weight and 0 for rate
          const weightNum = parseFloat(weight);
          const rateNum = parseFloat(rate);
          if (isNaN(weightNum) || isNaN(rateNum)) {
            // Invalid numbers, skip
            continue;
          }
          // Allow -1 for weight (placeholder value) and 0 for rate
          if (weightNum === 0 && rateNum === 0) {
            continue;
          }
          // VALIDATION: Ensure all required fields are present
          if (!source || !['shapegemstoneDR', 'shapegemstonelc'].includes(source)) {
            skippedRecords.push({ rowIndex, row, reason: `Invalid colorModel source: ${source}` });
            continue;
          }

          // Normalize size: replace * with x
          const sizeNormalized = size.toString().replace(/\*/g, 'x').trim();

          let colorId = colorCodeToId[code];
          // Construct Full Name (Code) format
          let dbName = colorCodeToName[code];
          let colorNameFinal = dbName ? `${dbName} (${code})` : code;

          const entry = {
            Shapename: new mongoose.Types.ObjectId(shapeId.toString()), // Note: Capital S
            weight: weightNum,
            size: sizeNormalized,
            Price: rateNum, // Note: Capital P
            color: new mongoose.Types.ObjectId(colorId.toString()),
            colorModel: source,
            shape: shape, // String name of the shape
            diamondType: diamondTypeCode,
            colorName: colorNameFinal,
            // Add default values
            createdOn: new Date(),
            isDeleted: false
          };
          // FINAL VALIDATION: Double-check all required fields
          // Allow 0 for weight/price if they passed the earlier filtered check
          if (entry.Shapename && entry.weight !== null && entry.weight !== undefined && entry.size && entry.Price !== null && entry.Price !== undefined && entry.color && entry.colorModel && entry.diamondType) {
            entries.push(entry);
          } else {
            console.log(`[DEBUG] Validation fail details: Shape:${!!entry.Shapename} W:${entry.weight} S:${entry.size} P:${entry.Price} C:${!!entry.color}`);
            skippedRecords.push({ rowIndex, row, reason: '[DEBUG] Complex entry validation failed' });
          }
        }
      }
      rowIndex++;
    } catch (rowError) {
      skippedRecords.push({ rowIndex, row, reason: `Error processing complex row: ${rowError.message}` });
      rowIndex++;
      continue;
    }
  }
  console.log(`[DEBUG] processComplexFormat created ${entries.length} valid entries`);
  return entries;
}