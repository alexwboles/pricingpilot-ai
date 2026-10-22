param(
  [Parameter(Mandatory=$true)][string]$NsisCompiler,
  [string]$QaInstallRoot,
  [string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$buildRoot = Join-Path $sourceRoot 'output\windows-review'
if ($OutputDirectory) {
  $buildRoot = [IO.Path]::GetFullPath($OutputDirectory)
  $outputPrefix = [IO.Path]::GetFullPath((Join-Path $sourceRoot 'output')) + '\'
  if (!$buildRoot.StartsWith($outputPrefix,[StringComparison]::OrdinalIgnoreCase)) { throw 'Build output must stay in a subdirectory of this checkout output folder' }
}
$stageRoot = Join-Path $buildRoot 'stage'
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler) -or !(Test-Path -LiteralPath $NsisCompiler)) { throw 'Existing C# and NSIS compilers are required for the developer build. Nothing was downloaded.' }
& $compiler /nologo /target:winexe /optimize+ /reference:System.Windows.Forms.dll "/out:$stageRoot\PricingPilot.exe" "$PSScriptRoot\PricingPilotLauncher.cs"
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
$nsisNotices = Join-Path (Split-Path -Parent $NsisCompiler) 'COPYING'
if (!(Test-Path -LiteralPath $nsisNotices)) { throw 'NSIS distribution notices are missing' }
Copy-Item -LiteralPath $nsisNotices -Destination (Join-Path $stageRoot 'NSIS-COPYING.txt') -Force
$packageName = 'PricingPilot-Review-Setup.exe'
$nsisOptions = @('/V2',"/DSOURCE=$sourceRoot","/DSTAGE=$stageRoot")
if ($QaInstallRoot) {
  $qaTarget = [IO.Path]::GetFullPath($QaInstallRoot)
  $qaPrefix = [IO.Path]::GetFullPath((Join-Path $sourceRoot 'output\installer-qa')) + '\'
  if (!$qaTarget.StartsWith($qaPrefix,[StringComparison]::OrdinalIgnoreCase) -or $qaTarget -eq $qaPrefix.TrimEnd('\')) { throw 'QA installation must stay inside this checkout output/installer-qa subdirectory' }
  $nsisOptions += "/DQA_ROOT=$qaTarget"
  $packageName = 'PricingPilot-QA-Setup.exe'
}
$packagePath = Join-Path $buildRoot $packageName
$nsisOptions += "/DPACKAGE_OUT=$packagePath"
$nsisOptions += (Join-Path $PSScriptRoot 'PricingPilot.nsi')
& $NsisCompiler @nsisOptions
if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $packagePath)) { throw 'Installer compilation failed' }
Get-FileHash -LiteralPath $packagePath -Algorithm SHA256 | Select-Object Path,Hash | ConvertTo-Json -Compress
