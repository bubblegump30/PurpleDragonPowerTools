$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RuntimeRoot = Join-Path $ProjectRoot 'runtime'
$Modules = Join-Path $RuntimeRoot 'node_modules'
$LockFile = Join-Path $RuntimeRoot 'package-lock.json'

Write-Host 'Purple Dragon PowerTools — Runtime Repair' -ForegroundColor Cyan
Write-Host 'This removes only the generated local Electron runtime and reinstalls it on the next launch.' -ForegroundColor DarkGray

if (Test-Path -LiteralPath $Modules) {
  Remove-Item -LiteralPath $Modules -Recurse -Force
  Write-Host 'Removed runtime\node_modules.' -ForegroundColor Green
}
if (Test-Path -LiteralPath $LockFile) {
  Remove-Item -LiteralPath $LockFile -Force
  Write-Host 'Removed generated runtime package lock.' -ForegroundColor Green
}

Write-Host 'Runtime reset complete. Starting the normal launcher...' -ForegroundColor Green
& (Join-Path $PSScriptRoot 'run.ps1')
exit $LASTEXITCODE
