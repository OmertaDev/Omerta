[CmdletBinding()]
param(
  [switch]$ExpectTask0Red,
  [string]$ForgePath = 'forge'
)

$ErrorActionPreference = 'Stop'
$redExitCode = 42
$repo = Split-Path -Parent $PSScriptRoot
$config = Join-Path $repo 'foundry.toml'
$legacyArtifact = Join-Path $repo 'out/AcquisitionVault.sol/AcquisitionVault.json'
$finalArtifacts = @(
  'AcquisitionConstellationFactory.sol/AcquisitionConstellationFactory.json',
  'AcquisitionAuthority.sol/AcquisitionAuthority.json',
  'AcquisitionVaultCore.sol/AcquisitionVaultCore.json',
  'PreVoteBudgetBook.sol/PreVoteBudgetBook.json',
  'AcquisitionIntentExecution.sol/AcquisitionIntentExecution.json',
  'AcquisitionReconciliation.sol/AcquisitionReconciliation.json'
) | ForEach-Object { Join-Path (Join-Path $repo 'out') $_ }

function Fail([string]$Message, [int]$Code = 1) {
  Write-Error $Message
  exit $Code
}

function Byte-Length([string]$Hex) {
  if ([string]::IsNullOrWhiteSpace($Hex) -or -not $Hex.StartsWith('0x')) { Fail 'Malformed artifact bytecode.' }
  return [int](($Hex.Length - 2) / 2)
}

function Scan-Opcodes([string]$Hex) {
  $bytes = [Convert]::FromHexString($Hex.Substring(2))
  $found = [System.Collections.Generic.List[string]]::new()
  for ($i = 0; $i -lt $bytes.Length; $i++) {
    $op = $bytes[$i]
    if ($op -ge 0x60 -and $op -le 0x7f) { $i += ($op - 0x5f); continue }
    switch ($op) { 0xf0 {$found.Add('CREATE')} 0xf1 {$found.Add('CALL')} 0xf2 {$found.Add('CALLCODE')} 0xf4 {$found.Add('DELEGATECALL')} 0xf5 {$found.Add('CREATE2')} 0xfa {$found.Add('STATICCALL')} 0xff {$found.Add('SELFDESTRUCT')} }
  }
  return $found
}

function Strip-SolidityMetadata([string]$Hex) {
  if ($Hex.Length -lt 6) { Fail 'Bytecode too short for Solidity CBOR trailer.' }
  $metadataBytes = [Convert]::ToInt32($Hex.Substring($Hex.Length - 4), 16)
  $removeChars = ($metadataBytes + 2) * 2
  if ($removeChars -ge ($Hex.Length - 2)) { Fail 'Invalid Solidity CBOR trailer length.' }
  return $Hex.Substring(0, $Hex.Length - $removeChars)
}

if (-not (Test-Path -LiteralPath $config -PathType Leaf)) { Fail "Missing foundry config: $config" }
try { $null = & $ForgePath --version } catch { Fail "Forge is unavailable at '$ForgePath'." }
$toml = Get-Content -LiteralPath $config -Raw
if ($toml -notmatch 'solc_version\s*=\s*"0\.8\.26"') { Fail 'Expected solc 0.8.26.' }
if ($toml -notmatch 'optimizer\s*=\s*true') { Fail 'Expected optimizer enabled.' }
if ($toml -notmatch 'optimizer_runs\s*=\s*800') { Fail 'Expected optimizer runs 800.' }
if ($toml -notmatch 'evm_version\s*=\s*"cancun"') { Fail 'Expected Cancun EVM.' }
if (-not (Test-Path -LiteralPath $legacyArtifact -PathType Leaf)) { Fail "Missing Task5 oracle artifact: $legacyArtifact" }

$legacy = Get-Content -LiteralPath $legacyArtifact -Raw | ConvertFrom-Json -Depth 100
$abi = @($legacy.abi)
$functions = @($abi | Where-Object type -eq 'function')
$errors = @($abi | Where-Object type -eq 'error')
$events = @($abi | Where-Object type -eq 'event')
$constructors = @($abi | Where-Object type -eq 'constructor')
if ($functions.Count -ne 67 -or $errors.Count -ne 55 -or $events.Count -ne 21 -or $constructors.Count -ne 1 -or $abi.Count -ne 144) { Fail "Task5 ABI census drift: $($functions.Count)/$($errors.Count)/$($events.Count)/$($constructors.Count)/$($abi.Count)." }
$payable = @($functions | Where-Object stateMutability -eq 'payable')
if ($payable.Count -ne 1 -or $payable[0].name -ne 'depositCanonical') { Fail 'Task5 payable surface drift.' }
if (@($abi | Where-Object { $_.type -eq 'receive' -or $_.type -eq 'fallback' }).Count -ne 0) { Fail 'Task5 receive/fallback drift.' }
if ($constructors[0].stateMutability -ne 'nonpayable') { Fail 'Task5 constructor mutability drift.' }
$runtime = Byte-Length $legacy.deployedBytecode.object
if ($runtime -ne 23212) { Fail "Task5 runtime drift: $runtime." }
$initcode = Byte-Length $legacy.bytecode.object
if ($initcode -ne 25120) { Fail "Task5 initcode drift: $initcode." }
if ($runtime -gt 24576 -or $initcode -gt 49152) { Fail 'Task5 bytecode exceeds frozen limits.' }
$runtimeOps = @(Scan-Opcodes (Strip-SolidityMetadata $legacy.deployedBytecode.object))
foreach ($forbidden in @('CREATE','CALL','CALLCODE','DELEGATECALL','CREATE2','SELFDESTRUCT')) {
  if ($runtimeOps -contains $forbidden) { Fail "Task5 forbidden runtime opcode: $forbidden." }
}
if (@($runtimeOps | Where-Object { $_ -eq 'STATICCALL' }).Count -ne 2) { Fail 'Task5 runtime must contain exactly two executable STATICCALL opcodes.' }

$oldLocation = Get-Location
try {
  Set-Location -LiteralPath $repo
  $layoutText = (& $ForgePath inspect AcquisitionVault storageLayout --json 2>&1) -join "`n"
  if ($LASTEXITCODE -ne 0) { Fail "forge inspect storageLayout failed closed: $layoutText" }
  $layout = $layoutText | ConvertFrom-Json -Depth 100
  $expected = [ordered]@{
    '_nameFallback'='0'; '_versionFallback'='1'; '_owner'='2'; '_pendingOwner'='3'; '_paused'='3';
    'mainOperator'='4'; 'operatorGeneration'='5'; 'outflowNonce'='6'; 'nominationNonce'='7';
    '_pendingMainOperatorNomination'='8'; 'availableWei'='14'; 'unattributedWei'='15';
    'ordinaryReservedWei'='16'; 'reconciliationLiabilityWei'='17'; 'reconciliationBackingWei'='18';
    'accountingSequence'='19'; 'lastObservedBalanceDeficitWei'='20';
    'globalLifetimeCanonicalDepositedWei'='21'; 'ingressProposalNonce'='22'; 'ingressGeneration'='23';
    'activeIngressGeneration'='24'; '_pendingIngressProposal'='25'; '_ingressRecords'='36';
    'ingressLifetimeDepositedWei'='37'; 'ingressEpochDepositedWei'='38'; '_depositRecords'='39'
  }
  foreach ($name in $expected.Keys) {
    $entry = @($layout.storage | Where-Object label -eq $name)
    if ($entry.Count -ne 1 -or [string]$entry[0].slot -ne $expected[$name]) { Fail "Storage layout drift for $name." }
  }
  if ((@($layout.storage | ForEach-Object {[int]$_.slot}) | Measure-Object -Maximum).Maximum -ne 39) { Fail 'Task5 last semantic storage root is not 39.' }
  $guardSource = Get-Content -LiteralPath (Join-Path $repo 'lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol') -Raw
  if ($guardSource -notmatch '0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00') { Fail 'Namespaced ReentrancyGuard slot evidence drift.' }
  $ir = (& $ForgePath inspect AcquisitionVault ir 2>&1) -join "`n"
  if ($LASTEXITCODE -ne 0) { Fail 'forge inspect IR failed closed.' }
  $iro = (& $ForgePath inspect AcquisitionVault irOptimized 2>&1) -join "`n"
  if ($LASTEXITCODE -ne 0) { Fail 'forge inspect optimized IR failed closed.' }
  if ($ir -notmatch 'staticcall\(gas\(\), var_registry_[0-9]+' -or $iro -notmatch 'staticcall\(gas\(\), var_registry,') { Fail 'Task5 constructor Registry STATICCALL posture missing.' }
  foreach ($word in @('delegatecall','callcode','create2','selfdestruct')) {
    if ($ir -match "(?im)\b$word\s*\(") { Fail "Forbidden Task5 IR operation: $word." }
  }
} finally { Set-Location -LiteralPath $oldLocation }

$present = @($finalArtifacts | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
if ($present.Count -eq 0) {
  if ($ExpectTask0Red) { Write-Output 'Task 0 RED verified: exact six final artifacts absent; legacy/self checks passed.'; exit 0 }
  [Console]::Error.WriteLine('Task 0 RED: exact six final artifacts are absent. Re-run with -ExpectTask0Red only at the Task 0 boundary.')
  exit $redExitCode
}
if ($present.Count -ne 6) { Fail "Partial constellation artifact set: $($present.Count) of 6." }
if ($ExpectTask0Red) { Fail '-ExpectTask0Red requires all six final artifacts to be absent.' }

# Task 1 hooks fail closed: exact ABI allowlists, storage-layout ownership, unique topology
# descriptors, source/build-info AST and optimized-IR call inventories, creation/runtime
# opcode separation, dependency attestation, runtime/initcode sizes, and hashes must be
# populated by the Task 1 amendment before this branch may report GREEN.
foreach ($path in $finalArtifacts) {
  $artifact = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json -Depth 100
  if ((Byte-Length $artifact.deployedBytecode.object) -gt 24576) { Fail "Runtime too large: $path" }
  if ((Byte-Length $artifact.bytecode.object) -gt 49152) { Fail "Initcode too large: $path" }
  $bad = @(Scan-Opcodes $artifact.deployedBytecode.object | Where-Object { $_ -in @('CALLCODE','DELEGATECALL','CREATE2','SELFDESTRUCT') })
  if ($bad.Count -ne 0) { Fail "Forbidden runtime opcodes in ${path}: $($bad -join ', ')." }
}
Fail 'Task 1 artifact hooks are intentionally not approved/populated at Task 0.' 43
