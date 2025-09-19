#!/bin/bash

# Build the application
echo "Building the frontend application..."
cd frontend
npm run build

# The built files are in the dist/ directory
echo "Build completed. Files are in frontend/dist/"
echo "To deploy to Azure Static Web Apps:"
echo "1. Use VS Code Azure extension"
echo "2. Or use GitHub Actions deployment"
echo "3. Or use Azure CLI with deployment token"

# Deployment token (stored separately for security)
echo ""
echo "Static Web App: mosaic-toolbox-frontend"
echo "Resource Group: mosaicrg01"
echo "URL: https://nice-moss-0c8cc2510.2.azurestaticapps.net"