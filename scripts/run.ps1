$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $ProjectRoot

$ExpectedElectronVersion = '44.2.0'
$RuntimeRoot = Join-Path $ProjectRoot 'runtime'
$RuntimeModule = Join-Path $RuntimeRoot 'node_modules\electron'
$RuntimePackage = Join-Path $RuntimeModule 'package.json'
$RuntimeCli = Join-Path $RuntimeModule 'cli.js'
$RuntimeInstallScript = Join-Path $RuntimeModule 'install.js'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js is required for the one-time source runtime setup. Install the current LTS release first.' -ForegroundColor Yellow
  Read-Host 'Press Enter to close'
  exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host 'npm is required for the one-time source runtime setup.' -ForegroundColor Yellow
  Read-Host 'Press Enter to close'
  exit 1
}

function Get-ElectronVersion([string]$packagePath) {
  if (-not (Test-Path -LiteralPath $packagePath)) { return $null }
  try {
    $pkg = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    return [string]$pkg.version
  } catch { return $null }
}

function Get-ElectronExecutable([string]$moduleRoot) {
  if (-not (Test-Path -LiteralPath $moduleRoot)) { return $null }

  # Electron 44+ writes the platform executable name to path.txt after the
  # on-demand binary download. Use that authoritative path first instead of
  # assuming the binary already exists immediately after `npm install`.
  $pathFile = Join-Path $moduleRoot 'path.txt'
  if (Test-Path -LiteralPath $pathFile) {
    try {
      $relative = (Get-Content -LiteralPath $pathFile -Raw).Trim()
      if (-not [string]::IsNullOrWhiteSpace($relative)) {
        $candidate = Join-Path (Join-Path $moduleRoot 'dist') $relative
        if (Test-Path -LiteralPath $candidate) { return $candidate }
      }
    } catch { }
  }

  # Windows fallback for older/current Electron layouts.
  $fallback = Join-Path $moduleRoot 'dist\electron.exe'
  if (Test-Path -LiteralPath $fallback) { return $fallback }
  return $null
}

function Test-CompatibleRuntimePackage([string]$moduleRoot, [string]$packagePath) {
  if ((Get-ElectronVersion $packagePath) -ne $ExpectedElectronVersion) { return $false }
  return ((Test-Path -LiteralPath (Join-Path $moduleRoot 'cli.js')) -and (Test-Path -LiteralPath (Join-Path $moduleRoot 'install.js')))
}

function Invoke-ElectronBinaryBootstrap([string]$moduleRoot) {
  $existing = Get-ElectronExecutable $moduleRoot
  if ($existing) { return $existing }

  $installScript = Join-Path $moduleRoot 'install.js'
  if (-not (Test-Path -LiteralPath $installScript)) { return $null }

  Write-Host ('Downloading Electron ' + $ExpectedElectronVersion + ' Windows binary (one-time)...') -ForegroundColor Cyan
  Write-Host 'Electron 44+ installs the npm wrapper first, then downloads its native binary on demand.' -ForegroundColor DarkGray

  # A global/custom environment can tell Electron to skip or cross-download the
  # binary. Purple Dragon PowerTools is a local Windows app, so use the actual
  # host platform/architecture for this bootstrap and restore the caller's
  # environment afterwards.
  $names = @(
    'ELECTRON_SKIP_BINARY_DOWNLOAD',
    'ELECTRON_INSTALL_PLATFORM',
    'ELECTRON_INSTALL_ARCH',
    'npm_config_platform',
    'npm_config_arch'
  )
  $saved = @{}
  foreach ($name in $names) {
    $item = Get-Item -LiteralPath ('Env:' + $name) -ErrorAction SilentlyContinue
    $saved[$name] = if ($null -ne $item) { @{ exists = $true; value = $item.Value } } else { @{ exists = $false; value = $null } }
    Remove-Item -LiteralPath ('Env:' + $name) -ErrorAction SilentlyContinue
  }

  try {
    & node $installScript --no
    $bootstrapExit = $LASTEXITCODE
  }
  catch {
    Write-Host ('Electron binary bootstrap failed: ' + $_.Exception.Message) -ForegroundColor Red
    $bootstrapExit = 1
  }
  finally {
    foreach ($name in $names) {
      if ($saved[$name].exists) {
        Set-Item -LiteralPath ('Env:' + $name) -Value $saved[$name].value
      } else {
        Remove-Item -LiteralPath ('Env:' + $name) -ErrorAction SilentlyContinue
      }
    }
  }

  if ($bootstrapExit -ne 0) { return $null }
  return Get-ElectronExecutable $moduleRoot
}

$electron = $null
if (Test-CompatibleRuntimePackage $RuntimeModule $RuntimePackage) {
  $electron = Get-ElectronExecutable $RuntimeModule
  if (-not $electron) {
    # Repair a package-only/partial Electron 44+ runtime automatically.
    $electron = Invoke-ElectronBinaryBootstrap $RuntimeModule
  }
}

# Reuse only an exact, complete Electron 44.2.0 runtime from a sibling release.
if (-not $electron) {
  try {
    $releaseFolder = Split-Path -Parent $ProjectRoot
    $releaseParent = Split-Path -Parent $releaseFolder
    $folders = Get-ChildItem -LiteralPath $releaseParent -Directory -Filter 'PurpleDragonPowerTools-v*' -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending
    foreach ($folder in $folders) {
      if ($folder.FullName -eq $releaseFolder) { continue }
      $candidateModule = Join-Path $folder.FullName 'PurpleDragonPowerTools\runtime\node_modules\electron'
      $candidatePackage = Join-Path $candidateModule 'package.json'
      if (Test-CompatibleRuntimePackage $candidateModule $candidatePackage) {
        $candidateElectron = Get-ElectronExecutable $candidateModule
        if ($candidateElectron) {
          $electron = $candidateElectron
          Write-Host ('Reusing compatible Electron ' + $ExpectedElectronVersion + ' runtime from an earlier PowerTools build.') -ForegroundColor DarkGray
          break
        }
      }
    }
  } catch { }
}

if (-not $electron) {
  Write-Host ('Installing minimal PowerTools runtime package (Electron ' + $ExpectedElectronVersion + ')...') -ForegroundColor Cyan
  Write-Host 'Packaging/build dependencies are not installed during normal launch.' -ForegroundColor DarkGray
  if (-not (Test-Path -LiteralPath $RuntimeRoot)) { New-Item -ItemType Directory -Path $RuntimeRoot | Out-Null }

  Push-Location $RuntimeRoot
  try {
    & npm install --no-audit --no-fund --loglevel=error
    $runtimeInstallExit = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  if ($runtimeInstallExit -ne 0) {
    Write-Host 'Minimal Electron runtime package install failed.' -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit $runtimeInstallExit
  }

  if (-not (Test-CompatibleRuntimePackage $RuntimeModule $RuntimePackage)) {
    $actualVersion = Get-ElectronVersion $RuntimePackage
    if ([string]::IsNullOrWhiteSpace($actualVersion)) { $actualVersion = 'not found' }
    Write-Host ('Electron npm package verification failed. Expected ' + $ExpectedElectronVersion + '; found ' + $actualVersion + '.') -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
  }

  # Electron 44+ deliberately does not guarantee that dist/electron.exe exists
  # immediately after npm package installation. Trigger its supported on-demand
  # binary installer before validating the executable.
  $electron = Invoke-ElectronBinaryBootstrap $RuntimeModule
  if (-not $electron) {
    Write-Host ''
    Write-Host ('Electron ' + $ExpectedElectronVersion + ' npm package installed, but its Windows binary could not be downloaded or verified.') -ForegroundColor Red
    Write-Host 'The detailed download/network error should be shown above.' -ForegroundColor Yellow
    Write-Host ('Runtime package: ' + $RuntimePackage) -ForegroundColor DarkGray
    Write-Host ('Binary folder: ' + (Join-Path $RuntimeModule 'dist')) -ForegroundColor DarkGray
    Write-Host 'You can rerun this launcher; partial Electron runtimes are repaired automatically.' -ForegroundColor Yellow
    Read-Host 'Press Enter to close'
    exit 1
  }
}

if (-not (Test-Path -LiteralPath $electron)) {
  Write-Host 'Electron runtime could not be found after bootstrap.' -ForegroundColor Red
  Read-Host 'Press Enter to close'
  exit 1
}

Write-Host 'Starting Purple Dragon PowerTools v2.1.0 Release Candidate...' -ForegroundColor Green
Write-Host ('Runtime: Electron ' + $ExpectedElectronVersion + ' (isolated launch dependency set).') -ForegroundColor DarkGray
Write-Host 'Fast boot is enabled. Heavy system modules remain lazy-loaded.' -ForegroundColor DarkGray

# Our source does not construct fs.Stats directly. Some upstream Node/Electron
# stacks can emit DEP0180 from internals. Suppress that one upstream deprecation
# only; other warnings remain visible.
$previousNodeOptions = $env:NODE_OPTIONS
try {
  $depFlag = '--disable-warning=DEP0180'
  if ([string]::IsNullOrWhiteSpace($previousNodeOptions)) {
    $env:NODE_OPTIONS = $depFlag
  } elseif ($previousNodeOptions -notmatch 'disable-warning=DEP0180') {
    $env:NODE_OPTIONS = ($previousNodeOptions + ' ' + $depFlag)
  }

  # PowerShell can launch Windows GUI executables without populating
  # $LASTEXITCODE. Wait on the actual Electron process so the launcher gets a
  # real numeric exit code instead of falsely reporting "code .".
  try {
    $launchArgs = @("`"$ProjectRoot`"")
    $process = Start-Process -FilePath $electron -ArgumentList $launchArgs -WorkingDirectory $ProjectRoot -PassThru -Wait
    $exitCode = if ($null -ne $process.ExitCode) { [int]$process.ExitCode } else { 0 }
  }
  catch {
    Write-Host ('PowerTools launch failed: ' + $_.Exception.Message) -ForegroundColor Red
    $exitCode = 1
  }
}
finally {
  $env:NODE_OPTIONS = $previousNodeOptions
}

if ($exitCode -ne 0) {
  Write-Host ''
  Write-Host ('PowerTools exited with code ' + $exitCode + '.') -ForegroundColor Red
  Write-Host 'Leave this window open and send a screenshot if the error repeats.' -ForegroundColor Yellow
  Read-Host 'Press Enter to close'
}
exit $exitCode
