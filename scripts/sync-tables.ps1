# Script para sincronizar tabelas com o Railway
$ErrorActionPreference = "Stop"

Write-Host "Starting table synchronization..."

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/evaluation/create-table" -Method Post -Body "{}" -ContentType "application/json"
    Write-Host "Tables synchronized successfully!"
} catch {
    Write-Host "Error: Failed to sync tables"
    Write-Host "Details:"
    Write-Host "Error Message: $($_.Exception.Message)"
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "Status Description: $($_.Exception.Response.StatusDescription)"
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Response Body:"
        Write-Host $_.ErrorDetails.Message
    }
    
    Write-Host "`nFull Error Details:"
    Write-Host ($_ | ConvertTo-Json -Depth 20)
    exit 1
} 