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
if ($present.Count -ne 6) {
  [Console]::Error.WriteLine("Partial constellation artifact set: $($present.Count) of 6.")
  exit 43
}

$factoryFunctions = @('factoryState()','childCommitment(uint8)','deployNext(bytes)','finalizeConstellation()')
$factoryErrors = @(
  'WrongChain(uint256)','RegistryChainMismatch(uint256)','FactorySafeZero()','FactoryRegistryZero()',
  'FactorySafeCodeMissing(address)','FactoryRegistryCodeMissing(address)','FactoryRoleCollision(address)',
  'FactoryRegistryRuntimeHashMismatch(bytes32,bytes32)','FactoryRegistryCallFailed()',
  'FactoryRegistryReturnLength(uint256)','FactoryPhaseMismatch(uint8,uint8)','FactoryChildIndex(uint8)',
  'FactoryChildInitcodeHashZero(uint8)','FactoryChildRuntimeHashZero(uint8)','FactoryInitcodeEmpty(uint8)',
  'FactoryInitcodeTooLarge(uint8,uint256)','FactoryInitcodeHashMismatch(uint8,bytes32,bytes32)',
  'FactoryCreateFailed(uint8)','FactoryChildAddressMismatch(uint8,address,address)',
  'FactoryRuntimeTooLarge(uint8,uint256)','FactoryRuntimeHashMismatch(uint8,bytes32,bytes32)',
  'FactoryTopologyCallFailed(uint8)','FactoryTopologyReturnLength(uint8,uint256)',
  'FactoryTopologySemanticMismatch(uint8)','FactoryPostCallGasInsufficient(uint8,uint256,uint256)',
  'FactoryFinalizerCallFailed(uint8)','FactoryFinalizerReturnLength(uint8,uint256)',
  'FactoryFinalizerSemanticMismatch(uint8)'
)
$factoryEvents = @('ChildDeployed(uint8,address,bytes32,bytes32)','ConstellationFinalized(bytes32,bytes32)')
$childSpecs = @(
  @{Name='AcquisitionAuthority'; Prefix='Authority'; Topology='authorityTopology()'; Finalizer='finalizeAuthority(bytes32)'},
  @{Name='AcquisitionVaultCore'; Prefix='Core'; Topology='coreTopology()'; Finalizer='finalizeCore(bytes32)'},
  @{Name='PreVoteBudgetBook'; Prefix='BudgetBook'; Topology='budgetBookTopology()'; Finalizer='finalizeBudgetBook(bytes32)'},
  @{Name='AcquisitionIntentExecution'; Prefix='IntentExecution'; Topology='intentExecutionTopology()'; Finalizer='finalizeIntentExecution(bytes32)'},
  @{Name='AcquisitionReconciliation'; Prefix='Reconciliation'; Topology='reconciliationTopology()'; Finalizer='finalizeReconciliation(bytes32)'}
)

function Assert-ArtifactSurface($Artifact, [string[]]$Functions, [string[]]$Errors, [string[]]$Events, [string]$Constructor, [string]$Name) {
  $abi=@($Artifact.abi)
  $af=@($abi|Where-Object type -eq 'function'|ForEach-Object { Canonical-Descriptor $_ })
  $ae=@($abi|Where-Object type -eq 'error'|ForEach-Object { Canonical-Descriptor $_ })
  $av=@($abi|Where-Object type -eq 'event'|ForEach-Object { Canonical-Descriptor $_ })
  $ac=@($abi|Where-Object type -eq 'constructor')
  Assert-ExactRows $af $Functions "$Name function"
  Assert-ExactRows $ae $Errors "$Name error"
  Assert-ExactRows $av $Events "$Name event"
  if($ac.Count-ne1){throw "$Name constructor count drift."}
  $actual='constructor('+(@($ac[0].inputs|ForEach-Object { Canonical-Type $_ })-join ',')+'):'+$ac[0].stateMutability
  if(-not [string]::Equals($actual,$Constructor,[StringComparison]::Ordinal)){throw "$Name constructor drift: $actual"}
  if(@($abi|Where-Object { $_.type -eq 'receive' -or $_.type -eq 'fallback' }).Count-ne0){throw "$Name receive/fallback drift."}
  if(@($abi|Where-Object stateMutability -eq 'payable').Count-ne0){throw "$Name payable drift."}
}

function Assert-FunctionSchema($Artifact,[string]$Name,[string]$Mutability,[string[]]$Outputs) {
  $rows=@($Artifact.abi|Where-Object { $_.type -eq 'function' -and [string]::Equals([string]$_.name,$Name,[StringComparison]::Ordinal) })
  if($rows.Count-ne1){throw "Function schema missing/duplicate: $Name"}
  $row=$rows[0]
  if(-not [string]::Equals([string]$row.stateMutability,$Mutability,[StringComparison]::Ordinal)){throw "$Name mutability drift."}
  $actual=@($row.outputs|ForEach-Object { Canonical-Type $_ })
  if($actual.Count-ne$Outputs.Count){throw "$Name output count drift."}
  for($i=0;$i-lt$Outputs.Count;$i++){if(-not [string]::Equals($actual[$i],$Outputs[$i],[StringComparison]::Ordinal)){throw "$Name output schema drift at $i."}}
}

function Assert-AbiNames($Artifact,[string]$Name,[string[]]$Inputs,[string[]]$Outputs) {
  $row=@($Artifact.abi|Where-Object { $_.type-eq'function'-and [string]::Equals([string]$_.name,$Name,[StringComparison]::Ordinal) })
  if($row.Count-ne1){throw "$Name ABI-name row drift."};$row=$row[0]
  $actualIn=@($row.inputs|ForEach-Object {$_.name});$actualOut=@($row.outputs|ForEach-Object {$_.name})
  if($actualIn.Count-ne$Inputs.Count-or$actualOut.Count-ne$Outputs.Count){throw "$Name ABI-name arity drift."}
  for($i=0;$i-lt$Inputs.Count;$i++){if(-not[string]::Equals($actualIn[$i],$Inputs[$i],[StringComparison]::Ordinal)){throw "$Name input name drift at $i."}}
  for($i=0;$i-lt$Outputs.Count;$i++){if(-not[string]::Equals($actualOut[$i],$Outputs[$i],[StringComparison]::Ordinal)){throw "$Name output name drift at $i."}}
}

function Assert-EventSchema($Artifact,[string]$Name,[bool[]]$Indexed) {
  $rows=@($Artifact.abi|Where-Object { $_.type -eq 'event' -and [string]::Equals([string]$_.name,$Name,[StringComparison]::Ordinal) })
  if($rows.Count-ne1){throw "Event schema missing/duplicate: $Name"}
  $row=$rows[0]
  if($row.anonymous){throw "$Name anonymous drift."}
  if($row.inputs.Count-ne$Indexed.Count){throw "$Name indexed count drift."}
  for($i=0;$i-lt$Indexed.Count;$i++){if([bool]$row.inputs[$i].indexed-ne$Indexed[$i]){throw "$Name indexed schema drift at $i."}}
}

function Assert-ImmutableReferences($Artifact,[string]$Expected,[string]$Name) {
  $parts=@()
  foreach($p in @($Artifact.deployedBytecode.immutableReferences.psobject.Properties|Sort-Object Name)){
    $refs=@($p.Value|ForEach-Object{"$($_.start):$($_.length)"})
    $parts+=($refs-join',')
  }
  $actual=$parts-join';'
  if(-not[string]::Equals($actual,$Expected,[StringComparison]::Ordinal)){throw "$Name immutable identity/reference drift."}
}

function Assert-SourceProvenance($Artifact,[string]$Source,[string]$Name,[string]$FrozenHash) {
  $metadata=$Artifact.metadata
  if($metadata-is[string]){$metadata=$metadata|ConvertFrom-Json -Depth 100}
  $sourceProperty=$metadata.sources.psobject.Properties[$Source]
  $sourceEntry=if($null-ne$sourceProperty){$sourceProperty.Value}else{$null}
  if($null-eq$sourceEntry-or [string]::IsNullOrWhiteSpace([string]$sourceEntry.keccak256)){throw "$Name source provenance missing: $Source"}
  $nodeScript="const fs=require('fs');const{keccak256,toHex}=require('viem');process.stdout.write(keccak256(toHex(fs.readFileSync(process.argv[1]))));"
  Push-Location -LiteralPath $repo
  try{$localHash=(& $NodePath -e $nodeScript (Join-Path $repo $Source) 2>&1)-join'';$nodeExit=$LASTEXITCODE}finally{Pop-Location}
  if($nodeExit-ne0-or-not [string]::Equals([string]$localHash,[string]$sourceEntry.keccak256,[StringComparison]::OrdinalIgnoreCase)){throw "$Name local source hash provenance drift."}
  if(-not [string]::Equals([string]$localHash,$FrozenHash,[StringComparison]::OrdinalIgnoreCase)){throw "$Name reviewed source hash drift."}
  $sourceNames=@($metadata.sources.psobject.Properties.Name)
  if($sourceNames.Count-ne1-or-not [string]::Equals($sourceNames[0],$Source,[StringComparison]::Ordinal)){throw "$Name reviewed production source set drift."}
  if($metadata.compiler.version-notmatch'^0.8.26\+commit\.'){throw "$Name compiler provenance drift."}
  if($metadata.settings.optimizer.enabled-ne$true-or$metadata.settings.optimizer.runs-ne800-or$metadata.settings.evmVersion-ne'cancun'){throw "$Name build settings provenance drift."}
}

function Assert-FactoryCompilerPolicy([string]$Ir) {
  $clean=[regex]::Replace($Ir,'/\*\*.*?\*/','',[Text.RegularExpressions.RegexOptions]::Singleline)
  $clean=[regex]::Replace($clean,'\s+',' ')
  $phase=$Ir.IndexOf('0:7068:7074  "_phase"',[StringComparison]::Ordinal);$create=$Ir.IndexOf('let var_child := create(',[StringComparison]::Ordinal)
  if($phase-lt0-or$phase-ge$create-or-not[regex]::IsMatch($clean,'let _1 := 0 .*create\( _1, add\(var_creation_mpos, 32\), mload\(var_creation_mpos\)\)')){throw 'Factory compiler phase-before-zero-value-CREATE drift.'}
  if(([regex]::Matches($clean,'(?<!static)call\( 100000, [^,]+, 0, [^,]+, [^,]+, 0, 0\)')).Count-ne5){throw 'Factory compiler finalizer CALL schema/count drift.'}
  if(([regex]::Matches($clean,'staticcall\(100000, [^,]+, 0, (0x04|4), 0, (0x20|32)\)')).Count-ne2){throw 'Factory compiler Registry STATICCALL schema/count drift.'}
  if(([regex]::Matches($clean,'staticcall\(50000, [^,]+, usr\$buffer, 0x04, usr\$buffer, 0x60\)')).Count-ne2){throw 'Factory compiler topology STATICCALL schema/count drift.'}
  if(([regex]::Matches($clean,'let _[0-9]+ := gas\(\)')).Count-lt10){throw 'Factory compiler immediate gas checkpoint drift.'}
  if(([regex]::Matches($clean,'returndatasize\(\)')).Count-ne9){throw 'Factory compiler bounded returndata observation drift.'}
  if($Ir-match'(?im)\breturndatacopy\s*\('){throw 'Factory dynamic returndata copying drift.'}
  if($Ir-match'(?im)\b(delegatecall|callcode|create2|selfdestruct)\s*\('){throw 'Factory prohibited compiler callsite.'}
}

function Get-ExecutableParts($Artifact,[string]$Name) {
  $creation=$Artifact.bytecode.object.Substring(2); $runtime=$Artifact.deployedBytecode.object.Substring(2)
  $offset=$creation.IndexOf($runtime,[StringComparison]::OrdinalIgnoreCase)
  if($offset-lt0-or$offset-ne$creation.LastIndexOf($runtime,[StringComparison]::OrdinalIgnoreCase)){throw "$Name runtime suffix occurrence drift."}
  if($creation.Substring($offset)-cne$runtime){throw "$Name runtime suffix mismatch."}
  $prefix='0x'+$creation.Substring(0,$offset)
  $stripped=Strip-SolidityMetadata ('0x'+$runtime)
  return @{Creation=@(Scan-Opcodes $prefix);Runtime=@(Scan-Opcodes $stripped);Offset=[int]($offset/2)}
}

try {
  $factory=Get-Content -LiteralPath $finalArtifacts[0] -Raw|ConvertFrom-Json -Depth 100
  Assert-ArtifactSurface $factory $factoryFunctions $factoryErrors $factoryEvents 'constructor(address,address,bytes32,bytes32[5],bytes32[5]):nonpayable' 'Factory'
  Assert-FunctionSchema $factory 'factoryState' 'view' @('bytes32','bytes32','uint8','uint8','address','bytes32','address','bytes32')
  Assert-FunctionSchema $factory 'childCommitment' 'view' @('address','bytes32','bytes32')
  Assert-FunctionSchema $factory 'deployNext' 'nonpayable' @('address')
  Assert-FunctionSchema $factory 'finalizeConstellation' 'nonpayable' @()
  Assert-EventSchema $factory 'ChildDeployed' @($true,$true,$true,$false)
  Assert-EventSchema $factory 'ConstellationFinalized' @($true,$true)
  Assert-SourceProvenance $factory 'src/AcquisitionConstellationFactory.sol' 'Factory' '0xb2d5787777243b4c1308877b186eb5c1c112accf628be9c7b85e4d709acf74c0'
  Assert-AbiNames $factory 'factoryState' @() @('manifestHash','deploymentCommitment','phase','nextChildIndex','safe','configurationRoot','registry','registryRuntimeHash')
  Assert-AbiNames $factory 'childCommitment' @('index') @('child','initcodeHash','runtimeHash')
  Assert-AbiNames $factory 'deployNext' @('initcode') @('child')
  Assert-AbiNames $factory 'finalizeConstellation' @() @()
  Push-Location -LiteralPath $repo
  try{$factoryIr=(& $ForgePath inspect AcquisitionConstellationFactory irOptimized 2>&1)-join"`n";$factoryIrExit=$LASTEXITCODE}finally{Pop-Location}
  if($factoryIrExit-ne0){throw 'Factory optimized-IR inspection failed closed.'}
  Assert-FactoryCompilerPolicy $factoryIr
  function Assert-RejectedIrMutation([string]$Label,[string]$MutatedIr){$rejected=$false;try{Assert-FactoryCompilerPolicy $MutatedIr}catch{$rejected=$true};if(-not$rejected){throw "Compiler-policy negative selftest failed: $Label"}}
  Assert-RejectedIrMutation 'phase-after-CREATE' ($factoryIr.Replace('0:7068:7074  "_phase"','0:99999:99999  "movedPhase"')+' 0:7068:7074  "_phase"')
  Assert-RejectedIrMutation 'nonzero-CREATE-value' ($factoryIr.Replace('let var_child := create(','let var_child := create(1, pop('))
  Assert-RejectedIrMutation 'wrong-finalizer-gas' ($factoryIr.Replace('call(/** @src 0:11084:11304  "assembly (\"memory-safe\") {..." */ 100000','call(/** @src 0:11084:11304  "assembly (\"memory-safe\") {..." */ 99999'))
  Assert-RejectedIrMutation 'wrong-topology-gas' ($factoryIr.Replace('staticcall(50000','staticcall(49999'))
  Assert-RejectedIrMutation 'dynamic-returndata-copy' ($factoryIr+' returndatacopy(0,0,returndatasize())')
  Assert-RejectedIrMutation 'prohibited-delegatecall' ($factoryIr+' delegatecall(1,2,3,4,5,6)')
  Assert-ImmutableReferences $factory '1262:32;470:32,540:32,595:32,738:32,1332:32;630:32,682:32,1367:32;1297:32;924:32,1143:32,2846:32,3404:32;890:32,1176:32' 'Factory'
  $factoryLayoutText=& $ForgePath inspect AcquisitionConstellationFactory storageLayout --json 2>&1
  if($LASTEXITCODE-ne0){throw "Factory storage inspect failed: $factoryLayoutText"}
  $factoryLayout=$factoryLayoutText|ConvertFrom-Json -Depth 100
  $factoryStorage=@($factoryLayout.storage)
  $expectedFactoryStorage=@('_childInitcodeHashes','_childRuntimeHashes','_children','_phase','_nextChildIndex')
  $expectedSlots=@('0','5','10','15','15');$expectedOffsets=@(0,0,0,0,1)
  $expectedTypeLabels=@('bytes32[5]','bytes32[5]','address[5]','enum AcquisitionConstellationFactory.Phase','uint8')
  $expectedTypeBytes=@('160','160','160','1','1')
  if($factoryStorage.Count-ne5){throw 'Factory storage count drift.'}
  for($i=0;$i-lt5;$i++){
    $row=$factoryStorage[$i];$type=$factoryLayout.types.psobject.Properties[$row.type].Value
    if(-not [string]::Equals($row.label,$expectedFactoryStorage[$i],[StringComparison]::Ordinal)-or$row.slot-ne$expectedSlots[$i]-or$row.offset-ne$expectedOffsets[$i]-or-not [string]::Equals($type.label,$expectedTypeLabels[$i],[StringComparison]::Ordinal)-or$type.encoding-ne'inplace'-or$type.numberOfBytes-ne$expectedTypeBytes[$i]){throw "Factory storage drift at $i."}
  }
  $parts=Get-ExecutableParts $factory 'Factory'
  $fc=$parts.Creation; $fr=$parts.Runtime
  if(@($fc|Where-Object {$_-eq'STATICCALL'}).Count-ne1-or @($fc|Where-Object {$_-ne'STATICCALL'}).Count-ne0){throw 'Factory constructor opcode inventory drift.'}
  if(@($fr|Where-Object {$_-eq'CREATE'}).Count-ne1-or @($fr|Where-Object {$_-eq'CALL'}).Count-ne1-or @($fr|Where-Object {$_-eq'STATICCALL'}).Count-ne2-or @($fr|Where-Object {$_-notin@('CREATE','CALL','STATICCALL')}).Count-ne0){throw 'Factory runtime opcode inventory drift.'}
  if((Byte-Length $factory.deployedBytecode.object)-gt24576-or(Byte-Length $factory.bytecode.object)-gt49152){throw 'Factory bytecode bound drift.'}
  for($i=0;$i-lt5;$i++){
    $spec=$childSpecs[$i];$artifact=Get-Content -LiteralPath $finalArtifacts[$i+1] -Raw|ConvertFrom-Json -Depth 100
    $p=$spec.Prefix
    $errs=@("${p}FactoryZero()","${p}ManifestHashZero()","${p}FinalizerUnauthorized(address)","${p}ManifestHashMismatch(bytes32,bytes32)","${p}AlreadyFinalized()")
    Assert-ArtifactSurface $artifact @($spec.Topology,$spec.Finalizer) $errs @("${p}Finalized(bytes32)") 'constructor(address,bytes32):nonpayable' $spec.Name
    Assert-FunctionSchema $artifact ($spec.Topology.Substring(0,$spec.Topology.IndexOf('('))) 'view' @('address','bytes32','bool')
    Assert-FunctionSchema $artifact ($spec.Finalizer.Substring(0,$spec.Finalizer.IndexOf('('))) 'nonpayable' @()
    Assert-EventSchema $artifact "${p}Finalized" @($true)
    $frozenChildHashes=@('0x61e46be3d23d4b601c5038c6c771f7e303bee6fa6bdddb33ab791a00fb5a637c','0x68a0c4ac031162b4dc46eb5025a41900fce83680ded925582040c98f07573740','0x9659973e3b81051e8865c40b87a6a39dc18746860022865d90e1248820a47829','0xeb20c36b0082cd56488736934de9a83d134200428d561252753835432b568dcb','0x8881c7b26f1f063c90eb1c2660cbb7fd0b2b934f27aecc2248400a141b3840e0')
    Assert-SourceProvenance $artifact "src/$($spec.Name).sol" $spec.Name $frozenChildHashes[$i]
    Assert-AbiNames $artifact ($spec.Topology.Substring(0,$spec.Topology.IndexOf('('))) @() @('factory','manifestHash','finalized')
    Assert-AbiNames $artifact ($spec.Finalizer.Substring(0,$spec.Finalizer.IndexOf('('))) @('manifestHash') @()
    $childImmutable=@('85:32,224:32;121:32,295:32,347:32,450:32','85:32,224:32;121:32,295:32,347:32,450:32','106:32,224:32;142:32,295:32,347:32,450:32','85:32,224:32;121:32,295:32,347:32,450:32','85:32,224:32;121:32,295:32,347:32,450:32')
    Assert-ImmutableReferences $artifact $childImmutable[$i] $spec.Name
    $layoutText=& $ForgePath inspect $spec.Name storageLayout --json 2>&1
    if($LASTEXITCODE-ne0){throw "$($spec.Name) storage inspect failed: $layoutText"}
    $layout=$layoutText|ConvertFrom-Json -Depth 100
    $childRows=@($layout.storage)
    if($childRows.Count-ne1){throw "$($spec.Name) storage count drift."}
    $childRow=$childRows[0];$childType=$layout.types.psobject.Properties[$childRow.type].Value
    if(-not [string]::Equals([string]$childRow.label,'_finalized',[StringComparison]::Ordinal)-or$childRow.slot-ne'0'-or$childRow.offset-ne0-or$childType.label-ne'bool'-or$childType.encoding-ne'inplace'-or$childType.numberOfBytes-ne'1'){throw "$($spec.Name) storage minimality drift."}
    $cp=Get-ExecutableParts $artifact $spec.Name
    if($cp.Creation.Count-ne0-or$cp.Runtime.Count-ne0){throw "$($spec.Name) call/create opcode inventory drift."}
    if((Byte-Length $artifact.deployedBytecode.object)-gt24576-or(Byte-Length $artifact.bytecode.object)-gt49152){throw "$($spec.Name) bytecode bound drift."}
  }
  $mutated=$factory|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  (@($mutated.abi|Where-Object { $_.type-eq'function'-and$_.name-eq'deployNext' })[0]).stateMutability='view'
  $mutationRejected=$false
  try{Assert-FunctionSchema $mutated 'deployNext' 'nonpayable' @('address')}catch{$mutationRejected=$true}
  if(-not$mutationRejected){throw 'Function-schema negative selftest failed.'}
  $mutated=$factory|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  (@($mutated.abi|Where-Object { $_.type-eq'event'-and$_.name-eq'ChildDeployed' })[0]).inputs[3].indexed=$true
  $mutationRejected=$false
  try{Assert-EventSchema $mutated 'ChildDeployed' @($true,$true,$true,$false)}catch{$mutationRejected=$true}
  if(-not$mutationRejected){throw 'Event-schema negative selftest failed.'}
} catch { Fail $_.Exception.Message 1 }

if ($ExpectTask0Red) {
  [Console]::Error.WriteLine('-ExpectTask0Red rejects a complete conforming Task 1 artifact set.')
  exit 44
}
Write-Output 'Task 1 GREEN: exact six-artifact ABI, constructor, payable/fallback, size, suffix, and opcode conformance passed.'
exit 0
