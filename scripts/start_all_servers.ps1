$logDir = "$PSScriptRoot\..\logs"
if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

Write-Host "Starting AI Service on port 8000..."
$aiLog = "$logDir\ai-service.log"
$aiProc = Start-Process -FilePath "C:\Python313\python.exe" `
    -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" `
    -WorkingDirectory "$PSScriptRoot\..\ai-service" `
    -RedirectStandardOutput $aiLog `
    -RedirectStandardError "$logDir\ai-service-err.log" `
    -PassThru

if (-not $env:JAVA_HOME) {
    if (Test-Path "C:\Program Files\Java\jdk-24") {
        $env:JAVA_HOME = "C:\Program Files\Java\jdk-24"
    } elseif (Test-Path "C:\Program Files\Eclipse Adoptium\jdk-21.0.2.13-hotspot") {
        $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.2.13-hotspot"
    }
}
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Write-Host "Starting Spring Boot Backend on port 8081..."
$beLog = "$logDir\backend.log"
$backendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c mvnw.cmd spring-boot:run" `
    -WorkingDirectory "$PSScriptRoot\..\backend" `
    -RedirectStandardOutput $beLog `
    -RedirectStandardError "$logDir\backend-err.log" `
    -PassThru

Write-Host "Starting Frontend on port 5173..."
$feLog = "$logDir\frontend.log"
$frontendProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev" `
    -WorkingDirectory "$PSScriptRoot\..\frontend" `
    -RedirectStandardOutput $feLog `
    -RedirectStandardError "$logDir\frontend-err.log" `
    -PassThru

Write-Host "Process IDs: AI=$($aiProc.Id), Backend=$($backendProc.Id), Frontend=$($frontendProc.Id)"
