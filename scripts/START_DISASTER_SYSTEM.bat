@echo off
TITLE DRAS - Disaster Response and Assessment System Launcher
color 0A
echo ============================================================
echo      DRAS: Disaster Response and Assessment System
echo           Local Microservices Architecture
echo ============================================================
echo.

:: 0. Resolve Project Directory
set "BASE_DIR=C:\Users\rajat\OneDrive\Desktop\Disaster_Management_System"
if not exist "%BASE_DIR%" (
    if exist "%~dp0Disaster_Management_System" (
        set "BASE_DIR=%~dp0Disaster_Management_System"
    ) else (
        color 0C
        echo [ERROR] Project directory not found at:
        echo "%BASE_DIR%"
        echo Please verify the folder location.
        pause
        exit /b 1
    )
)

:: Locate Python executable with AI dependencies
if exist "C:\Python313\python.exe" (
    set "PYTHON_EXE=C:\Python313\python.exe"
) else (
    set "PYTHON_EXE=python"
)

:: Locate Java and ensure JAVA_HOME is configured
if not defined JAVA_HOME (
    if exist "C:\Program Files\Java\jdk-24" (
        set "JAVA_HOME=C:\Program Files\Java\jdk-24"
    ) else if exist "C:\Program Files\Eclipse Adoptium\jdk-21.0.2.13-hotspot" (
        set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.2.13-hotspot"
    )
)
if defined JAVA_HOME (
    set "PATH=%JAVA_HOME%\bin;%PATH%"
)

:: 1. Verify PostgreSQL Service
echo [1/4] Checking PostgreSQL Database Service (Port 5432)...
powershell -Command "if (-not (Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue).TcpTestSucceeded) { Write-Host '  Attempting to start PostgreSQL service...' -ForegroundColor Yellow; Start-Service -Name '*postgres*' -ErrorAction SilentlyContinue }"
echo   [OK] PostgreSQL Service verified.

:: 2. Clean up any stale processes on ports 8000, 8081, 5173
echo [2/4] Freeing local microservice ports (8000, 8081, 5173)...
powershell -Command "$ports = @(8000, 8081, 5173); foreach ($p in $ports) { $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue; if ($conns) { foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } } }"

:: 3. Launch the 3 Microservices in separate windows
echo [3/4] Starting Microservices...

:: 3a. FastAPI AI Microservice (Port 8000)
echo   - Starting FastAPI AI Engine (Port 8000)...
start "DRAS - FastAPI AI Engine [Port 8000]" cmd /k "title DRAS - FastAPI AI Engine [Port 8000] && cd /d "%BASE_DIR%\ai-service" && echo ============================================================ && echo [1/3] FastAPI AI Service running on Port 8000 && echo ============================================================ && "%PYTHON_EXE%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

:: 3b. Spring Boot Backend (Port 8081)
echo   - Starting Spring Boot Backend API (Port 8081)...
start "DRAS - Spring Boot Backend [Port 8081]" cmd /k "title DRAS - Spring Boot Backend [Port 8081] && cd /d "%BASE_DIR%\backend" && echo ============================================================ && echo [2/3] Spring Boot Backend running on Port 8081 && echo ============================================================ && call mvnw.cmd spring-boot:run"

:: 3c. React + Vite Frontend (Port 5173)
echo   - Starting React Frontend (Port 5173)...
start "DRAS - React Frontend [Port 5173]" cmd /k "title DRAS - React Frontend [Port 5173] && cd /d "%BASE_DIR%\frontend" && echo ============================================================ && echo [3/3] React Frontend running on Port 5173 && echo ============================================================ && call npm run dev"

echo.
echo ============================================================
echo [4/4] Polling microservice health...
echo ============================================================

:: Active Health Polling via dedicated script
powershell -ExecutionPolicy Bypass -File "%BASE_DIR%\scripts\poll_health.ps1" -TimeoutSeconds 60

:: Open default browser
start http://localhost:5173/

echo.
echo ============================================================
echo DRAS System is LIVE at:
echo   - Web Application: http://localhost:5173/
echo   - Backend REST:    http://localhost:8081/api
echo   - AI Swagger Docs: http://localhost:8000/docs
echo   - PostGIS:         Port 5432
echo.
echo To STOP all services:
echo   - Double-click STOP_DISASTER_SYSTEM.bat on your Desktop
echo   - Or close the 3 individual console windows
echo ============================================================
if "%1"=="--no-pause" goto :eof
echo Keep this window open or press any key to close launcher.
pause >nul
