$ErrorActionPreference = 'Stop'
$env:PATH = 'C:/Users/Jorge/.foundry/bin;' + $env:PATH
$env:FOUNDRY_VIA_IR = 'false'
$hookRetestRoot = '../output/comprehensive-audit'
$hookRetestJson = "$hookRetestRoot/slither-OmertaHook-after.json"
$hookRetestLog = "$hookRetestRoot/slither-OmertaHook-after.log"
$hookRetestExit = "$hookRetestRoot/slither-OmertaHook-after.exit"
if (Test-Path -LiteralPath $hookRetestJson) { throw "Refusing to overwrite $hookRetestJson" }
$hookRetestStart = [DateTime]::UtcNow.ToString('o')
$hookRetestSolcArgs = '--optimize --optimize-runs 800 --evm-version cancun'
& slither 'src/OmertaHook.sol' --compile-force-framework solc --solc 'cache/verify/solc-0.8.26.exe' --solc-remaps '@openzeppelin/=lib/openzeppelin-contracts/ v4-core/=lib/v4-core/src/ solmate/=lib/v4-core/lib/solmate/' --solc-args $hookRetestSolcArgs --exclude-dependencies --json $hookRetestJson *> $hookRetestLog
$hookRetestCode = $LASTEXITCODE
$hookRetestCode | Set-Content -LiteralPath $hookRetestExit
$hookRetestResult = Get-Content -LiteralPath $hookRetestJson -Raw | ConvertFrom-Json
[ordered]@{
  contract = 'OmertaHook'
  startedAt = $hookRetestStart
  finishedAt = [DateTime]::UtcNow.ToString('o')
  exitCode = $hookRetestCode
  success = $hookRetestResult.success
  diagnostics = @($hookRetestResult.results.detectors).Count
  compilerPath = 'cache/verify/solc-0.8.26.exe'
  solcArgs = $hookRetestSolcArgs
  viaIR = $false
  json = $hookRetestJson
  log = $hookRetestLog
  exit = $hookRetestExit
} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath "$hookRetestRoot/slither-OmertaHook-after-run.json"
Write-Output "OmertaHook retest success=$($hookRetestResult.success) exit=$hookRetestCode diagnostics=$(@($hookRetestResult.results.detectors).Count)"
