const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');
const cron = require('node-cron');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Azure Storage Configuration
// Ensure these variables are set in your .env file
const AZURE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_BACKUP_CONTAINER_NAME || 'database-backups';

const DB_URI = process.env.DATABASE_URI || 'mongodb://localhost:27017/celoradb';
const BACKUP_DIR = path.join(__dirname, 'backups');

async function runBackup() {
    console.log(`\n[${new Date().toISOString()}] --- Starting Scheduled MongoDB Backup ---`);

    if (!AZURE_CONNECTION_STRING) {
        console.error('[CRITICAL] Missing AZURE_STORAGE_CONNECTION_STRING in strictly required .env');
        return;
    }

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFolder = path.join(BACKUP_DIR, `backup-${timestamp}`);
    const archivePath = `${backupFolder}.gzip`;
    const blobName = `celoradb-backup-${timestamp}.gzip`;

    const dumpCommand = `mongodump --uri="${DB_URI}" --archive="${archivePath}" --gzip`;

    console.log('1. Running mongodump to create compressed archive...');

    exec(dumpCommand, async (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing mongodump: ${error.message}`);
            return;
        }
        console.log('✅ Mongodump archive created successfully.');

        try {
            console.log(`2. Connecting to Azure Blob Storage Container: '${CONTAINER_NAME}'...`);
            const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION_STRING);
            const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

            // Create container if it does not exist
            const exists = await containerClient.exists();
            if (!exists) {
                console.log('Container did not exist. Creating it now...');
                await containerClient.create();
            }

            console.log(`3. Uploading ${blobName} to Azure...`);
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);

            const fileStream = fs.createReadStream(archivePath);
            await blockBlobClient.uploadStream(fileStream);

            console.log(`✅ Successfully uploaded backup to Azure Blob Storage: ${blobName}`);

            // Clean up local files
            fs.unlinkSync(archivePath);
            console.log('4. Local temporary archive deleted.');
            console.log(`[${new Date().toISOString()}] --- Backup Process Finished Successfully ---\n`);

        } catch (err) {
            console.error('❌ Failed to upload backup to Azure Blob Storage:', err.message);
            // Clean up local file even on failure to avoid disk filling up
            if (fs.existsSync(archivePath)) {
                fs.unlinkSync(archivePath);
            }
        }
    });
}

// ---------------------------------------------------------
// CRON SCHEDULING
// ---------------------------------------------------------

// Check if running in immediate testing mode: `node scripts/backup-db.js --run`
if (process.argv.includes('--run')) {
    console.log("Running immediate backup (Testing Mode)");
    runBackup();
} else {
    // Otherwise, start the cron schedule
    const now = new Date();
    const min = now.getMinutes();
    const hour = now.getHours();
    const day = now.getDay();

    const weeklyCron = `${min} ${hour} * * ${day}`;

    console.log("====================================================");
    console.log("= CeloraDB Automated Azure Backup Service Started  =");
    console.log("= Running inside node-cron interval                =");
    console.log(`= Interval: Weekly (Runs at exact start time)      =`);
    console.log(`= Current Cron Expression: '${weeklyCron}'         =`);
    console.log("====================================================");

    // 1. Run the backup immediately ("Start from now")
    console.log("Running initial backup now...");
    runBackup();

    // 2. Schedule it to repeat every 7 days at this exact minute/hour
    cron.schedule(weeklyCron, () => {
        runBackup();
    });
}
