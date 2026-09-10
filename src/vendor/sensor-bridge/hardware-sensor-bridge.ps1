param(
    [Parameter(Mandatory=$true)][string]$OutputPath,
    [Parameter(Mandatory=$true)][int]$OwnerPid
)

# Purple Dragon PowerTools v0.3.5 - isolated elevated Ryzen sensor bridge.
# The main Electron app stays non-elevated. Only this read-only sensor helper is elevated.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$lhmPath = Join-Path $base 'LibreHardwareMonitorLib.dll'
try { Set-Location -LiteralPath $base; [Environment]::CurrentDirectory = $base } catch { }

function Write-State($payload) {
    try {
        $dir = Split-Path -Parent $OutputPath
        if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $temp = $OutputPath + '.new'
        $json = $payload | ConvertTo-Json -Compress -Depth 6
        [System.IO.File]::WriteAllText($temp, $json, [System.Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temp -Destination $OutputPath -Force
    } catch { }
}

function Is-Administrator {
    try {
        $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($identity)
        return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}

function Owner-Is-Alive {
    try { return $null -ne (Get-Process -Id $OwnerPid -ErrorAction Stop) } catch { return $false }
}

function Update-HardwareRecursive($hardware) {
    try { $hardware.Update() } catch { }
    foreach ($child in @($hardware.SubHardware)) { Update-HardwareRecursive $child }
}

function Get-HardwareRecursive($hardware) {
    Write-Output $hardware
    foreach ($child in @($hardware.SubHardware)) { Get-HardwareRecursive $child }
}

function Get-SensorScore($sensor) {
    $name = [string]$sensor.Name
    if ($name -match 'Core \(Tctl/Tdie\)|Tctl/Tdie|CPU Package|Package') { return 0 }
    if ($name -match 'Tctl|Tdie') { return 1 }
    if ($name -match 'Core') { return 2 }
    return 10
}

if (-not (Is-Administrator)) {
    Write-State ([PSCustomObject]@{
        ok=$false; provider='LibreHardwareMonitor'; cpuTemperatureC=$null; cpuSensorName=$null;
        cpuTemperatureSource=$null; needsElevation=$true; error='Administrator approval was not granted for the isolated CPU sensor helper.';
        timestamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    })
    exit 5
}

try {
    if (-not (Test-Path -LiteralPath $lhmPath)) { throw 'LibreHardwareMonitorLib.dll not found.' }

    # Files extracted from a downloaded ZIP can inherit Mark-of-the-Web. .NET Framework
    # then rejects Assembly.LoadFrom with HRESULT 0x80131515, even on a local drive.
    # The helper is already explicitly elevated by the user, so remove only the Zone.Identifier
    # from this bundled, read-only sensor runtime and use UnsafeLoadFrom as the remote-zone-safe fallback.
    foreach ($file in @(Get-ChildItem -LiteralPath $base -File -ErrorAction SilentlyContinue)) {
        try { Unblock-File -LiteralPath $file.FullName -ErrorAction SilentlyContinue } catch { }
        try { Remove-Item -LiteralPath $file.FullName -Stream Zone.Identifier -Force -ErrorAction SilentlyContinue } catch { }
    }

    $resolver = [System.ResolveEventHandler]{
        param($sender, $args)
        try {
            $assemblyName = New-Object System.Reflection.AssemblyName($args.Name)
            $candidate = Join-Path $base ($assemblyName.Name + '.dll')
            if (Test-Path -LiteralPath $candidate) {
                return [System.Reflection.Assembly]::UnsafeLoadFrom($candidate)
            }
        } catch { }
        return $null
    }
    [AppDomain]::CurrentDomain.add_AssemblyResolve($resolver)

    # Preload the exact dependency set shipped by the working Purple Dragon Fan Control runtime.
    Get-ChildItem -LiteralPath $base -Filter '*.dll' | Where-Object { $_.Name -ne 'LibreHardwareMonitorLib.dll' } | ForEach-Object {
        try { [void][System.Reflection.Assembly]::UnsafeLoadFrom($_.FullName) } catch { }
    }
    [void][System.Reflection.Assembly]::UnsafeLoadFrom($lhmPath)

    $computer = New-Object LibreHardwareMonitor.Hardware.Computer
    $computer.IsCpuEnabled = $true
    $computer.IsMotherboardEnabled = $true
    $computer.IsControllerEnabled = $true
    $computer.Open()

    try {
        while (Owner-Is-Alive) {
            $allHardware = @()
            foreach ($hardware in @($computer.Hardware)) {
                Update-HardwareRecursive $hardware
                $allHardware += @(Get-HardwareRecursive $hardware)
            }

            $cpuHardware = @($allHardware | Where-Object { $_.HardwareType.ToString() -eq 'Cpu' })
            $temps = @($cpuHardware |
                ForEach-Object { @($_.Sensors) } |
                Where-Object {
                    $_.SensorType.ToString() -eq 'Temperature' -and
                    $null -ne $_.Value -and
                    [double]$_.Value -gt 0 -and [double]$_.Value -lt 130
                })

            $selected = $null
            if ($temps.Count -gt 0) {
                $selected = $temps |
                    Sort-Object @{Expression={ Get-SensorScore $_ }; Ascending=$true}, @{Expression={ [double]$_.Value }; Descending=$true} |
                    Select-Object -First 1
            }

            if ($null -ne $selected) {
                Write-State ([PSCustomObject]@{
                    ok=$true; provider='LibreHardwareMonitor'; cpuTemperatureC=[math]::Round([double]$selected.Value,1);
                    cpuSensorName=[string]$selected.Name; cpuTemperatureSource=('LibreHardwareMonitor / ' + [string]$selected.Name);
                    needsElevation=$false; error=$null; cpuHardwareCount=$cpuHardware.Count; temperatureSensorCount=$temps.Count;
                    timestamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                })
            } else {
                $names = @($cpuHardware | ForEach-Object { @($_.Sensors) } | Where-Object { $_.SensorType.ToString() -eq 'Temperature' } | ForEach-Object { [string]$_.Name })
                Write-State ([PSCustomObject]@{
                    ok=$false; provider='LibreHardwareMonitor'; cpuTemperatureC=$null; cpuSensorName=$null; cpuTemperatureSource=$null;
                    needsElevation=$false;
                    error=if ($cpuHardware.Count -eq 0) { 'LibreHardwareMonitor did not enumerate a CPU device.' } else { 'CPU device found, but no temperature sensor has produced a value yet.' };
                    cpuHardwareCount=$cpuHardware.Count; temperatureSensorCount=$temps.Count; detectedTemperatureSensors=$names;
                    timestamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
                })
            }
            Start-Sleep -Milliseconds 1000
        }
    }
    finally {
        try { $computer.Close() } catch { }
    }
}
catch {
    Write-State ([PSCustomObject]@{
        ok=$false; provider='LibreHardwareMonitor'; cpuTemperatureC=$null; cpuSensorName=$null; cpuTemperatureSource=$null;
        needsElevation=$false; error=('Sensor bridge error: ' + $_.Exception.Message);
        timestamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    })
    Start-Sleep -Milliseconds 400
    exit 2
}
