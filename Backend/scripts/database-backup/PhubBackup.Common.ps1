Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Expand-PhubPath([string]$Path) {
    return [Environment]::ExpandEnvironmentVariables($Path)
}

function Read-PhubBackupConfig([string]$ConfigPath) {
    $resolved = (Resolve-Path -LiteralPath $ConfigPath).Path
    $config = Get-Content -Raw -Encoding UTF8 -LiteralPath $resolved | ConvertFrom-Json
    foreach ($name in @("pgBin", "backupRoot", "source", "schemas", "retention", "restoreTest")) {
        if ($null -eq $config.$name) { throw "Missing '$name' in $resolved." }
    }
    $config.pgBin = Expand-PhubPath $config.pgBin
    $config.backupRoot = Expand-PhubPath $config.backupRoot
    $config.source.credentialFile = Expand-PhubPath $config.source.credentialFile
    $config.restoreTest.credentialFile = Expand-PhubPath $config.restoreTest.credentialFile
    if ($config.source.host -match '^REPLACE_' -or [string]::IsNullOrWhiteSpace($config.source.host)) {
        throw "Set the real Session pooler host in config.local.json; do not guess the Supabase host."
    }
    if ([string]$config.source.sslMode -notin @('require','verify-ca','verify-full','disable')) {
        throw "source.sslMode must be require, verify-ca, verify-full, or disable."
    }
    return $config
}

function Get-PhubTool($Config, [string]$Name) {
    $path = Join-Path $Config.pgBin "$Name.exe"
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Tool not found: $path." }
    return $path
}

function Get-PhubPassword([string]$EnvironmentName, [string]$CredentialFile) {
    $fromEnvironment = [Environment]::GetEnvironmentVariable($EnvironmentName)
    if (-not [string]::IsNullOrWhiteSpace($fromEnvironment)) { return $fromEnvironment }
    if (-not (Test-Path -LiteralPath $CredentialFile -PathType Leaf)) {
        throw "Credential missing. Run Save-BackupCredential.ps1 or set $EnvironmentName."
    }
    $credential = Import-Clixml -LiteralPath $CredentialFile
    if ($credential -isnot [Management.Automation.PSCredential]) { throw "Invalid credential file: $CredentialFile" }
    return $credential.GetNetworkCredential().Password
}

function Get-PhubBackupRecords([string]$Root) {
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) { return @() }
    $records = foreach ($directory in Get-ChildItem -LiteralPath $Root -Directory -ErrorAction SilentlyContinue) {
        if ($directory.Name.StartsWith('.')) { continue }
        $manifestPath = Join-Path $directory.FullName 'manifest.json'
        $dumpPath = Join-Path $directory.FullName 'phub-app.dump'
        if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or -not (Test-Path -LiteralPath $dumpPath -PathType Leaf)) { continue }
        try {
            $manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
            if ($manifest.status -ne 'success') { continue }
            [pscustomobject]@{
                Directory = $directory.FullName
                Dump = $dumpPath
                CreatedAtUtc = [datetime]::Parse($manifest.createdAtUtc).ToUniversalTime()
                SizeBytes = [int64](Get-Item -LiteralPath $dumpPath).Length
            }
        } catch { Write-Warning "Skipping backup with an invalid manifest: $manifestPath" }
    }
    return @($records | Sort-Object CreatedAtUtc)
}

function Get-PhubDriveFreeBytes([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path)
    $root = [IO.Path]::GetPathRoot($full)
    return [int64]([IO.DriveInfo]::new($root).AvailableFreeSpace)
}

function Remove-PhubBackupRecord($Record, [string]$Reason) {
    $trashName = ".deleting-$([IO.Path]::GetFileName($Record.Directory))-$([guid]::NewGuid().ToString('N'))"
    $trash = Join-Path ([IO.Path]::GetDirectoryName($Record.Directory)) $trashName
    Move-Item -LiteralPath $Record.Directory -Destination $trash
    Remove-Item -LiteralPath $trash -Recurse -Force
    Write-Host "Deleted oldest backup $($Record.CreatedAtUtc.ToString('u')) ($Reason)."
}

function Invoke-PhubBackupRetention($Config, [string]$ProtectedDirectory = '', [int64]$AdditionalRequiredBytes = 0) {
    $root = $Config.backupRoot
    $minimum = [Math]::Max(1, [int]$Config.retention.minimumSuccessfulBackups)
    $maximumAge = [int]$Config.retention.maximumAgeDays
    $maximumTotal = [int64]$Config.retention.maximumTotalBytes
    $minimumFree = [int64]$Config.retention.minimumFreeBytes + [Math]::Max(0, $AdditionalRequiredBytes)
    while ($true) {
        $records = @(Get-PhubBackupRecords $root)
        [int64]$total = 0
        foreach ($record in $records) { $total += [int64]$record.SizeBytes }
        $free = Get-PhubDriveFreeBytes $root
        $now = [datetime]::UtcNow
        $candidate = $records | Where-Object {
            $_.Directory -ne $ProtectedDirectory -and
            (($maximumAge -gt 0 -and ($now - $_.CreatedAtUtc).TotalDays -gt $maximumAge) -or
             ($maximumTotal -gt 0 -and $total -gt $maximumTotal) -or $free -lt $minimumFree)
        } | Select-Object -First 1
        if ($null -eq $candidate -or $records.Count -le $minimum) { break }
        $reason = if ($maximumAge -gt 0 -and ($now - $candidate.CreatedAtUtc).TotalDays -gt $maximumAge) { 'retention age exceeded' }
            elseif ($maximumTotal -gt 0 -and $total -gt $maximumTotal) { 'backup size limit exceeded' }
            else { 'low disk space' }
        Remove-PhubBackupRecord $candidate $reason
    }
    $remaining = @(Get-PhubBackupRecords $root)
    [int64]$remainingTotal = 0
    foreach ($record in $remaining) { $remainingTotal += [int64]$record.SizeBytes }
    if ((Get-PhubDriveFreeBytes $root) -lt $minimumFree -or ($maximumTotal -gt 0 -and $remainingTotal -gt $maximumTotal)) {
        throw "Cannot free enough disk space while retaining at least $minimum successful backups."
    }
}

function Invoke-PhubProcess([string]$FilePath, [string[]]$Arguments, [string]$LogPath) {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $FilePath @Arguments 2> $LogPath
        $exitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($exitCode -ne 0) { throw "$([IO.Path]::GetFileName($FilePath)) failed (exit $exitCode). See $LogPath." }
}

function Select-PhubBackup([string]$Root, [Nullable[datetime]]$At) {
    $records = @(Get-PhubBackupRecords $Root)
    if ($null -ne $At) {
        $target = ([datetime]$At).ToUniversalTime()
        $records = @($records | Where-Object CreatedAtUtc -LE $target)
    }
    $selected = $records | Select-Object -Last 1
    if ($null -eq $selected) { throw "No successful backup exists at or before the selected restore point." }
    return $selected
}
