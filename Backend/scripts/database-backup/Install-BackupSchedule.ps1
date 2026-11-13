[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ConfigPath,
    [string]$TaskName = 'PHUB Supabase Database Backup',
    [switch]$RunWhenLoggedOff
)

. (Join-Path $PSScriptRoot 'PhubBackup.Common.ps1')
$config = Read-PhubBackupConfig $ConfigPath
$time = [datetime]::ParseExact([string]$config.schedule.dailyAt, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
$script = Join-Path $PSScriptRoot 'Backup-SupabaseDatabase.ps1'
$resolvedConfig = (Resolve-Path -LiteralPath $ConfigPath).Path
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`" -ConfigPath `"$resolvedConfig`""
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 4)
if ($RunWhenLoggedOff) {
    $taskCredential = Get-Credential -UserName "$env:USERDOMAIN\$env:USERNAME" -Message 'Enter the Windows password so Task Scheduler can run while logged off.'
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -User $taskCredential.UserName -Password $taskCredential.GetNetworkCredential().Password -Force | Out-Null
} else {
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
}
Write-Host "Scheduled task '$TaskName' installed for $($config.schedule.dailyAt) every day."
