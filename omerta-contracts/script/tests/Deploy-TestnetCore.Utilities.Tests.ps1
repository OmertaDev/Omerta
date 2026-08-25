Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$utilitiesPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'Deploy-TestnetCore.Utilities.ps1'
$failures = @()

if (-not (Test-Path -LiteralPath $utilitiesPath -PathType Leaf)) {
    $failures += "Convert-CastUint is not defined because $utilitiesPath is missing."
} else {
    . $utilitiesPath

    $decorated = Convert-CastUint '1000000000000000000000 [1e21]'
    if ($decorated -ne '1000000000000000000000') {
        $failures += "Decorated uint was not normalized: $decorated"
    }

    $plain = Convert-CastUint '10'
    if ($plain -ne '10') { $failures += "Plain uint changed: $plain" }

    $rejectedMalformed = $false
    try {
        Convert-CastUint '10 tokens' | Out-Null
    } catch {
        $rejectedMalformed = $true
    }
    if (-not $rejectedMalformed) { $failures += 'Malformed uint was accepted.' }
}

if ($failures.Count -ne 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host 'DEPLOY_TESTNET_CORE_UTILITIES_TESTS_OK'
