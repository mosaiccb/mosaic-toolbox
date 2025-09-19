# Deploy Mosaic Dashboard to Production using SWA CLI
# This script builds and deploys to the production Static Web App

Write-Host "🍕 Deploying Mosaic Dashboard to Production..." -ForegroundColor Green

# Navigate to project directory for build
Set-Location $PSScriptRoot
Write-Host "📦 Building application..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Navigate to parent directory for reliable SWA deployment
Set-Location ..
Write-Host "🚀 Deploying to production from parent directory..." -ForegroundColor Yellow
swa deploy "frontend-sso/" --verbose=silly --env production --swa-config-location "frontend-sso"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host "🌐 Production URL: https://zealous-sea-033b5c30f.2.azurestaticapps.net/" -ForegroundColor Cyan
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

# Return to project directory
Set-Location $PSScriptRoot
