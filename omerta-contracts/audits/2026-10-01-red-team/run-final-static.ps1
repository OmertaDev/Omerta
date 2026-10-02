$ErrorActionPreference = 'Stop'
$auditContractRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$auditEvidence = Join-Path $PSScriptRoot 'evidence'
$auditPrevious = Join-Path $auditEvidence 'pre-remediation-static'
New-Item -ItemType Directory -Force $auditPrevious | Out-Null
Get-ChildItem $auditEvidence -File | Where-Object {
    $_.Name -match '^(native|ir)-.*\.(json|txt)$'
} | Copy-Item -Destination $auditPrevious
$env:PATH = 'C:/Users/Jorge/.foundry/bin;' + $env:PATH
$env:FOUNDRY_VIA_IR = 'false'
$auditTargets = Get-ChildItem (Join-Path $auditContractRoot 'src') -Recurse -Filter '*.sol' |
    Where-Object { $_.FullName -notmatch '[\\/]interfaces[\\/]|[\\/]vendor[\\/]' }
$auditTargets | ForEach-Object -Parallel {
    $auditRoot = $using:auditContractRoot
    $auditOut = $using:auditEvidence
    Set-Location $auditRoot
    $auditName = $_.BaseName
    $auditRelative = [IO.Path]::GetRelativePath($auditRoot, $_.FullName)
    $auditJson = Join-Path $auditOut "native-$auditName.json"
    if (Test-Path -LiteralPath $auditJson) { Remove-Item -LiteralPath $auditJson }
    & slither $auditRelative --compile-force-framework solc --solc cache/verify/solc-0.8.26.exe `
        --exclude-dependencies --filter-paths lib --json $auditJson `
        *> (Join-Path $auditOut "native-$auditName.txt")
    $LASTEXITCODE | Set-Content (Join-Path $auditOut "native-$auditName-exit.txt")
} -ThrottleLimit 3
$env:FOUNDRY_VIA_IR = 'true'
$auditIR = @('src/AcquisitionAuthority.sol', 'src/AcquisitionVaultCore.sol',
    'src/ProtocolLiquidityVault.sol', 'src/RwaHealthOverlay.sol',
    'src/market-v2/OmertaGenesisCoordinatorV2.sol')
Set-Location $auditContractRoot
foreach ($auditTarget in $auditIR) {
    $auditName = [IO.Path]::GetFileNameWithoutExtension($auditTarget)
    $auditJson = Join-Path $auditEvidence "ir-$auditName.json"
    if (Test-Path -LiteralPath $auditJson) { Remove-Item -LiteralPath $auditJson }
    & slither $auditTarget --compile-force-framework solc --solc cache/verify/solc-0.8.26.exe `
        --exclude-dependencies --filter-paths lib --json $auditJson `
        *> (Join-Path $auditEvidence "ir-$auditName.txt")
    $LASTEXITCODE | Set-Content (Join-Path $auditEvidence "ir-$auditName-exit.txt")
}
Set-Location (Split-Path $auditContractRoot -Parent)
& node (Join-Path $PSScriptRoot 'build-static-triage.mjs')
