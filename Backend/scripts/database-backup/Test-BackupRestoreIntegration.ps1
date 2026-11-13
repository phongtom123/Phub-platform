$ErrorActionPreference = 'Stop'
$pgBin = 'C:\Program Files\PostgreSQL\18\bin'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) "phub-backup-integration-$([guid]::NewGuid().ToString('N'))"
$data = Join-Path $testRoot 'data'
$backups = Join-Path $testRoot 'backups'
$configPath = Join-Path $testRoot 'config.json'
$seedPath = Join-Path $testRoot 'seed.sql'
$serverLog = Join-Path $testRoot 'postgres.log'
$port = Get-Random -Minimum 55400 -Maximum 55999
$started = $false
$oldSourcePassword = [Environment]::GetEnvironmentVariable('PHUB_SUPABASE_DB_PASSWORD', 'Process')
$oldLocalPassword = [Environment]::GetEnvironmentVariable('PHUB_LOCAL_DB_PASSWORD', 'Process')
try {
    Write-Host 'Integration: initialize temporary PostgreSQL.'
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    & (Join-Path $pgBin 'initdb.exe') --pgdata=$data --username=postgres --auth=trust --encoding=UTF8 --no-locale | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed.' }
    & (Join-Path $pgBin 'pg_ctl.exe') --pgdata=$data --log=$serverLog --options="-p $port -h 127.0.0.1" --wait start
    if ($LASTEXITCODE -ne 0) { throw 'Temporary PostgreSQL failed to start.' }
    $started = $true
    Write-Host 'Integration: seed fixture data.'
    @'
create schema admin_ops;
create table public."KHACH_HANG"(ma_kh text primary key, ten_kh text not null);
create table public."DON_HANG"(ma_donhang text primary key, ma_kh text references public."KHACH_HANG");
create table admin_ops.messages(id bigint primary key, body text);
insert into public."KHACH_HANG" values ('KH1','Fixture customer');
insert into public."DON_HANG" values ('DH1','KH1');
insert into admin_ops.messages values (1,'Fixture message');
'@ | Set-Content -Encoding ASCII -LiteralPath $seedPath
    & (Join-Path $pgBin 'psql.exe') --host=127.0.0.1 --port=$port --username=postgres --dbname=postgres --set=ON_ERROR_STOP=1 --file=$seedPath | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Fixture seed failed.' }
    Write-Host 'Integration: write test configuration.'
    $config = [ordered]@{
        projectRef='integration-test'; pgBin=$pgBin; backupRoot=$backups
        source=[ordered]@{ host='127.0.0.1'; port=$port; database='postgres'; user='postgres'; sslMode='disable'; credentialFile=(Join-Path $testRoot 'unused-source.xml') }
        schemas=@('public','admin_ops')
        retention=[ordered]@{ maximumAgeDays=30; maximumTotalBytes=104857600; minimumFreeBytes=0; minimumSuccessfulBackups=1; estimatedNextBackupBytes=1048576 }
        schedule=[ordered]@{ dailyAt='02:00' }
        restoreTest=[ordered]@{ host='127.0.0.1'; port=$port; user='postgres'; databasePrefix='pchub_restore_test_'; credentialFile=(Join-Path $testRoot 'unused-local.xml') }
    }
    $config | ConvertTo-Json -Depth 6 | Set-Content -Encoding ASCII -LiteralPath $configPath
    [Environment]::SetEnvironmentVariable('PHUB_SUPABASE_DB_PASSWORD', 'fixture', 'Process')
    [Environment]::SetEnvironmentVariable('PHUB_LOCAL_DB_PASSWORD', 'fixture', 'Process')
    Write-Host 'Integration: run backup.'
    & (Join-Path $PSScriptRoot 'Backup-SupabaseDatabase.ps1') -ConfigPath $configPath
    if ($LASTEXITCODE -ne 0) { throw 'Backup script failed.' }
    Write-Host 'Integration: run restore.'
    & (Join-Path $PSScriptRoot 'Test-RestoreBackup.ps1') -ConfigPath $configPath
    if ($LASTEXITCODE -ne 0) { throw 'Restore script failed.' }
    $manifest = Get-ChildItem -LiteralPath $backups -Filter manifest.json -Recurse | Select-Object -First 1
    $restoreResult = Get-ChildItem -LiteralPath $backups -Filter 'restore-test-*.json' -Recurse | Select-Object -First 1
    if ($null -eq $manifest -or $null -eq $restoreResult) { throw 'Backup or restore evidence is missing.' }
    $evidence = Get-Content -Raw -Encoding UTF8 -LiteralPath $restoreResult.FullName | ConvertFrom-Json
    if ($evidence.status -ne 'success' -or $evidence.verification -notmatch '"customers"\s*:\s*1' -or $evidence.verification -notmatch '"orders"\s*:\s*1') {
        throw 'Restored row counts do not match the fixture.'
    }
    Write-Host 'PASS: real pg_dump, catalog validation, SHA-256, timestamp selection, local restore, and row verification.'
} catch {
    Get-ChildItem -LiteralPath $testRoot -Filter '*.log' -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Warning "Log: $($_.FullName)"
        Get-Content -LiteralPath $_.FullName -ErrorAction SilentlyContinue | Write-Warning
    }
    throw
} finally {
    [Environment]::SetEnvironmentVariable('PHUB_SUPABASE_DB_PASSWORD', $oldSourcePassword, 'Process')
    [Environment]::SetEnvironmentVariable('PHUB_LOCAL_DB_PASSWORD', $oldLocalPassword, 'Process')
    if ($started) { & (Join-Path $pgBin 'pg_ctl.exe') --pgdata=$data --wait --mode=fast stop; Start-Sleep -Milliseconds 300 }
    $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $resolvedTest = [IO.Path]::GetFullPath($testRoot)
    if ($resolvedTest.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase) -and [IO.Path]::GetFileName($resolvedTest).StartsWith('phub-backup-integration-')) {
        Remove-Item -LiteralPath $resolvedTest -Recurse -Force -ErrorAction SilentlyContinue
    }
}
