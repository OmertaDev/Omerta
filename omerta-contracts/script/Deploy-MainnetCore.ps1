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
$manifestPath = Join-Path $contractsRoot 'deployments\4663\manifest.json'

foreach ($path in @($forge, $cast, $solc, $utilitiesPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required file is missing: $path" }
}
. $utilitiesPath

$deployKeys = @(
    'EXPECTED_CHAIN_ID', 'SAFE', 'SIGNER', 'DEV_WALLET', 'VIG_WALLET', 'POL_WALLET',
    'DAILY_CAP_OMR', 'STAKING_APY_BPS', 'VIG_BPS', 'MINT_FEE_WEI', 'RESPAWN_FEE_WEI',
    'BASE_URI', 'DEED_IMAGE_BASE', 'DEED_EXTERNAL_BASE', 'DEED_DAILY_MINT_CAP',
    'DYNASTY_BASE_URI', 'DYNASTY_ROYALTY_BPS', 'DYNASTY_DAILY_MINT_CAP',
    'STOCK_DEFAULT_DAILY_CAP', 'BOND_POL_BPS', 'BOND_DEV_BPS', 'BOND_RWA_BPS',
    'BOND_VIG_BPS', 'BOND_DAILY_CAP_OMR', 'BOND_MAX_OMR_PER_ETH',
    'GENESIS_PRICE_OMR_PER_ETH', 'GENESIS_VALID_UNTIL'
)
$requiredKeys = $deployKeys + @(
    'EXPECTED_SOURCE_COMMIT', 'EXPECTED_DEPLOYER_NONCE', 'CORE_AUDIT_REPORT_SHA256',
    'CORE_SIGNER_AUDIT_INCLUDED', 'DEPLOYER', 'SAFE_OWNERS', 'SAFE_THRESHOLD',
    'BANK_ASSET', 'BANK_ERC4626_VAULT', 'OMR_ADDRESS', 'OMR_V2_PAIR'
)
$config = Read-DeployConfig $ConfigPath
Assert-ConfigKeys $config $requiredKeys $ConfigPath
Assert-MainnetReleaseConfig $config
Assert-FrozenReleaseSource $repositoryRoot ([string]$config.EXPECTED_SOURCE_COMMIT)
Import-DeployEnvironment $config $deployKeys

foreach ($key in @('DEPLOYER', 'SAFE', 'SIGNER', 'DEV_WALLET', 'VIG_WALLET', 'POL_WALLET')) {
    Assert-Address $key ([string]$config[$key])
}
if ([string]$config.SIGNER -ieq [string]$config.SAFE) { throw 'SIGNER must remain separate from the Safe.' }
if ([string]$config.VIG_WALLET -ieq [string]$config.SAFE) { throw 'VIG_WALLET must remain separate from the Safe.' }
Assert-AddressEquals 'POL recipient' ([string]$config.POL_WALLET) ([string]$config.SAFE)

$owners = @(([string]$config.SAFE_OWNERS).Split(',') | ForEach-Object { $_.Trim() })
if ($owners.Count -ne 3 -or [string]$config.SAFE_THRESHOLD -ne '2') {
    throw 'Mainnet governance requires exactly three Safe owners with threshold 2.'
}
foreach ($owner in $owners) { Assert-Address 'Safe owner' $owner }
if ($owners | Where-Object { $_ -ieq [string]$config.SIGNER }) {
    throw 'The dedicated voucher signer must not also be a Safe owner.'
}

$zero = '0x0000000000000000000000000000000000000000'
foreach ($key in @('BANK_ASSET', 'BANK_ERC4626_VAULT')) {
    Assert-Address $key ([string]$config[$key]) -AllowZero
    Assert-AddressEquals "$key deferred" ([string]$config[$key]) $zero
}
foreach ($key in @('OMR_ADDRESS', 'OMR_V2_PAIR')) {
    Assert-Address $key ([string]$config[$key]) -AllowZero
    Assert-AddressEquals "$key unset before Phase 1" ([string]$config[$key]) $zero
}
Assert-ScalarEquals 'Closed genesis price' ([string]$config.GENESIS_PRICE_OMR_PER_ETH) '0'
Assert-ScalarEquals 'Closed genesis deadline' ([string]$config.GENESIS_VALID_UNTIL) '0'
if ([string]$config.BASE_URI -notmatch '^ipfs://(?!REPLACE)') {
    throw 'BASE_URI must be the final pinned ipfs:// gear image base, not a placeholder.'
}
foreach ($key in @('DEED_IMAGE_BASE', 'DEED_EXTERNAL_BASE', 'DYNASTY_BASE_URI')) {
    if ([string]$config[$key] -notmatch '^https://') { throw "$key must be an https:// URL." }
}

$conservativeProfile = [ordered]@{
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
}
foreach ($entry in $conservativeProfile.GetEnumerator()) {
    Assert-ScalarEquals "Reviewed first-cut profile $($entry.Key)" ([string]$config[$entry.Key]) $entry.Value
}

$chainId = Invoke-Cast $cast @('chain-id', '--rpc-url', $RpcUrl)
Assert-ScalarEquals 'RPC chain ID' $chainId '4663'
$safeCode = Invoke-Cast $cast @('code', [string]$config.SAFE, '--rpc-url', $RpcUrl)
if ($safeCode -eq '0x') { throw "Safe has no mainnet bytecode: $($config.SAFE)" }
$safeVersion = Invoke-Cast $cast @('call', [string]$config.SAFE, 'VERSION()(string)', '--rpc-url', $RpcUrl)
$safeThreshold = Invoke-Cast $cast @('call', [string]$config.SAFE, 'getThreshold()(uint256)', '--rpc-url', $RpcUrl)
$safeOwners = (Invoke-Cast $cast @('call', [string]$config.SAFE, 'getOwners()(address[])', '--rpc-url', $RpcUrl)).ToLowerInvariant()
if ($safeVersion -notmatch '1\.4\.1') { throw "Unexpected Safe version: $safeVersion" }
Assert-ScalarEquals 'On-chain Safe threshold' $safeThreshold ([string]$config.SAFE_THRESHOLD)
foreach ($owner in $owners) {
    if (-not $safeOwners.Contains($owner.ToLowerInvariant())) { throw "On-chain Safe owner missing: $owner" }
}

if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
    throw "A mainnet deployment manifest already exists. Inspect it instead of rerunning Phase 1: $manifestPath"
}

$deployer = [string]$config.DEPLOYER
$expectedInitialNonce = [int64]$config.EXPECTED_DEPLOYER_NONCE
$networkNonce = [int64](Invoke-Cast $cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Deployer nonce is $networkNonce, expected $expectedInitialNonce. Inspect the mainnet broadcast record before changing the guard."
}

$expectedContracts = @(
    'OMR', 'GearVault', 'VoucherClaim', 'OMRStaking', 'OmertaFees',
    'StreetDeed', 'DynastyNFT', 'StockVault', 'GenesisOracle', 'OmertaBond'
)

Write-Host ''
Write-Host 'Running a fresh, non-broadcast Phase 1 mainnet simulation...'
$simulationArguments = @(
    'script', 'script\Deploy.s.sol:Deploy', '--rpc-url', $RpcUrl,
    '--sender', $deployer, '--use', $solc, '--offline', '--cache-path', 'foundry-cache', '-vv'
)
Push-Location $contractsRoot
try {
    & $forge @simulationArguments
    if ($LASTEXITCODE -ne 0) { throw 'Phase 1 simulation failed; no transaction was sent.' }
} finally { Pop-Location }

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
    Assert-Address "$expectedName predicted" ([string]$transaction.contractAddress)
    Assert-AddressEquals "$expectedName broadcaster" ([string]$transaction.transaction.from) $deployer
    $nonce = Convert-QuantityToInt64 ([string]$transaction.transaction.nonce)
    if ($nonce -ne ($expectedInitialNonce + $index)) {
        throw "$expectedName nonce mismatch: expected $($expectedInitialNonce + $index), received $nonce."
    }
    $code = Invoke-Cast $cast @('code', [string]$transaction.contractAddress, '--rpc-url', $RpcUrl)
    if ($code -ne '0x') { throw "Predicted $expectedName address is occupied: $($transaction.contractAddress)" }
    if ($predicted.Values -contains $transaction.contractAddress) {
        throw "Duplicate predicted contract address: $($transaction.contractAddress)"
    }
    $predicted[$expectedName] = [string]$transaction.contractAddress
    $totalGas += Convert-QuantityToInt64 ([string]$transaction.transaction.gas)
}

[System.Numerics.BigInteger]$balanceWei = Invoke-Cast $cast @('balance', $deployer, '--rpc-url', $RpcUrl)
[System.Numerics.BigInteger]$gasPriceWei = Invoke-Cast $cast @('gas-price', '--rpc-url', $RpcUrl)
[System.Numerics.BigInteger]$estimatedFeeWei = $totalGas * $gasPriceWei
[System.Numerics.BigInteger]$requiredWei = $estimatedFeeWei * 2
if ($balanceWei -lt $requiredWei) {
    throw "Broadcaster needs more mainnet ETH. Balance=$balanceWei wei; buffered requirement=$requiredWei wei."
}

$rows = foreach ($name in $expectedContracts) {
    [pscustomobject]@{ Contract = $name; PredictedAddress = $predicted[$name] }
}
Write-Host ''
Write-Host "Network: Robinhood Chain Mainnet ($chainId)"
Write-Host "Release commit: $($config.EXPECTED_SOURCE_COMMIT)"
Write-Host "Audit report SHA-256: $($config.CORE_AUDIT_REPORT_SHA256)"
Write-Host "Broadcaster: $deployer (nonce $networkNonce)"
Write-Host "Safe: $($config.SAFE) (v1.4.1, 2 of 3)"
Write-Host "Voucher signer: $($config.SIGNER)"
Write-Host "Gear image base: $($config.BASE_URI)"
Write-Host "Buffered gas requirement: $requiredWei wei"
Write-Host 'Genesis window: closed'
Write-Host 'Activation state: minters, keeper, bond oracle, sell tax, Bank, TWAP, and hook remain OFF'
Write-Host ''
Write-Host (($rows | Format-Table -AutoSize | Out-String).TrimEnd())

if (-not $Broadcast) {
    Write-Host ''
    Write-Host 'PREFLIGHT_OK=true'
    Write-Host 'No transaction was sent. Re-run with -Broadcast only after independent trace review.'
    exit 0
}

Write-Warning 'This sends ten irreversible Robinhood Chain mainnet transactions. Never rerun after a partial broadcast.'
$confirmation = Read-Host 'Type DEPLOY MAINNET CORE 4663 to broadcast all ten creations'
if ($confirmation -cne 'DEPLOY MAINNET CORE 4663') { throw 'Deployment cancelled; no transaction was sent.' }
$networkNonce = [int64](Invoke-Cast $cast @('nonce', $deployer, '--rpc-url', $RpcUrl))
if ($networkNonce -ne $expectedInitialNonce) {
    throw "Deployer nonce changed to $networkNonce after simulation; no transaction was sent."
}

$broadcastArguments = @(
    'script', 'script\Deploy.s.sol:Deploy', '--rpc-url', $RpcUrl,
    '--sender', $deployer, '--account', $Account, '--broadcast', '--slow',
    '--use', $solc, '--offline', '--cache-path', 'foundry-cache', '-vvvv'
)
Push-Location $contractsRoot
try {
    & $forge @broadcastArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Phase 1 broadcast did not complete. Do not rerun; inspect the Foundry record and on-chain nonce first.'
    }
} finally { Pop-Location }

$broadcastPath = Join-Path $contractsRoot "broadcast\Deploy.s.sol\$chainId\run-latest.json"
if (-not (Test-Path -LiteralPath $broadcastPath -PathType Leaf)) {
    throw "Broadcast returned without a Foundry record: $broadcastPath"
}
$broadcastRecord = Get-Content -LiteralPath $broadcastPath -Raw | ConvertFrom-Json
$broadcastTransactions = @($broadcastRecord.transactions)
$receipts = @($broadcastRecord.receipts)
if ($broadcastTransactions.Count -ne $expectedContracts.Count -or $receipts.Count -ne $expectedContracts.Count) {
    throw "Broadcast record is incomplete: transactions=$($broadcastTransactions.Count), receipts=$($receipts.Count)."
}

$receiptByAddress = @{}
foreach ($receipt in $receipts) {
    if ([string]$receipt.status -notin @('0x1', '1')) {
        throw "A Phase 1 receipt did not succeed: $($receipt.transactionHash)"
    }
    if ($receipt.contractAddress) { $receiptByAddress[$receipt.contractAddress.ToLowerInvariant()] = $receipt }
}

foreach ($name in $expectedContracts) {
    $address = $predicted[$name]
    $code = Invoke-Cast $cast @('code', $address, '--rpc-url', $RpcUrl)
    if ($code -eq '0x') { throw "$name has no bytecode after broadcast: $address" }
    $owner = Invoke-Cast $cast @('call', $address, 'owner()(address)', '--rpc-url', $RpcUrl)
    Assert-AddressEquals "$name owner" $owner ([string]$config.SAFE)
    if (-not $receiptByAddress.ContainsKey($address.ToLowerInvariant())) {
        throw "$name has no matching deployment receipt: $address"
    }
}

Assert-AddressEquals 'OMR minter' (Invoke-Cast $cast @('call', $predicted.OMR, 'minter()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-ScalarEquals 'OMR sell tax' (Convert-CastUint (Invoke-Cast $cast @('call', $predicted.OMR, 'sellTaxBps()(uint256)', '--rpc-url', $RpcUrl))) '0'
Assert-AddressEquals 'GearVault minter' (Invoke-Cast $cast @('call', $predicted.GearVault, 'minter()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-AddressEquals 'StockVault keeper' (Invoke-Cast $cast @('call', $predicted.StockVault, 'keeper()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-AddressEquals 'OmertaBond oracle' (Invoke-Cast $cast @('call', $predicted.OmertaBond, 'oracle()(address)', '--rpc-url', $RpcUrl)) $zero
Assert-ScalarEquals 'VoucherClaim daily cap' (Convert-CastUint (Invoke-Cast $cast @('call', $predicted.VoucherClaim, 'dailyCapOMR()(uint256)', '--rpc-url', $RpcUrl))) ([string]$config.DAILY_CAP_OMR)
Assert-ScalarEquals 'StreetDeed daily cap' (Convert-CastUint (Invoke-Cast $cast @('call', $predicted.StreetDeed, 'dailyMintCap()(uint256)', '--rpc-url', $RpcUrl))) ([string]$config.DEED_DAILY_MINT_CAP)
Assert-ScalarEquals 'DynastyNFT daily cap' (Convert-CastUint (Invoke-Cast $cast @('call', $predicted.DynastyNFT, 'dailyMintCap()(uint256)', '--rpc-url', $RpcUrl))) ([string]$config.DYNASTY_DAILY_MINT_CAP)
Assert-ScalarEquals 'StockVault default cap' (Convert-CastUint (Invoke-Cast $cast @('call', $predicted.StockVault, 'defaultDailyCap()(uint256)', '--rpc-url', $RpcUrl))) ([string]$config.STOCK_DEFAULT_DAILY_CAP)
Assert-ScalarEquals 'OmertaBond daily cap' (Convert-CastUint (Invoke-Cast $cast @('call', $predicted.OmertaBond, 'dailyCapOMR()(uint256)', '--rpc-url', $RpcUrl))) ([string]$config.BOND_DAILY_CAP_OMR)
Assert-ScalarEquals 'OmertaBond price ceiling' (Convert-CastUint (Invoke-Cast $cast @('call', $predicted.OmertaBond, 'maxOmrPerEth()(uint256)', '--rpc-url', $RpcUrl))) ([string]$config.BOND_MAX_OMR_PER_ETH)
Assert-AddressEquals 'OmertaBond signer' (Invoke-Cast $cast @('call', $predicted.OmertaBond, 'signer()(address)', '--rpc-url', $RpcUrl)) ([string]$config.SIGNER)
Assert-AddressEquals 'OmertaBond POL recipient' (Invoke-Cast $cast @('call', $predicted.OmertaBond, 'polRecipient()(address)', '--rpc-url', $RpcUrl)) ([string]$config.POL_WALLET)
Assert-AddressEquals 'OmertaBond treasury recipient' (Invoke-Cast $cast @('call', $predicted.OmertaBond, 'rwaRecipient()(address)', '--rpc-url', $RpcUrl)) ([string]$config.SAFE)
Assert-ScalarEquals 'GenesisOracle price' (Convert-CastUint (Invoke-Cast $cast @('call', $predicted.GenesisOracle, 'price()(uint256)', '--rpc-url', $RpcUrl))) '0'
Assert-ScalarEquals 'GenesisOracle deadline' (Convert-CastUint (Invoke-Cast $cast @('call', $predicted.GenesisOracle, 'validUntil()(uint256)', '--rpc-url', $RpcUrl))) '0'

$resultRows = foreach ($name in $expectedContracts) {
    $address = $predicted[$name]
    $receipt = $receiptByAddress[$address.ToLowerInvariant()]
    [pscustomobject]@{
        Contract = $name
        Address = $address
        TransactionHash = [string]$receipt.transactionHash
        BlockNumber = Convert-QuantityToInt64 ([string]$receipt.blockNumber)
        GasUsed = Convert-QuantityToInt64 ([string]$receipt.gasUsed)
    }
}

$contracts = [ordered]@{}
$transactionRecords = [ordered]@{}
foreach ($row in $resultRows) {
    $contracts[$row.Contract] = $row.Address
    $transactionRecords[$row.Contract] = [ordered]@{
        transactionHash = $row.TransactionHash
        blockNumber = $row.BlockNumber
        gasUsed = [string]$row.GasUsed
    }
}
$manifest = [ordered]@{
    schemaVersion = 1
    status = 'mainnet-core-deployed-rpc-verified-dormant'
    network = [ordered]@{
        name = 'Robinhood Chain Mainnet'
        chainId = 4663
        rpc = 'https://rpc.mainnet.chain.robinhood.com'
        explorer = 'https://robinhoodchain.blockscout.com'
    }
    source = [ordered]@{
        commit = [string]$config.EXPECTED_SOURCE_COMMIT
        solc = '0.8.26'
        forge = '1.7.1'
        optimizerRuns = 800
        evmVersion = 'cancun'
    }
    audit = [ordered]@{
        coreReportSha256 = [string]$config.CORE_AUDIT_REPORT_SHA256
        signerIncluded = $true
        bankScope = 'deferred-pending-audit'
    }
    governance = [ordered]@{
        safe = [ordered]@{ address = [string]$config.SAFE; version = '1.4.1'; owners = $owners; threshold = 2 }
        voucherSigner = [string]$config.SIGNER
        devRecipient = [string]$config.DEV_WALLET
        vigRecipient = [string]$config.VIG_WALLET
        polRecipient = [string]$config.POL_WALLET
    }
    phases = [ordered]@{
        core = [ordered]@{
            status = 'deployed-rpc-verified-dormant-explorer-verification-pending'
            broadcaster = $deployer
            startingNonce = $expectedInitialNonce
            endingNonce = $expectedInitialNonce + $expectedContracts.Count
            contracts = $contracts
            transactions = $transactionRecords
        }
        bank = [ordered]@{ status = 'deferred-pending-audit-and-post-launch-catalyst' }
        twap = [ordered]@{ status = 'deferred-until-canonical-pool-exists' }
        hook = [ordered]@{ status = 'deferred-pending-routing-approval-sequence' }
    }
}
$manifestDirectory = Split-Path -Parent $manifestPath
New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null
$manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $manifestPath -Encoding utf8

Write-Host ''
Write-Host 'Phase 1 deployed and RPC-verified. Every privileged path remains OFF.'
Write-Host (($resultRows | Format-Table -AutoSize | Out-String).TrimEnd())
Write-Host "Manifest written: $manifestPath"
Write-Host 'Next gate: verify all ten contracts on Blockscout, then review and commit the manifest. Do not arm any rail yet.'
