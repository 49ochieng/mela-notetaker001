# Test the Mela Notetaker bot easily

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "  MELA NOTETAKER TEST LAUNCHER" -ForegroundColor Cyan  
Write-Host "===========================================`n" -ForegroundColor Cyan

# Step 1: Start the bot app in the background
Write-Host "[1/3] Starting bot application..." -ForegroundColor Yellow
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev:teamsfx:testtool" -WindowStyle Normal

# Wait for app to initialize
Write-Host "[2/3] Waiting for app to initialize (15 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Step 2: Start the Microsoft 365 Agents Playground
Write-Host "[3/3] Launching Microsoft 365 Agents Playground..." -ForegroundColor Yellow
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; npm run dev:teamsfx:launch-testtool" -WindowStyle Normal

# Wait for playground to start
Start-Sleep -Seconds 5

# Step 3: Open the playground in browser
Write-Host "`n✅ Opening test playground in browser..." -ForegroundColor Green
Start-Process "http://localhost:56150"

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "  TEST ENVIRONMENT READY!" -ForegroundColor Green
Write-Host "===========================================`n" -ForegroundColor Cyan
Write-Host "Bot App:       http://localhost:3978" -ForegroundColor White
Write-Host "DevTools:      http://localhost:3979/devtools" -ForegroundColor White  
Write-Host "Test Playground: http://localhost:56150" -ForegroundColor White
Write-Host "`nTwo PowerShell windows have been opened:" -ForegroundColor Yellow
Write-Host "  1. Bot Application (port 3978)" -ForegroundColor White
Write-Host "  2. Test Playground (port 56150)" -ForegroundColor White
Write-Host "`nClose those windows to stop the test environment." -ForegroundColor Yellow
Write-Host "Press any key to exit this launcher..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
