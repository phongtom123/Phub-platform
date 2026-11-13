$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'PhubBackup.Common.ps1')
$root = Join-Path ([IO.Path]::GetTempPath()) "phub-backup-retention-$([guid]::NewGuid().ToString('N'))"
try {
    New-Item -ItemType Directory -Path $root | Out-Null
    foreach ($index in 1..3) {
        $directory = Join-Path $root "2026010$index-000000"
        New-Item -ItemType Directory -Path $directory | Out-Null
        [IO.File]::WriteAllBytes((Join-Path $directory 'phub-app.dump'), (New-Object byte[] (1024 * $index)))
        @{ status='success'; createdAtUtc=([datetime]::UtcNow.AddDays(-10 + $index)).ToString('o') } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $directory 'manifest.json')
    }
    $point = [datetime]::UtcNow.AddDays(-7.5)
    $selected = Select-PhubBackup $root ([Nullable[datetime]]$point)
    if ([IO.Path]::GetFileName($selected.Directory) -ne '20260102-000000') { throw 'Restore-point selection did not choose the newest backup at or before the requested time.' }
    $config = [pscustomobject]@{ backupRoot=$root; retention=[pscustomobject]@{ maximumAgeDays=1; maximumTotalBytes=0; minimumFreeBytes=0; minimumSuccessfulBackups=1 } }
    $protected = Join-Path $root '20260103-000000'
    Invoke-PhubBackupRetention $config -ProtectedDirectory $protected
    $remaining = @(Get-PhubBackupRecords $root)
    if ($remaining.Count -ne 1 -or $remaining[0].Directory -ne $protected) { throw 'Retention deleted the wrong backup or failed to keep the newest backup.' }
    Write-Host 'PASS: retention deletes oldest backups first and keeps the newest backup.'
} finally {
    if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
