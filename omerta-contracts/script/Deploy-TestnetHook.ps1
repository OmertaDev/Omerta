[CmdletBinding()]
param(
    [string]$RpcUrl = 'https://rpc.testnet.chain.robinhood.com',
    [switch]$PreflightOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$forge = Join-Path $contractsRoot 'cache\verify\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe'
$cast = Join-Path $contractsRoot 'cache\verify\node_modules\@foundry-rs\cast-win32-amd64\bin\cast.exe'
$solc = Join-Path $contractsRoot 'cache\verify\solc-0.8.26.exe'
$manifestPath = Join-Path $contractsRoot 'deployments\46630\manifest.json'
$deployerKeystore = Join-Path $contractsRoot 'keystores-testnet\omerta-deployer-owner-1'
$coreUtilitiesPath = Join-Path $PSScriptRoot 'Deploy-TestnetCore.Utilities.ps1'
$hookUtilitiesPath = Join-Path $PSScriptRoot 'Deploy-TestnetHook.Utilities.ps1'

foreach ($path in @($forge, $cast, $solc, $manifestPath, $deployerKeystore, $coreUtilitiesPath, $hookUtilitiesPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required file is missing: $path"
    }
}
. $coreUtilitiesPath
. $hookUtilitiesPath

function Invoke-Cast([string[]]$CastArguments) {
    $output = @(& $cast @CastArguments 2>&1)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "cast $($CastArguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
    }
    return (($output -join "`n").Trim())
}

function Convert-QuantityToInt64([string]$Value) {
    if ($Value -match '^0x[0-9a-fA-F]+$') { return [Convert]::ToInt64($Value.Substring(2), 16) }
    if ($Value -match '^[0-9]+$') { return [Int64]::Parse($Value) }
    throw "Invalid integer quantity: $Value"
}

function Assert-Address([string]$Label, [string]$Address) {
    if ($Address -notmatch '^0x[0-9a-fA-F]{40}$') { throw "Invalid $Label address: $Address" }
}

function Assert-AddressEquals([string]$Label, [string]$Actual, [string]$Expected) {
    if ($Actual -ine $Expected) { throw "$Label mismatch: expected $Expected, received $Actual" }
}

function Assert-ScalarEquals([string]$Label, [string]$Actual, [string]$Expected) {
    if ($Actual -ne $Expected) { throw "$Label mismatch: expected $Expected, received $Actual" }
}

$expectedChainId = '46630'
$expectedInitialNonce = 16
$create2Factory = '0x4e59b44847b379578588920cA78FbF26c0B4956C'
$poolManager = '0x8366a39cc670b4001a1121b8f6a443a643e40951'
$poolManagerCodeHash = '0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626'
$expectedHook = '0x9f86fE471EFD6089eeb7b43e008fD7D830f130Cc'
$expectedSalt = '0x00000000000000000000000000000000000000000000000000000000000019fc'
[uint16]$expectedHookFlags = 0x30cc
$expectedHookFlagsDecimal = '12492'
$zero = '0x0000000000000000000000000000000000000000'

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
Assert-ScalarEquals 'Manifest chain ID' ([string]$manifest.network.chainId) $expectedChainId
Assert-ScalarEquals 'Manifest core status' ([string]$manifest.phases.core.status) 'deployed-verified-dormant'
Assert-ScalarEquals 'Manifest Bank status' ([string]$manifest.phases.bank.status) 'deployed-live-checked-dormant'
Assert-ScalarEquals 'Manifest Bank ending nonce' ([string]$manifest.phases.bank.deployment.endingNonce) ([string]$expectedInitialNonce)

$safe = [string]$manifest.governance.safe.address
$deployer = [string]$manifest.phases.bank.broadcaster
$omr = [string]$manifest.phases.core.contracts.OMR
$owners = @($manifest.governance.safe.owners)
foreach ($entry in @(
        @{ Label = 'Safe'; Value = $safe },
        @{ Label = 'Broadcaster'; Value = $deployer },
        @{ Label = 'OMR'; Value = $omr },
        @{ Label = 'PoolManager'; Value = $poolManager },
        @{ Label = 'CREATE2 factory'; Value = $create2Factory },
        @{ Label = 'Expected hook'; Value = $expectedHook }
    )) {
    Assert-Address $entry.Label $entry.Value
}
if ($owners.Count -ne 3 -or [string]$manifest.governance.safe.threshold -ne '2') {
    throw 'This testnet release requires exactly three Safe owners with threshold 2.'
}
foreach ($owner in $owners) { Assert-Address 'Safe owner' ([string]$owner) }
Assert-AddressEquals 'Manifest PoolManager' ([string]$manifest.infrastructure.v4PoolManager) $poolManager

$chainId = Invoke-Cast @('chain-id', '--rpc-url', $RpcUrl)
Assert-ScalarEquals 'RPC chain ID' $chainId $expectedChainId

$safeCode = Invoke-Cast @('code', $safe, '--rpc-url', $RpcUrl)
if ($safeCode -eq '0x') { throw "Safe has no bytecode: $safe" }
$safeVersion = Invoke-Cast @('call', $safe, 'VERSION()(string)', '--rpc-url', $RpcUrl)
$safeThreshold = Invoke-Cast @('call', $safe, 'getThreshold()(uint256)', '--rpc-url', $RpcUrl)
$safeOwners = (Invoke-Cast @('call', $safe, 'getOwners()(address[])', '--rpc-url', $RpcUrl)).ToLowerInvariant()
if ($safeVersion -notmatch '1\.4\.1') { throw "Unexpected Safe version: $safeVersion" }
Assert-ScalarEquals 'On-chain Safe threshold' $safeThreshold '2'
foreach ($owner in $owners) {
    if (-not $safeOwners.Contains(([string]$owner).ToLowerInvariant())) {
        throw "On-chain Safe owner missing: $owner"
    }
}

$omrCode = Invoke-Cast @('code', $omr, '--rpc-url', $RpcUrl)
if ($omrCode -eq '0x') { throw "OMR has no bytecode: $omr" }
Assert-AddressEquals 'OMR owner' (Invoke-Cast @('call', $omr, 'owner()(address)', '--rpc-url', $RpcUrl)) $safe

$factoryCode = Invoke-Cast @('code', $create2Factory, '--rpc-url', $RpcUrl)
if ($factoryCode -eq '0x') { throw "Canonical CREATE2 factory has no bytecode: $create2Factory" }
$poolManagerCode = Invoke-Cast @('code', $poolManager, '--rpc-url', $RpcUrl)
if ($poolManagerCode -eq '0x') { throw "PoolManager has no bytecode: $poolManager" }
Assert-ScalarEquals 'PoolManager runtime code hash' (Invoke-Cast @('codehash', $poolManager, '--rpc-url', $RpcUrl)) $poolManagerCodeHash
$poolManagerOwner = Invoke-Cast @('call', $poolManager, 'owner()(address)', '--rpc-url', $RpcUrl)

$networkNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Deployer nonce is $networkNonce, expected $expectedInitialNonce. Do not rerun after a partial or completed hook broadcast; inspect broadcast\DeployHook.s.sol\46630\run-latest.json first."
}

$env:EXPECTED_CHAIN_ID = $expectedChainId
$env:SAFE = $safe
$env:OMR_ADDRESS = $omr
$env:V4_POOL_MANAGER = $poolManager

Write-Host ''
Write-Host 'Running a fresh, non-broadcast OmertaHook simulation...'
$simulationArguments = @(
    'script', 'script\DeployHook.s.sol:DeployHook',
    '--rpc-url', $RpcUrl,
    '--sender', $deployer,
    '--always-use-create-2-factory',
    '--use', $solc,
    '--offline',
    '--cache-path', 'foundry-cache',
    '-vv'
)

Push-Location $contractsRoot
try {
    & $forge @simulationArguments
    if ($LASTEXITCODE -ne 0) { throw 'OmertaHook simulation failed; no transaction was sent.' }
} finally {
    Pop-Location
}

$dryRunPath = Join-Path $contractsRoot "broadcast\DeployHook.s.sol\$chainId\dry-run\run-latest.json"
if (-not (Test-Path -LiteralPath $dryRunPath -PathType Leaf)) {
    throw "Foundry did not write the expected dry-run record: $dryRunPath"
}
$dryRun = Get-Content -LiteralPath $dryRunPath -Raw | ConvertFrom-Json
$transactions = @($dryRun.transactions)
if ($transactions.Count -ne 1) { throw "Simulation produced $($transactions.Count) transactions; expected 1." }

$transaction = $transactions[0]
if ($transaction.transactionType -ne 'CREATE2' -or $transaction.contractName -ne 'OmertaHook') {
    throw 'Simulation did not produce the expected OmertaHook CREATE2 transaction.'
}
Assert-AddressEquals 'Predicted hook' ([string]$transaction.contractAddress) $expectedHook
Assert-AddressEquals 'CREATE2 transaction sender' ([string]$transaction.transaction.from) $deployer
Assert-AddressEquals 'CREATE2 transaction target' ([string]$transaction.transaction.to) $create2Factory
if ((Convert-QuantityToInt64 ([string]$transaction.transaction.nonce)) -ne $expectedInitialNonce) {
    throw "CREATE2 nonce mismatch: expected $expectedInitialNonce, received $($transaction.transaction.nonce)."
}
if (([string]$transaction.transaction.input).Substring(0, 66) -ine $expectedSalt) {
    throw "CREATE2 salt mismatch: expected $expectedSalt."
}
if (-not (Test-HookPermissionBits -Address ([string]$transaction.contractAddress) -ExpectedFlags $expectedHookFlags)) {
    throw "Predicted hook does not encode permission flags 0x30cc: $($transaction.contractAddress)"
}
if (-not (Test-HookAvoidsRoutingReviewPrefix -Address ([string]$transaction.contractAddress))) {
    throw "Predicted hook uses Uniswap Labs' 0x91 routing-review prefix: $($transaction.contractAddress)"
}
if (@($transaction.arguments).Count -ne 3) { throw 'OmertaHook constructor argument count changed.' }
Assert-AddressEquals 'Constructor PoolManager' ([string]$transaction.arguments[0]) $poolManager
Assert-AddressEquals 'Constructor OMR' ([string]$transaction.arguments[1]) $omr
Assert-AddressEquals 'Constructor Safe' ([string]$transaction.arguments[2]) $safe

$predictedCode = Invoke-Cast @('code', $expectedHook, '--rpc-url', $RpcUrl)
if ($predictedCode -ne '0x') { throw "Predicted OmertaHook address is already occupied: $expectedHook" }

[System.Numerics.BigInteger]$totalGas = Convert-QuantityToInt64 ([string]$transaction.transaction.gas)
[System.Numerics.BigInteger]$balanceWei = Invoke-Cast @('balance', $deployer, '--rpc-url', $RpcUrl)
[System.Numerics.BigInteger]$gasPriceWei = Invoke-Cast @('gas-price', '--rpc-url', $RpcUrl)
[System.Numerics.BigInteger]$estimatedFeeWei = $totalGas * $gasPriceWei
[System.Numerics.BigInteger]$requiredWei = $estimatedFeeWei * 2
if ($balanceWei -lt $requiredWei) {
    throw "Broadcaster needs more test ETH. Balance=$balanceWei wei; buffered requirement=$requiredWei wei."
}

Write-Host ''
Write-Host "Network: Robinhood Chain Testnet ($chainId)"
Write-Host "Broadcaster: $deployer"
Write-Host "Broadcaster nonce: $networkNonce"
Write-Host "Broadcaster balance: $balanceWei wei"
Write-Host "Buffered gas requirement: $requiredWei wei"
Write-Host "Safe owner: $safe (v1.4.1, 2 of 3)"
Write-Host "OMR: $omr"
Write-Host "PoolManager: $poolManager"
Write-Host "PoolManager owner: $poolManagerOwner"
Write-Host "PoolManager code hash: $poolManagerCodeHash"
Write-Host "CREATE2 factory: $create2Factory"
Write-Host "Mined salt: $expectedSalt"
Write-Host "Predicted OmertaHook: $expectedHook (flags 0x30cc)"
Write-Host 'Uniswap routing: address avoids 0x91; manual allowlisting remains required for the swap return-delta flags'
Write-Host 'Hook activation state: no allowed quote, recipients, observer, tax, anti-snipe window, or surge'

if ($PreflightOnly) {
    Write-Host ''
    Write-Host 'HOOK_PREFLIGHT_OK=true'
    Write-Host 'No transaction was sent.'
    exit 0
}

Write-Host ''
Write-Warning 'This sends one real testnet CREATE2 transaction. If Foundry sends it and then stops, do not rerun this script blindly.'
$confirmation = Read-Host 'Type DEPLOY HOOK to broadcast the unarmed OmertaHook'
if ($confirmation -cne 'DEPLOY HOOK') { throw 'Deployment cancelled; no transaction was sent.' }

$networkNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Deployer nonce changed to $networkNonce after simulation; no transaction was sent."
}
$predictedCode = Invoke-Cast @('code', $expectedHook, '--rpc-url', $RpcUrl)
if ($predictedCode -ne '0x') { throw "Predicted hook address became occupied after simulation: $expectedHook" }

Write-Host ''
Write-Host 'Foundry will prompt for the TESTNET keystore password. The password is not stored by this script.'
$broadcastArguments = @(
    'script', 'script\DeployHook.s.sol:DeployHook',
    '--rpc-url', $RpcUrl,
    '--sender', $deployer,
    '--keystore', $deployerKeystore,
    '--broadcast',
    '--slow',
    '--always-use-create-2-factory',
    '--use', $solc,
    '--offline',
    '--cache-path', 'foundry-cache',
    '-vvvv'
)

Push-Location $contractsRoot
try {
    & $forge @broadcastArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Hook broadcast did not complete. Do not rerun; inspect the Foundry broadcast record and on-chain nonce first.'
    }
} finally {
    Pop-Location
}

$broadcastPath = Join-Path $contractsRoot "broadcast\DeployHook.s.sol\$chainId\run-latest.json"
if (-not (Test-Path -LiteralPath $broadcastPath -PathType Leaf)) {
    throw "Broadcast returned success but the Foundry record is missing: $broadcastPath"
}
$broadcast = Get-Content -LiteralPath $broadcastPath -Raw | ConvertFrom-Json
$broadcastTransactions = @($broadcast.transactions)
$receipts = @($broadcast.receipts)
if ($broadcastTransactions.Count -ne 1 -or $receipts.Count -ne 1) {
    throw "Broadcast record is incomplete: transactions=$($broadcastTransactions.Count), receipts=$($receipts.Count)."
}
$broadcastTransaction = $broadcastTransactions[0]
$receipt = $receipts[0]
if ($broadcastTransaction.transactionType -ne 'CREATE2' -or $broadcastTransaction.contractName -ne 'OmertaHook') {
    throw 'Broadcast record does not contain the expected OmertaHook CREATE2 transaction.'
}
Assert-AddressEquals 'Broadcast hook address' ([string]$broadcastTransaction.contractAddress) $expectedHook
if (([string]$receipt.status) -notin @('0x1', '1')) {
    throw "OmertaHook receipt did not succeed: $($receipt.transactionHash)"
}
Assert-AddressEquals 'Receipt sender' ([string]$receipt.from) $deployer
Assert-AddressEquals 'Receipt target' ([string]$receipt.to) $create2Factory
if ([string]$broadcastTransaction.hash -ine [string]$receipt.transactionHash) {
    throw 'Broadcast transaction hash and receipt hash do not match.'
}

$hookCode = Invoke-Cast @('code', $expectedHook, '--rpc-url', $RpcUrl)
if ($hookCode -eq '0x') { throw "OmertaHook has no bytecode after broadcast: $expectedHook" }
if (-not (Test-HookPermissionBits -Address $expectedHook -ExpectedFlags $expectedHookFlags)) {
    throw "Deployed hook address has incorrect permission flags: $expectedHook"
}
if (-not (Test-HookAvoidsRoutingReviewPrefix -Address $expectedHook)) {
    throw "Deployed hook uses Uniswap Labs' 0x91 routing-review prefix: $expectedHook"
}

Assert-AddressEquals 'OmertaHook owner' (Invoke-Cast @('call', $expectedHook, 'owner()(address)', '--rpc-url', $RpcUrl)) $safe
Assert-AddressEquals 'OmertaHook pending owner' (Invoke-Cast @('call', $expectedHook, 'pendingOwner()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-AddressEquals 'OmertaHook PoolManager' (Invoke-Cast @('call', $expectedHook, 'poolManager()(address)', '--rpc-url', $RpcUrl)) $poolManager
Assert-AddressEquals 'OmertaHook OMR' (Invoke-Cast @('call', $expectedHook, 'omr()(address)', '--rpc-url', $RpcUrl)) $omr
Assert-ScalarEquals 'OmertaHook flags' (Convert-CastUint (Invoke-Cast @('call', $expectedHook, 'HOOK_FLAGS()(uint160)', '--rpc-url', $RpcUrl))) $expectedHookFlagsDecimal

foreach ($getter in @(
        'sellTaxBps()(uint256)',
        'taxDevBps()(uint256)',
        'taxRwaBps()(uint256)',
        'taxCommunityBps()(uint256)',
        'antiSnipeBlocks()(uint256)',
        'antiSnipeBuyBps()(uint256)',
        'antiSnipeMaxBuy()(uint256)',
        'surgeMaxBps()(uint256)',
        'surgeFullBps()(uint256)'
    )) {
    Assert-ScalarEquals $getter (Convert-CastUint (Invoke-Cast @('call', $expectedHook, $getter, '--rpc-url', $RpcUrl))) '0'
}
foreach ($getter in @(
        'devRecipient()(address)',
        'rwaRecipient()(address)',
        'communityRecipient()(address)',
        'lpRecipient()(address)',
        'observer()(address)'
    )) {
    Assert-AddressEquals $getter (Invoke-Cast @('call', $expectedHook, $getter, '--rpc-url', $RpcUrl)) $zero
}
Assert-ScalarEquals 'Native quote allowed' (Invoke-Cast @('call', $expectedHook, 'allowedQuote(address)(bool)', $zero, '--rpc-url', $RpcUrl)) 'false'
Assert-ScalarEquals 'Test Bank quote allowed' (Invoke-Cast @('call', $expectedHook, 'allowedQuote(address)(bool)', ([string]$manifest.phases.bank.contracts.TestBankAsset), '--rpc-url', $RpcUrl)) 'false'

$endingNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($endingNonce -ne ($expectedInitialNonce + 1)) {
    throw "Unexpected broadcaster nonce after hook deployment: $endingNonce"
}

$blockNumber = Convert-QuantityToInt64 ([string]$receipt.blockNumber)
Write-Host ''
Write-Host 'OmertaHook deployed and verified. Every hook activation control remains OFF/empty.'
Write-Host ([pscustomobject]@{
        Contract = 'OmertaHook'
        Address = $expectedHook
        TransactionHash = $receipt.transactionHash
        BlockNumber = $blockNumber
    } | Format-Table -AutoSize | Out-String).TrimEnd()
Write-Host ''
Write-Host "HOOK_OMERTAHOOK=$expectedHook"
Write-Host 'Paste the table and HOOK_ line into Codex so the manifest can be finalized.'
