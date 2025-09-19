# Frontend Deployment Script for Mosaic Toolbox
# This script builds and deploys the React frontend to Azure Static Web Apps

Write-Host "🚀 Mosaic Toolbox Frontend Deployment" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan

# Variables
$FrontendPath = "c:\Development\mosaic-toolbox\frontend"
$DeploymentToken = "d019e673eda9ac1acad1de7275785f7af3557b1429c299287950661609cda18f02-59c1b79a-3336-4469-87e9-1dbf8726924a01024280c8cc2510"
$ProductionUrl = "https://nice-moss-0c8cc2510.2.azurestaticapps.net"

Write-Host "📦 Step 1: Building React application..." -ForegroundColor Yellow
Set-Location $FrontendPath

try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
    Write-Host "✅ Build completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n🌐 Step 2: Deploying to Azure Static Web Apps..." -ForegroundColor Yellow

try {
    swa deploy dist --deployment-token $DeploymentToken --env production
    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed with exit code $LASTEXITCODE"
    }
    Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Frontend deployment complete!" -ForegroundColor Green
Write-Host "Production URL: $ProductionUrl" -ForegroundColor Cyan
Write-Host "Backend API: https://mosaic-toolbox.azurewebsites.net/api" -ForegroundColor Cyan

Write-Host "`n📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Visit the production URL to test the application" -ForegroundColor White
Write-Host "2. Test authentication with Microsoft Entra ID" -ForegroundColor White
Write-Host "3. Verify SFTP configuration management" -ForegroundColor White
Write-Host "4. Test password manager functionality" -ForegroundColor White

# Optional: Open the deployed app in browser
$OpenBrowser = Read-Host "`nOpen the deployed app in browser? (y/n)"
if ($OpenBrowser -eq 'y' -or $OpenBrowser -eq 'Y') {
    Start-Process $ProductionUrl
}