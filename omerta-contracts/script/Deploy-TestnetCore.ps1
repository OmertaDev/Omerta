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
    if ($Value -match '^0x[0-9a-fA-F]+$') {
        return [Convert]::ToInt64($Value.Substring(2), 16)
    }
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

$requiredKeys = @(
    'EXPECTED_CHAIN_ID', 'SAFE', 'SAFE_OWNERS', 'SAFE_THRESHOLD', 'SIGNER',
    'DEV_WALLET', 'VIG_WALLET', 'POL_WALLET', 'DAILY_CAP_OMR', 'BASE_URI',
    'STAKING_APY_BPS', 'VIG_BPS', 'MINT_FEE_WEI', 'RESPAWN_FEE_WEI',
    'DEED_DAILY_MINT_CAP', 'DYNASTY_DAILY_MINT_CAP', 'DYNASTY_ROYALTY_BPS',
    'STOCK_DEFAULT_DAILY_CAP', 'BOND_POL_BPS', 'BOND_DEV_BPS', 'BOND_RWA_BPS',
    'BOND_VIG_BPS', 'BOND_DAILY_CAP_OMR', 'BOND_MAX_OMR_PER_ETH',
    'GENESIS_PRICE_OMR_PER_ETH', 'GENESIS_VALID_UNTIL', 'DEED_IMAGE_BASE',
    'DEED_EXTERNAL_BASE', 'DYNASTY_BASE_URI'
)
foreach ($key in $requiredKeys) {
    if (-not $config.ContainsKey($key) -or -not $config[$key]) {
        throw "Missing $key in $envPath"
    }
}

$conservativeProfile = [ordered]@{
    EXPECTED_CHAIN_ID = '46630'
    DAILY_CAP_OMR = '1000000000000000000000'
    STAKING_APY_BPS = '1400'
    VIG_BPS = '2500'
    MINT_FEE_WEI = '10000000000000000'
    RESPAWN_FEE_WEI = '100000000000000000'
    DEED_DAILY_MINT_CAP = '10'
    DYNASTY_DAILY_MINT_CAP = '10'
    DYNASTY_ROYALTY_BPS = '500'
    STOCK_DEFAULT_DAILY_CAP = '1'
    BOND_POL_BPS = '7500'
    BOND_DEV_BPS = '1500'
    BOND_RWA_BPS = '500'
    BOND_VIG_BPS = '500'
    BOND_DAILY_CAP_OMR = '1000000000000000000000'
    BOND_MAX_OMR_PER_ETH = '15000000000000000000000'
    GENESIS_PRICE_OMR_PER_ETH = '0'
    GENESIS_VALID_UNTIL = '0'
}
foreach ($entry in $conservativeProfile.GetEnumerator()) {
    Assert-ScalarEquals "Conservative profile $($entry.Key)" $config[$entry.Key] $entry.Value
}

foreach ($key in @('SAFE', 'SIGNER', 'DEV_WALLET', 'VIG_WALLET', 'POL_WALLET')) {
    Assert-Address $key $config[$key]
}
if ($config.SIGNER -ieq $config.SAFE) { throw 'SIGNER must remain separate from the Safe.' }
if ($config.VIG_WALLET -ieq $config.SAFE) { throw 'VIG_WALLET must remain separate from the Safe.' }
if ($config.POL_WALLET -ine $config.SAFE) { throw 'The conservative testnet profile requires POL_WALLET to equal SAFE.' }

$deployer = [string]$config.DEV_WALLET
Assert-Address 'deployer' $deployer

$owners = @($config.SAFE_OWNERS.Split(',') | ForEach-Object { $_.Trim() })
if ($owners.Count -ne 3 -or $config.SAFE_THRESHOLD -ne '2') {
    throw 'This testnet release requires exactly three Safe owners with threshold 2.'
}
foreach ($owner in $owners) { Assert-Address 'Safe owner' $owner }
if (-not ($owners | Where-Object { $_ -ieq $deployer })) {
    throw "Deployer $deployer is not a configured Safe owner."
}
if ($owners | Where-Object { $_ -ieq $config.SIGNER }) {
    throw 'The dedicated voucher signer must not also be a Safe owner.'
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
Assert-ScalarEquals 'Manifest chain ID' ([string]$manifest.network.chainId) $config.EXPECTED_CHAIN_ID
Assert-AddressEquals 'Manifest Safe' ([string]$manifest.governance.safe.address) $config.SAFE
Assert-ScalarEquals 'Manifest Safe threshold' ([string]$manifest.governance.safe.threshold) $config.SAFE_THRESHOLD

$chainId = Invoke-Cast @('chain-id', '--rpc-url', $RpcUrl)
Assert-ScalarEquals 'RPC chain ID' $chainId $config.EXPECTED_CHAIN_ID

$safeCode = Invoke-Cast @('code', $config.SAFE, '--rpc-url', $RpcUrl)
if ($safeCode -eq '0x') { throw "Safe has no bytecode: $($config.SAFE)" }
$safeVersion = Invoke-Cast @('call', $config.SAFE, 'VERSION()(string)', '--rpc-url', $RpcUrl)
$safeThreshold = Invoke-Cast @('call', $config.SAFE, 'getThreshold()(uint256)', '--rpc-url', $RpcUrl)
$safeOwners = (Invoke-Cast @('call', $config.SAFE, 'getOwners()(address[])', '--rpc-url', $RpcUrl)).ToLowerInvariant()
if ($safeVersion -notmatch '1\.4\.1') { throw "Unexpected Safe version: $safeVersion" }
Assert-ScalarEquals 'On-chain Safe threshold' $safeThreshold $config.SAFE_THRESHOLD
foreach ($owner in $owners) {
    if (-not $safeOwners.Contains($owner.ToLowerInvariant())) { throw "On-chain Safe owner missing: $owner" }
}

$expectedInitialNonce = 1
$networkNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Deployer nonce is $networkNonce, expected $expectedInitialNonce. Do not rerun after a partial or completed Phase 1 broadcast; inspect broadcast\Deploy.s.sol\46630\run-latest.json first."
}

$expectedContracts = @(
    'OMR', 'GearVault', 'VoucherClaim', 'OMRStaking', 'OmertaFees',
    'StreetDeed', 'DynastyNFT', 'StockVault', 'GenesisOracle', 'OmertaBond'
)

Write-Host ''
Write-Host 'Running a fresh, non-broadcast Phase 1 simulation...'
$simulationArguments = @(
    'script', 'script\Deploy.s.sol:Deploy',
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
    if ($LASTEXITCODE -ne 0) { throw 'Phase 1 simulation failed; no transaction was sent.' }
} finally {
    Pop-Location
}

$dryRunPath = Join-Path $contractsRoot "broadcast\Deploy.s.sol\$chainId\dry-run\run-latest.json"
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
    if ($predicted.Values -contains $transaction.contractAddress) {
        throw "Duplicate predicted contract address: $($transaction.contractAddress)"
    }
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
Write-Host "Safe owner: $($config.SAFE) (v1.4.1, 2 of 3)"
Write-Host "Voucher signer: $($config.SIGNER)"
Write-Host "Gear image base: $($config.BASE_URI)"
Write-Host "Caps: voucher=1000 OMR/day, deed=10/day, dynasty=10/day, stock=1/token/day, bond=1000 OMR/day"
Write-Host 'Genesis oracle: closed (price=0, validUntil=0)'
Write-Host 'Activation state: minters, keeper, bond oracle, and sell tax remain OFF'
Write-Host ''
Write-Host (($rows | Format-Table -AutoSize | Out-String).TrimEnd())

if ($config.BASE_URI -match 'REPLACE') {
    Write-Warning 'Gear metadata uses a testnet placeholder. The Safe must set the pinned image base before any real gear minting.'
}

if ($PreflightOnly) {
    Write-Host ''
    Write-Host 'PREFLIGHT_OK=true'
    Write-Host 'No transaction was sent.'
    exit 0
}

Write-Host ''
Write-Warning 'This sends ten real testnet transactions. If Foundry stops partway through, do not rerun this script blindly.'
$confirmation = Read-Host 'Type DEPLOY CORE to broadcast the ten Phase 1 transactions'
if ($confirmation -cne 'DEPLOY CORE') { throw 'Deployment cancelled; no transaction was sent.' }

$networkNonce = [int](Invoke-Cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Deployer nonce changed to $networkNonce after simulation; no transaction was sent."
}

Write-Host ''
Write-Host 'Foundry will prompt for the TESTNET keystore password. The password is not stored by this script.'
$broadcastArguments = @(
    'script', 'script\Deploy.s.sol:Deploy',
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
        throw 'Phase 1 broadcast did not complete. Do not rerun; inspect the Foundry broadcast record and on-chain nonce first.'
    }
} finally {
    Pop-Location
}

$broadcastPath = Join-Path $contractsRoot "broadcast\Deploy.s.sol\$chainId\run-latest.json"
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
        throw "A Phase 1 receipt did not succeed: $($receipt.transactionHash)"
    }
    if ($receipt.contractAddress) { $receiptByAddress[$receipt.contractAddress.ToLowerInvariant()] = $receipt }
}

foreach ($name in $expectedContracts) {
    $address = $predicted[$name]
    $code = Invoke-Cast @('code', $address, '--rpc-url', $RpcUrl)
    if ($code -eq '0x') { throw "$name has no bytecode after broadcast: $address" }
    $owner = Invoke-Cast @('call', $address, 'owner()(address)', '--rpc-url', $RpcUrl)
    Assert-AddressEquals "$name owner" $owner $config.SAFE
    if (-not $receiptByAddress.ContainsKey($address.ToLowerInvariant())) {
        throw "$name has no matching deployment receipt: $address"
    }
}

$zero = '0x0000000000000000000000000000000000000000'
Assert-AddressEquals 'OMR minter' (Invoke-Cast @('call', $predicted.OMR, 'minter()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-AddressEquals 'GearVault minter' (Invoke-Cast @('call', $predicted.GearVault, 'minter()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-AddressEquals 'StockVault keeper' (Invoke-Cast @('call', $predicted.StockVault, 'keeper()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-AddressEquals 'OmertaBond oracle' (Invoke-Cast @('call', $predicted.OmertaBond, 'oracle()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-ScalarEquals 'VoucherClaim daily cap' (Convert-CastUint (Invoke-Cast @('call', $predicted.VoucherClaim, 'dailyCapOMR()(uint256)', '--rpc-url', $RpcUrl))) $config.DAILY_CAP_OMR
Assert-ScalarEquals 'StreetDeed daily cap' (Convert-CastUint (Invoke-Cast @('call', $predicted.StreetDeed, 'dailyMintCap()(uint256)', '--rpc-url', $RpcUrl))) $config.DEED_DAILY_MINT_CAP
Assert-ScalarEquals 'DynastyNFT daily cap' (Convert-CastUint (Invoke-Cast @('call', $predicted.DynastyNFT, 'dailyMintCap()(uint256)', '--rpc-url', $RpcUrl))) $config.DYNASTY_DAILY_MINT_CAP
Assert-ScalarEquals 'StockVault default cap' (Convert-CastUint (Invoke-Cast @('call', $predicted.StockVault, 'defaultDailyCap()(uint256)', '--rpc-url', $RpcUrl))) $config.STOCK_DEFAULT_DAILY_CAP
Assert-ScalarEquals 'OmertaBond daily cap' (Convert-CastUint (Invoke-Cast @('call', $predicted.OmertaBond, 'dailyCapOMR()(uint256)', '--rpc-url', $RpcUrl))) $config.BOND_DAILY_CAP_OMR
Assert-ScalarEquals 'OmertaBond price ceiling' (Convert-CastUint (Invoke-Cast @('call', $predicted.OmertaBond, 'maxOmrPerEth()(uint256)', '--rpc-url', $RpcUrl))) $config.BOND_MAX_OMR_PER_ETH
Assert-ScalarEquals 'GenesisOracle price' (Convert-CastUint (Invoke-Cast @('call', $predicted.GenesisOracle, 'price()(uint256)', '--rpc-url', $RpcUrl))) '0'
Assert-ScalarEquals 'GenesisOracle validUntil' (Convert-CastUint (Invoke-Cast @('call', $predicted.GenesisOracle, 'validUntil()(uint256)', '--rpc-url', $RpcUrl))) '0'

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
Write-Host 'Phase 1 deployed and verified. Privileged paths remain OFF.'
Write-Host (($resultRows | Format-Table -AutoSize | Out-String).TrimEnd())
Write-Host ''
foreach ($row in $resultRows) {
    Write-Host "CORE_$($row.Contract.ToUpperInvariant())=$($row.Address)"
}
Write-Host 'Paste the table and CORE_ lines into Codex so the signed manifest can be finalized.'
