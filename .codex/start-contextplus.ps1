param(
    [switch]$PreflightOnly
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
$bundledNode = Join-Path $runtimeRoot "node\bin"
$bundledPnpm = Join-Path $runtimeRoot "bin\fallback\pnpm.cmd"
$contextPlusPackage = "contextplus@1.0.8"

if ($null -eq (Get-Command "node.exe" -ErrorAction SilentlyContinue) -and
    (Test-Path -LiteralPath (Join-Path $bundledNode "node.exe"))) {
    $env:PATH = $bundledNode + [IO.Path]::PathSeparator + $env:PATH
}

$node = Get-Command "node.exe" -ErrorAction SilentlyContinue
if ($null -eq $node) {
    throw "ContextPlus requires Node.js. Install Node.js, then restart Codex."
}

& $node.Source (Join-Path $projectRoot "tools\contextplus-health.js") --quiet
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

if ($PreflightOnly) {
    exit 0
}

$npx = Get-Command "npx.cmd" -ErrorAction SilentlyContinue
if ($null -ne $npx) {
    & $npx.Source -y $contextPlusPackage $projectRoot
    exit $LASTEXITCODE
}

$pnpm = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
if ($null -ne $pnpm) {
    & $pnpm.Source dlx $contextPlusPackage $projectRoot
    exit $LASTEXITCODE
}

if (Test-Path -LiteralPath $bundledPnpm) {
    & $bundledPnpm dlx $contextPlusPackage $projectRoot
    exit $LASTEXITCODE
}

throw "ContextPlus requires npx or pnpm. Install Node.js, then restart Codex."
