$ai = (Invoke-RestMethod -Uri 'http://localhost:8000/api/health' -TimeoutSec 5 -UseBasicParsing).status
$scenarios = (Invoke-RestMethod -Uri 'http://localhost:8081/api/scenarios' -TimeoutSec 5 -UseBasicParsing).Count
$fe = (Invoke-WebRequest -Uri 'http://localhost:5173/' -TimeoutSec 5 -UseBasicParsing).StatusCode
Write-Host "AI Service Health: $ai"
Write-Host "Spring Boot Scenarios Count: $scenarios"
Write-Host "Vite Dev Frontend Status: $fe"
