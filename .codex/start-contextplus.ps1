$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
$bundledNode = Join-Path $runtimeRoot "node\bin"
$bundledPnpm = Join-Path $runtimeRoot "bin\fallback\pnpm.cmd"

if ($null -eq (Get-Command "node.exe" -ErrorAction SilentlyContinue) -and
    (Test-Path -LiteralPath (Join-Path $bundledNode "node.exe"))) {
    $env:PATH = $bundledNode + [IO.Path]::PathSeparator + $env:PATH
}

$npx = Get-Command "npx.cmd" -ErrorAction SilentlyContinue
if ($null -ne $npx) {
    & $npx.Source -y contextplus $projectRoot
    exit $LASTEXITCODE
}

$pnpm = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
if ($null -ne $pnpm) {
    & $pnpm.Source dlx contextplus $projectRoot
    exit $LASTEXITCODE
}

if (Test-Path -LiteralPath $bundledPnpm) {
    & $bundledPnpm dlx contextplus $projectRoot
    exit $LASTEXITCODE
}

throw "ContextPlus requires npx or pnpm. Install Node.js, then restart Codex."
