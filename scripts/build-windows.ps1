$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is required. Install the current LTS release first.' -ForegroundColor Yellow
  exit 1
}

Write-Host 'Installing packaging dependencies (build-only)...' -ForegroundColor Cyan
Write-Host 'Normal PowerTools launch does not install these dependencies.' -ForegroundColor DarkGray
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Building NSIS installer and portable Windows executable...' -ForegroundColor Cyan
npm run dist:win
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Build complete. Check the dist folder.' -ForegroundColor Green
