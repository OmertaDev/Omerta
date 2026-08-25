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
$envPath = Join-Path $contractsRoot '.env'
$manifestPath = Join-Path $contractsRoot 'deployments\46630\manifest.json'
$deployerKeystore = Join-Path $contractsRoot 'keystores-testnet\omerta-deployer-owner-1'
$utilitiesPath = Join-Path $PSScriptRoot 'Deploy-TestnetCore.Utilities.ps1'

foreach ($path in @($forge, $cast, $solc, $envPath, $manifestPath, $deployerKeystore, $utilitiesPath)) {
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

function Assert-Address([string]$Label, [string]$Address) {
    if ($Address -notmatch '^0x[0-9a-fA-F]{40}$') { throw "Invalid $Label address: $Address" }
}

function Assert-AddressEquals([string]$Label, [string]$Actual, [string]$Expected) {
    if ($Actual -ine $Expected) { throw "$Label mismatch: expected $Expected, received $Actual" }
}

function Assert-ScalarEquals([string]$Label, [string]$Actual, [string]$Expected) {
    if ($Actual -ne $Expected) { throw "$Label mismatch: expected $Expected, received $Actual" }
}

$config = @{}
foreach ($line in Get-Content -LiteralPath $envPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $separator = $trimmed.IndexOf('=')
    if ($separator -lt 1) { continue }
    $config[$trimmed.Substring(0, $separator)] = $trimmed.Substring($separator + 1)
}

foreach ($key in @('EXPECTED_CHAIN_ID', 'SAFE', 'SAFE_OWNERS', 'SAFE_THRESHOLD', 'DEV_WALLET')) {
    if (-not $config.ContainsKey($key) -or -not $config[$key]) { throw "Missing $key in $envPath" }
}
Assert-ScalarEquals 'Configured chain ID' $config.EXPECTED_CHAIN_ID '46630'
foreach ($key in @('SAFE', 'DEV_WALLET')) { Assert-Address $key $config[$key] }

$deployer = [string]$config.DEV_WALLET
$safe = [string]$config.SAFE
$owners = @($config.SAFE_OWNERS.Split(',') | ForEach-Object { $_.Trim() })
if ($owners.Count -ne 3 -or $config.SAFE_THRESHOLD -ne '2') {
    throw 'This testnet release requires exactly three Safe owners with threshold 2.'
}
foreach ($owner in $owners) { Assert-Address 'Safe owner' $owner }

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
Assert-ScalarEquals 'Manifest chain ID' ([string]$manifest.network.chainId) '46630'
Assert-AddressEquals 'Manifest Safe' ([string]$manifest.governance.safe.address) $safe
Assert-ScalarEquals 'Manifest core status' ([string]$manifest.phases.core.status) 'deployed-verified-dormant'

$chainId = Invoke-Cast @('chain-id', '--rpc-url', $RpcUrl)
Assert-ScalarEquals 'RPC chain ID' $chainId '46630'
$safeCode = Invoke-Cast @('code', $safe, '--rpc-url', $RpcUrl)
if ($safeCode -eq '0x') { throw "Safe has no bytecode: $safe" }
$safeVersion = Invoke-Cast @('call', $safe, 'VERSION()(string)', '--rpc-url', $RpcUrl)
$safeThreshold = Invoke-Cast @('call', $safe, 'getThreshold()(uint256)', '--rpc-url', $RpcUrl)
$safeOwners = (Invoke-Cast @('call', $safe, 'getOwners()(address[])', '--rpc-url', $RpcUrl)).ToLowerInvariant()
if ($safeVersion -notmatch '1\.4\.1') { throw "Unexpected Safe version: $safeVersion" }
Assert-ScalarEquals 'On-chain Safe threshold' $safeThreshold '2'
foreach ($owner in $owners) {
    if (-not $safeOwners.Contains($owner.ToLowerInvariant())) { throw "On-chain Safe owner missing: $owner" }
}

$expectedInitialNonce = 11
$networkNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Deployer nonce is $networkNonce, expected $expectedInitialNonce. Do not rerun after a partial or completed Bank broadcast; inspect broadcast\DeployTestnetBank.s.sol\46630\run-latest.json first."
}

$expectedContracts = @('TestBankAsset', 'TestBankVault', 'Denari', 'Transmuter', 'Alchemist')

Write-Host ''
Write-Host 'Running a fresh, non-broadcast testnet Bank simulation...'
$simulationArguments = @(
    'script', 'script\DeployTestnetBank.s.sol:DeployTestnetBank',
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
    if ($LASTEXITCODE -ne 0) { throw 'Testnet Bank simulation failed; no transaction was sent.' }
} finally {
    Pop-Location
}

$dryRunPath = Join-Path $contractsRoot "broadcast\DeployTestnetBank.s.sol\$chainId\dry-run\run-latest.json"
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
    Assert-Address "$expectedName predicted" $transaction.contractAddress
    Assert-AddressEquals "$expectedName broadcaster" $transaction.transaction.from $deployer
    $nonce = Convert-QuantityToInt64 ([string]$transaction.transaction.nonce)
    if ($nonce -ne ($expectedInitialNonce + $index)) {
        throw "$expectedName nonce mismatch: expected $($expectedInitialNonce + $index), received $nonce."
    }
    $code = Invoke-Cast @('code', $transaction.contractAddress, '--rpc-url', $RpcUrl)
    if ($code -ne '0x') { throw "Predicted $expectedName address is already occupied: $($transaction.contractAddress)" }
    $predicted[$expectedName] = [string]$transaction.contractAddress
    $totalGas += Convert-QuantityToInt64 ([string]$transaction.transaction.gas)
}

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
Write-Host 'TEST-ONLY asset: Test Bank USD (tbUSD), 6 decimals, fixed supply 1,000,000 tbUSD to the Safe'
Write-Host 'Bank activation state: Denari roles, funders, flow caps, reserves, and fee recipient remain OFF/empty'
Write-Host ''
Write-Host (($rows | Format-Table -AutoSize | Out-String).TrimEnd())

if ($PreflightOnly) {
    Write-Host ''
    Write-Host 'BANK_PREFLIGHT_OK=true'
    Write-Host 'No transaction was sent.'
    exit 0
}

Write-Host ''
Write-Warning 'This sends five real testnet transactions. If Foundry stops partway through, do not rerun this script blindly.'
$confirmation = Read-Host 'Type DEPLOY BANK to broadcast the five testnet Bank transactions'
if ($confirmation -cne 'DEPLOY BANK') { throw 'Deployment cancelled; no transaction was sent.' }

$networkNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Deployer nonce changed to $networkNonce after simulation; no transaction was sent."
}

Write-Host ''
Write-Host 'Foundry will prompt for the TESTNET keystore password. The password is not stored by this script.'
$broadcastArguments = @(
    'script', 'script\DeployTestnetBank.s.sol:DeployTestnetBank',
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
        throw 'Bank broadcast did not complete. Do not rerun; inspect the Foundry broadcast record and on-chain nonce first.'
    }
} finally {
    Pop-Location
}

$broadcastPath = Join-Path $contractsRoot "broadcast\DeployTestnetBank.s.sol\$chainId\run-latest.json"
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
        throw "A Bank receipt did not succeed: $($receipt.transactionHash)"
    }
    if ($receipt.contractAddress) { $receiptByAddress[$receipt.contractAddress.ToLowerInvariant()] = $receipt }
}

foreach ($name in $expectedContracts) {
    $address = $predicted[$name]
    $code = Invoke-Cast @('code', $address, '--rpc-url', $RpcUrl)
    if ($code -eq '0x') { throw "$name has no bytecode after broadcast: $address" }
    if (-not $receiptByAddress.ContainsKey($address.ToLowerInvariant())) {
        throw "$name has no matching deployment receipt: $address"
    }
}

$zero = '0x0000000000000000000000000000000000000000'
foreach ($name in @('Denari', 'Transmuter', 'Alchemist')) {
    Assert-AddressEquals "$name owner" (Invoke-Cast @('call', $predicted[$name], 'owner()(address)', '--rpc-url', $RpcUrl)) $safe
}
Assert-ScalarEquals 'TestBankAsset decimals' (Convert-CastUint (Invoke-Cast @('call', $predicted.TestBankAsset, 'decimals()(uint8)', '--rpc-url', $RpcUrl))) '6'
Assert-ScalarEquals 'TestBankAsset total supply' (Convert-CastUint (Invoke-Cast @('call', $predicted.TestBankAsset, 'totalSupply()(uint256)', '--rpc-url', $RpcUrl))) '1000000000000'
Assert-ScalarEquals 'Safe test-asset balance' (Convert-CastUint (Invoke-Cast @('call', $predicted.TestBankAsset, 'balanceOf(address)(uint256)', $safe, '--rpc-url', $RpcUrl))) '1000000000000'
Assert-AddressEquals 'TestBankVault asset' (Invoke-Cast @('call', $predicted.TestBankVault, 'asset()(address)', '--rpc-url', $RpcUrl)) $predicted.TestBankAsset
Assert-ScalarEquals 'TestBankVault total assets' (Convert-CastUint (Invoke-Cast @('call', $predicted.TestBankVault, 'totalAssets()(uint256)', '--rpc-url', $RpcUrl))) '0'
Assert-AddressEquals 'Denari minter' (Invoke-Cast @('call', $predicted.Denari, 'minter()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-AddressEquals 'Denari burner' (Invoke-Cast @('call', $predicted.Denari, 'burner()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-ScalarEquals 'Denari total supply' (Convert-CastUint (Invoke-Cast @('call', $predicted.Denari, 'totalSupply()(uint256)', '--rpc-url', $RpcUrl))) '0'
Assert-AddressEquals 'Transmuter debt token' (Invoke-Cast @('call', $predicted.Transmuter, 'debtToken()(address)', '--rpc-url', $RpcUrl)) $predicted.Denari
Assert-AddressEquals 'Transmuter asset' (Invoke-Cast @('call', $predicted.Transmuter, 'asset()(address)', '--rpc-url', $RpcUrl)) $predicted.TestBankAsset
Assert-ScalarEquals 'Transmuter scale' (Convert-CastUint (Invoke-Cast @('call', $predicted.Transmuter, 'scale()(uint256)', '--rpc-url', $RpcUrl))) '1000000000000'
Assert-ScalarEquals 'Transmuter reserves' (Convert-CastUint (Invoke-Cast @('call', $predicted.Transmuter, 'reserves()(uint256)', '--rpc-url', $RpcUrl))) '0'
Assert-ScalarEquals 'Transmuter per-block cap' (Convert-CastUint (Invoke-Cast @('call', $predicted.Transmuter, 'redeemPerBlockCap()(uint256)', '--rpc-url', $RpcUrl))) '0'
Assert-ScalarEquals 'Transmuter per-day cap' (Convert-CastUint (Invoke-Cast @('call', $predicted.Transmuter, 'redeemPerDayCap()(uint256)', '--rpc-url', $RpcUrl))) '0'
Assert-ScalarEquals 'Safe funder' (Invoke-Cast @('call', $predicted.Transmuter, 'funder(address)(bool)', $safe, '--rpc-url', $RpcUrl)) 'false'
Assert-ScalarEquals 'Alchemist funder' (Invoke-Cast @('call', $predicted.Transmuter, 'funder(address)(bool)', $predicted.Alchemist, '--rpc-url', $RpcUrl)) 'false'
Assert-AddressEquals 'Alchemist debt token' (Invoke-Cast @('call', $predicted.Alchemist, 'debtToken()(address)', '--rpc-url', $RpcUrl)) $predicted.Denari
Assert-AddressEquals 'Alchemist asset' (Invoke-Cast @('call', $predicted.Alchemist, 'asset()(address)', '--rpc-url', $RpcUrl)) $predicted.TestBankAsset
Assert-AddressEquals 'Alchemist vault' (Invoke-Cast @('call', $predicted.Alchemist, 'vault()(address)', '--rpc-url', $RpcUrl)) $predicted.TestBankVault
Assert-AddressEquals 'Alchemist Transmuter' (Invoke-Cast @('call', $predicted.Alchemist, 'transmuter()(address)', '--rpc-url', $RpcUrl)) $predicted.Transmuter
Assert-ScalarEquals 'Alchemist scale' (Convert-CastUint (Invoke-Cast @('call', $predicted.Alchemist, 'scale()(uint256)', '--rpc-url', $RpcUrl))) '1000000000000'
Assert-AddressEquals 'Alchemist fee recipient' (Invoke-Cast @('call', $predicted.Alchemist, 'feeRecipient()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-ScalarEquals 'Alchemist per-block cap' (Convert-CastUint (Invoke-Cast @('call', $predicted.Alchemist, 'mintPerBlockCap()(uint256)', '--rpc-url', $RpcUrl))) '0'
Assert-ScalarEquals 'Alchemist per-day cap' (Convert-CastUint (Invoke-Cast @('call', $predicted.Alchemist, 'mintPerDayCap()(uint256)', '--rpc-url', $RpcUrl))) '0'

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
Write-Host 'Testnet Bank deployed and verified. All Bank roles and funding remain OFF/empty.'
Write-Host (($resultRows | Format-Table -AutoSize | Out-String).TrimEnd())
Write-Host ''
foreach ($row in $resultRows) { Write-Host "BANK_$($row.Contract.ToUpperInvariant())=$($row.Address)" }
Write-Host 'Paste the table and BANK_ lines into Codex so the manifest can be finalized.'
