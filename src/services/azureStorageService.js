const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');

// Retrieve the connection string from environment variables
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error('Azure Storage connection string not found in environment variables.');
}

// Create a BlobServiceClient
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

/**
 * Sanitize the file name to be Azure Blob Storage compatible
 * Removes spaces, special characters, and keeps lowercase
 * @param {string} filename
 * @returns {string}
 */
const sanitizeFileName = (filename) => {
  return filename.toLowerCase().replace(/[^a-z0-9.\-_]/g, '_'); // Replace invalid characters with underscores
};

/**
 * Uploads a file buffer to Azure Blob Storage.
 * @param {Buffer} buffer - The file buffer to upload.
 * @param {string} originalName - The original name of the file.
 * @param {string} containerName - The name of the blob container.
 * @returns {Promise<string>} - The URL of the uploaded blob.
 */
const uploadToAzureBlob = async (buffer, originalName, containerName = 'images') => {
  try {
    // Get a reference to a container
    const containerClient = blobServiceClient.getContainerClient(containerName.toLowerCase());

    // Create the container if it does not exist
    await containerClient.createIfNotExists({ access: 'blob' });

    // Extract and sanitize filename
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const sanitizedFileName = sanitizeFileName(baseName) + ext;

    // Create a unique blob name
    const blobName = `${uuidv4()}-${sanitizedFileName}`;

    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Determine content type
    let contentType = 'application/octet-stream';
    if (ext.match(/\.(jpg|jpeg)$/i)) contentType = 'image/jpeg';
    else if (ext.match(/\.png$/i)) contentType = 'image/png';
    else if (ext.match(/\.gif$/i)) contentType = 'image/gif';
    else if (ext.match(/\.webp$/i)) contentType = 'image/webp';
    else if (ext.match(/\.bmp$/i)) contentType = 'image/bmp';
    else if (ext.match(/\.svg$/i)) contentType = 'image/svg+xml';
    else if (ext.match(/\.mp4$/i)) contentType = 'video/mp4';
    else if (ext.match(/\.mov$/i)) contentType = 'video/quicktime';
    else if (ext.match(/\.avi$/i)) contentType = 'video/x-msvideo';
    else if (ext.match(/\.mkv$/i)) contentType = 'video/x-matroska';
    else if (ext.match(/\.webm$/i)) contentType = 'video/webm';
    else if (ext.match(/\.pdf$/i)) contentType = 'application/pdf';

    // Upload data to the blob with content-type
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: contentType,
        blobContentDisposition: 'inline'
      }
    });

    // Return the URL of the uploaded blob
    return blockBlobClient.url;
  } catch (err) {
    console.error('Error uploading to Azure Blob Storage:', err.message);
    throw new ApiError(500, 'Failed to upload image to cloud storage.');
  }
};

/**
 * Deletes a blob from Azure Blob Storage given its full URL.
 * @param {string} blobUrl The full URL of the blob to delete.
 * @returns {Promise<void>}
 */
const deleteFromAzureBlob = async (blobUrl) => {
  try {
    if (!blobUrl) {
      console.warn('Attempted to delete blob with empty URL. Skipping deletion.');
      return;
    }

    const url = new URL(blobUrl);
    const pathSegments = url.pathname
      .substring(1)
      .split('/')
      .filter((segment) => segment);

    if (pathSegments.length < 2) {
      console.warn(
        `Invalid blob URL format for deletion: ${blobUrl}. Expected at least containerName/blobName.`
      );
      return;
    }

    const containerName = pathSegments[0];
    const blobName = pathSegments.slice(1).join('/');

    const containerClient = blobServiceClient.getContainerClient(containerName.toLowerCase());
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const response = await blockBlobClient.deleteIfExists();

    if (response.succeeded) {
      console.log(`Successfully deleted blob: ${blobUrl}`);
    } else {
      console.warn(
        `Blob not found or could not be deleted: ${blobUrl}. Status: ${response.errorCode || 'Unknown'}`
      );
    }
  } catch (error) {
    console.error(`Error deleting blob ${blobUrl}:`, error.message);
    // Optional: rethrow or handle silently depending on your needs
  }
};

/**
 * Uploads a local file to Azure Blob Storage (useful for backups)
 * @param {string} filePath - The path to the local file.
 * @param {string} containerName - The name of the blob container.
 * @returns {Promise<string>} - The URL of the uploaded blob.
 */
const uploadFileToAzureBlob = async (filePath, containerName = 'backups') => {
  try {
    // Get a reference to a container
    const containerClient = blobServiceClient.getContainerClient(containerName.toLowerCase());

    // Create the container if it does not exist
    await containerClient.createIfNotExists({ access: 'blob' });

    // File info
    const originalName = path.basename(filePath);
    const sanitizedFileName = sanitizeFileName(originalName);
    
    // Create a unique blob name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blobName = `${timestamp}-${sanitizedFileName}`; 
    
    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload file
    await blockBlobClient.uploadFile(filePath);

    // Return the URL of the uploaded blob
    return blockBlobClient.url;
  } catch (err) {
    console.error('Error uploading file to Azure Blob Storage:', err.message);
    throw new ApiError(500, 'Failed to upload backup to cloud storage.');
  }
};

module.exports = {
  uploadToAzureBlob,
  deleteFromAzureBlob,
  uploadFileToAzureBlob
};
