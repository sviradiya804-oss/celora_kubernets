const sharp = require('sharp');
const { uploadToAzureBlob } = require('./azureStorageService');

/**
 * Optimized image upload service with compression and parallel processing
 * Handles bulk uploads (70-80+ images) efficiently
 */

/**
 * Compress and optimize an image buffer
 * @param {Buffer} buffer - Original image buffer
 * @param {Object} options - Compression options
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
async function compressImage(buffer, options = {}) {
  const {
    width = null,
    height = null,
    quality = 80,
    format = 'jpeg'
  } = options;

  try {
    let sharpInstance = sharp(buffer);

    // Resize if dimensions provided
    if (width || height) {
      sharpInstance = sharpInstance.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Apply format-specific compression
    switch (format.toLowerCase()) {
      case 'jpeg':
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality, compressionLevel: 9 });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
      default:
        sharpInstance = sharpInstance.jpeg({ quality, progressive: true });
    }

    return await sharpInstance.toBuffer();
  } catch (error) {
    console.error('Image compression error:', error);
    // Return original buffer if compression fails
    return buffer;
  }
}

/**
 * Process and upload a single file (without compression to maintain quality)
 * @param {Object} file - Multer file object
 * @param {String} containerName - Azure container name
 * @param {Object} options - Upload settings
 * @returns {Promise<String>} - Uploaded file URL
 */
async function processAndUploadFile(file, containerName, options = {}) {
  try {
    const { compress = false, compressionOptions = {} } = options;
    
    let bufferToUpload = file.buffer;
    
    // Only compress if explicitly requested
    if (compress) {
      bufferToUpload = await compressImage(file.buffer, compressionOptions);
    }
    
    // Upload to Azure (original or compressed based on settings)
    const imageUrl = await uploadToAzureBlob(
      bufferToUpload,
      file.originalname,
      containerName
    );
    
    return imageUrl;
  } catch (error) {
    console.error(`Error processing file ${file.originalname}:`, error);
    throw error;
  }
}

/**
 * Upload multiple files in parallel with optimized batching
 * Processes files in batches to prevent overwhelming the system
 * NO COMPRESSION - maintains original quality
 * @param {Array} files - Array of multer file objects
 * @param {String} containerName - Azure container name
 * @param {Object} options - Upload options
 * @returns {Promise<Array>} - Array of uploaded file URLs
 */
async function uploadMultipleFilesOptimized(files, containerName, options = {}) {
  const {
    batchSize = 10, // Process 10 files at a time
    compress = false, // Disabled by default to maintain quality
    compressionQuality = 85,
    maxWidth = 2000,
    maxHeight = 2000
  } = options;

  if (!files || files.length === 0) {
    return [];
  }

  const uploadOptions = {
    compress,
    compressionOptions: compress ? {
      quality: compressionQuality,
      width: maxWidth,
      height: maxHeight
    } : {}
  };

  const results = [];
  const totalBatches = Math.ceil(files.length / batchSize);

  console.log(`Processing ${files.length} files in ${totalBatches} batches (${batchSize} files per batch) - Compression: ${compress ? 'ON' : 'OFF (Full Quality)'}`);

  // Process files in batches
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)`);
    
    const batchPromises = batch.map(file => 
      processAndUploadFile(file, containerName, uploadOptions)
    );

    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      console.log(`Batch ${batchNumber} completed successfully`);
    } catch (error) {
      console.error(`Error in batch ${batchNumber}:`, error);
      // Continue with next batch even if one fails
    }
  }

  return results;
}

/**
 * Normalize field name from bracket notation to dot notation
 * Converts: images[round][0] -> images.round
 * Converts: images[model][2] -> images.model
 * @param {String} fieldName - Original field name with possible bracket notation
 * @returns {String} - Normalized field name with dot notation
 */
function normalizeFieldName(fieldName) {
  // Match patterns like: images[round][0], images[model][1], etc.
  // We want to extract: images.round, images.model, etc.
  const bracketMatch = fieldName.match(/^([a-zA-Z]+)\[([a-zA-Z]+)\](?:\[\d+\])?$/);
  if (bracketMatch) {
    // Convert images[round][0] -> images.round
    return `${bracketMatch[1]}.${bracketMatch[2]}`;
  }
  
  // Return original if no bracket notation found
  return fieldName;
}

/**
 * Upload files organized by field names (for jewelry with multiple image types)
 * NO COMPRESSION - maintains original quality
 * PRESERVES ORIGINAL ORDER - files are stored in the same sequence as received in payload
 * @param {Array} files - Array of multer file objects
 * @param {Object} fieldMapping - Map of field names to their types (single/multiple)
 * @param {String} containerName - Azure container name
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} - Object with field names as keys and URLs as values
 */
async function uploadFilesByFieldName(files, fieldMapping, containerName, options = {}) {
  const {
    compress = false, // Disabled by default to maintain quality
    compressionQuality = 85,
    maxWidth = 2000,
    maxHeight = 2000
  } = options;

  const uploadedFileMap = {};
  
  // Track file indices for preserving order in 'multiple' type fields
  // Structure: { normalizedFieldName: [{ originalIndex, file }] }
  const fileIndexMap = {};

  const uploadOptions = {
    compress,
    compressionOptions: compress ? {
      quality: compressionQuality,
      width: maxWidth,
      height: maxHeight
    } : {}
  };

  console.log(`[uploadFilesByFieldName] Processing ${files.length} files...`);
  console.log(`[uploadFilesByFieldName] Field mapping keys:`, Object.keys(fieldMapping));

  // First pass: Group files by field name and track their original indices
  let fileCounter = {};
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const originalFieldName = file.fieldname;
    // Normalize bracket notation to dot notation for matching
    const normalizedFieldName = normalizeFieldName(originalFieldName);
    const fieldType = fieldMapping[normalizedFieldName];

    console.log(`[uploadFilesByFieldName] File[${i}]: ${originalFieldName} -> Normalized: ${normalizedFieldName} -> Type: ${fieldType || 'NOT FOUND'}`);

    if (!fieldType) {
      console.warn(`Unknown field "${originalFieldName}" (normalized: "${normalizedFieldName}") - skipping upload`);
      continue;
    }

    if (fieldType === 'multiple') {
      if (!fileIndexMap[normalizedFieldName]) {
        fileIndexMap[normalizedFieldName] = [];
        fileCounter[normalizedFieldName] = 0;
      }
      // Track the original order index within this field group
      fileIndexMap[normalizedFieldName].push({
        originalIndex: fileCounter[normalizedFieldName]++,
        file: file
      });
    } else {
      // For 'single' type, just store directly (no ordering needed)
      if (!fileIndexMap[normalizedFieldName]) {
        fileIndexMap[normalizedFieldName] = [];
      }
      fileIndexMap[normalizedFieldName].push({
        originalIndex: 0,
        file: file,
        isSingle: true
      });
    }
  }

  // Second pass: Upload all files in parallel but track results with indices
  const uploadPromises = [];

  for (const [normalizedFieldName, fileEntries] of Object.entries(fileIndexMap)) {
    const fieldType = fieldMapping[normalizedFieldName];
    
    if (fieldType === 'multiple') {
      // Pre-initialize array with correct length to maintain order
      uploadedFileMap[normalizedFieldName] = new Array(fileEntries.length);
    }

    for (const entry of fileEntries) {
      const { originalIndex, file, isSingle } = entry;

      const promise = processAndUploadFile(file, containerName, uploadOptions)
        .then((imageUrl) => {
          if (isSingle) {
            // For single type fields
            uploadedFileMap[normalizedFieldName] = imageUrl;
          } else {
            // For multiple type fields - insert at the correct index to preserve order
            uploadedFileMap[normalizedFieldName][originalIndex] = imageUrl;
          }
          console.log(`[uploadFilesByFieldName] Uploaded ${file.fieldname} (index: ${originalIndex}) -> ${imageUrl}`);
        })
        .catch((error) => {
          console.error(`Failed to upload ${file.fieldname}:`, error);
          // Mark failed uploads with null to maintain array structure
          if (!isSingle && uploadedFileMap[normalizedFieldName]) {
            uploadedFileMap[normalizedFieldName][originalIndex] = null;
          }
        });

      uploadPromises.push(promise);
    }
  }

  // Process all uploads in parallel
  await Promise.all(uploadPromises);

  // Clean up any null entries from failed uploads (optional)
  for (const [key, value] of Object.entries(uploadedFileMap)) {
    if (Array.isArray(value)) {
      uploadedFileMap[key] = value.filter(url => url !== null && url !== undefined);
    }
  }

  console.log(`[uploadFilesByFieldName] Final uploadedFileMap (order preserved):`, JSON.stringify(uploadedFileMap, null, 2));

  return uploadedFileMap;
}

/**
 * Generate thumbnail from image buffer
 * @param {Buffer} buffer - Original image buffer
 * @param {Object} options - Thumbnail options
 * @returns {Promise<Buffer>} - Thumbnail buffer
 */
async function generateThumbnail(buffer, options = {}) {
  const {
    width = 300,
    height = 300,
    quality = 70,
    format = 'jpeg'
  } = options;

  try {
    const thumbnail = await sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    throw error;
  }
}

module.exports = {
  compressImage,
  processAndUploadFile,
  uploadMultipleFilesOptimized,
  uploadFilesByFieldName,
  generateThumbnail
};
