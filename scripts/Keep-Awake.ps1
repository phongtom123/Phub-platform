<#
.SYNOPSIS
Keeps Windows awake for a limited time without generating mouse or keyboard input.
.EXAMPLE
.\scripts\Keep-Awake.ps1 -Minutes 120 -KeepDisplayOn
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateRange(1, 1440)]
    [int]$Minutes = 60,

    [switch]$KeepDisplayOn
)

if ($env:OS -ne 'Windows_NT') {
    throw 'This script requires Windows.'
}

if (-not $PSCmdlet.ShouldProcess('Windows power management', "Keep awake for $Minutes minutes")) {
    return
}

if (-not ('Phub.KeepAwake.NativeMethods' -as [type])) {
    Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;

namespace Phub.KeepAwake
{
    public static class NativeMethods
    {
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern uint SetThreadExecutionState(uint flags);
    }
}
'@
}

# ES_CONTINUOUS | ES_SYSTEM_REQUIRED; optionally ES_DISPLAY_REQUIRED.
[uint32]$executionFlags = 2147483649
if ($KeepDisplayOn) {
    $executionFlags = $executionFlags -bor [uint32]2
}

if ([Phub.KeepAwake.NativeMethods]::SetThreadExecutionState($executionFlags) -eq 0) {
    throw 'Windows could not start the keep-awake request.'
}

try {
    Write-Host "Keeping Windows awake for $Minutes minutes. Press Ctrl+C to stop."
    $keepAwakeTimer = [System.Diagnostics.Stopwatch]::StartNew()
    while ($keepAwakeTimer.Elapsed.TotalMinutes -lt $Minutes) {
        Start-Sleep -Seconds 1
    }
}
finally {
    # ES_CONTINUOUS alone clears this thread's power request.
    if ([Phub.KeepAwake.NativeMethods]::SetThreadExecutionState([uint32]2147483648) -eq 0) {
        Write-Warning 'Windows could not clear the keep-awake request. Close this PowerShell process.'
    }
    else {
        Write-Host 'Normal sleep behavior restored.'
    }
}
