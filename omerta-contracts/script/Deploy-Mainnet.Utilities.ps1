function Read-DeployConfig([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Deployment config is missing: $Path"
    }

    $config = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $separator = $trimmed.IndexOf('=')
        if ($separator -lt 1) { continue }
        $config[$trimmed.Substring(0, $separator).Trim()] = $trimmed.Substring($separator + 1).Trim()
    }
    return $config
}

function Assert-ConfigKeys([hashtable]$Config, [string[]]$Keys, [string]$Path) {
    foreach ($key in $Keys) {
        if (-not $Config.ContainsKey($key) -or [string]::IsNullOrWhiteSpace([string]$Config[$key])) {
            throw "Missing $key in $Path"
        }
    }
}

function Import-DeployEnvironment([hashtable]$Config, [string[]]$Keys) {
    foreach ($key in $Keys) {
        [Environment]::SetEnvironmentVariable($key, [string]$Config[$key], 'Process')
    }
}

function Assert-Address([string]$Label, [string]$Address, [switch]$AllowZero) {
    if ($Address -notmatch '^0x[0-9a-fA-F]{40}$') { throw "Invalid $Label address: $Address" }
    if (-not $AllowZero -and $Address -match '^0x0{40}$') { throw "$Label must not be zero." }
}

function Assert-AddressEquals([string]$Label, [string]$Actual, [string]$Expected) {
    if ($Actual -ine $Expected) { throw "$Label mismatch: expected $Expected, received $Actual" }
}

function Assert-ScalarEquals([string]$Label, [string]$Actual, [string]$Expected) {
    if ($Actual -ne $Expected) { throw "$Label mismatch: expected $Expected, received $Actual" }
}

function Convert-QuantityToInt64([string]$Value) {
    if ($Value -match '^0x[0-9a-fA-F]+$') { return [Convert]::ToInt64($Value.Substring(2), 16) }
    if ($Value -match '^[0-9]+$') { return [Int64]::Parse($Value) }
    throw "Invalid integer quantity: $Value"
}

function Convert-CastUint([string]$Value) {
    $trimmed = $Value.Trim()
    if ($trimmed -notmatch '^([0-9]+)(?:\s+\[[^\]]+\])?$') {
        throw "Invalid cast uint output: $Value"
    }
    return [System.Numerics.BigInteger]::Parse($Matches[1]).ToString()
}

function Assert-MainnetReleaseConfig([hashtable]$Config) {
    Assert-ScalarEquals 'Mainnet chain ID' ([string]$Config.EXPECTED_CHAIN_ID) '4663'
    if ([string]$Config.EXPECTED_SOURCE_COMMIT -notmatch '^[0-9a-fA-F]{40}$') {
        throw 'EXPECTED_SOURCE_COMMIT must be the full 40-character release commit.'
    }
    if ([string]$Config.EXPECTED_DEPLOYER_NONCE -notmatch '^[0-9]+$') {
        throw 'EXPECTED_DEPLOYER_NONCE must be an unsigned integer.'
    }
    if ([string]$Config.CORE_AUDIT_REPORT_SHA256 -notmatch '^[0-9a-fA-F]{64}$') {
        throw 'CORE_AUDIT_REPORT_SHA256 must record the reviewed core audit report.'
    }
    Assert-ScalarEquals 'Core signer audit scope' ([string]$Config.CORE_SIGNER_AUDIT_INCLUDED).ToLowerInvariant() 'true'
}

function Assert-FrozenReleaseSource([string]$RepositoryRoot, [string]$ExpectedCommit) {
    $head = (& git -C $RepositoryRoot rev-parse HEAD 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read the release commit.' }
    Assert-ScalarEquals 'Release commit' $head $ExpectedCommit.ToLowerInvariant()

    $status = (& git -C $RepositoryRoot status --porcelain=v1 --untracked-files=all 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect the release working tree.' }
    if ($status) { throw "Mainnet deployment requires a clean release tree:`n$status" }
}

function Invoke-Cast([string]$Cast, [string[]]$Arguments) {
    $output = @(& $Cast @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "cast $($Arguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
    }
    return (($output -join "`n").Trim())
}
