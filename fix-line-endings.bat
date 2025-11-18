@echo off
REM ============================================
REM Windows: Convert Shell Scripts to Unix Format
REM ============================================
REM Run this before pushing to Git
REM ============================================

echo Converting shell scripts to Unix format...

REM Install dos2unix if not available (via Git Bash)
where dos2unix >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Warning: dos2unix not found
    echo Install Git Bash or use: npm install -g dos2unix
    echo.
    echo Manual fix: Open files in Notepad++ and convert to Unix LF
    pause
    exit /b 1
)

REM Convert files
dos2unix plesk-setup.sh
dos2unix plesk-start.sh
dos2unix .plesk-deploy.sh
dos2unix deploy.sh
dos2unix check-production.sh

echo Done! Shell scripts converted to Unix format.
pause
