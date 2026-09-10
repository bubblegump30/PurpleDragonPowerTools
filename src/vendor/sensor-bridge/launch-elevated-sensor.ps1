param(
    [Parameter(Mandatory=$true)][string]$BridgeScript,
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [Parameter(Mandatory=$true)][int]$OwnerPid,
    [Parameter(Mandatory=$true)][string]$WorkingDirectory
)
$ErrorActionPreference = 'Stop'
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path -LiteralPath $ps)) { $ps = 'powershell.exe' }
$args = @(
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', ('"' + $BridgeScript + '"'),
    '-OutputPath', ('"' + $OutputPath + '"'),
    '-OwnerPid', [string]$OwnerPid
)
try {
    Start-Process -FilePath $ps -Verb RunAs -WorkingDirectory $WorkingDirectory -ArgumentList $args | Out-Null
    exit 0
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 5
}
