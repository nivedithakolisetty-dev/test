@echo off
title Gemini Chatbox Launcher
echo ========================================================
echo         Launching Gemini AI Chatbox System
echo ========================================================
echo.

REM Ensure node is in PATH
set PATH=%PATH%;C:\Program Files\nodejs

echo Checking backend dependencies...
if not exist "backend\node_modules\" (
    echo Installing backend dependencies...
    cd backend
    call npm.cmd install
    cd ..
)

echo.
echo Starting Backend Server on http://localhost:5000 ...
start "Gemini Backend Server" cmd /k "cd /d %~dp0backend && set PATH=%PATH%;C:\Program Files\nodejs && node server.js"

REM Wait 2 seconds for server to start
timeout /t 2 /nobreak >nul

echo Opening browser at http://localhost:5000 ...
start http://localhost:5000

echo.
echo ========================================================
echo Chatbox is running! Keep the backend console open.
echo ========================================================
pause
