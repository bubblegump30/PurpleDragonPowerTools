$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RuntimeRoot = Join-Path $ProjectRoot 'runtime'
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host 'npm is required.' -ForegroundColor Yellow
  exit 1
}
if (-not (Test-Path -LiteralPath (Join-Path $RuntimeRoot 'node_modules'))) {
  Write-Host 'Runtime is not installed yet. Launch PowerTools once first.' -ForegroundColor Yellow
  exit 1
}
Write-Host 'Auditing launch-time runtime dependencies only...' -ForegroundColor Cyan
Push-Location $RuntimeRoot
try {
  & npm audit --omit=dev
  $auditExit = $LASTEXITCODE
} finally {
  Pop-Location
}
exit $auditExit
