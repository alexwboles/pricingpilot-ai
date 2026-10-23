param(
  [Parameter(Mandatory=$true)][string]$InstallerPath,
  [Parameter(Mandatory=$true)][string]$ExpectedHash
)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$packagePath = [IO.Path]::GetFullPath($InstallerPath)
$packagePrefix = [IO.Path]::GetFullPath((Join-Path $sourceRoot 'output')) + '\'
if (!$packagePath.StartsWith($packagePrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Use only a review package inside this checkout output tree' }
if ((Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash -ne $ExpectedHash) { throw 'Package checksum mismatch' }
$appRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs\PricingPilot Review'))
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'PricingPilot Review.lnk'
$startRoot = Join-Path ([Environment]::GetFolderPath('Programs')) 'PricingPilot Review'
$registryKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\TechPartnerPricingPilotReview'
$ownedTargets = @($appRoot,$desktopLink,$startRoot,$registryKey)
foreach ($target in $ownedTargets) { if (Test-Path -LiteralPath $target) { throw "Existing target must not be touched: $target" } }
$marker = Join-Path $appRoot 'install-marker.ini'
$sentinel = Join-Path $appRoot 'PricingPilot-normal-QA-sentinel.txt'
$installed = $false
$checks = [ordered]@{setup=$false;payload=$false;launcher=$false;shortcuts=$false;registry=$false;cleanup=$false}
try {
  $setup = Start-Process -FilePath $packagePath -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
  if ($setup.ExitCode -ne 0) { throw "Setup exit: $($setup.ExitCode)" }
  if ((Get-Content -LiteralPath $marker -Raw) -notmatch 'Product=TechPartner\.PricingPilot\.Review\.v1') { throw 'Unexpected ownership marker; no cleanup may proceed' }
  $installed = $true
  $checks.setup = $true
  foreach ($relative in @('index.html','css\style.css','js\app.js','lib\logic.js','lib\backup.js','USER-GUIDE.txt','SETUP-NOTICE.txt')) {
    if ((Get-FileHash -LiteralPath (Join-Path $appRoot $relative) -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath (Join-Path $sourceRoot $relative) -Algorithm SHA256).Hash) { throw "Installed payload differs: $relative" }
  }
  $checks.payload = $true
  $launcher = Join-Path $appRoot 'PricingPilot.exe'
  $launchCheck = Start-Process -FilePath $launcher -ArgumentList '--check' -WindowStyle Hidden -Wait -PassThru
  if ($launchCheck.ExitCode -ne 0) { throw 'Installed launcher asset/Edge check failed' }
  $checks.launcher = $true
  $shell = New-Object -ComObject WScript.Shell
  $links = @(@{file=$desktopLink;target=$launcher},@{file=(Join-Path $startRoot 'PricingPilot Review.lnk');target=$launcher},@{file=(Join-Path $startRoot 'User guide.lnk');target=(Join-Path $appRoot 'USER-GUIDE.txt')},@{file=(Join-Path $startRoot 'Uninstall.lnk');target=(Join-Path $appRoot 'Uninstall.exe')})
  foreach ($link in $links) { if (!(Test-Path -LiteralPath $link.file) -or $shell.CreateShortcut($link.file).TargetPath -ne $link.target) { throw "Incorrect or missing shortcut: $($link.file)" } }
  $checks.shortcuts = $true
  $registration = Get-ItemProperty -LiteralPath $registryKey
  if ($registration.DisplayName -ne 'PricingPilot Review' -or $registration.Publisher -ne 'TechPartner' -or $registration.InstallLocation -ne $appRoot -or $registration.UninstallString -ne ('"' + (Join-Path $appRoot 'Uninstall.exe') + '"') -or $registration.NoModify -ne 1 -or $registration.NoRepair -ne 1) { throw 'Incorrect uninstall registration' }
  $checks.registry = $true
  [IO.File]::WriteAllText($sentinel,'Synthetic unrelated-file preservation fixture; not customer data.')
} finally {
  if ($installed) {
    if ((Get-Content -LiteralPath $marker -Raw) -notmatch 'Product=TechPartner\.PricingPilot\.Review\.v1') { throw 'Ownership marker changed; cleanup stopped' }
    # The root is the exact previously absent product directory, never a parent.
    $uninstall = Start-Process -FilePath (Join-Path $appRoot 'Uninstall.exe') -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
    if ($uninstall.ExitCode -ne 0) { throw "Uninstall exit: $($uninstall.ExitCode)" }
    foreach ($target in @($desktopLink,$startRoot,$registryKey,(Join-Path $appRoot 'PricingPilot.exe'),$marker)) { if (Test-Path -LiteralPath $target) { throw "Uninstall left an integration target: $target" } }
    if (Test-Path -LiteralPath $sentinel) {
      if ([IO.File]::ReadAllText($sentinel) -ne 'Synthetic unrelated-file preservation fixture; not customer data.') { throw 'Synthetic unrelated file changed' }
      Remove-Item -LiteralPath $sentinel
    } elseif ($checks.registry) { throw 'Uninstall removed unrelated synthetic file' }
    if (Test-Path -LiteralPath $appRoot) { [IO.Directory]::Delete($appRoot,$false) } # empty-only, never recursive
    foreach ($target in $ownedTargets) { if (Test-Path -LiteralPath $target) { throw "Pre-test absence was not restored: $target" } }
    $checks.cleanup = $true
  }
}
$checks | ConvertTo-Json -Compress
