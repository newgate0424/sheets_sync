@echo off
REM Windows Deployment Script

echo Starting deployment for Windows/Plesk...

REM 0. Git push to GitHub
echo.
echo [0/5] Pushing to GitHub...
git add .
git commit -m "Deploy: %date% %time%"
git push origin master
if %ERRORLEVEL% NEQ 0 (
    echo Warning: Git push failed or no changes to commit
)

REM 1. Install dependencies
echo.
echo [1/5] Installing dependencies...
call npm install --production

REM 2. Build the project
echo.
echo [2/5] Building Next.js application...
call npm run build

REM 3. Check if PM2 exists
echo.
echo [3/5] Checking PM2...
where pm2 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo PM2 found. Restarting application...
    pm2 restart bigquery-app
    if %ERRORLEVEL% NEQ 0 (
        echo Starting new PM2 process...
        pm2 start ecosystem.config.json
    )
) else (
    echo PM2 not found. Installing PM2...
    call npm install -g pm2
    echo Starting application with PM2...
    pm2 start ecosystem.config.json
    echo Setting up PM2 startup...
    pm2 save
)

REM 4. Show status
echo.
echo [4/5] Checking application status...
pm2 status

REM 5. Create .gitignore if not exists
echo.
echo [5/5] Checking .gitignore...
if not exist ".gitignore" (
    echo Creating .gitignore...
    (
        echo node_modules/
        echo .next/
        echo .env.local
        echo .env
        echo dist/
        echo build/
        echo logs/
        echo *.log
        echo .DS_Store
    ) > .gitignore
)

echo.
echo =====================================
echo Deployment completed successfully!
echo =====================================
echo.
echo GitHub: https://github.com/newgate0424/sheets_sync
echo Application is running on port 3000
echo Check logs: pm2 logs bigquery-app
echo.
pause
