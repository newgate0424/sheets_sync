@echo off
REM ============================================
REM Windows: Create Deployment Package
REM ============================================
REM สร้าง zip file สำหรับ upload ไป Plesk
REM ============================================

echo ========================================
echo Creating Deployment Package
echo ========================================
echo.

REM Check if build exists
if not exist ".next" (
    echo ERROR: .next folder not found!
    echo Please run: npm run build
    pause
    exit /b 1
)

echo Step 1: Building application...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Creating deployment package...

REM Create deploy folder
if exist deploy rmdir /s /q deploy
mkdir deploy

REM Copy necessary files
echo Copying files...
xcopy /E /I /Y .next deploy\.next
xcopy /E /I /Y app deploy\app
xcopy /E /I /Y lib deploy\lib
xcopy /E /I /Y components deploy\components
xcopy /E /I /Y public deploy\public 2>nul

copy /Y app.js deploy\
copy /Y passenger.js deploy\
copy /Y package.json deploy\
copy /Y next.config.js deploy\
copy /Y ecosystem.config.json deploy\
copy /Y .env deploy\
copy /Y credentials.json deploy\ 2>nul

REM Create tmp folder
mkdir deploy\tmp
echo. > deploy\tmp\restart.txt

echo.
echo Step 3: Creating ZIP file...
powershell -Command "Compress-Archive -Path deploy\* -DestinationPath deploy-package.zip -Force"

if exist deploy-package.zip (
    echo.
    echo ========================================
    echo SUCCESS! Package created
    echo ========================================
    echo.
    echo File: deploy-package.zip
    echo Size: 
    powershell -Command "(Get-Item deploy-package.zip).Length / 1MB | ForEach-Object {'{0:N2} MB' -f $_}"
    echo.
    echo Next steps:
    echo 1. Upload deploy-package.zip to Plesk File Manager
    echo 2. Extract in /httpdocs
    echo 3. In Plesk Node.js: Click "NPM Install"
    echo 4. Click "Restart App"
    echo.
) else (
    echo ERROR: Failed to create ZIP file
)

REM Cleanup
rmdir /s /q deploy

pause
