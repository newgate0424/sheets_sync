@echo off
REM Quick Start Script for Windows

echo ================================
echo   BigQuery Sync Application
echo ================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

REM Check if .next exists
if not exist ".next" (
    echo Building application...
    call npm run build
    echo.
)

echo Starting application...
echo.
echo Application will run on: http://localhost:3000
echo Press Ctrl+C to stop
echo.

call npm start
