# Mosaic Toolbox - Deployment Guide

## Overview
The Mosaic Toolbox is a modern HCM integration platform with SFTP configuration management capabilities. The frontend has been completely modernized with Mosaic HCM branding and a contemporary user interface.

## Architecture
- **Frontend**: React 19 + TypeScript + Vite with Tailwind CSS v4
- **Backend**: Azure Functions v4 with Node.js
- **Authentication**: Microsoft Authentication Library (MSAL)
- **Styling**: Modern design system with Mosaic HCM branding

## Frontend Features
- ✅ Modern responsive layout with sidebar navigation
- ✅ Mosaic HCM brand colors and typography (Inter font)
- ✅ Dashboard with statistics cards and quick actions
- ✅ SFTP configuration management with enhanced UX
- ✅ Key Vault integration for secure credential storage
- ✅ Mobile-optimized design
- ✅ Professional gradient headers and modern shadows

## Backend Features
- ✅ SFTP configuration CRUD operations
- ✅ Azure Key Vault integration for secure storage
- ✅ Automatic private key and password encryption
- ✅ RESTful API with proper error handling
- ✅ CORS configuration for frontend integration

## Deployment Steps

### Prerequisites
- Azure subscription
- Azure CLI installed and authenticated
- Node.js 20.19+ or 22.12+ (current build works with 22.6.0 with warnings)
- npm or yarn package manager

### 1. Backend Deployment (Azure Functions)

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Deploy to Azure Functions
func azure functionapp publish <your-function-app-name>
```

### 2. Frontend Deployment

#### Option A: Azure Static Web Apps
```bash
# Build the frontend
cd frontend
npm run build

# Deploy using Azure CLI
az staticwebapp create \
  --name mosaic-toolbox-frontend \
  --resource-group <your-resource-group> \
  --source . \
  --location "Central US" \
  --build-preset React
```

#### Option B: Azure App Service
```bash
# Build the frontend
cd frontend
npm run build

# Create App Service and deploy
az webapp create \
  --resource-group <your-resource-group> \
  --plan <your-app-service-plan> \
  --name mosaic-toolbox \
  --runtime "NODE:18-lts"

# Deploy the build
az webapp deployment source config-zip \
  --resource-group <your-resource-group> \
  --name mosaic-toolbox \
  --src dist.zip
```

### 3. Configuration

#### Backend Configuration
Update `local.settings.json` or Azure Function App settings:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "<your-storage-connection>",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "FUNCTIONS_NODE_VERSION": "~18",
    "AZURE_KEY_VAULT_URL": "<your-keyvault-url>",
    "CORS_ORIGINS": "<your-frontend-url>"
  }
}
```

#### Frontend Configuration
Update API endpoint in frontend configuration:
```typescript
// src/config.ts
export const API_BASE_URL = '<your-backend-function-url>';
```

### 4. Authentication Setup

1. Register application in Azure AD
2. Configure redirect URIs for your frontend domain
3. Update MSAL configuration in frontend
4. Grant necessary permissions for Key Vault access

## Development

### Local Development
```bash
# Start backend functions
cd backend
npm start

# Start frontend (in new terminal)
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:7071

## Design System

The application uses a modern design system based on Mosaic HCM branding:

### Colors
- **Primary**: Blue palette (#3b82f6 to #1e3a8a)
- **Secondary**: Slate grays (#f8fafc to #0f172a)
- **Accent**: Emerald (#10b981) and Amber (#f59e0b)

### Typography
- **Font Family**: Inter (Google Fonts)
- **Weights**: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

### Components
- Modern cards with subtle shadows
- Gradient headers and buttons
- Responsive sidebar navigation
- Professional form styling
- Smooth transitions and animations

## Security Considerations

1. **Credential Security**: All SFTP passwords and private keys are stored in Azure Key Vault
2. **Authentication**: MSAL integration ensures secure user authentication
3. **API Security**: Function-level authentication and CORS configuration
4. **Data Encryption**: Automatic encryption of sensitive configuration data

## Monitoring and Logging

- Azure Application Insights integration
- Function execution logs
- Error tracking and performance monitoring
- User activity analytics

## Support

For technical support or feature requests, please refer to the development team or create issues in the project repository.