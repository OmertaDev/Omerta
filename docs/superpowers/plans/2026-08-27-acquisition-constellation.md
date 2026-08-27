# Acquisition Constellation Architecture Amendment

**Status:** normative architecture amendment, implementation pending

**Supersedes:** the final-monolithic `AcquisitionVault`, inline Task 6, no-intermediate-deployment, aggregate-constructor, `deployAll`, proxy, and recursive runtime-hash assumptions in the O1/A1 plan
**Historical reference:** Task 5 commit `6e066ffabab0b0f63ac06be141d501474588aace`, runtime 23,212 bytes, is a dormant and nondeployable behavioral oracle. Independent review remains pending. It is not final A1 approval.

## 1. Decision and invariants

A1/A3/R/O2 are implemented as an immutable, non-proxy constellation. No child
uses a proxy, fallback, receive, `delegatecall`, generic executor, upgrade hook,
mutable library pointer, or role mirror. The deploy graph contains one manifest
factory and exactly five children:

1. `AcquisitionConstellationFactory` — manifest and phased deployer only.
2. `AcquisitionAuthority` — Safe ownership, pause, operator and ingress authority.
3. `AcquisitionVaultCore` — sole ETH/accounting writer and Stock Token custodian.
4. `PreVoteBudgetBook` — immutable budget evidence only.
5. `AcquisitionIntentExecution` — intents, routes, attempts, and execution metadata.
6. `AcquisitionReconciliation` — reconciliation evidence, dispositions, incidents.

The factory and every child runtime must each be at most 24,576 bytes, and the
factory and every child initcode must each be at most 49,152 bytes. All child
mutators remain dormant until one atomic factory finalization succeeds. The Task
5 monolith is retired from the deploy graph after its behavior is cross-walked
and reproduced.

## 2. Exclusive ownership of state and behavior

### 2.1 AcquisitionAuthority

Authority alone stores `Ownable2Step` Safe state, pause state, active and pending
operator state, operator generations, the shared ordinary-O2 nonce, a separate
relayed-cancellation nonce, and the complete active/pending ingress lifecycle.
It stores no ETH bucket, cap total, deposit record, reservation, liability,
reconciliation backing, Stock Token balance, or financial aggregate.

Authority exposes one exact bounded snapshot. Every consumer reads that snapshot;
no module stores owner, pending owner, operator, pending operator, pause, operator
generation, or ingress-generation copies. `owner` never equals `pendingOwner`.
All proposal and acceptance paths recheck full reciprocal disjointness among:

- owner and pending owner;
- active and pending operator;
- active and pending ingress;
- the factory and all five child addresses.

Ownership acceptance preserves active and pending ingress and cancels only the
pending operator nomination. Ingress cancel, permissionless expiry, and disable
remain live despite runtime drift or health failures.

The pause matrix is exact:

| Operation | Pause rule |
|---|---|
| create intent, execute attempt, authorize budget, relayed O2 | unpaused |
| direct O2 | allowed while paused and while live `D` and/or `S` exists; limited only by the actual-balance ceiling and its frozen authorization/accounting rules |
| deposit, refund, repair, balance sync, Safe reclassification | pause-independent |
| direct/relayed intent cancellation and intent expiry | pause-independent |
| ingress propose, cancel, permissionless expiry, and disable | pause-independent |
| ingress activation | current-Safe-only and paused-only |
| reconciliation evidence and final disposition | pause-independent |
| unpause | current-Safe-only, bounded readiness snapshot |

The unpause snapshot is closed and complete. In one bounded evaluation it
enumerates every finalized child and required external peer, verifies the
factory-committed addresses, runtime hashes, immutable bindings, and reciprocal
topology, proves one healthy code-matching active ingress and no pending ingress,
rechecks every reciprocal role collision, requires current `D == 0` and `S == 0`,
and composes every still-active manual, security, health, stale-mirror,
quarantine, and incident blocker. Passing only the accounting or ingress subset
cannot unpause.

### 2.2 AcquisitionVaultCore

Core is the sole holder of native ETH and the sole writer of `A/U/R/L/P`, the
accounting sequence, canonical deposit/cap totals, minimal financial records,
and tombstones. It is the eventual origin of every native transfer. It contains
no owner/operator/pause/ingress role copies and accepts authority only through
typed calls plus an exact fresh Authority snapshot.

Core is also the only hold-only Stock Token custodian and aggregate writer. It
stores per-version accounted stock, fills, `unattributedStock`, and negative-drift
observations. It has no token transfer, approval, permit, sweep, sale, recovery,
or generic call surface. Reconciliation may mirror evidence but never owns these
totals or custody.

### 2.3 PreVoteBudgetBook

BudgetBook owns immutable pre-vote authorization records only, exactly one per
`ballotDay`. It has no consumption state, tombstone, cancellation, rewrite,
replacement, or reservation behavior. It never holds funds and never writes
Core bucket totals. Intent and the finalized CB consumer separately prove and
join use of the immutable authorization; neither may rewrite BudgetBook.

### 2.4 AcquisitionIntentExecution

Intent owns rich intent, oracle, adapter, route, attempt-index, and execution
metadata. It holds no funds, Stock Tokens, or native bucket totals.

### 2.5 AcquisitionReconciliation

Reconciliation owns rich attempt observations, evidence, dispositions, repair
causes, and incidents. It owns no native totals or custody. It mirrors financial
evidence emitted by Core without becoming an accounting authority.

## 3. Deployment manifest and finalization

### 3.0 Task 1 exact deployment freeze

Task 1 uses two nonrecursive commitments. `manifestHash` is the sole child-bound
constellation identity:

```text
TASK1_CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK1_CONFIG_V1")
configurationRoot = keccak256(abi.encode(
  TASK1_CONFIG_TAG, uint256(1), registry, registryRuntimeHash
))

CONSTELLATION_TAG = keccak256("OMERTA_ACQUISITION_CONSTELLATION_V1")
manifestHash = keccak256(abi.encode(
  CONSTELLATION_TAG, uint256(4663), factory, safe, configurationRoot,
  registry, registryRuntimeHash,
  authority, core, budgetBook, intentExecution, reconciliation
))

DEPLOYMENT_TAG = keccak256("OMERTA_ACQUISITION_DEPLOYMENT_V1")
deploymentCommitment = keccak256(abi.encode(
  DEPLOYMENT_TAG, manifestHash, childInitcodeHashes, childRuntimeHashes
))
```

`manifestHash` excludes every child/factory initcode, runtime, and deployment
hash. Later tasks must version and amend the configuration schema; Task 1's root
is reproducible rather than opaque.

The Factory constructor is exactly:

```solidity
constructor(
  address safe,
  address registry,
  bytes32 registryRuntimeHash,
  bytes32[5] childInitcodeHashes,
  bytes32[5] childRuntimeHashes
)
```

It derives `configurationRoot`, predicted children, `manifestHash`, and
`deploymentCommitment`. Child order and Factory CREATE nonces are Authority/1,
Core/2, BudgetBook/3, Intent/4, Reconciliation/5. For each nonce 1..5 the exact
address is the low 20 bytes of `keccak256(0xd6 || 0x94 || factory || uint8(nonce))`.

The exact Factory phase ordinals are `DEPLOYING=0`, `DEPLOYING_CHILD=1`,
`READY_TO_FINALIZE=2`, `FINALIZING=3`, and `FINALIZED=4`. `deployNext` sets
`DEPLOYING_CHILD` before the sole raw zero-value CREATE and rolls back to the
prior state on any failure. A successful nonfinal child returns to `DEPLOYING`;
the fifth enters `READY_TO_FINALIZE`. Finalization order is fixed as
BudgetBook -> Reconciliation -> Intent -> Core -> Authority.

Factory views and mutators are exactly:

```solidity
function factoryState() external view returns (
  bytes32 manifestHash, bytes32 deploymentCommitment, uint8 phase,
  uint8 nextChildIndex, address safe, bytes32 configurationRoot,
  address registry, bytes32 registryRuntimeHash
);
function childCommitment(uint8 index) external view returns (
  address child, bytes32 initcodeHash, bytes32 runtimeHash
);
function deployNext(bytes calldata initcode) external returns (address child);
function finalizeConstellation() external;
```

Factory errors are the closed set:

```solidity
error WrongChain(uint256 actualChainId);
error RegistryChainMismatch(uint256 actualChainId);
error FactorySafeZero(); error FactoryRegistryZero();
error FactorySafeCodeMissing(address safe); error FactoryRegistryCodeMissing(address registry);
error FactoryRoleCollision(address candidate);
error FactoryRegistryRuntimeHashMismatch(bytes32 expected, bytes32 actual);
error FactoryRegistryCallFailed(); error FactoryRegistryReturnLength(uint256 actual);
error FactoryPhaseMismatch(uint8 expected, uint8 actual); error FactoryChildIndex(uint8 index);
error FactoryChildInitcodeHashZero(uint8 index); error FactoryChildRuntimeHashZero(uint8 index);
error FactoryInitcodeEmpty(uint8 index); error FactoryInitcodeTooLarge(uint8 index, uint256 actual);
error FactoryInitcodeHashMismatch(uint8 index, bytes32 expected, bytes32 actual);
error FactoryCreateFailed(uint8 index);
error FactoryChildAddressMismatch(uint8 index, address expected, address actual);
error FactoryRuntimeTooLarge(uint8 index, uint256 actual);
error FactoryRuntimeHashMismatch(uint8 index, bytes32 expected, bytes32 actual);
error FactoryTopologyCallFailed(uint8 index); error FactoryTopologyReturnLength(uint8 index, uint256 actual);
error FactoryTopologySemanticMismatch(uint8 index);
error FactoryPostCallGasInsufficient(uint8 index, uint256 available, uint256 required);
error FactoryFinalizerCallFailed(uint8 index); error FactoryFinalizerReturnLength(uint8 index, uint256 actual);
error FactoryFinalizerSemanticMismatch(uint8 index);
```

Factory events are exactly:

```solidity
event ChildDeployed(
  uint8 indexed index, address indexed child,
  bytes32 indexed initcodeHash, bytes32 runtimeHash
);
event ConstellationFinalized(
  bytes32 indexed manifestHash, bytes32 indexed deploymentCommitment
);
```

Constructor validation precedence is a literal closed ladder. Factory first
checks wrong chain, Safe zero, Registry zero, Safe code, then Registry code. It
then derives predicted children 0..4 from Factory CREATE nonces 1..5; this
address derivation occurs before collision validation but does not construct any
commitment. Collision checks use `FactoryRoleCollision(candidate)` in this exact
order: `safe == registry` with `candidate=safe`; `safe == factory` with
`candidate=safe`; `registry == factory` with `candidate=registry`; then for each
child index 0..4 in order, `safe == predictedChild[index]` with `candidate=safe`
followed by `registry == predictedChild[index]` with `candidate=registry`.
Because the code checks precede collisions, a Safe equal to the constructing
Factory is normally rejected first as `FactorySafeCodeMissing`; the later
collision branch remains an explicit invariant-harness case rather than changing
precedence. Factory next checks Registry runtime hash, child initcode hashes 0..4
for zero in order, child runtime hashes 0..4 for zero in order, Registry call
success, exact return length, and the legacy `RegistryChainMismatch(uint256)`
for the sole well-formed wrong-chain result. Only after the full ladder succeeds
does it construct `configurationRoot`, `manifestHash`, and
`deploymentCommitment`.
`deployNext` checks phase, index, nonempty initcode, size, hash, then enters
`DEPLOYING_CHILD`, CREATEs, and checks create success, expected address, runtime
size/hash, topology call, exact 96-byte return, and tuple semantics before phase
advance/event.

`finalizeConstellation` has one exact validation order. It checks phase equals
`READY_TO_FINALIZE`; checks `nextChildIndex == 5`, with any count inconsistency
reported as `FactoryChildIndex(nextChildIndex)`; then checks children 0..4 in
index order at the fixed predicted address returned by `childCommitment`.
Factory first reads `actualExtcodehash = extcodehash(predictedChild)`. Before
runtime size, the general runtime-hash comparison, or any topology call, an
`actualExtcodehash` of `bytes32(0)` (nonexistent account) or
`keccak256(bytes(""))` (existing account with empty code) reverts as
`FactoryRuntimeHashMismatch(index, expectedRuntimeHash, actualExtcodehash)`.
For nonempty code it then checks runtime size, checks actual versus expected
runtime hash, and checks topology call success, exact 96-byte return, and exact
tuple semantics, in that order.
It next checks Registry code, runtime hash, STATICCALL success, exact 32-byte
return, and chain result. Only then does it set `FINALIZING`. It invokes
finalizers in indices `2,4,3,1,0` (BudgetBook, Reconciliation, Intent, Core,
Authority). For each it applies the exact gas precheck below, performs the CALL,
immediately applies the post-call reserve check before interpreting CALL success
or returndata, then checks success, exact zero-length returndata, and the
post-finalizer topology call/length/tuple with `finalized=true`. After all five,
it rechecks all five finalized flags, sets `FINALIZED`, and emits
`ConstellationFinalized`. This ordering is normative error precedence; any
failure atomically rolls back phase and every child finalization.

Failures are normalized to the distinct errors above and never bubble or copy
dynamic peer revert data. `FactoryChildAddressMismatch` applies only immediately
after raw CREATE when its returned address differs from the deterministic
predicted address; it is a deterministic ordinary-CREATE-address invariant
harness and is not a finalization branch. Finalization has no redundant stored
“actual child” address to compare: `childCommitment` fixes the predicted identity
used for every recheck. `FactoryRuntimeTooLarge` is an EIP-170 invariant harness,
and the READY/count use of `FactoryChildIndex` covers
an otherwise unreachable phase/count-corruption fixture (the same error remains
normally reachable from an out-of-range `childCommitment` query). Other declared
errors have direct input, dependency, child-behavior, timing, or injected
committed-code branches; tests must not mislabel the two invariant-only errors
or the count-corruption branch as ordinary production reachability.

Registry construction/finalization STATICCALL uses 100,000 gas and exact 32-byte
return. Topology STATICCALL uses 50,000 gas and a fixed 96-byte output area.
Finalizer CALL uses `FINALIZER_CALL_GAS = 100_000`, value zero, and a zero-length
output area. “Zero returndata copying” applies only to that CALL: there is no
dynamic `RETURNDATACOPY` and no revert-data copy or bubbling. It does not apply
to the topology STATICCALL's necessary fixed 96-byte output.

The frozen reserve constants are `FINALIZER_POST_CALL_RESERVE = 100_000`,
`FINALIZER_PRECALL_OVERHEAD = 10_000`, and
`FINALIZER_EIP150_HEADROOM = ceil(100_000 / 63) = 1_588`. Immediately before
each finalizer CALL, Factory requires
`gasleft() >= 100_000 + 100_000 + 10_000 + 1_588 = 211_588`; the 10,000 allowance
conservatively includes CALL base cost, cold-account access, memory, argument,
and intervening opcode costs. The EIP-150 headroom is separately explicit.
This precheck is not treated as proof that the reserve survived. Immediately
after CALL returns—and before checking its success bit, returndata size, or any
semantic result—Factory independently requires `gasleft() >= 100_000`.
Both failures use `FactoryPostCallGasInsufficient(index, available, required)`,
with `required=211_588` at the precheck and `required=100_000` at the postcheck.
Boundary and mutation tests cover 211,587/211,588 as `gasleft()` observed
immediately at the precheck, 99,999/100,000 on return, maximum
cold-access/intervening overhead, EIP-150 forwarding, child
consumption of its complete cap, and the precedence of postcheck over CALL
failure/returndata interpretation.

Compiler-stable seam tests use internal pure predicates
`_hasFinalizerPrecheckGas(uint256 available)` (`available >= 211_588`) and
`_hasFinalizerPostcheckGas(uint256 available)` (`available >= 100_000`). A
test-only derived harness may expose those predicates, but neither selector is
present in production ABI. Production still snapshots `gasleft()` immediately
at the pre-CALL assembly checkpoint and immediately after CALL at the post-CALL
assembly checkpoint, then applies the corresponding predicate with no external
operation between observation and decision. The post-call boundary additionally
uses a bounded injected/capped-call harness that can leave exactly 99,999 or
100,000 gas at that checkpoint. Tests assert the exact `available` and `required`
payloads, not only the error selector; harness code is excluded from production.

Task 1 children are topology shells. Every constructor is exactly
`(address factory, bytes32 manifestHash)`, makes no peer call, and stores no peer,
Safe, Registry, owner, pause, operator, ingress, accounting, or business state.
Each child has a unique zero-factory and zero-manifest constructor error, the
already-frozen unique topology getter/finalizer/errors/event, and `finalized=false`.
Reciprocal bindings are indirect through manifest/initcode/runtime commitments
and reviewed build provenance. Later business tasks add exact peer immutables.
Every child finalizer uses the same exact validation precedence: caller is the
Factory, supplied manifest equals the immutable manifest, then the child is not
already finalized. Thus a wrong caller wins over a wrong hash or repeat call; a
wrong hash wins over `AlreadyFinalized`; only after all three checks does the
child set its flag and emit its unique finalized event. Tests assert all
overlapping-condition precedence cases.

The ten constructor errors are exactly:

```solidity
error AuthorityFactoryZero(); error AuthorityManifestHashZero();
error CoreFactoryZero(); error CoreManifestHashZero();
error BudgetBookFactoryZero(); error BudgetBookManifestHashZero();
error IntentExecutionFactoryZero(); error IntentExecutionManifestHashZero();
error ReconciliationFactoryZero(); error ReconciliationManifestHashZero();
```

Task 1 onchain proof is limited to Factory/manifest/finalized topology, exact
addresses and runtime commitments, dormant ABI, Registry identity/runtime/chain,
and balance-independent deployment/finalization. Constructor call absence,
source provenance, storage layout, immutables, opcode posture, and nondelegating
Registry code are build/review proofs. Safe is a code-present governance
principal and may be a recognized proxy; it has no runtime pin or perpetual
health gate. Registry is the sole Task 1 result dependency. CB/health, canonical
ingress, oracle, adapter, and Stock Token are absent and deferred to versioned
later nodes.

Forced ETH at Factory and every predicted child is ignored. Non-Core balances
are inert and unrecoverable. Core makes no Task 1 accounting claim; the later
accounting node preserves the oracle that its initial stored buckets are zero
while `V=F`, then first sync maps `F -> U`.

The factory is small and is deployed with ordinary `CREATE` from an exact known
deployer and nonce. Its constructor commits:

- chain ID, Safe, and configuration root;
- the ordered five child initcode hashes;
- the expected sequential `CREATE` child addresses;
- each expected child runtime hash.

There is no aggregate child constructor, `deployAll`, `CREATE2` circular address
derivation, or recursive peer-runtime-hash embedding. Permissionless,
phase-ordered `deployNext(bytes initcode)` performs exactly one raw sequential
`CREATE` with value zero and only when the supplied initcode hash equals the next
committed hash. Before advancing the phase it requires the returned address to
equal the next committed child address and the deployed runtime hash to equal
that child's committed runtime hash. Front-running the exact bytes is harmless;
altered bytes, a wrong returned address, or a wrong runtime hash revert without
phase advancement.

Child constructors store immutables only, make zero peer calls, and remain
dormant. No runtime-affecting child immutable, constructor commitment, or child
initcode branch may derive from mutable block context such as timestamp, block
number, coinbase, base fee, gas price, or prevrandao. After all five exist, one
atomic Task 1 finalization relies on the successful deploy phase/index transition
plus tracked build provenance for the already consumed initcode; vanished
initcode cannot be reread, rehashed, or remeasured. Onchain finalization rechecks
only each exact address, extcodesize/runtime bound, extcodehash/runtime hash, and
topology tuple/manifest binding before activating the topology shells. Task 1
does not claim or inspect nonexistent logical, accounting, owner, pause,
operator, ingress, or other business-zero state. Those are future
production-node obligations with their own versioned ABI and tests. Any
verification or activation failure rolls back the entire activation. A wrong or
incomplete already-created constellation stays inert. After finalization, the
factory has no configuration, economic, role, redeployment, or recovery power.

Forced ETH cannot block deployment or finalization. Task 1 Core is only a
topology shell and has no buckets, sequence, records, or `V/F/U` accounting. The
future Core accounting node must begin its introduced stored buckets, sequence,
and records at zero while `V == F`, with its first sync mapping all `F -> U`.
Forced balances at noncustodial children are inert and permanently unrecoverable.

Peer authenticity uses exact addresses, the finalized factory manifest/codehash,
and launch-attested nonproxy/nondelegating source. It does not recursively embed
every peer runtime hash. A runtime hash pins only the code at that address; the
runtime hash of a proxy shell does not pin its implementation. Every dependency
must therefore be launch-attested nonproxy and nondelegating, or, only where its
separate frozen dependency policy expressly permits a proxy, bind and recheck
both proxy address/runtime hash and implementation address/runtime hash at every
required use. An absent, mutable, ambiguous, or unverifiable implementation fails
closed. Registry, circuit-breaker/health, oracle, adapter, and token dependencies
apply that rule rather than relying on proxy-shell code hash alone. Constellation
children themselves never use the proxy exception.

## 4. Typed cross-contract protocol

All cross-calls use exact typed selectors, exact return lengths, bounded gas and
returndata, and closed caller sets. No child has fallback, receive, proxy,
delegatecall, or generic execute behavior.

Core has one mutation guard. Authority increments the shared O2 nonce immediately
before an ordinary reverting downstream call and never catches its failure;
reversion therefore rolls the nonce back. Direct and relayed O2 share that nonce;
relayed cancellation uses its separate nonce.

Intent has `CREATING`, `CANCELING`, and `EXECUTING` phases. Reconciliation has
explicit phases including `DISPOSING`, allowing the typed
`Reconciliation -> Core -> Reconciliation` leaf without deadlock. A leaf is
`onlyCore`, checks exact phase, ID, and generation, and makes no calls. Attempt,
repair, and O2 hooks use distinct phases. Empty O2 leaf batches are skipped.
Affected leaf failure fails closed. Each leaf batch contains at most 32 entries
and rejects duplicate, unsorted, stale, or wrong-generation entries.

## 5. Atomic flows

Deposit, budget authorization, intent creation, cancellation, expiry, execution,
disposition, repair, and O2 each complete atomically across their typed modules.
No module may catch and normalize a peer failure when doing so would preserve a
partial transition.

### 5.1 Adapter boundary and outcomes

Intent consumes the attempt immediately before the adapter `CALL`. The call uses
one exact fixed selector, committed bounded route, fixed value, fixed token and
Core recipient, immediate adapter code-hash validation, bounded gas, and a proven
journal reserve. Returndata is either zero length or one bounded exact form;
revert data is not bubbled. Core alone takes the authoritative native and exact
Stock Token observations immediately after the adapter call and before any Core
delta mutation. Adapter-reported amounts and any Intent receipt are never balance
authority.

| Adapter observation | Required result |
|---|---|
| `call == false` with unchanged authoritative native and Stock Token balances | consumed failed/no-fill; no `L`, `P`, or reconciliation case |
| `call == false` with any authoritative delta | unexplained delta enters reconciliation |
| positive token delta with valid metadata | delta is the fill authority; reconcile only an independently unexplained native/result delta |
| zero token delta and native unchanged | consumed failed/no-fill; no `L`, `P`, or reconciliation case |
| zero token delta and native spent | unexplained state enters reconciliation |
| positive token delta and malformed metadata requiring evidence | token delta is preserved only through a reconciliation case and malformed-metadata incident |
| an expressly enumerated deliberately journaled uncertainty | reconciliation case with the frozen uncertainty code and evidence |
| unsafe/malformed authoritative observation or required journal/leaf failure | outer transaction reverts atomically, reverting attempt consumption, the adapter call, and all effects |

Once the adapter `CALL` is issued, its consumed outcome is journaled unless an
unsafe observation or required journal failure atomically reverts the entire
transaction. Failure alone never creates liability: only an unexplained
authoritative delta, positive-token malformed metadata that requires evidence,
or an expressly enumerated deliberately journaled uncertainty opens
Reconciliation. Adapter returndata can never convert any of those cases into
success.

### 5.2 O2 literal algorithm

O2 classifies forced surplus once into `U`, then debits `A`, then `U`, then the
minimum number of whole ordinary reservations ordered by descending backing,
oldest sequence, then ID. Excess canceled backing credits `A`. It then reduces
`P` while `L` remains, ordered by largest backing, oldest sequence, then ID.
Components are exactly `F,A,U,R,P`, with maximum count
`1 + 1 + 1 + 32 + 32 = 67`. Leaf batches enforce ordering, uniqueness,
freshness, and generation. Target-chain cold-storage and gas evidence is required.
The direct path remains callable during pause and live deficit/shortfall. It may
move no more than actual Core ETH; any resulting or enlarged `D`/`S`, liability,
backing loss, reservation cancellation, and component evidence remains public.
The destination `CALL` is the last action in O2, uses empty calldata, and copies
zero returndata.

### 5.3 Repair classification

Every repair or refund source is precommitted and single-use to one exact source
kind, bound open attempt or intent identity, amount, and residual policy; callers
cannot select arbitrary liability or redirect a bound refund. Exact-causal
reconciliation repair first restores only its bound record's `P`, capped at that
record's `L-P`. It does not traverse another record. Only residual value whose
frozen residual policy expressly marks it eligible for generic reconciliation
repair may then traverse other open reconciliation records in deterministic
oldest-first order.

An active-intent refund restores only its bound intent's outstanding `R`. It is
not eligible for generic reconciliation repair and is never diverted to another
reservation or to `L/P`; an amount above the exact bound restoration fails
closed rather than becoming residual value. For source kinds that can validly
have residual value after their required bound leg, that value follows only the
source's precommitted residual policy:

- eligible generic reconciliation repair -> other open reconciliation records,
  oldest-first and each capped at its own `L-P`;
- terminal fully-accounted refund residual -> `A`;
- unmatched residual -> `U`;
- canonical deposit -> live `D` first, then `A`.

No residual silently acquires generic-repair eligibility, and an ineligible
residual cannot cross records merely because another shortfall exists.

`D` and `S` may coexist and are reported independently. The full canonical value,
not merely its `A` credit, consumes every applicable cap. Any failure rolls back
value, records, caps, sequence, evidence, and peer state.

## 6. IDs, signatures, and evidence

The Intent ID remains exactly:

```solidity
keccak256(abi.encode(chainId, core, ballotId, assetVersionKey))
```

Task 5 Deposit and accounting V1 IDs remain Core-scoped with `address(this)`.
Except for a closed literal exception expressly listed in the catalog below,
every new V2 ID is literally:

```solidity
keccak256(abi.encode(
    TAG_V2,
    chainId,
    core,
    owningOrEmittingModule,
    generation,
    nonceOrSequence,
    actionSpecificFields
))
```

Each interface freezes its concrete `TAG_V2` and exact `actionSpecificFields`;
no packed encoding is permitted. A catalog row declared as a closed literal
exception overrides the generic generation/nonce template and may omit only the
fields that row and its accompanying text expressly forbid. Budget Authorization
is such an exception and remains exactly the result-independent preimage below.

The EIP-712 verifying contract is Authority. Every signed payload binds
Authority, Core, target module, action, generation, deadline, and all frozen
action fields, but its nonce comes only from that action's exact nonce domain:
O2 uses `sharedO2Nonce`; relayed intent cancellation uses `cancelNonce`; every
other signed action uses the nonce or immutable snapshot fields frozen by its own
literal type and may not substitute either O2 or cancellation nonce. Tests cover
wrong-nonce-domain as well as cross-chain, cross-Core, cross-module, and
cross-action replay.

Off-chain consumers pin emitter, topic, deployment block, and runtime hash.
Every flow freezes exact emitter and global event order; a peer may not impersonate
another module's evidence.

The initial V2 catalog is closed and literal. In the expressions below `H(x)`
means `keccak256(abi.encode(x))`, never packed encoding:

| ID | Exact preimage inside `H(...)` |
|---|---|
| operator proposal | `AUTH_OPERATOR_PROPOSAL_V2, chainId, core, authority, operatorGeneration, proposalNonce, proposedBy, nominee, proposedAt, validAfter, expiresAt, detailsHash` |
| ingress proposal | `AUTH_INGRESS_PROPOSAL_V2, chainId, core, authority, ingressGeneration, ingressProposalNonce, proposedBy, ingress, runtimeCodeHash, perDepositCapWei, epochCapWei, lifetimeCapWei, proposedAt, validAfter, expiresAt, detailsHash` |
| budget authorization | `BUDGET_AUTHORIZATION_V2, chainId, core, budgetBook, RegistryV2, ballotDay, maxEthWei, purchaseUntil, accountingSequence` |
| attempt | `INTENT_ATTEMPT_V2, chainId, core, intentModule, authorityGeneration, attemptIndex, intentId, adapter, runtimeCodeHash, routeHash` |
| cancellation | `INTENT_CANCELLATION_V2, chainId, core, intentModule, authorityGeneration, cancelNonce, intentId, actor, reasonCode, detailsHash` |
| reconciliation | `RECONCILIATION_CASE_V2, chainId, core, reconciliationModule, authorityGeneration, reconciliationSequence, intentId, attemptId, observationHash` |
| disposition | `RECONCILIATION_DISPOSITION_V2, chainId, core, reconciliationModule, authorityGeneration, dispositionSequence, reconciliationId, dispositionKind, canonicalNativeWei, canonicalStockAmount, evidenceHash` |
| repair | `REPAIR_CAUSE_V2, chainId, core, reconciliationModule, authorityGeneration, repairSequence, reconciliationId, sourceIdentity, amountWei` |
| O2 authorization | `O2_AUTHORIZATION_V2, chainId, core, authority, operatorGeneration, sharedO2Nonce, destination, amountWei, issuedAt, deadline, reasonCode, detailsHash` |
| O2 accounting mutation | `O2_ACCOUNTING_MUTATION_V2, chainId, core, core, operatorGeneration, accountingSequence, authorizationId, preTotalsHash, postTotalsHash` |
| Stock Token observation | `STOCK_OBSERVATION_V2, chainId, core, core, ingressGeneration, stockSequence, assetVersionKey, token, preBalance, postBalance, attemptId` |

No V2 family may be added implicitly. A later family requires a tracked amendment
that adds its literal tag, owner/emitter, exact ordered fields, replay tests, and
consumer binding before implementation.

The budget authorization ID is deliberately result-independent. It contains no
authority generation, budget nonce, ballot ID, asset version key, winner, token,
result, tally, authorized-at timestamp, or details hash. The immutable record may
store `authorizedAt` and `detailsHash` as evidence, but those fields never alter
the exact ID above.

Global success-event order is also closed:

| Flow | Exact emitter/order |
|---|---|
| deposit | Core `AccountingMutation` -> Core accounting components -> Core `CanonicalDeposit` |
| budget | BudgetBook `PreVoteBudgetAuthorized` only |
| create | Intent `IntentCreationStarted` -> Core reservation mutation/components -> Intent `IntentCreated` |
| direct cancel/expiry | Intent phase evidence -> Core release mutation/components -> Intent terminal evidence |
| relayed cancel | Authority cancellation-nonce evidence -> Intent phase evidence -> Core release mutation/components -> Intent terminal evidence |
| execute | Intent `AttemptConsumed` -> Core pre-call phase evidence (no balance claim) -> adapter call -> Core `NativeAndStockObserved` authoritative observation -> Core delta mutation/components -> Reconciliation case if required -> Intent `AttemptResultRecorded` receipt -> Intent terminal evidence if terminal |
| disposition/repair | Reconciliation phase/cause -> Core mutation/components -> Reconciliation leaf evidence -> Reconciliation final evidence |
| O2 | Authority shared-nonce evidence -> Core mutation -> Core `F,A,U,R,P` components -> affected Intent/Reconciliation leaves -> Core transfer evidence; destination call is last and emits no trusted protocol evidence |

For execute, `NativeAndStockObserved` is emitted after the adapter call and before
Core changes `A/U/R/L/P` or Stock Token aggregates. It is the sole event authority
for pre/post native and exact Stock Token balances. `AttemptResultRecorded` is a
typed receipt of Core's outcome/IDs only and contains no independently observed
or duplicated balances. An omitted zero-value accounting component emits
nothing; remaining component indexes are contiguous. A failure at any point
reverts every earlier event. Static Authority reads never emit events.

## 7. TDD implementation graph

0. **Crosswalk:** map every frozen monolith selector, error, event, storage field,
   payable behavior, and prohibition to exactly one contract. RED rejects duplicates,
   omissions, hidden payable/fallback/call surfaces, role copies, and over-size artifacts.
1. **Interfaces and factory:** RED then GREEN phased ordinary-CREATE deployment,
   committed order/hash/address checks, forced-prefund tolerance, dormant children,
   atomic finalization, wrong/incomplete inertness, and post-finalization impotence.
2. **Authority extraction:** ownership/operator/ingress/pause snapshot and complete
   reciprocal collision/nonce/replay matrix.
3. **Core extraction:** canonical ingress accounting, caps, deposits, sync, minimal
   records/tombstones, ETH custody, and hold-only Stock Token custody/aggregates.
4. **BudgetBook:** exactly one immutable pre-vote authorization record per
   `ballotDay`, without funds, consumption, tombstones, cancellation, rewrite,
   replacement, or reservation state.
5. **Intent:** IDs, oracle/adapter/route commitments, attempt consumption, outcome table.
6. **Reconciliation:** phases, evidence, repair causes, dispositions, incidents, typed leaves.
7. **O2 integration:** direct/relayed authority, cancellation nonce, 0/1/32/67 components,
   exact ordering and batch rejection.
8. **Stateful integration:** conservation, nonce rollback, phase deadlock resistance,
   forced ETH, token drift, replay domains, artifact census, factory-and-every-child
   runtime/initcode measurements and bounds, gas/journal proofs, and 0/1/32/67 traces.
9. **Independent closure:** Wildcat review, controller verification, deployment rehearsal,
   and documentation truth. No approval or production claim is populated early.

Minimum mutations include child-order/initcode/runtime/address mismatch, premature
activation, partial finalization, factory post-finalization power, role-copy drift,
snapshot truncation, nonce-after-call/caught failure, wrong phase/leaf caller/ID/
generation, duplicate/unsorted/33-entry batch, adapter code drift/gas/returndata/
amount trust, every outcome-table branch, destination-not-last, O2 ordering and
67-bound errors, arbitrary repair source, double-use cause, `P > L`, wrong residual
class, cap-on-credit-only, cross-domain replay, emitter/order drift, hidden payable,
fallback, delegatecall, proxy, transfer, approval, sweep, and size-limit breach.

## 8. Historical preservation and closure truth

O1, Task 4, and Task 5 tests and evidence remain historical behavioral oracles.
Task 5 commit `6e066ffa` proves a focused monolithic reference with 23,212-byte
runtime, not a deployable architecture. Its independent review is pending. Task 6
must not modify that monolith. No A1 implemented/approved/deployed/funded/active
closure field may be set until Tasks 0–9 above complete and independent review
accepts the constellation.
