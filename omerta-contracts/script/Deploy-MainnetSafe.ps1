[CmdletBinding()]
param(
    [string]$RpcUrl = 'https://rpc.mainnet.chain.robinhood.com',
    [string]$ConfigPath,
    [string]$Account = 'omerta-mainnet-deployer',
    [switch]$Broadcast
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$repositoryRoot = Split-Path -Parent $contractsRoot
if (-not $ConfigPath) { $ConfigPath = Join-Path $contractsRoot '.env.mainnet' }
$forge = Join-Path $contractsRoot 'cache\verify\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe'
$cast = Join-Path $contractsRoot 'cache\verify\node_modules\@foundry-rs\cast-win32-amd64\bin\cast.exe'
$solc = Join-Path $contractsRoot 'cache\verify\solc-0.8.26.exe'
$utilitiesPath = Join-Path $PSScriptRoot 'Deploy-Mainnet.Utilities.ps1'

foreach ($path in @($forge, $cast, $solc, $utilitiesPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required file is missing: $path" }
}
. $utilitiesPath

$requiredKeys = @(
    'EXPECTED_CHAIN_ID', 'EXPECTED_SOURCE_COMMIT', 'EXPECTED_DEPLOYER_NONCE',
    'CORE_AUDIT_REPORT_SHA256', 'CORE_SIGNER_AUDIT_INCLUDED', 'DEPLOYER',
    'SAFE_SINGLETON', 'SAFE_PROXY_FACTORY', 'SAFE_FALLBACK_HANDLER',
    'SAFE_OWNERS', 'SAFE_THRESHOLD', 'SAFE_SALT_NONCE', 'SAFE'
)
$config = Read-DeployConfig $ConfigPath
Assert-ConfigKeys $config $requiredKeys $ConfigPath
Assert-MainnetReleaseConfig $config
Assert-FrozenReleaseSource $repositoryRoot ([string]$config.EXPECTED_SOURCE_COMMIT)

foreach ($key in @('DEPLOYER', 'SAFE_SINGLETON', 'SAFE_PROXY_FACTORY', 'SAFE_FALLBACK_HANDLER')) {
    Assert-Address $key ([string]$config[$key])
}
Assert-Address 'SAFE' ([string]$config.SAFE) -AllowZero

$owners = @(([string]$config.SAFE_OWNERS).Split(',') | ForEach-Object { $_.Trim() })
if ($owners.Count -ne 3 -or [string]$config.SAFE_THRESHOLD -ne '2') {
    throw 'Mainnet governance requires exactly three Safe owners with threshold 2.'
}
foreach ($owner in $owners) { Assert-Address 'Safe owner' $owner }
if (($owners | ForEach-Object { $_.ToLowerInvariant() } | Select-Object -Unique).Count -ne $owners.Count) {
    throw 'Safe owners must be unique.'
}
Assert-AddressEquals 'Phase 0 broadcaster' ([string]$config.DEPLOYER) $owners[0]
if ([string]$config.SAFE_SALT_NONCE -notmatch '^[1-9][0-9]*$') {
    throw 'SAFE_SALT_NONCE must be a nonzero unsigned integer.'
}

$environmentKeys = @(
    'EXPECTED_CHAIN_ID', 'SAFE_SINGLETON', 'SAFE_PROXY_FACTORY', 'SAFE_FALLBACK_HANDLER',
    'SAFE_OWNERS', 'SAFE_THRESHOLD', 'SAFE_SALT_NONCE'
)
Import-DeployEnvironment $config $environmentKeys

$chainId = Invoke-Cast $cast @('chain-id', '--rpc-url', $RpcUrl)
Assert-ScalarEquals 'RPC chain ID' $chainId '4663'
foreach ($entry in @(
    @('Safe singleton', [string]$config.SAFE_SINGLETON),
    @('Safe proxy factory', [string]$config.SAFE_PROXY_FACTORY),
    @('Safe fallback handler', [string]$config.SAFE_FALLBACK_HANDLER)
)) {
    $code = Invoke-Cast $cast @('code', $entry[1], '--rpc-url', $RpcUrl)
    if ($code -eq '0x') { throw "$($entry[0]) has no mainnet bytecode: $($entry[1])" }
}

$zero = '0x0000000000000000000000000000000000000000'
$ownersArgument = '[' + ($owners -join ',') + ']'
$initializer = Invoke-Cast $cast @(
    'calldata', 'setup(address[],uint256,address,bytes,address,address,uint256,address)',
    $ownersArgument, [string]$config.SAFE_THRESHOLD, $zero, '0x',
    [string]$config.SAFE_FALLBACK_HANDLER, $zero, '0', $zero
)
$predictedSafe = Invoke-Cast $cast @(
    'call', [string]$config.SAFE_PROXY_FACTORY,
    'createProxyWithNonce(address,bytes,uint256)(address)',
    [string]$config.SAFE_SINGLETON, $initializer, [string]$config.SAFE_SALT_NONCE,
    '--rpc-url', $RpcUrl
)
Assert-Address 'counterfactual Safe' $predictedSafe
if ([string]$config.SAFE -notmatch '^0x0{40}$') {
    Assert-AddressEquals 'Configured Safe' ([string]$config.SAFE) $predictedSafe
}

function Assert-SafeState([string]$Address, [bool]$RequireInitialNonce) {
    $version = Invoke-Cast $cast @('call', $Address, 'VERSION()(string)', '--rpc-url', $RpcUrl)
    $actualThreshold = Invoke-Cast $cast @('call', $Address, 'getThreshold()(uint256)', '--rpc-url', $RpcUrl)
    $actualOwners = (Invoke-Cast $cast @('call', $Address, 'getOwners()(address[])', '--rpc-url', $RpcUrl)).ToLowerInvariant()
    $actualNonce = Invoke-Cast $cast @('call', $Address, 'nonce()(uint256)', '--rpc-url', $RpcUrl)
    if ($version -notmatch '1\.4\.1') { throw "Unexpected Safe version: $version" }
    Assert-ScalarEquals 'Safe threshold' $actualThreshold ([string]$config.SAFE_THRESHOLD)
    foreach ($owner in $owners) {
        if (-not $actualOwners.Contains($owner.ToLowerInvariant())) { throw "Safe owner missing: $owner" }
    }
    if ($RequireInitialNonce) { Assert-ScalarEquals 'Initial Safe nonce' $actualNonce '0' }
}

$existingCode = Invoke-Cast $cast @('code', $predictedSafe, '--rpc-url', $RpcUrl)
if ($existingCode -ne '0x') {
    Assert-SafeState $predictedSafe $false
    Write-Host "Safe is already deployed and verified: $predictedSafe"
    Write-Host "SAFE=$predictedSafe"
    exit 0
}

$deployer = [string]$config.DEPLOYER
$networkNonce = Invoke-Cast $cast @('nonce', $deployer, '--rpc-url', $RpcUrl)
Assert-ScalarEquals 'Deployer nonce' $networkNonce ([string]$config.EXPECTED_DEPLOYER_NONCE)

[System.Numerics.BigInteger]$balanceWei = Invoke-Cast $cast @('balance', $deployer, '--rpc-url', $RpcUrl)
[System.Numerics.BigInteger]$estimatedGas = Invoke-Cast $cast @(
    'estimate', [string]$config.SAFE_PROXY_FACTORY,
    'createProxyWithNonce(address,bytes,uint256)(address)',
    [string]$config.SAFE_SINGLETON, $initializer, [string]$config.SAFE_SALT_NONCE,
    '--from', $deployer, '--rpc-url', $RpcUrl
)
[System.Numerics.BigInteger]$gasPriceWei = Invoke-Cast $cast @('gas-price', '--rpc-url', $RpcUrl)
[System.Numerics.BigInteger]$requiredWei = $estimatedGas * $gasPriceWei * 2
if ($balanceWei -lt $requiredWei) {
    throw "Broadcaster needs more mainnet ETH. Balance=$balanceWei wei; buffered requirement=$requiredWei wei."
}

Write-Host ''
Write-Host 'Running a fresh, non-broadcast Phase 0 simulation...'
$simulationArguments = @(
    'script', 'script\DeploySafe.s.sol:DeploySafe', '--rpc-url', $RpcUrl,
    '--sender', $deployer, '--use', $solc, '--offline', '--cache-path', 'foundry-cache', '-vv'
)
Push-Location $contractsRoot
try {
    & $forge @simulationArguments
    if ($LASTEXITCODE -ne 0) { throw 'Phase 0 simulation failed; no transaction was sent.' }
} finally { Pop-Location }

Write-Host ''
Write-Host "Network: Robinhood Chain Mainnet ($chainId)"
Write-Host "Release commit: $($config.EXPECTED_SOURCE_COMMIT)"
Write-Host "Audit report SHA-256: $($config.CORE_AUDIT_REPORT_SHA256)"
Write-Host "Broadcaster: $deployer (nonce $networkNonce)"
Write-Host "Counterfactual Safe: $predictedSafe"
Write-Host "Owners: $($owners -join ', ')"
Write-Host 'Threshold: 2 of 3'
Write-Host "Buffered gas requirement: $requiredWei wei"

if (-not $Broadcast) {
    Write-Host ''
    Write-Host 'PREFLIGHT_OK=true'
    Write-Host 'No transaction was sent. Re-run with -Broadcast only after independent review.'
    exit 0
}

Write-Warning 'This sends one irreversible Robinhood Chain mainnet transaction.'
$confirmation = Read-Host 'Type DEPLOY MAINNET SAFE 4663 to broadcast'
if ($confirmation -cne 'DEPLOY MAINNET SAFE 4663') { throw 'Deployment cancelled; no transaction was sent.' }
$networkNonce = Invoke-Cast $cast @('nonce', $deployer, '--rpc-url', $RpcUrl)
Assert-ScalarEquals 'Deployer nonce after simulation' $networkNonce ([string]$config.EXPECTED_DEPLOYER_NONCE)

$broadcastArguments = @(
    'script', 'script\DeploySafe.s.sol:DeploySafe', '--rpc-url', $RpcUrl,
    '--sender', $deployer, '--account', $Account, '--broadcast', '--slow',
    '--use', $solc, '--offline', '--cache-path', 'foundry-cache', '-vvvv'
)
Push-Location $contractsRoot
try {
    & $forge @broadcastArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Phase 0 broadcast did not complete. Do not rerun; inspect the Foundry record and predicted Safe first.'
    }
} finally { Pop-Location }

$broadcastPath = Join-Path $contractsRoot "broadcast\DeploySafe.s.sol\$chainId\run-latest.json"
if (-not (Test-Path -LiteralPath $broadcastPath -PathType Leaf)) {
    throw "Broadcast returned without a Foundry record: $broadcastPath"
}
$record = Get-Content -LiteralPath $broadcastPath -Raw | ConvertFrom-Json
$receipts = @($record.receipts)
if ($receipts.Count -ne 1 -or [string]$receipts[0].status -notin @('0x1', '1')) {
    throw 'Safe deployment receipt is missing or unsuccessful.'
}
$deployedCode = Invoke-Cast $cast @('code', $predictedSafe, '--rpc-url', $RpcUrl)
if ($deployedCode -eq '0x') { throw 'Safe transaction succeeded but the predicted address has no code.' }
Assert-SafeState $predictedSafe $true

Write-Host ''
Write-Host 'Phase 0 deployed and verified.'
Write-Host "SAFE=$predictedSafe"
Write-Host "SAFE_TX=$($receipts[0].transactionHash)"
Write-Host 'Update SAFE and EXPECTED_DEPLOYER_NONCE in .env.mainnet, then run Deploy-MainnetCore.ps1.'
