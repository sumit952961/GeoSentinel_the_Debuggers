# ============================================================
# DRAS Health Poller Script
# Polls all microservices until they are healthy or timeout
# ============================================================

param (
    [int]$TimeoutSeconds = 60
)

$sw = [Diagnostics.Stopwatch]::StartNew()
$fastApiOk = $false
$springBootOk = $false
$frontendOk = $false

Write-Host "Waiting for microservices to initialize (timeout: ${TimeoutSeconds}s)..." -ForegroundColor Cyan
Write-Host "  - FastAPI AI Service:   http://127.0.0.1:8000/health" -ForegroundColor Gray
Write-Host "  - Spring Boot Backend:  http://127.0.0.1:8081/actuator/health" -ForegroundColor Gray
Write-Host "  - React + Vite UI:      http://127.0.0.1:5173/" -ForegroundColor Gray
Write-Host ""

while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    # 1. Check FastAPI (Port 8000) using 127.0.0.1 to avoid Windows IPv6 resolution latency
    if (-not $fastApiOk) {
        try {
            $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                $fastApiOk = $true
                Write-Host "  [OK] FastAPI AI Engine is READY (Port 8000)" -ForegroundColor Green
            }
        } catch {
            try {
                $resp = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
                if ($resp.StatusCode -eq 200) {
                    $fastApiOk = $true
                    Write-Host "  [OK] FastAPI AI Engine is READY (Port 8000)" -ForegroundColor Green
                }
            } catch { }
        }
    }

    # 2. Check Spring Boot (Port 8081)
    if (-not $springBootOk) {
        try {
            $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8081/actuator/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                $springBootOk = $true
                Write-Host "  [OK] Spring Boot Backend is READY (Port 8081)" -ForegroundColor Green
            }
        } catch {
            try {
                $resp2 = Invoke-WebRequest -Uri "http://127.0.0.1:8081/api/health" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
                if ($resp2.StatusCode -eq 200) {
                    $springBootOk = $true
                    Write-Host "  [OK] Spring Boot Backend is READY (Port 8081)" -ForegroundColor Green
                }
            } catch { }
        }
    }

    # 3. Check React Frontend (Port 5173)
    if (-not $frontendOk) {
        try {
            $resp = Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                $frontendOk = $true
                Write-Host "  [OK] React Frontend UI is READY (Port 5173)" -ForegroundColor Green
            }
        } catch {
            try {
                $resp = Invoke-WebRequest -Uri "http://localhost:5173/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
                if ($resp.StatusCode -eq 200) {
                    $frontendOk = $true
                    Write-Host "  [OK] React Frontend UI is READY (Port 5173)" -ForegroundColor Green
                }
            } catch { }
        }
    }

    # Exit early if all 3 are ready
    if ($fastApiOk -and $springBootOk -and $frontendOk) {
        break
    }

    Start-Sleep -Milliseconds 1500
}

Write-Host ""
if ($fastApiOk -and $springBootOk -and $frontendOk) {
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  ALL MICROSERVICES ARE ONLINE AND HEALTHY!                 " -ForegroundColor Green
    Write-Host "  Launching DRAS in your default web browser...             " -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "============================================================" -ForegroundColor Yellow
    Write-Host "  Initialization wait completed (${TimeoutSeconds}s). Status summary:" -ForegroundColor Yellow
    Write-Host "    - FastAPI (Port 8000):   $(if ($fastApiOk) { '[READY]' } else { '[STILL INITIALIZING]' })" -ForegroundColor $(if ($fastApiOk) { 'Green' } else { 'Yellow' })
    Write-Host "    - Backend (Port 8081):   $(if ($springBootOk) { '[READY]' } else { '[STILL INITIALIZING]' })" -ForegroundColor $(if ($springBootOk) { 'Green' } else { 'Yellow' })
    Write-Host "    - Frontend (Port 5173):  $(if ($frontendOk) { '[READY]' } else { '[STILL INITIALIZING]' })" -ForegroundColor $(if ($frontendOk) { 'Green' } else { 'Yellow' })
    Write-Host "============================================================" -ForegroundColor Yellow
    exit 0
}
