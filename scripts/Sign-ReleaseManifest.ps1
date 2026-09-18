param(
  [string]$ManifestPath = 'dist/release-manifest.json',
  [string]$SigningKey = "$HOME/.ssh/purple_dragon_release_signing"
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$manifest = if ([System.IO.Path]::IsPathRooted($ManifestPath)) { $ManifestPath } else { Join-Path $repoRoot $ManifestPath }
$key = if ([System.IO.Path]::IsPathRooted($SigningKey)) { $SigningKey } else { Join-Path $repoRoot $SigningKey }

if (-not (Test-Path -LiteralPath $manifest)) { throw "Release manifest not found: $manifest" }
if (-not (Test-Path -LiteralPath $key)) { throw "Release signing key not found: $key" }

$manifestData = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
if ($null -eq $manifestData.signature -or $manifestData.signature.algorithm -ne 'ssh-ed25519' -or $manifestData.signature.file -ne 'release-manifest.json.sig') {
  throw 'Manifest signature metadata is missing. Re-run New-ReleaseManifest.ps1 with -IncludeSignatureMetadata before signing.'
}

$sshKeygen = Get-Command ssh-keygen -ErrorAction Stop
$signature = "$manifest.sig"
if (Test-Path -LiteralPath $signature) { Remove-Item -LiteralPath $signature -Force }

& $sshKeygen.Source -Y sign -f $key -n file $manifest
if ($LASTEXITCODE -ne 0) { throw "ssh-keygen failed with exit code $LASTEXITCODE" }
if (-not (Test-Path -LiteralPath $signature)) { throw "Expected detached signature was not created: $signature" }

Write-Host "Signed release manifest: $signature"
Write-Host 'The private signing key was read locally and was not copied into the repository.'
