[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidateSet('Supabase','LocalPostgres')][string]$Target,
    [Parameter(Mandatory)][string]$ConfigPath
)

. (Join-Path $PSScriptRoot 'PhubBackup.Common.ps1')
$config = Read-PhubBackupConfig $ConfigPath
$path = if ($Target -eq 'Supabase') { $config.source.credentialFile } else { $config.restoreTest.credentialFile }
$directory = Split-Path -Parent $path
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$username = if ($Target -eq 'Supabase') { [string]$config.source.user } else { [string]$config.restoreTest.user }
$credential = Get-Credential -UserName $username -Message "Enter the password for $Target. Windows DPAPI encrypts the file for the current Windows user."
$credential | Export-Clixml -LiteralPath $path -Force
Write-Host "Encrypted credential saved to $path. Do not commit this file."
