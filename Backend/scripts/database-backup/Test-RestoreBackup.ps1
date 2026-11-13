[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ConfigPath,
    [datetime]$At,
    [string]$BackupDirectory
)

. (Join-Path $PSScriptRoot 'PhubBackup.Common.ps1')
$config = Read-PhubBackupConfig $ConfigPath
$restore = $config.restoreTest
if ([string]$restore.host -notin @('127.0.0.1','localhost','::1')) { throw 'Restore tests may only target local PostgreSQL.' }
$selectedAt = if ($PSBoundParameters.ContainsKey('At')) { [Nullable[datetime]]$At } else { $null }
$record = if ($BackupDirectory) {
    $full = (Resolve-Path -LiteralPath $BackupDirectory).Path
    $manifest = Join-Path $full 'manifest.json'; $dump = Join-Path $full 'phub-app.dump'
    if (-not (Test-Path -LiteralPath $manifest) -or -not (Test-Path -LiteralPath $dump)) { throw 'Invalid backup directory.' }
    [pscustomobject]@{ Directory=$full; Dump=$dump; CreatedAtUtc=(Get-Item $dump).LastWriteTimeUtc }
} else { Select-PhubBackup $config.backupRoot $selectedAt }

$manifestData = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $record.Directory 'manifest.json') | ConvertFrom-Json
$actualHash = (Get-FileHash -LiteralPath $record.Dump -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $manifestData.sha256) { throw 'SHA-256 mismatch; refusing to restore a possibly corrupt file.' }

$database = "$($restore.databasePrefix)$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if (-not $database.StartsWith('pchub_restore_test_')) { throw 'Restore database name must start with pchub_restore_test_.' }
$createdb = Get-PhubTool $config 'createdb'
$dropdb = Get-PhubTool $config 'dropdb'
$psql = Get-PhubTool $config 'psql'
$pgRestore = Get-PhubTool $config 'pg_restore'
$log = Join-Path $record.Directory "restore-test-$database.log"
$bootstrapPath = Join-Path $record.Directory "restore-bootstrap-$database.sql"
$verifyPath = Join-Path $record.Directory "restore-verify-$database.sql"
$common = @("--host=$($restore.host)", "--port=$($restore.port)", "--username=$($restore.user)", '--no-password')
$previousPassword = [Environment]::GetEnvironmentVariable('PGPASSWORD', 'Process')
try {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', (Get-PhubPassword 'PHUB_LOCAL_DB_PASSWORD' $restore.credentialFile), 'Process')
    Invoke-PhubProcess $dropdb ($common + @('--if-exists', $database)) $log
    Invoke-PhubProcess $createdb ($common + @('--template=template0', $database)) $log
    @'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
'@ | Set-Content -Encoding ASCII -LiteralPath $bootstrapPath
    Invoke-PhubProcess $psql ($common + @("--dbname=$database", '--set=ON_ERROR_STOP=1', "--file=$bootstrapPath")) $log
    Invoke-PhubProcess $pgRestore ($common + @("--dbname=$database", '--no-owner', '--no-privileges', '--clean', '--if-exists', '--single-transaction', '--exit-on-error', '--verbose', $record.Dump)) $log
    @'
select json_build_object(
  'tables', count(*),
  'functions', (select count(*) from information_schema.routines where routine_schema in ('public','admin_ops')),
  'customers', (select count(*) from public."KHACH_HANG"),
  'orders', (select count(*) from public."DON_HANG")
) from information_schema.tables where table_schema in ('public','admin_ops');
'@ | Set-Content -Encoding ASCII -LiteralPath $verifyPath
    $verification = & $psql @common "--dbname=$database" '--set=ON_ERROR_STOP=1' '--tuples-only' '--no-align' "--file=$verifyPath"
    if ($LASTEXITCODE -ne 0 -or $null -eq $verification) { throw 'Restore verification query failed.' }
    [ordered]@{ status='success'; testedAtUtc=[datetime]::UtcNow.ToString('o'); backup=$record.Directory; database=$database; verification=$verification.Trim() } |
        ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $record.Directory "restore-test-$database.json")
    Write-Host "Restore test succeeded in local database $database. The database is retained for inspection."
} finally {
    [Environment]::SetEnvironmentVariable('PGPASSWORD', $previousPassword, 'Process')
}
