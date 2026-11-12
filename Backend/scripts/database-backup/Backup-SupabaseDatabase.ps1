[CmdletBinding()]
param([Parameter(Mandatory)][string]$ConfigPath)

. (Join-Path $PSScriptRoot 'PhubBackup.Common.ps1')
$config = Read-PhubBackupConfig $ConfigPath
$pgDump = Get-PhubTool $config 'pg_dump'
$pgRestore = Get-PhubTool $config 'pg_restore'
New-Item -ItemType Directory -Path $config.backupRoot -Force | Out-Null

$records = @(Get-PhubBackupRecords $config.backupRoot)
$latestSize = if ($records.Count) { [int64]$records[-1].SizeBytes } else { [int64]$config.retention.estimatedNextBackupBytes }
$estimated = [Math]::Max([int64]$config.retention.estimatedNextBackupBytes, [int64]($latestSize * 1.25))
Invoke-PhubBackupRetention $config -AdditionalRequiredBytes $estimated

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$partial = Join-Path $config.backupRoot ".$stamp.partial"
$final = Join-Path $config.backupRoot $stamp
if (Test-Path -LiteralPath $partial) { throw "Temporary directory already exists: $partial" }
New-Item -ItemType Directory -Path $partial | Out-Null
$dump = Join-Path $partial 'phub-app.dump'
$backupLog = Join-Path $partial 'backup.log'
$listLog = Join-Path $partial 'verify-list.log'
$connection = "host=$($config.source.host) port=$($config.source.port) dbname=$($config.source.database) user=$($config.source.user) sslmode=$($config.source.sslMode)"
$arguments = @("--dbname=$connection", '--format=custom', '--compress=6', '--no-password', '--verbose', "--file=$dump")
foreach ($schema in $config.schemas) { $arguments += "--schema=$schema" }

$previousPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
try {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', (Get-PhubPassword 'PHUB_SUPABASE_DB_PASSWORD' $config.source.credentialFile), 'Process')
    Invoke-PhubProcess $pgDump $arguments $backupLog
    if (-not (Test-Path -LiteralPath $dump) -or (Get-Item -LiteralPath $dump).Length -le 0) { throw 'pg_dump did not create a valid backup file.' }
    & $pgRestore --list $dump | Set-Content -Encoding UTF8 -LiteralPath $listLog
    if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $listLog).Length -le 0) { throw "pg_restore could not read the backup catalog. See $listLog." }
    $hash = Get-FileHash -LiteralPath $dump -Algorithm SHA256
    $manifest = [ordered]@{
        status = 'success'
        createdAt = (Get-Date).ToString('o')
        createdAtUtc = [datetime]::UtcNow.ToString('o')
        projectRef = [string]$config.projectRef
        database = [string]$config.source.database
        schemas = @($config.schemas)
        file = 'phub-app.dump'
        sizeBytes = [int64](Get-Item -LiteralPath $dump).Length
        sha256 = $hash.Hash.ToLowerInvariant()
        postgresClient = (& $pgDump --version)
    }
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $partial 'manifest.json')
    Move-Item -LiteralPath $partial -Destination $final
    Set-Content -Encoding ASCII -LiteralPath (Join-Path $config.backupRoot 'LATEST') -Value ([IO.Path]::GetFileName($final))
    Invoke-PhubBackupRetention $config -ProtectedDirectory $final
    Write-Host "Backup succeeded: $final"
} catch {
    if (Test-Path -LiteralPath $partial) {
        Set-Content -Encoding UTF8 -LiteralPath (Join-Path $partial 'FAILED.txt') -Value $_.Exception.Message
    }
    throw
} finally {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $previousPassword, 'Process')
}
