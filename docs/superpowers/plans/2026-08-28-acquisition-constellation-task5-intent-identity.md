# Acquisition Constellation Task 5 — Intent and Attempt Identity Freeze

**Date:** 2026-08-28

**Status:** architecture freeze approved at `7781e0f2`; RED gate frozen at
`af85eaed`; GREEN implementation completed at `db5555f4`; exact
verifier/crosswalk closure completed at `fb64148d`. Independent final security
and specification reviews are C0/I0/M0. The fresh Task 5 constellation remains
dormant, undeployed, unfunded, and unactivated; Tasks 6–9, final A1/A3/R
acceptance, and production approval remain pending.

**Inputs:** the binding grill-completion specification; the approved acquisition
constellation architecture; the Task 0 ownership/collision crosswalk; the Task 3
Stock Token amendment; the implemented Task 4 BudgetBook freeze; the current
Factory, Authority, Core, BudgetBook, IntentExecution shell, Reconciliation
shell, and Registry V2 contracts; Registry V2 ballot tests; and the historical
23,212-byte monolith as a behavioral absence oracle.

### Verified Task 5 closure evidence

- Architecture freeze: `7781e0f2`; RED gate: `af85eaed`; GREEN production
  source: `db5555f4`; verifier/crosswalk closure: `fb64148d`.
- `AcquisitionIntentExecution.sol` SHA-256:
  `2B9547CAA35B20AD61D080E3E4BED4EC1051A58C0FD810805A3399111AA7FA98`;
  type-only `IAcquisitionIntentExecutionV2.sol` SHA-256:
  `16960C5452A6B15433E9C59272F504015E819CCC16CDFA913538A1ADB875AC0A`.
- The Intent artifact is exactly `1380/847/533` bytes for
  initcode/runtime/constructor prefix, has one `bool` storage row at slot zero,
  three semantic immutables, and zero runtime external-call or
  `RETURNDATACOPY` operations.
- Focused Task 5 verification is 18/18 passing. The artifact-backed crosswalk is
  63/63 passing. The compiled census is exactly `87/168/29/6/290`; the unique
  descriptor census is `87/167/29`, with
  `ReentrancyGuardReentrantCall()` as the sole intentional duplicate.
- The exact five-by-five historical phase matrix has zero on every diagonal and
  one on every off-diagonal. The conforming Task 5 RED invocation exits `44`;
  the earlier same-phase RED exits remain their recorded Task 1–4 closure
  evidence. Every historical and current artifact-tree fingerprint remained
  byte-for-byte unchanged during verification.
- Cardinality exits are exact: all six deployable artifacts absent `42`, absent
  plus RED `0`, partial sets one through five `43` in either mode, malformed
  complete `1` in either mode, and conforming complete Task 5 `0` or `44` under
  the RED switch.
- Verifier SHA-256:
  `B432BD8A05CC441ECE16F0184811E6D3EF28138C7FB7453FA259E0A12C88350F`;
  crosswalk SHA-256:
  `509BDAEEBACC79C4912D6E038BD08434A08B3F88A7BDF31F4EA168044B3FC01A`;
  frozen RED harness SHA-256:
  `BAD8C29B393B258267B1C5D5A85B1002ADF07496CE67A9CFB5ED4E6A7D7F2A69`.
- Independent final verifier security and specification reviews are C0/I0/M0
  after hostile
  interface, CBOR, PUSH/opcode, optimized-IR, memory-writer, assignment,
  control-flow, descriptor-partition, and phase-isolation mutations.

These are Task 5 development-closure facts only. They do not prove deployment,
funding, activation, ballot finality, health clearance, purchase authorization,
adapter or oracle approval, token accounting, final A1/A3/R acceptance,
third-party audit, or production readiness.

## 0. Decision and dependency boundary

Task 5 is a fresh pre-production constellation. It deploys a new Factory and
five new children in the unchanged order Authority, Core, BudgetBook,
IntentExecution, Reconciliation at Factory CREATE nonces 1 through 5. It reuses
no Task 4 address, manifest, deployment commitment, mutable state, record,
nonce, finalization, or authority observation.

Only `AcquisitionIntentExecution` advances from its Task 4 topology shell.
Authority, Core, BudgetBook, and Reconciliation retain their Task 4 behavior.
Task 5 freezes exactly:

1. the deterministic intent ID formula;
2. the deterministic V2 attempt ID formula;
3. the fixed-width input schemas used by those formulas;
4. a type-only future immutable-intent commitment schema containing only fields
   already required by the controlling documents; and
5. the Intent child’s minimal reciprocal Core topology.

Task 5 creates no intent or attempt instance. It adds no intent mapping, attempt
mapping, reservation, attempt counter, consumption bit, tombstone, cancellation,
expiry, outcome, phase, result journal, reconciliation case, incident, Core
accounting mutation, native transfer, Stock Token observation, Stock Token
aggregate, adapter invocation, oracle read, Registry read, BudgetBook read,
Authority read, or health-overlay read.

This boundary is controlling. The master specification requires a deterministic
intent and eventual oracle/adapter/route commitments, but also requires every
pre-adapter failure to consume no intent ID, sequence, reservation, or tombstone
([grill completion lines 507–540](../specs/2026-08-26-grill-completion.md#L507)).
The constellation assigns rich intent metadata to Intent but all funds and
Stock Token custody/accounting authority to Core
([constellation lines 86–116](2026-08-27-acquisition-constellation.md#L86)).
The Task 3 amendment expressly limits Task 5 to identity and dormant interfaces
and moves the first attempt consumption, adapter call, authoritative balance
observation, accounting mutation, and reconciliation path to Task 6
([Task 3 lines 772–784](2026-08-27-acquisition-constellation-task3-core.md#L772)).
The implementation graph repeats that split
([constellation lines 629–654](2026-08-27-acquisition-constellation.md#L629)).

The historical monolith has no Intent-owned business row. Task 0 says literally
that no historical Task 5 function moves to Factory, BudgetBook, Intent, or
Reconciliation
([Task 0 lines 24–46](2026-08-27-acquisition-constellation-task0-crosswalk.md#L24)).
It is an absence and O1/A1 behavior oracle, not a source of an Intent ABI or
storage layout.

## 1. Resolved identity rulings

### 1.1 `ballotId` means `ballotDay`

The master prose calls the third intent-ID field `ballotId`, while Registry V2
and BudgetBook expose one canonical onchain ballot identity: `uint256
ballotDay`. Registry publishes, resolves, and stores ballots by day
([Registry interface lines 31–40 and 105–140](../../../omerta-contracts/src/interfaces/IStockTokenRegistryV2.sol#L31));
BudgetBook authorizes and retrieves immutable evidence by the same day
([Task 4 lines 40–74](2026-08-27-acquisition-constellation-task4-budget-book.md#L40)).

Task 5 therefore freezes the master field concretely as `uint256 ballotDay`.
There is no opaque `bytes32 ballotId`, no independent ballot-ID hash family, and
no server-nominated identifier. The exact intent formula becomes:

```solidity
keccak256(abi.encode(uint256(4663), core, ballotDay, assetVersionKey))
```

This is a tracked type-resolution amendment to the prose name, not a new ID
family or an alteration of the four-field identity.

### 1.2 `authorityGeneration` means `operatorGeneration`

The V2 catalog uses the generic prose name `authorityGeneration` for an attempt.
Authority has no state item with that literal name. Its exact snapshot exposes
`operatorGeneration` at word 14 and ingress generations at words 17 and 18
([Authority lines 191–253](../../../omerta-contracts/src/AcquisitionAuthority.sol#L191)).

Task 5 resolves the attempt field to the exact authenticated
`operatorGeneration` value. The Solidity parameter and future record member are
named `operatorGeneration`. The immutable intent separately carries
`ingressGeneration`; the two generation domains never substitute for each
other.

Task 5’s derivation helper accepts a caller-supplied full-width
`operatorGeneration` only as hash input. It does not read Authority and does not
claim that the supplied value is current. Task 6 must authenticate word 14 before
creating or consuming any attempt.

### 1.3 Exact attempt tag

The symbolic catalog tag is frozen to:

```solidity
bytes32 private constant _ATTEMPT_TAG =
    keccak256("OMERTA_ACQUISITION_INTENT_ATTEMPT_V2");
```

Its literal value is:

```text
0x8aa693df3b136274e99739abc62a2c7aabc541180430aaba0fc4cb6267383c27
```

The intent ID remains deliberately untagged because the controlling document
already freezes its exact four-field preimage
([constellation lines 524–530](2026-08-27-acquisition-constellation.md#L524)).

No other Task 5 ID family is authorized. Oracle and route hashes are supporting
commitments, not independent protocol IDs.

## 2. Exact Task 5 production ABI

### 2.1 Type schemas

Task 5 adds a type-only `IAcquisitionIntentExecutionV2` source with these exact
types and member names:

```solidity
interface IAcquisitionIntentExecutionV2 {
    struct IntentIdentityInput {
        uint256 ballotDay;
        bytes32 assetVersionKey;
    }

    struct AttemptIdentityInput {
        uint256 operatorGeneration;
        uint256 attemptIndex;
        bytes32 intentId;
        address adapter;
        bytes32 runtimeCodeHash;
        bytes32 routeHash;
    }

    struct ImmutableIntentCommitment {
        bytes32 intentId;
        bytes32 budgetId;
        uint256 ballotDay;
        bytes32 assetVersionKey;
        address token;
        uint8 tokenDecimals;
        uint256 maxEthWei;
        uint64 purchaseUntil;
        uint256 ingressGeneration;
        bytes32 oracleCommitment;
        uint256 minimumOutput;
        address adapter;
        bytes32 adapterRuntimeCodeHash;
        bytes32 routeHash;
    }
}
```

`ImmutableIntentCommitment` is type-only in Task 5. It is not accepted by a
runtime function and is not stored. Its fields are limited to existing
requirements:

- `budgetId`, `ballotDay`, `maxEthWei`, and `purchaseUntil` preserve the future
  immutable join with Task 4 BudgetBook evidence;
- `assetVersionKey`, `token`, and `tokenDecimals` preserve the exact Registry V2
  ballot asset and the unit domain for `minimumOutput`; Registry V2 already
  snapshots all three
  ([Registry interface lines 31–40](../../../omerta-contracts/src/interfaces/IStockTokenRegistryV2.sol#L31));
- `ingressGeneration` is explicitly required by the Task 3 amendment;
- `oracleCommitment`, `minimumOutput`, `adapter`,
  `adapterRuntimeCodeHash`, and `routeHash` are explicitly required by A3
  ([grill completion lines 517–537](../specs/2026-08-26-grill-completion.md#L517)); and
- `intentId` records the exact derived identity.

The schema intentionally omits created/updated timestamps, details hashes,
status, phase, next attempt, consumption, result, observed balances, fills,
liability, backing, shortfall, reconciliation, stock sequence, incident,
enumeration, cancellation, and expiry evidence. Those are not Task 5 state.

### 2.2 Existing topology functions retained exactly

```solidity
function intentExecutionTopology()
    external
    view
    returns (address factory, bytes32 manifestHash, bool finalized);

function finalizeIntentExecution(bytes32 manifestHash) external;
```

### 2.3 New view-only identity functions

```solidity
function deriveIntentId(uint256 ballotDay, bytes32 assetVersionKey)
    external
    view
    returns (bytes32 intentId);

function deriveAttemptId(
    uint256 operatorGeneration,
    uint256 attemptIndex,
    bytes32 intentId,
    address adapter,
    bytes32 runtimeCodeHash,
    bytes32 routeHash
) external view returns (bytes32 attemptId);
```

The exact canonical descriptors/selectors are:

| Descriptor | Selector |
|---|---|
| `deriveIntentId(uint256,bytes32)` | `0x6fd37d8c` |
| `deriveAttemptId(uint256,uint256,bytes32,address,bytes32,bytes32)` | `0x14ddcae0` |

Both functions are ungated views. They are available before and after
finalization, never write state, never emit, never call a peer, and validate no
business authority. They hash every possible bit pattern, including zero and
maximum-width values. A returned hash means only “this is the deterministic ID
for these bytes under this child’s immutable Core/module domain.”

There is no runtime function accepting `ImmutableIntentCommitment`. There is no
`createIntent`, `getIntent`, `execute`, `consume`, `cancel`, `expire`,
`recordResult`, or `getAttempt` function. A guaranteed-revert business stub is
also forbidden because it would create a dead selector without implementing an
authorized lifecycle.

### 2.4 Exact events

The sole Intent event remains:

```solidity
event IntentExecutionFinalized(bytes32 indexed manifestHash);
```

No intent-, attempt-, adapter-, oracle-, route-, or result-related event exists
in Task 5.

### 2.5 Closed error set

Existing topology errors remain exact:

```solidity
error IntentExecutionFactoryZero();
error IntentExecutionManifestHashZero();
error IntentExecutionFinalizerUnauthorized(address caller);
error IntentExecutionManifestHashMismatch(bytes32 expected, bytes32 actual);
error IntentExecutionAlreadyFinalized();
```

Task 5 adds exactly:

```solidity
error IntentExecutionZeroAddress();
error IntentExecutionContractRequired(address account);
error IntentExecutionAddressMismatch(address expected, address actual);
error IntentExecutionPeerMismatch(uint8 peer, address expected, address actual);
```

Their selectors are:

| Descriptor | Selector |
|---|---|
| `IntentExecutionZeroAddress()` | `0xdf2b1023` |
| `IntentExecutionContractRequired(address)` | `0xe861d66a` |
| `IntentExecutionAddressMismatch(address,address)` | `0x9022e30f` |
| `IntentExecutionPeerMismatch(uint8,address,address)` | `0xb3910689` |

No not-finalized, invalid-identity, unauthorized, paused, adapter, oracle,
Registry, token, attempt, result, reconciliation, or accounting error is added.
The identity views do not pretend to validate those domains.

### 2.6 Exact census target

Task 4’s compiled `85/164/29/6/284` becomes:

| Artifact | Functions | Errors | Events | Constructors | ABI entries |
|---|---:|---:|---:|---:|---:|
| Factory | 4 | 35 | 2 | 1 | 42 |
| Authority | 50 | 54 | 18 | 1 | 123 |
| Core | 23 | 36 | 5 | 1 | 65 |
| BudgetBook | 4 | 29 | 2 | 1 | 36 |
| IntentExecution | 4 | 9 | 1 | 1 | 15 |
| Reconciliation shell | 2 | 5 | 1 | 1 | 9 |
| **Total** | **87** | **168** | **29** | **6** | **290** |

The compiled set has 167 unique semantic error descriptors.
`ReentrancyGuardReentrantCall()` remains the sole intentional compiled duplicate,
shared by Authority and Core. The unique collision universes are exactly 87
callable function selectors, 167 semantic error selectors, and 29 event
signatures/topics. Constructors remain six and are checked separately.

Task 0’s historical 67/55/21/1 census remains unchanged. The two functions and
four errors above are tracked Task 5 `NEW_V2` ownership, not historical `MOVE`,
`INHERITED`, `TOPOLOGY`, or BudgetBook `FUTURE_RESERVED` rows. The active
future-reserved list was already empty after Task 4
([crosswalk lines 1199–1223](../../../omerta-contracts/test/AcquisitionConstellationCrosswalk.t.sol#L1199)).

## 3. Constructor, immutables, and fresh deployment topology

The exact constructor is:

```solidity
constructor(
    address factory,
    bytes32 manifestHash,
    address core
)
```

It stores exactly three private immutables and one mutable Boolean:

```solidity
address private immutable _factory;
bytes32 private immutable _manifestHash;
address private immutable _core;
bool private _finalized;
```

It stores no Authority, Registry, BudgetBook, or Reconciliation immutable.
Those would be dead dependencies in a node that makes no business call. The
manifest already commits the complete ordered constellation, while the identity
formulas require only Core and Intent module identity. Task 6 may add its exact
used peers in another fresh constellation after its call graph is frozen.

Constructor precedence is exact:

1. zero Factory -> `IntentExecutionFactoryZero()`;
2. zero manifest -> `IntentExecutionManifestHashZero()`;
3. zero Core -> `IntentExecutionZeroAddress()`;
4. `address(this)` differs from the Factory nonce-4 prediction ->
   `IntentExecutionAddressMismatch(expected, actual)`;
5. supplied Core differs from the Factory nonce-2 prediction ->
   `IntentExecutionPeerMismatch(1, expected, supplied)`;
6. the exact predicted Core has no code ->
   `IntentExecutionContractRequired(core)`;
7. store the three immutables and leave `_finalized == false`.

The peer ordinal is the zero-based child index: Core is index 1. Factory CREATE
order remains Authority/1, Core/2, BudgetBook/3, Intent/4,
Reconciliation/5. Core already binds the predicted Intent address in its
constructor and snapshot
([Core lines 162–199](../../../omerta-contracts/src/AcquisitionVaultCore.sol#L162)
and [Core lines 350–397](../../../omerta-contracts/src/AcquisitionVaultCore.sol#L350));
this constructor supplies the minimal reciprocal check.

The constructor is nonpayable and makes no `CALL`, `STATICCALL`,
`DELEGATECALL`, `CALLCODE`, `CREATE`, or `CREATE2`. The sole external-code
observation is `core.code.length` after exact address validation. It uses no
timestamp, block number, coinbase, base fee, gas price, prevrandao, balance, or
caller authority. Forced ETH and arbitrary ERC-20 balances at the predicted
Intent address are ignored, inert, unaccounted, and unrecoverable.

The Task 3 configuration root can remain unchanged because Task 5 introduces no
external configuration value. Task 5 still requires a fresh known Factory
address/nonce and freshly derived children, manifest, child initcode hashes,
child runtime hashes, and deployment commitment. The changed Intent constructor
and runtime make every Task 4 deployment artifact invalid under the Task 5 phase,
even when another production source is text-identical.

## 4. Exact identity derivations and literal vectors

### 4.1 Intent ID

Production derives:

```solidity
intentId = keccak256(
    abi.encode(
        uint256(4663),
        address(_core),
        ballotDay,
        assetVersionKey
    )
);
```

There is no tag. The formula must not use `block.chainid`, caller-supplied chain,
Factory, Intent, Registry, BudgetBook, Authority, `msg.sender`, `tx.origin`,
`abi.encodePacked`, or an opaque ballot hash.

Literal vector I1:

```text
core = 0x1111111111111111111111111111111111111111
ballotDay = 20702
assetVersionKey =
  0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

abi.encode result =
  0x0000000000000000000000000000000000000000000000000000000000001237
    0000000000000000000000001111111111111111111111111111111111111111
    00000000000000000000000000000000000000000000000000000000000050de
    aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa

intentId =
  0x7fb4270f2e2a3d72d11ea1439252f0034a349eedb2a3fd1d1e6f5099a43f7274
```

The test suite must independently reproduce this vector without calling the
production helper, then compare the production result.

### 4.2 Attempt ID

Production derives:

```solidity
attemptId = keccak256(
    abi.encode(
        _ATTEMPT_TAG,
        uint256(4663),
        address(_core),
        address(this),
        operatorGeneration,
        attemptIndex,
        intentId,
        adapter,
        runtimeCodeHash,
        routeHash
    )
);
```

This is the exact attempt row of the closed V2 catalog, with
`authorityGeneration` resolved to `operatorGeneration`
([constellation lines 568–590](2026-08-27-acquisition-constellation.md#L568)).
It uses `abi.encode`, never packed encoding.

Literal vector A1:

```text
tag =
  0x8aa693df3b136274e99739abc62a2c7aabc541180430aaba0fc4cb6267383c27
core = 0x1111111111111111111111111111111111111111
intentModule = 0x4444444444444444444444444444444444444444
operatorGeneration = 7
attemptIndex = 3
intentId =
  0x7fb4270f2e2a3d72d11ea1439252f0034a349eedb2a3fd1d1e6f5099a43f7274
adapter = 0x7777777777777777777777777777777777777777
runtimeCodeHash =
  0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
routeHash =
  0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc

attemptId =
  0x77e64ac10210ac43ddc3c3fc400cd50c6780aa3a3acfbe6c2d1c9124f2b9088a
```

The production child for this vector must be deployed at the literal
`intentModule` address or a test harness must reproduce the formula with that
address as an explicit independent oracle. A derived wrapper at another address
must not falsely claim the literal A1 output.

### 4.3 Dimension-separation vectors

The RED/GREEN suite must build independent vectors changing one field at a time:

- I1 chain, Core, day, and asset version;
- A1 tag, chain, Core, Intent module, operator generation, attempt index, intent
  ID, adapter, runtime hash, and route hash.

Every one-field mutation must change its ID. Tests must also reject formula
mutations that reorder adjacent fields, replace `abi.encode` with packed
encoding, duplicate a field, omit a field, use `ingressGeneration` in the
operator-generation position, or use Factory/Registry/BudgetBook where Core or
Intent belongs.

## 5. Finalization and exact storage

`finalizeIntentExecution` preserves the shell’s exact precedence:

1. caller must equal immutable Factory;
2. supplied manifest must equal immutable manifest;
3. `_finalized` must be false;
4. set `_finalized = true`;
5. emit `IntentExecutionFinalized(_manifestHash)`.

It returns zero bytes and makes no peer call. Factory finalizes in the existing
fixed order BudgetBook -> Reconciliation -> Intent -> Core -> Authority
([Factory lines 225–251](../../../omerta-contracts/src/AcquisitionConstellationFactory.sol#L225));
therefore Intent finalization must not require Core or Authority to report
finalized state.

Exact mutable storage has one top-level row:

| Label | Slot | Offset | Type |
|---|---:|---:|---|
| `_finalized` | 0 | 0 | `bool` |

There is no namespaced or ordinary reentrancy guard, mapping, array, counter,
phase, record, status, tombstone, index, nonce, reservation, outcome, balance,
or peer-state cache. The type-only structs allocate no storage.

The two identity views are deliberately not finalization-gated. They must return
the same IDs before and after finalization, after forced ETH or token transfers,
and after any Authority, Registry, BudgetBook, or Core state change.

## 6. Call, value, and opcode posture

Intent creation code permits `EXTCODESIZE` only for the exact Core code check.
Intent runtime has zero outbound external calls. Its only behaviors are fixed
calldata decoding, immutable reads, `ADDRESS`, memory writes, `KECCAK256`, the
one Factory-authorized finalizer `SSTORE`, and the finalization log.

Production Intent runtime must contain no reachable:

- `CALL`, `STATICCALL`, `DELEGATECALL`, or `CALLCODE`;
- `CREATE`, `CREATE2`, or `SELFDESTRUCT`;
- `RETURNDATACOPY` or peer revert-data bubbling;
- dynamic arbitrary selector forwarding;
- Registry, Authority, BudgetBook, Core business, Reconciliation, health,
  oracle, adapter, or ERC-20 selector;
- token `balanceOf`, `transfer`, `transferFrom`, `approve`, or permit;
- native balance observation or value transfer;
- receive, fallback, proxy, upgrade, sweep, recovery, or generic execute path;
- payable constructor or payable function.

Factory’s existing inbound topology `STATICCALL` and finalizer `CALL` remain the
only call graph edges involving Intent. Factory selector routing is already
literal
([Factory lines 469–482](../../../omerta-contracts/src/AcquisitionConstellationFactory.sol#L469)).
Task 5 adds no callsite-manifest row.

No `ReentrancyGuard` is allowed. There is no business mutation and no outbound
call to reenter. Adding a guard would create an unnecessary storage root and a
pre-validation `SSTORE` without protecting any authorized interaction.

## 7. RED, GREEN, and mutation graph

The focused RED file is
`omerta-contracts/test/AcquisitionConstellationTask5IntentIdentity.t.sol`.
It compiles against the current Task 4 shell through a test-local interface and
must fail only because the new constructor/identity surface is absent. Production
source is not changed until RED is independently reviewed.

Minimum RED/GREEN coverage is:

1. exact ABI kinds, names, component names, order, mutability, constructor, four
   functions, nine errors, one event, and no hidden surface;
2. exact selectors `0x6fd37d8c` and `0x14ddcae0`;
3. exact four new error selectors;
4. exact Task 5 census `87/168/29/6/290` and unique universe
   `87/167/29`;
5. exactly two functions and four errors transition into tracked Intent
   `NEW_V2` ownership, with no historical monolith row moved;
6. exact three-argument constructor and exactly three semantic immutables;
7. every constructor branch and all adjacent compound-invalid precedence edges;
8. self nonce-4 and Core nonce-2 prediction mutations;
9. Core missing-code branch after address identity;
10. constructor call inventory zero and sole exact `EXTCODESIZE` target;
11. forced ETH and arbitrary known/unknown/hostile ERC-20 prefunding do not block
    construction/finalization and remain inert;
12. finalizer caller/hash/already precedence, zero return, one state write, one
    exact event, and no peer call;
13. identity views are callable before/after finalization and do not read the
    finalized flag;
14. exact I1 and A1 literal vectors;
15. all intent and attempt dimension-separation mutations;
16. zero and maximum-width scalar inputs hash deterministically without a
    business-validation claim;
17. fixed chain `4663`; reject live `block.chainid` or caller-supplied chain
    mutations;
18. exact Core and Intent domains; reject Factory, Registry, BudgetBook,
    Authority, caller, and origin substitutions;
19. exact tag and untagged intent formula;
20. `abi.encode` only; reject packed, reordered, duplicated, and omitted fields;
21. `operatorGeneration` naming/domain; reject ingress-generation substitution;
22. each call leaves all Intent storage, peer state, peer balances, and logs
    unchanged;
23. identity results remain stable across role, pause, ingress, Registry ballot,
    BudgetBook, Core accounting, forced-balance, and time changes;
24. exact single-row storage graph and rejection of every extra root/member;
25. no ReentrancyGuard, role mirror, accounting mirror, business mapping, counter,
    phase, or status;
26. ABI absence and runtime rejection for creation, get, execution, consumption,
    result, cancel, expiry, reservation, reconciliation, recovery, token, and
    generic-execute selectors;
27. no events other than finalization;
28. no payable function, receive, fallback, proxy, upgrade, delegatecall,
    callcode, create, create2, selfdestruct, transfer, approval, or sweep;
29. exact creation/runtime opcode inventories and PUSH-aware scanning;
30. exact source/source-set hashes, compiler profile, ABI fingerprint, semantic
    immutable map, immutable reference locations, storage graph, init/runtime
    sizes, creation/runtime suffix split, and optimized-IR formula shape;
31. same-type immutable swap mutations and constructor/ABI parameter-name
    mutations;
32. source/compiler/profile/metadata/storage/size/formula/opcode/hidden-surface
    verifier mutations;
33. real fresh Factory/Authority/Core/BudgetBook/Intent/Reconciliation lifecycle;
34. Task 4 initcode/runtime/manifest/deployment artifacts rejected by Task 5;
35. unchanged Task 4 BudgetBook, Task 3 Core/Authority, historical accounting and
    operator, crosswalk, and Registry V2 regressions;
36. fuzz/property coverage over every identity field and pairwise compound
    mutations; and
37. stateful invariant: any sequence of identity calls, forced transfers,
    finalization attempts, role changes, and peer changes leaves Task 5 with only
    one possible mutable transition, `_finalized: false -> true`, and never moves
    or classifies value.

Hostile fixtures remain bounded and deterministic: raw CREATE dispatcher;
predicted-address Factory harness; code-bearing Core oracle; forced-ETH sender;
hostile ERC-20; unknown-selector caller; and independent pure identity oracle.
No fixture may supply a fake business success path.

The inherited Task 4 artifact-backed crosswalk baseline is exactly 57/57
passing. Task 5 must preserve those 57 tests unchanged in result and report the
new Task 5-focused and aggregate crosswalk counts measured after RED/GREEN; this
freeze does not invent either future count.

GREEN changes only:

- `omerta-contracts/src/interfaces/IAcquisitionIntentExecutionV2.sol`;
- `omerta-contracts/src/AcquisitionIntentExecution.sol`;
- `omerta-contracts/foundry.toml`, solely to add the exact
  `src/interfaces/IAcquisitionIntentExecutionV2.sol` restriction under the
  existing `constellation-via-ir` profile; no compiler version, optimizer,
  EVM-version, existing restriction, or other profile field may change;
- exact source-based lifecycle fixtures that must encode the new Intent
  constructor; and
- the Task 5 crosswalk/verifier/test artifacts required to prove this freeze.

Factory, Authority, Core, BudgetBook, and Reconciliation production behavior is
unchanged. Any need to add a business call or state row returns to architecture
review rather than widening Task 5.

## 8. Verifier and historical phase matrix

The verifier advances to:

```powershell
[ValidateSet('Task1','Task2','Task3','Task4','Task5')]
```

It defaults to Task 5 only after GREEN and independent closure. Required phase
isolation is:

| Artifacts | Task1 | Task2 | Task3 | Task4 | Task5 | Complete + RED |
|---|---:|---:|---:|---:|---:|---:|
| Task 1 | 0 | 1 | 1 | 1 | 1 | 44 |
| Task 2 | 1 | 0 | 1 | 1 | 1 | 44 |
| Task 3 | 1 | 1 | 0 | 1 | 1 | 44 |
| Task 4 | 1 | 1 | 1 | 0 | 1 | 44 |
| Task 5 | 1 | 1 | 1 | 1 | 0 | 44 |

Cardinality semantics remain exact:

- all six artifacts absent: default `42`, RED switch `0`;
- one through five artifact kinds: `43` in either mode;
- six malformed/nonconforming artifacts: `1` in either mode;
- six conforming artifacts: own phase `0`, wrong phase `1`, RED switch `44` only
  after complete conformance.

Task 5 conformance must freeze measured, not estimated:

- six-deployable source set and each source Keccak;
- type-only interface source and schema member graph;
- ABI parameter/output names and selectors;
- all descriptor collision universes;
- storage layout and primitive encodings;
- semantic immutable identities and exact references;
- creation/runtime bytecode, metadata suffix, initcode and runtime sizes;
- compiler `0.8.26`, optimizer enabled with 800 runs, via-IR, Cancun;
- exactly eight phase-selected constellation compilation restrictions in Task 5,
  with the seven Task 4 paths unchanged and the sole new path
  `src/interfaces/IAcquisitionIntentExecutionV2.sol`; wrong count, wrong path,
  duplicate path, or any default-profile compilation of that interface rejects;
- PUSH-aware creation/runtime opcode inventories;
- optimized-IR identity formulas, fixed tag, fixed chain, Core and module domains;
- absence of runtime external calls and `RETURNDATACOPY`; and
- absence of hidden payable, fallback, proxy, business, token, and recovery
  surfaces.

Verifier negative fixtures must independently mutate ABI names, scalar order,
tag bytes, chain constant, Core/module domains, `abi.encode` form, source hash,
source set, compiler settings, same-type immutable identity, immutable reference,
constructor parameter, storage root/type/offset, function/event/error census,
init/runtime size, suffix split, executable identity, opcode inventory, and hidden
surface. Text-only substring checks are not acceptance evidence.

Every Task 1–4 historical artifact-tree fingerprint remains byte-for-byte
unchanged during phase verification. Task 5 uses its own isolated build and cache
roots. Static analysis is rebuilt after any tool cleans artifacts, followed by
the exact verifier and smallest relevant native suites.

## 9. Task 6 dependency blockers and non-authority claims

The following are deliberately unresolved in Task 5 and categorically block the
first stateful intent/attempt implementation. They do not block the two local
identity views because those views create no authority.

### 9.1 Finalized CB/BudgetBook/Registry join

Task 5 resolves identity to `ballotDay`, but it does not prove that the day has a
BudgetBook record or a finalized, eligible Registry winner. Registry V2 tests
prove that the immutable ballot snapshot cannot redirect and same-key
reactivation cannot revive it
([Registry tests lines 505–606](../../../omerta-contracts/test/StockTokenRegistryV2.t.sol#L505)).
Task 6 still needs the exact finalized CB consumer, emitter/checkpoint authority,
and atomic join among `ballotDay`, `budgetId`, asset version, token, decimals,
activation generation, maximum ETH, and purchase deadline.

### 9.2 Oracle semantics

The master requires at least one independently governed Safe-approved source
that is not the venue/router/pool, maximum five-minute age, exact
source/asset/direction/decimals/quote/round/evidence binding, median
normalization when multiple sources are valid, and deviation capped at 500 bps
([grill completion lines 531–537](../specs/2026-08-26-grill-completion.md#L531)).

Task 5 freezes only a `bytes32 oracleCommitment` field in a type-only future
schema. It does not define a source registry, observation count/bound, encoding,
median/rounding rule, quote direction, freshness call, code-hash/proxy policy, or
deviation calculation. Task 6 must freeze and test all of them before storing an
intent.

### 9.3 Adapter and route semantics

Task 5 freezes adapter address, runtime-code-hash, and route-hash fields only. It
does not approve an adapter, observe code, define the adapter selector, set a gas
cap or journal reserve, define permitted returndata, parse route data, or set an
exact maximum route length. The historical `RwaStockBuyer` adapter selector
([RwaStockBuyer lines 17–30](../../../omerta-contracts/src/RwaStockBuyer.sol#L17))
is evidence, not automatic constellation authority.

Task 6 must freeze the exact fixed selector, Core recipient, fixed value/token,
route byte limit and `routeHash = keccak256(routeData)` rule, code identity,
gas/returndata/revert policy, and post-call journal reserve before any adapter
call. The atomic outcome table remains controlling
([constellation lines 448–476](2026-08-27-acquisition-constellation.md#L448)).

### 9.4 Attempt-index lifecycle

Task 5 hashes a supplied `attemptIndex`; it does not decide zero- versus one-based
first attempt, retry eligibility after consumed no-fill, maximum attempts,
overflow behavior, or terminal-state interaction. Task 6 must freeze those
rules, mappings, phase transitions, and exact error precedence before introducing
a counter or record.

### 9.5 Health, pause, exposure, and accounting walls

Task 5 makes no health, Authority, Core, Registry, or BudgetBook call. It cannot
create an intent because the finalized health overlay/clearance seam, current
pause/operator/ingress proof, exposure policy, available/reservation accounting,
and complete pre-adapter walls do not yet exist in one typed atomic path. Task 6
must consume those exact dependencies; a local or server-supplied Boolean is not
authority.

### 9.6 Stock Token and reconciliation policy

Task 5 performs no token balance query and has no token storage. Physical tokens
sent to Core remain inert, unaccounted custody as frozen by Task 3. Task 6 must
first freeze the complete `NativeAndStockObserved` event, token balance-call
gas/returndata policy, token runtime identity, Stock Token aggregate structs,
stock sequence, fill/unattributed/negative-drift classification, Reconciliation
case protocol, and exact atomic ordering
([Task 3 lines 778–784](2026-08-27-acquisition-constellation-task3-core.md#L778)).

No Task 5 function may be described as validating a ballot, budget, oracle,
adapter, route, ingress, operator generation, health status, token, execution, or
purchase. It derives identities only.

### 9.7 Complete intent lifecycle ownership

Task 6 owns the complete stateful A3 intent lifecycle together with the R path;
none of it is split into Task 5 or deferred to Task 7. Before Task 6 adds any
stateful selector, its architecture freeze must define and RED-test all of the
following as one typed, atomic graph:

- intent creation only after every finalized ballot/BudgetBook/Registry, health,
  pause, operator, ingress, oracle, adapter, route, exposure, and accounting wall
  passes; Core reservation and the immutable Intent record happen atomically,
  while every precondition failure consumes no ID, sequence, reservation, or
  tombstone;
- exactly one terminal tombstone per deterministic intent identity, with no
  revival, rollover, catch-up, replacement, or second reservation;
- Safe and current-operator direct cancellation, plus current-operator relayed
  cancellation through Authority’s separate `cancelNonce` domain, exact
  `INTENT_CANCELLATION_V2` preimage, one-hour typed authorization, replay and
  generation checks, and atomic Core reservation release;
- deterministic permissionless expiry only after the immutable purchase
  deadline, with the same atomic release and terminality guarantees;
- permissionless attempt execution with no executor reward or discretion, while
  preserving the Section 9.4 attempt-index rules and Sections 9.2–9.6 execution,
  observation, accounting, and reconciliation walls;
- exact `CREATING`, `CANCELING`, and `EXECUTING` phase ownership, typed leaf
  callers, rollback semantics, and the frozen create/cancel/expiry/execute emitter
  ordering from the constellation architecture.

This is a tracked ownership resolution of the earlier implementation-graph row
that placed “cancellation nonce” beside Task 7 O2 integration. Task 7 owns only
direct/relayed O2 authority, the shared O2 nonce, exact 0/1/32/67 component
integration, ordering, and batch rejection. Because every required A3 lifecycle
surface is now assigned to Task 6, Task 6 may claim completion of A3+R only after
all bullets above and the other Section 9 blockers are implemented and
independently closed.

## 10. Acceptance and closure truth

Task 5 is complete only when:

- this exact architecture freeze is independently reviewed with no unresolved
  Critical or Important finding;
- RED fails against the Task 4 shell for the intended missing surface and no
  fixture defect;
- GREEN implements only the constructor/topology/identity boundary above;
- the type-only schema contains no invented authority or lifecycle state;
- focused, fuzz, invariant, regression, crosswalk, compiler, size, storage,
  immutable, IR/opcode, call-absence, mutation, phase, and static-analysis gates
  all pass;
- independent final security and specification reviews resolve every Critical
  and Important finding;
- measured source, artifact, selector, size, storage, and executable identities
  are recorded against exact stable commits; and
- truth-surface documents continue to state that the constellation is dormant,
  undeployed, unfunded, unactivated, and not final A1/A3/R or production
  approval.

Task 5 completion does not mean an intent can be created, reserved, cancelled,
expired, executed, consumed, reconciled, delivered, or funded. It does not mean
an adapter, oracle, health overlay, CB consumer, or Stock Token policy is
configured or approved. It authorizes no deployment, Safe transaction, funding,
token movement, native transfer, role change, backend route, worker, or
production activation.

There is no remaining internal contradiction inside this narrowed Task 5
boundary after resolving `ballotId` to `ballotDay`, resolving
`authorityGeneration` to `operatorGeneration`, and freezing the exact attempt
tag. The unresolved semantics in section 9 are intentionally Task 6 blockers;
pulling any of them into Task 5 would contradict the controlling stock-token and
atomic-execution split.
