# ทดสอบ Smart Delta Sync API
$url = "http://localhost:3000/api/sync/smart"
$headers = @{
    "Content-Type" = "application/json"
}

# ทดสอบ GET request (ข้อมูลเกี่ยวกับ Smart Sync)
Write-Host "=== Testing Smart Sync INFO (GET) ===" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri $url -Method GET
    $json = $response.Content | ConvertFrom-Json
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Yellow
    $json | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Testing Smart Delta Sync (POST) ===" -ForegroundColor Cyan

# ทดสอบ POST request - Smart Sync Config 2
$body = @{
    configIds = @(2)
    mode = "single"
} | ConvertTo-Json

try {
    Write-Host "Sending request to: $url" -ForegroundColor White
    Write-Host "Body: $body" -ForegroundColor White
    
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body
    $json = $response.Content | ConvertFrom-Json
    
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Yellow
    $json | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
    }
}

# รอ
Read-Host "Press Enter to exit"
