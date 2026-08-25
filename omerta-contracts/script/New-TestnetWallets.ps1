[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$cast = Join-Path $contractsRoot 'cache\verify\node_modules\@foundry-rs\cast-win32-amd64\bin\cast.exe'
$keystoreDir = Join-Path $contractsRoot 'keystores-testnet'

if (-not (Test-Path -LiteralPath $cast -PathType Leaf)) {
    throw "cast.exe is missing at $cast. Install Foundry or restore the repository's verification cache first."
}

if (Test-Path -LiteralPath $keystoreDir) {
    $existing = @(Get-ChildItem -LiteralPath $keystoreDir -Force)
    if ($existing.Count -ne 0) {
        throw "Refusing to overwrite existing testnet keystores in $keystoreDir"
    }
} else {
    New-Item -ItemType Directory -Path $keystoreDir | Out-Null
}

$passwordA = Read-Host 'Choose one strong password for the four encrypted TESTNET keystores' -AsSecureString
$passwordB = Read-Host 'Confirm the password' -AsSecureString
$plainA = [System.Net.NetworkCredential]::new('', $passwordA).Password
$plainB = [System.Net.NetworkCredential]::new('', $passwordB).Password

if ($plainA -cne $plainB) {
    throw 'Passwords did not match. No wallets were created.'
}
if ($plainA.Length -lt 12) {
    throw 'Use a password of at least 12 characters. No wallets were created.'
}

$accounts = [ordered]@{
    'omerta-deployer-owner-1' = 'Safe owner 1 + deployment broadcaster'
    'omerta-owner-2' = 'Safe owner 2 + testnet Vig recipient'
    'omerta-owner-3' = 'Safe owner 3'
    'omerta-voucher-signer' = 'Dedicated EIP-712 voucher signer'
}

$rows = @()
try {
    # cast accepts CAST_PASSWORD for keystore creation. It is process-local and removed below.
    $env:CAST_PASSWORD = $plainA
    foreach ($account in $accounts.GetEnumerator()) {
        $path = Join-Path $keystoreDir $account.Key
        & $cast wallet new $keystoreDir $account.Key --quiet
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
            throw "Failed to create encrypted keystore $($account.Key)"
        }

        $address = (& $cast wallet address --keystore $path --password $plainA).Trim()
        if ($LASTEXITCODE -ne 0 -or $address -notmatch '^0x[0-9a-fA-F]{40}$') {
            throw "Failed to derive public address for $($account.Key)"
        }

        $rows += [pscustomobject]@{
            Account = $account.Key
            Role = $account.Value
            Address = $address
        }
    }
} finally {
    Remove-Item Env:CAST_PASSWORD -ErrorAction SilentlyContinue
    $plainA = $null
    $plainB = $null
}

Write-Host ''
Write-Host 'Encrypted testnet keystores created. Back up this directory and remember the password:'
Write-Host "  $keystoreDir"
Write-Host ''
$publicLines = @($rows | ForEach-Object { "$($_.Account)=$($_.Address)" })
$publicLines | ForEach-Object { Write-Host $_ }

if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
    ($publicLines -join [Environment]::NewLine) | Set-Clipboard
    Write-Host ''
    Write-Host 'The four PUBLIC address lines were copied to your clipboard.'
}
Write-Host 'Paste only those public lines into Codex. Never paste the password or keystore files.'
