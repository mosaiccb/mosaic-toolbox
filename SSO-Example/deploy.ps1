# 🌐 Frontend Deployment Script - PowerShell
# Deploy React TypeScript Frontend with Azure Developer CLI and GitHub Backup
# 
# Author: GitHub Copilot AI Assistant
# Created: July 2025
# Purpose: Complete frontend deployment pipeline with error checking and GitHub backup
#
# This script will:
# 1. Check prerequisites (Node.js, Azure CLI, azd)
# 2. Install dependencies and build the frontend
# 3. Run type checking and linting for error detection
# 4. Deploy using Azure Developer CLI (azd deploy)
# 5. Test the deployment
# 6. Backup code to GitHub on successful deployment
#
# 🔧 Configuration:
#   • Frontend: React TypeScript with Vite
#   • Deployment: Azure Static Web Apps via azd deploy
#   • Repository: mosaiccb/ukg-sync-frontend
#
# Usage Examples:
#   .\deploy.ps1                                        # Full deployment with GitHub backup
#   .\deploy.ps1 -SkipBuild                            # Skip npm build step
#   .\deploy.ps1 -SkipTests                            # Skip type checking and linting
#   .\deploy.ps1 -NoGitBackup                          # Deploy without GitHub backup
#   .\deploy.ps1 -CommitMessage "Update dashboard"     # Custom commit message
#   .\deploy.ps1 -VerboseOutput                        # Verbose output

param(
    [Parameter(Mandatory = $false)]
    [switch]$SkipBuild,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipTests,
    
    [Parameter(Mandatory = $false)]
    [switch]$NoGitBackup,
    
    [Parameter(Mandatory = $false)]
    [switch]$VerboseOutput,
    
    [Parameter(Mandatory = $false)]
    [string]$CommitMessage = "🌐 Frontend deployment: Restaurant Operations Dashboard updates"
)

Write-Host "🌐 Starting Frontend Deployment Pipeline" -ForegroundColor Green
Write-Host "📅 Deployment initiated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host "👤 Executed by: $env:USERNAME on $env:COMPUTERNAME" -ForegroundColor DarkGray

# Check prerequisites
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Cyan

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Node.js not found. Please install Node.js" -ForegroundColor Red
        Write-Host "💡 Download from: https://nodejs.org/" -ForegroundColor Cyan
        exit 1
    }
}
catch {
    Write-Host "❌ Node.js not found. Please install Node.js" -ForegroundColor Red
    exit 1
}

# Check if npm is available
try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
    }
    else {
        Write-Host "❌ npm not found" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ npm not found" -ForegroundColor Red
    exit 1
}

# Check if Azure CLI is installed and logged in
try {
    $azVersion = az version 2>$null
    if (-not $azVersion) {
        Write-Host "❌ Azure CLI not found. Please install Azure CLI" -ForegroundColor Red
        Write-Host "💡 Download from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli" -ForegroundColor Cyan
        exit 1
    }
    
    $azAccount = az account show 2>$null | ConvertFrom-Json
    if ($azAccount) {
        Write-Host "✅ Azure CLI authenticated as: $($azAccount.user.name)" -ForegroundColor Green
        Write-Host "📍 Subscription: $($azAccount.name)" -ForegroundColor Cyan
    }
    else {
        Write-Host "❌ Azure CLI not authenticated" -ForegroundColor Red
        Write-Host "💡 Run: az login" -ForegroundColor Cyan
        exit 1
    }
}
catch {
    Write-Host "❌ Error checking Azure CLI: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Check if Azure Developer CLI (azd) is installed
try {
    $azdVersion = azd version 2>$null
    if ($azdVersion) {
        Write-Host "✅ Azure Developer CLI: $($azdVersion | Select-String 'azd version' | ForEach-Object { $_.ToString().Split(' ')[2] })" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Azure Developer CLI (azd) not found" -ForegroundColor Red
        Write-Host "💡 Install with: winget install microsoft.azd" -ForegroundColor Cyan
        Write-Host "💡 Or download from: https://aka.ms/azd-install" -ForegroundColor DarkGray
        exit 1
    }
}
catch {
    Write-Host "❌ Azure Developer CLI (azd) not found" -ForegroundColor Red
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ package.json not found. Make sure you're in the ukg-sync-frontend directory" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "azure.yaml")) {
    Write-Host "❌ azure.yaml not found. Make sure you're in the ukg-sync-frontend directory" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prerequisites check completed" -ForegroundColor Green

# Check Git status
Write-Host "`n📋 Checking Git status..." -ForegroundColor Cyan

try {
    $isGitRepo = Test-Path ".git"
    if ($isGitRepo) {
        $gitStatus = git status --porcelain 2>$null
        if ($gitStatus) {
            Write-Host "⚠️  Uncommitted changes detected:" -ForegroundColor Yellow
            $gitStatusLines = $gitStatus -split "`n"
            foreach ($line in $gitStatusLines | Select-Object -First 5) {
                if ($line.Trim()) {
                    Write-Host "   $line" -ForegroundColor Yellow
                }
            }
            Write-Host "💡 Changes will be committed after successful deployment" -ForegroundColor DarkGray
        }
        else {
            Write-Host "✅ Working directory is clean" -ForegroundColor Green
        }
        
        $currentBranch = git branch --show-current 2>$null
        if ($currentBranch) {
            Write-Host "📍 Current branch: $currentBranch" -ForegroundColor Cyan
        }
    }
    else {
        Write-Host "📁 Not a Git repository" -ForegroundColor Yellow
        $NoGitBackup = $true
    }
}
catch {
    Write-Host "📁 Git not available" -ForegroundColor Yellow
    $NoGitBackup = $true
}

# Install dependencies and build (unless skipped)
if (-not $SkipBuild) {
    Write-Host "`n📦 Installing dependencies..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm install failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
    
    # Run type checking (unless skipped)
    if (-not $SkipTests) {
        Write-Host "`n🔍 Running type check..." -ForegroundColor Cyan
        npm run type-check
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ TypeScript type checking failed" -ForegroundColor Red
            Write-Host "💡 Fix type errors before deployment" -ForegroundColor Cyan
            exit 1
        }
        Write-Host "✅ Type checking passed" -ForegroundColor Green
        
        Write-Host "`n📝 Running linter..." -ForegroundColor Cyan
        npm run lint
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  Linting failed, but continuing deployment" -ForegroundColor Yellow
            Write-Host "💡 Consider fixing linting issues for better code quality" -ForegroundColor DarkGray
        }
        else {
            Write-Host "✅ Linting passed" -ForegroundColor Green
        }
    }
    else {
        Write-Host "⏭️  Skipping type checking and linting (-SkipTests specified)" -ForegroundColor Yellow
    }
    
    Write-Host "`n🔨 Building frontend..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Build completed successfully" -ForegroundColor Green
    
    # Verify build output
    if (Test-Path "dist") {
        $distFiles = Get-ChildItem "dist" -Recurse | Measure-Object
        Write-Host "📁 Build output: $($distFiles.Count) files in dist folder" -ForegroundColor DarkGray
    }
    else {
        Write-Host "⚠️  dist folder not found after build" -ForegroundColor Yellow
    }
}
else {
    Write-Host "⏭️  Skipping build (-SkipBuild specified)" -ForegroundColor Yellow
}

# Deploy using Azure Developer CLI
Write-Host "`n🚀 Deploying with Azure Developer CLI..." -ForegroundColor Cyan

# Check if azd is initialized
if (-not (Test-Path ".azure")) {
    Write-Host "⚠️  Azure Developer CLI not initialized for this project" -ForegroundColor Yellow
    Write-Host "💡 Run 'azd init' first to set up the project" -ForegroundColor Cyan
    exit 1
}

try {
    Write-Host "Executing: azd deploy" -ForegroundColor DarkGray
    azd deploy
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Azure deployment failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Azure deployment completed successfully" -ForegroundColor Green
}
catch {
    Write-Host "❌ Azure deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Get deployment information
Write-Host "`n🔍 Getting deployment information..." -ForegroundColor Cyan
try {
    $azdShowOutput = azd show 2>$null
    if ($azdShowOutput) {
        Write-Host "📍 Deployment details:" -ForegroundColor Cyan
        $azdShowOutput | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
    }
}
catch {
    Write-Host "🔍 Could not retrieve deployment details" -ForegroundColor DarkGray
}

# Test the deployment
Write-Host "`n🧪 Testing deployment..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# Try to get the URL from azd show or use a reasonable default
$frontendUrl = $null
try {
    $azdEnv = azd env get-values 2>$null
    if ($azdEnv) {
        $urlLine = $azdEnv | Where-Object { $_ -match "SERVICE_WEB_URI" }
        if ($urlLine) {
            $frontendUrl = ($urlLine -split "=")[1].Trim('"')
        }
    }
}
catch {
    Write-Host "🔍 Could not get frontend URL from azd" -ForegroundColor DarkGray
}

if ($frontendUrl) {
    try {
        Write-Host "Testing frontend at: $frontendUrl" -ForegroundColor DarkGray
        $response = Invoke-WebRequest -Uri $frontendUrl -Method GET -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Frontend is accessible and responding" -ForegroundColor Green
            Write-Host "🌐 Frontend URL: $frontendUrl" -ForegroundColor Cyan
        }
        else {
            Write-Host "⚠️  Frontend responded with status: $($response.StatusCode)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "⚠️  Could not test frontend URL: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "💡 The deployment may still be successful, but the URL is not accessible yet" -ForegroundColor DarkGray
    }
}
else {
    Write-Host "🔍 Frontend URL not available for testing" -ForegroundColor DarkGray
    Write-Host "💡 Check Azure portal for the deployed Static Web App URL" -ForegroundColor Cyan
}

# GitHub backup (if not skipped and Git is available)
if (-not $NoGitBackup -and (Test-Path ".git")) {
    Write-Host "`n📤 Backing up to GitHub..." -ForegroundColor Cyan
    
    try {
        # Add all changes
        git add -A
        
        # Check if there are changes to commit
        $gitStatus = git status --porcelain 2>$null
        if ($gitStatus) {
            # Commit changes
            git commit -m "$CommitMessage"
            Write-Host "✅ Changes committed locally" -ForegroundColor Green
            
            # Push to GitHub
            Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
            git push origin main
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Successfully backed up to GitHub" -ForegroundColor Green
                
                # Show commit info
                $commitHash = git rev-parse HEAD 2>$null
                if ($commitHash) {
                    Write-Host "📍 Commit hash: $($commitHash.Substring(0,8))" -ForegroundColor DarkGray
                }
            }
            else {
                Write-Host "⚠️  Failed to push to GitHub" -ForegroundColor Yellow
                Write-Host "💡 You may need to push manually later" -ForegroundColor DarkGray
            }
        }
        else {
            Write-Host "✅ No changes to commit - repository is up to date" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "⚠️  GitHub backup failed: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "💡 Deployment was successful, but Git backup failed" -ForegroundColor DarkGray
    }
}
elseif ($NoGitBackup) {
    Write-Host "⏭️  Skipping GitHub backup (-NoGitBackup specified)" -ForegroundColor Yellow
}
else {
    Write-Host "⏭️  Skipping GitHub backup (not a Git repository)" -ForegroundColor Yellow
}

Write-Host "`n🎉 Frontend deployment pipeline completed!" -ForegroundColor Green
if ($frontendUrl) {
    Write-Host "🌐 Frontend URL: $frontendUrl" -ForegroundColor Cyan
}
Write-Host "💡 Check Azure portal for detailed deployment status" -ForegroundColor DarkGray

Write-Host "`n✨ Script execution completed successfully!" -ForegroundColor Green
