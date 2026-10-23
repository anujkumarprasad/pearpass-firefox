# Registers com.pears.pass.firefox for this add-on on Windows.
# The PearPass desktop app only registers com.pears.pass, and that manifest
# allows pass@pears.com and pass-nightly@pears.com. Firefox then starts the
# host and drops it, which the extension reports as
# "Disconnected from native host".
# Run this once in PowerShell after the desktop app has been opened.

$ErrorActionPreference = "Stop"

$hostName = "com.pears.pass.firefox"
$extensionIds = @(
  "pearpass-firefox@anujkp.dev",
  "pass@pears.com",
  "pass-nightly@pears.com"
)

$candidates = @(
  (Join-Path $env:APPDATA "PearPass\native-messaging\pearpass-native-host.cmd"),
  (Join-Path $env:APPDATA "pearpass-app-desktop\native-messaging\pearpass-native-host.cmd")
)

$wrapper = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $wrapper) {
  throw "PearPass native host was not found. Open the PearPass desktop app, turn on browser integration, then run this script again. Looked in: $($candidates -join '; ')"
}

$dir = Join-Path $env:LOCALAPPDATA "PearPass\NativeMessaging"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$manifestPath = Join-Path $dir "$hostName.json"

$manifest = @{
  name = $hostName
  description = "PearPass Native Messaging Host"
  path = $wrapper
  type = "stdio"
  allowed_extensions = $extensionIds
}

$json = ($manifest | ConvertTo-Json -Depth 4) + "`n"
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($manifestPath, $json, $utf8)

$reg = "HKCU:\Software\Mozilla\NativeMessagingHosts\$hostName"
New-Item -Path $reg -Force | Out-Null
New-ItemProperty -Path $reg -Name "(default)" -Value $manifestPath -PropertyType String -Force | Out-Null

Write-Output "Registered $hostName"
Write-Output "Manifest: $manifestPath"
Write-Output "Host: $wrapper"
Write-Output "Quit Firefox completely, start PearPass, then load the extension again."
