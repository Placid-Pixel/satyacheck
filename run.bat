@echo off
setlocal enabledelayedexpansion
echo ============================================================
echo  Starting SatyaCheck (AICTE Trust Layer) Prototype
echo ============================================================

cd /d "%~dp0"

REM 1. Detect Python executable
set "PY_CMD="
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PY_CMD="%~dp0backend\venv\Scripts\python.exe""
) else (
    where py.exe >nul 2>&1
    if !errorlevel! equ 0 (
        set "PY_CMD=py -3.12"
    ) else (
        where python.exe >nul 2>&1
        if !errorlevel! equ 0 (
            set "PY_CMD=python"
        )
    )
)

if "%PY_CMD%"=="" (
    echo [ERROR] Python was not found. Please install Python 3.10+ or create backend\venv!
    pause
    exit /b 1
)

echo [1/3] Verifying database schema and demo seed data...
%PY_CMD% backend\scripts\seed_demo_data.py

echo [2/3] Starting FastAPI Backend on http://127.0.0.1:8000...
start "SatyaCheck Backend" /b %PY_CMD% -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend

echo [3/3] Starting React Vite Frontend on http://localhost:3000...
cd frontend
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)
call npm run dev

