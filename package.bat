@echo off
echo Packaging Firefox extension...

set EXTENSION_NAME=domain-volume-control
set VERSION=1.0
set OUTPUT_FILE=%EXTENSION_NAME%-v%VERSION%.xpi

:: Remove existing package if it exists
if exist "%OUTPUT_FILE%" del "%OUTPUT_FILE%"

:: Create ZIP file with all necessary files
echo Creating package...
powershell -Command "Compress-Archive -Path 'manifest.json','background.js','content.js','popup.html','popup.js','icon.svg' -DestinationPath '%EXTENSION_NAME%-temp.zip' -Force"

:: Rename to XPI
ren "%EXTENSION_NAME%-temp.zip" "%OUTPUT_FILE%"

echo.
echo ✓ Extension packaged successfully!
echo Package: %OUTPUT_FILE%
echo.
echo To install:
echo 1. Open Firefox
echo 2. Go to about:debugging
echo 3. Click 'This Firefox'
echo 4. Click 'Load Temporary Add-on...'
echo 5. Select manifest.json from this folder
echo.
echo Or drag and drop %OUTPUT_FILE% into Firefox to install
echo.
pause
