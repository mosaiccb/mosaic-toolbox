# SSH connectivity test to Maximus SFTP server
Write-Host "Testing SSH connectivity to Maximus SFTP..." -ForegroundColor Yellow
Write-Host "This will attempt to establish an SSH connection to verify basic connectivity" -ForegroundColor Gray

# Test SSH connection using ssh command if available
Write-Host "`n=== SSH Connection Test ===" -ForegroundColor Green

$sshHost = "mft-uploads.maximus.com"
$sshPort = 22
$username = "nh_sherwoodinc"  # From your FilezZilla logs

Write-Host "Testing: ssh -p $sshPort $username@$sshHost" -ForegroundColor Cyan
Write-Host "(This will likely prompt for password/key - we're just testing connectivity)" -ForegroundColor Gray

try {
    # Test if SSH is available
    $sshVersion = ssh -V 2>&1
    Write-Host "  SSH Client: $sshVersion" -ForegroundColor Green
    
    # Test connection with verbose output and connection timeout
    Write-Host "`nAttempting SSH connection with verbose output..." -ForegroundColor Yellow
    Write-Host "This should show the handshake process..." -ForegroundColor Gray
    
    # Use SSH with connection timeout and verbose mode
    # -o ConnectTimeout=10 : 10 second timeout
    # -o BatchMode=yes : Non-interactive mode
    # -o StrictHostKeyChecking=no : Don't prompt for host key verification
    # -v : Verbose output to see handshake details
    
    $sshCommand = "ssh -v -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no -p $sshPort $username@$sshHost exit"
    
    Write-Host "Running: $sshCommand" -ForegroundColor Cyan
    Write-Host "--- SSH Output ---" -ForegroundColor Yellow
    
    # Execute SSH command and capture output
    $output = & cmd /c "ssh -v -o ConnectTimeout=10 -o BatchMode=yes -o StrictHostKeyChecking=no -p $sshPort $username@$sshHost exit 2>&1"
    
    Write-Host $output -ForegroundColor White
    Write-Host "--- End SSH Output ---" -ForegroundColor Yellow
    
    # Analyze the output
    if ($output -match "Connected to") {
        Write-Host "`n✓ SUCCESS: SSH connection established!" -ForegroundColor Green
        Write-Host "  The server is reachable and accepts SSH connections" -ForegroundColor Green
    } elseif ($output -match "Connection timed out") {
        Write-Host "`n✗ TIMEOUT: SSH connection timed out" -ForegroundColor Red
        Write-Host "  This indicates the server is not reachable or blocking connections" -ForegroundColor Red
    } elseif ($output -match "Connection refused") {
        Write-Host "`n✗ REFUSED: SSH connection refused" -ForegroundColor Red
        Write-Host "  Server is reachable but refusing SSH connections on port $sshPort" -ForegroundColor Red
    } elseif ($output -match "Permission denied") {
        Write-Host "`n✓ PARTIAL SUCCESS: Connected but authentication failed" -ForegroundColor Yellow
        Write-Host "  Server is reachable and accepts SSH, but credentials are wrong/missing" -ForegroundColor Yellow
    } else {
        Write-Host "`n? UNCLEAR: Unexpected SSH output" -ForegroundColor Magenta
        Write-Host "  Review the SSH output above for details" -ForegroundColor Magenta
    }
    
} catch {
    Write-Host "`n✗ ERROR: SSH test failed" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Check if SSH is installed
    Write-Host "`nChecking if SSH client is available..." -ForegroundColor Yellow
    try {
        $null = Get-Command ssh -ErrorAction Stop
        Write-Host "  ✓ SSH client is installed" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ SSH client not found - install OpenSSH or use PuTTY" -ForegroundColor Red
        Write-Host "    Install: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0" -ForegroundColor Gray
    }
}

Write-Host "`n=== What This Test Shows ===" -ForegroundColor Green
Write-Host "• If SSH connects: Network path is open, server accepts connections" -ForegroundColor White
Write-Host "• If SSH times out: Server blocking connections (IP not whitelisted)" -ForegroundColor White
Write-Host "• If SSH refused: Wrong port or service not running" -ForegroundColor White
Write-Host "• If auth fails: Connection works, just need proper credentials" -ForegroundColor White