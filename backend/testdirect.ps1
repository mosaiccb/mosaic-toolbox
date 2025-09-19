# Direct connectivity test from office network
Write-Host "Testing DIRECT connectivity to Maximus SFTP..." -ForegroundColor Yellow

# Test 1: Basic port connectivity using .NET TcpClient
Write-Host "`n=== Test 1: Direct TCP Connection ===" -ForegroundColor Green
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connectTask = $tcpClient.ConnectAsync("mft-uploads.maximus.com", 22)
    $timeout = 10000 # 10 seconds
    
    if ($connectTask.Wait($timeout)) {
        if ($tcpClient.Connected) {
            Write-Host "  ✓ SUCCESS: Direct TCP connection established" -ForegroundColor Green
            Write-Host "  ✓ Can reach mft-uploads.maximus.com:22 from office" -ForegroundColor Green
            $tcpClient.Close()
        } else {
            Write-Host "  ✗ FAILED: Could not establish TCP connection" -ForegroundColor Red
        }
    } else {
        Write-Host "  ✗ TIMEOUT: Connection attempt timed out after ${timeout}ms" -ForegroundColor Red
        $tcpClient.Close()
    }
}
catch {
    Write-Host "  ✗ ERROR: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: DNS Resolution
Write-Host "`n=== Test 2: DNS Resolution ===" -ForegroundColor Green
try {
    $dnsResult = Resolve-DnsName "mft-uploads.maximus.com" -ErrorAction Stop
    Write-Host "  ✓ DNS Resolution successful:" -ForegroundColor Green
    $dnsResult | ForEach-Object {
        if ($_.Type -eq "A") {
            Write-Host "    IP: $($_.IPAddress)" -ForegroundColor Cyan
        }
        if ($_.Type -eq "CNAME") {
            Write-Host "    CNAME: $($_.NameHost)" -ForegroundColor Cyan
        }
    }
}
catch {
    Write-Host "  ✗ DNS Resolution failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Check current office IP
Write-Host "`n=== Test 3: Office Public IP ===" -ForegroundColor Green
try {
    $officeIP = (Invoke-RestMethod -Uri "https://api.ipify.org" -TimeoutSec 5).Trim()
    Write-Host "  Office Public IP: $officeIP" -ForegroundColor Cyan
    
    # Compare with Azure Functions IP
    Write-Host "  Azure Functions IP: 52.154.139.3" -ForegroundColor Cyan
    
    if ($officeIP -eq "52.154.139.3") {
        Write-Host "  ⚠️  Same IP! Office and Azure Functions use same outbound IP" -ForegroundColor Yellow
    } else {
        Write-Host "  ℹ️  Different IPs - office should work if whitelisted" -ForegroundColor Blue
    }
}
catch {
    Write-Host "  ✗ Could not determine office IP: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Summary ===" -ForegroundColor Green
Write-Host "This test checks if your office can directly connect to Maximus SFTP" -ForegroundColor White
Write-Host "Compare results with the Azure Functions connectivity test" -ForegroundColor White