# Direct native-solc scans avoid Crytic Compile's incompatible split Foundry build-info reader.
# Run from omerta-contracts. JSON success and detector records, not exit zero, establish scan completion.
$ErrorActionPreference = 'Continue'
$env:PATH = 'C:/Users/Jorge/.foundry/bin;' + $env:PATH
$outputRoot = '../output/comprehensive-audit'
$viaIr = @('RwaHealthOverlay','AcquisitionConstellationFactory','AcquisitionAuthority','AcquisitionVaultCore','PreVoteBudgetBook','AcquisitionIntentExecution','AcquisitionReconciliation')
$records = @()
foreach ($file in Get-ChildItem -LiteralPath 'src' -Filter '*.sol' | Sort-Object Name) {
    if ($file.BaseName -eq 'IOmrOracle') { continue }
    $name = $file.BaseName
    $json = "$outputRoot/slither-$name-full.json"
    $log = "$outputRoot/slither-$name-full.log"
    if (Test-Path -LiteralPath $json) { throw "Refusing to overwrite $json" }
    $solcArgs = '--optimize --optimize-runs 800 --evm-version cancun'
    # Crytic Compile reloads Foundry config even in direct-solc mode and replaces --solc-args.
    # Expose the same per-target setting through Foundry's environment override as well.
    if ($viaIr -contains $name) { $solcArgs += ' --via-ir'; $env:FOUNDRY_VIA_IR = 'true' }
    else { $env:FOUNDRY_VIA_IR = 'false' }
    $started = [DateTime]::UtcNow.ToString('o')
    & slither "src/$name.sol" --compile-force-framework solc --solc 'cache/verify/solc-0.8.26.exe' --solc-remaps '@openzeppelin/=lib/openzeppelin-contracts/ v4-core/=lib/v4-core/src/ solmate/=lib/v4-core/lib/solmate/' --solc-args $solcArgs --exclude-dependencies --json $json *> $log
    $scanExit = $LASTEXITCODE
    $result = if (Test-Path -LiteralPath $json) { Get-Content -LiteralPath $json -Raw | ConvertFrom-Json } else { $null }
    $records += [ordered]@{ contract = $name; startedAt = $started; finishedAt = [DateTime]::UtcNow.ToString('o'); exitCode = $scanExit; success = ($result -and $result.success); diagnostics = @($result.results.detectors).Count; json = $json; log = $log; solcArgs = $solcArgs }
    $records | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$outputRoot/slither-runs.json"
    Write-Output "$name success=$($result.success) exit=$scanExit diagnostics=$(@($result.results.detectors).Count)"
}
