# เพิ่มชีตใหม่สำหรับ Smart Delta Sync
$url = "http://localhost:3001/api/sync-configs"
$headers = @{
    "Content-Type" = "application/json"
}

# ตัวอย่างการเพิ่ม config ใหม่
$newConfig = @{
    name = "ชีตใหม่สำหรับทดสอบ"
    sheet_url = "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit"
    sheet_name = "Sheet1"  # ชื่อแท็บ
    table_name = "new_table"  # ชื่อตารางในฐานข้อมูล
    columns = @{
        "A" = @{
            mysqlColumn = "id"
            dataType = "INT"
        }
        "B" = @{
            mysqlColumn = "name" 
            dataType = "VARCHAR(255)"
        }
        "C" = @{
            mysqlColumn = "email"
            dataType = "VARCHAR(255)"
        }
        "D" = @{
            mysqlColumn = "created_at"
            dataType = "DATETIME"
        }
    }
    is_active = $true
} | ConvertTo-Json -Depth 5

Write-Host "Creating new sync config..." -ForegroundColor Cyan
Write-Host "Config data:" -ForegroundColor Yellow
$newConfig | Write-Host

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $newConfig
    $result = $response.Content | ConvertFrom-Json
    
    Write-Host "Success! New config created:" -ForegroundColor Green
    $result | ConvertTo-Json -Depth 5 | Write-Host
    
    Write-Host "`nConfig ID: $($result.data.id)" -ForegroundColor Cyan
    Write-Host "Ready for Smart Delta Sync!" -ForegroundColor Green
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Yellow
    }
}

Read-Host "Press Enter to exit"
