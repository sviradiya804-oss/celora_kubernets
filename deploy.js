#!/usr/bin/env node

/**
 * Local Deployment Script for Celora Backend
 * Deploys to Azure Web App (celoraApi)
 * Works on Windows, Mac, and Linux
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration
const CONFIG = {
    appName: 'celoraApi',
    resourceGroup: 'celora-backend',
    zipFileName: 'release.zip',
    excludePatterns: [
        'node_modules',
        '.git',
        '.github',
        '.env',
        '.DS_Store',
        'test_gemstone_import.csv',
        'release.zip',
        'deploy.js'
    ]
};

// Detect platform
const isWindows = os.platform() === 'win32';

// Utility functions
function log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
}

function logError(message) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${message}`);
}

function logSuccess(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] SUCCESS: ${message}`);
}

function logStep(step, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Step ${step}] ${message}`);
}

// Check if Azure CLI is installed and logged in
function checkAzureCli() {
    logStep(1, 'Checking Azure CLI installation...');

    try {
        const version = execSync('az --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        const versionMatch = version.match(/azure-cli\s+(\d+\.\d+\.\d+)/);
        if (versionMatch) {
            log(`Azure CLI version: ${versionMatch[1]}`);
        }
    } catch (error) {
        logError('Azure CLI is not installed. Please install it from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli');
        process.exit(1);
    }

    logStep(1, 'Checking Azure login status...');

    try {
        const account = execSync('az account show --query name -o tsv', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        log(`Logged in to Azure account: ${account.trim()}`);
    } catch (error) {
        logError('Not logged in to Azure. Please run "az login" first.');
        process.exit(1);
    }
}

// Clean up old zip file
function cleanupOldZip() {
    logStep(2, 'Cleaning up old deployment package...');

    const zipPath = path.join(process.cwd(), CONFIG.zipFileName);
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
        log(`Removed old ${CONFIG.zipFileName}`);
    } else {
        log('No old deployment package found');
    }
}

// Create deployment zip - cross-platform
function createDeploymentZip() {
    logStep(3, 'Creating deployment package...');
    log(`Platform: ${os.platform()}`);

    const zipPath = path.join(process.cwd(), CONFIG.zipFileName);

    if (isWindows) {
        // Windows: Use PowerShell Compress-Archive
        createZipWindows(zipPath);
    } else {
        // Mac/Linux: Use zip command
        createZipUnix(zipPath);
    }

    // Verify zip was created
    if (fs.existsSync(zipPath)) {
        const stats = fs.statSync(zipPath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        log(`Created ${CONFIG.zipFileName} (${sizeMB} MB)`);
    } else {
        logError('Failed to create deployment package');
        process.exit(1);
    }
}

// Create zip on Unix/Mac
function createZipUnix(zipPath) {
    // Define which patterns are directories vs files
    const dirPatterns = ['node_modules', '.git', '.github'];

    const excludeArgs = [];
    CONFIG.excludePatterns.forEach(pattern => {
        if (dirPatterns.includes(pattern)) {
            // Exclude both the directory and its contents
            excludeArgs.push(`-x "${pattern}/*"`);
            excludeArgs.push(`-x "${pattern}"`);
        } else {
            excludeArgs.push(`-x "${pattern}"`);
        }
    });

    const zipCommand = `zip -r ${CONFIG.zipFileName} . ${excludeArgs.join(' ')}`;

    log(`Running: ${zipCommand}`);

    try {
        execSync(zipCommand, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd()
        });
    } catch (error) {
        logError(`Failed to create deployment package: ${error.message}`);
        process.exit(1);
    }
}

// Create zip on Windows using PowerShell
function createZipWindows(zipPath) {
    log('Using PowerShell Compress-Archive...');

    // Build exclude pattern for PowerShell
    const excludeList = CONFIG.excludePatterns.map(p => `'${p}'`).join(',');

    // PowerShell script to create zip excluding certain files/folders
    const psScript = `
$source = Get-Location
$destination = '${zipPath.replace(/\\/g, '\\\\')}'
$exclude = @(${excludeList})

# Get all items excluding the specified patterns
$items = Get-ChildItem -Path $source -Force | Where-Object {
    $item = $_
    $excluded = $false
    foreach ($pattern in $exclude) {
        if ($item.Name -like $pattern -or $item.Name -eq $pattern) {
            $excluded = $true
            break
        }
    }
    -not $excluded
}

# Create a temporary directory
$tempDir = Join-Path $env:TEMP ("deploy_" + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# Copy items to temp directory
foreach ($item in $items) {
    $destPath = Join-Path $tempDir $item.Name
    if ($item.PSIsContainer) {
        Copy-Item -Path $item.FullName -Destination $destPath -Recurse -Force
    } else {
        Copy-Item -Path $item.FullName -Destination $destPath -Force
    }
}

# Remove node_modules from temp if it exists
$nodeModulesPath = Join-Path $tempDir "node_modules"
if (Test-Path $nodeModulesPath) {
    Remove-Item -Path $nodeModulesPath -Recurse -Force
}

# Create the zip
if (Test-Path $destination) {
    Remove-Item $destination -Force
}
Compress-Archive -Path "$tempDir\\*" -DestinationPath $destination -Force

# Cleanup temp directory
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Zip created successfully"
`;

    try {
        // Write PowerShell script to temp file
        const psScriptPath = path.join(os.tmpdir(), 'create_deploy_zip.ps1');
        fs.writeFileSync(psScriptPath, psScript, 'utf8');

        // Execute PowerShell script
        const command = `powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`;
        log('Running PowerShell script to create zip...');

        execSync(command, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd()
        });

        // Clean up script file
        fs.unlinkSync(psScriptPath);

    } catch (error) {
        logError(`Failed to create deployment package: ${error.message}`);

        // Fallback: Try using 7-Zip if available
        log('Attempting fallback with 7-Zip...');
        try {
            createZipWith7Zip(zipPath);
        } catch (fallbackError) {
            logError('7-Zip fallback also failed. Please install 7-Zip or ensure PowerShell is working.');
            process.exit(1);
        }
    }
}

// Fallback: Create zip using 7-Zip on Windows
function createZipWith7Zip(zipPath) {
    const sevenZipPaths = [
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe',
        '7z'
    ];

    let sevenZipPath = null;
    for (const p of sevenZipPaths) {
        try {
            execSync(`"${p}" --help`, { stdio: ['pipe', 'pipe', 'pipe'] });
            sevenZipPath = p;
            break;
        } catch (e) {
            // Try next path
        }
    }

    if (!sevenZipPath) {
        throw new Error('7-Zip not found');
    }

    log(`Using 7-Zip: ${sevenZipPath}`);

    const excludeArgs = CONFIG.excludePatterns.map(p => `-xr!${p}`).join(' ');
    const command = `"${sevenZipPath}" a -tzip "${zipPath}" . ${excludeArgs}`;

    execSync(command, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
    });
}

// Deploy to Azure
function deployToAzure() {
    logStep(4, 'Deploying to Azure Web App...');

    const deployCommand = [
        'az', 'webapp', 'deploy',
        '--name', CONFIG.appName,
        '--resource-group', CONFIG.resourceGroup,
        '--src-path', CONFIG.zipFileName,
        '--type', 'zip',
        '--async', 'true'
    ];

    log(`Running: ${deployCommand.join(' ')}`);
    log(`Target: ${CONFIG.appName} in ${CONFIG.resourceGroup}`);
    log('');
    log('--- Azure Deployment Output ---');

    try {
        execSync(deployCommand.join(' '), {
            encoding: 'utf8',
            stdio: 'inherit',
            cwd: process.cwd()
        });

        log('--- End Azure Output ---');
        log('');
        logSuccess(`Deployment initiated to ${CONFIG.appName}`);
    } catch (error) {
        log('--- End Azure Output ---');
        logError(`Deployment failed: ${error.message}`);
        process.exit(1);
    }
}

// Show deployment status
function showDeploymentInfo() {
    logStep(5, 'Deployment Information');

    log(`App Name: ${CONFIG.appName}`);
    log(`Resource Group: ${CONFIG.resourceGroup}`);
    log(`App URL: https://${CONFIG.appName}.azurewebsites.net`);
    log('');
    log('To view deployment logs, run:');
    log(`  az webapp log tail --name ${CONFIG.appName} --resource-group ${CONFIG.resourceGroup}`);
    log('');
    log('To check deployment status:');
    log(`  az webapp show --name ${CONFIG.appName} --resource-group ${CONFIG.resourceGroup} --query state -o tsv`);
}

// Main execution
function main() {
    console.log('');
    console.log('========================================');
    console.log('  Celora Backend - Local Deployment');
    console.log('========================================');
    console.log('');

    const startTime = Date.now();

    try {
        checkAzureCli();
        cleanupOldZip();
        createDeploymentZip();
        deployToAzure();
        showDeploymentInfo();

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('');
        console.log('========================================');
        logSuccess(`Deployment completed in ${duration}s`);
        console.log('========================================');
        console.log('');

    } catch (error) {
        logError(`Deployment failed: ${error.message}`);
        process.exit(1);
    }
}

// Run the script
main();
