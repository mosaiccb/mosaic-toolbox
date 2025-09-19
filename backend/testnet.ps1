# Test connectivity from your office network
$testBody = @{
    host = "mft-uploads.maximus.com"
    port = 22
    timeout = 15000
} | ConvertTo-Json

Write-Host "Testing connectivity to Maximus SFTP from office network..." -ForegroundColor Yellow

try {
    $result = Invoke-RestMethod -Uri "https://mosaic-toolbox.azurewebsites.net/api/network/test" -Method POST -Headers @{"Content-Type"="application/json"} -Body $testBody
    
    Write-Host "`nTest Results:" -ForegroundColor Green
    Write-Host "  Success: $($result.success)" -ForegroundColor $(if($result.success) {"Green"} else {"Red"})
    Write-Host "  Host: $($result.host)" -ForegroundColor Cyan
    Write-Host "  Port: $($result.port)" -ForegroundColor Cyan
    Write-Host "  Message: $($result.result.message)" -ForegroundColor $(if($result.success) {"Green"} else {"Red"})
    
    if ($result.result.connectionTime) {
        Write-Host "  Connection Time: $($result.result.connectionTime)ms" -ForegroundColor Green
    }
    
    Write-Host "  Timestamp: $($result.timestamp)" -ForegroundColor Gray
}
catch {
    Write-Host "`nError running test: $($_.Exception.Message)" -ForegroundColor Red
}