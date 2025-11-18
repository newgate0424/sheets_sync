@echo off
REM ============================================
REM Git Push and Auto Deploy
REM ============================================
REM Push to GitHub and Plesk will auto-deploy
REM ============================================

echo ========================================
echo Git Push for Plesk Auto-Deploy
echo ========================================
echo.

REM Check if git repo
if not exist ".git" (
    echo ERROR: Not a git repository!
    pause
    exit /b 1
)

REM Build first
echo Step 1: Building application...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Git Status
git status

echo.
echo Step 3: Adding files...
git add .

echo.
set /p commit_msg="Enter commit message (or press Enter for default): "
if "%commit_msg%"=="" set commit_msg=Update for Plesk deployment

echo.
echo Step 4: Committing...
git commit -m "%commit_msg%"

echo.
echo Step 5: Pushing to GitHub...
git push origin master

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! Code pushed to GitHub
    echo ========================================
    echo.
    echo Plesk will auto-deploy in a few moments
    echo.
    echo Check status in:
    echo - Plesk ^> Git ^> Repository Status
    echo - Plesk ^> Node.js ^> Show Logs
    echo.
) else (
    echo.
    echo ERROR: Git push failed!
    echo Please check your internet connection and try again
)

pause
