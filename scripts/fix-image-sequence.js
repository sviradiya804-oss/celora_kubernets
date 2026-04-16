/**
 * Database Migration Script: Fix Image Sequence in Jewelry Collection
 *
 * This script connects to MongoDB and sorts all jewelry images by:
 * - Metal color: rg (Rose Gold) → wg (White Gold) → yg (Yellow Gold)
 * - Suffix: a → b → c → d
 *
 * Usage:
 *   1. Update the MONGODB_URI below with your database connection string
 *   2. Run: node scripts/fix-image-sequence.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

// ============ CONFIGURATION ============
// Update this with your MongoDB connection string
const MONGODB_URI = process.env.DATABASE_URI || 'mongodb://localhost:27017/celora';
const DATABASE_NAME = 'celoradb'; // Correct database name from .env
const COLLECTION_NAME = 'jewelrys'; // Correct collection name (plural form used in DB)
// =======================================

// Metal color priority (lower = first)
const METAL_ORDER = {
  rg: 1, // Rose Gold
  wg: 2, // White Gold
  yg: 3 // Yellow Gold
};

// Suffix priority (lower = first)
const SUFFIX_ORDER = {
  a: 1,
  b: 2,
  c: 3,
  d: 4
};

/**
 * Extracts metal color and suffix from image URL
 */
function extractImageInfo(url) {
  const filename = url.split('/').pop() || '';
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  const parts = nameWithoutExt.split('-');

  // suffix is the last part (a, b, c, d)
  const suffix = (parts[parts.length - 1] || '').toLowerCase();

  // Find metal color in parts
  let metalColor = '';
  for (const part of parts) {
    const lowerPart = part.toLowerCase();
    if (lowerPart === 'rg' || lowerPart === 'wg' || lowerPart === 'yg') {
      metalColor = lowerPart;
      break;
    }
  }

  return {
    url,
    metalColor,
    suffix,
    metalPriority: METAL_ORDER[metalColor] ?? 999,
    suffixPriority: SUFFIX_ORDER[suffix] ?? 999
  };
}

/**
 * Sorts an array of image URLs by metal color, then by suffix
 */
function sortImagesBySequence(urls) {
  if (!urls || !Array.isArray(urls) || urls.length === 0) return urls;

  const imageInfos = urls.map(extractImageInfo);

  imageInfos.sort((a, b) => {
    if (a.metalPriority !== b.metalPriority) {
      return a.metalPriority - b.metalPriority;
    }
    return a.suffixPriority - b.suffixPriority;
  });

  return imageInfos.map((info) => info.url);
}

/**
 * Sorts all image arrays in the images object
 */
function sortAllImages(imagesObj) {
  if (!imagesObj || typeof imagesObj !== 'object') return imagesObj;

  const result = {};
  for (const [key, urls] of Object.entries(imagesObj)) {
    if (Array.isArray(urls)) {
      result[key] = sortImagesBySequence(urls);
    } else {
      result[key] = urls;
    }
  }
  return result;
}

async function main() {
  console.log('==============================================');
  console.log('  Jewelry Image Sequence Fix Script');
  console.log('==============================================\n');

  let client;

  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✓ Connected to MongoDB\n');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Find all jewelry documents with images
    console.log('Fetching jewelry documents...');
    const cursor = collection.find({});
    const documents = await cursor.toArray();

    // Filter documents that have actual image arrays
    const docsWithImages = documents.filter((doc) => {
      if (!doc.images) return false;

      // Check if any shape array has images
      const shapes = [
        'round',
        'oval',
        'pear',
        'cushion',
        'emerald',
        'asscher',
        'heart',
        'princess',
        'marquise',
        'radiant'
      ];
      return shapes.some(
        (shape) =>
          doc.images[shape] && Array.isArray(doc.images[shape]) && doc.images[shape].length > 0
      );
    });

    console.log(
      `✓ Found ${docsWithImages.length} jewelry documents with images (out of ${documents.length} total)\n`
    );

    if (docsWithImages.length === 0) {
      console.log('No documents to update.');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;

    console.log('Processing documents...\n');

    for (const doc of docsWithImages) {
      const originalImages = doc.images;

      if (!originalImages || typeof originalImages !== 'object') {
        skippedCount++;
        continue;
      }

      // Sort all image arrays
      const sortedImages = sortAllImages(originalImages);

      // Check if any changes were made
      const originalStr = JSON.stringify(originalImages);
      const sortedStr = JSON.stringify(sortedImages);

      if (originalStr !== sortedStr) {
        // Update the document
        await collection.updateOne({ _id: doc._id }, { $set: { images: sortedImages } });
        updatedCount++;
        console.log(`  ✓ Updated: ${doc.title || doc.name || doc._id}`);
      } else {
        skippedCount++;
      }
    }

    console.log('\n==============================================');
    console.log('  Summary');
    console.log('==============================================');
    console.log(`  Total documents: ${docsWithImages.length}`);
    console.log(`  Updated: ${updatedCount}`);
    console.log(`  Skipped (already sorted): ${skippedCount}`);
    console.log('==============================================\n');

    console.log('✓ Migration completed successfully!');
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n✓ Database connection closed');
    }
  }
}

// Run the script
main().catch(console.error);
