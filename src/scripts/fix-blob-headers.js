import 'dotenv/config';
import { BlobServiceClient } from '@azure/storage-blob';
import { extname } from 'path';

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error('Azure Storage connection string not found in environment variables.');
}
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

// Utility: detect MIME type from extension
function getMimeType(fileName) {
  const ext = extname(fileName).toLowerCase();
  if (ext === '') return 'application/octet-stream';
  if (['.jpg', '.jpeg', '.jpe', '.jfif', '.pjpeg', '.pjp'].includes(ext)) return 'image/jpeg';
  if (['.png'].includes(ext)) return 'image/png';
  if (['.gif'].includes(ext)) return 'image/gif';
  if (['.webp'].includes(ext)) return 'image/webp';
  if (['.bmp', '.dib'].includes(ext)) return 'image/bmp';
  if (['.svg', '.svgz'].includes(ext)) return 'image/svg+xml';
  if (['.mp4', '.m4v'].includes(ext)) return 'video/mp4';
  if (['.mov', '.qt'].includes(ext)) return 'video/quicktime';
  if (['.avi'].includes(ext)) return 'video/x-msvideo';
  if (['.mkv'].includes(ext)) return 'video/x-matroska';
  if (['.webm'].includes(ext)) return 'video/webm';
  if (['.mp3'].includes(ext)) return 'audio/mpeg';
  if (['.wav'].includes(ext)) return 'audio/wav';
  if (['.ogg', '.oga'].includes(ext)) return 'audio/ogg';
  if (['.pdf'].includes(ext)) return 'application/pdf';
  if (['.txt'].includes(ext)) return 'text/plain';
  if (['.json'].includes(ext)) return 'application/json';
  if (['.zip'].includes(ext)) return 'application/zip';
  return 'application/octet-stream';
}

async function fixHeadersAllContainers() {
  let containersUpdated = 0;
  for await (const container of blobServiceClient.listContainers()) {
    const containerName = container.name;
    console.log(`\nProcessing container: ${containerName}`);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    let blobsUpdated = 0;
    for await (const blob of containerClient.listBlobsFlat()) {
      const blobClient = containerClient.getBlockBlobClient(blob.name);
      const contentType = getMimeType(blob.name);
      try {
        await blobClient.setHTTPHeaders({
          blobContentType: contentType,
          blobContentDisposition: 'inline'
        });
        console.log(`Updated: ${blob.name} -> ${contentType}`);
        blobsUpdated++;
      } catch (err) {
        console.error(`Failed to update: ${blob.name} (${err.message})`);
      }
    }
    console.log(`Container '${containerName}': ${blobsUpdated} blobs updated.`);
    containersUpdated++;
  }
  console.log(`\n✅ All containers processed. ${containersUpdated} containers updated.`);
}

// Run for all containers
fixHeadersAllContainers().catch(console.error);
