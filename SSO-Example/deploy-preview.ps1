# Deploy Mosaic Dashboard to Preview using SWA CLI
# This script builds and deploys to the preview Static Web App environment

Write-Host "🍕 Deploying Mosaic Dashboard to Preview..." -ForegroundColor Green

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
Write-Host "🚀 Deploying to preview from parent directory..." -ForegroundColor Yellow
swa deploy "frontend-sso/" --verbose=silly --swa-config-location "frontend-sso"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host "🔍 Check the preview URL in the SWA CLI output above" -ForegroundColor Cyan
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

# Return to project directory
Set-Location $PSScriptRoot
