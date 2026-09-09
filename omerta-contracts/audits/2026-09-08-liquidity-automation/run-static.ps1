# Run from omerta-contracts. Direct solc avoids Crytic Compile's split Foundry build-info reader.
# A nonzero detector exit is expected; JSON.success, retained diagnostics and triage establish completion.
$ErrorActionPreference = 'Continue'
$env:PATH = 'C:/Users/Jorge/.foundry/bin;' + $env:PATH
$staticOutput = '../output/liquidity-automation/static'
$slitherBinary = 'C:/Users/Jorge/AppData/Local/OmertaSecurityTools/slither-0.11.6/Scripts/slither.exe'
$solcBinary = 'cache/verify/solc-0.8.26.exe'
$targets = @('FeeRevenueRouter','KeeperGasVault','OmertaFees','LiquidityBuybackExecutor','ProtocolLiquidityVault','GenesisLifecycleController','BankBufferVault','OmertaBond','OmertaHook','GenesisProceedsSplitter')
New-Item -ItemType Directory -Force -Path $staticOutput | Out-Null
if (Test-Path -LiteralPath "$staticOutput/slither-runs.json") { throw 'Refusing to overwrite an existing static run.' }
$versions = [ordered]@{ startedAt = [DateTime]::UtcNow.ToString('o'); slither = (& $slitherBinary --version | Out-String).Trim(); solc = (& $solcBinary --version | Out-String).Trim(); sourceCommit = (& git rev-parse HEAD | Out-String).Trim(); sourceStatus = @(& git status --short -- src); compilerSHA256 = (Get-FileHash -LiteralPath $solcBinary -Algorithm SHA256).Hash.ToLower() }
$versions | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$staticOutput/toolchain.json"
$records = @()
foreach ($name in $targets) {
    $json = "$staticOutput/slither-$name.json"
    $log = "$staticOutput/slither-$name.log"
    if (Test-Path -LiteralPath $json) { throw "Refusing to overwrite $json" }
    $viaIr = $name -eq 'ProtocolLiquidityVault'
    $solcArgs = '--optimize --optimize-runs 800 --evm-version cancun'
    # Crytic Compile reads Foundry config even in direct-solc mode; mirror the required profile.
    if ($viaIr) { $solcArgs += ' --via-ir'; $env:FOUNDRY_VIA_IR = 'true' }
    else { $env:FOUNDRY_VIA_IR = 'false' }
    $started = [DateTime]::UtcNow.ToString('o')
    $beforeHash = (Get-FileHash -LiteralPath "src/$name.sol" -Algorithm SHA256).Hash.ToLower()
    & $slitherBinary "src/$name.sol" --compile-force-framework solc --solc $solcBinary --solc-remaps '@openzeppelin/=lib/openzeppelin-contracts/ v4-core/=lib/v4-core/src/ @uniswap/v4-core/=lib/v4-core/ permit2/=lib/permit2/ solmate/=lib/v4-core/lib/solmate/' --solc-args $solcArgs --exclude-dependencies --json $json *> $log
    $scanExit = $LASTEXITCODE
    $scanExit | Set-Content -LiteralPath "$staticOutput/slither-$name.exit"
    $result = if (Test-Path -LiteralPath $json) { Get-Content -LiteralPath $json -Raw | ConvertFrom-Json } else { $null }
    $afterHash = (Get-FileHash -LiteralPath "src/$name.sol" -Algorithm SHA256).Hash.ToLower()
    $records += [ordered]@{ contract = $name; startedAt = $started; finishedAt = [DateTime]::UtcNow.ToString('o'); sourceSHA256 = $beforeHash; sourceUnchangedDuringRun = ($beforeHash -eq $afterHash); exitCode = $scanExit; success = [bool]($result -and $result.success); diagnostics = @($result.results.detectors).Count; json = $json; log = $log; solcArgs = $solcArgs; viaIR = $viaIr }
    $records | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$staticOutput/slither-runs.json"
    Write-Output "$name success=$($result.success) exit=$scanExit diagnostics=$(@($result.results.detectors).Count) sourceUnchanged=$($beforeHash -eq $afterHash)"
}
if (@($records | Where-Object { -not $_.success -or -not $_.sourceUnchangedDuringRun }).Count -ne 0) { exit 1 }
