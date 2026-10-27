@echo off
TITLE DRAS - Stop All Microservices
color 0C
echo ============================================================
echo      Stopping DRAS Local Microservices Architecture
echo ============================================================
echo.

echo [1/2] Terminating microservice processes on ports 8000, 8081, 5173...
powershell -Command "$ports = @(8000, 8081, 5173); foreach ($p in $ports) { $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($conns) { foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host ('  [TERMINATED] Port ' + $p + ' (PID: ' + $c.OwningProcess + ')') -ForegroundColor Yellow } } else { Write-Host ('  [OK] Port ' + $p + ' is already free.') -ForegroundColor Gray } }"

echo.
echo [2/2] Closing DRAS console windows...
powershell -Command "Get-Process | Where-Object { $_.MainWindowTitle -like 'DRAS - *' } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue; Write-Host ('  [CLOSED] Window: ' + $_.MainWindowTitle) -ForegroundColor Yellow }"

echo.
echo ============================================================
echo All DRAS services (FastAPI, Spring Boot, React) have been stopped.
echo Ports 8000, 8081, and 5173 are now free.
echo ============================================================
powershell -Command "Start-Sleep -Seconds 2"
exit
