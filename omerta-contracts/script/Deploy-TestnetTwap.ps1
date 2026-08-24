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
$expectedInitialNonce = 17
$expectedEndingNonce = 20
$periodSeconds = '600'
$zero = '0x0000000000000000000000000000000000000000'
$expectedContracts = @('TestTwapWeth', 'TestFixedOmrV2Pair', 'OmrTwapOracle')

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
Assert-ScalarEquals 'Manifest chain ID' ([string]$manifest.network.chainId) $expectedChainId
Assert-ScalarEquals 'Manifest core status' ([string]$manifest.phases.core.status) 'deployed-verified-dormant'
Assert-ScalarEquals 'Manifest Bank status' ([string]$manifest.phases.bank.status) 'deployed-live-checked-dormant'
Assert-ScalarEquals 'Manifest hook status' ([string]$manifest.phases.hook.status) 'deployed-live-checked-dormant'
Assert-ScalarEquals 'Manifest hook ending nonce' ([string]$manifest.phases.hook.deployment.endingNonce) ([string]$expectedInitialNonce)

$safe = [string]$manifest.governance.safe.address
$deployer = [string]$manifest.phases.hook.broadcaster
$omr = [string]$manifest.phases.core.contracts.OMR
$bond = [string]$manifest.phases.core.contracts.OmertaBond
$hook = [string]$manifest.phases.hook.contracts.OmertaHook
$owners = @($manifest.governance.safe.owners)
foreach ($entry in @(
        @{ Label = 'Safe'; Value = $safe },
        @{ Label = 'Broadcaster'; Value = $deployer },
        @{ Label = 'OMR'; Value = $omr },
        @{ Label = 'OmertaBond'; Value = $bond },
        @{ Label = 'OmertaHook'; Value = $hook }
    )) {
    Assert-Address $entry.Label $entry.Value
}
if ($owners.Count -ne 3 -or [string]$manifest.governance.safe.threshold -ne '2') {
    throw 'This testnet release requires exactly three Safe owners with threshold 2.'
}
foreach ($owner in $owners) { Assert-Address 'Safe owner' ([string]$owner) }

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

foreach ($entry in @(
        @{ Label = 'OMR'; Address = $omr },
        @{ Label = 'OmertaBond'; Address = $bond },
        @{ Label = 'OmertaHook'; Address = $hook }
    )) {
    if ((Invoke-Cast @('code', $entry.Address, '--rpc-url', $RpcUrl)) -eq '0x') {
        throw "$($entry.Label) has no bytecode: $($entry.Address)"
    }
}
Assert-AddressEquals 'OMR owner' (Invoke-Cast @('call', $omr, 'owner()(address)', '--rpc-url', $RpcUrl)) $safe
Assert-AddressEquals 'OmertaBond owner' (Invoke-Cast @('call', $bond, 'owner()(address)', '--rpc-url', $RpcUrl)) $safe
Assert-AddressEquals 'OmertaBond oracle before rehearsal' (Invoke-Cast @('call', $bond, 'oracle()(address)', '--rpc-url', $RpcUrl)) $zero

$networkNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Deployer nonce is $networkNonce, expected $expectedInitialNonce. Do not rerun after a partial or completed TWAP broadcast; inspect broadcast\DeployTestnetTwap.s.sol\46630\run-latest.json first."
}

$env:EXPECTED_CHAIN_ID = $expectedChainId
$env:SAFE = $safe
$env:OMR_ADDRESS = $omr
$env:TWAP_PERIOD_SECONDS = $periodSeconds

Write-Host ''
Write-Host 'Running a fresh, non-broadcast testnet TWAP simulation...'
$simulationArguments = @(
    'script', 'script\DeployTestnetTwap.s.sol:DeployTestnetTwap',
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
    if ($LASTEXITCODE -ne 0) { throw 'Testnet TWAP simulation failed; no transaction was sent.' }
} finally {
    Pop-Location
}

$dryRunPath = Join-Path $contractsRoot "broadcast\DeployTestnetTwap.s.sol\$chainId\dry-run\run-latest.json"
if (-not (Test-Path -LiteralPath $dryRunPath -PathType Leaf)) {
    throw "Foundry did not write the expected dry-run record: $dryRunPath"
}
$dryRun = Get-Content -LiteralPath $dryRunPath -Raw | ConvertFrom-Json
$transactions = @($dryRun.transactions)
if ($transactions.Count -ne $expectedContracts.Count) {
    throw "Simulation produced $($transactions.Count) transactions; expected $($expectedContracts.Count)."
}

$predicted = [ordered]@{}
[System.Numerics.BigInteger]$totalGas = 0
for ($index = 0; $index -lt $expectedContracts.Count; $index++) {
    $transaction = $transactions[$index]
    $expectedName = $expectedContracts[$index]
    if ($transaction.transactionType -ne 'CREATE' -or $transaction.contractName -ne $expectedName) {
        throw "Transaction $index mismatch: expected CREATE $expectedName."
    }
    Assert-Address "$expectedName predicted" ([string]$transaction.contractAddress)
    Assert-AddressEquals "$expectedName broadcaster" ([string]$transaction.transaction.from) $deployer
    $nonce = Convert-QuantityToInt64 ([string]$transaction.transaction.nonce)
    if ($nonce -ne ($expectedInitialNonce + $index)) {
        throw "$expectedName nonce mismatch: expected $($expectedInitialNonce + $index), received $nonce."
    }
    if ((Invoke-Cast @('code', $transaction.contractAddress, '--rpc-url', $RpcUrl)) -ne '0x') {
        throw "Predicted $expectedName address is already occupied: $($transaction.contractAddress)"
    }
    $predicted[$expectedName] = [string]$transaction.contractAddress
    $totalGas += Convert-QuantityToInt64 ([string]$transaction.transaction.gas)
}

$testWethArgs = @($transactions[0].arguments)
$testPairArgs = @($transactions[1].arguments)
$oracleArgs = @($transactions[2].arguments)
if ($testWethArgs.Count -ne 1 -or $testPairArgs.Count -ne 2 -or $oracleArgs.Count -ne 4) {
    throw 'A TWAP constructor argument count changed.'
}
Assert-AddressEquals 'TestTwapWeth recipient' ([string]$testWethArgs[0]) $safe
Assert-AddressEquals 'Test pair OMR' ([string]$testPairArgs[0]) $omr
Assert-AddressEquals 'Test pair vtWETH' ([string]$testPairArgs[1]) $predicted.TestTwapWeth
Assert-AddressEquals 'Oracle owner' ([string]$oracleArgs[0]) $safe
Assert-AddressEquals 'Oracle pair' ([string]$oracleArgs[1]) $predicted.TestFixedOmrV2Pair
Assert-AddressEquals 'Oracle OMR' ([string]$oracleArgs[2]) $omr
Assert-ScalarEquals 'Oracle period' ([string]$oracleArgs[3]) $periodSeconds

[System.Numerics.BigInteger]$balanceWei = Invoke-Cast @('balance', $deployer, '--rpc-url', $RpcUrl)
[System.Numerics.BigInteger]$gasPriceWei = Invoke-Cast @('gas-price', '--rpc-url', $RpcUrl)
[System.Numerics.BigInteger]$estimatedFeeWei = $totalGas * $gasPriceWei
[System.Numerics.BigInteger]$requiredWei = $estimatedFeeWei * 2
if ($balanceWei -lt $requiredWei) {
    throw "Broadcaster needs more test ETH. Balance=$balanceWei wei; buffered requirement=$requiredWei wei."
}

$rows = foreach ($name in $expectedContracts) {
    [pscustomobject]@{ Contract = $name; PredictedAddress = $predicted[$name] }
}

Write-Host ''
Write-Host "Network: Robinhood Chain Testnet ($chainId)"
Write-Host "Broadcaster: $deployer"
Write-Host "Broadcaster nonce: $networkNonce"
Write-Host "Broadcaster balance: $balanceWei wei"
Write-Host "Buffered gas requirement: $requiredWei wei"
Write-Host "Safe owner: $safe (v1.4.1, 2 of 3)"
Write-Host "OMR: $omr"
Write-Host "OmertaBond: $bond (oracle remains unset)"
Write-Host "TWAP period: $periodSeconds seconds"
Write-Host 'Virtual price: 5,000 OMR per ETH from immutable 500,000 OMR / 100 vtWETH observations'
Write-Host 'TESTNET ONLY: the virtual pair is not an AMM, holds no assets, and must never be wired to OmertaBond'
Write-Host ''
Write-Host (($rows | Format-Table -AutoSize | Out-String).TrimEnd())

if ($PreflightOnly) {
    Write-Host ''
    Write-Host 'TWAP_PREFLIGHT_OK=true'
    Write-Host 'No transaction was sent.'
    exit 0
}

Write-Host ''
Write-Warning 'This sends three real testnet transactions. If Foundry stops partway through, do not rerun this script blindly.'
Write-Warning 'These are virtual observation dependencies for testing only. The helper will verify OmertaBond stays disconnected.'
$confirmation = Read-Host 'Type DEPLOY TWAP to broadcast the three testnet TWAP transactions'
if ($confirmation -cne 'DEPLOY TWAP') { throw 'Deployment cancelled; no transaction was sent.' }

$networkNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Deployer nonce changed to $networkNonce after simulation; no transaction was sent."
}

Write-Host ''
Write-Host 'Foundry will prompt for the TESTNET keystore password. The password is not stored by this script.'
$broadcastArguments = @(
    'script', 'script\DeployTestnetTwap.s.sol:DeployTestnetTwap',
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
        throw 'TWAP broadcast did not complete. Do not rerun; inspect the Foundry broadcast record and on-chain nonce first.'
    }
} finally {
    Pop-Location
}

$broadcastPath = Join-Path $contractsRoot "broadcast\DeployTestnetTwap.s.sol\$chainId\run-latest.json"
if (-not (Test-Path -LiteralPath $broadcastPath -PathType Leaf)) {
    throw "Broadcast returned success but the Foundry record is missing: $broadcastPath"
}
$broadcast = Get-Content -LiteralPath $broadcastPath -Raw | ConvertFrom-Json
$broadcastTransactions = @($broadcast.transactions)
$receipts = @($broadcast.receipts)
if ($broadcastTransactions.Count -ne $expectedContracts.Count -or $receipts.Count -ne $expectedContracts.Count) {
    throw "Broadcast record is incomplete: transactions=$($broadcastTransactions.Count), receipts=$($receipts.Count)."
}

$receiptByAddress = @{}
foreach ($receipt in $receipts) {
    if (([string]$receipt.status) -notin @('0x1', '1')) {
        throw "A TWAP receipt did not succeed: $($receipt.transactionHash)"
    }
    if ($receipt.contractAddress) { $receiptByAddress[$receipt.contractAddress.ToLowerInvariant()] = $receipt }
}
foreach ($name in $expectedContracts) {
    $address = $predicted[$name]
    if ((Invoke-Cast @('code', $address, '--rpc-url', $RpcUrl)) -eq '0x') {
        throw "$name has no bytecode after broadcast: $address"
    }
    if (-not $receiptByAddress.ContainsKey($address.ToLowerInvariant())) {
        throw "$name has no matching deployment receipt: $address"
    }
}

$testWeth = $predicted.TestTwapWeth
$testPair = $predicted.TestFixedOmrV2Pair
$oracle = $predicted.OmrTwapOracle
$testWethSupply = '1000000000000000000000'
$omrVirtualReserve = '500000000000000000000000'
$wethVirtualReserve = '100000000000000000000'

Assert-ScalarEquals 'vtWETH name' (Invoke-Cast @('call', $testWeth, 'name()(string)', '--rpc-url', $RpcUrl)) '"Virtual Test Wrapped Ether"'
Assert-ScalarEquals 'vtWETH symbol' (Invoke-Cast @('call', $testWeth, 'symbol()(string)', '--rpc-url', $RpcUrl)) '"vtWETH"'
Assert-ScalarEquals 'vtWETH decimals' (Convert-CastUint (Invoke-Cast @('call', $testWeth, 'decimals()(uint8)', '--rpc-url', $RpcUrl))) '18'
Assert-ScalarEquals 'vtWETH total supply' (Convert-CastUint (Invoke-Cast @('call', $testWeth, 'totalSupply()(uint256)', '--rpc-url', $RpcUrl))) $testWethSupply
Assert-ScalarEquals 'Safe vtWETH balance' (Convert-CastUint (Invoke-Cast @('call', $testWeth, 'balanceOf(address)(uint256)', $safe, '--rpc-url', $RpcUrl))) $testWethSupply
Assert-ScalarEquals 'Pair vtWETH balance' (Convert-CastUint (Invoke-Cast @('call', $testWeth, 'balanceOf(address)(uint256)', $testPair, '--rpc-url', $RpcUrl))) '0'
Assert-ScalarEquals 'Pair OMR balance' (Convert-CastUint (Invoke-Cast @('call', $omr, 'balanceOf(address)(uint256)', $testPair, '--rpc-url', $RpcUrl))) '0'

Assert-AddressEquals 'Pair token0' (Invoke-Cast @('call', $testPair, 'token0()(address)', '--rpc-url', $RpcUrl)) $omr
Assert-AddressEquals 'Pair token1' (Invoke-Cast @('call', $testPair, 'token1()(address)', '--rpc-url', $RpcUrl)) $testWeth
$reserves = Convert-CastTupleUints (Invoke-Cast @('call', $testPair, 'getReserves()(uint112,uint112,uint32)', '--rpc-url', $RpcUrl)) 3
Assert-ScalarEquals 'Pair reserve0' ([string]$reserves[0]) $omrVirtualReserve
Assert-ScalarEquals 'Pair reserve1' ([string]$reserves[1]) $wethVirtualReserve
if ([System.Numerics.BigInteger]::Parse([string]$reserves[2]) -le 0) { throw 'Pair reserve timestamp is zero.' }
Assert-ScalarEquals 'Pair price0 cumulative' (Convert-CastUint (Invoke-Cast @('call', $testPair, 'price0CumulativeLast()(uint256)', '--rpc-url', $RpcUrl))) '0'
Assert-ScalarEquals 'Pair price1 cumulative' (Convert-CastUint (Invoke-Cast @('call', $testPair, 'price1CumulativeLast()(uint256)', '--rpc-url', $RpcUrl))) '0'

Assert-AddressEquals 'Oracle owner' (Invoke-Cast @('call', $oracle, 'owner()(address)', '--rpc-url', $RpcUrl)) $safe
Assert-AddressEquals 'Oracle pending owner' (Invoke-Cast @('call', $oracle, 'pendingOwner()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-AddressEquals 'Oracle pair' (Invoke-Cast @('call', $oracle, 'pair()(address)', '--rpc-url', $RpcUrl)) $testPair
Assert-ScalarEquals 'Oracle period' (Convert-CastUint (Invoke-Cast @('call', $oracle, 'PERIOD()(uint32)', '--rpc-url', $RpcUrl))) $periodSeconds
Assert-ScalarEquals 'Oracle minimum period' (Convert-CastUint (Invoke-Cast @('call', $oracle, 'MIN_PERIOD()(uint32)', '--rpc-url', $RpcUrl))) $periodSeconds
Assert-ScalarEquals 'Oracle max-window multiple' (Convert-CastUint (Invoke-Cast @('call', $oracle, 'MAX_WINDOW_MULT()(uint32)', '--rpc-url', $RpcUrl))) '4'
Assert-ScalarEquals 'Oracle OMR orientation' (Invoke-Cast @('call', $oracle, 'omrIsToken1()(bool)', '--rpc-url', $RpcUrl)) 'false'
Assert-ScalarEquals 'Oracle initial average' (Convert-CastUint (Invoke-Cast @('call', $oracle, 'priceAverage()(uint224)', '--rpc-url', $RpcUrl))) '0'
Assert-ScalarEquals 'Oracle initial last update' (Convert-CastUint (Invoke-Cast @('call', $oracle, 'lastUpdate()(uint256)', '--rpc-url', $RpcUrl))) '0'
$consult = Convert-CastTupleUints (Invoke-Cast @('call', $oracle, 'consult()(uint256,uint256)', '--rpc-url', $RpcUrl)) 2
Assert-ScalarEquals 'Oracle initial consult price' ([string]$consult[0]) '0'
Assert-ScalarEquals 'Oracle initial consult timestamp' ([string]$consult[1]) '0'
Assert-AddressEquals 'OmertaBond oracle after rehearsal' (Invoke-Cast @('call', $bond, 'oracle()(address)', '--rpc-url', $RpcUrl)) $zero

$endingNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($endingNonce -ne $expectedEndingNonce) {
    throw "Broadcaster nonce is $endingNonce after deployment; expected $expectedEndingNonce."
}

$resultRows = foreach ($name in $expectedContracts) {
    $address = $predicted[$name]
    $receipt = $receiptByAddress[$address.ToLowerInvariant()]
    [pscustomobject]@{
        Contract = $name
        Address = $address
        TransactionHash = $receipt.transactionHash
        BlockNumber = Convert-QuantityToInt64 ([string]$receipt.blockNumber)
    }
}

Write-Host ''
Write-Host 'Testnet TWAP dependencies and oracle deployed and verified. The first 600-second window is still open.'
Write-Host 'OmertaBond remains disconnected; this virtual feed is never production-eligible.'
Write-Host (($resultRows | Format-Table -AutoSize | Out-String).TrimEnd())
Write-Host ''
Write-Host "TWAP_TESTWETH=$testWeth"
Write-Host "TWAP_TESTPAIR=$testPair"
Write-Host "TWAP_ORACLE=$oracle"
Write-Host 'Paste the table and TWAP_ lines into Codex so the manifest can be finalized and the first window can be closed.'
