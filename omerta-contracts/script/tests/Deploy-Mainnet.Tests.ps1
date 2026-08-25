Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $PSScriptRoot
$contractsRoot = Split-Path -Parent $scriptRoot
$safePath = Join-Path $scriptRoot 'Deploy-MainnetSafe.ps1'
$corePath = Join-Path $scriptRoot 'Deploy-MainnetCore.ps1'
$examplePath = Join-Path $contractsRoot '.env.mainnet.example'
$failures = @()

foreach ($path in @($safePath, $corePath, $examplePath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { $failures += "Missing mainnet release file: $path" }
}

foreach ($path in @($safePath, $corePath)) {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
    foreach ($error in $errors) { $failures += "$path parser error: $($error.Message)" }
}

$safeSource = Get-Content -LiteralPath $safePath -Raw
$coreSource = Get-Content -LiteralPath $corePath -Raw
$example = Get-Content -LiteralPath $examplePath -Raw

if ($safeSource -notmatch "DeploySafe\.s\.sol:DeploySafe") { $failures += 'Safe wrapper does not invoke DeploySafe.' }
if ($coreSource -notmatch "Deploy\.s\.sol:Deploy") { $failures += 'Core wrapper does not invoke Deploy.' }
if ($coreSource -match 'DeployBank\.s\.sol|DeployBank') { $failures += 'Core wrapper references the deferred Bank deployer.' }
if ($coreSource -notmatch 'DEPLOY MAINNET CORE 4663') { $failures += 'Core confirmation phrase is missing.' }
if ($safeSource -notmatch 'DEPLOY MAINNET SAFE 4663') { $failures += 'Safe confirmation phrase is missing.' }
if ($example -notmatch '(?m)^EXPECTED_CHAIN_ID=4663$') { $failures += 'Mainnet example has the wrong chain ID.' }
if ($example -notmatch '(?m)^BANK_ASSET=0x0{40}$' -or $example -notmatch '(?m)^BANK_ERC4626_VAULT=0x0{40}$') {
    $failures += 'Mainnet example does not leave both Bank dependencies zero.'
}
if ($example -match '(?im)^\s*(private_key|mnemonic)\s*=') { $failures += 'Mainnet example appears to request secret material.' }

if ($failures.Count -ne 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host 'DEPLOY_MAINNET_TESTS_OK'
