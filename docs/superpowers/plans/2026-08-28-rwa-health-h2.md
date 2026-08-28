# RWA Health H2 — Safe Clearance Overlay and Finalized Consumer Freeze

**Date:** 2026-08-28
**Status:** architecture frozen after independent security and specification preflight
accepted with P0=0/P1=0; RED, implementation, deployment, configuration, Safe
execution, finality, and production cutover remain pending
**Parent authority:**
`docs/superpowers/specs/2026-08-26-grill-completion.md` section H,
`docs/superpowers/plans/2026-08-26-grill-completion-umbrella.md`,
`docs/superpowers/plans/2026-08-28-rwa-health-h1.md` section 11, and
`docs/superpowers/plans/2026-08-26-finalized-observation-kernel.md`
**Consumes:** development-closed dormant H1, the approved domain-neutral FO kernel,
the immutable Registry V2 ABI, and CN-6A's read-only finalized Registry lifecycle/
activation-generation seam
**Produces:** H2 only: an additive Safe-owned overlay, reviewer clearance
attestations and exact unsigned packages, an independent finalized overlay consumer,
and atomic H1 clearance application. It produces no ballot, acquisition, delivery,
signer, deployment, funds movement, or cutover authority.

## 1. Scope and authority boundary

H2 adds the only mechanism that can unlatch one exact H1 episode generation. The
mechanism is deliberately additive: `StockTokenRegistryV2` remains byte-for-byte ABI
frozen, while a separate immutable `RwaHealthOverlay` accepts one exact seven-day
Safe action and emits canonical clearance evidence. A transaction hash, receipt,
database flag, provider response, reviewer click, or unfinalized event never clears
H1.

The authority chain is:

```text
configured reviewer
  -> immutable clearance attestation + exact unsigned Safe package
Safe-owned RwaHealthOverlay
  -> canonical ClearanceApplied event
independent FO H2 consumer
  -> raw+decoded immutable inbox + ordered overlay reducer
  -> exact H1 generation/head recheck and atomic clearance_applied fact
new H1 evaluation strictly after finalized apply
  -> terminal healthy or successor adverse episode
```

Each arrow removes authority; none adds it. The reviewer cannot execute the package,
the Safe cannot invent a server episode head, the overlay cannot mutate the Registry,
FO cannot decide policy, and the H2 consumer cannot turn a pre-clearance evaluation
green.

H2 remains dormant until all of these external values/facts are separately supplied
and approved: deployed overlay address and inclusive start block, Safe owner,
finalized Registry lifecycle/activation generation from CN-6A, RPC, Safe execution,
and canonical finality. This plan must not add a production signer, private key,
transaction sender, funded address, worker schedule, or enabled feature selector.

## 2. Closed identity model

All hashes use `keccak256(abi.encode(...))`, not packed encoding. Every tag is
`keccak256(bytes(<literal>))`. Chain ID is exactly `4663`; addresses are canonical
nonzero EVM addresses; byte strings are exact nonzero `bytes32`; integers remain
canonical unsigned decimal/BigInt off-chain and their declared Solidity widths
on-chain.

One semantic clearance payload contains exactly:

```text
chainId = 4663
registryAddress
overlayAddress
catalogSnapshotHash
assetVersionKey
activationGeneration
episodeId
episodeGeneration
currentSeverity          // 1=health_unknown, 2=operational_quarantine
stateSequence
latestEpisodeEventId
latestMaterialEvidenceHash
recoveryEvidenceHash
freshHealthyEvaluationId
freshHealthyEvidenceHash
reviewerIdHash
approvedAt
clearanceDeadline
expectedOverlayGeneration
```

`clearanceDeadline` must equal `approvedAt + 604800` exactly without uint64
overflow. On-chain inclusion must satisfy
`approvedAt <= block.timestamp < clearanceDeadline`. Finalized database apply must
also begin its locked comparison at a database time strictly before
`clearanceDeadline`; mining never waives this recheck. Exact replay of an already
committed finalized clearance remains readable/idempotent after the deadline. Every
not-yet-applied package becomes stale at the exact deadline.

`clearancePayloadHash` is:

```text
keccak256(abi.encode(
  keccak256("OMERTA_RWA_HEALTH_CLEARANCE_PAYLOAD_V2"),
  <the exact ordered semantic payload above>
))
```

The application-defined exact Safe call intent is the closed tuple:

```text
chainId
safeAddress
to = overlayAddress
value = 0
operation = CALL (0)
selector = IRwaHealthOverlay.recordClearance.selector
calldataHash = keccak256(abi.encodeWithSelector(selector, complete Clearance tuple))
```

`safeCallIntentHash` is the ABI hash of that tuple under tag
`OMERTA_RWA_HEALTH_SAFE_CALL_INTENT_V2`. This is the exact commitment to OMERTÀ's
unsigned Safe call intent, not a Safe service transaction hash or executed Safe
transaction hash. The callable takes no caller-supplied payload hash, call-intent
hash, attestation ID, or clearance ID. The builder and contract both derive those
values from the same complete tuple and exact `recordClearance` calldata. This
removes every recursive/self-referential hash slot while fixing chain, Safe, target,
value, operation, selector, and calldata. The unsigned operator package may record an
`expectedSafeNonce` as nonauthoritative metadata, but the overlay-only event stream
cannot prove the outer Safe execution nonce. That metadata is not a Clearance field,
identity input, event field, or finalized H2 authority.

The canonical `clearanceId` is:

```text
keccak256(abi.encode(
  keccak256("OMERTA_RWA_HEALTH_CLEARANCE_ATTESTATION_V2"),
  chainId, registryAddress, catalogSnapshotHash, assetVersionKey,
  activationGeneration, episodeId, episodeGeneration, currentSeverity,
  stateSequence, latestEpisodeEventId, latestMaterialEvidenceHash,
  recoveryEvidenceHash, freshHealthyEvaluationId, freshHealthyEvidenceHash,
  reviewerIdHash, approvedAt, clearanceDeadline, expectedOverlayGeneration,
  safeCallIntentHash
))
```

No second attestation identifier exists. The canonical name in Solidity events/
getters, H1 columns, finalized tables, and APIs is `clearanceId`; “attestation”
describes the private reviewer row's role only.

`reviewerIdHash` is exactly
`keccak256(abi.encode(keccak256("OMERTA_RWA_HEALTH_REVIEWER_V2"),
keccak256(bytes(reviewerId))))`. `recoveryEvidenceHash` is exactly
`keccak256(recoveryEvidenceBytes)`. The exact configured reviewer identifier remains private server identity; only its
domain-separated `reviewerIdHash` enters the public package/event. The database binds
the hash back to the authenticated reviewer row.

## 3. `RwaHealthOverlay` contract

### 3.1 Files and immutable authority

- Add `omerta-contracts/src/interfaces/IRwaHealthOverlay.sol`.
- Add `omerta-contracts/src/RwaHealthOverlay.sol`.
- Add focused Foundry unit, fuzz, and invariant tests.

The contract uses Solidity `0.8.26` with no ownership framework. Constructor inputs
are the immutable nonzero Safe and immutable nonzero Registry V2 address; both must
have code. Construction requires `block.chainid == 4663` and Registry
`supportedChainId() == 4663`. Safe rotation requires a separately reviewed new
overlay deployment and consumer-identity migration. There is no proxy, initializer, delegatecall,
arbitrary execution, signer, token/ETH receiver, sweep, pause, publisher, reviewer,
ownership transfer, renounce, or mutable configuration.

### 3.2 Public surface

The closed public surface is:

```solidity
struct Clearance {
  bytes32 catalogSnapshotHash;
  bytes32 assetVersionKey;
  uint256 activationGeneration;
  bytes32 episodeId;
  uint256 episodeGeneration;
  uint8 currentSeverity;
  uint64 stateSequence;
  bytes32 latestEpisodeEventId;
  bytes32 latestMaterialEvidenceHash;
  bytes32 recoveryEvidenceHash;
  bytes32 freshHealthyEvaluationId;
  bytes32 freshHealthyEvidenceHash;
  bytes32 reviewerIdHash;
  uint64 approvedAt;
  uint64 clearanceDeadline;
  uint256 expectedOverlayGeneration;
}

uint256 public constant supportedChainId = 4663;
address public immutable SAFE;
IStockTokenRegistryV2 public immutable REGISTRY;
mapping(bytes32 assetVersionKey => uint256 generation) public clearanceGeneration;
mapping(bytes32 assetVersionKey => bytes32 clearanceId) public latestClearanceId;
mapping(bytes32 clearanceId => bool used) public usedClearanceId;

function clearancePayloadHash(Clearance calldata value) external view returns (bytes32);
function safeCallIntentHash(Clearance calldata value) external view returns (bytes32);
function clearanceId(Clearance calldata value) external view returns (bytes32);
function recordClearance(Clearance calldata value) external returns (bytes32 clearanceId);
```

Chain ID, Safe, Registry, and overlay address are derived from the live chain and
immutable contract fields. They are hash-domain inputs but are not redundant caller-
supplied struct fields. `activationGeneration`, `episodeGeneration`, and
`expectedOverlayGeneration` must be positive. `stateSequence` must be in
`1..2^63-1`. Every bytes32 field must be nonzero, `currentSeverity` is exactly 1 or
2, and no other ABI field exists. One frozen cross-language vector fixes the literal
struct order/types plus payload, calldata, call-intent, reviewer, recovery, and
clearance IDs.

The hash functions are pure except for immutable Safe/Registry/overlay inputs in the
domains. `recordClearance` requires `msg.sender == SAFE` and performs checks before
its first write:

1. correct live chain and exact immutable Registry;
2. nonzero identities/evidence, positive generations, signed-BIGINT state-sequence
   bound, and valid closed severity;
3. exact seven-day TTL and half-open inclusion window;
4. `expectedOverlayGeneration == clearanceGeneration[key] + 1`;
5. Registry `activationGeneration(key) == activationGeneration`, `getVersion(key)`
   reports the version active on chain `4663`, and all three Registry reverse heads
   (ticker, token, provider ID) point exactly to that key;
6. the derived clearance ID has never been used.

Only then does it set `usedClearanceId[clearanceId]`, advance the per-asset generation, and
emit exactly one event:

```solidity
event ClearanceApplied(
  bytes32 indexed clearanceId,
  bytes32 indexed assetVersionKey,
  uint256 indexed overlayGeneration,
  address registryAddress,
  uint256 activationGeneration,
  bytes32 catalogSnapshotHash,
  bytes32 episodeId,
  uint256 episodeGeneration,
  uint8 currentSeverity,
  uint64 stateSequence,
  bytes32 latestEpisodeEventId,
  bytes32 latestMaterialEvidenceHash,
  bytes32 recoveryEvidenceHash,
  bytes32 freshHealthyEvaluationId,
  bytes32 freshHealthyEvidenceHash,
  bytes32 reviewerIdHash,
  bytes32 clearancePayloadHash,
  bytes32 safeCallIntentHash,
  uint64 approvedAt,
  uint64 clearanceDeadline
);
```

The event and its indexed identity are the only canonical H2 input. The contract
does not assert that recovery is true; it proves only that the Safe applied the exact
reviewer-prepared package before expiry against the current Registry activation
generation.

### 3.3 Contract rejection matrix

Foundry RED/GREEN must cover wrong caller, chain, Registry/code/Registry chain,
zero/crossed/malformed fields, invalid severity, TTL +/-1, approval in the future,
execution at deadline, uint64 overflow, stale/current/future overlay generation,
same clearance replay, same payload under another Registry/overlay/chain/Safe,
wrong active version or any broken reverse head, changed/deactivated/reactivated
Registry generation, exact call-intent derivation, and state/event atomicity on every revert.
Fuzzing covers all integer boundaries and single-field mutation. A stateful invariant
proves per-asset generation increases exactly by one per successful event, used
clearance IDs never become reusable, and no non-Safe call changes storage.

## 4. Reviewer attestation and unsigned package

### 4.1 Distinct reviewer action

H1 adverse reviewer actions are not reused. H2 adds one authenticated action that
may only be performed by the single configured RWA reviewer:

```text
POST /v1/rwa/health/:assetVersionKey/clearance-attestations
```

The exact body is one ordinary JSON object whose prototype is exactly
`Object.prototype`, with these twelve own
properties in this canonical order:

```js
{
  recoveryEvidenceBase64url: '<canonical unpadded base64url, decoding to 1..65,536 bytes>',
  expectedCatalogSnapshotHash: '<canonical nonzero bytes32>',
  expectedEpisodeGeneration: '<canonical positive uint256 decimal>',
  expectedCurrentSeverity: '<exact string "1" or "2">',
  expectedStateSequence: '<canonical decimal in 1..2^63-1>',
  expectedEpisodeEventId: '<canonical nonzero bytes32>',
  expectedMaterialEvidenceHash: '<canonical nonzero bytes32>',
  expectedEvaluationId: '<canonical nonzero bytes32>',
  expectedEvaluationEvidenceHash: '<canonical nonzero bytes32>',
  expectedActivationGeneration: '<canonical positive uint256 decimal>',
  expectedOverlayGeneration: '<canonical positive uint256 decimal>',
  expectedSafeNonce: null | '<canonical uint256 decimal, including 0>'
}
```

The nonce property is always present; `null` means omitted from operator metadata. A
non-null nonce is never chain authority, a clearance identity field, or evidence of
executed Safe state. All values are JSON primitives. Unknown, missing, reordered,
inherited, accessor, `undefined`, coercible, noncanonical, wrong-type, zero where the
field is positive, or overflow fields fail before a database query. Input is copied to
a closed null-prototype value and deeply frozen; later caller mutation cannot change
the operation. The route uses the existing reviewer authentication and durable
reviewer idempotency perimeter, but a distinct method/path/body binding.

Inside one caller-owned transaction the action locks in this order:

```text
Task-5 Registry mirror share lock
H1 singleton/current/episode rows
CN-6A `requireFinalizedRwaActivationV2` seam, which locks its lifecycle singleton,
  checkpoint, runtime, current row, then activation-instance row
H2 `requireRwaHealthOverlayReadyV2` seam, which locks its singleton/checkpoint and
  holds runtime `FOR SHARE` through caller commit, then attestation/package rows
```

It calls the unchanged reviewed
`requireFreshRwaHealth(..., purpose='quarantine_clearance_broadcast')` with the whole
H1 head. H2 does not add fields to that frozen H1 request or receipt. A separate
client-owned `readRwaHealthClearanceContext(client, h1Receipt)` helper, called under
the already-held Registry/H1 locks, accepts only the exact frozen H1 receipt and
returns this exact deeply frozen null-prototype private context in field order:

```js
{
  currentSeverity: '<exact string "1" or "2">',
  evaluationId: '<canonical nonzero bytes32>',
  evaluationEvidenceHash: '<canonical nonzero bytes32>',
  evaluationBatchId: '<canonical nonzero bytes32>',
  evaluationPageId: '<canonical nonzero bytes32>',
  evaluationObservedAt: '<UTC ISO timestamp>',
  evaluationAppliedAt: '<UTC ISO timestamp>',
  providerEndpointHash: '<canonical nonzero bytes32>',
  providerCommitment: '<canonical nonzero bytes32>',
  providerSourceState: 'observed',
  providerByteCount: '<canonical decimal in 0..2,000,000>',
  providerCapturedAt: '<UTC ISO timestamp>',
  providerRetainUntil: '<UTC ISO timestamp>',
  providerBodyBase64url: '<canonical unpadded base64url of the exact raw body bytes>'
}
```

It validates the exact own-key/type/prototype contract of the H1 receipt and never
connects, begins, commits, releases, retries, performs RPC, or mutates. It returns no
client, Buffer, query capability, URL, or mutable view. Input/output mutation attempts,
accessors, inherited keys, wrong order, crossed evaluation/batch/page identity, and
noncanonical time/base64url/decimal values reject or leave the frozen result unchanged.
The builder reads the healthy
evaluation's private provider-body preimage by exact batch/evaluation identity,
recomputes the provider commitment and H1 evidence hash, and rejects absence,
cross-batch substitution, altered length/bytes/hash, source-failure evidence, or
post-storage corruption. Raw bytes never enter a public response or Safe calldata.

The CN-6A dependency is the exact lock-owning finalized-activation reader frozen in
CN-6A. The caller cannot supply or override activation generation; the body carries
only an expectation used for compare-and-set. After the already-held Task-5/H1 prefix,
the helper internally reads the protected Task-5 head, locks CN-6A's singleton,
checkpoint, runtime, current row, and activation row, and returns only its frozen receipt. H2 never directly
reads CN-6A checkpoint/runtime/lock-control/inbox/event-result/incident rows. CN-6A
must be caught up, unhalted, readiness-fresh, same-head reconciled, and exact for this
Registry activation instance. The overlay's own Registry check independently prevents
a stale package from executing on chain.

The action derives whole-second `approvedAt` from post-lock database time, exact
deadline, payload/package/attestation IDs, exact ABI calldata, and one JSON-safe
unsigned Safe transaction. Attestation and package insert atomically. An exact
semantic retry returns the existing object; any conflict under the same semantic
identity or HTTP key fails closed.

Recovery evidence is private exact-byte evidence. The route accepts one canonical
base64url string decoding to 1..65,536 bytes, computes `recoveryEvidenceHash` itself,
and stores bytes, byte count, hash, capture time, and a minimum 35-day retention
boundary in a private H2 table. Noncanonical base64url, empty/oversized data, altered
bytes/count/hash, and cross-attestation substitution reject. Only the reviewer/package
builder and finalized H2 matcher may read it, every read recomputes byte count/hash,
and no bytes enter logs, receipts, public APIs, calldata, or events.

### 4.2 Durable states

Add immutable/durable tables for:

- `rwa_health_clearance_attestations_v2` — complete bound H1/CN-6A/reviewer head,
  payload/package/attestation hashes and TTL;
- `rwa_health_clearance_recovery_evidence_v2` — private exact bytes/count/hash with
  restrictive retention and composite attestation ownership;
- `rwa_health_clearance_safe_proposals_v2` — exact `{to,value,operation,data}`,
  calldata hash, Safe address, optional nonauthoritative expected Safe nonce metadata,
  separately named provisional Safe service transaction hash, separately named
  finalized chain execution transaction hash, and status;
- `rwa_health_clearance_private_reads_v2` only if a new reference is required to
  prevent provider bytes expiring; prefer an FK/reference from the attestation to the
  existing evaluation/batch and make the existing retention worker treat any
  unexpired package or open episode reference as nondeletable.

Package status is closed:

```text
safe_package_ready -> safe_submitted | finalized_applied | finalized_rejected | approval_stale
safe_submitted -> finalized_applied | finalized_rejected | approval_stale
approval_stale -> finalized_rejected
```

`approval_stale` can never transition to `finalized_applied`. If an event was included
but the deadline passes before H2's locked database apply, the later canonical event
is retained with `expired` (or another applicable stale disposition), the package
moves idempotently to `finalized_rejected`, H1 remains unchanged, global readiness
remains open, and the H2 checkpoint advances.

The only submission mutation is reviewer-authenticated:

```text
POST /v1/rwa/health/:assetVersionKey/clearance-attestations/:clearanceId/submission
body = { safeTransactionHash: '<canonical nonzero bytes32>' }
```

The body is a plain JSON object with exactly that one own property; unknown, inherited,
accessor, missing, wrong-type, noncanonical, or zero values reject before database
access. It rechecks coherent current H1 and CN-6A authority plus the half-open deadline, binds
one canonical provisional Safe service transaction hash, is idempotent for the same
hash, and conflicts for any replacement. The server first prepares the current H1
evaluation/sequence/head expectation. Inside the transaction it calls the unchanged
H1 clearance seam against that current healthy evaluation, reads the exact current
private context, and proves the complete healthy-only sequence from the package's
stored baseline through that current evaluation. A later healthy sweep before
submission is therefore accepted only by the same proof used at finality; an unknown/
adverse/material/catalog/head mutation marks the package `approval_stale` and records
no submission hash. The action does not rewrite the stored clearance payload. It does
not accept or record mining/execution claims. The canonical finalized
`ClearanceApplied` event is the sole execution
evidence and may transition a ready or submitted package directly to
`finalized_applied` or `finalized_rejected`, while storing its distinct chain
`execution_tx_hash`. A Safe service transaction hash need not equal the chain
execution transaction hash. Either hash alone is evidence only: neither changes H1
nor skips finality. No route signs, broadcasts, retries, replaces, estimates, or
records execution. The package response is explicitly unsigned.

Before package creation and before the submission-record action, H2 calls
the H1 clearance seam with the complete bound head. Mutation after review, before
signing, before broadcast, after broadcast, after mining, or immediately before
finalized apply outside the exact permitted later-healthy-only sequence cannot silently
update the package; it makes that exact package stale or makes the canonical event
nonauthorizing. A healthy-only sequence before or after submission remains permitted,
and a canonical exact event may transition directly from `safe_package_ready` without
a recorded submission.

The bound healthy evaluation is immutable baseline recovery evidence, but routine
later healthy sweeps do not make the Safe ceremony impossible. At finalized apply,
H2 permits a later latest evaluation only when every applied evaluation after the
baseline is healthy on the same catalog snapshot, the episode ID/generation/severity,
latest episode-event head, latest material-event/evidence head remain exact, and
`current.state_sequence = attestedStateSequence + count(later healthy evaluations)`.
Any later unknown/adverse evaluation, reviewer/material event, catalog change,
clearance event, unexplained sequence delta, or head mutation stales the package. H2
never pauses the watcher or suppresses observations, and a new evaluation strictly
after finalized apply remains mandatory for green.

## 5. Independent finalized overlay consumer

### 5.1 Entry point and configuration

The sole coordinator is:

```js
syncFinalizedRwaHealthOverlay(pool)
```

It uses the approved `observeFinalized` and `commitFinalizedObservation` kernel. It
owns exact chain `4663`, one configured immutable overlay address, its inclusive
deployment block, only the exact `ClearanceApplied` topic, and code-owned ceilings:

```text
consumer key               rwa_health_overlay_v2
max block span             10,000
max logs                    2,000
max committed bytes     2,000,000
max touched assets            256
max matched attestations       256
```

RPC, raw-log normalization, event-block hash/timestamp evidence, pinned getters, and
all decoding/structural validation finish before `BEGIN`. The pinned overlay getters
verify `supportedChainId`, immutable Registry, and owner/Safe identity at the exact
bounded target. There is no generic `watcher.js`, `chain_cursor`, duplicate finality
loop, page fallback, unbounded scan, or shared consumer cursor.

### 5.2 Consumer-owned schema

H2 owns only:

- `rwa_health_overlay_lock_v2`;
- `rwa_health_overlay_checkpoint_v2`, permanently binding consumer key, chain,
  overlay, start block, last applied block/hash and observation hash;
- `rwa_health_overlay_inbox_v2`, immutable raw log plus exact decoded fields and
  matching event-block timestamp;
- `rwa_health_overlay_asset_state_v2`, the ordered on-chain generation projection;
- `rwa_health_overlay_event_results_v2`, one immutable closed disposition for every
  canonical overlay event;
- `rwa_health_finalized_clearances_v2`, immutable applied-only exact H1/attestation/
  inbox provenance;
- `rwa_health_overlay_runtime_v2`, exact identity plus `sync_in_progress`, `attempt_id`,
  `last_attempt_at`, `last_success_at`, `ready_verified_at`, `caught_up`, `halted`, a
  closed failure code, unresolved authority-incident count, and last incident;
- `rwa_health_overlay_attempts_v2`, one durable started/succeeded/failed/superseded
  record per opaque attempt ID, including start/end database time and closed result;
- one persistent incident/drift row for canonical but nonauthorizing events.

The nullable runtime/attempt failure code is closed to
`h2_rpc_failed`, `h2_decode_failed`, `h2_fo_failed`, `h2_dependency_lag`,
`h2_reorg_halt`, `h2_dependency_mismatch`, `h2_checkpoint_halt`,
`h2_generation_halt`, `h2_inbox_halt`, `h2_structure_halt`, or
`h2_attempt_superseded`. No transport message or attacker value is stored in that
field.

It may not write or advance any `stock_catalog_getter_*` or CN-6A table, and may not
read their checkpoint, inbox, event-result, incident, lock-control, or arbitrary
lifecycle tables. Its only approved dependency seams are Task 5's exact H1 catalog
share-lock/readiness snapshot and CN-6A's exact reviewed
`readFinalizedRwaLifecycleHeadV2`, `compareFinalizedRwaActivationV2`, and
`requireFinalizedRwaActivationV2` helpers. Package creation/submission uses the strict
authoring helper; the finalized consumer uses one key-independent head receipt plus
non-strict per-event comparisons. It may not read legacy `chain_cursor` or any
gameplay/acquisition cursor. Those consumers cannot write H2 clearance facts.

Every normal H-gated action keeps the frozen `requireFreshRwaHealth` H1 receipt and
adds a separate exact H2 clearance/readiness check under the already established lock
order; H2 does not extend the H1 receipt. Readiness requires exact configured
chain/overlay/Registry/start identity, `sync_in_progress=false`, `caught_up=true`,
`halted=false`, no unresolved authority incident, and database time
`now <= ready_verified_at + 600 seconds` (the equality boundary is ready). Every
readiness helper holds the H2 runtime row `FOR SHARE` through the caller-owned
transaction's final authorized mutation. Missing
configuration, stale readiness, partial bounded catch-up, an active attempt, a deep
checkpoint disagreement, structural halt, or unresolved authority incident blocks
ballot publication, purchase broadcast, and delivery start even if an earlier H1
episode became terminal/green.
The clearance-package purpose also requires a ready H2 projection so its expected
next overlay generation is authoritative. H2 never auto-rewinds or deletes a formerly
applied fact; the readiness wall closes dependent authority until a separately
reviewed recovery/rebuild restores a trustworthy cursor.

The only downstream readiness seam is:

```js
requireRwaHealthOverlayReadyV2(client, {
  expectedH2BlockNumber,
  expectedH2BlockHash,
  expectedReadyVerifiedAt
})
```

`client` is caller-owned and already holds any Task-5/H1 and, when the operation needs
activation authority, CN-6A prefix locks. The helper never connects, starts/ends a
transaction, retries, or performs RPC. It validates an ordinary null-prototype request
with exactly those three ordered own properties: canonical uint256 decimal block
number, canonical nonzero bytes32 block hash, and exact UTC ISO readiness timestamp.
They are compare-and-set expectations only. The helper acquires the H2 singleton and
checkpoint, then holds the H2 runtime row `FOR SHARE` through caller commit, applies every
readiness predicate and freshness boundary above using database time, and returns this
exact deeply frozen null-prototype receipt:

```js
{
  ok: true,
  consumerKey: 'rwa_health_overlay_v2',
  chainId: '4663',
  registryAddress: '<canonical lowercase address>',
  overlayAddress: '<canonical lowercase address>',
  startBlockNumber: '<canonical uint256 decimal>',
  appliedBlockNumber: '<canonical uint256 decimal>',
  appliedBlockHash: '<canonical nonzero bytes32>',
  observationHash: '<canonical nonzero bytes32>',
  finalizedHorizonBlockNumber: '<canonical uint256 decimal>',
  finalizedHorizonBlockHash: '<canonical nonzero bytes32>',
  caughtUp: true,
  halted: false,
  readyVerifiedAt: '<UTC ISO timestamp>',
  freshThrough: '<UTC ISO timestamp exactly readyVerifiedAt + 600 seconds>'
}
```

Stable precedence is input shape/canonicality -> immutable configuration/identity ->
active sync attempt or uninitialized/not-caught-up state -> durable halt -> unresolved
authority incident -> readiness expiry -> expected head/readiness CAS. Closed errors
are `h2_readiness_input`, `h2_unconfigured`, `h2_not_ready`, `h2_halted`,
`h2_authority_incident`, `h2_readiness_stale`, and `h2_readiness_changed`. Messages do
not reflect caller values. Unknown/inherited/accessor/wrong-order/wrong-type inputs,
each error combination/precedence, the exact freshness equality and first instant
after it, head/readiness races, and receipt mutation are mandatory RED.

Every sync attempt uses a two-phase runtime protocol so an RPC or pre-`BEGIN` failure
cannot leave readiness stale-true:

1. a short standalone compare-and-set transaction locks the H2 singleton, checkpoint,
   and runtime row `FOR UPDATE` in that order, writes a fresh opaque `attempt_id`,
   `sync_in_progress=true`, `last_attempt_at=clock_timestamp()`, clears
   `ready_verified_at`, and therefore makes readiness false;
2. only after that commit may the worker perform RPC, decoding, FO observation, and
   dependency preparation; no database lock is held across RPC;
3. the successful FO apply transaction locks the same three rows `FOR UPDATE`, rechecks
   the same current `attempt_id` only after those locks and before domain mutation,
   applies the batch, writes `last_success_at` and `ready_verified_at` from post-lock
   database time, sets `sync_in_progress=false`, and clears the closed failure code;
4. any RPC, decode, FO, reorg, dependency, generation, or structural failure is
   recorded by a second short transaction that locks those rows `FOR UPDATE` and
   compare-and-sets that same `attempt_id`, setting `sync_in_progress=false`, readiness false, and the stable
   closed failure/halt/incident state appropriate to the failure; an older worker may
   never overwrite a newer attempt.

The attempt lease is exactly 300 seconds by database time. While
`now < last_attempt_at + 300 seconds`, a second invocation returns `h2_sync_busy` and
does not replace the current attempt. At equality or later, one successor start
transaction may compare-and-set the prior attempt from `started` to `superseded`,
append a nonauthorizing operational takeover audit that never increments the unresolved-
authority count or sets a halt, install its own attempt ID, and proceed. Two simultaneous
successors race on that CAS and only one wins. A late old-attempt success or failure
finds a different current attempt ID and changes no runtime, inbox, domain, checkpoint,
or readiness state. Readiness stays false until the winning successor commits a
successful exact apply. RED kills a worker immediately after the attempt-start commit,
tests the instant before/equal/after lease boundary, two successors, and both old-result
arrival orders.

All H2 runtime transitions share this serialization point. Readiness/authority readers
hold the runtime row `FOR SHARE` through the caller's final authorized mutation and
commit; attempt start/takeover/success/failure and FO apply hold it `FOR UPDATE` after
the singleton and checkpoint. Consequently attempt start waits behind an authorization
that already observed readiness, authorization waits behind a start that closed it,
and takeover waits behind an old apply that already validated its attempt ID. RED
exercises readiness-versus-start, readiness-versus-takeover, takeover-versus-old-apply,
and takeover-versus-old-failure at statement and commit boundaries.

### 5.3 Ordering and atomic apply

Before `BEGIN`, every decoded event maps to exactly one committed FO `eventBlocks`
entry. Within `(blockNumber, transactionIndex, logIndex)`, each asset's on-chain
overlay generation must be previous+1 from the exact deployment stream. A gap,
duplicate with different bytes, conflicting replay, noncanonical decode, excessive
work, or checkpoint disagreement applies nothing.

`lockAndReadCheckpoint` acquires the complete order: Task-5 Registry mirror singleton
`FOR SHARE`; H1 singleton; touched H1 current/episode rows in ascending asset key;
then one `readFinalizedRwaLifecycleHeadV2` call, which locks the CN-6A lifecycle
singleton/checkpoint/runtime, followed by `compareFinalizedRwaActivationV2` for touched
keys in ascending order, which locks current/historical activation rows; H2 singleton;
H2 checkpoint; H2 runtime `FOR UPDATE`; then H2 attestation/package/asset rows in stable
identity order. The CN-6A helpers own only their named middle locks and return closed
receipts. A no-log/zero-touched range still obtains the key-independent head receipt.
H2 never
directly reads CN-6A control tables. CN-6A never locks H1/H2 and H1 never locks
CN-6A/H2, so this one-way dependency cannot cycle. This preserves H1's accepted lock
prefix even though the FO kernel invokes checkpoint acquisition before its domain
callback. Every H-gated action takes only its needed locks in this same relative order
so a concurrent H2 halt cannot race an authorization decision.

Before any inbox, event-result, asset, package, H1, or checkpoint mutation, the exact
Task-5 catalog seam and CN-6A head receipt must prove expected chain/Registry/start
identity, caught-up/unhalted/readiness-fresh state, identical applied block number/hash,
and a dependency head covering `observation.head.blockNumber`. A behind/stale/active-
attempt dependency returns retryable `h2_dependency_lag`, records only the attempt
failure, and creates no inbox/result/checkpoint or permanent drift. A Task-5-versus-
CN-6A identity, same-head, catalog, immutable identity, current active-state, or
reverse-head disagreement is structural and halts with no H2 checkpoint advance.

Only disagreement *between the two dependencies* is structural. Once Task 5 and
CN-6A are internally coherent, any difference between the canonical overlay event or
its local package and the coherent current catalog, active head, activation generation,
or H1 head is classified through `stale_h1_head` or `stale_registry_generation` and
advances the cursor. A later coherent Registry deactivation/reactivation is never by
itself a dependency-reconciliation failure.

For every canonical event, the adapter uses the non-strict CN-6A comparison receipt and:

1. inserts/verifies the raw+decoded inbox identity;
2. advances the independent on-chain overlay-generation projection;
3. looks up the exact local attestation/package and recomputes the payload hash,
   Safe call-intent hash, exact calldata, and clearance ID;
4. checks chain/Registry/overlay/asset/activation generation against the comparison,
   mapping a coherent old/inactive generation to `stale_registry_generation`, a
   missing observed instance to `activation_instance_missing`, and an unmatched
   observed instance to `activation_provenance_unmatched`, then checks exact
   seven-day TTL, event-block inclusion time, pre-deadline database apply, reviewer
   identity, Safe address/call intent, and event hashes;
5. rechecks the current H1 open episode generation, severity, latest event/material
   heads, bound baseline healthy evaluation/evidence, and the exact permitted
   sequence of only later healthy evaluations described above;
6. if every field matches, inserts one immutable finalized clearance, inserts one
   deterministic H1 `clearance_applied` episode event, populates the episode/current
   clearance fields, preserves severity/material head, advances latest event and
   `state_sequence`, and marks the package `finalized_applied`;
7. if the exact local package is terminally stale by `stale_h1_head`,
   `stale_registry_generation`, or `expired`, retains the canonical inbox, terminalizes
   only that package as `finalized_rejected`, records a closed nonauthorizing event
   result, advances this consumer, and leaves global readiness and H1 unchanged;
8. if authority cannot be bound because of `attestation_missing`, `package_mismatch`,
   `reviewer_mismatch`, `activation_instance_missing`, or
   `activation_provenance_unmatched`, retains the canonical inbox, records that exact
   closed event result, moves any existing matching package to `finalized_rejected`,
   raises a global unresolved authority incident that closes readiness, advances the
   checkpoint, and leaves H1 unchanged;
9. advances the H2 checkpoint in the same transaction whenever the disposition is
   canonical and nonstructural.

The finalized apply timestamp is post-lock database time. Event-block timestamp is
preserved separately as canonical inclusion time. The bound pre-clearance healthy
evaluation may be older than ten minutes by finality; it must remain the exact baseline
and every later evaluation must satisfy the healthy-only sequence proof above, but the
baseline need not remain latest. None of those evaluations makes the asset green. H1 becomes green only after
a later H1 evaluation has both `observed_at` and `applied_at` strictly greater than
the H2 finalized apply timestamp. An adverse later evaluation closes the old episode
as superseded and opens generation+1 as already frozen in H1.

`rwa_health_finalized_clearances_v2` has `clearance_id` as its primary key and exact
composite unique keys over `(clearance_id,registry_address,asset_version_key,
episode_id,episode_generation)`, the H1 bound head, activation/overlay generations,
attestation/inbox identity, and `disposition='applied'`. H2 adds composite FKs from
the H1 episode clearance tuple, the `h2_clearance` episode-event source tuple, and H1
current clearance tuple to that applied-only table. Nonauthorizing event results can
never satisfy those FKs. No generic update helper may populate the H1 clearance
columns.

Canonical nonauthorizing event dispositions are closed to `stale_h1_head`,
`stale_registry_generation`, `expired`, `attestation_missing`, `package_mismatch`,
`reviewer_mismatch`, `activation_instance_missing`, and
`activation_provenance_unmatched`. The first three are per-package terminal
dispositions and do not globally close readiness. The last five represent unexplained Safe authority and
raise a global unresolved authority incident until separately reviewed. Treating a
canonical stale package as a hard transaction failure would let one stale Safe call
poison the cursor. Conflicting bytes/decoded data for one FO inbox identity,
generation gaps/regressions, checkpoint disagreement, dependency reconciliation
failure, and structural malformation are durable hard halts with no checkpoint
advance. An incident cannot be cleared by a later successful poll; only the separately
reviewed recovery/rebuild path may clear it.

## 6. RED acceptance matrix

### 6.1 Contract RED

- constructor/authority/chain/Registry pinning;
- exact hash vectors shared between JavaScript and Solidity;
- seven-day and half-open inclusion boundaries;
- activation/reactivation and overlay generation replay walls;
- Safe/Registry/overlay/cross-chain/cross-asset/package substitution and proof that an
  optional expected Safe nonce never enters identity or finalized authority;
- fuzz/property/stateful invariants and ABI/runtime-size census.

### 6.2 Attestation/package RED

- exact twelve-property request, null-versus-nonce-zero rule, canonical base64url and
  all type/range/order/prototype/accessor/inherited/unknown/mutation failures;
- exact fourteen-property private-context receipt, crossed evaluation/batch/page/body
  evidence, deep-freeze/null-prototype guarantees, and input/output mutation attempts;
- absent/open/adverse-only/old healthy evaluation and the exact later-healthy-only
  sequence proof versus any adverse/material/head/catalog/sequence mutation;
- absent/corrupt/cross-batch private provider preimage;
- wrong reviewer and reviewer-action substitution;
- wrong Registry/asset/activation/episode/overlay generation;
- substituted recovery, material, episode-event, evaluation, or Safe evidence;
- exact TTL boundary, database-time precision, uint bounds and unknown fields;
- healthy sweep before submission and after submission, adverse/unknown sweep at both
  points, mutation outside the permitted sequence after review/sign/broadcast/mining/
  pre-finality, and direct `safe_package_ready -> finalized_applied`;
- `approval_stale -> finalized_rejected` on a later canonical event and proof that it
  can never become applied;
- semantic and HTTP replay/conflict/crash rollback;
- package never signs/sends and tx hashes never mutate H1.

### 6.3 Finalized-consumer RED

- independent literal consumer-key/chain/overlay/start/checkpoint/inbox and exact topic,
  including wrong/missing/changed key on bootstrap/restart;
- event timestamp committed by FO and timely inclusion despite later finalization;
- raw+decoded exact replay and conflicting inbox rejection;
- per-asset generation ordering across same block/batch/bounded catch-up;
- no-log range and zero-attestation behavior;
- crash rollback after inbox, reducer, H1 event, clearance fact, and checkpoint;
- competing workers and checkpoint CAS;
- dependency lag before all domain mutation; wrong Task-5/CN-6A identity, same-head,
  catalog snapshot, reverse-head, active-generation, caught-up, and halt state;
- sync-attempt start, RPC/pre-BEGIN/decode/FO/reorg/structural failure recording,
  process death after start, exact 300-second takeover boundary, two simultaneous
  successors, older-attempt success/failure CAS rejection, and no database lock held
  across RPC;
- runtime-row serialization for readiness versus start/takeover and takeover versus
  old apply/failure through both statement and commit boundaries;
- readiness freshness at `ready_verified_at + 600 seconds` exactly and one unit later;
- exact downstream readiness request/receipt, every stable error/precedence, expected-
  head/readiness races, and receipt mutation;
- reorg/checkpoint hash disagreement halt with no rewind/delete;
- stale H1/generation/expired canonical events terminalize only their package without
  global unreadiness; missing/mismatched/reviewer-unbound authority raises a global
  unresolved incident; both advance canonically and never mutate H1;
- a valid generation-N clearance consumed after coherent Registry reactivation to
  generation N+1 yields package-only `stale_registry_generation`, no H1/global
  incident, and checkpoint advance;
- coherent deactivation, missing historical activation, unmatched local activation,
  and no-log/zero-touched ranges through the CN-6A head/comparison seams, with exact
  `activation_instance_missing` and `activation_provenance_unmatched` dispositions;
- exact match applies one clearance idempotently and a new post-apply evaluation is
  still required for green;
- all five ceilings fail before partial apply;
- source searches prove no signer/private key/send/value/Registry mutation/ballot/
  acquisition/delivery/gameplay authority.

### 6.4 Real PostgreSQL and native verification

The real-PostgreSQL harness must prove waits in the exact Task-5 share -> H1 singleton/
rows -> CN-6A singleton/checkpoint/runtime/activation -> H2 singleton/checkpoint/
runtime/domain order,
repeatable snapshots, partial unique/FK/check behavior, competing consumer workers,
and rollback at every apply seam. Local absence of a configured database is recorded
as a skip, never as observed PostgreSQL evidence; CI must fail if its required URL is
missing.

Focused verification includes:

```powershell
node test/finalizedobservation.js
node test/rwahealth.js
node test/rwahealth.integration.js
node test/rwahealthoverlay.js
node test/rwahealthoverlay.integration.js
node test/rwahealthoverlay.postgres.js
forge test --match-path test/RwaHealthOverlay*.t.sol -vvv
node test/rwaroutes.js
node test/migrate.js
node test/gates.js
git diff --check
```

The final H2 review must independently report Critical/Important and P0/P1 counts,
close every such finding, and state separately what was implemented, reviewed,
configured, deployed, Safe-executed, finalized, funded, and active.

## 7. Dependency-ordered implementation tasks

1. Freeze this architecture after independent security/specification preflight.
2. Implement and independently close CN-6A's read-only finalized Registry lifecycle
   consumer/activation-generation projection; do not add publisher reachability.
3. Add contract/hash-vector RED and prove focused failure.
4. Implement `IRwaHealthOverlay`/`RwaHealthOverlay`; run Foundry review.
5. Add attestation/package/schema/route RED and prove focused failure.
6. Implement the reviewer action, private evidence verification, exact unsigned
   package, and dormant public/operator read surfaces.
7. Add finalized-consumer/schema/H1-FK/reducer RED and prove focused failure.
8. Implement the independent FO adapter, H2 readiness wall, and atomic H1 clearance application.
9. Add real-PostgreSQL, route/migration/gate, work-bound, and cross-language vector
   coverage.
10. Run independent security/specification review; fix every P0/P1.
11. Record truthful dormant closure in the umbrella. Do not configure, deploy, sign,
    broadcast, fund, claim finality, or enable cutover.

## 8. Completion boundary

H2 development closure means code, deterministic packages, migrations, focused and
integrated tests, dormant operational surfaces, and independent review exist. It does
not mean CN-6B, ballot publisher, AcquisitionVault provenance, purchase, delivery,
deployment, Safe execution, chain finality, production configuration, funding, or
activation is complete. Until CN-6A supplies finalized activation generations and the
H2 consumer is configured against a separately deployed overlay, package creation
and all dependent pipeline actions fail closed.
