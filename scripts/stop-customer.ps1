param([ValidateSet('Demo', 'Real', 'SupabaseTest')][string]$Mode = 'Demo')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskRecord = Join-Path $taskRoot ".customer-runtime/$Mode-processes.json"
if (-not (Test-Path -LiteralPath $taskRecord)) { Write-Output 'No recorded customer servers.'; exit 0 }
$taskEntries = Get-Content -LiteralPath $taskRecord -Raw | ConvertFrom-Json
foreach ($taskEntry in $taskEntries) {
    $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($taskEntry.pid)"
    if (-not $taskProcess) { continue }
    if ($taskProcess.ExecutablePath -ne $taskEntry.executable -or -not $taskProcess.CommandLine.Contains($taskEntry.marker)) {
        throw "PID $($taskEntry.pid) no longer matches the recorded customer server; leaving it alone."
    }
    taskkill.exe /PID $taskEntry.pid /T /F
    if ($LASTEXITCODE -ne 0) { throw "Could not stop customer server $($taskEntry.name)" }
}
Remove-Item -LiteralPath $taskRecord
Write-Output "Customer $Mode servers stopped; source and dependencies preserved."
