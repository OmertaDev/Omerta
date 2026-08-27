[CmdletBinding()]
param(
  [switch]$ExpectTask0Red,
  [ValidateSet('Task1','Task2')]
  [string]$ValidatePhase = 'Task2',
  [string]$ArtifactsRoot = '',
  [string]$ForgePath = 'forge',
  [string]$NodePath = 'node'
)

$ErrorActionPreference = 'Stop'
$redExitCode = 42
$verifierRepo = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($ArtifactsRoot)) {
  $ArtifactsRoot = Join-Path $verifierRepo 'out'
}
$ArtifactsRoot = [IO.Path]::GetFullPath($ArtifactsRoot)
$artifactProjectRoot = Split-Path -Parent $ArtifactsRoot
$repo = $artifactProjectRoot
$config = Join-Path $artifactProjectRoot 'foundry.toml'
$legacyArtifact = Join-Path $ArtifactsRoot 'AcquisitionVault.sol/AcquisitionVault.json'
$finalArtifacts = @(
  'AcquisitionConstellationFactory.sol/AcquisitionConstellationFactory.json',
  'AcquisitionAuthority.sol/AcquisitionAuthority.json',
  'AcquisitionVaultCore.sol/AcquisitionVaultCore.json',
  'PreVoteBudgetBook.sol/PreVoteBudgetBook.json',
  'AcquisitionIntentExecution.sol/AcquisitionIntentExecution.json',
  'AcquisitionReconciliation.sol/AcquisitionReconciliation.json'
) | ForEach-Object { Join-Path $ArtifactsRoot $_ }

$script:artifactTreeBaseline = $null
$script:isolatedRoot = $null

function Get-TextSha256([string]$Text) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return '0x' + [Convert]::ToHexString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text))).ToLowerInvariant() }
  finally { $sha.Dispose() }
}

function Get-ArtifactTreeFingerprint([string]$Root) {
  if (-not (Test-Path -LiteralPath $Root -PathType Container)) { return '<absent>' }
  $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar)
  $rows = @(
    Get-ChildItem -LiteralPath $rootPath -Recurse -File | ForEach-Object {
      $relative = $_.FullName.Substring($rootPath.Length).TrimStart('\','/').Replace('\','/')
      $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      "$relative|$hash"
    } | Sort-Object
  )
  return Get-TextSha256 ($rows -join "`n")
}

function Assert-ArtifactTreeUnchanged {
  if ($null -eq $script:artifactTreeBaseline) { return }
  $after = Get-ArtifactTreeFingerprint $ArtifactsRoot
  if (-not [string]::Equals($after,$script:artifactTreeBaseline,[StringComparison]::Ordinal)) {
    [Console]::Error.WriteLine("Canonical ArtifactsRoot changed during verification: before=$($script:artifactTreeBaseline) after=$after")
    exit 1
  }
}

function Exit-Verified([int]$Code) {
  Assert-ArtifactTreeUnchanged
  exit $Code
}

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
  Exit-Verified $Code
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
  Push-Location -LiteralPath $verifierRepo
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
  if ([string]::IsNullOrWhiteSpace($Hex) -or -not $Hex.StartsWith('0x')) { throw 'Malformed artifact bytecode.' }
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
  if ($Hex.Length -lt 6) { throw 'Bytecode too short for Solidity CBOR trailer.' }
  $metadataBytes = [Convert]::ToInt32($Hex.Substring($Hex.Length - 4), 16)
  $removeChars = ($metadataBytes + 2) * 2
  if ($removeChars -ge ($Hex.Length - 2)) { throw 'Invalid Solidity CBOR trailer length.' }
  return $Hex.Substring(0, $Hex.Length - $removeChars)
}

function Has-Prohibited($Ops) {
  return @($Ops | Where-Object { $_ -in @('CREATE','CALL','CALLCODE','DELEGATECALL','CREATE2','SELFDESTRUCT') }).Count -ne 0
}

function Canonical-AbiComponent($Node) {
  $children = ''
  if ($null -ne $Node.components) {
    $children = '(' + (@($Node.components | ForEach-Object { Canonical-AbiComponent $_ }) -join ',') + ')'
  }
  return ([string]$Node.name) + ':' + ([string]$Node.type) + ':' + ([string]$Node.internalType) + $children
}

function Canonical-AbiRow($Row) {
  $inputs = @($Row.inputs | ForEach-Object { Canonical-AbiComponent $_ }) -join ','
  $outputs = @($Row.outputs | ForEach-Object { Canonical-AbiComponent $_ }) -join ','
  switch ([string]$Row.type) {
    'function' { return "function|$($Row.name)|$($Row.stateMutability)|in=[$inputs]|out=[$outputs]" }
    'error' { return "error|$($Row.name)|in=[$inputs]" }
    'event' {
      $indexed = @($Row.inputs | ForEach-Object { if ($_.indexed) { '1' } else { '0' } }) -join ','
      return "event|$($Row.name)|anonymous=$([bool]$Row.anonymous)|in=[$inputs]|indexed=[$indexed]"
    }
    'constructor' { return "constructor|$($Row.stateMutability)|in=[$inputs]" }
    default { return "$($Row.type)|$($Row.stateMutability)|in=[$inputs]|out=[$outputs]" }
  }
}

function Get-AbiFingerprint($Artifact) {
  $rows = @($Artifact.abi | ForEach-Object { Canonical-AbiRow $_ } | Sort-Object)
  return Get-TextSha256 ($rows -join "`n")
}

function Assert-AbiFingerprint($Artifact, [string]$Expected, [string]$Name) {
  $actual = Get-AbiFingerprint $Artifact
  if (-not [string]::Equals($actual,$Expected,[StringComparison]::Ordinal)) {
    throw "$Name exact ABI schema drift: $actual"
  }
}

function Assert-IsolatedArtifactMatch($Canonical, $Isolated, [string]$ExpectedAbiHash, [string]$Name) {
  if (-not [string]::Equals([string]$Canonical.bytecode.object,[string]$Isolated.bytecode.object,[StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals([string]$Canonical.deployedBytecode.object,[string]$Isolated.deployedBytecode.object,[StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals((Get-AbiFingerprint $Canonical),$ExpectedAbiHash,[StringComparison]::Ordinal) -or
      -not [string]::Equals((Get-AbiFingerprint $Isolated),$ExpectedAbiHash,[StringComparison]::Ordinal)) {
    throw "$Name canonical artifact does not match isolated compiler output."
  }
}

function Get-PortableExecutableIdentity($Artifact, [string]$Name) {
  $creation = [string]$Artifact.bytecode.object
  $runtime = [string]$Artifact.deployedBytecode.object
  if (-not $creation.StartsWith('0x') -or -not $runtime.StartsWith('0x')) {
    throw "$Name malformed executable bytecode."
  }
  $creationBody = $creation.Substring(2)
  $runtimeBody = $runtime.Substring(2)
  $offset = $creationBody.IndexOf($runtimeBody,[StringComparison]::OrdinalIgnoreCase)
  if ($offset -lt 0 -or $offset -ne $creationBody.LastIndexOf($runtimeBody,[StringComparison]::OrdinalIgnoreCase)) {
    throw "$Name runtime suffix occurrence drift."
  }
  if (-not [string]::Equals($creationBody.Substring($offset),$runtimeBody,[StringComparison]::OrdinalIgnoreCase)) {
    throw "$Name runtime suffix mismatch."
  }
  return [pscustomobject]@{
    CreationPrefix = $creationBody.Substring(0,$offset).ToLowerInvariant()
    Runtime = (Strip-SolidityMetadata $runtime).Substring(2).ToLowerInvariant()
  }
}

function Assert-PortableIsolatedArtifactMatch($Canonical, $Isolated, [string]$Name) {
  $canonicalIdentity = Get-PortableExecutableIdentity $Canonical $Name
  $isolatedIdentity = Get-PortableExecutableIdentity $Isolated "$Name isolated"
  if (-not [string]::Equals($canonicalIdentity.CreationPrefix,$isolatedIdentity.CreationPrefix,[StringComparison]::Ordinal) -or
      -not [string]::Equals($canonicalIdentity.Runtime,$isolatedIdentity.Runtime,[StringComparison]::Ordinal) -or
      -not [string]::Equals((Get-AbiFingerprint $Canonical),(Get-AbiFingerprint $Isolated),[StringComparison]::Ordinal)) {
    throw "$Name canonical artifact does not match portable isolated compiler output."
  }
}

function Get-SourceSetFingerprint($Metadata) {
  $rows = @($Metadata.sources.psobject.Properties | ForEach-Object { "$($_.Name)=$($_.Value.keccak256)" } | Sort-Object)
  return Get-TextSha256 ($rows -join "`n")
}

function Get-FileKeccak([string]$Path) {
  $nodeScript = "const fs=require('fs');const{keccak256,toHex}=require('viem');const s=fs.readFileSync(process.argv[1],'utf8').replace(/\r\n/g,'\n');process.stdout.write(keccak256(toHex(Buffer.from(s))));"
  Push-Location -LiteralPath $verifierRepo
  try { $result = (& $NodePath -e $nodeScript $Path 2>&1) -join ''; $nodeExit = $LASTEXITCODE }
  finally { Pop-Location }
  if ($nodeExit -ne 0 -or $result -notmatch '^0x[0-9a-fA-F]{64}$') { throw "Source hash failed for $Path`: $result" }
  return $result.ToLowerInvariant()
}

function Assert-MetadataProvenance(
  $Artifact,
  [string]$Source,
  [string]$Contract,
  [string]$ExpectedSourceSetHash,
  [bool]$ViaIr,
  [bool]$RequireLocalSources
) {
  $metadata = $Artifact.metadata
  if ($metadata -is [string]) { $metadata = $metadata | ConvertFrom-Json -Depth 100 }
  if (-not [string]::Equals([string]$metadata.compiler.version,'0.8.26+commit.8a97fa7a',[StringComparison]::Ordinal)) {
    throw "$Contract compiler identity drift."
  }
  if ($metadata.settings.optimizer.enabled -ne $true -or [int]$metadata.settings.optimizer.runs -ne 800 -or
      -not [string]::Equals([string]$metadata.settings.evmVersion,'cancun',[StringComparison]::Ordinal)) {
    throw "$Contract optimizer/EVM provenance drift."
  }
  $actualViaIr = $metadata.settings.viaIR -eq $true
  if ($actualViaIr -ne $ViaIr) { throw "$Contract viaIR provenance drift." }
  $targets = @($metadata.settings.compilationTarget.psobject.Properties)
  if ($targets.Count -ne 1 -or
      -not [string]::Equals([string]$targets[0].Name,$Source,[StringComparison]::Ordinal) -or
      -not [string]::Equals([string]$targets[0].Value,$Contract,[StringComparison]::Ordinal)) {
    throw "$Contract compilationTarget drift."
  }
  $sourceSetHash = Get-SourceSetFingerprint $metadata
  if (-not [string]::Equals($sourceSetHash,$ExpectedSourceSetHash,[StringComparison]::Ordinal)) {
    throw "$Contract source-set/hash provenance drift: $sourceSetHash"
  }
  if ($RequireLocalSources) {
    foreach ($property in @($metadata.sources.psobject.Properties)) {
      $local = Join-Path $artifactProjectRoot $property.Name
      if (-not (Test-Path -LiteralPath $local -PathType Leaf)) { throw "$Contract local source missing: $($property.Name)" }
      $localHash = Get-FileKeccak $local
      if (-not [string]::Equals($localHash,[string]$property.Value.keccak256,[StringComparison]::OrdinalIgnoreCase)) {
        throw "$Contract local source hash drift: $($property.Name)"
      }
    }
  }
}

function Assert-Task2CompilerConfiguration([string]$Toml, $LegacyArtifact) {
  if ($Toml -notmatch 'solc_version\s*=\s*"0\.8\.26"' -or $Toml -notmatch 'optimizer\s*=\s*true' -or
      $Toml -notmatch 'optimizer_runs\s*=\s*800' -or $Toml -notmatch 'evm_version\s*=\s*"cancun"') {
    throw 'Task2 default compiler profile drift.'
  }
  $expectedPaths = @(
    'src/AcquisitionConstellationFactory.sol','src/AcquisitionAuthority.sol','src/AcquisitionVaultCore.sol',
    'src/PreVoteBudgetBook.sol','src/AcquisitionIntentExecution.sol','src/AcquisitionReconciliation.sol',
    'src/interfaces/IAcquisitionAuthorityV2.sol'
  )
  $restrictionMatches = [regex]::Matches($Toml,'\{\s*paths\s*=\s*"([^"]+)"[^\r\n]+\}')
  if ($restrictionMatches.Count -ne 7) { throw 'Task2 compiler restriction count drift.' }
  $actualPaths = @($restrictionMatches | ForEach-Object { $_.Groups[1].Value } | Sort-Object)
  $expectedSorted = @($expectedPaths | Sort-Object)
  for ($i=0;$i-lt$expectedSorted.Count;$i++) {
    if (-not [string]::Equals($actualPaths[$i],$expectedSorted[$i],[StringComparison]::Ordinal)) {
      throw 'Task2 compiler restriction path drift.'
    }
  }
  foreach ($match in $restrictionMatches) {
    $line = $match.Value
    if ($line -notmatch 'version\s*=\s*"=0\.8\.26"' -or $line -notmatch 'via_ir\s*=\s*true' -or
        $line -notmatch 'optimizer_runs\s*=\s*800' -or $line -notmatch 'evm_version\s*=\s*"cancun"') {
      throw "Task2 compiler restriction settings drift: $line"
    }
  }
  if ($Toml -notmatch 'name\s*=\s*"constellation-via-ir"[^\r\n]+via_ir\s*=\s*true[^\r\n]+optimizer\s*=\s*true[^\r\n]+optimizer_runs\s*=\s*800[^\r\n]+evm_version\s*=\s*"cancun"') {
    throw 'Task2 named compiler profile drift.'
  }
  $legacyMetadata = $LegacyArtifact.metadata
  if ($legacyMetadata -is [string]) { $legacyMetadata = $legacyMetadata | ConvertFrom-Json -Depth 100 }
  if ($legacyMetadata.settings.viaIR -eq $true) { throw 'Historical AcquisitionVault must remain on the default non-viaIR profile.' }
}

function Assert-CanonicalArtifactLayout([string[]]$Paths) {
  $expectedNames = @(
    'AcquisitionConstellationFactory','AcquisitionAuthority','AcquisitionVaultCore','PreVoteBudgetBook',
    'AcquisitionIntentExecution','AcquisitionReconciliation'
  )
  for ($i=0;$i-lt$Paths.Count;$i++) {
    $expected = [IO.Path]::GetFullPath($Paths[$i])
    $matches = @(Get-ChildItem -LiteralPath $ArtifactsRoot -Recurse -File -Filter ($expectedNames[$i] + '.json'))
    if ($matches.Count -ne 1 -or -not [string]::Equals([IO.Path]::GetFullPath($matches[0].FullName),$expected,[StringComparison]::OrdinalIgnoreCase)) {
      throw "$($expectedNames[$i]) canonical artifact missing, duplicated, profiled, or misplaced."
    }
  }
}

function Initialize-IsolatedCompiler {
  if ($null -ne $script:isolatedRoot) { return }
  $script:isolatedRoot = Join-Path ([IO.Path]::GetTempPath()) ('omerta-constellation-verifier-' + [Guid]::NewGuid().ToString('N'))
  $null = New-Item -ItemType Directory -Path $script:isolatedRoot
}

function Invoke-IsolatedForgeInspect([string]$Contract, [string]$Field, [switch]$Json, [switch]$Ast) {
  Initialize-IsolatedCompiler
  $args = @('inspect',$Contract,$Field,'--root',$artifactProjectRoot,'--out',(Join-Path $script:isolatedRoot 'out'),'--cache-path',(Join-Path $script:isolatedRoot 'cache'))
  if ($Json) { $args += '--json' }
  if ($Ast) { $args += '--ast' }
  $text = (& $ForgePath @args 2>&1) -join "`n"
  if ($LASTEXITCODE -ne 0) { throw "forge inspect $Contract $Field failed closed: $text" }
  return $text
}

function Get-ReferenceSignature($References) {
  return @($References | Sort-Object start,length | ForEach-Object { "$($_.start):$($_.length)" }) -join ','
}

function Get-ImmutableReferenceSet($Artifact) {
  return @($Artifact.deployedBytecode.immutableReferences.psobject.Properties | ForEach-Object { Get-ReferenceSignature $_.Value } | Sort-Object)
}

function Assert-ReferenceSet($Artifact, [string[]]$Expected, [string]$Name) {
  $actual = @(Get-ImmutableReferenceSet $Artifact)
  $expectedSorted = @($Expected | Sort-Object)
  if ($actual.Count -ne $expectedSorted.Count) { throw "$Name immutable reference count drift." }
  for ($i=0;$i-lt$expectedSorted.Count;$i++) {
    if (-not [string]::Equals($actual[$i],$expectedSorted[$i],[StringComparison]::Ordinal)) {
      throw "$Name immutable reference position/length drift."
    }
  }
}

function Assert-StorageRows($Layout, $ExpectedRows, [string]$Name) {
  $rows = @($Layout.storage)
  if ($rows.Count -ne $ExpectedRows.Count) { throw "$Name storage row count drift." }
  for ($i=0;$i-lt$ExpectedRows.Count;$i++) {
    $actual = $rows[$i]; $expected = $ExpectedRows[$i]
    $typeProperty = $Layout.types.psobject.Properties[[string]$actual.type]
    if ($null -eq $typeProperty) { throw "$Name storage type missing at row $i." }
    $type = $typeProperty.Value
    if (-not [string]::Equals([string]$actual.label,[string]$expected.Label,[StringComparison]::Ordinal) -or
        -not [string]::Equals([string]$actual.slot,[string]$expected.Slot,[StringComparison]::Ordinal) -or
        [int]$actual.offset -ne [int]$expected.Offset -or
        -not [string]::Equals([string]$actual.type,[string]$expected.TypeId,[StringComparison]::Ordinal) -or
        -not [string]::Equals([string]$type.label,[string]$expected.Type,[StringComparison]::Ordinal) -or
        -not [string]::Equals([string]$type.encoding,[string]$expected.Encoding,[StringComparison]::Ordinal) -or
        -not [string]::Equals([string]$type.numberOfBytes,[string]$expected.Bytes,[StringComparison]::Ordinal)) {
      throw "$Name storage schema drift at row $i."
    }
  }
}

function Assert-StorageTypeSchema($Layout, $Expected, [string]$Name) {
  $property = $Layout.types.psobject.Properties[[string]$Expected.TypeId]
  if ($null -eq $property) { throw "$Name storage type missing: $($Expected.TypeId)." }
  $type = $property.Value
  if (-not [string]::Equals([string]$type.label,[string]$Expected.Label,[StringComparison]::Ordinal) -or
      -not [string]::Equals([string]$type.encoding,[string]$Expected.Encoding,[StringComparison]::Ordinal) -or
      -not [string]::Equals([string]$type.numberOfBytes,[string]$Expected.Bytes,[StringComparison]::Ordinal) -or
      -not [string]::Equals([string]$type.key,[string]$Expected.Key,[StringComparison]::Ordinal) -or
      -not [string]::Equals([string]$type.value,[string]$Expected.Value,[StringComparison]::Ordinal)) {
    throw "$Name storage type header drift: $($Expected.TypeId)."
  }
  $actualMembers = if ($null -eq $type.members) { @() } else { @($type.members) }
  $expectedMembers = if ($null -eq $Expected.Members) { @() } else { @($Expected.Members) }
  if ($actualMembers.Count -ne $expectedMembers.Count) { throw "$Name storage member count drift: $($Expected.TypeId)." }
  for ($i=0;$i-lt$expectedMembers.Count;$i++) {
    $actual = $actualMembers[$i]; $expectedMember = $expectedMembers[$i]
    if (-not [string]::Equals([string]$actual.label,[string]$expectedMember.Label,[StringComparison]::Ordinal) -or
        -not [string]::Equals([string]$actual.type,[string]$expectedMember.TypeId,[StringComparison]::Ordinal) -or
        -not [string]::Equals([string]$actual.slot,[string]$expectedMember.Slot,[StringComparison]::Ordinal) -or
        [int]$actual.offset -ne [int]$expectedMember.Offset) {
      throw "$Name storage member schema drift at $($Expected.TypeId)[$i]."
    }
  }
}

function Assert-DescriptorUniverse([string[]]$Descriptors, [string]$Kind, [int]$ExpectedCount, [bool]$AllowGuardRepeat = $false) {
  if ($Descriptors.Count -ne $ExpectedCount) { throw "$Kind collision-universe count drift: $($Descriptors.Count)." }
  $seen = @{}
  foreach ($descriptor in $Descriptors) {
    if ($seen.ContainsKey($descriptor)) {
      if (-not ($AllowGuardRepeat -and $descriptor -eq 'ReentrancyGuardReentrantCall()')) {
        throw "$Kind duplicate descriptor: $descriptor"
      }
    } else { $seen[$descriptor] = $true }
  }
  $nodeScript = @'
const fs=require('fs'); const {keccak256,toBytes}=require('viem');
const x=JSON.parse(fs.readFileSync(0,'utf8')); const seen=new Map();
for(const d of x.descriptors){ const full=keccak256(toBytes(d)); const key=x.kind==='event'?full:full.slice(0,10); const prior=seen.get(key); if(prior && prior!==d){process.stderr.write(`${key}:${prior}:${d}`);process.exit(9)} seen.set(key,d) }
'@
  $payload = @{kind=$Kind;descriptors=$Descriptors} | ConvertTo-Json -Depth 5 -Compress
  Push-Location -LiteralPath $verifierRepo
  try { $output = ($payload | & $NodePath -e $nodeScript 2>&1) -join ''; $nodeExit = $LASTEXITCODE }
  finally { Pop-Location }
  if ($nodeExit -ne 0) { throw "$Kind selector/topic collision: $output" }
}

$script:artifactTreeBaseline = Get-ArtifactTreeFingerprint $ArtifactsRoot
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

try {
  $layoutText = Invoke-IsolatedForgeInspect 'AcquisitionVault' 'storageLayout' -Json
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
  $guardSource = Get-Content -LiteralPath (Join-Path $artifactProjectRoot 'lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol') -Raw
  if ($guardSource -notmatch '0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00') { Fail 'Namespaced ReentrancyGuard slot evidence drift.' }
  $ir = Invoke-IsolatedForgeInspect 'AcquisitionVault' 'ir'
  $iro = Invoke-IsolatedForgeInspect 'AcquisitionVault' 'irOptimized'
  if ($ir -notmatch 'staticcall\(gas\(\), var_registry_[0-9]+' -or $iro -notmatch 'staticcall\(gas\(\), var_registry,') { Fail 'Task5 constructor Registry STATICCALL posture missing.' }
  foreach ($word in @('delegatecall','callcode','create2','selfdestruct')) {
    if ($ir -match "(?im)\b$word\s*\(") { Fail "Forbidden Task5 IR operation: $word." }
  }
  $assembly = Invoke-IsolatedForgeInspect 'AcquisitionVault' 'assembly'
  if ([regex]::Matches($assembly,'sub_0:\s+assembly\s*\{').Count -ne 1) { Fail 'Expected one top-level sub_0 assembly boundary.' }
  $isolatedLegacyPath = Join-Path (Join-Path $script:isolatedRoot 'out') 'AcquisitionVault.sol/AcquisitionVault.json'
  $isolatedLegacy = Get-Content -LiteralPath $isolatedLegacyPath -Raw | ConvertFrom-Json -Depth 100
  Assert-PortableIsolatedArtifactMatch $legacy $isolatedLegacy 'Task5 AcquisitionVault'

  $mutatedLegacy = $legacy | ConvertTo-Json -Depth 100 | ConvertFrom-Json -Depth 100
  $mutatedRuntimeBody = $mutatedLegacy.deployedBytecode.object.Substring(2)
  $replacementByte = if ($mutatedRuntimeBody.Substring(2,2) -eq '00') { '01' } else { '00' }
  $mutatedRuntimeBody = $mutatedRuntimeBody.Substring(0,2) + $replacementByte + $mutatedRuntimeBody.Substring(4)
  $mutatedCreationBody = $mutatedLegacy.bytecode.object.Substring(2)
  $mutatedRuntimeOffset = $mutatedCreationBody.IndexOf(
    $mutatedLegacy.deployedBytecode.object.Substring(2),[StringComparison]::OrdinalIgnoreCase
  )
  $mutatedLegacy.deployedBytecode.object = '0x' + $mutatedRuntimeBody
  $mutatedLegacy.bytecode.object = '0x' + $mutatedCreationBody.Substring(0,$mutatedRuntimeOffset) + $mutatedRuntimeBody
  $legacyExecutableMutationRejected = $false
  try { Assert-PortableIsolatedArtifactMatch $mutatedLegacy $isolatedLegacy 'mutated Task5 AcquisitionVault' }
  catch { $legacyExecutableMutationRejected = $true }
  if (-not $legacyExecutableMutationRejected) { throw 'Task5 executable-byte negative selftest failed.' }
} catch { Fail $_.Exception.Message }
Write-Output "Task5 bytecode: initcode=$initcode constructorPrefix=$creationOffsetBytes runtime=$runtime"
Write-Output "Constructor inventory: STATICCALL=1 prohibited=0; runtime inventory: STATICCALL=2 prohibited=0"

function Get-ExecutableParts($Artifact,[string]$Name) {
  $creation=$Artifact.bytecode.object.Substring(2); $runtime=$Artifact.deployedBytecode.object.Substring(2)
  $offset=$creation.IndexOf($runtime,[StringComparison]::OrdinalIgnoreCase)
  if($offset-lt0-or$offset-ne$creation.LastIndexOf($runtime,[StringComparison]::OrdinalIgnoreCase)){throw "$Name runtime suffix occurrence drift."}
  if($creation.Substring($offset)-cne$runtime){throw "$Name runtime suffix mismatch."}
  $prefix='0x'+$creation.Substring(0,$offset)
  $stripped=Strip-SolidityMetadata ('0x'+$runtime)
  return @{Creation=@(Scan-Opcodes $prefix);Runtime=@(Scan-Opcodes $stripped);Offset=[int]($offset/2)}
}

function Assert-CallInventory($Parts, $CreationExpected, $RuntimeExpected, [string]$Name) {
  foreach ($opcode in @('CREATE','CALL','CALLCODE','DELEGATECALL','CREATE2','STATICCALL','SELFDESTRUCT')) {
    $creationCount = @($Parts.Creation | Where-Object { $_ -eq $opcode }).Count
    $runtimeCount = @($Parts.Runtime | Where-Object { $_ -eq $opcode }).Count
    $expectedCreation = if ($CreationExpected.ContainsKey($opcode)) { [int]$CreationExpected[$opcode] } else { 0 }
    $expectedRuntime = if ($RuntimeExpected.ContainsKey($opcode)) { [int]$RuntimeExpected[$opcode] } else { 0 }
    if ($creationCount -ne $expectedCreation -or $runtimeCount -ne $expectedRuntime) {
      throw "$Name $opcode inventory drift: creation=$creationCount runtime=$runtimeCount."
    }
  }
}

function Assert-Task2FactoryIr([string]$Ir) {
  $clean=[regex]::Replace($Ir,'/\*\*.*?\*/','',[Text.RegularExpressions.RegexOptions]::Singleline)
  $clean=[regex]::Replace($clean,'\s+',' ')
  if(([regex]::Matches($clean,'(?<!static)call\(')).Count-ne5 -or
     ([regex]::Matches($clean,'(?<!static)call\(\s*100000')).Count-ne5 -or
     ([regex]::Matches($clean,'staticcall\(')).Count-ne5 -or
     ([regex]::Matches($clean,'staticcall\(100000')).Count-ne2 -or
     ([regex]::Matches($clean,'staticcall\(50000')).Count-ne2 -or
     ([regex]::Matches($clean,'staticcall\(160000')).Count-ne1 -or
     ([regex]::Matches($clean,'create\(')).Count-ne1 -or
     ([regex]::Matches($clean,'returndatasize\(')).Count-ne10) {
    throw 'Task2 Factory bounded compiler call/gas/returndata inventory drift.'
  }
  if($clean-notmatch'create\(\s*_[0-9]+,\s*add\('){throw 'Task2 Factory zero-value CREATE compiler posture drift.'}
  if($clean-cmatch'(?m)returndatacopy\s*\(' -or $clean-cmatch'(?m)\b(delegatecall|callcode|create2|selfdestruct)\s*\('){
    throw 'Task2 Factory dynamic returndata/prohibited compiler operation drift.'
  }
}

function Assert-Task2AuthorityIr([string]$Ir) {
  $clean=[regex]::Replace($Ir,'/\*\*.*?\*/','',[Text.RegularExpressions.RegexOptions]::Singleline)
  $clean=[regex]::Replace($clean,'\s+',' ')
  if(([regex]::Matches($clean,'staticcall\(')).Count-ne2 -or
     ([regex]::Matches($clean,'staticcall\(100000')).Count-ne1 -or
     ([regex]::Matches($clean,'returndatasize\(')).Count-ne1) {
    throw 'Task2 Authority bounded signature-call compiler inventory drift.'
  }
  if($clean-cmatch'(?m)returndatacopy\s*\(' -or $clean-cmatch'(?m)(?<!static)call\s*\(' -or
     $clean-cmatch'(?m)\b(delegatecall|callcode|create|create2|selfdestruct)\s*\('){
    throw 'Task2 Authority dynamic returndata/prohibited compiler operation drift.'
  }
}

function Assert-Rejected([string]$Label, [scriptblock]$Action) {
  $rejected=$false
  try { & $Action } catch { $rejected=$true }
  if (-not $rejected) { throw "Verifier negative selftest failed: $Label" }
}

function Test-AuthoritySizePolicy([int]$RuntimeSize,[int]$InitcodeSize) {
  return [pscustomobject]@{
    RuntimeTarget = $RuntimeSize -le 18000
    RuntimeHard = $RuntimeSize -le 20000
    InitcodeTarget = $InitcodeSize -le 30000
    InitcodeHard = $InitcodeSize -le 49152
  }
}

function Invoke-Task2Validation {
  $names=@('Factory','Authority','Core','BudgetBook','IntentExecution','Reconciliation')
  $sources=@(
    'src/AcquisitionConstellationFactory.sol','src/AcquisitionAuthority.sol','src/AcquisitionVaultCore.sol',
    'src/PreVoteBudgetBook.sol','src/AcquisitionIntentExecution.sol','src/AcquisitionReconciliation.sol'
  )
  $contracts=@(
    'AcquisitionConstellationFactory','AcquisitionAuthority','AcquisitionVaultCore','PreVoteBudgetBook',
    'AcquisitionIntentExecution','AcquisitionReconciliation'
  )
  $abiHashes=@(
    '0xf05e9741ee47a34bb470075bab9debca7cc63300eb4225ac796522eb07759acc',
    '0xa0a12b00c6ce531d92676cb928870c7924fcf0169b0f06115b4a25a3a2ff4f0f',
    '0xfc58342d536bace7c64f784a0bb1458f485a817ad9eea1b75a1266b797c29fe7',
    '0x9e2f7a41d47b119e3b573d771462d93b4e631dc02af95201460e15157ac2577f',
    '0x8d1832ae8d0d3b4641495ae33d844b4b6423727e81575eab829ba979bcc2c046',
    '0x59fc50ed2e69f376aa218ce414edde3a4d354b33b5b814be944fcaeef514ae33'
  )
  $sourceHashes=@(
    '0xcd60b29528c4be7e595c85679fd14930557a267334d7637da3a40daac3643614',
    '0xf347cbc5003464be9fe40045de44b98b4e4f1e0c6b3c57652bbbec238ef200b8',
    '0xd145a7b8ed304c2283d3d7a81850bfd855fb235525956c4ce51c992162c5f0ec',
    '0x191c2867d26dc4b4d080a130bbc5f4de37f260c6951460f4eda63d5147d0d401',
    '0xfa0ddd58a732c141958eb9c498e21b5127d1edb39492ff15ad80acfc718a5b04',
    '0x5236dd84e460d48f015b6ccee4e92bb64a030687ce6838b97c7359cd84a60831'
  )
  $artifacts=@()
  for($i=0;$i-lt6;$i++){
    $artifact=Get-Content -LiteralPath $finalArtifacts[$i] -Raw|ConvertFrom-Json -Depth 100
    Assert-AbiFingerprint $artifact $abiHashes[$i] $names[$i]
    Assert-MetadataProvenance $artifact $sources[$i] $contracts[$i] $sourceHashes[$i] $true $true
    $artifacts+=$artifact
  }
  Assert-Task2CompilerConfiguration (Get-Content -LiteralPath $config -Raw) $legacy

  $allAbi=@($artifacts|ForEach-Object { $_.abi })
  $functions=@($allAbi|Where-Object type -eq 'function')
  $errors=@($allAbi|Where-Object type -eq 'error')
  $events=@($allAbi|Where-Object type -eq 'event')
  $constructors=@($allAbi|Where-Object type -eq 'constructor')
  if($functions.Count-ne62-or$errors.Count-ne102-or$events.Count-ne24-or$constructors.Count-ne6-or$allAbi.Count-ne194){
    throw "Task2 aggregate ABI census drift: $($functions.Count)/$($errors.Count)/$($events.Count)/$($constructors.Count)/$($allAbi.Count)."
  }
  if(@($allAbi|Where-Object { $_.type-eq'receive'-or$_.type-eq'fallback'-or$_.stateMutability-eq'payable' }).Count-ne0){
    throw 'Task2 payable/receive/fallback surface drift.'
  }

  $snapshot=@($artifacts[1].abi|Where-Object { $_.type-eq'function'-and$_.name-eq'authoritySnapshot' })
  if($snapshot.Count-ne1-or$snapshot[0].stateMutability-ne'view'-or$snapshot[0].inputs.Count-ne0-or$snapshot[0].outputs.Count-ne27){
    throw 'Task2 Authority flat snapshot arity/mutability drift.'
  }
  $snapshotTypes=@('uint256','address','bytes32','address','address','address','address','address','bool','address','address','bool','address','address','uint256','uint256','uint256','uint256','uint256','address','bytes32','address','bytes32','uint256','bytes32','uint256','bytes32')
  for($i=0;$i-lt27;$i++){
    if($snapshot[0].outputs[$i].type-ne$snapshotTypes[$i]-or-not[string]::IsNullOrEmpty([string]$snapshot[0].outputs[$i].name)-or$null-ne$snapshot[0].outputs[$i].components){
      throw "Task2 Authority flat snapshot schema drift at ordinal $i."
    }
  }

  $futureFunctions=@('authorizePreVoteBudget((uint256,uint256,uint64),bytes32)','getPreVoteBudget(uint256)')
  $futureErrors=@('BudgetDayClosed(uint256)','BudgetDeadlineOverflow()','InvalidPurchaseUntil(uint64,uint64)','BudgetAlreadyAuthorized(uint256)','InsufficientAvailable(uint256,uint256)','BudgetNotFound(uint256)')
  $futureEvents=@('PreVoteBudgetAuthorized(bytes32,uint256,uint256,uint64,uint256,uint256,uint64,uint8,bytes32)')
  $functionUniverse=@($functions|ForEach-Object{Canonical-Descriptor $_})+$futureFunctions
  $errorUniverse=@($errors|ForEach-Object{Canonical-Descriptor $_})+$futureErrors
  $eventUniverse=@($events|ForEach-Object{Canonical-Descriptor $_})+$futureEvents
  Assert-DescriptorUniverse $functionUniverse 'function' 64
  Assert-DescriptorUniverse $errorUniverse 'error' 108 $true
  Assert-DescriptorUniverse $eventUniverse 'event' 25

  $factoryLayout=(Invoke-IsolatedForgeInspect 'AcquisitionConstellationFactory' 'storageLayout' -Json -Ast)|ConvertFrom-Json -Depth 100
  $authorityLayout=(Invoke-IsolatedForgeInspect 'AcquisitionAuthority' 'storageLayout' -Json -Ast)|ConvertFrom-Json -Depth 100
  $factoryRows=@(
    @{Label='_childInitcodeHashes';Slot='0';Offset=0;TypeId='t_array(t_bytes32)5_storage';Type='bytes32[5]';Encoding='inplace';Bytes='160'},
    @{Label='_childRuntimeHashes';Slot='5';Offset=0;TypeId='t_array(t_bytes32)5_storage';Type='bytes32[5]';Encoding='inplace';Bytes='160'},
    @{Label='_children';Slot='10';Offset=0;TypeId='t_array(t_address)5_storage';Type='address[5]';Encoding='inplace';Bytes='160'},
    @{Label='_phase';Slot='15';Offset=0;TypeId='t_enum(Phase)54';Type='enum AcquisitionConstellationFactory.Phase';Encoding='inplace';Bytes='1'},
    @{Label='_nextChildIndex';Slot='15';Offset=1;TypeId='t_uint8';Type='uint8';Encoding='inplace';Bytes='1'}
  )
  $authorityRows=@(
    @{Label='_nameFallback';Slot='0';Offset=0;TypeId='t_string_storage';Type='string';Encoding='bytes';Bytes='32'},
    @{Label='_versionFallback';Slot='1';Offset=0;TypeId='t_string_storage';Type='string';Encoding='bytes';Bytes='32'},
    @{Label='_owner';Slot='2';Offset=0;TypeId='t_address';Type='address';Encoding='inplace';Bytes='20'},
    @{Label='_pendingOwner';Slot='3';Offset=0;TypeId='t_address';Type='address';Encoding='inplace';Bytes='20'},
    @{Label='_paused';Slot='3';Offset=20;TypeId='t_bool';Type='bool';Encoding='inplace';Bytes='1'},
    @{Label='mainOperator';Slot='4';Offset=0;TypeId='t_address';Type='address';Encoding='inplace';Bytes='20'},
    @{Label='_finalized';Slot='4';Offset=20;TypeId='t_bool';Type='bool';Encoding='inplace';Bytes='1'},
    @{Label='operatorGeneration';Slot='5';Offset=0;TypeId='t_uint256';Type='uint256';Encoding='inplace';Bytes='32'},
    @{Label='_sharedO2Nonce';Slot='6';Offset=0;TypeId='t_uint256';Type='uint256';Encoding='inplace';Bytes='32'},
    @{Label='_cancelNonce';Slot='7';Offset=0;TypeId='t_uint256';Type='uint256';Encoding='inplace';Bytes='32'},
    @{Label='nominationNonce';Slot='8';Offset=0;TypeId='t_uint256';Type='uint256';Encoding='inplace';Bytes='32'},
    @{Label='_pendingMainOperatorNomination';Slot='9';Offset=0;TypeId='t_struct(PendingOperatorNomination)10777_storage';Type='struct IAcquisitionAuthorityV2.PendingOperatorNomination';Encoding='inplace';Bytes='192'},
    @{Label='ingressProposalNonce';Slot='15';Offset=0;TypeId='t_uint256';Type='uint256';Encoding='inplace';Bytes='32'},
    @{Label='ingressGeneration';Slot='16';Offset=0;TypeId='t_uint256';Type='uint256';Encoding='inplace';Bytes='32'},
    @{Label='activeIngressGeneration';Slot='17';Offset=0;TypeId='t_uint256';Type='uint256';Encoding='inplace';Bytes='32'},
    @{Label='_pendingIngressProposal';Slot='18';Offset=0;TypeId='t_struct(PendingIngressProposal)10844_storage';Type='struct IAcquisitionAuthorityV2.PendingIngressProposal';Encoding='inplace';Bytes='352'},
    @{Label='_ingressRecords';Slot='29';Offset=0;TypeId='t_mapping(t_uint256,t_struct(IngressRecord)10861_storage)';Type='mapping(uint256 => struct IAcquisitionAuthorityV2.IngressRecord)';Encoding='mapping';Bytes='32'}
  )
  Assert-StorageRows $factoryLayout $factoryRows 'Factory'
  Assert-StorageRows $authorityLayout $authorityRows 'Authority'
  $authorityTypeSchemas=@(
    @{TypeId='t_struct(PendingOperatorNomination)10777_storage';Label='struct IAcquisitionAuthorityV2.PendingOperatorNomination';Encoding='inplace';Bytes='192';Key='';Value='';Members=@(
      @{Label='proposalId';TypeId='t_bytes32';Slot='0';Offset=0},@{Label='proposalNumber';TypeId='t_uint256';Slot='1';Offset=0},
      @{Label='nominee';TypeId='t_address';Slot='2';Offset=0},@{Label='proposedBy';TypeId='t_address';Slot='3';Offset=0},
      @{Label='proposedAt';TypeId='t_uint64';Slot='3';Offset=20},@{Label='validAfter';TypeId='t_uint64';Slot='4';Offset=0},
      @{Label='expiresAt';TypeId='t_uint64';Slot='4';Offset=8},@{Label='detailsHash';TypeId='t_bytes32';Slot='5';Offset=0}
    )},
    @{TypeId='t_struct(IngressConfig)10824_storage';Label='struct IAcquisitionAuthorityV2.IngressConfig';Encoding='inplace';Bytes='160';Key='';Value='';Members=@(
      @{Label='ingress';TypeId='t_address';Slot='0';Offset=0},@{Label='runtimeCodeHash';TypeId='t_bytes32';Slot='1';Offset=0},
      @{Label='perDepositCapWei';TypeId='t_uint256';Slot='2';Offset=0},@{Label='epochDepositCapWei';TypeId='t_uint256';Slot='3';Offset=0},
      @{Label='lifetimeDepositCapWei';TypeId='t_uint256';Slot='4';Offset=0}
    )},
    @{TypeId='t_struct(PendingIngressProposal)10844_storage';Label='struct IAcquisitionAuthorityV2.PendingIngressProposal';Encoding='inplace';Bytes='352';Key='';Value='';Members=@(
      @{Label='proposalId';TypeId='t_bytes32';Slot='0';Offset=0},@{Label='proposalNumber';TypeId='t_uint256';Slot='1';Offset=0},
      @{Label='proposedBy';TypeId='t_address';Slot='2';Offset=0},@{Label='config';TypeId='t_struct(IngressConfig)10824_storage';Slot='3';Offset=0},
      @{Label='configHash';TypeId='t_bytes32';Slot='8';Offset=0},@{Label='proposedAt';TypeId='t_uint64';Slot='9';Offset=0},
      @{Label='validAfter';TypeId='t_uint64';Slot='9';Offset=8},@{Label='expiresAt';TypeId='t_uint64';Slot='9';Offset=16},
      @{Label='detailsHash';TypeId='t_bytes32';Slot='10';Offset=0}
    )},
    @{TypeId='t_struct(IngressRecord)10861_storage';Label='struct IAcquisitionAuthorityV2.IngressRecord';Encoding='inplace';Bytes='224';Key='';Value='';Members=@(
      @{Label='generation';TypeId='t_uint256';Slot='0';Offset=0},@{Label='ingress';TypeId='t_address';Slot='1';Offset=0},
      @{Label='runtimeCodeHash';TypeId='t_bytes32';Slot='2';Offset=0},@{Label='perDepositCapWei';TypeId='t_uint256';Slot='3';Offset=0},
      @{Label='epochDepositCapWei';TypeId='t_uint256';Slot='4';Offset=0},@{Label='lifetimeDepositCapWei';TypeId='t_uint256';Slot='5';Offset=0},
      @{Label='activatedAt';TypeId='t_uint64';Slot='6';Offset=0},@{Label='disabledAt';TypeId='t_uint64';Slot='6';Offset=8}
    )},
    @{TypeId='t_mapping(t_uint256,t_struct(IngressRecord)10861_storage)';Label='mapping(uint256 => struct IAcquisitionAuthorityV2.IngressRecord)';Encoding='mapping';Bytes='32';Key='t_uint256';Value='t_struct(IngressRecord)10861_storage';Members=@()}
  )
  foreach($schema in $authorityTypeSchemas){Assert-StorageTypeSchema $authorityLayout $schema 'Authority'}

  $isolatedOut=Join-Path $script:isolatedRoot 'out'
  $isolatedFactory=Get-Content -LiteralPath (Join-Path $isolatedOut 'AcquisitionConstellationFactory.sol/AcquisitionConstellationFactory.json') -Raw|ConvertFrom-Json -Depth 100
  $isolatedAuthority=Get-Content -LiteralPath (Join-Path $isolatedOut 'AcquisitionAuthority.sol/AcquisitionAuthority.json') -Raw|ConvertFrom-Json -Depth 100
  for($i=2;$i-lt6;$i++){$null=Invoke-IsolatedForgeInspect $contracts[$i] 'abi'}
  $isolatedArtifacts=@()
  for($i=0;$i-lt6;$i++){
    $isolatedArtifact=Get-Content -LiteralPath (Join-Path $isolatedOut ((Split-Path -Leaf $sources[$i])+'/'+$contracts[$i]+'.json')) -Raw|ConvertFrom-Json -Depth 100
    Assert-IsolatedArtifactMatch $artifacts[$i] $isolatedArtifact $abiHashes[$i] $names[$i]
    $isolatedArtifacts+=$isolatedArtifact
  }
  $factorySemantic=[ordered]@{
    '_safe'='926:32,4037:32';'_registry'='1011:32,1301:32';'_registryRuntimeHash'='1050:32,1343:32';
    '_configurationRoot'='965:32';'_manifestHash'='831:32,1756:32,4857:32,5138:32';'_deploymentCommitment'='866:32,3096:32'
  }
  $authoritySemantic=[ordered]@{
    '_factory'='2854:32,4501:32,7618:32,11956:32,14348:32';'_manifestHash'='2893:32,4541:32,11992:32';
    '_launchSafe'='4617:32';'_registry'='2932:32,7568:32,14297:32';
    '_core'='1940:32,2972:32,3729:32,6395:32,7518:32,8128:32,11031:32,11704:32,13164:32,13864:32,14246:32,15083:32';
    '_budgetBook'='3012:32,7468:32,14195:32';'_intentExecution'='3052:32,7418:32,14144:32';'_reconciliation'='3092:32,7368:32,14106:32'
  }
  foreach($pair in @(@{Artifact=$isolatedFactory;Name='AcquisitionConstellationFactory';Map=$factorySemantic},@{Artifact=$isolatedAuthority;Name='AcquisitionAuthority';Map=$authoritySemantic})){
    $definition=@($pair.Artifact.ast.nodes|Where-Object { $_.nodeType-eq'ContractDefinition'-and$_.name-eq$pair.Name })
    if($definition.Count-ne1){throw "$($pair.Name) AST contract identity drift."}
    $variables=@($definition[0].nodes|Where-Object { $_.nodeType-eq'VariableDeclaration'-and$_.mutability-eq'immutable' })
    if($variables.Count-ne$pair.Map.Count){throw "$($pair.Name) semantic immutable count drift."}
    foreach($entry in $pair.Map.GetEnumerator()){
      $variable=@($variables|Where-Object { $_.name -eq $entry.Key })
      if($variable.Count-ne1){throw "$($pair.Name) semantic immutable label drift: $($entry.Key)"}
      $expectedType=if($entry.Key-in@('_manifestHash','_registryRuntimeHash','_configurationRoot','_deploymentCommitment')){'bytes32'}else{'address'}
      if($variable[0].typeDescriptions.typeString-ne$expectedType){throw "$($pair.Name) semantic immutable type drift: $($entry.Key)"}
      $refProperty=$pair.Artifact.deployedBytecode.immutableReferences.psobject.Properties[[string]$variable[0].id]
      if($null-eq$refProperty-or(Get-ReferenceSignature $refProperty.Value)-ne$entry.Value){throw "$($pair.Name) semantic immutable reference drift: $($entry.Key)"}
    }
  }
  $factoryExpected=@($factorySemantic.Values)
  $authorityExpected=@(
    '15755:32','15944:32','15708:32','15834:32','15872:32','5853:32','5894:32'
  )+@($authoritySemantic.Values)
  Assert-ReferenceSet $artifacts[0] $factoryExpected 'Factory canonical artifact'
  Assert-ReferenceSet $artifacts[1] $authorityExpected 'Authority canonical artifact'
  $leafReferenceSets=@(
    @('93:32,338:32','133:32,374:32'),@('97:32,225:32','133:32,265:32'),
    @('93:32,338:32','133:32,374:32'),@('93:32,338:32','133:32,374:32')
  )
  for($i=0;$i-lt4;$i++){Assert-ReferenceSet $artifacts[$i+2] $leafReferenceSets[$i] $names[$i+2]}

  $expectedSizes=@(@(7196,5484,1712),@(18629,16068,2561),@(676,473,203),@(675,473,202),@(676,473,203),@(676,473,203))
  for($i=0;$i-lt6;$i++){
    $init=Byte-Length $artifacts[$i].bytecode.object;$run=Byte-Length $artifacts[$i].deployedBytecode.object;$parts=Get-ExecutableParts $artifacts[$i] $names[$i]
    if($init-ne$expectedSizes[$i][0]-or$run-ne$expectedSizes[$i][1]-or$parts.Offset-ne$expectedSizes[$i][2]){throw "$($names[$i]) bytecode size/suffix split drift."}
    if($i-eq0){Assert-CallInventory $parts @{STATICCALL=1} @{CREATE=1;CALL=5;STATICCALL=4} $names[$i]}
    elseif($i-eq1){Assert-CallInventory $parts @{} @{STATICCALL=2} $names[$i]}
    else{Assert-CallInventory $parts @{} @{} $names[$i]}
    if($i-ne1-and($run-gt24576-or$init-gt49152)){throw "$($names[$i]) EIP bytecode bound drift."}
  }
  $sizePolicy=Test-AuthoritySizePolicy 16068 18629
  if(-not$sizePolicy.RuntimeTarget-or-not$sizePolicy.RuntimeHard-or-not$sizePolicy.InitcodeTarget-or-not$sizePolicy.InitcodeHard){throw 'Authority bytecode target/hard policy drift.'}
  if(-not(Test-AuthoritySizePolicy 18000 30000).RuntimeTarget-or(Test-AuthoritySizePolicy 18001 30001).RuntimeTarget-or
     -not(Test-AuthoritySizePolicy 20000 49152).RuntimeHard-or(Test-AuthoritySizePolicy 20001 49153).RuntimeHard-or
     -not(Test-AuthoritySizePolicy 18000 30000).InitcodeTarget-or(Test-AuthoritySizePolicy 18001 30001).InitcodeTarget-or
     -not(Test-AuthoritySizePolicy 20000 49152).InitcodeHard-or(Test-AuthoritySizePolicy 20001 49153).InitcodeHard){throw 'Authority size-boundary selftest failed.'}

  $factoryIr=Invoke-IsolatedForgeInspect 'AcquisitionConstellationFactory' 'irOptimized'
  $authorityIr=Invoke-IsolatedForgeInspect 'AcquisitionAuthority' 'irOptimized'
  Assert-Task2FactoryIr $factoryIr
  Assert-Task2AuthorityIr $authorityIr

  # Negative verifier selftests exercise the same exact validators used above.
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  (@($mutated.abi|Where-Object { $_.type-eq'function'-and$_.name-eq'deployNext' })[0]).stateMutability='view'
  Assert-Rejected 'ABI mutability' { Assert-AbiFingerprint $mutated $abiHashes[0] 'mutated Factory' }
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  (@($mutated.abi|Where-Object { $_.type-eq'event'-and$_.name-eq'ChildDeployed' })[0]).inputs[3].indexed=$true
  Assert-Rejected 'event indexedness' { Assert-AbiFingerprint $mutated $abiHashes[0] 'mutated Factory' }
  $mutated=$artifacts[1]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  (@($mutated.abi|Where-Object { $_.type-eq'function'-and$_.name-eq'authoritySnapshot' })[0]).outputs[26].type='uint128'
  Assert-Rejected 'flat snapshot type/order' { Assert-AbiFingerprint $mutated $abiHashes[1] 'mutated Authority' }
  $mutated=$artifacts[1]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  (@($mutated.abi|Where-Object { $_.type-eq'function'-and$_.name-eq'authorityTopology' })[0]).outputs[0].name='wrongFactory'
  Assert-Rejected 'ABI output name' { Assert-AbiFingerprint $mutated $abiHashes[1] 'mutated Authority' }
  $mutated=$artifacts[1]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  (@($mutated.abi|Where-Object { $_.type-eq'error'-and$_.name-eq'AuthorityPeerMismatch' })[0]).inputs[0].type='uint16'
  Assert-Rejected 'error descriptor/type' { Assert-AbiFingerprint $mutated $abiHashes[1] 'mutated Authority' }
  $mutated=$artifacts[1]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  (@($mutated.abi|Where-Object type -eq 'constructor')[0]).inputs[0].name='wrongFactory'
  Assert-Rejected 'constructor input identity' { Assert-AbiFingerprint $mutated $abiHashes[1] 'mutated Authority' }
  $mutatedLayout=$authorityLayout|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutatedLayout.storage[0].slot='1'
  Assert-Rejected 'storage slot' { Assert-StorageRows $mutatedLayout $authorityRows 'mutated Authority' }
  $mutatedLayout=$authorityLayout|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutatedLayout.storage[0].label='_wrong'
  Assert-Rejected 'storage label' { Assert-StorageRows $mutatedLayout $authorityRows 'mutated Authority' }
  $mutatedLayout=$authorityLayout|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutatedLayout.storage[4].offset=19
  Assert-Rejected 'storage packing offset' { Assert-StorageRows $mutatedLayout $authorityRows 'mutated Authority' }
  $mutatedLayout=$authorityLayout|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutatedLayout.storage[0].type='t_bytes32'
  Assert-Rejected 'storage compiler type id' { Assert-StorageRows $mutatedLayout $authorityRows 'mutated Authority' }
  $mutatedLayout=$authorityLayout|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutatedLayout.types.psobject.Properties[$mutatedLayout.storage[0].type].Value.numberOfBytes='31'
  Assert-Rejected 'storage byte width' { Assert-StorageRows $mutatedLayout $authorityRows 'mutated Authority' }
  $mutatedLayout=$authorityLayout|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutatedLayout.types.psobject.Properties[$mutatedLayout.storage[0].type].Value.encoding='inplace'
  Assert-Rejected 'storage encoding' { Assert-StorageRows $mutatedLayout $authorityRows 'mutated Authority' }
  $mutatedLayout=$authorityLayout|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutatedLayout.storage=@($mutatedLayout.storage)+@($mutatedLayout.storage[0])
  Assert-Rejected 'unexpected storage row' { Assert-StorageRows $mutatedLayout $authorityRows 'mutated Authority' }
  $mutatedLayout=$authorityLayout|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutatedLayout.storage=@($mutatedLayout.storage|Select-Object -Skip 1)
  Assert-Rejected 'missing storage row' { Assert-StorageRows $mutatedLayout $authorityRows 'mutated Authority' }
  $mutatedLayout=$authorityLayout|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  $mutatedLayout.types.psobject.Properties['t_struct(PendingIngressProposal)10844_storage'].Value.members[3].type='t_bytes32'
  Assert-Rejected 'recursive storage member type' {
    Assert-StorageTypeSchema $mutatedLayout $authorityTypeSchemas[2] 'mutated Authority'
  }
  $mutatedLayout=$authorityLayout|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  $mutatedLayout.types.psobject.Properties['t_mapping(t_uint256,t_struct(IngressRecord)10861_storage)'].Value.value='t_bytes32'
  Assert-Rejected 'storage mapping value type' {
    Assert-StorageTypeSchema $mutatedLayout $authorityTypeSchemas[4] 'mutated Authority'
  }
  Assert-Rejected 'function selector collision' { Assert-DescriptorUniverse @('burn(uint256)','collate_propagate_storage(bytes16)') 'function-selftest' 2 }
  Assert-Rejected 'error selector collision' { Assert-DescriptorUniverse @('burn(uint256)','collate_propagate_storage(bytes16)') 'error-selftest' 2 }
  Assert-Rejected 'event duplicate' { Assert-DescriptorUniverse @('X(uint256)','X(uint256)') 'event' 2 }
  Assert-Rejected 'illegal error duplicate' { Assert-DescriptorUniverse @('X()','X()') 'error-selftest' 2 $true }
  Assert-DescriptorUniverse @('ReentrancyGuardReentrantCall()','ReentrancyGuardReentrantCall()') 'error-selftest' 2 $true
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutated.metadata.compiler.version='0.8.27+commit.00000000'
  Assert-Rejected 'compiler version' { Assert-MetadataProvenance $mutated $sources[0] $contracts[0] $sourceHashes[0] $true $false }
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutated.metadata.settings.viaIR=$false
  Assert-Rejected 'viaIR profile' { Assert-MetadataProvenance $mutated $sources[0] $contracts[0] $sourceHashes[0] $true $false }
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutated.metadata.settings.optimizer.runs=801
  Assert-Rejected 'optimizer runs' { Assert-MetadataProvenance $mutated $sources[0] $contracts[0] $sourceHashes[0] $true $false }
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$targetProperty=@($mutated.metadata.settings.compilationTarget.psobject.Properties)[0];$targetProperty.Value='WrongFactory'
  Assert-Rejected 'compilationTarget' { Assert-MetadataProvenance $mutated $sources[0] $contracts[0] $sourceHashes[0] $true $false }
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$sourceProperty=@($mutated.metadata.sources.psobject.Properties)[0];$sourceProperty.Value.keccak256='0x'+('00'*32)
  Assert-Rejected 'source hash/set' { Assert-MetadataProvenance $mutated $sources[0] $contracts[0] $sourceHashes[0] $true $false }
  $toml=Get-Content -LiteralPath $config -Raw
  Assert-Rejected 'compiler restriction setting' { Assert-Task2CompilerConfiguration ($toml -replace 'via_ir = true','via_ir = false') $legacy }
  Assert-Rejected 'compiler restriction path' { Assert-Task2CompilerConfiguration ($toml -replace 'src/AcquisitionVaultCore.sol','src/WrongCore.sol') $legacy }
  $legacyViaIr=$legacy|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  $legacyViaIr.metadata.settings|Add-Member -NotePropertyName viaIR -NotePropertyValue $true -Force
  Assert-Rejected 'legacy Vault viaIR' { Assert-Task2CompilerConfiguration $toml $legacyViaIr }
  Assert-Rejected 'Factory snapshot gas mutation' { Assert-Task2FactoryIr ($factoryIr -replace 'staticcall\(160000','staticcall(160001') }
  Assert-Rejected 'Factory returndata-copy mutation' { Assert-Task2FactoryIr ($factoryIr+' returndatacopy(0,0,returndatasize())') }
  Assert-Rejected 'Authority CALL mutation' { Assert-Task2AuthorityIr ($authorityIr+' call(1,2,3,4,5,6,7)') }
  Assert-Rejected 'immutable reference length' { Assert-ReferenceSet $artifacts[0] @($factoryExpected[0..4]+@('926:31,4037:32')) 'mutated Factory' }
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  $firstImmutable=@($mutated.deployedBytecode.immutableReferences.psobject.Properties|Select-Object -First 1)[0];$firstImmutable.Value[0].start=[int]$firstImmutable.Value[0].start+1
  Assert-Rejected 'immutable reference start' { Assert-ReferenceSet $mutated $factoryExpected 'mutated Factory' }
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100
  $firstImmutable=@($mutated.deployedBytecode.immutableReferences.psobject.Properties|Select-Object -First 1)[0];$mutated.deployedBytecode.immutableReferences.psobject.Properties.Remove($firstImmutable.Name)
  Assert-Rejected 'immutable reference missing' { Assert-ReferenceSet $mutated $factoryExpected 'mutated Factory' }
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutated.deployedBytecode.object='0x00'+$mutated.deployedBytecode.object.Substring(4)
  Assert-Rejected 'creation/runtime split' { $null=Get-ExecutableParts $mutated 'mutated Factory' }
  $mutated=$artifacts[0]|ConvertTo-Json -Depth 100|ConvertFrom-Json -Depth 100;$mutated.bytecode.object='0x00'+$mutated.bytecode.object.Substring(4)
  Assert-Rejected 'isolated build identity mismatch' { Assert-IsolatedArtifactMatch $mutated $isolatedArtifacts[0] $abiHashes[0] 'mutated Factory' }
  $scannerExecutableRejected=Has-Prohibited @(Scan-Opcodes '0xf4');$scannerPushDataPassed=-not(Has-Prohibited @(Scan-Opcodes '0x60f4'))
  $scannerTruncatedRejected=$false;try{$null=Scan-Opcodes '0x62aabb'}catch{$scannerTruncatedRejected=$true}
  $metadataRejected=$false;try{$null=Strip-SolidityMetadata '0x6000ffff'}catch{$metadataRejected=$true}
  if(-not$scannerExecutableRejected-or-not$scannerPushDataPassed-or-not$scannerTruncatedRejected-or-not$metadataRejected){throw 'Task2 opcode/metadata negative selftest failed.'}

  Write-Output 'Task2 ABI: aggregate=62/102/24/6/194 collisionUniverses=64/108/25 snapshot=27-static-words'
  Write-Output 'Task2 storage: Factory=5 rows through slot15; Authority=17 rows with semantic roots through mapping slot29'
  Write-Output 'Task2 bytecode: Factory=7196/5484 Authority=18629/16068 leaves<=676/473; isolated IR/opcode/source/profile checks passed'
}

$constellationArtifactNames = @(
  'AcquisitionConstellationFactory','AcquisitionAuthority','AcquisitionVaultCore','PreVoteBudgetBook',
  'AcquisitionIntentExecution','AcquisitionReconciliation'
)
$candidateKinds = @()
if (Test-Path -LiteralPath $ArtifactsRoot -PathType Container) {
  foreach ($name in $constellationArtifactNames) {
    if (@(Get-ChildItem -LiteralPath $ArtifactsRoot -Recurse -File -Filter ($name + '.json')).Count -gt 0) {
      $candidateKinds += $name
    }
  }
}
if ($candidateKinds.Count -eq 0) {
  if ($ExpectTask0Red) { Write-Output 'Task 0 RED verified: exact six final artifacts absent; legacy/self checks passed.'; Exit-Verified 0 }
  [Console]::Error.WriteLine('Task 0 RED: exact six final artifacts are absent. Re-run with -ExpectTask0Red only at the Task 0 boundary.')
  Exit-Verified $redExitCode
}
if ($candidateKinds.Count -ne 6) {
  [Console]::Error.WriteLine("Partial constellation artifact set: $($candidateKinds.Count) of 6 contract kinds.")
  Exit-Verified 43
}
try { Assert-CanonicalArtifactLayout $finalArtifacts } catch { Fail $_.Exception.Message 1 }
if ($ValidatePhase -eq 'Task2') {
  try { Invoke-Task2Validation } catch { Fail $_.Exception.Message 1 }
  if ($ExpectTask0Red) {
    [Console]::Error.WriteLine('-ExpectTask0Red rejects a complete conforming Task 2 artifact set.')
    Exit-Verified 44
  }
  Write-Output 'Task 2 GREEN: exact phase, artifacts, ABI/collisions, storage/immutables, provenance, sizes, and compiler call policy passed.'
  Exit-Verified 0
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
  if(-not [string]::Equals([string]$sourceEntry.keccak256,$FrozenHash,[StringComparison]::OrdinalIgnoreCase)){throw "$Name reviewed source hash drift."}
  $localPath=Join-Path $artifactProjectRoot $Source
  if(-not(Test-Path -LiteralPath $localPath -PathType Leaf)){throw "$Name local source missing."}
  $nodeScript="const fs=require('fs');const{keccak256,toHex}=require('viem');const s=fs.readFileSync(process.argv[1],'utf8').replace(/\r\n/g,'\n');process.stdout.write(keccak256(toHex(Buffer.from(s))));"
  Push-Location -LiteralPath $verifierRepo
  try{$localHash=(& $NodePath -e $nodeScript $localPath 2>&1)-join'';$nodeExit=$LASTEXITCODE}finally{Pop-Location}
  if($nodeExit-ne0-or-not[string]::Equals($localHash,$FrozenHash,[StringComparison]::OrdinalIgnoreCase)){throw "$Name local source hash provenance drift."}
  $sourceNames=@($metadata.sources.psobject.Properties.Name)
  if($sourceNames.Count-ne1-or-not [string]::Equals($sourceNames[0],$Source,[StringComparison]::Ordinal)){throw "$Name reviewed production source set drift."}
  if($metadata.compiler.version-notmatch'^0.8.26\+commit\.'){throw "$Name compiler provenance drift."}
  if($metadata.settings.optimizer.enabled-ne$true-or$metadata.settings.optimizer.runs-ne800-or$metadata.settings.evmVersion-ne'cancun'-or$metadata.settings.viaIR-eq$true){throw "$Name build settings provenance drift."}
  $targets=@($metadata.settings.compilationTarget.psobject.Properties)
  $targetContract=[IO.Path]::GetFileNameWithoutExtension($Source)
  if($targets.Count-ne1-or-not[string]::Equals($targets[0].Name,$Source,[StringComparison]::Ordinal)-or-not[string]::Equals($targets[0].Value,$targetContract,[StringComparison]::Ordinal)){throw "$Name compilationTarget provenance drift."}
}

function Assert-FactoryCompilerPolicy([string]$Ir) {
  $clean=[regex]::Replace($Ir,'/\*\*.*?\*/','',[Text.RegularExpressions.RegexOptions]::Singleline)
  $clean=[regex]::Replace($clean,'\s+',' ')
  $phase=$Ir.IndexOf('0:7068:7074  "_phase"',[StringComparison]::Ordinal);$create=$Ir.IndexOf('let var_child := create(',[StringComparison]::Ordinal)
  if($phase-lt0-or$phase-ge$create-or-not[regex]::IsMatch($clean,'let _1 := 0 .*create\( _1, add\(var_creation_mpos, 32\), mload\(var_creation_mpos\)\)')){throw 'Factory compiler phase-before-zero-value-CREATE drift.'}
  if(([regex]::Matches($clean,'(?<!static)call\( 100000, [^,]+, 0, [^,]+, [^,]+, 0, 0\)')).Count-ne5){throw 'Factory compiler finalizer CALL schema/count drift.'}
  if(([regex]::Matches($clean,'staticcall\(100000, [^,]+, 0, (0x04|4), 0, (0x20|32)\)')).Count-ne2){throw 'Factory compiler Registry STATICCALL schema/count drift.'}
  if(([regex]::Matches($clean,'staticcall\(50000, [^,]+, usr\$buffer, 0x04, usr\$buffer, 0x60\)')).Count-ne2){throw 'Factory compiler topology STATICCALL schema/count drift.'}
  if(([regex]::Matches($clean,'let _[0-9]+ := gas\(\)')).Count-ne5-or([regex]::Matches($clean,'let var_afterGas(_[0-9]+)? := gas\(\)')).Count-ne5){throw 'Factory compiler immediate gas checkpoint drift.'}
  if(([regex]::Matches($clean,'returndatasize\(\)')).Count-ne9){throw 'Factory compiler bounded returndata observation drift.'}
  if($Ir-match'(?im)\breturndatacopy\s*\('){throw 'Factory dynamic returndata copying drift.'}
  if($Ir-match'(?im)\b(delegatecall|callcode|create2|selfdestruct)\s*\('){throw 'Factory prohibited compiler callsite.'}
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
  Assert-SourceProvenance $factory 'src/AcquisitionConstellationFactory.sol' 'Factory' '0xa2b8fb06ca07ba5ad29e9ed05654174fc73c74b7cd2729ea57ae56997071d742'
  Assert-AbiNames $factory 'factoryState' @() @('manifestHash','deploymentCommitment','phase','nextChildIndex','safe','configurationRoot','registry','registryRuntimeHash')
  Assert-AbiNames $factory 'childCommitment' @('index') @('child','initcodeHash','runtimeHash')
  Assert-AbiNames $factory 'deployNext' @('initcode') @('child')
  Assert-AbiNames $factory 'finalizeConstellation' @() @()
  $factoryIr=Invoke-IsolatedForgeInspect 'AcquisitionConstellationFactory' 'irOptimized'
  Assert-FactoryCompilerPolicy $factoryIr
  $isolatedFactoryPath=Join-Path (Join-Path $script:isolatedRoot 'out') 'AcquisitionConstellationFactory.sol/AcquisitionConstellationFactory.json'
  $isolatedFactory=Get-Content -LiteralPath $isolatedFactoryPath -Raw|ConvertFrom-Json -Depth 100
  Assert-PortableIsolatedArtifactMatch $factory $isolatedFactory 'Task1 AcquisitionConstellationFactory'
  function Assert-RejectedIrMutation([string]$Label,[string]$MutatedIr){$rejected=$false;try{Assert-FactoryCompilerPolicy $MutatedIr}catch{$rejected=$true};if(-not$rejected){throw "Compiler-policy negative selftest failed: $Label"}}
  Assert-RejectedIrMutation 'phase-after-CREATE' ($factoryIr.Replace('0:7068:7074  "_phase"','0:99999:99999  "movedPhase"')+' 0:7068:7074  "_phase"')
  Assert-RejectedIrMutation 'nonzero-CREATE-value' ($factoryIr.Replace('let var_child := create(','let var_child := create(1, pop('))
  Assert-RejectedIrMutation 'wrong-finalizer-gas' ($factoryIr.Replace('call(/** @src 0:10965:11185  "assembly (\"memory-safe\") {..." */ 100000','call(/** @src 0:10965:11185  "assembly (\"memory-safe\") {..." */ 99999'))
  Assert-RejectedIrMutation 'wrong-topology-gas' ($factoryIr.Replace('staticcall(50000','staticcall(49999'))
  Assert-RejectedIrMutation 'dynamic-returndata-copy' ($factoryIr+' returndatacopy(0,0,returndatasize())')
  Assert-RejectedIrMutation 'prohibited-delegatecall' ($factoryIr+' delegatecall(1,2,3,4,5,6)')
  Assert-ImmutableReferences $factory '1262:32;470:32,540:32,595:32,738:32,1332:32;630:32,682:32,1367:32;1297:32;924:32,1143:32,2720:32,3158:32;890:32,1176:32' 'Factory'
  $factoryLayoutText=Invoke-IsolatedForgeInspect 'AcquisitionConstellationFactory' 'storageLayout' -Json
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
    $layoutText=Invoke-IsolatedForgeInspect $spec.Name 'storageLayout' -Json
    $layout=$layoutText|ConvertFrom-Json -Depth 100
    $isolatedChildPath=Join-Path (Join-Path $script:isolatedRoot 'out') ($spec.Name+'.sol/'+$spec.Name+'.json')
    $isolatedChild=Get-Content -LiteralPath $isolatedChildPath -Raw|ConvertFrom-Json -Depth 100
    Assert-PortableIsolatedArtifactMatch $artifact $isolatedChild ('Task1 '+$spec.Name)
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
  Exit-Verified 44
}
Write-Output 'Task 1 GREEN: exact six-artifact ABI, constructor, payable/fallback, size, suffix, and opcode conformance passed.'
Exit-Verified 0
