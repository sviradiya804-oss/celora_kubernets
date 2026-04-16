# Manual Deployment to Azure Cloud - Complete Guide

## Overview
This guide covers manual deployment of the Celora Backend to Azure using **Azure App Service** (recommended for Node.js applications).

---

## Prerequisites

### 1. Install Azure CLI
```bash
# macOS
brew install azure-cli

# Verify installation
az --version
```

### 2. Login to Azure
```bash
az login
```
This will open your browser for authentication.

---

## Deployment Options

### **Option 1: Azure App Service (Recommended)**
Best for Node.js applications with built-in scaling, monitoring, and CI/CD support.

### **Option 2: Azure Container Instances**
If you prefer Docker-based deployment.

### **Option 3: Azure Virtual Machine**
Full control but requires more management.

---

## Option 1: Deploy to Azure App Service (Step-by-Step)

### Step 1: Create Resource Group
```bash
# Replace with your preferred region
az group create \
  --name celora-backend-rg \
  --location eastus
```

### Step 2: Create App Service Plan
```bash
# Choose your pricing tier (B1 = Basic, P1V2 = Production)
az appservice plan create \
  --name celora-backend-plan \
  --resource-group celora-backend-rg \
  --sku B1 \
  --is-linux
```

**Pricing Tiers:**
- `F1` - Free (limited, for testing)
- `B1` - Basic ($13/month)
- `P1V2` - Production ($73/month)

### Step 3: Create Web App
```bash
az webapp create \
  --resource-group celora-backend-rg \
  --plan celora-backend-plan \
  --name celora-backend-api \
  --runtime "NODE:20-lts"
```

**Note:** `celora-backend-api` must be globally unique. Your URL will be:
`https://celora-backend-api.azurewebsites.net`

### Step 4: Configure Environment Variables
```bash
# Set Node.js version
az webapp config appsettings set \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --settings WEBSITE_NODE_DEFAULT_VERSION="~20"

# Add your environment variables from .env
az webapp config appsettings set \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --settings \
    NODE_ENV="production" \
    PORT="8080" \
    MONGODB_URI="your-mongodb-connection-string" \
    JWT_SECRET="your-jwt-secret" \
    AZURE_STORAGE_CONNECTION_STRING="your-azure-storage-connection" \
    AZURE_STORAGE_CONTAINER_NAME="your-container-name" \
    STRIPE_SECRET_KEY="your-stripe-secret" \
    STRIPE_PUBLISHABLE_KEY="your-stripe-publishable-key"
```

**Important:** Replace all placeholder values with your actual credentials from `.env`

### Step 5: Deploy Your Code

#### Method A: Deploy from Local Git
```bash
# Configure local git deployment
az webapp deployment source config-local-git \
  --name celora-backend-api \
  --resource-group celora-backend-rg

# Get deployment credentials
az webapp deployment list-publishing-credentials \
  --name celora-backend-api \
  --resource-group celora-backend-rg \
  --query "{username:publishingUserName, password:publishingPassword}"

# Add Azure as a git remote
git remote add azure https://<username>@celora-backend-api.scm.azurewebsites.net/celora-backend-api.git

# Push to deploy
git push azure main
```

#### Method B: Deploy from GitHub (Automated)
```bash
az webapp deployment source config \
  --name celora-backend-api \
  --resource-group celora-backend-rg \
  --repo-url https://github.com/celorajwelry/Celora-Backend \
  --branch main \
  --manual-integration
```

#### Method C: Deploy ZIP File (Fastest for Manual)
```bash
# Create deployment package (exclude node_modules)
zip -r deploy.zip . -x "node_modules/*" ".git/*" "*.log"

# Deploy the ZIP
az webapp deployment source config-zip \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --src deploy.zip
```

### Step 6: Configure Startup Command
```bash
az webapp config set \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --startup-file "npm start"
```

### Step 7: Enable Logging
```bash
# Enable application logging
az webapp log config \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --application-logging filesystem \
  --level information

# Stream logs in real-time
az webapp log tail \
  --resource-group celora-backend-rg \
  --name celora-backend-api
```

### Step 8: Configure Custom Domain (Optional)
```bash
# Map custom domain
az webapp config hostname add \
  --webapp-name celora-backend-api \
  --resource-group celora-backend-rg \
  --hostname api.celora.com

# Enable HTTPS
az webapp update \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --https-only true
```

---

## Option 2: Deploy Using Docker Container

### Step 1: Build Docker Image
```bash
# Build the image
docker build -t celora-backend:latest .

# Tag for Azure Container Registry
docker tag celora-backend:latest celoraregistry.azurecr.io/celora-backend:latest
```

### Step 2: Create Azure Container Registry
```bash
az acr create \
  --resource-group celora-backend-rg \
  --name celoraregistry \
  --sku Basic

# Login to registry
az acr login --name celoraregistry

# Push image
docker push celoraregistry.azurecr.io/celora-backend:latest
```

### Step 3: Deploy Container to App Service
```bash
az webapp create \
  --resource-group celora-backend-rg \
  --plan celora-backend-plan \
  --name celora-backend-api \
  --deployment-container-image-name celoraregistry.azurecr.io/celora-backend:latest
```

---

## Post-Deployment Configuration

### 1. Scale Your Application
```bash
# Scale up (increase resources)
az appservice plan update \
  --name celora-backend-plan \
  --resource-group celora-backend-rg \
  --sku P1V2

# Scale out (increase instances)
az webapp scale \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --instance-count 2
```

### 2. Enable Auto-Scaling
```bash
az monitor autoscale create \
  --resource-group celora-backend-rg \
  --resource celora-backend-api \
  --resource-type Microsoft.Web/sites \
  --name autoscale-celora \
  --min-count 1 \
  --max-count 5 \
  --count 2
```

### 3. Configure Health Check
```bash
az webapp config set \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --health-check-path "/health"
```

### 4. Set Up Application Insights (Monitoring)
```bash
# Create Application Insights
az monitor app-insights component create \
  --app celora-backend-insights \
  --location eastus \
  --resource-group celora-backend-rg

# Get instrumentation key
INSTRUMENTATION_KEY=$(az monitor app-insights component show \
  --app celora-backend-insights \
  --resource-group celora-backend-rg \
  --query instrumentationKey -o tsv)

# Add to app settings
az webapp config appsettings set \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY="$INSTRUMENTATION_KEY"
```

---

## Useful Commands

### View Application URL
```bash
az webapp show \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --query defaultHostName -o tsv
```

### Restart Application
```bash
az webapp restart \
  --resource-group celora-backend-rg \
  --name celora-backend-api
```

### View Deployment History
```bash
az webapp deployment list \
  --resource-group celora-backend-rg \
  --name celora-backend-api
```

### SSH into Container
```bash
az webapp ssh \
  --resource-group celora-backend-rg \
  --name celora-backend-api
```

### Download Logs
```bash
az webapp log download \
  --resource-group celora-backend-rg \
  --name celora-backend-api \
  --log-file logs.zip
```

---

## Troubleshooting

### Check Application Logs
```bash
az webapp log tail \
  --resource-group celora-backend-rg \
  --name celora-backend-api
```

### Check Deployment Logs
```bash
az webapp log deployment show \
  --resource-group celora-backend-rg \
  --name celora-backend-api
```

### Common Issues

1. **Application won't start:**
   - Check `package.json` has correct start script
   - Verify PORT environment variable is set
   - Check logs for errors

2. **Database connection fails:**
   - Verify MongoDB connection string in app settings
   - Check if MongoDB allows Azure IP addresses

3. **Environment variables not working:**
   - Use `az webapp config appsettings list` to verify
   - Restart app after setting variables

---

## Cost Optimization

### 1. Use Free Tier for Testing
```bash
az appservice plan create \
  --name celora-test-plan \
  --resource-group celora-backend-rg \
  --sku F1 \
  --is-linux
```

### 2. Stop App When Not in Use
```bash
az webapp stop \
  --resource-group celora-backend-rg \
  --name celora-backend-api
```

### 3. Delete Resources
```bash
# Delete entire resource group (careful!)
az group delete \
  --name celora-backend-rg \
  --yes
```

---

## Quick Deploy Script

Save this as `deploy-to-azure.sh`:

```bash
#!/bin/bash

# Configuration
RESOURCE_GROUP="celora-backend-rg"
APP_NAME="celora-backend-api"
LOCATION="eastus"

# Create ZIP
echo "Creating deployment package..."
zip -r deploy.zip . -x "node_modules/*" ".git/*" "*.log"

# Deploy
echo "Deploying to Azure..."
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --src deploy.zip

# Restart
echo "Restarting application..."
az webapp restart \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME

# Show URL
echo "Deployment complete!"
echo "URL: https://$(az webapp show --resource-group $RESOURCE_GROUP --name $APP_NAME --query defaultHostName -o tsv)"

# Cleanup
rm deploy.zip
```

Make it executable:
```bash
chmod +x deploy-to-azure.sh
./deploy-to-azure.sh
```

---

## Next Steps

1. **Set up CI/CD:** Configure GitHub Actions for automatic deployments
2. **Add Custom Domain:** Point your domain to Azure
3. **Enable SSL:** Use Azure's free SSL certificates
4. **Set up Monitoring:** Configure alerts and dashboards
5. **Backup Strategy:** Set up automated backups

---

## Support Resources

- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)
- [Node.js on Azure](https://docs.microsoft.com/en-us/azure/developer/javascript/)
