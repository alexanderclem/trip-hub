# Cuts an offline map pack for a trip from the daily Protomaps world build, downloading only the
# needed bytes (HTTP range requests). Produces two files in public/packs/:
#   <trip>-detail.pmtiles    street level (z0-15) for the polygons in seed/<trip>/region.geojson
#   <trip>-overview.pmtiles  whole-country context (z0-10) for -Bbox
# Usage:
#   .\scripts\basemap-extract.ps1 -Trip guatemala-2027 -Bbox "-92.30,13.70,-88.20,17.85"
# Then update bytes/version for the pack in src/features/places/starterPacks.ts.
# Each file must stay under 25 MiB (Cloudflare's static file limit).
param(
  [Parameter(Mandatory = $true)][string]$Trip,
  [Parameter(Mandatory = $true)][string]$Bbox,
  [string]$Build = (Get-Date).AddDays(-1).ToString('yyyyMMdd'),
  [int]$OverviewMaxZoom = 10
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tool = Join-Path $root 'tools\pmtiles.exe'
if (-not (Test-Path $tool)) {
  $zip = Join-Path $root 'tools\pmtiles.zip'
  New-Item -ItemType Directory -Force (Join-Path $root 'tools') | Out-Null
  Invoke-WebRequest 'https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles_1.31.2_Windows_x86_64.zip' -OutFile $zip
  Expand-Archive $zip (Join-Path $root 'tools') -Force
}
$source = "https://build.protomaps.com/$Build.pmtiles"
$region = Join-Path $root "seed\$Trip\region.geojson"
$out = Join-Path $root 'public\packs'
New-Item -ItemType Directory -Force $out | Out-Null

& $tool extract $source (Join-Path $out "$Trip-detail.pmtiles") "--region=$region" --maxzoom=15 --download-threads=4
& $tool extract $source (Join-Path $out "$Trip-overview.pmtiles") "--bbox=$Bbox" "--maxzoom=$OverviewMaxZoom" --download-threads=4

Get-ChildItem $out -Filter "$Trip-*.pmtiles" | ForEach-Object {
  $mib = [math]::Round($_.Length / 1MB, 1)
  $warn = if ($_.Length -gt 25MB) { '  <-- over 25 MiB: shrink the region or zoom' } else { '' }
  "{0}  {1} bytes ({2} MiB){3}" -f $_.Name, $_.Length, $mib, $warn
}
"Build date (pack version): $Build"
