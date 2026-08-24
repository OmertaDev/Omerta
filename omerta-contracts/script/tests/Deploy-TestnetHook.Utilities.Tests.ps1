Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$utilitiesPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Deploy-TestnetHook.Utilities.ps1'
$failures = @()

function Assert-Equal($Actual, $Expected, [string]$Label) {
    if ($Actual -ne $Expected) {
        $script:failures += "$Label mismatch: expected $Expected, received $Actual"
    }
}

function Assert-Throws([scriptblock]$Action, [string]$Label) {
    $threw = $false
    try {
        & $Action | Out-Null
    } catch {
        $threw = $true
    }
    if (-not $threw) { $script:failures += "$Label did not throw." }
}

if (-not (Test-Path -LiteralPath $utilitiesPath -PathType Leaf)) {
    $failures += "Test-HookPermissionBits is not defined because $utilitiesPath is missing."
} else {
    . $utilitiesPath

    Assert-Equal (Test-HookPermissionBits `
            -Address '0x9f86fE471EFD6089eeb7b43e008fD7D830f130Cc' `
            -ExpectedFlags 0x30cc) $true 'Mined address flags'
    Assert-Equal (Test-HookPermissionBits `
            -Address '0x9f86fE471EFD6089eeb7b43e008fD7D830f130Cd' `
            -ExpectedFlags 0x30cc) $false 'Neighbor address flags'
    Assert-Throws {
        Test-HookPermissionBits -Address '0x1234' -ExpectedFlags 0x30cc
    } 'Invalid address'
}

if ($failures.Count -ne 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host 'HOOK_UTILITY_TESTS_OK'
