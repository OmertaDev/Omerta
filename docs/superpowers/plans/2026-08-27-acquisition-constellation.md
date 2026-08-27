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

Every child runtime must be at most 24,576 bytes and every child initcode at
most 49,152 bytes. All child mutators remain dormant until one atomic factory
finalization succeeds. The Task 5 monolith is retired from the deploy graph after
its behavior is cross-walked and reproduced.

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
| deposit, refund, repair, balance sync | pause-independent |
| proposal expiry, direct/relayed cancellation | pause-independent |
| reconciliation evidence and final disposition | pause-independent |
| unpause | Safe-only, bounded readiness snapshot |

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
committed hash. Front-running the exact bytes is harmless; altered bytes revert.

Child constructors store immutables only, make zero peer calls, and remain
dormant. After all five exist, one atomic finalization verifies exact addresses,
code hashes, topology, immutable manifest bindings, and logical zero state, then
activates all children. Any verification or activation failure rolls back the
entire activation. A wrong or incomplete already-created constellation stays
inert. After finalization, the factory has no configuration, economic, role,
redeployment, or recovery power.

Forced ETH cannot block deployment or finalization. Core begins with stored
buckets, sequence, and records equal to zero while `V == F`; its first sync maps
all `F -> U`. Forced balances at noncustodial children are inert and permanently
unrecoverable.

Peer authenticity uses exact addresses, the finalized factory manifest/codehash,
and audited nonproxy/nondelegating source. It does not recursively embed every
peer runtime hash. Registry, circuit-breaker/health, oracle, adapter, and token
dependencies are code-hash checked at each use.

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
revert data is not bubbled. Balance deltas are authoritative and adapter-reported
amounts are never trusted.

| Adapter observation | Required result |
|---|---|
| `call == false` | attempt consumed; exact failure evidence; no fabricated fill |
| positive token delta | delta is the fill authority; reconcile native delta/result metadata |
| zero token delta and native unchanged | failed/no-fill outcome |
| zero token delta and native spent | unexplained state enters reconciliation |
| positive token delta and malformed result | token delta preserved as evidence; malformed result incident |
| downstream journal/leaf failure after observation | the outer transaction may revert atomically, reverting the adapter call and all of its effects |

Once the adapter `CALL` is issued, false, malformed, zero-delta, and unexplained
results are journaled. An unexplained or otherwise failed post-observation enters
Reconciliation and can never be converted into success by adapter returndata.

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

Every repair source is precommitted and single-use to one exact open attempt or
refund identity; callers cannot select arbitrary liability. Repair restores `P`
only up to `L-P`, using generic oldest-first ordering. Residual value is classified:

- active refund -> `R`;
- terminal fully-accounted refund -> `A`;
- unmatched value -> `U`;
- canonical deposit -> live `D` first, then `A`.

`D` and `S` may coexist and are reported independently. The full canonical value,
not merely its `A` credit, consumes every applicable cap. Any failure rolls back
value, records, caps, sequence, evidence, and peer state.

## 6. IDs, signatures, and evidence

The Intent ID remains exactly:

```solidity
keccak256(abi.encode(chainId, core, ballotId, assetVersionKey))
```

Task 5 Deposit and accounting V1 IDs remain Core-scoped with `address(this)`.
Every new V2 ID is literally:

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
no packed encoding is permitted. The EIP-712 verifying contract is Authority.
Every payload binds Authority, Core, target module, action, generation, shared
nonce, deadline, and all action fields. Tests cover cross-chain, cross-Core,
cross-module, and cross-action replay.

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
| execute | Intent attempt-consumed -> Core pre-call mutation -> adapter call -> Intent observation -> Core delta mutation/components -> Reconciliation case if required -> Intent terminal/attempt result |
| disposition/repair | Reconciliation phase/cause -> Core mutation/components -> Reconciliation leaf evidence -> Reconciliation final evidence |
| O2 | Authority shared-nonce evidence -> Core mutation -> Core `F,A,U,R,P` components -> affected Intent/Reconciliation leaves -> Core transfer evidence; destination call is last and emits no trusted protocol evidence |

An omitted zero-value accounting component emits nothing; remaining component
indexes are contiguous. A failure at any point reverts every earlier event.
Static Authority reads never emit events.

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
   forced ETH, token drift, replay domains, artifact census, runtime/initcode bounds,
   gas/journal proofs, and 0/1/32/67 traces.
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
