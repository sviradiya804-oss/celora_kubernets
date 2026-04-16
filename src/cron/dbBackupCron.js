const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { uploadFileToAzureBlob } = require('../services/azureStorageService');

// Schedule: Weekly, every Sunday at 2:00 AM
cron.schedule('0 2 * * 0', async () => {
    console.log('--- Starting Weekly Database Backup ---');

    // Create unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupFileName = `mongodb-backup-${timestamp}.archive`;
    
    // Use the absolute path to uploads folder
    const uploadsDir = path.join(__dirname, '../../src/uploads');
    const backupPath = path.join(uploadsDir, backupFileName);

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
        try {
            fs.mkdirSync(uploadsDir, { recursive: true });
        } catch (err) {
            console.error('Failed to create uploads directory:', err);
            return;
        }
    }

    // Get MongoDB URI
    const mongoUri = process.env.MONGO_URI; 
    if (!mongoUri) {
        console.error('MONGO_URI is not defined. Backup skipped.');
        return;
    }

    // Mongodump command
    // Using --archive to create a single file, --gzip for compression
    const command = `mongodump --uri="${mongoUri}" --archive="${backupPath}" --gzip`;

    console.log(`Executing backup command...`);

    exec(command, async (error, stdout, stderr) => {
        if (error) {
            console.error(`Database backup failed: ${error.message}`);
            return; 
        }

        console.log(`Database dump created successfully at: ${backupPath}`);

        try {
            console.log('Uploading backup to Azure Storage...');
            // Upload to 'database-backups' container
            const blobUrl = await uploadFileToAzureBlob(backupPath, 'database-backups');
            console.log(`Backup uploaded successfully: ${blobUrl}`);
            
            // Cleanup local file after successful upload
            fs.unlink(backupPath, (err) => {
                if (err) console.error(`Failed to delete local backup file: ${err.message}`);
                else console.log('Local backup file deleted.');
            });

        } catch (uploadError) {
            console.error('Failed to upload backup to Azure:', uploadError);
            // We keep the local file if upload fails so it can be manually retrieved if needed
        }
    });
});

console.log('Database Backup Cron Job initialized (Every Sunday at 2 AM)');
