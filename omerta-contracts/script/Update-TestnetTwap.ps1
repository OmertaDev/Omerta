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
$utilitiesPath = Join-Path $PSScriptRoot 'Deploy-TestnetCore.Utilities.ps1'

foreach ($path in @($forge, $cast, $solc, $manifestPath, $deployerKeystore, $utilitiesPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required file is missing: $path"
    }
}
. $utilitiesPath

function Invoke-Cast([string[]]$CastArguments) {
    $output = @(& $cast @CastArguments 2>&1)
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "cast $($CastArguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
    }
    return (($output -join "`n").Trim())
}

function Invoke-Rpc([string]$Method, [object[]]$Parameters) {
    $body = @{ jsonrpc = '2.0'; id = 1; method = $Method; params = $Parameters } |
        ConvertTo-Json -Compress -Depth 8
    $response = Invoke-RestMethod -Method Post -Uri $RpcUrl -ContentType 'application/json' -Body $body
    if ($response.PSObject.Properties.Name -contains 'error') {
        throw "RPC $Method failed: $($response.error | ConvertTo-Json -Compress)"
    }
    return $response.result
}

function Convert-QuantityToInt64([string]$Value) {
    if ($Value -match '^0x[0-9a-fA-F]+$') { return [Convert]::ToInt64($Value.Substring(2), 16) }
    if ($Value -match '^[0-9]+$') { return [Int64]::Parse($Value) }
    throw "Invalid integer quantity: $Value"
}

function Convert-CastTupleUints([string]$Value, [int]$ExpectedCount) {
    $lines = @($Value -split '[\r\n]+' | Where-Object { $_.Trim() })
    if ($lines.Count -ne $ExpectedCount) {
        throw "Expected $ExpectedCount cast tuple values, received $($lines.Count): $Value"
    }
    return @($lines | ForEach-Object { Convert-CastUint $_ })
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
$expectedInitialNonce = 20
$expectedEndingNonce = 21
$periodSeconds = 600
$maxWindowSeconds = 2400
$expectedPrice = '5000000000000000000000'
$zero = '0x0000000000000000000000000000000000000000'

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
Assert-ScalarEquals 'Manifest chain ID' ([string]$manifest.network.chainId) $expectedChainId
$allowedTwapStatuses = @(
    'deployed-live-checked-first-window-open',
    'deployed-live-checked-first-window-closed-bond-disconnected'
)
if ([string]$manifest.phases.twap.status -notin $allowedTwapStatuses) {
    throw "Manifest TWAP status is not update-compatible: $($manifest.phases.twap.status)"
}
Assert-ScalarEquals 'Manifest TWAP ending nonce' ([string]$manifest.phases.twap.deployment.endingNonce) ([string]$expectedInitialNonce)
Assert-ScalarEquals 'Manifest TWAP period' ([string]$manifest.phases.twap.profile.periodSeconds) ([string]$periodSeconds)
Assert-ScalarEquals 'Manifest virtual price' ([string]$manifest.phases.twap.profile.virtualPriceOmrPerEthWei) $expectedPrice

$safe = [string]$manifest.governance.safe.address
$deployer = [string]$manifest.phases.twap.broadcaster
$omr = [string]$manifest.phases.core.contracts.OMR
$bond = [string]$manifest.phases.core.contracts.OmertaBond
$testWeth = [string]$manifest.phases.twap.contracts.TestTwapWeth
$testPair = [string]$manifest.phases.twap.contracts.TestFixedOmrV2Pair
$oracle = [string]$manifest.phases.twap.contracts.OmrTwapOracle
foreach ($entry in @(
        @{ Label = 'Safe'; Value = $safe },
        @{ Label = 'Broadcaster'; Value = $deployer },
        @{ Label = 'OMR'; Value = $omr },
        @{ Label = 'OmertaBond'; Value = $bond },
        @{ Label = 'vtWETH'; Value = $testWeth },
        @{ Label = 'virtual pair'; Value = $testPair },
        @{ Label = 'TWAP oracle'; Value = $oracle }
    )) {
    Assert-Address $entry.Label $entry.Value
}

$chainId = Invoke-Cast @('chain-id', '--rpc-url', $RpcUrl)
Assert-ScalarEquals 'RPC chain ID' $chainId $expectedChainId
foreach ($entry in @(
        @{ Label = 'OMR'; Address = $omr },
        @{ Label = 'OmertaBond'; Address = $bond },
        @{ Label = 'vtWETH'; Address = $testWeth },
        @{ Label = 'virtual pair'; Address = $testPair },
        @{ Label = 'TWAP oracle'; Address = $oracle }
    )) {
    if ((Invoke-Cast @('code', $entry.Address, '--rpc-url', $RpcUrl)) -eq '0x') {
        throw "$($entry.Label) has no bytecode: $($entry.Address)"
    }
}

Assert-AddressEquals 'Oracle owner' (Invoke-Cast @('call', $oracle, 'owner()(address)', '--rpc-url', $RpcUrl)) $safe
Assert-AddressEquals 'Oracle pair' (Invoke-Cast @('call', $oracle, 'pair()(address)', '--rpc-url', $RpcUrl)) $testPair
Assert-ScalarEquals 'Oracle period' (Convert-CastUint (Invoke-Cast @('call', $oracle, 'PERIOD()(uint32)', '--rpc-url', $RpcUrl))) ([string]$periodSeconds)
Assert-ScalarEquals 'Oracle OMR orientation' (Invoke-Cast @('call', $oracle, 'omrIsToken1()(bool)', '--rpc-url', $RpcUrl)) 'false'
Assert-AddressEquals 'Pair token0' (Invoke-Cast @('call', $testPair, 'token0()(address)', '--rpc-url', $RpcUrl)) $omr
Assert-AddressEquals 'Pair token1' (Invoke-Cast @('call', $testPair, 'token1()(address)', '--rpc-url', $RpcUrl)) $testWeth
Assert-AddressEquals 'OmertaBond oracle' (Invoke-Cast @('call', $bond, 'oracle()(address)', '--rpc-url', $RpcUrl)) $zero

$networkNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
$priceAverage = Convert-CastUint (Invoke-Cast @('call', $oracle, 'priceAverage()(uint224)', '--rpc-url', $RpcUrl))
$lastUpdate = Convert-CastUint (Invoke-Cast @('call', $oracle, 'lastUpdate()(uint256)', '--rpc-url', $RpcUrl))
$consult = Convert-CastTupleUints (Invoke-Cast @('call', $oracle, 'consult()(uint256,uint256)', '--rpc-url', $RpcUrl)) 2

if ($lastUpdate -ne '0') {
    Assert-ScalarEquals 'Existing TWAP price' ([string]$consult[0]) $expectedPrice
    Assert-ScalarEquals 'Existing TWAP timestamp' ([string]$consult[1]) $lastUpdate
    if ($networkNonce -lt $expectedEndingNonce) {
        throw "The oracle is updated but broadcaster nonce is unexpectedly $networkNonce."
    }
    Write-Host ''
    Write-Host "TWAP update is already complete at $lastUpdate with price $($consult[0])."
    Write-Host 'TWAP_UPDATE_ALREADY_COMPLETE=true'
    Write-Host 'No transaction was sent.'
    exit 0
}

Assert-ScalarEquals 'Oracle initial average' $priceAverage '0'
Assert-ScalarEquals 'Oracle initial consult price' ([string]$consult[0]) '0'
Assert-ScalarEquals 'Oracle initial consult timestamp' ([string]$consult[1]) '0'
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Broadcaster nonce is $networkNonce, expected $expectedInitialNonce. Inspect chain state before sending the first TWAP update."
}

$snapshotTimestamp = [Int64](Convert-CastUint (Invoke-Cast @('call', $oracle, 'blockTimestampLast()(uint32)', '--rpc-url', $RpcUrl)))
$latestBlock = Invoke-Rpc 'eth_getBlockByNumber' @('latest', $false)
$latestTimestamp = [Convert]::ToInt64(([string]$latestBlock.timestamp).Substring(2), 16)
$latestTimestampMod = $latestTimestamp % 4294967296
$elapsedSeconds = ($latestTimestampMod - $snapshotTimestamp + 4294967296) % 4294967296
$remainingSeconds = [Math]::Max(0, $periodSeconds - $elapsedSeconds)

Write-Host ''
Write-Host "Network: Robinhood Chain Testnet ($chainId)"
Write-Host "Broadcaster: $deployer"
Write-Host "Broadcaster nonce: $networkNonce"
Write-Host "OmrTwapOracle: $oracle"
Write-Host "Snapshot timestamp: $snapshotTimestamp"
Write-Host "Latest chain timestamp: $latestTimestamp"
Write-Host "Elapsed: $elapsedSeconds seconds"
Write-Host "Required: $periodSeconds seconds"
Write-Host "Remaining: $remainingSeconds seconds"
Write-Host 'OmertaBond oracle remains unset'

if ($elapsedSeconds -lt $periodSeconds) {
    Write-Host ''
    Write-Host 'TWAP_UPDATE_READY=false'
    Write-Host 'No transaction was sent.'
    if (-not $PreflightOnly) { throw "The first TWAP window needs $remainingSeconds more chain seconds." }
    exit 0
}
if ($elapsedSeconds -gt $maxWindowSeconds) {
    throw "The $elapsedSeconds-second window exceeds the trusted $maxWindowSeconds-second maximum. Updating would rebaseline instead of publishing a price."
}

$env:EXPECTED_CHAIN_ID = $expectedChainId
$env:TWAP_ORACLE = $oracle
$env:EXPECTED_TWAP_PRICE_OMR_PER_ETH_WEI = $expectedPrice

Write-Host ''
Write-Host 'Running a fresh, non-broadcast first-window update simulation...'
$simulationArguments = @(
    'script', 'script\UpdateTestnetTwap.s.sol:UpdateTestnetTwap',
    '--rpc-url', $RpcUrl,
    '--sender', $deployer,
    '--use', $solc,
    '--offline',
    '--cache-path', 'foundry-cache',
    '-vv'
)
Push-Location $contractsRoot
try {
    & $forge @simulationArguments
    if ($LASTEXITCODE -ne 0) { throw 'TWAP update simulation failed; no transaction was sent.' }
} finally {
    Pop-Location
}

$dryRunPath = Join-Path $contractsRoot "broadcast\UpdateTestnetTwap.s.sol\$chainId\dry-run\run-latest.json"
if (-not (Test-Path -LiteralPath $dryRunPath -PathType Leaf)) {
    throw "Foundry did not write the expected dry-run record: $dryRunPath"
}
$dryRun = Get-Content -LiteralPath $dryRunPath -Raw | ConvertFrom-Json
$transactions = @($dryRun.transactions)
if ($transactions.Count -ne 1) { throw "Simulation produced $($transactions.Count) transactions; expected 1." }
$transaction = $transactions[0]
if ($transaction.transactionType -ne 'CALL') { throw "Expected a CALL transaction, received $($transaction.transactionType)." }
Assert-AddressEquals 'Update sender' ([string]$transaction.transaction.from) $deployer
Assert-AddressEquals 'Update target' ([string]$transaction.transaction.to) $oracle
if ((Convert-QuantityToInt64 ([string]$transaction.transaction.nonce)) -ne $expectedInitialNonce) {
    throw "Update nonce mismatch: expected $expectedInitialNonce, received $($transaction.transaction.nonce)."
}
$updateSelector = Invoke-Cast @('sig', 'update()')
Assert-ScalarEquals 'Update calldata' ([string]$transaction.transaction.input) $updateSelector

[System.Numerics.BigInteger]$gas = Convert-QuantityToInt64 ([string]$transaction.transaction.gas)
[System.Numerics.BigInteger]$balanceWei = Invoke-Cast @('balance', $deployer, '--rpc-url', $RpcUrl)
[System.Numerics.BigInteger]$gasPriceWei = Invoke-Cast @('gas-price', '--rpc-url', $RpcUrl)
[System.Numerics.BigInteger]$requiredWei = $gas * $gasPriceWei * 2
if ($balanceWei -lt $requiredWei) {
    throw "Broadcaster needs more test ETH. Balance=$balanceWei wei; buffered requirement=$requiredWei wei."
}

Write-Host ''
Write-Host "Buffered gas requirement: $requiredWei wei"
Write-Host 'TWAP_UPDATE_READY=true'
if ($PreflightOnly) {
    Write-Host 'No transaction was sent.'
    exit 0
}

Write-Host ''
Write-Warning 'This sends one permissionless testnet transaction to close the first virtual TWAP window.'
Write-Warning 'Do not rerun if Foundry sends the transaction and then stops; inspect the receipt and oracle first.'
$confirmation = Read-Host 'Type UPDATE TWAP to broadcast the first-window update'
if ($confirmation -cne 'UPDATE TWAP') { throw 'Update cancelled; no transaction was sent.' }

if ([int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl)) -ne $expectedInitialNonce) {
    throw 'Broadcaster nonce changed after simulation; no transaction was sent.'
}
Assert-ScalarEquals 'Oracle last update before broadcast' (Convert-CastUint (Invoke-Cast @('call', $oracle, 'lastUpdate()(uint256)', '--rpc-url', $RpcUrl))) '0'

Write-Host ''
Write-Host 'Foundry will prompt for the TESTNET keystore password. The password is not stored by this script.'
$broadcastArguments = @(
    'script', 'script\UpdateTestnetTwap.s.sol:UpdateTestnetTwap',
    '--rpc-url', $RpcUrl,
    '--sender', $deployer,
    '--keystore', $deployerKeystore,
    '--broadcast',
    '--slow',
    '--use', $solc,
    '--offline',
    '--cache-path', 'foundry-cache',
    '-vvvv'
)
Push-Location $contractsRoot
try {
    & $forge @broadcastArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'TWAP update broadcast did not complete. Do not rerun; inspect the broadcast record and oracle state first.'
    }
} finally {
    Pop-Location
}

$broadcastPath = Join-Path $contractsRoot "broadcast\UpdateTestnetTwap.s.sol\$chainId\run-latest.json"
if (-not (Test-Path -LiteralPath $broadcastPath -PathType Leaf)) {
    throw "Broadcast returned success but the Foundry record is missing: $broadcastPath"
}
$broadcast = Get-Content -LiteralPath $broadcastPath -Raw | ConvertFrom-Json
$receipts = @($broadcast.receipts)
if ($receipts.Count -ne 1 -or ([string]$receipts[0].status) -notin @('0x1', '1')) {
    throw 'The first-window update receipt is missing or unsuccessful.'
}

$priceAverage = Convert-CastUint (Invoke-Cast @('call', $oracle, 'priceAverage()(uint224)', '--rpc-url', $RpcUrl))
if ($priceAverage -eq '0') { throw 'Oracle priceAverage is still zero after the update.' }
$lastUpdate = Convert-CastUint (Invoke-Cast @('call', $oracle, 'lastUpdate()(uint256)', '--rpc-url', $RpcUrl))
$consult = Convert-CastTupleUints (Invoke-Cast @('call', $oracle, 'consult()(uint256,uint256)', '--rpc-url', $RpcUrl)) 2
Assert-ScalarEquals 'TWAP price after update' ([string]$consult[0]) $expectedPrice
Assert-ScalarEquals 'TWAP timestamp after update' ([string]$consult[1]) $lastUpdate
Assert-AddressEquals 'OmertaBond oracle after update' (Invoke-Cast @('call', $bond, 'oracle()(address)', '--rpc-url', $RpcUrl)) $zero
if ([int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl)) -ne $expectedEndingNonce) {
    throw "Broadcaster nonce did not advance to $expectedEndingNonce."
}

$receipt = $receipts[0]
Write-Host ''
Write-Host 'First virtual TWAP window closed and independently read back. OmertaBond remains disconnected.'
Write-Host "TWAP_UPDATE_TX=$($receipt.transactionHash)"
Write-Host "TWAP_PRICE_OMR_PER_ETH_WEI=$($consult[0])"
Write-Host "TWAP_UPDATED_AT=$lastUpdate"
Write-Host 'Paste these TWAP_UPDATE_ lines into Codex so the manifest can be finalized.'
