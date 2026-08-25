Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$utilitiesPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Deploy-Mainnet.Utilities.ps1'
. $utilitiesPath

$failures = @()

function Assert-Equal($Actual, $Expected, [string]$Label) {
    if ($Actual -ne $Expected) { $script:failures += "$Label mismatch: expected $Expected, received $Actual" }
}

function Assert-Throws([scriptblock]$Action, [string]$Label) {
    try {
        & $Action
        $script:failures += "$Label did not throw."
    } catch { }
}

Assert-Equal (Convert-QuantityToInt64 '0xa') 10 'Hex quantity'
Assert-Equal (Convert-QuantityToInt64 '12') 12 'Decimal quantity'
Assert-Equal (Convert-CastUint '1000 [1e3]') '1000' 'Decorated cast uint'
Assert-Throws { Convert-CastUint '1000 wei' | Out-Null } 'Malformed cast uint'
Assert-Throws { Assert-Address 'zero' '0x0000000000000000000000000000000000000000' } 'Zero address'
Assert-Address 'allowed zero' '0x0000000000000000000000000000000000000000' -AllowZero

$valid = @{
    EXPECTED_CHAIN_ID = '4663'
    EXPECTED_SOURCE_COMMIT = 'a' * 40
    EXPECTED_DEPLOYER_NONCE = '0'
    CORE_AUDIT_REPORT_SHA256 = 'b' * 64
    CORE_SIGNER_AUDIT_INCLUDED = 'true'
}
try { Assert-MainnetReleaseConfig $valid } catch { $failures += "Valid release config failed: $($_.Exception.Message)" }

$invalid = $valid.Clone()
$invalid.CORE_SIGNER_AUDIT_INCLUDED = 'false'
Assert-Throws { Assert-MainnetReleaseConfig $invalid } 'Signer audit exclusion'

if ($failures.Count -ne 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host 'DEPLOY_MAINNET_UTILITIES_TESTS_OK'
