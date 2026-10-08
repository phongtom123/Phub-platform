param(
    [ValidateSet('Demo', 'Real', 'SupabaseTest')][string]$Mode = 'Demo',
    [switch]$Production,
    [switch]$RequireTestSession
)
$ErrorActionPreference = 'Stop'
if ($RequireTestSession -and $Mode -ne 'SupabaseTest') {
    throw '-RequireTestSession is only available with -Mode SupabaseTest.'
}
$taskRoot = Split-Path $PSScriptRoot -Parent
$taskBackend = Join-Path $taskRoot 'Backend'
$taskFrontend = Join-Path $taskRoot 'ui/userUI/Frontend'
$taskPython = Join-Path $taskBackend '.venv/Scripts/python.exe'
$taskNext = Join-Path $taskFrontend 'node_modules/next/dist/bin/next'
$taskNode = (Get-Command node.exe).Source
if (-not (Test-Path -LiteralPath $taskPython) -or -not (Test-Path -LiteralPath $taskNext)) {
    throw 'Install Backend requirements and customer Frontend npm dependencies first; see CUSTOMER-DEPLOYMENT.md.'
}
$taskBackendPort = if ($Mode -eq 'Demo') { 18001 } else { 8001 }
$taskUiPort = if ($Mode -eq 'Demo') { 13001 } else { 3001 }
$taskRuntime = Join-Path $taskRoot '.customer-runtime'
$taskRecord = Join-Path $taskRuntime "$Mode-processes.json"
foreach ($taskPort in @($taskBackendPort, $taskUiPort)) {
    $taskListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $taskPort)
    try { $taskListener.Start() } finally { $taskListener.Stop() }
}
# Next.js checks its own live process lock. A lock file may remain after a crash;
# file existence alone must not prevent restarting the customer server.
if ($Production -and -not (Test-Path -LiteralPath (Join-Path $taskFrontend '.next/BUILD_ID'))) {
    throw 'Run npm run build -- --webpack in the customer Frontend before using -Production.'
}
New-Item -ItemType Directory -Path $taskRuntime -Force | Out-Null
$taskProcesses = @()
$taskApp = 'app.main:app'
if ($Mode -eq 'Demo') {
    $env:PHUB_E2E_MODE = 'isolated-fixtures'
    if (-not $env:PHUB_E2E_CONTROL_KEY -or $env:PHUB_E2E_CONTROL_KEY.Length -lt 32) {
        $env:PHUB_E2E_CONTROL_KEY = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    }
    $env:PHUB_DEMO_UI_ORIGIN = "http://127.0.0.1:$taskUiPort"
    $taskApp = 'scripts.manual_shopping:app'
}
if ($Mode -eq 'SupabaseTest') {
    $env:PHUB_SUPABASE_TEST_MODE = 'local-only'
    $env:PHUB_SUPABASE_TEST_AUTO_CUSTOMER = if ($RequireTestSession) { '0' } else { '1' }
    $env:PHUB_SUPABASE_TEST_UI_ORIGIN = "http://127.0.0.1:$taskUiPort"
    $taskApp = 'scripts.supabase_shopping_test:app'
}
$env:PHUB_API_BASE_URL = "http://127.0.0.1:$taskBackendPort"
$env:PHUB_UI_ORIGIN = "http://127.0.0.1:$taskUiPort"
$env:NEXT_TELEMETRY_DISABLED = '1'
$taskWasm = Join-Path $taskFrontend 'node_modules/@next/swc-wasm-nodejs'
if (Test-Path -LiteralPath $taskWasm) { $env:NEXT_TEST_WASM_DIR = $taskWasm }
try {
    $taskApi = Start-Process -FilePath $taskPython -ArgumentList @('-m', 'uvicorn', $taskApp, '--host', '127.0.0.1', '--port', $taskBackendPort) -WorkingDirectory $taskBackend -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime "$Mode-api.log") -RedirectStandardError (Join-Path $taskRuntime "$Mode-api-error.log")
    $taskProcesses += [pscustomobject]@{ name='api'; pid=$taskApi.Id; executable=$taskPython; marker=$taskApp }
    $taskUiArguments = @(('"' + $taskNext + '"'))
    if ($Production) { $taskUiArguments += 'start' } else { $taskUiArguments += @('dev', '--webpack') }
    $taskUiArguments += @('--hostname', '127.0.0.1', '--port', $taskUiPort)
    $taskUi = Start-Process -FilePath $taskNode -ArgumentList $taskUiArguments -WorkingDirectory $taskFrontend -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime "$Mode-ui.log") -RedirectStandardError (Join-Path $taskRuntime "$Mode-ui-error.log")
    $taskProcesses += [pscustomobject]@{ name='ui'; pid=$taskUi.Id; executable=$taskNode; marker=$taskNext }
} finally {
    $taskProcesses | ConvertTo-Json | Set-Content -LiteralPath $taskRecord -Encoding UTF8
}
$taskReady = $false
for ($taskAttempt=0; $taskAttempt -lt 30; $taskAttempt++) {
    try {
        Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$taskBackendPort/openapi.json" -TimeoutSec 2 | Out-Null
        Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$taskUiPort/api/health" -TimeoutSec 2 | Out-Null
        $taskReady = $true
        break
    } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $taskReady) { throw "Servers are not ready. Read logs in $taskRuntime, then run stop-customer.ps1 before retrying." }
Write-Output "UI: http://127.0.0.1:$taskUiPort/main/product"
Write-Output "Swagger: http://127.0.0.1:$taskBackendPort/docs"
if ($Mode -eq 'Demo') { Write-Output "Manual fixture session/payment controls: http://127.0.0.1:$taskBackendPort/__manual" }
if ($Mode -eq 'SupabaseTest') {
    Write-Output "Customer home: http://127.0.0.1:$taskUiPort/"
    if ($RequireTestSession) {
        Write-Output "Start the approved real-Supabase customer session: http://127.0.0.1:$taskBackendPort/__supabase_test"
    } else {
        Write-Output 'Local test login is temporarily disabled; the backend automatically uses the first existing customer.'
    }
}
Write-Output 'Servers run in background using the actual ui-review source. Logs/PIDs: .customer-runtime.'
