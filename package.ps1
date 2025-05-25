# PowerShell script to package Firefox extension

# Set variables
$extensionName = "domain-volume-control"
$version = "1.0"
$outputFile = "$extensionName-v$version.xpi"

# Files to include in the package
$files = @(
    "manifest.json",
    "background.js", 
    "content.js",
    "popup.html",
    "popup.js",
    "icon.svg"
)

Write-Host "Packaging Firefox extension..." -ForegroundColor Green
Write-Host "Extension: $extensionName" -ForegroundColor Yellow
Write-Host "Version: $version" -ForegroundColor Yellow

# Remove existing package if it exists
if (Test-Path $outputFile) {
    Remove-Item $outputFile
    Write-Host "Removed existing package file" -ForegroundColor Yellow
}

# Create the XPI package (which is just a ZIP file)
try {
    # Create a temporary ZIP file
    $tempZip = "$extensionName-temp.zip"
    Compress-Archive -Path $files -DestinationPath $tempZip -Force
    
    # Rename to XPI
    Rename-Item $tempZip $outputFile
    
    Write-Host "✓ Extension packaged successfully!" -ForegroundColor Green
    Write-Host "Package: $outputFile" -ForegroundColor Cyan
    Write-Host "Size: $([math]::Round((Get-Item $outputFile).Length / 1KB, 2)) KB" -ForegroundColor Cyan
    
    Write-Host "`nTo install:" -ForegroundColor Yellow
    Write-Host "1. Open Firefox" -ForegroundColor White
    Write-Host "2. Go to about:debugging" -ForegroundColor White
    Write-Host "3. Click 'This Firefox'" -ForegroundColor White
    Write-Host "4. Click 'Load Temporary Add-on...'" -ForegroundColor White
    Write-Host "5. Select manifest.json from this folder" -ForegroundColor White
    Write-Host "`nOr drag and drop $outputFile into Firefox to install" -ForegroundColor White
    
} catch {
    Write-Host "✗ Error packaging extension: $($_.Exception.Message)" -ForegroundColor Red
}
