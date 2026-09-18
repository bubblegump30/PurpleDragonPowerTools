param(
  [string]$DistPath = 'dist',
  [ValidateSet('stable','preview')][string]$Channel = 'preview',
  [string]$Commit = $env:GITHUB_SHA,
  [string]$MinimumVersion = '2.1.0',
  [string]$KeyId = 'GitHub-verified release tag key',
  [switch]$IncludeSignatureMetadata
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$packagePath = Join-Path $repoRoot 'package.json'
$dist = Join-Path $repoRoot $DistPath
if (-not (Test-Path -LiteralPath $packagePath)) { throw 'package.json is missing.' }
if (-not (Test-Path -LiteralPath $dist)) { throw "Distribution folder is missing: $dist" }

$pkg = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
$version = [string]$pkg.version
if ($version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') { throw "Invalid package version: $version" }
if ([string]::IsNullOrWhiteSpace($Commit)) { $Commit = (git -C $repoRoot rev-parse HEAD).Trim() }
if ($Commit -notmatch '^[0-9a-fA-F]{40}$') { throw "Invalid Git commit: $Commit" }

$publishable = @(Get-ChildItem -LiteralPath $dist -File | Where-Object { $_.Extension -in '.exe','.msi','.zip' } | Sort-Object Name)
if ($publishable.Count -lt 1) { throw 'No publishable release package was found.' }

$assets = foreach ($file in $publishable) {
  $kind = if ($file.Name -match 'Setup') { 'installer' } elseif ($file.Name -match 'Portable') { 'portable' } elseif ($file.Extension -eq '.zip') { 'archive' } else { 'other' }
  [ordered]@{
    name = $file.Name
    sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    sizeBytes = [int64]$file.Length
    kind = $kind
  }
}

$manifest = [ordered]@{
  schemaVersion = 1
  product = 'Purple Dragon PowerTools'
  version = $version
  channel = $Channel
  publishedAt = [DateTime]::UtcNow.ToString('o')
  repository = 'bubblegump30/PurpleDragonPowerTools'
  commit = $Commit.ToLowerInvariant()
  minimumVersion = $MinimumVersion
  releaseNotesUrl = $null
  assets = @($assets)
  signature = $null
}
if ($IncludeSignatureMetadata) {
  $manifest.signature = [ordered]@{
    algorithm = 'ssh-ed25519'
    keyId = $KeyId
    file = 'release-manifest.json.sig'
  }
}

$outputPath = Join-Path $dist 'release-manifest.json'
$json = $manifest | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($outputPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Write-Host "Release manifest written: $outputPath"
Get-Content -LiteralPath $outputPath
