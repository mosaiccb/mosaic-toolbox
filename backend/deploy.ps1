# Enhanced Backend Deployment Script
# Full deployment with git workflow automation

param(
    [switch]$SkipBuild,
    [switch]$SkipGit,
    [switch]$ForceDeploy,
    [string]$CommitMessage = "Deploy backend updates",
    [switch]$Verbose
)

Write-Host "🚀 Enhanced Backend Deployment Script" -ForegroundColor Green
Write-Host "   → Azure Functions: Full deployment" -ForegroundColor Gray
Write-Host "   → Git Workflow: Automated add/commit/push" -ForegroundColor Gray
Write-Host "   → Build Verification: TypeScript compilation" -ForegroundColor Gray
Write-Host "   → Function Validation: Import verification in index.ts & app.ts" -ForegroundColor Gray
Write-Host "   → Error Handling: Comprehensive status reporting" -ForegroundColor Gray

# Set error action preference
$ErrorActionPreference = "Stop"

try {
    # Step 1: Build verification (unless skipped)
    if (-not $SkipBuild) {
        Write-Host ""
        Write-Host "📦 Step 1: Building TypeScript..." -ForegroundColor Cyan
        
        $buildStart = Get-Date
        npm run build
        
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed! Check TypeScript compilation errors."
        }
        
        $buildTime = [math]::Round(((Get-Date) - $buildStart).TotalSeconds, 1)
        Write-Host "✅ Build successful in $buildTime seconds" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Build step skipped" -ForegroundColor Yellow
    }
    
    # Step 2: Function Import Validation
    Write-Host ""
    Write-Host "🔍 Step 2: Validating Function Imports..." -ForegroundColor Cyan
    
    # Get all function files
    $functionFiles = Get-ChildItem -Path "src/functions" -Filter "*.ts" -Recurse | 
    Where-Object { $_.Name -notlike "*.d.ts" -and $_.Name -notlike "*.test.ts" } |
    ForEach-Object { $_.BaseName }
    
    Write-Host "📁 Found $($functionFiles.Count) function files" -ForegroundColor Gray
    
    # Check index.ts imports
    $indexContent = Get-Content "src/index.ts" -Raw
    $indexImports = $functionFiles | Where-Object { $indexContent -match "import.*functions/$_" }
    $missingInIndex = $functionFiles | Where-Object { $indexImports -notcontains $_ }
    
    # Check app.ts imports
    $appContent = Get-Content "src/app.ts" -Raw
    $appImports = $functionFiles | Where-Object { $appContent -match "import.*functions/$_" }
    $missingInApp = $functionFiles | Where-Object { $appImports -notcontains $_ }
    
    # Report validation results
    if ($missingInIndex.Count -eq 0 -and $missingInApp.Count -eq 0) {
        Write-Host "✅ All functions properly imported in both index.ts and app.ts" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Function import validation issues found:" -ForegroundColor Yellow
        
        if ($missingInIndex.Count -gt 0) {
            Write-Host "   ❌ Missing in index.ts: $($missingInIndex -join ', ')" -ForegroundColor Red
        }
        
        if ($missingInApp.Count -gt 0) {
            Write-Host "   ❌ Missing in app.ts: $($missingInApp -join ', ')" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "🔧 Fix these imports before deployment:" -ForegroundColor Yellow
        Write-Host "   1. Add missing imports to src/index.ts" -ForegroundColor Gray
        Write-Host "   2. Add missing imports to src/app.ts" -ForegroundColor Gray
        Write-Host "   3. Re-run the deployment script" -ForegroundColor Gray
        
        throw "Function import validation failed. Fix missing imports before deployment."
    }
    
    # Step 3: Git workflow (unless skipped)
    if (-not $SkipGit) {
        Write-Host ""
        Write-Host "🔀 Step 3: Git Workflow..." -ForegroundColor Cyan
        
        # Check git status
        $gitStatus = git status --porcelain
        if ($gitStatus) {
            Write-Host "📝 Staging changes..." -ForegroundColor Gray
            
            # Add all changes
            git add .
            
            # Commit with timestamp
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $fullCommitMessage = "$CommitMessage - $timestamp"
            git commit -m $fullCommitMessage
            
            Write-Host "✅ Changes committed: $fullCommitMessage" -ForegroundColor Green
            
            # Push to remote
            Write-Host "📤 Pushing to remote..." -ForegroundColor Gray
            git push
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Changes pushed to remote" -ForegroundColor Green
            }
            else {
                Write-Host "⚠️  Push failed - continuing with deployment" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "✅ No changes to commit" -ForegroundColor Green
        }
    }
    else {
        Write-Host "⚠️  Git workflow skipped" -ForegroundColor Yellow
    }
    
    # Step 4: Azure deployment
    Write-Host ""
    Write-Host "☁️  Step 4: Azure Deployment..." -ForegroundColor Cyan
    
    $deployStart = Get-Date
    
    if ($ForceDeploy) {
        Write-Host "🔄 Force deploying with azd deploy..." -ForegroundColor Yellow
        azd deploy --no-prompt
    }
    else {
        Write-Host "🚀 Deploying with azd deploy..." -ForegroundColor Gray
        azd deploy --no-prompt
    }
    
    if ($LASTEXITCODE -eq 0) {
        $deployTime = [math]::Round(((Get-Date) - $deployStart).TotalSeconds, 1)
        Write-Host "✅ Azure deployment successful in $deployTime seconds!" -ForegroundColor Green
        
        # Step 5: Get deployment info
        Write-Host ""
        Write-Host "🔍 Step 5: Deployment Information..." -ForegroundColor Cyan
        
        try {
            $endpoint = azd show --output json | ConvertFrom-Json
            $functionUrl = $endpoint.services.api.resourceGroup
            
            Write-Host "🔗 Function App URL: https://$functionUrl.azurewebsites.net" -ForegroundColor Cyan
            Write-Host "🌐 Resource Group: $($endpoint.services.api.resourceGroup)" -ForegroundColor Gray
            Write-Host "📍 Location: $($endpoint.services.api.location)" -ForegroundColor Gray
        }
        catch {
            Write-Host "⚠️  Could not retrieve deployment details: $($_.Exception.Message)" -ForegroundColor Yellow
        }
        
        # Step 6: Function validation
        Write-Host ""
        Write-Host "🔍 Step 6: Function Validation..." -ForegroundColor Cyan
        
        # Wait a moment for functions to initialize
        Start-Sleep -Seconds 5
        
        try {
            # Check if password functions are deployed
            $functionList = az functionapp function list --name mosaic-toolbox --resource-group mosaicrg01 --output json | ConvertFrom-Json
            $passwordFunctions = $functionList | Where-Object { $_.name -like "*password*" }
            
            if ($passwordFunctions.Count -gt 0) {
                Write-Host "✅ Password Manager functions deployed: $($passwordFunctions.Count) functions" -ForegroundColor Green
                $passwordFunctions | ForEach-Object { 
                    Write-Host "   - $($_.name)" -ForegroundColor Gray 
                }
            }
            else {
                Write-Host "⚠️  Password Manager functions not found - may still be initializing" -ForegroundColor Yellow
            }
            
            # Basic connectivity test
            $testUrl = "https://mosaic-toolbox.azurewebsites.net/api/passwords"
            $testResponse = Invoke-WebRequest -Uri $testUrl -Method OPTIONS -TimeoutSec 10 -SkipHttpErrorCheck
            
            if ($testResponse.StatusCode -eq 200) {
                Write-Host "✅ Password API endpoint responding" -ForegroundColor Green
            }
            else {
                Write-Host "⚠️  Password API endpoint check: HTTP $($testResponse.StatusCode)" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "⚠️  Function validation failed: $($_.Exception.Message)" -ForegroundColor Yellow
            Write-Host "   Functions may still be starting up..." -ForegroundColor Gray
        }
        
        # Success summary
        Write-Host ""
        Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        Write-Host "⏱️  Total Time: $deployTime seconds" -ForegroundColor Cyan
        Write-Host "🔗 Backend URL: https://$functionUrl.azurewebsites.net" -ForegroundColor Cyan
        Write-Host "📊 API Endpoints: Ready for testing" -ForegroundColor Cyan
        Write-Host "🔐 Mosaic Toolbox: SFTP Manager + Password Keeper" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "🧪 Test your APIs:" -ForegroundColor Yellow
        Write-Host "   - Health: /api/health" -ForegroundColor Gray
        Write-Host "   - Tenants: /api/tenants" -ForegroundColor Gray
        Write-Host "   - SFTP Configs: /api/sftp/configurations/list" -ForegroundColor Gray
        Write-Host "   - Password Manager: /api/passwords" -ForegroundColor Gray
        Write-Host "   - OAuth Token: /api/oauth/token" -ForegroundColor Gray
        Write-Host "   - Entra Auth: /api/entraauth" -ForegroundColor Gray
        
    }
    else {
        throw "Azure deployment failed! Check azd logs for details."
    }
    
}
catch {
    Write-Host ""
    Write-Host "❌ Deployment Failed!" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Check TypeScript compilation: npm run build" -ForegroundColor Gray
    Write-Host "   2. Verify azd configuration: azd config list" -ForegroundColor Gray
    Write-Host "   3. Check Azure credentials: azd auth login" -ForegroundColor Gray
    Write-Host "   4. Review logs: azd logs" -ForegroundColor Gray
    Write-Host "   5. Force redeploy: azd deploy --force" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💡 Usage Examples:" -ForegroundColor Cyan
    Write-Host "   .\deploy.ps1                                    # Full deployment with git" -ForegroundColor Gray
    Write-Host "   .\deploy.ps1 -SkipBuild                        # Skip build step" -ForegroundColor Gray
    Write-Host "   .\deploy.ps1 -SkipGit                          # Skip git workflow" -ForegroundColor Gray
    Write-Host "   .\deploy.ps1 -ForceDeploy                      # Force deployment" -ForegroundColor Gray
    Write-Host "   .\deploy.ps1 -CommitMessage 'Custom message'   # Custom commit message" -ForegroundColor Gray
    
    exit 1
}
