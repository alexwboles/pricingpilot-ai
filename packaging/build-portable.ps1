param([Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputRoot = [IO.Path]::GetFullPath((Join-Path $sourceRoot 'output'))
$target = [IO.Path]::GetFullPath($OutputDirectory)
if (!$target.StartsWith($outputRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Portable output must be a new subdirectory of this checkout output folder.'
}
if (Test-Path -LiteralPath $target) { throw 'Output already exists. Choose a new directory; existing packages are never replaced.' }

# Reject redirected ancestors before creating or writing any package files.
$ancestor = $target
while ($ancestor) {
  if (Test-Path -LiteralPath $ancestor) {
    if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw 'Portable output may not pass through a junction or symbolic link.'
    }
  }
  $parent = Split-Path -Parent $ancestor
  if ($parent -eq $ancestor) { break }
  $ancestor = $parent
}

# Explicit allowlist: never copy storage, credentials, developer output or QA data.
$assets = @('index.html','css/style.css','js/app.js','lib/logic.js','lib/backup.js','USER-GUIDE.txt')
foreach ($relative in ($assets + 'packaging/PORTABLE-START.txt')) {
  $source = Join-Path $sourceRoot $relative
  if (!(Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing source: $relative" }
  $part = $source
  while ($part -and $part.StartsWith($sourceRoot, [StringComparison]::OrdinalIgnoreCase)) {
    if ((Get-Item -LiteralPath $part -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw "Source must not be redirected: $relative"
    }
    if ($part -eq $sourceRoot) { break }
    $part = Split-Path -Parent $part
  }
}

$packageRoot = Join-Path $target 'PricingPilot-Portable-Review'
New-Item -ItemType Directory -Path $packageRoot | Out-Null
foreach ($relative in $assets) {
  $destination = Join-Path $packageRoot $relative
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -LiteralPath (Join-Path $sourceRoot $relative) -Destination $destination
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'PORTABLE-START.txt') -Destination (Join-Path $packageRoot 'START-HERE.txt')
$revision = (& git -C $sourceRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not identify source revision.' }
$changes = & git -C $sourceRoot status --porcelain
if ($LASTEXITCODE -ne 0) { throw 'Could not identify source changes.' }
$manifest = @()
foreach ($relative in ($assets + 'START-HERE.txt')) {
  $file = Get-Item -LiteralPath (Join-Path $packageRoot $relative)
  $manifest += [ordered]@{path=$relative; bytes=$file.Length; sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
}
[ordered]@{format='pricingpilot-portable-review'; version=1; sourceRevision=$revision; sourceDirty=[bool]$changes; files=$manifest} |
  ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $packageRoot 'MANIFEST.json') -Encoding UTF8
$archive = Join-Path $target 'PricingPilot-Portable-Review.zip'
Compress-Archive -LiteralPath $packageRoot -DestinationPath $archive
Get-FileHash -LiteralPath $archive -Algorithm SHA256 | Select-Object Path,Hash | ConvertTo-Json -Compress
