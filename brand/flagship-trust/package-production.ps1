$ErrorActionPreference = 'Stop'
$taskRoot = (Get-Location).Path
$taskStage = Join-Path $taskRoot 'output/flagship-trust/production-package'
New-Item -ItemType Directory -Force -Path $taskStage | Out-Null
$taskCopies = @(
  'brand/flagship-trust',
  'brand/hype-flywheel-video/src/flagship-trust',
  'brand/hype-flywheel-video/scripts/render-flagship-trust.mjs',
  'brand/hype-flywheel-video/package.json',
  'brand/hype-flywheel-video/package-lock.json',
  'public/art/flagship-trust/manifest.json',
  'public/art/flagship-trust/logo.svg',
  'public/art/flagship-trust/captures',
  'public/art/flagship-trust/audio/animatic-mix.wav',
  'public/art/flagship-trust/audio/captions.json',
  'public/art/flagship-trust/audio/captions.srt',
  'public/art/market-v2-soul/frames/SOUL-PLATE-ledger.png',
  'public/art/market-v2-soul/frames/SOUL-PLATE-family.png',
  'public/art/market-v2-soul/frames/SOUL-PLATE-city.png',
  'brand/logo.svg',
  'output/flagship-trust/OMERTA-Trust-Is-The-Game.srt',
  'output/flagship-trust/OMERTA-Trust-Is-The-Game.vtt',
  'output/flagship-trust/qa-report.json',
  'output/flagship-trust/render-report-animatic.json'
)
foreach ($taskRelative in $taskCopies) {
  $taskSource = Join-Path $taskRoot $taskRelative
  if (-not (Test-Path -LiteralPath $taskSource)) { throw "Missing package input: $taskRelative" }
  $taskTarget = Join-Path $taskStage $taskRelative
  New-Item -ItemType Directory -Force -Path (Split-Path $taskTarget -Parent) | Out-Null
  if (Test-Path -LiteralPath $taskSource -PathType Container) {
    New-Item -ItemType Directory -Force -Path $taskTarget | Out-Null
    Get-ChildItem -LiteralPath $taskSource -Force | Copy-Item -Destination $taskTarget -Recurse -Force
  } else {
    Copy-Item -LiteralPath $taskSource -Destination $taskTarget -Force
  }
}
@'
OMERTA: Trust Is the Game — editable preproduction package

Start with brand/flagship-trust/README.md. The review MP4 is delivered separately.
No final publication master is claimed. New paid spend is zero.

The data-driven Remotion timeline, renderer, measured scratch mix, captions,
source-linked ledger, storyboard, coverage map, generation prompts, cost plan,
rights record and export verification are included. The three recycled portrait
plates are temporary atmosphere. No font binaries, dependencies or credentials
are bundled.

Install the existing editing dependencies from brand/hype-flywheel-video using
npm ci, then invoke the documented renderer from the package root. The supplied
render script uses the existing Windows Remotion compositor tools. Capture
fixtures require the pinned game source and are retained as provenance rather
than a standalone game installation.
'@ | Set-Content -LiteralPath (Join-Path $taskStage 'START-HERE.txt') -Encoding utf8
$taskZip = Join-Path $taskRoot 'output/flagship-trust/OMERTA-Flagship-Production-Package.zip'
Compress-Archive -Path (Join-Path $taskStage '*') -DestinationPath $taskZip -Force
Get-Item -LiteralPath $taskZip | Select-Object FullName,Length
