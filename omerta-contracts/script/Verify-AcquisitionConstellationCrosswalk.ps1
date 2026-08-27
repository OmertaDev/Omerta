[CmdletBinding()]
param(
  [switch]$ExpectTask0Red,
  [string]$ForgePath = 'forge',
  [string]$NodePath = 'node'
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

$stableRowsText = @'
F|1|MOVE|1|owner()
F|2|MOVE|1|pendingOwner()
F|3|MOVE|1|transferOwnership(address)
F|4|MOVE|1|acceptOwnership()
F|5|MOVE|1|renounceOwnership()
F|6|MOVE|1|paused()
F|7|MOVE|1|eip712Domain()
F|8|MOVE|1|supportedChainId()
F|9|MOVE|1|OPERATOR_NOMINATION_DELAY()
F|10|MOVE|1|OPERATOR_ACCEPTANCE_WINDOW()
F|11|MOVE|1|INGRESS_PROPOSAL_DELAY()
F|12|MOVE|1|INGRESS_ACCEPTANCE_WINDOW()
F|13|MOVE|1|MAX_AUTHORIZATION_LIFETIME()
F|14|MOVE|1|MAX_SIGNATURE_BYTES()
F|15|MOVE|1|ERC1271_CALL_GAS()
F|16|MOVE|1|ERC1271_POST_CALL_GAS_RESERVE()
F|17|MOVE|1|ERC1271_MIN_PRECALL_GAS()
F|18|MOVE|1|OUTFLOW_AUTHORIZATION_TYPEHASH()
F|19|MOVE|1|SUCCESSOR_CONSENT_TYPEHASH()
F|20|MOVE|1|version()
F|21|MOVE|1|mainOperator()
F|22|MOVE|1|operatorGeneration()
F|23|MOVE|1|outflowNonce()
F|24|MOVE|1|nominationNonce()
F|25|MOVE|1|pendingMainOperatorNomination()
F|26|MOVE|1|nominateMainOperator(address,bytes32)
F|27|MOVE|1|cancelMainOperatorNomination(bytes32,bytes32)
F|28|MOVE|1|expireMainOperatorNomination(bytes32)
F|29|MOVE|1|acceptMainOperatorNomination(bytes32)
F|30|MOVE|1|disableMainOperator(bytes32)
F|31|MOVE|1|renounceMainOperator(bytes32)
F|32|MOVE|1|replaceMainOperator((address,address,uint256,uint256,uint64,uint64,uint8,bytes32),bytes)
F|33|MOVE|1|invalidateOutflowNonce(uint256,bytes32)
F|34|MOVE|1|pause(bytes32)
F|35|MOVE|1|unpause(bytes32)
F|36|MOVE|1|hashOutflowAuthorization((address,address,uint256,uint256,uint256,uint64,uint64,uint8,bytes32))
F|37|MOVE|1|hashSuccessorConsent((address,address,uint256,uint256,uint64,uint64,uint8,bytes32))
F|38|MOVE|1|ingressProposalNonce()
F|39|MOVE|1|ingressGeneration()
F|40|MOVE|1|activeIngressGeneration()
F|41|MOVE|1|pendingIngressProposal()
F|42|MOVE|1|getIngress(uint256)
F|43|MOVE|1|proposeIngress((address,bytes32,uint256,uint256,uint256),bytes32)
F|44|MOVE|1|cancelIngressProposal(bytes32,bytes32)
F|45|MOVE|1|expireIngressProposal(bytes32)
F|46|MOVE|1|activateIngress(bytes32)
F|47|MOVE|1|disableIngress(bytes32)
F|48|MOVE|2|MAX_ACTIVE_ORDINARY_RESERVATIONS()
F|49|MOVE|2|MAX_ACTIVE_RECONCILIATIONS()
F|50|MOVE|2|MAX_OPERATOR_OUTFLOW_COMPONENTS()
F|51|MOVE|2|stockTokenRegistryV2()
F|52|MOVE|2|globalLifetimeCanonicalDepositCapWei()
F|53|MOVE|2|availableWei()
F|54|MOVE|2|unattributedWei()
F|55|MOVE|2|ordinaryReservedWei()
F|56|MOVE|2|reconciliationLiabilityWei()
F|57|MOVE|2|reconciliationBackingWei()
F|58|MOVE|2|accountingSequence()
F|59|MOVE|2|lastObservedBalanceDeficitWei()
F|60|MOVE|2|accountingTotals()
F|61|MOVE|2|syncBalance()
F|62|MOVE|2|reclassifyUnattributed(uint256,bytes32)
F|63|MOVE|2|globalLifetimeCanonicalDepositedWei()
F|64|MOVE|2|ingressLifetimeDepositedWei(uint256)
F|65|MOVE|2|ingressEpochDepositedWei(uint256,uint256)
F|66|MOVE|2|getDeposit(bytes32)
F|67|MOVE|2|depositCanonical(bytes32)
ER|1|MOVE|0|WrongChain(uint256)
ER|2|MOVE|0|RegistryChainMismatch(uint256)
ER|3|MOVE|1|ZeroAddress()
ER|4|MOVE|1|ContractRequired(address)
ER|5|MOVE|1|RoleIdentityCollision(address)
ER|6|MOVE|1|OwnershipRenunciationDisabled()
ER|7|MOVE|1|NoPendingOwnershipTransfer()
ER|8|MOVE|1|EmptyDetailsHash()
ER|9|MOVE|1|InvalidActionReason(uint8)
ER|10|MOVE|1|CounterExhausted(bytes32)
ER|11|MOVE|1|TimestampOverflow()
ER|12|MOVE|1|MainOperatorActive(address)
ER|13|MOVE|1|NoMainOperator()
ER|14|MOVE|1|OperatorNominationPending(bytes32)
ER|15|MOVE|1|OperatorNominationMissing()
ER|16|MOVE|1|ProposalIdMismatch(bytes32,bytes32)
ER|17|MOVE|1|NotNominee(address)
ER|18|MOVE|1|ProposalNotReady(uint64)
ER|19|MOVE|1|ProposalExpired(uint64)
ER|20|MOVE|1|NoOperatorStateChange()
ER|21|MOVE|1|InvalidOperatorReplacement()
ER|22|MOVE|1|InvalidOutflowNonceStep(uint256,uint256)
ER|23|MOVE|1|OutflowNonceExhausted(uint256)
ER|24|MOVE|1|InvalidAuthorizationWindow()
ER|25|MOVE|1|AuthorizationNotYetValid()
ER|26|MOVE|1|AuthorizationExpired()
ER|27|MOVE|1|InvalidAuthorizationFields()
ER|28|MOVE|1|InvalidSignature()
ER|29|MOVE|1|InsufficientSignatureValidationGas()
ER|30|MOVE|1|LocalReadinessFailed(uint8)
ER|31|MOVE|1|IngressProposalPending(bytes32)
ER|32|MOVE|1|IngressProposalMissing()
ER|33|MOVE|1|InvalidIngressConfig()
ER|34|MOVE|1|IngressCodeHashMismatch(address,bytes32,bytes32)
ER|35|MOVE|1|IngressActive(address)
ER|36|MOVE|1|NoActiveIngress()
ER|37|MOVE|1|IngressNotFound(uint256)
ER|38|MOVE|2|InvalidGlobalLifetimeCap()
ER|39|MOVE|2|NoBalanceDelta()
ER|40|MOVE|2|InvalidAmount()
ER|41|MOVE|2|InsufficientUnattributed(uint256,uint256)
ER|42|MOVE|2|BalanceDeficitActive(uint256)
ER|43|MOVE|2|ReconciliationShortfallActive(uint256)
ER|44|MOVE|2|NotActiveIngress(address)
ER|45|MOVE|2|DepositSourceRequired()
ER|46|MOVE|2|DepositReplay(bytes32)
ER|47|MOVE|2|DepositCapExceeded(uint8,uint256,uint256)
ER|48|MOVE|2|DepositNotFound(bytes32)
ER|49|INHERITED|1|OwnableUnauthorizedAccount(address)
ER|50|INHERITED|1|OwnableInvalidOwner(address)
ER|51|INHERITED|1|EnforcedPause()
ER|52|INHERITED|1|ExpectedPause()
ER|53|INHERITED|1|InvalidShortString()
ER|54|INHERITED|1|StringTooLong(string)
ER|55|INHERITED|1|ReentrancyGuardReentrantCall()
EV|1|MOVE|1|MainOperatorNominationCreated(bytes32,address,address,uint256,uint64,uint64,uint64,uint8,bytes32)
EV|2|MOVE|1|MainOperatorNominationCancelled(bytes32,address,address,uint8,bytes32)
EV|3|MOVE|1|MainOperatorNominationExpired(bytes32,address,address,uint8,bytes32)
EV|4|MOVE|1|MainOperatorChanged(address,address,uint256,uint256,uint8,bytes32)
EV|5|MOVE|1|OutflowNonceInvalidated(address,uint256,uint256,uint256,uint8,bytes32)
EV|6|MOVE|1|RiskPaused(address,uint8,bytes32)
EV|7|MOVE|1|RiskUnpaused(address,uint8,bytes32)
EV|8|MOVE|1|IngressProposalCreated(bytes32,address,address,uint256,bytes32,uint64,uint64,uint64,uint8,bytes32)
EV|9|MOVE|1|IngressProposalCancelled(bytes32,address,address,uint8,bytes32)
EV|10|MOVE|1|IngressProposalExpired(bytes32,address,address,uint8,bytes32)
EV|11|MOVE|1|IngressActivated(uint256,address,bytes32,bytes32,uint256,uint256,uint256,uint64,uint8,bytes32)
EV|12|MOVE|1|IngressDisabled(uint256,address,address,uint64,uint8,bytes32)
EV|13|MOVE|2|AccountingMutation(uint256,bytes32,uint8,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256),uint256)
EV|14|MOVE|2|AccountingComponent(uint256,uint256,bytes32,uint8,bytes32,uint256)
EV|15|MOVE|2|UnattributedReclassified(bytes32,uint256,address,uint256,uint8,bytes32)
EV|16|MOVE|2|CanonicalDeposit(bytes32,uint256,bytes32,address,uint256,uint256,uint256,uint256,uint256,uint64)
EV|17|INHERITED|1|OwnershipTransferStarted(address,address)
EV|18|INHERITED|1|OwnershipTransferred(address,address)
EV|19|INHERITED|1|Paused(address)
EV|20|INHERITED|1|Unpaused(address)
EV|21|INHERITED|1|EIP712DomainChanged()
C|1|RETIRED|7|constructor(address,address,uint256):nonpayable
'@
$stableRows = @($stableRowsText -split "`r?`n" | Where-Object { $_ } | ForEach-Object {
  $parts = $_ -split '\|', 5
  [pscustomobject]@{ Prefix=$parts[0]; Number=[uint32]$parts[1]; Category=$parts[2]; Owner=[byte]$parts[3]; Descriptor=$parts[4] }
})

function Fail([string]$Message, [int]$Code = 1) {
  [Console]::Error.WriteLine($Message)
  exit $Code
}

function Canonical-Type($InputNode) {
  $type = [string]$InputNode.type
  if (-not $type.StartsWith('tuple')) { return $type }
  $suffix = $type.Substring(5)
  $members = @($InputNode.components | ForEach-Object { Canonical-Type $_ })
  return '(' + ($members -join ',') + ')' + $suffix
}

function Canonical-Descriptor($AbiEntry) {
  return ([string]$AbiEntry.name) + '(' + (@($AbiEntry.inputs | ForEach-Object { Canonical-Type $_ }) -join ',') + ')'
}

function Extract-StringArray([string]$Source, [string]$Pattern) {
  $m = [regex]::Match($Source, $Pattern, [Text.RegularExpressions.RegexOptions]::Singleline)
  if (-not $m.Success) { Fail "Frozen row table parse failed: $Pattern" }
  return @([regex]::Matches($m.Groups[1].Value, '"([^"]+)"') | ForEach-Object { $_.Groups[1].Value })
}

function Hash-StableRows($Rows, [string]$RequestedNode) {
  $nodeScript = @'
const fs=require('fs'); const {encodeAbiParameters,keccak256}=require('viem');
const rows=JSON.parse(fs.readFileSync(0,'utf8')); let h='0x'+'00'.repeat(32);
const p=[{type:'bytes32'},{type:'string'},{type:'uint256'},{type:'string'},{type:'uint8'},{type:'string'}];
for(const r of rows) h=keccak256(encodeAbiParameters(p,[h,r.Prefix,BigInt(r.Number),r.Category,r.Owner,r.Descriptor]));
process.stdout.write(h.toLowerCase());
'@
  $json = $Rows | ConvertTo-Json -Depth 8 -Compress
  Push-Location -LiteralPath $repo
  try { $result = ($json | & $RequestedNode -e $nodeScript 2>&1) -join ''; $nodeExit = $LASTEXITCODE }
  finally { Pop-Location }
  if ($nodeExit -ne 0 -or $result -notmatch '^0x[0-9a-f]{64}$') { Fail "Node+viem census hash failed: $result" }
  return $result
}

function Assert-ExactRows($Actual, $Expected, [string]$Kind) {
  if ($Actual.Count -ne $Expected.Count) { throw "$Kind row count mismatch." }
  $seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach ($item in $Actual) { if (-not $seen.Add([string]$item)) { throw "$Kind duplicate artifact descriptor." } }
  for ($i=0; $i -lt $Expected.Count; $i++) {
    if (-not $seen.Contains([string]$Expected[$i])) { throw "$Kind missing descriptor: $($Expected[$i])" }
  }
  $expectedSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach ($item in $Expected) { $null = $expectedSet.Add([string]$item) }
  foreach ($item in $Actual) { if (-not $expectedSet.Contains([string]$item)) { throw "$Kind extra descriptor: $item" } }
}

function Assert-StableRowTable($ActualRows, $ExpectedRows) {
  if ($ActualRows.Count -ne $ExpectedRows.Count) { throw 'Stable row count mismatch.' }
  for($i=0;$i-lt$ExpectedRows.Count;$i++) {
    $a=$ActualRows[$i]; $e=$ExpectedRows[$i]
    if(-not [string]::Equals([string]$a.Prefix,[string]$e.Prefix,[StringComparison]::Ordinal) -or
       $a.Number-ne$e.Number -or
       -not [string]::Equals([string]$a.Category,[string]$e.Category,[StringComparison]::Ordinal) -or
       $a.Owner-ne$e.Owner -or
       -not [string]::Equals([string]$a.Descriptor,[string]$e.Descriptor,[StringComparison]::Ordinal)) {
      throw "Stable row mismatch at index $i."
    }
  }
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
    if ($op -ge 0x60 -and $op -le 0x7f) {
      $width = $op - 0x5f
      if (($i + $width) -ge $bytes.Length) { throw 'Truncated PUSH immediate.' }
      $i += $width
      continue
    }
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

function Has-Prohibited($Ops) {
  return @($Ops | Where-Object { $_ -in @('CREATE','CALL','CALLCODE','DELEGATECALL','CREATE2','SELFDESTRUCT') }).Count -ne 0
}

if (-not (Test-Path -LiteralPath $config -PathType Leaf)) { Fail "Missing foundry config: $config" }
try { $null = & $ForgePath --version } catch { Fail "Forge is unavailable at '$ForgePath'." }
try { $null = & $NodePath --version } catch { Fail "Node is unavailable at '$NodePath'." }
$scannerExecutableRejected = Has-Prohibited @(Scan-Opcodes '0xf4')
$scannerPushDataPassed = -not (Has-Prohibited @(Scan-Opcodes '0x60f4'))
$scannerTruncatedRejected = $false
try { $null = Scan-Opcodes '0x62aabb' } catch { $scannerTruncatedRejected = $true }
if (-not $scannerExecutableRejected -or -not $scannerPushDataPassed -or -not $scannerTruncatedRejected) {
  Fail 'PUSH-aware scanner selftest failed.'
}
Write-Output 'Scanner selftests: executable-f4=rejected PUSH-data-f4=accepted truncated-PUSH=rejected'
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
if ($payable.Count -ne 1 -or -not [string]::Equals([string]$payable[0].name,'depositCanonical',[StringComparison]::Ordinal)) { Fail 'Task5 payable surface drift.' }
if (@($abi | Where-Object { $_.type -eq 'receive' -or $_.type -eq 'fallback' }).Count -ne 0) { Fail 'Task5 receive/fallback drift.' }
if ($constructors[0].stateMutability -ne 'nonpayable') { Fail 'Task5 constructor mutability drift.' }
$actualConstructor = 'constructor(' + (@($constructors[0].inputs | ForEach-Object { Canonical-Type $_ }) -join ',') + '):' + $constructors[0].stateMutability
$expectedConstructor = @($stableRows | Where-Object Prefix -eq 'C')[0].Descriptor
if (-not [string]::Equals($actualConstructor,$expectedConstructor,[StringComparison]::Ordinal)) { Fail "Task5 constructor descriptor drift: $actualConstructor" }
$actualFunctions = @($functions | ForEach-Object { Canonical-Descriptor $_ })
$actualErrors = @($errors | ForEach-Object { Canonical-Descriptor $_ })
$actualEvents = @($events | ForEach-Object { Canonical-Descriptor $_ })
$expectedFunctions = @($stableRows | Where-Object Prefix -eq 'F' | ForEach-Object Descriptor)
$expectedErrors = @($stableRows | Where-Object Prefix -eq 'ER' | ForEach-Object Descriptor)
$expectedEvents = @($stableRows | Where-Object Prefix -eq 'EV' | ForEach-Object Descriptor)
try {
  Assert-ExactRows $actualFunctions $expectedFunctions 'function'
  Assert-ExactRows $actualErrors $expectedErrors 'error'
  Assert-ExactRows $actualEvents $expectedEvents 'event'
} catch { Fail $_.Exception.Message }

$artifactRows = @($stableRows | ForEach-Object {
  $descriptor = $_.Descriptor
  if ($_.Prefix -eq 'F') { $descriptor = @($actualFunctions | Where-Object { [string]::Equals($_,$descriptor,[StringComparison]::Ordinal) })[0] }
  elseif ($_.Prefix -eq 'ER') { $descriptor = @($actualErrors | Where-Object { [string]::Equals($_,$descriptor,[StringComparison]::Ordinal) })[0] }
  elseif ($_.Prefix -eq 'EV') { $descriptor = @($actualEvents | Where-Object { [string]::Equals($_,$descriptor,[StringComparison]::Ordinal) })[0] }
  if ($_.Prefix -eq 'C') { $descriptor = $actualConstructor }
  [pscustomobject]@{ Prefix=$_.Prefix; Number=$_.Number; Category=$_.Category; Owner=$_.Owner; Descriptor=$descriptor }
})
try { Assert-StableRowTable $artifactRows $stableRows } catch { Fail $_.Exception.Message }
$censusHash = Hash-StableRows $artifactRows $NodePath
$expectedCensusHash = '0x900d8599031796556ccc5d83d3df8dcfe4725d4c34b9f0cf26ff269436a00aab'
if ($censusHash -ne $expectedCensusHash) { Fail "Task5 chained census hash drift: $censusHash" }

# In-memory verifier selftests use the same stable-table routine as the artifact path.
$substitution = @($artifactRows | ForEach-Object { [pscustomobject]@{Prefix=$_.Prefix;Number=$_.Number;Category=$_.Category;Owner=$_.Owner;Descriptor=$_.Descriptor} })
$swap = @($artifactRows | ForEach-Object { [pscustomobject]@{Prefix=$_.Prefix;Number=$_.Number;Category=$_.Category;Owner=$_.Owner;Descriptor=$_.Descriptor} })
$substitution[0].Descriptor = 'ownerSubstituted()'
($swap[0],$swap[1]) = ($swap[1],$swap[0])
$substitutionRejected = $false; $swapRejected = $false
try { Assert-StableRowTable $substitution $stableRows } catch { $substitutionRejected=$true }
try { Assert-StableRowTable $swap $stableRows } catch { $swapRejected=$true }
if (-not $substitutionRejected -or -not $swapRejected) { Fail 'Stable-row negative selftest failed.' }
Write-Output "Task5 ABI: functions=67 errors=55 events=21 constructors=1 total=144 censusHash=$censusHash"
Write-Output 'Stable-row selftests: same-count substitution=rejected same-owner row-swap=rejected'
$runtime = Byte-Length $legacy.deployedBytecode.object
if ($runtime -ne 23212) { Fail "Task5 runtime drift: $runtime." }
$initcode = Byte-Length $legacy.bytecode.object
if ($initcode -ne 25120) { Fail "Task5 initcode drift: $initcode." }
if ($runtime -gt 24576 -or $initcode -gt 49152) { Fail 'Task5 bytecode exceeds frozen limits.' }
$creationHex = $legacy.bytecode.object.Substring(2)
$runtimeHex = $legacy.deployedBytecode.object.Substring(2)
$runtimeOffsetChars = $creationHex.IndexOf($runtimeHex, [StringComparison]::OrdinalIgnoreCase)
if ($runtimeOffsetChars -lt 0 -or $runtimeOffsetChars -ne $creationHex.LastIndexOf($runtimeHex, [StringComparison]::OrdinalIgnoreCase)) {
  Fail 'Deployed runtime must occur exactly once in creation bytecode.'
}
if ($creationHex.Substring($runtimeOffsetChars) -ne $runtimeHex) { Fail 'Deployed runtime is not the exact creation-bytecode suffix.' }
$creationPrefix = '0x' + $creationHex.Substring(0,$runtimeOffsetChars)
$creationOffsetBytes = [int]($runtimeOffsetChars/2)
if ($creationOffsetBytes -ne 1908) { Fail "Task5 creation/runtime split drift: $creationOffsetBytes." }
$creationOps = @(Scan-Opcodes $creationPrefix)
$runtimeOps = @(Scan-Opcodes (Strip-SolidityMetadata $legacy.deployedBytecode.object))
if (@($creationOps | Where-Object { $_ -eq 'STATICCALL' }).Count -ne 1) { Fail 'Task5 constructor must contain exactly one executable STATICCALL.' }
foreach ($forbidden in @('CREATE','CALL','CALLCODE','DELEGATECALL','CREATE2','SELFDESTRUCT')) {
  if ($creationOps -contains $forbidden) { Fail "Task5 forbidden constructor opcode: $forbidden." }
}
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
  $assembly = (& $ForgePath inspect AcquisitionVault assembly 2>&1) -join "`n"
  if ($LASTEXITCODE -ne 0) { Fail 'forge inspect assembly failed closed.' }
  if ([regex]::Matches($assembly,'sub_0:\s+assembly\s*\{').Count -ne 1) { Fail 'Expected one top-level sub_0 assembly boundary.' }
} finally { Set-Location -LiteralPath $oldLocation }
Write-Output "Task5 bytecode: initcode=$initcode constructorPrefix=$creationOffsetBytes runtime=$runtime"
Write-Output "Constructor inventory: STATICCALL=1 prohibited=0; runtime inventory: STATICCALL=2 prohibited=0"

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
