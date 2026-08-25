[CmdletBinding()]
param(
    [string]$RpcUrl = 'https://rpc.testnet.chain.robinhood.com'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$cast = Join-Path $contractsRoot 'cache\verify\node_modules\@foundry-rs\cast-win32-amd64\bin\cast.exe'
$envPath = Join-Path $contractsRoot '.env'
$deployerKeystore = Join-Path $contractsRoot 'keystores-testnet\omerta-deployer-owner-1'

foreach ($path in @($cast, $envPath, $deployerKeystore)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required file is missing: $path"
    }
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
    'EXPECTED_CHAIN_ID', 'SAFE_SINGLETON', 'SAFE_PROXY_FACTORY', 'SAFE_FALLBACK_HANDLER',
    'SAFE_OWNERS', 'SAFE_THRESHOLD', 'SAFE_SALT_NONCE'
)
foreach ($key in $requiredKeys) {
    if (-not $config.ContainsKey($key) -or -not $config[$key]) {
        throw "Missing $key in $envPath"
    }
}

$chainId = (& $cast chain-id --rpc-url $RpcUrl).Trim()
if ($LASTEXITCODE -ne 0 -or $chainId -ne $config.EXPECTED_CHAIN_ID) {
    throw "RPC chain ID $chainId does not match EXPECTED_CHAIN_ID=$($config.EXPECTED_CHAIN_ID)"
}

$owners = @($config.SAFE_OWNERS.Split(',') | ForEach-Object { $_.Trim() })
$threshold = [int]$config.SAFE_THRESHOLD
if ($owners.Count -ne 3 -or $threshold -ne 2) {
    throw 'This testnet release expects exactly three Safe owners with threshold 2.'
}
foreach ($owner in $owners) {
    if ($owner -notmatch '^0x[0-9a-fA-F]{40}$') { throw "Invalid Safe owner: $owner" }
}

$zero = '0x0000000000000000000000000000000000000000'
$ownersArgument = '[' + ($owners -join ',') + ']'
$initializer = (& $cast calldata 'setup(address[],uint256,address,bytes,address,address,uint256,address)' `
    $ownersArgument $threshold $zero 0x $config.SAFE_FALLBACK_HANDLER $zero 0 $zero).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Failed to encode Safe initializer.' }

$safeAddress = (& $cast call $config.SAFE_PROXY_FACTORY `
    'createProxyWithNonce(address,bytes,uint256)(address)' `
    $config.SAFE_SINGLETON $initializer $config.SAFE_SALT_NONCE --rpc-url $RpcUrl).Trim()
if ($LASTEXITCODE -ne 0 -or $safeAddress -notmatch '^0x[0-9a-fA-F]{40}$') {
    throw 'Failed to derive the counterfactual Safe address.'
}

function Assert-SafeState([string]$Address, [bool]$RequireInitialNonce) {
    $version = (& $cast call $Address 'VERSION()(string)' --rpc-url $RpcUrl).Trim()
    $actualThreshold = (& $cast call $Address 'getThreshold()(uint256)' --rpc-url $RpcUrl).Trim()
    $actualOwners = ((& $cast call $Address 'getOwners()(address[])' --rpc-url $RpcUrl) -join ' ').ToLowerInvariant()
    $actualNonce = (& $cast call $Address 'nonce()(uint256)' --rpc-url $RpcUrl).Trim()

    if ($version -notmatch '1\.4\.1') { throw "Unexpected Safe version: $version" }
    if ($actualThreshold -ne [string]$threshold) { throw "Unexpected Safe threshold: $actualThreshold" }
    foreach ($owner in $owners) {
        if (-not $actualOwners.Contains($owner.ToLowerInvariant())) { throw "Safe owner missing: $owner" }
    }
    if ($RequireInitialNonce -and $actualNonce -ne '0') { throw "Unexpected initial Safe nonce: $actualNonce" }

    Write-Host "Safe verified: $Address"
    Write-Host "Version: $version | Threshold: $actualThreshold | Nonce: $actualNonce"
}

$existingCode = (& $cast code $safeAddress --rpc-url $RpcUrl).Trim()
if ($existingCode -ne '0x') {
    Write-Host "Safe is already deployed at $safeAddress; no transaction will be sent."
    Assert-SafeState $safeAddress $false
    exit 0
}

$deployer = $owners[0]
$balanceWei = [System.Numerics.BigInteger]::Parse((& $cast balance $deployer --rpc-url $RpcUrl).Trim())
$estimatedGas = [System.Numerics.BigInteger]::Parse((& $cast estimate $config.SAFE_PROXY_FACTORY `
    'createProxyWithNonce(address,bytes,uint256)(address)' `
    $config.SAFE_SINGLETON $initializer $config.SAFE_SALT_NONCE --from $deployer --rpc-url $RpcUrl).Trim())
$gasPriceWei = [System.Numerics.BigInteger]::Parse((& $cast gas-price --rpc-url $RpcUrl).Trim())
$minimumWei = $estimatedGas * $gasPriceWei * 2
if ($balanceWei -lt $minimumWei) {
    throw "Broadcaster $deployer needs test ETH. Balance=$balanceWei wei; require at least $minimumWei wei."
}

Write-Host ''
Write-Host "Network: Robinhood Chain Testnet ($chainId)"
Write-Host "Broadcaster: $deployer"
Write-Host "Counterfactual Safe: $safeAddress"
Write-Host "Owners: $($owners -join ', ')"
Write-Host "Threshold: $threshold of $($owners.Count)"
$confirmation = Read-Host 'Type DEPLOY to broadcast this Safe creation transaction'
if ($confirmation -cne 'DEPLOY') { throw 'Deployment cancelled; no transaction was sent.' }

$securePassword = Read-Host 'Enter the TESTNET deployer keystore password' -AsSecureString
$plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
try {
    $keystoreAddress = (& $cast wallet address --keystore $deployerKeystore --password $plainPassword).Trim()
    if ($LASTEXITCODE -ne 0 -or $keystoreAddress -ine $deployer) {
        throw "Keystore address $keystoreAddress does not match broadcaster $deployer"
    }

    & $cast send $config.SAFE_PROXY_FACTORY `
        'createProxyWithNonce(address,bytes,uint256)(address)' `
        $config.SAFE_SINGLETON $initializer $config.SAFE_SALT_NONCE `
        --rpc-url $RpcUrl --keystore $deployerKeystore --password $plainPassword --confirmations 1
    if ($LASTEXITCODE -ne 0) { throw 'Safe deployment transaction failed.' }
} finally {
    $plainPassword = $null
}

$deployedCode = (& $cast code $safeAddress --rpc-url $RpcUrl).Trim()
if ($deployedCode -eq '0x') { throw 'Transaction completed but the predicted Safe has no code.' }
Assert-SafeState $safeAddress $true
Write-Host "SAFE=$safeAddress"
Write-Host 'Paste the SAFE line and transaction hash into Codex.'
