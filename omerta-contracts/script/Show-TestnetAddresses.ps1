[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$contractsRoot = Split-Path -Parent $PSScriptRoot
$cast = Join-Path $contractsRoot 'cache\verify\node_modules\@foundry-rs\cast-win32-amd64\bin\cast.exe'
$keystoreDir = Join-Path $contractsRoot 'keystores-testnet'
$accountNames = @(
    'omerta-deployer-owner-1'
    'omerta-owner-2'
    'omerta-owner-3'
    'omerta-voucher-signer'
)

if (-not (Test-Path -LiteralPath $cast -PathType Leaf)) {
    throw "cast.exe is missing at $cast"
}
foreach ($name in $accountNames) {
    $path = Join-Path $keystoreDir $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing encrypted keystore: $path"
    }
}

$securePassword = Read-Host 'Enter the TESTNET keystore password' -AsSecureString
$plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password

try {
    $publicLines = @(
        foreach ($name in $accountNames) {
            $path = Join-Path $keystoreDir $name
            $address = (& $cast wallet address --keystore $path --password $plainPassword).Trim()
            if ($LASTEXITCODE -ne 0 -or $address -notmatch '^0x[0-9a-fA-F]{40}$') {
                throw "Could not unlock $name. Check the password."
            }
            "$name=$address"
        }
    )
} finally {
    $plainPassword = $null
}

$publicLines | ForEach-Object { Write-Host $_ }
if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
    ($publicLines -join [Environment]::NewLine) | Set-Clipboard
    Write-Host ''
    Write-Host 'Copied the four PUBLIC address lines to your clipboard.'
}
Write-Host 'Paste only those public lines into Codex. Never paste the password or keystore files.'
