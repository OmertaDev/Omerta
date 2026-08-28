# Acquisition Constellation Task 4 — Pre-Vote BudgetBook Architecture Freeze

**Status:** exact architecture freeze independently approved after remediation (security C0/I0/M0; specification C0/I0/M0; artifact/crosswalk feasibility C0/I0/M0); no Task 4 production source, RED suite, verifier phase, deployment, funding, activation, or production approval exists yet

**Inputs:** the approved constellation architecture, Task 0 ownership/collision crosswalk, independently approved Task 3 architecture at `23b58923`, Task 3 Core implementation at `cafdd9f1`, Task 3 exact verifier at `818d295a`, the corrected historical pre-vote budget provenance, and the grill-completion acceptance graph.

## 0. Decision and dependency boundary

Task 4 is a fresh, dormant constellation. It deploys a new Factory and five new children in the unchanged ordinary-`CREATE` order Authority, Core, BudgetBook, IntentExecution, and Reconciliation at Factory nonces 1–5. It migrates no Task 3 address, balance, deposit, role, nonce, ingress record, accounting bucket, or authorization.

Only `PreVoteBudgetBook` advances from its Task 3 topology shell. Authority and Core retain their Task 3 behavior and are read through their already-frozen fixed-width views. IntentExecution and Reconciliation remain topology shells. Task 4 does not add intent creation, reservation, attempt consumption, adapter execution, Stock Token movement, reconciliation, O2, recovery, or any production deployment action.

BudgetBook is immutable evidence only:

- exactly one successful authorization record per `ballotDay`;
- no ETH or Stock Token accounting;
- no reservation, debit, consumption, cancellation, expiry mutation, rewrite, replacement, rollover, catch-up, or promise of later funding;
- no ballot result, winner, token, asset-version, tally, vote, catalog, oracle, adapter, provider, or activation authority;
- no Registry, token, ballot, consumer, IntentExecution, or Reconciliation call;
- no owner, Safe, pause, operator, ingress, available, deficit, shortfall, or sequence mirror.

The only runtime peer reads are one bounded `STATICCALL` to Authority and, after every local check, one bounded `STATICCALL` to Core. Registry is immutable domain context and is never called.

## 1. Resolved historical ambiguities

This freeze makes the following choices explicit so RED tests encode architecture rather than invent it:

1. **V2 evidence identity wins.** The constellation's later closed V2 catalog supersedes the historical monolith's V1 formula. The exact literal is `keccak256("OMERTA_ACQUISITION_BUDGET_AUTHORIZATION_V2")`, and the preimage includes both Core and BudgetBook. The historical V1 row remains a behavioral oracle, not the Task 4 production identity.
2. **`address(this)` means BudgetBook.** Core is a separate preceding field. Registry is the immutable `StockTokenRegistryV2` address.
3. **Live Authority truth wins.** Only the current Authority owner may authorize, and Authority must be unpaused. The launch Safe, pending Safe, main operator, pending operator, ingress roles, Factory, and peer contracts do not authorize.
4. **Live derived accounting wins.** BudgetBook reads `Core.accountingTotals()`, not `coreSnapshot()` or `lastObservedBalanceDeficitWei`. It validates the returned equations against the actual Core ETH balance before applying the `D == 0`, reconciliation `S == 0`, and `maxEthWei <= A` gates.
5. **Forced surplus is validated but not a gate.** `F` must equal `max(V-B,0)`, but a nonzero `F` does not increase `A` and does not itself invalidate an authorization. Task 4's historical gates are balance deficit `D == 0` and reconciliation shortfall `S == 0`.
6. **No mutation guard is added.** Both peer interactions are `STATICCALL`; the static EVM context prevents a peer subtree from mutating BudgetBook. A callback that exhausts its bounded call budget is normalized as peer-call failure. Adding a guard would create an unnecessary storage root and a pre-validation `SSTORE` without opening any secure path unavailable under the static boundary.
7. **The getter is not finalization-gated.** Before finalization or before a day exists, `getPreVoteBudget(day)` reverts `BudgetNotFound(day)`. Only the mutator is dormant-gated.
8. **Timestamp and deadline are separate boundaries.** `block.timestamp == type(uint64).max` passes the timestamp cast check but cannot complete authorization for its current UTC day because the required deadline overflows `uint64`; `type(uint64).max + 1` fails `BudgetBookTimestampOverflow()` first.
9. **Replay is checked before peer reads.** Once a day has a nonzero `budgetId`, every later authorization attempt for that day fails `BudgetAlreadyAuthorized(day)` without calling Authority or Core. The record is already observable through the getter, so this ordering leaks no private fact and removes two avoidable griefing surfaces.

## 2. Exact Task 4 ABI

### 2.1 Structs and functions

~~~solidity
struct PreVoteBudgetInput {
    uint256 ballotDay;
    uint256 maxEthWei;
    uint64 purchaseUntil;
}

struct PreVoteBudgetAuthorization {
    bytes32 budgetId;
    uint256 ballotDay;
    uint256 maxEthWei;
    uint64 purchaseUntil;
    uint256 availableAtAuthorizationWei;
    uint256 accountingSequence;
    uint64 authorizedAt;
    bytes32 detailsHash;
}

function budgetBookTopology()
    external view
    returns (address factory, bytes32 manifestHash, bool finalized);

function finalizeBudgetBook(bytes32 manifestHash) external;

function authorizePreVoteBudget(
    PreVoteBudgetInput calldata input,
    bytes32 detailsHash
) external returns (bytes32 budgetId);

function getPreVoteBudget(uint256 ballotDay)
    external view
    returns (PreVoteBudgetAuthorization memory authorization);
~~~

There are exactly four functions. The mapping is private, so no automatic fifth getter exists. Both mutators and the constructor are nonpayable; both getters are `view`; no function is payable. There is no `receive`, `fallback`, generic execute, cancel, replace, consume, reserve, release, sweep, recovery, transfer, ballot publication, result, or token function.

### 2.2 Events

~~~solidity
event BudgetBookFinalized(bytes32 indexed manifestHash);

event PreVoteBudgetAuthorized(
    bytes32 indexed budgetId,
    uint256 indexed ballotDay,
    uint256 maxEthWei,
    uint64 purchaseUntil,
    uint256 availableAtAuthorizationWei,
    uint256 accountingSequence,
    uint64 authorizedAt,
    uint8 reasonCode,
    bytes32 detailsHash
);
~~~

Both events are non-anonymous. `PreVoteBudgetAuthorized` has exactly two indexed fields and always carries raw `uint8(19)` as its reason code. A successful authorization emits only this event, from BudgetBook, after the complete record write. Authority and Core are read-only and emit nothing.

### 2.3 Closed error set

BudgetBook has exactly 29 errors.

Existing topology errors:

~~~solidity
error BudgetBookFactoryZero();
error BudgetBookManifestHashZero();
error BudgetBookFinalizerUnauthorized(address caller);
error BudgetBookManifestHashMismatch(bytes32 expected, bytes32 actual);
error BudgetBookAlreadyFinalized();
~~~

Task 4 module-local infrastructure and authorization errors:

~~~solidity
error BudgetBookNotFinalized();
error BudgetBookZeroAddress();
error BudgetBookContractRequired(address account);
error BudgetBookAddressMismatch(address expected, address actual);
error BudgetBookPeerMismatch(uint8 peer, address expected, address actual);

error BudgetBookAuthoritySnapshotCallFailed();
error BudgetBookAuthoritySnapshotReturnLength(uint256 actualLength);
error BudgetBookAuthoritySnapshotSemanticMismatch(uint8 field);

error BudgetBookCoreAccountingCallFailed();
error BudgetBookCoreAccountingReturnLength(uint256 actualLength);
error BudgetBookCoreAccountingSemanticMismatch(uint8 field);

error BudgetBookUnauthorized(address caller);
error BudgetBookPaused();
error BudgetBookEmptyDetailsHash();
error BudgetBookInvalidAmount();
error BudgetBookTimestampOverflow();
error BudgetBookBalanceDeficitActive(uint256 deficitWei);
error BudgetBookReconciliationShortfallActive(uint256 shortfallWei);
~~~

Historical business errors retained verbatim:

~~~solidity
error BudgetDayClosed(uint256 ballotDay);
error BudgetDeadlineOverflow();
error InvalidPurchaseUntil(uint64 expected, uint64 supplied);
error BudgetAlreadyAuthorized(uint256 ballotDay);
error InsufficientAvailable(uint256 availableWei, uint256 requestedWei);
error BudgetNotFound(uint256 ballotDay);
~~~

BudgetBook never originates an Authority- or Core-owned error and never bubbles peer revert data.

### 2.4 Exact compiled census target

Task 3's compiled `83/140/28/6/257` becomes:

| Artifact | Functions | Errors | Events | Constructors | ABI entries |
|---|---:|---:|---:|---:|---:|
| Factory | 4 | 35 | 2 | 1 | 42 |
| Authority | 50 | 54 | 18 | 1 | 123 |
| Core | 23 | 36 | 5 | 1 | 65 |
| BudgetBook | 4 | 29 | 2 | 1 | 36 |
| Intent shell | 2 | 5 | 1 | 1 | 9 |
| Reconciliation shell | 2 | 5 | 1 | 1 | 9 |
| **Total** | **85** | **164** | **29** | **6** | **284** |

The compiled set has 163 unique error descriptors. `ReentrancyGuardReentrantCall()` remains the sole intentional compiled duplicate, shared by Authority and Core. Moving the two BudgetBook functions, six historical errors, and one event from `FUTURE_RESERVED` to compiled ownership does not duplicate them. The collision universe expands only for the 18 new module-local errors: `85/163/29` unique function/error/event descriptors.

## 3. Constructor, immutables, and deployment order

The exact constructor is:

~~~solidity
constructor(
    address factory,
    bytes32 manifestHash,
    address authority,
    address core,
    address registry
)
~~~

It stores exactly five private immutables: `_factory`, `_manifestHash`, `_authority`, `_core`, and `_registry`. IntentExecution and Reconciliation are derived from Factory nonces 4 and 5 when validating the Authority snapshot; they are not stored.

Constructor precedence is exact:

1. zero Factory -> `BudgetBookFactoryZero()`;
2. zero manifest -> `BudgetBookManifestHashZero()`;
3. zero Authority, then zero Core, then zero Registry -> `BudgetBookZeroAddress()`;
4. Registry without code -> `BudgetBookContractRequired(registry)`;
5. `address(this)` differs from Factory nonce-3 prediction -> `BudgetBookAddressMismatch(expected, actual)`;
6. Authority differs from Factory nonce-1 prediction -> `BudgetBookPeerMismatch(0, expected, supplied)`;
7. Core differs from Factory nonce-2 prediction -> `BudgetBookPeerMismatch(1, expected, supplied)`;
8. Authority without code -> `BudgetBookContractRequired(authority)`;
9. Core without code -> `BudgetBookContractRequired(core)`;
10. store immutables; leave mutable state exactly zero.

The constructor makes no `CALL`, `STATICCALL`, `DELEGATECALL`, `CALLCODE`, `CREATE`, or `CREATE2`. It uses no mutable block context other than `address(this)`. Deployment value is zero. Forced ETH prefunded at the predicted address remains physically present, inert, unaccounted, and unrecoverable; it does not block construction or finalization.

Task 4 uses the existing Factory manifest and ordinary-`CREATE` pipeline with new exact BudgetBook initcode/runtime commitments. All six Task 3 artifacts are historical evidence and are invalid Task 4 artifacts, even where an unaffected source file is text-identical.

## 4. Finalization and storage

### 4.1 Finalization

`finalizeBudgetBook` preserves the Task 3 shell order exactly:

1. caller must be Factory;
2. supplied manifest must equal the immutable manifest;
3. `_finalized` must be false;
4. set `_finalized = true`;
5. emit `BudgetBookFinalized(manifestHash)`.

It makes no peer call and does not inspect ETH/token balances. Because Factory finalizes BudgetBook before Core and Authority, no finalizer may require those peers to report `finalized == true`.

### 4.2 Exact mutable storage

Mutable storage contains exactly two top-level rows:

| Label | Slot/root | Offset | Type |
|---|---:|---:|---|
| `_finalized` | 0 | 0 | `bool` |
| `_preVoteBudgets` | 1 | 0 | `mapping(uint256 => PreVoteBudgetAuthorization)` |

The mapping key is `uint256 ballotDay`. Its value is exactly the eight-member record below, occupying eight 32-byte member slots relative to the mapping leaf:

| Member | Relative slot | Offset | Type |
|---|---:|---:|---|
| `budgetId` | 0 | 0 | `bytes32` |
| `ballotDay` | 1 | 0 | `uint256` |
| `maxEthWei` | 2 | 0 | `uint256` |
| `purchaseUntil` | 3 | 0 | `uint64` |
| `availableAtAuthorizationWei` | 4 | 0 | `uint256` |
| `accountingSequence` | 5 | 0 | `uint256` |
| `authorizedAt` | 6 | 0 | `uint64` |
| `detailsHash` | 7 | 0 | `bytes32` |

`budgetId != bytes32(0)` is the sole existence sentinel. There is no guard, count, list, index, nonce, tombstone, used bit, cancellation marker, reservation, result, winner, token, provider, or cached peer state. Complete enumeration is off-chain event/mirror work.

## 5. Exact Authority read protocol

BudgetBook performs one zero-value bounded read:

| Target | Selector | Gas | Input | Output |
|---|---|---:|---:|---:|
| immutable Authority | `authoritySnapshot()` | 160,000 | 4 bytes | exactly 864 bytes |

The implementation uses a fixed 27-word memory buffer. It never dynamically ABI-decodes, copies, or bubbles return/revert data. `ok == false`, including OOG or a returndata/revert bomb, becomes `BudgetBookAuthoritySnapshotCallFailed()`. A successful call with any size other than 864 becomes `BudgetBookAuthoritySnapshotReturnLength(actual)`.

The 27 words are checked in ascending ordinal order. The first mismatch becomes `BudgetBookAuthoritySnapshotSemanticMismatch(ordinal)`:

| Ordinal | Exact requirement |
|---:|---|
| 0 | schema version `2` |
| 1 | immutable Factory |
| 2 | immutable manifest |
| 3 | immutable Registry |
| 4 | immutable Core |
| 5 | `address(this)` BudgetBook |
| 6 | Factory nonce-4 IntentExecution |
| 7 | Factory nonce-5 Reconciliation |
| 8 | canonical Boolean `true` |
| 9 | clean, nonzero, code-bearing current Safe |
| 10 | clean pending Safe; zero or code-bearing |
| 11 | canonical Boolean pause value |
| 12 | clean current main operator; zero is allowed before the first nomination |
| 13 | clean pending main operator; zero allowed |
| 14–17 | full-width counters/generations accepted |
| 18 | full-width active ingress generation |
| 19 | clean active ingress address |
| 20 | active ingress config hash |
| 21 | clean pending ingress address |
| 22–26 | full-width pending hashes/nonces accepted |

The active ingress tuple must also be coherent: generation zero requires words 19 and 20 to be zero; generation nonzero requires both nonzero and the active ingress to contain code. A nonzero pending ingress must contain code. These coherence failures use the first affected ordinal, 19 then 20 then 21.

After the full snapshot is authenticated, `msg.sender` must equal word 9 or `BudgetBookUnauthorized(msg.sender)` is raised. Only then is word 11 checked; a paused current Safe receives `BudgetBookPaused()`. Thus unauthorized precedes paused, and ownership transfer affects BudgetBook immediately without a mirror.

## 6. Exact Core accounting read protocol

After finalization, replay, Authority, caller/pause, input, timestamp, deadline, and day validation, BudgetBook performs one zero-value bounded read:

| Target | Selector | Gas | Input | Output |
|---|---|---:|---:|---:|
| immutable Core | `accountingTotals()` | 100,000 | 4 bytes | exactly 352 bytes |

The implementation uses a fixed 11-word buffer. Failure/OOG/bomb becomes `BudgetBookCoreAccountingCallFailed()`. Any successful size other than 352 becomes `BudgetBookCoreAccountingReturnLength(actual)`. No dynamic returndata or revert data is copied or bubbled.

Words are:

~~~text
0 A = availableWei
1 U = unattributedWei
2 R = ordinaryReservedWei
3 L = reconciliationLiabilityWei
4 P = reconciliationBackingWei
5 S = reconciliationShortfallWei
6 B = accountedBackingWei
7 V = actualBalanceWei
8 D = balanceDeficitWei
9 F = forcedSurplusWei
10 accountingSequence
~~~

Semantic validation is exact and checked without arithmetic panic. The first failure is `BudgetBookCoreAccountingSemanticMismatch(field)`:

1. field 4: `P <= L`;
2. field 5: `S == L - P`;
3. field 6: `B == A + U + R + P`, with every addition checked and overflow normalized to field 6;
4. field 7: `V == address(_core).balance`;
5. field 8: `D == max(B - V, 0)`;
6. field 9: `F == max(V - B, 0)`.

Fields 0–3 and 10 otherwise accept arbitrary full-width values. `accountingSequence == type(uint256).max` is valid because BudgetBook snapshots and never increments it.

After semantic validation:

1. nonzero `D` -> `BudgetBookBalanceDeficitActive(D)`;
2. nonzero reconciliation `S` -> `BudgetBookReconciliationShortfallActive(S)`;
3. `maxEthWei > A` -> `InsufficientAvailable(A, maxEthWei)`.

The authorization does not compare against `V`, `B`, or `F`, and it never changes Core.

## 7. Calendar, exact ID, and immutable evidence

UTC day identity and deadline are:

~~~solidity
currentDay = block.timestamp / 1 days;
expectedPurchaseUntil = uint64((ballotDay + 1) * 1 days + 2 hours);
~~~

The implementation checks `ballotDay + 1`, multiplication by `1 days`, addition of `2 hours`, and `uint64` fit explicitly. Any failure is `BudgetDeadlineOverflow()`. Current day and any representable future day are allowed. A past day is `BudgetDayClosed(ballotDay)`. A representable but non-exact supplied deadline is `InvalidPurchaseUntil(expected, supplied)`.

The independent boundary oracle is:

~~~text
maxRepresentableBallotDay = floor((uint64.max - 2 hours) / 1 days) - 1
latestFullPathTimestamp = (maxRepresentableBallotDay + 1) * 1 days - 1
~~~

The exact ID is:

~~~text
BUDGET_AUTHORIZATION_V2 = keccak256(
    "OMERTA_ACQUISITION_BUDGET_AUTHORIZATION_V2"
)

budgetId = keccak256(abi.encode(
    BUDGET_AUTHORIZATION_V2,
    uint256(4663),
    address(_core),
    address(this),
    address(_registry),
    input.ballotDay,
    input.maxEthWei,
    input.purchaseUntil,
    totals.accountingSequence
))
~~~

The ID changes with chain, Core, BudgetBook, Registry, day, maximum, deadline, or accounting sequence. It excludes Authority generation, Safe, operator, ingress, details hash, authorization timestamp, budget nonce, ballot ID, winner, asset version, token, decimals, activation generation, tally, catalog, votes, publication, and result.

Success stores exactly:

~~~text
budgetId                    = derived ID
ballotDay                   = input.ballotDay
maxEthWei                   = input.maxEthWei
purchaseUntil               = input.purchaseUntil
availableAtAuthorizationWei = A from the authenticated Core totals
accountingSequence          = sequence from the same Core totals
authorizedAt                = uint64(block.timestamp)
detailsHash                 = supplied detailsHash
~~~

The full record is constructed in memory, written once to the day leaf, and then emitted. Later role, pause, ingress, Registry, accounting, balance, or time changes cannot alter it.

## 8. Exact authorization precedence and call counts

`authorizePreVoteBudget` has this closed precedence:

1. not finalized -> `BudgetBookNotFinalized()`;
2. existing nonzero day record -> `BudgetAlreadyAuthorized(ballotDay)`;
3. Authority call failure;
4. Authority return length;
5. lowest Authority semantic ordinal;
6. caller is not current Safe;
7. Authority is paused;
8. zero details hash;
9. zero amount;
10. `block.timestamp > type(uint64).max`;
11. deadline arithmetic or narrowing overflow;
12. `ballotDay < currentDay`;
13. supplied deadline mismatch;
14. Core call failure;
15. Core return length;
16. lowest Core semantic ordinal;
17. nonzero balance deficit;
18. nonzero reconciliation shortfall;
19. amount exceeds available;
20. derive ID, write one record, emit one event, return ID.

Expected peer-call counts:

| Branch | Authority | Core |
|---|---:|---:|
| pre-finalized or replay failure | 0 | 0 |
| Authority transport/semantic/caller/pause failure | 1 | 0 |
| local/timestamp/day/deadline failure | 1 | 0 |
| Core transport/semantic/financial failure | 1 | 1 |
| success | 1 | 1 |

Every failure leaves the record, logs, BudgetBook balance, Core balance/totals/sequence, and Authority state unchanged.

## 9. Runtime and artifact policy

Production runtime permits exactly two `STATICCALL` families, one at 160,000 gas with a 4/864 schema and one at 100,000 gas with a 4/352 schema. Constructor runtime-reachable call inventory is zero.

The inherited exact compiler profile is Solidity `0.8.26`, optimizer enabled with 800 runs, `via_ir = true`, and Cancun EVM. Task 4 may not silently change that profile to obtain a different ABI, layout, call shape, or size result.

The verifier must reject:

- generic or value-bearing `CALL`;
- extra `STATICCALL`;
- `DELEGATECALL`, `CALLCODE`, `CREATE`, `CREATE2`, or `SELFDESTRUCT`;
- `RETURNDATACOPY`, dynamic peer decoding, revert bubbling, or arbitrary selector forwarding;
- token `transfer`, `transferFrom`, `approve`, permit, sweep, recovery, ballot, result, adapter, oracle, or generic execute selectors;
- payable functions, `receive`, or `fallback`;
- source/source-set/compiler/profile drift;
- immutable reference swaps, including same-type peer swaps;
- storage-root, mapping-key/value, record-member, slot, offset, or type drift;
- event field/index/anonymous/emitter/reason drift;
- mixed-case or whitespace-obfuscated optimized-IR call primitives.

After GREEN, the verifier freezes measured—not estimated—ABI fingerprints, semantic immutable maps, source hashes, source sets, storage graph, init/runtime/suffix sizes, portable executable identities, opcode inventories, and optimized-IR call schemas. Task 4 must remain below EIP-170 runtime and EIP-3860 initcode limits with explicit headroom.

## 10. RED test graph

The focused RED file is `omerta-contracts/test/AcquisitionConstellationTask4BudgetBook.t.sol`. Test-local future interfaces and low-level deployment/calls must compile against the current Task 3 shell and fail because the Task 4 surface is absent. No production source is changed until the RED artifact gate is independently reviewed.

The minimum named matrix is:

1. exact ABI with every constructor/function/input/output/tuple/error/event parameter name and order, exact mutability, 29 errors, event indexing/anonymity, and forbidden surface;
2. constructor precedence, nonce predictions, immutable peers, no calls, and forced prefunding;
3. finalizer precedence, one-shot state/event, no peer calls;
4. pre-finalization mutator dormancy and ungated missing-record getter;
5. Authority exact target/selector/value/gas/length and no revert/returndata bubbling;
6. every Authority semantic ordinal, dirty address padding, canonical Booleans, and tuple coherence;
7. current Safe only, immediate ownership handoff, pending/operator/ingress exclusions, pause precedence, and no role mirror;
8. replay precedence, zero peer calls, changed-payload immutability;
9. details/amount compound precedence;
10. current/future/past UTC day identity and midnight boundaries;
11. every deadline arithmetic/narrowing edge and independent fuzz oracle;
12. `uint64` timestamp and latest-full-path boundaries;
13. Core exact target/selector/value/gas/length and no bubbling;
14. every Core equation, checked-overflow normalization, actual-balance binding, and lowest semantic ordinal;
15. deficit, reconciliation shortfall, and available precedence;
16. one wei, exact available, available plus one, and `uint256.max` accounting sequence;
17. exact V2 ID, record fields, event topics/data/emitter/reason/order, and no accounting movement;
18. included-field domain separation and forbidden-field exclusion;
19. one immutable record per day and independent days;
20. later accounting/roles/pause/expiry never rewrite records;
21. skipped/unused days create no reservation, debt, rollover, catch-up, or right;
22. Registry/token/oracle/adapter/result sentinels prove they are never called;
23. full compound-invalid precedence sweep covering every adjacent pair in stages 1–19, plus representative non-adjacent triples, with the exact winning error and peer-call count;
24. exact Authority-before-Core order and at-most-once calls;
25. success writes only the mapping leaf, after all checks, then emits;
26. every failure rolls back state/value/logs and leaves no stuck state;
27. forced ETH and known/unknown tokens remain inert and unrecoverable;
28. real fresh Factory/Authority/Core/Registry/BudgetBook lifecycle;
29. exact two-row storage and eight-member value graph;
30. exact opcode/IR external-call allowlist and size limits;
31. crosswalk moves the nine historical BudgetBook rows from future to compiled exactly once;
32. verifier mutations for ABI parameter names, source, compiler, immutable, storage, size, suffix, call/gas/length, result field, and hidden surface;
33. stateful invariant: at most one immutable record per day, exact independent ID, and no funds/accounting movement.

Hostile fixtures are narrow and deterministic: raw 27-word Authority oracle; raw 11-word Core oracle; code-bearing current/pending Safe actors; no-call Registry sentinel; revert bomb; return bomb; gas burner; forced-ETH helper; hostile token; and raw CREATE dispatcher. Reused mutable expected structs are prohibited; each expected pre/post value is independently constructed.

## 11. Verification and historical phase matrix

Task 4 verification requires:

1. focused Task 4 RED/implementation/invariant suite;
2. Task 3 Authority, Core, accounting, deposit, passive custody, crosswalk, historical accounting/operator, and Registry regressions through a fresh Task 4 graph;
3. exact Task 4 verifier and hostile mutation fixtures;
4. preserved Task 1, Task 2, and Task 3 artifact roots under their own phases;
5. static analysis and independent security/specification review with every Critical and Important finding resolved;
6. measured compiler/size/storage/IR/opcode evidence rebuilt after any static-analysis clean.

The verifier advances to `[ValidateSet('Task1','Task2','Task3','Task4')]` and defaults to Task 4 only after GREEN. Required phase isolation is:

| Artifacts | Task1 | Task2 | Task3 | Task4 | Exact phase + RED switch |
|---|---:|---:|---:|---:|---:|
| Task 1 | 0 | 1 | 1 | 1 | 44 |
| Task 2 | 1 | 0 | 1 | 1 | 44 |
| Task 3 | 1 | 1 | 0 | 1 | 44 |
| Task 4 | 1 | 1 | 1 | 0 | 44 |

Cardinality exits remain: all six absent `42`; absent plus RED `0`; one through five artifact kinds `43`; malformed complete `1`; conforming complete plus RED `44` after full conformance. Every historical artifact-tree fingerprint must remain unchanged during verification.

## 12. Acceptance and non-claims

Task 4 is complete only when:

- this architecture freeze is independently approved;
- RED demonstrably fails against the Task 3 shell for the intended missing behavior, not fixture defects;
- GREEN implements only this BudgetBook node and exact Factory commitment changes;
- every focused, regression, invariant, mutation, phase, compiler, size, storage, IR/opcode, and static-analysis gate passes;
- independent final reviewers report no unresolved Critical or Important finding;
- truth-surface documents cite exact commits and measured results.

Passing Task 4 proves only immutable pre-vote authorization evidence in a dormant fresh constellation. It is not production approval, third-party audit, deployment, funding, activation, ballot finality, purchase authorization, token approval, execution readiness, recovery readiness, or completion of acquisition Tasks 5–9 or the broader grill interview.
