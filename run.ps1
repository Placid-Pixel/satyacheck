# SatyaCheck — AICTE Trust Layer Startup Script
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Starting SatyaCheck (AICTE Trust Layer) Prototype" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# 0. Resolve Python executable
$pythonExe = ""
$pythonArgsPrefix = @()

if (Test-Path "$ROOT\backend\venv\Scripts\python.exe") {
    $pythonExe = "$ROOT\backend\venv\Scripts\python.exe"
} elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pythonExe = "py"
    $pythonArgsPrefix = @("-3.12")
} else {
    $pythonExe = "python"
}

# 1. Seed Demo Data if not already seeded
Write-Host "`n[1/3] Verifying database and demo seed data..." -ForegroundColor Yellow
& $pythonExe @pythonArgsPrefix "$ROOT\backend\scripts\seed_demo_data.py"

# 2. Start Backend FastAPI Server
Write-Host "`n[2/3] Starting FastAPI Backend on http://127.0.0.1:8000..." -ForegroundColor Yellow
$backendArgs = @() + $pythonArgsPrefix + @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000")
$backendJob = Start-Process -FilePath $pythonExe -ArgumentList $backendArgs -WorkingDirectory "$ROOT\backend" -PassThru

# 3. Start Frontend Vite Server
Write-Host "`n[3/3] Starting React Vite Frontend on http://localhost:3000..." -ForegroundColor Yellow
if (-not (Test-Path "$ROOT\frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    cmd.exe /c "cd /d `"$ROOT\frontend`" && npm install"
}
$frontendJob = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WorkingDirectory "$ROOT\frontend" -PassThru

Start-Sleep -Seconds 3

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " SatyaCheck is LIVE and Ready for Demonstration!" -ForegroundColor Green
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " Frontend Web App:  http://localhost:3000" -ForegroundColor White
Write-Host " Backend API Docs:  http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host " Health Endpoint:   http://127.0.0.1:8000/health" -ForegroundColor White
Write-Host "------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " Default Demo Roles (Pre-configured in UI Role Switcher):" -ForegroundColor White
Write-Host "  - Scrutiny Officer:   scrutiny_officer / officer123" -ForegroundColor Gray
Write-Host "  - Institution User:   inst_user        / inst123" -ForegroundColor Gray
Write-Host "  - Senior Authority:   senior_authority / senior123" -ForegroundColor Gray
Write-Host "  - Administrator:      admin_user       / admin123" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Press Ctrl+C in this terminal to stop background services." -ForegroundColor Yellow

try {
    Wait-Process -Id $frontendJob.Id
} finally {
    Stop-Process -Id $backendJob.Id -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendJob.Id -ErrorAction SilentlyContinue
}
