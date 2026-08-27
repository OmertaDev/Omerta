# Acquisition Constellation Task 3 — Core and Cap-Bridge Architecture Freeze

**Status:** architecture freeze independently approved at 23b58923 (security C0/I0/M0; specification C0/I0/M0); implementation, production approval, deployment, funding, migration, and activation remain pending

**Inputs:** the independently approved Task 0 ownership/collision crosswalk, the approved constellation architecture, the independently approved Task 2 closure at e89370b2, the approved historical Task 5 behavioral oracle at ee857436, and the grill-completion acceptance graph.

## 0. Decision and graph boundary

Task 3 is another entirely fresh pre-production constellation. It deploys a new Factory and five new children in the unchanged order Authority, Core, BudgetBook, IntentExecution, Reconciliation at Factory CREATE nonces 1–5. It reuses no Task 2 address, mutable state, Safe transition, operator state, ingress record, nonce, counter, proposal, deployment commitment, or manifest.

This node closes two dependency-ordered stages:

1. **Task 3A — cap bridge.** The fresh Factory commits the nonzero global lifetime canonical-deposit cap, the Core exposes that immutable cap, and Authority performs a bounded live Core read both when ingress is proposed and when it is activated.
2. **Task 3B — complete Task 0 Core extraction.** Core becomes the sole ETH custodian and native-accounting writer, reads current Safe and ingress truth from Authority without mirrors, and implements the exact 20 Core business functions, 11 Core business errors, and four Core business events assigned by Task 0.

Task 3A is an internal RED/GREEN checkpoint, not Task 3 completion. Task 3 closes only after the full Task 3B surface and the combined Factory/Authority/Core graph pass the verification matrix in this document.

Task 3 does not add reservations, intents, adapter execution, reconciliation disposition, O2/outflow, repair, Stock Token observation, Stock Token aggregate mutation, token movement, or token delivery. Authority unpause remains deliberately fail-closed at readiness ordinal 11. Those later graph nodes cannot be pulled forward merely to make Task 3 appear production-ready.

The exact ownership boundary after Task 3 is:

| Concern | Sole authority or writer |
|---|---|
| Safe, pending Safe, pause, operator, pending operator, shared O2 nonce, ingress lifecycle and ingress records | Authority |
| Native ETH custody, native accounting buckets and sequences, canonical-deposit records and consumed cap totals | Core |
| Global lifetime canonical-deposit cap | immutable Core value committed by Factory; live-read by Authority |
| Stock Token registry identity | immutable Core binding committed and attested by Factory |
| Stock Token accounting and movement | absent in Task 3; deferred as specified in section 15 |

## 1. Fresh Task 3 commitments

The Task 3 configuration tag and root are:

~~~text
TASK3_CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK3_CONFIG_V1")

configurationRoot = keccak256(abi.encode(
    TASK3_CONFIG_TAG,
    uint256(3),
    registry,
    registryRuntimeHash,
    globalLifetimeCanonicalDepositCapWei
))
~~~

The existing constellation and deployment tags and their nonrecursive formulas remain unchanged. The new configuration root changes the manifest, every manifest-bound child initcode, the child initcode/runtime commitments, and the deployment commitment. The exact six Task 2 deployables are therefore invalid Task 3 artifacts even if one unaffected shell happens to have identical source text.

The Factory constructor becomes:

~~~solidity
constructor(
    address safe,
    address registry,
    bytes32 registryRuntimeHash,
    uint256 globalLifetimeCanonicalDepositCapWei,
    bytes32[5] memory childInitcodeHashes,
    bytes32[5] memory childRuntimeHashes
)
~~~

Its validation precedence preserves every existing Task 2 branch before adding the cap branch:

1. supported chain;
2. nonzero Safe and Registry;
3. Safe code, then Registry code;
4. predicted-address role collisions in the existing order;
5. Registry runtime hash;
6. all five nonzero initcode hashes in child-index order;
7. all five nonzero runtime hashes in child-index order;
8. bounded Registry call, exact return length, and supported-chain result;
9. nonzero global cap, otherwise **FactoryInvalidGlobalLifetimeCap()**;
10. configuration root, manifest, deployment commitment, and immutable storage.

The Factory stores the cap as an immutable and appends it as field 8, the ninth output, of **factoryState()**. Existing field order 0–7 is unchanged.

Factory adds exactly:

~~~solidity
error FactoryInvalidGlobalLifetimeCap();
error FactoryCoreSnapshotCallFailed();
error FactoryCoreSnapshotReturnLength(uint256 actualLength);
error FactoryCoreSnapshotSemanticMismatch(uint8 field);
~~~

## 2. Core construction and immutable topology

The exact Core constructor is:

~~~solidity
constructor(
    address factory,
    bytes32 manifestHash,
    address authority,
    address registry,
    address budgetBook,
    address intentExecution,
    address reconciliation,
    uint256 globalLifetimeCanonicalDepositCapWei
)
~~~

The immutable bindings are Factory, manifest, Authority, Registry, BudgetBook, IntentExecution, Reconciliation, and the global cap. The Registry binding is exposed through the assigned **stockTokenRegistryV2()** getter; implementation must not store a second Registry immutable solely under another label.

Core contains no immutable or stored Safe, pending Safe, pause flag, main operator, pending operator, active ingress, pending ingress, ingress configuration, or ingress generation mirror.

Constructor precedence is exact:

1. zero Factory: **CoreFactoryZero()**;
2. zero manifest: **CoreManifestHashZero()**;
3. zero Authority, Registry, BudgetBook, IntentExecution, then Reconciliation, in that order: **CoreZeroAddress()**;
4. missing Registry code: **CoreContractRequired(registry)**;
5. executing address differs from Factory nonce-2 prediction: **CoreAddressMismatch(expected,actual)**;
6. Authority differs from nonce-1 prediction: **CorePeerMismatch(0,expected,actual)**;
7. BudgetBook differs from nonce-3 prediction: **CorePeerMismatch(2,expected,actual)**;
8. IntentExecution differs from nonce-4 prediction: **CorePeerMismatch(3,expected,actual)**;
9. Reconciliation differs from nonce-5 prediction: **CorePeerMismatch(4,expected,actual)**;
10. the correctly predicted Authority has no code: **CoreContractRequired(authority)**;
11. zero cap: **InvalidGlobalLifetimeCap()**;
12. store immutables and leave all Core business/linear state zero; inherited ReentrancyGuard initializes only its namespaced guard slot.

Constructor code may use EXTCODESIZE observations but performs no CALL or STATICCALL. BudgetBook, IntentExecution, and Reconciliation are future CREATE peers and intentionally have no code when Core is deployed second.

Factory is responsible for exact Registry address, runtime-hash, chain, code, and launch attestation. Core binds the committed Registry identity but does not repeat the Registry call or runtime-hash state.

## 3. Core snapshot and Factory preflight

Core adds this exact 18-word, 576-byte static snapshot:

| Ordinal | Type | Field | Pre-final expectation |
|---:|---|---|---|
| 0 | uint256 | schemaVersion | 3 |
| 1 | address | factory | committed Factory |
| 2 | bytes32 | manifestHash | committed manifest |
| 3 | address | authority | predicted Authority |
| 4 | address | registry | committed Registry |
| 5 | address | budgetBook | predicted BudgetBook |
| 6 | address | intentExecution | predicted IntentExecution |
| 7 | address | reconciliation | predicted Reconciliation |
| 8 | bool | finalized | false |
| 9 | uint256 | globalLifetimeCanonicalDepositCapWei | exact committed nonzero cap |
| 10 | uint256 | availableWei | 0 |
| 11 | uint256 | unattributedWei | 0 |
| 12 | uint256 | ordinaryReservedWei | 0 |
| 13 | uint256 | reconciliationLiabilityWei | 0 |
| 14 | uint256 | reconciliationBackingWei | 0 |
| 15 | uint256 | accountingSequence | 0 |
| 16 | uint256 | lastObservedBalanceDeficitWei | 0 |
| 17 | uint256 | globalLifetimeCanonicalDepositedWei | 0 |

The descriptor is **coreSnapshot()** with 18 top-level static outputs in the exact table order. Address words require clean high 96 bits and field 8 must be canonical zero or one.

Factory calls the snapshot with:

| Property | Frozen value |
|---|---|
| Target | predicted immutable Core |
| Selector | coreSnapshot() |
| Value | zero |
| Gas | exactly 100,000 |
| Output buffer | fixed 576 bytes |
| Required RETURNDATASIZE | exactly 576 |
| Revert data | never bubbled |
| Dynamic return copy | forbidden |

The first failure is normalized to call, return-length, or semantic error. Semantic errors use the first failing ordinal 0–17.

Finalization precedence becomes:

1. Factory phase;
2. child-count invariant;
3. Registry code, runtime hash, bounded call, exact length, and chain;
4. child runtime/topology checks at indices 0–4;
5. Authority snapshot call, length, canonical encoding, and fields 0–26;
6. Core snapshot call, length, canonical encoding, and fields 0–17;
7. transition to FINALIZING;
8. finalizers in existing order 2, 4, 3, 1, 0;
9. finalized topology rechecks for all five children;
10. transition to FINALIZED;
11. **ConstellationFinalized**.

An invalid Authority snapshot therefore has precedence over an invalid Core snapshot.

The snapshot intentionally excludes **address(core).balance**. Forced ETH and ERC-20 balances at the predictable Core address cannot block deployment or finalization and cannot create stored accounting. Mapping emptiness is proved by fresh zero storage, exact creation-code provenance, no constructor writes to mapping roots, and finalized-first business mutators; it is not enumerated onchain.

## 4. Core finalization and storage

Core adds these nine infrastructure errors:

~~~solidity
error CoreFactoryZero();
error CoreManifestHashZero();
error CoreFinalizerUnauthorized(address caller);
error CoreManifestHashMismatch(bytes32 expected, bytes32 actual);
error CoreAlreadyFinalized();
error CoreNotFinalized();
error CoreInitialStateMismatch(uint8 field);
error CoreAddressMismatch(address expected, address actual);
error CorePeerMismatch(uint8 index, address expected, address actual);
~~~

It retains the unique infrastructure event:

~~~solidity
event CoreFinalized(bytes32 indexed manifestHash);
~~~

**finalizeCore(bytes32)** checks caller, manifest, and already-finalized state in that order. It then checks mutable snapshot fields 10–17 in ordinal order, sets finalized, and emits **CoreFinalized**. Field 8 is handled only by **CoreAlreadyFinalized**; immutable fields 0–7 and 9 are construction and Factory-preflight invariants. The finalizer never inspects or classifies the live ETH balance.

Every Core business mutator uses exact modifier order **finalizedState nonReentrant**. A pre-final call fails **CoreNotFinalized()** before touching the shared guard. A callback during a finalized mutation fails inherited **ReentrancyGuardReentrantCall()**. The finalizer is the only pre-final mutation.

The exact linear Core storage layout is:

| Slot/root | Field |
|---:|---|
| 0 offset 0 | bool finalized |
| 1 | availableWei |
| 2 | unattributedWei |
| 3 | ordinaryReservedWei |
| 4 | reconciliationLiabilityWei |
| 5 | reconciliationBackingWei |
| 6 | accountingSequence |
| 7 | lastObservedBalanceDeficitWei |
| 8 | globalLifetimeCanonicalDepositedWei |
| root 9 | mapping(uint256 => uint256) ingressLifetimeDepositedWei |
| root 10 | mapping(uint256 => mapping(uint256 => uint256)) ingressEpochDepositedWei |
| root 11 | mapping(bytes32 => DepositRecord) depositRecords |

ReentrancyGuard uses its namespaced inherited slot and does not alter the table. Every topology, Registry, and cap value is immutable. **DepositRecord.depositId** is the sole record discriminator and replay tombstone; no separate replay mapping exists.

Task 3 adds no Stock Token mapping, sequence, record, aggregate, unattributed bucket, negative-drift state, or placeholder storage reservation.

## 5. Exact Core business surface

The exact assigned business functions are:

~~~solidity
function MAX_ACTIVE_ORDINARY_RESERVATIONS() external view returns (uint256); // 32
function MAX_ACTIVE_RECONCILIATIONS() external view returns (uint256);       // 32
function MAX_OPERATOR_OUTFLOW_COMPONENTS() external view returns (uint256); // 67

function stockTokenRegistryV2() external view returns (address);
function globalLifetimeCanonicalDepositCapWei() external view returns (uint256);

function availableWei() external view returns (uint256);
function unattributedWei() external view returns (uint256);
function ordinaryReservedWei() external view returns (uint256);
function reconciliationLiabilityWei() external view returns (uint256);
function reconciliationBackingWei() external view returns (uint256);
function accountingSequence() external view returns (uint256);
function lastObservedBalanceDeficitWei() external view returns (uint256);

function accountingTotals() external view returns (AccountingTotals memory totals);
function syncBalance() external returns (bytes32 mutationId);
function reclassifyUnattributed(uint256 amountWei, bytes32 detailsHash)
    external returns (bytes32 mutationId);

function globalLifetimeCanonicalDepositedWei() external view returns (uint256);
function ingressLifetimeDepositedWei(uint256 generation) external view returns (uint256);
function ingressEpochDepositedWei(uint256 generation, uint256 epochDay)
    external view returns (uint256);

function getDeposit(bytes32 depositId) external view returns (DepositRecord memory record);
function depositCanonical(bytes32 sourceEventId)
    external payable returns (bytes32 depositId);
~~~

Infrastructure adds only **coreTopology()**, **coreSnapshot()**, and **finalizeCore(bytes32)**. Core therefore has exactly 23 functions. It has no **supportedChainId()** or **version()** getter, receive, fallback, proxy surface, upgrade hook, or generic execution function.

The assigned constants, structs, and enum ordinals are:

~~~solidity
struct AccountingTotals {
    uint256 availableWei;
    uint256 unattributedWei;
    uint256 ordinaryReservedWei;
    uint256 reconciliationLiabilityWei;
    uint256 reconciliationBackingWei;
    uint256 reconciliationShortfallWei;
    uint256 accountedBackingWei;
    uint256 actualBalanceWei;
    uint256 balanceDeficitWei;
    uint256 forcedSurplusWei;
    uint256 accountingSequence;
}

struct DepositRecord {
    bytes32 depositId;
    uint256 ingressGeneration;
    address ingress;
    bytes32 sourceEventId;
    uint256 amountWei;
    uint256 balanceDeficitRepairWei;
    uint256 availableCreditWei;
    uint256 epochDay;
    uint256 accountingSequence;
    uint64 depositedAt;
}

enum AccountingMutationKind {
    NONE,                          // 0
    SYNC_BALANCE,                  // 1
    UNATTRIBUTED_RECLASSIFICATION, // 2
    CANONICAL_DEPOSIT              // 3
}

enum AccountingComponentKind {
    NONE,                               // 0
    FORCED_SURPLUS_TO_UNATTRIBUTED,     // 1
    BALANCE_DEFICIT_OBSERVATION_SET,    // 2
    UNATTRIBUTED_TO_AVAILABLE,          // 3
    CANONICAL_DEPOSIT_DEFICIT_REPAIR,   // 4
    CANONICAL_DEPOSIT_AVAILABLE_CREDIT  // 5
}

enum DepositCapKind {
    NONE,                // 0
    PER_DEPOSIT,         // 1
    EPOCH,               // 2
    GENERATION_LIFETIME, // 3
    GLOBAL_LIFETIME      // 4
}
~~~

**getDeposit** returns the stored record and reverts with Core-owned **DepositNotFound(depositId)** when the discriminator is zero.

The exact 11 Core-owned business errors are:

~~~solidity
error InvalidGlobalLifetimeCap();
error NoBalanceDelta();
error InvalidAmount();
error InsufficientUnattributed(uint256 availableWei, uint256 requestedWei);
error BalanceDeficitActive(uint256 deficitWei);
error ReconciliationShortfallActive(uint256 shortfallWei);
error NotActiveIngress(address caller);
error DepositSourceRequired();
error DepositReplay(bytes32 depositId);
error DepositCapExceeded(uint8 capKind, uint256 capWei, uint256 attemptedTotalWei);
error DepositNotFound(bytes32 depositId);
~~~

Core adds six bounded-read errors:

~~~solidity
error CoreAuthoritySnapshotCallFailed();
error CoreAuthoritySnapshotReturnLength(uint256 actualLength);
error CoreAuthoritySnapshotSemanticMismatch(uint8 field);
error CoreIngressCallFailed(uint256 generation);
error CoreIngressReturnLength(uint256 generation, uint256 actualLength);
error CoreIngressSemanticMismatch(uint8 field);
~~~

Core adds nine unique module-local semantic errors rather than locally originating an Authority- or OpenZeppelin-owned selector:

~~~solidity
error CoreZeroAddress();
error CoreContractRequired(address target);
error CoreRoleIdentityCollision(address candidate);
error CoreEmptyDetailsHash();
error CoreCounterExhausted(bytes32 counterName);
error CoreTimestampOverflow();
error CoreNoActiveIngress();
error CoreIngressCodeHashMismatch(address ingress, bytes32 expected, bytes32 actual);
error CoreUnauthorized(address caller);
~~~

Together with the nine infrastructure errors, six bounded-read errors, 11 assigned business errors, nine local semantic errors, and inherited **ReentrancyGuardReentrantCall()**, the compiled Core ABI has exactly 36 error entries.

Core emits:

~~~solidity
event AccountingMutation(
    uint256 indexed accountingSequence,
    bytes32 indexed mutationId,
    uint8 indexed mutationKind,
    AccountingTotals preTotals,
    AccountingTotals postTotals,
    uint256 componentCount
);

event AccountingComponent(
    uint256 indexed accountingSequence,
    uint256 indexed componentIndex,
    bytes32 indexed componentId,
    uint8 componentKind,
    bytes32 componentSubjectId,
    uint256 amountWei
);

event UnattributedReclassified(
    bytes32 indexed mutationId,
    uint256 indexed accountingSequence,
    address indexed actor,
    uint256 amountWei,
    uint8 reasonCode,
    bytes32 detailsHash
);

event CanonicalDeposit(
    bytes32 indexed depositId,
    uint256 indexed ingressGeneration,
    bytes32 indexed sourceEventId,
    address ingress,
    uint256 amountWei,
    uint256 balanceDeficitRepairWei,
    uint256 availableCreditWei,
    uint256 epochDay,
    uint256 accountingSequence,
    uint64 depositedAt
);
~~~

The signatures, parameter order, types, and indexing are exact. Core also emits unique **CoreFinalized** and no Stock Token event.

## 6. Semantic-error ownership

Task 0 requires every locally detected cross-module-equivalent failure to use a unique module-specific error. Propagation may retain a callee-owned selector, but Task 3 normalizes every bounded peer-call failure and never bubbles peer revert data. Core therefore originates only the nine **Core...** errors frozen in section 5.

Core must not:

1. redeclare or manually originate an Authority- or OpenZeppelin-owned selector;
2. inherit Authority, Ownable, or an error-only interface to obtain error declarations;
3. forward or decode peer revert data;
4. hide an unapproved selector behind assembly.

The verifier inventories both compiled ABI descriptors and runtime-reachable selectors, proves every locally originated selector has exactly one semantic owner, rejects the former nine hidden wire-selector repetitions, and preserves **ReentrancyGuardReentrantCall()** as the sole allowed repeated descriptor.

## 7. Authority live Core-cap protocol

Authority adds no cap storage, mirror, getter, function, or event. It adds exactly:

~~~solidity
error AuthorityCoreCapCallFailed();
error AuthorityCoreCapReturnLength(uint256 actualLength);
error AuthorityCoreCapSemanticMismatch(uint256 actualCapWei);
~~~

The bounded read is:

| Property | Frozen value |
|---|---|
| Target | immutable Core |
| Selector | globalLifetimeCanonicalDepositCapWei() |
| Value | zero |
| Gas | exactly 50,000 |
| Input | exactly four selector bytes |
| Output buffer | fixed 32 bytes |
| Required RETURNDATASIZE | exactly 32 |
| Zero return | AuthorityCoreCapSemanticMismatch(0) |
| Revert data | never bubbled |
| Dynamic return copy | forbidden |

**proposeIngress** preserves existing precedence through finalization, guard, current Safe, no-pending check, and all local nonzero/hash/cap-order checks. It then reads the live Core cap and rejects a lifetime cap above it with existing **InvalidIngressConfig()**. Only then does it check ingress code, runtime hash, reciprocal role collisions, details, time bounds, counter, state, and event.

**activateIngress** preserves existing missing/wrong proposal-ID, time-window, and active-ingress overlap precedence. It then performs the same local configuration checks, live Core-cap read, lifetime-versus-global comparison, ingress code/hash, reciprocal role checks, stored config-hash comparison, generation counter, effects, and event.

Proposal and activation must both read Core even though the cap is immutable. The second read is graph evidence against implementation drift. Cancellation, permissionless expiry, and disable never call Core and remain live through Core call failure, malformed return data, code-health failure, or gas exhaustion.

Authority unpause remains exactly fail-closed at **LocalReadinessFailed(11)** and performs no Core read. Task 3 does not claim constellation-wide readiness.

## 8. Core live Authority snapshot protocol

Core obtains Safe and active-ingress truth only from immutable Authority through the already-frozen **authoritySnapshot()**:

| Property | Frozen value |
|---|---|
| Target | immutable Authority |
| Value | zero |
| Gas | exactly 160,000 |
| Input | four-byte selector |
| Output buffer | fixed 864 bytes |
| Required RETURNDATASIZE | exactly 864 |
| Revert data | never bubbled |
| Dynamic return copy | forbidden |

Core validates fields 0–7 against schema 2 and its exact Factory, manifest, Registry, Core, BudgetBook, IntentExecution, and Reconciliation identities. Field 8 must be canonical true. Address fields 9, 10, 12, 13, 19, and 21 require clean padding; the current Safe at field 9 must be nonzero. Pause field 11 must be a canonical Boolean but either value is accepted.

Active-ingress consistency is exact:

- if active generation field 18 is zero, active ingress field 19 and active config hash field 20 must both be zero;
- if field 18 is nonzero, fields 19 and 20 must both be nonzero.

Every first failure uses the existing tuple ordinal in **CoreAuthoritySnapshotSemanticMismatch(field)**. Core never caches a returned value.

**reclassifyUnattributed** compares the caller with field 9 on every attempt. **depositCanonical** uses fields 18–20 and the current/pending Safe, operator, and ingress identities from that same single snapshot. A completed Authority ownership handoff immediately authorizes the new Safe and rejects the old one. An ingress rotation or disable is immediately reflected in the next deposit. A pending owner or ingress gains no authority merely by appearing in the snapshot.

## 9. Core live ingress-record protocol

After a nonzero active generation is obtained from the snapshot, Core calls Authority **getIngress(uint256)**:

| Property | Frozen value |
|---|---|
| Target | immutable Authority |
| Value | zero |
| Gas | exactly 100,000 |
| Input | selector plus one 32-byte generation |
| Output buffer | fixed 256 bytes |
| Required RETURNDATASIZE | exactly 256 |
| Revert data | never bubbled |
| Dynamic return copy | forbidden |

The eight returned words and one synthetic check use these semantic ordinals:

| Ordinal | Requirement |
|---:|---|
| 0 | record generation equals snapshot active generation |
| 1 | clean address equal to snapshot active ingress |
| 2 | runtime code hash is nonzero |
| 3 | per-deposit cap is nonzero |
| 4 | epoch cap is at least per-deposit cap |
| 5 | lifetime cap is at least epoch cap and no greater than Core global cap |
| 6 | activatedAt is canonically encoded as uint64 |
| 7 | disabledAt is canonically encoded as uint64 and is exactly zero |
| 8 | recomputed V2 configuration hash equals snapshot active config hash |

The exact configuration hash is:

~~~text
keccak256(abi.encode(
    keccak256("OMERTA_AUTH_INGRESS_CONFIG_V2"),
    uint256(4663),
    address(core),
    address(authority),
    ingress,
    runtimeCodeHash,
    perDepositCapWei,
    epochDepositCapWei,
    lifetimeDepositCapWei
))
~~~

Call failure, wrong length, or semantic drift reverts through the normalized Core read errors and changes no state or logs.

## 10. Safe authorization and accounting equations

**reclassifyUnattributed** uses the current Authority Safe and exact precedence:

1. finalized;
2. shared nonreentrant guard;
3. Authority snapshot call;
4. exact return length;
5. semantic fields in ordinal order;
6. caller is current Safe, otherwise **CoreUnauthorized(caller)**;
7. nonzero details hash, otherwise **CoreEmptyDetailsHash()**;
8. nonzero amount;
9. zero live balance deficit;
10. zero reconciliation shortfall;
11. amount no greater than U;
12. accounting sequence not exhausted, otherwise **CoreCounterExhausted(keccak256("accountingSequence"))**;
13. effects;
14. evidence.

Core uses the exact checked equations:

~~~text
S = L - P
B = A + U + R + P
D = max(B - V, 0)
F = max(V - B, 0)
~~~

where A is available, U unattributed, R ordinary reserved, L reconciliation liability, P reconciliation backing, V actual balance, S shortfall, B accounted backing, D deficit, and F forced surplus. Checked arithmetic fails closed; it never wraps or silently saturates.

### syncBalance

**syncBalance** is permissionless and pause-independent.

- If F is zero and live D equals the last observation, it reverts **NoBalanceDelta()**.
- Sequence exhaustion is checked before the first write.
- Nonzero F is added only to U, never A.
- Deficit never causes a bucket reduction or fabricated repair.
- Sequence increments exactly once.
- The post-state live deficit becomes the stored observation.
- Event order is **AccountingMutation**, optional forced-surplus component, then optional deficit-observation component.
- A changed observation emits even when the new amount is zero.

### reclassifyUnattributed

Reclassification moves no ETH. It subtracts the exact amount from U, adds it to A, increments sequence once, stores the post-state deficit observation, then emits **AccountingMutation**, one **UNATTRIBUTED_TO_AVAILABLE** component at index zero, and **UnattributedReclassified**. Its reason code remains ordinal 18.

### forced prefunding

Construction and finalization leave every bucket, sequence, observation, cap counter, and record zero regardless of the physical ETH balance. The first successful sync maps the complete forced surplus to U. Forced ETH never consumes an ingress, generation, epoch, or global canonical-deposit cap.

## 11. Canonical ingress validation and deposit precedence

**depositCanonical** uses this exact order:

1. finalized;
2. shared nonreentrant guard;
3. exact Authority snapshot;
4. snapshot semantic consistency;
5. zero active generation: **CoreNoActiveIngress()**;
6. exact bounded **getIngress** call and record semantics;
7. caller equals the record ingress, otherwise **NotActiveIngress(caller)**;
8. ingress code exists, otherwise **CoreContractRequired(ingress)**;
9. runtime code hash equals the record, otherwise **CoreIngressCodeHashMismatch**;
10. ingress does not collide with Authority, Factory, Core, Registry, BudgetBook, IntentExecution, Reconciliation, current Safe, pending Safe, current operator, pending operator, or pending ingress; otherwise **CoreRoleIdentityCollision(ingress)**;
11. nonzero source event ID;
12. nonzero msg.value;
13. block timestamp fits uint64, otherwise **CoreTimestampOverflow()**;
14. V2 deposit ID and replay check;
15. per-deposit cap;
16. current UTC-day cap;
17. current generation-lifetime cap;
18. global-lifetime cap;
19. accounting sequence room;
20. effects;
21. evidence.

Core stores no live ingress authority, active-ingress pointer, ingress configuration, or ingress-generation mirror. It stores only immutable per-deposit ingress provenance in **DepositRecord**. Authority remains the single live source for rotations, disablement, runtime identity, and configuration.

The deposit is derived against the pre-call balance:

~~~text
preV = address(core).balance - msg.value
preTotals = accountingTotalsAtBalance(preV)
repair = min(msg.value, preTotals.balanceDeficitWei)
credit = msg.value - repair
~~~

Only credit increases A. Repair restores backing without increasing a bucket. All four caps count the complete **msg.value**, including repair.

The cap order and payload are exact:

1. PER_DEPOSIT;
2. EPOCH;
3. GENERATION_LIFETIME;
4. GLOBAL_LIFETIME.

When both subtraction and the attempted total are representable, a cap failure is **DepositCapExceeded(uint8(kind),capWei,attemptedTotalWei)**. The check uses subtraction form **amountWei > capWei - priorWei**. Checked arithmetic intentionally panics 0x11 if injected corruption makes prior greater than cap or if **priorWei + amountWei** is itself unrepresentable while constructing the failure payload; neither case may wrap, saturate, or fabricate a custom payload.

All validation, timestamp, ID, cap totals, sequence, pre-state totals, and prospective scalar values are computed before writes. Successful write order is:

1. available credit;
2. accounting sequence;
3. epoch total;
4. generation total;
5. global total;
6. DepositRecord;
7. compute post totals from the written state;
8. post-state deficit observation;
9. evidence.

Event order is **AccountingMutation**, optional deficit-repair component, optional available-credit component, then **CanonicalDeposit**. Zero components are omitted and remaining component indices are contiguous.

Replay is checked after timestamp and ID derivation but before caps, sequence, or writes. Every revert refunds the incoming value and preserves all state and logs.

## 12. V2 evidence identifiers

The exact literal tags are:

~~~text
ACCOUNTING_MUTATION_TAG = keccak256("OMERTA_ACQUISITION_ACCOUNTING_MUTATION_V2")
ACCOUNTING_COMPONENT_TAG = keccak256("OMERTA_ACQUISITION_ACCOUNTING_COMPONENT_V2")
CANONICAL_DEPOSIT_TAG = keccak256("OMERTA_ACQUISITION_DEPOSIT_V2")
ACCOUNTING_SEQUENCE_COUNTER = keccak256("accountingSequence")
~~~

This tracked freeze adds three literal families to the closed V2 catalog. All three conform to **TAG, chain, Core vault, owning/emitting module, generation, nonce-or-sequence, action fields**. Core is both the vault and owner/emitter, so it intentionally appears twice. The family domains are:

| Family | Owner/emitter | Generation | Nonce or sequence |
|---|---|---|---|
| accounting mutation | Core | zero for sync/reclassification; active ingress generation for canonical deposit | accountingSequence |
| accounting component | Core | same generation as its parent mutation | accountingSequence |
| canonical deposit | Core | active ingress generation | sourceEventId, the canonical external-event replay key |

**syncSubjectHash** is a supporting action-field hash, not a record ID, replay key, or V2 family. It has no independent tag or consumer and is protected by the enclosing accounting-mutation/component domain.

The exact preimages are:

~~~text
syncSubjectHash = keccak256(abi.encode(
    preTotals,
    postTotals
))

mutationId = keccak256(abi.encode(
    ACCOUNTING_MUTATION_TAG,
    uint256(4663),
    address(core),
    address(core),
    evidenceGeneration,
    accountingSequence,
    uint8(mutationKind),
    subjectId
))

componentId = keccak256(abi.encode(
    ACCOUNTING_COMPONENT_TAG,
    uint256(4663),
    address(core),
    address(core),
    evidenceGeneration,
    accountingSequence,
    mutationId,
    componentIndex,
    uint8(componentKind),
    componentSubjectId,
    amountWei
))

depositId = keccak256(abi.encode(
    CANONICAL_DEPOSIT_TAG,
    uint256(4663),
    address(core),
    address(core),
    activeIngressGeneration,
    sourceEventId,
    address(authority),
    activeIngress,
    activeIngressConfigHash
))
~~~

The sync subject is **syncSubjectHash**; reclassification uses the caller-supplied details hash; deposit uses **depositId**. The accounting evidence generation is zero for sync and reclassification and the exact active ingress generation for deposit. Components copy their parent generation and accounting sequence. These are intentional V2 changes and exact generic-template applications. The undeployed monolith creates no record-compatibility obligation.

## 13. Exact Factory/Authority/Core call allowlist

Task 3 adds only these callsites to the already-approved Task 2 graph:

| Caller | Target | Type | Selector | Gas | Output | Failure |
|---|---|---|---|---:|---:|---|
| Factory | Core | STATICCALL | coreSnapshot() | 100,000 | 576 | normalized |
| Authority | Core | STATICCALL | globalLifetimeCanonicalDepositCapWei() | 50,000 | 32 | normalized |
| Core | Authority | STATICCALL | authoritySnapshot() | 160,000 | 864 | normalized |
| Core | Authority | STATICCALL | getIngress(uint256) | 100,000 | 256 | normalized |

Every call uses zero value, fixed input and output memory, exact return length, no dynamic returndata copy, and no revert bubbling. Repeated uses of the Authority-to-Core cap call at proposal and activation and of the Core-to-Authority snapshot across business functions are phase-complete uses of the same frozen helpers, not new generic callsites.

Core runtime has no CALL, value transfer, ERC-20 call, approval, permit, sweep, adapter call, arbitrary target, arbitrary calldata, generic proxy, delegatecall, callcode, CREATE, CREATE2, selfdestruct, receive, or fallback. Its only external runtime calls are the two bounded Authority STATICCALL helpers. Factory retains the single approved raw CREATE and fixed finalizer calls. Authority retains its approved ERC-1271 path plus the new bounded Core cap STATICCALL.

## 14. ABI census and collision universe

With the unique Core error rule in section 6, the exact final Task 3 compiled ABI census is:

| Artifact | Functions | Errors | Events | Constructors | ABI entries |
|---|---:|---:|---:|---:|---:|
| Factory | 4 | 35 | 2 | 1 | 42 |
| Authority | 50 | 54 | 18 | 1 | 123 |
| Core | 23 | 36 | 5 | 1 | 65 |
| BudgetBook shell | 2 | 5 | 1 | 1 | 9 |
| IntentExecution shell | 2 | 5 | 1 | 1 | 9 |
| Reconciliation shell | 2 | 5 | 1 | 1 | 9 |
| **Compiled total** | **83** | **140** | **28** | **6** | **257** |

Because **ReentrancyGuardReentrantCall()** appears in both Authority and Core, the compiled surface contains 139 unique semantic error descriptors. The historical FUTURE_RESERVED set adds two callable selectors, six unique semantic-error selectors, and one event topic. The exact collision universes are therefore:

- 85 callable function selectors;
- 145 unique semantic-error selectors;
- 29 full event signatures/topics;
- six constructors verified separately.

The verifier must reject any Authority-owned selector originated by Core and distinguish the 140 compiled error entries from the 139 unique compiled descriptors and the 145-descriptor future-inclusive collision universe.

All Task 3 deployables remain solc 0.8.26, optimizer enabled with 800 runs, Cancun, and the exact phase-selected constellation via-IR profile. Runtime and initcode limits remain 24,576 and 49,152 bytes. No size, hash, source-provenance, immutable-reference, storage, IR, opcode, or collision count is accepted from a default-profile or duplicate artifact.

## 15. Stock Token architecture amendment

The earlier constellation summary assigned hold-only Stock Token aggregates to constellation Task 3, while master acceptance slice 5 (**A3+R**) assigns attempt-bound Stock Token observation and reconciliation across constellation Task 5 (**Intent**) and constellation Task 6 (**Reconciliation**). Constellation Task 3 has no attempt ID, execution phase, immutable asset-version/token pair, adapter result, or reconciliation case. It cannot truthfully classify a token balance change as a fill, unattributed stock, or negative drift.

This freeze resolves the conflict as follows:

> **Constellation Task 3 — Registry-bound passive Stock Token custody.** Task 3 binds Core immutably to the Factory-committed StockTokenRegistryV2 and preserves Core as the sole future Stock Token custody/accounting authority. Task 3 adds only the already-crosswalked stockTokenRegistryV2() getter. It adds no stock sequence, per-version aggregate, fill record, unattributed-stock record, negative-drift record, Stock Token mutation, Stock Token event, token balance proxy, or token movement surface. Any ERC-20 balance physically sent to Core before constellation Task 6 is inert, unaccounted physical custody and cannot block deployment or finalization.
>
> **Constellation Task 5 — Intent/attempt identity and dormant interfaces only.** Task 5 freezes the immutable intent’s asset version, token, ingress generation, adapter, route, attempt schema, and attempt identity, but performs no attempt-consumption transition and makes no adapter or Core Stock Token observation/accounting call while Reconciliation remains a shell. Every execution or consumption entry point is absent or fails before state change and before any adapter call. Any Task 5 preparatory interface or storage design remains dormant and cannot classify or mutate physical token custody.
>
> **Constellation Task 6 — Atomic execution, authoritative Stock Token observation/accounting, and completion of master slice 5 (A3+R).** Task 6 introduces the callable Core-owned stockSequence, exact per-version current/cumulative aggregates, per-attempt fill records, unattributedStock, negative-drift observations, and exact NativeAndStockObserved event together with the Reconciliation case path required by the atomic outcome table. The single typed path consumes the attempt immediately before the adapter call, invokes the adapter, performs authoritative post-call Core native/Stock Token observation, applies Core delta mutation/components, opens any required Reconciliation case, writes the Intent outcome journal and AttemptResultRecorded receipt, then emits terminal evidence, all atomically and using the immutable intent’s asset version, token, ingress generation, and attempt identity. Before implementation, Task 6 must freeze the complete event signature/indexing, storage structs, error set, balance-call gas/returndata policy, token-runtime identity policy, generic unmatched-transfer sync policy if any, collision changes, and exact atomic ordering for every outcome. Reconciliation consumes typed evidence but never owns Core totals or custody.

Task 3 performs no token transfer, transferFrom, approval, permit, sweep, recovery, sale, delivery, generic external call, or balance query. A token can transfer to a predictable address without recipient consent; such physical custody does not become protocol inventory.

Master acceptance slice 9 (**D**, atomic allocation and permanent deed delivery)—not constellation Task 9, which is independent closure—remains a separate explicit architecture decision against the constellation’s categorical no-transfer Core boundary. Constellation Task 3 must not silently create that delivery seam.

## 16. RED/GREEN and mutation matrix

Task 3 implementation cannot begin until this freeze is independently approved. Closure then requires all of the following.

### Fresh graph and construction

- Task 2 artifacts, addresses, configuration roots, manifests, and deployment commitments are rejected.
- Exact Task 3 cap-bound configuration formula and constructor precedence.
- Cap below, equal to, and above forced prefunding does not affect snapshot/finalization.
- Every zero, code, address, peer, prediction, hash, and cap branch and compound-invalid precedence.
- Core constructor contains no CALL or STATICCALL.
- Exact immutable references and CREATE nonce positions.

### Factory/Core snapshot

- Exact 18-word ABI and 576-byte return.
- Exact 100,000-gas binding, fixed output, and no dynamic return copy.
- Return lengths 575, 577, large/bomb, revert, and OOG.
- Dirty address padding, dirty Boolean, every field 0–17, and all adjacent precedence edges.
- Atomic rollback and repair/retry.
- Authority snapshot failure precedes Core snapshot failure.
- Forced ETH and arbitrary known/unknown ERC-20 balances never block finalization.

### Finalization and dormant behavior

- All three business mutators fail **CoreNotFinalized** before finalization.
- Finalizer caller/hash/already/initial-field precedence.
- Each mutable field 10–17 independently corrupted and detected.
- Mapping roots remain unwritten before finalization.
- Shared reentrancy guard and callback attempts against all three mutators.
- Unpause remains fail-closed ordinal 11.

### Authority cap bridge

- Proposal and activation at cap minus one, exact cap, and cap plus one.
- Revert, OOG, 31/33/large return, zero cap, and exact 50,000-gas binding.
- No state, log, nonce, or proposal consumption on failure.
- Local invalid config precedes Core read.
- Proposal cap failure precedes code/hash/collision/details.
- Activation missing/wrong ID, window, and active-ingress failures precede Core read.
- Cancellation, expiry, and disable make no Core call.
- Authority has no cap storage or mirror.

### Core Authority reads

- Exact targets, selectors, values, gas, fixed outputs, and return lengths.
- Revert bombs, huge returndata, short/long returns, and OOG.
- Every Authority snapshot encoding/identity field.
- Active generation/address/config cross-consistency.
- Every ingress-record field, dirty address, dirty uint64, disabled record, and synthetic config-hash field.
- No peer revert bubbling, no dynamic return copy, and no partial state/log change.
- Safe handoff, ingress rotation, and ingress disable take effect immediately.
- Pending owner, operator, or ingress never gains current authority.

### Accounting and deposits

- The independently approved 38-test historical accounting oracle is adapted only for the fresh graph and independently derived V2 IDs.
- Forced surplus maps to U, never A.
- Deficit observations progress and clear exactly; duplicate sync rejects.
- Combined surplus/observation component order.
- Reclassification rejects during deficit or shortfall.
- Sequence exhaustion occurs before writes for all three mutators.
- uint64 maximum timestamp and first invalid timestamp.
- Partial, exact, and over-deficit repair.
- Full-value cap consumption during repair.
- Every cap at minus one, exact, and plus one.
- UTC-day rollover, ingress-generation reset, and global persistence.
- Replay, generation/config domain separation, prior-above-cap panic, value refund, full rollback, and event order.

### Stock passive custody

- Registry getter equals the Factory-committed Registry before and after finalization.
- Wrong Core Registry identity fails Factory preflight atomically.
- Active, inactive historical, and unknown tokens transferred before deployment/finalization remain physically held and never create Core state or logs.
- The exact 23-function allowlist excludes **syncStockToken(address)**, **recordStockFill(bytes32,uint256)**, **transfer(address,uint256)**, **approve(address,uint256)**, **sweepToken(address,address,uint256)**, **recoverToken(address,uint256)**, and **allocateStock(bytes32,address,uint256)**; low-level probes of those nonprotocol descriptors revert. Native **syncBalance()** remains required.
- No stock mappings, sequences, records, aggregates, events, errors, token calls, or balance assertions exist.

### Verifier and mutation requirements

- The verifier parameter is exactly **ValidateSet('Task1','Task2','Task3')** and its default advances to **ValidatePhase = 'Task3'**.
- A conforming Task 3 graph under default or explicit Task3 validation exits 0. A complete Task 1 or Task 2 graph under Task3 exits 1.
- Each conforming historical graph exits 0 only under its exact explicit Task1 or Task2 phase. A complete graph from any other phase under Task1, Task2, or Task3 exits 1.
- All six artifacts absent exit 42, except **-ExpectTask0Red** exits 0. A partial six-artifact set exits 43. A malformed or nonconforming complete set exits 1.
- A conforming complete set plus **-ExpectTask0Red** exits 44 only after full conformance has been evaluated. Artifact cardinality is classified before phase conformance, while complete-set conformance precedes the exit-44 rejection.
- Exact 83/140/28/6/257 compiled census and 85/145/29 collision universes, or fail the freeze if compiler evidence disproves a count.
- Exact storage slots, type graph, immutables, source hashes, compiler profile, bytecode, sizes, IR, and opcode/callsite bindings.
- Kill mutations that count only deposit credit toward caps, introduce ingress/Safe/cap mirrors, catch or bubble peer failure, forward unbounded gas, accept wrong output size, reorder evidence, write records before validation, add hidden payable/token surfaces, reject physical token prefunding, or add unapproved error selectors.
- Run the new Task 3 suites plus every established Task 2, Task 1, crosswalk, accounting, operator, Registry V2, and historical oracle suite in isolated output/cache directories.

## 17. Implementation and review order

The dependency order is:

1. independent security review of this freeze;
2. independent specification/crosswalk review of this freeze;
3. resolve every Critical, Important, and Minor finding or explicitly reject it with evidence;
4. Task 3 verifier and RED tests;
5. Task 3A Factory/Core cap bridge and Authority dual-read implementation;
6. Task 3A adversarial review and GREEN checkpoint;
7. Task 3B complete Core accounting/deposit implementation;
8. full adversarial, behavioral, collision, storage, opcode, provenance, and regression verification;
9. independent implementation security and specification reviews;
10. truth-surface closure commit.

No Task 3 stage deploys, funds, signs, migrates, or activates anything. Passing this node means only that another fresh dormant pre-production constellation is implemented and independently approved for the next graph transition.
