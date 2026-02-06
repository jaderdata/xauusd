@echo off
TITLE XAUUSD PRO SYSTEM - STARTUP
echo [1/3] Starting Web Dashboard...
start cmd /k "cd web-dashboard && npm run dev"

echo [2/3] Waiting for server to initialize...
timeout /t 5

echo [3/3] Starting MT5 Python Bridge...
start cmd /k "cd web-dashboard && python bridge.py"

echo.
echo ======================================================
echo SYSTEM ONLINE!
echo 1. Dashboard is at: http://localhost:3000
echo 2. MT5 Bridge is connecting to your account...
echo (Keep both windows open)
echo ======================================================
pause
