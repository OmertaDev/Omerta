# RWA Registry Lifecycle CN-6A — Finalized Read-Only Consumer Freeze

**Date:** 2026-08-28
**Status:** development implemented, verified, and independently accepted with
P0=0/P1=0; dormant and intentionally unconfigured. Production RPC/Registry
configuration, scheduling, observed finality, deployment, publisher reachability,
and cutover remain pending.
**Parent authority:** master C/FO requirements, the umbrella CN-6A/H2/CN-6B split,
the finalized-observation kernel, the finalized event-time handoff, and Registry/
nomination/ballot Tasks 1–5
**Consumes:** approved dormant Registry V2 contract and Task-5 getter mirror, approved
FO kernel and `eventBlocks`
**Produces:** one read-only finalized Registry lifecycle consumer and exact activation-
generation projection required by H2. It produces no publisher, signer, transaction
broadcast, Safe action, ballot mutation, health clearance, funds, or cutover.

## 1. Split boundary

CN-6A owns canonical observation and reduction of the five Registry V2 event kinds.
CN-6B later owns the dormant exact-byte activation/ballot publisher and reuses CN-6A
facts. CN-6B may never create a second Registry event scanner, checkpoint, inbox, or
generation reducer.

The sole coordinator and transaction-local helpers are:

```js
syncFinalizedRwaRegistryLifecycle(pool)
applyFinalizedRwaActivationEvents(client, decodedBatch)
applyFinalizedRwaBallotEvents(client, decodedBatch)
readFinalizedRwaLifecycleHeadV2(client)
compareFinalizedRwaActivationV2(client, headReceipt, assetVersionKey, {
  observedActivationGeneration
})
requireFinalizedRwaActivationV2(client, assetVersionKey, {
  expectedActivationGeneration
})
```

The apply helpers receive only a caller-owned query client and a deeply frozen decoded
batch; the read helpers receive the exact closed arguments specified below. They never
connect, begin, commit, roll back, release, retry, read RPC, sign, or send. Only the coordinator calls the domain-neutral `observeFinalized` and
`commitFinalizedObservation` APIs. The two apply helpers partition work only for
implementation clarity: all five event kinds remain one total canonical stream under
one coordinator, transaction, observation commitment, inbox, reducer, and checkpoint;
no event can be regrouped across helper calls or applied out of total log order.

## 2. Immutable observation identity

Configuration is code-normalized from the same exact Registry address/start-block
authority as Task 5:

```text
chainId                  4663
contract                 configured immutable StockTokenRegistryV2
inclusive start block    exact deployment block
consumer key             rwa_registry_lifecycle_v2
topics                   exact five Registry V2 event signatures
max block span           10,000
max raw logs             2,000
max committed bytes      2,000,000
max touched asset keys   256
max touched ballot days  64
max proposal/result joins 256
max Registry versions    2,048
```

The exact topic set is:

```text
PublisherSet(address)
AssetVersionRegistered(bytes32,bytes32,address,bytes32,string,string,uint8,uint64)
AssetVersionActivated(bytes32,bytes32,bytes32,uint64,uint64,uint256)
AssetVersionDeactivated(bytes32,bytes32,uint64,uint256)
BallotPublished(uint256,bytes32,address,uint8,bytes32,uint256,uint256,uint64,uint64)
```

The consumer uses a thin raw-RPC adapter only to satisfy FO's exact raw-topic
contract. It does not duplicate finalized-head selection, range math, log sorting,
block-hash/timestamp verification, pinned getter calls, final-head recheck, evidence
commitment, checkpoint CAS, or transaction coordination.

Before `BEGIN`, it decodes every log strictly against the event selected by `topic0`,
rejects anonymous/unknown/extra/missing/malformed/crossed data, and maps every decoded
log to exactly one committed `(blockNumber,blockHash,blockTimestamp)` record. All
authority-sized numbers stay BigInt/canonical decimal. Work ceilings reject before
the main FO apply transaction: configuration/input ceilings known without RPC reject
before the short attempt transaction; RPC-derived log/byte/touched/getter ceilings
reject after the attempt-CAS commit and before the main FO apply pool acquisition/
`BEGIN`, with the failure recorded by that attempt ID.

The pinned getter evidence at the exact bounded target contains only:

```text
publisher
catalogVersion
versionCount
ordered [assetVersionKey, activationGeneration] for every Registry index
```

`versionCount > 2,048` fails closed. Keys must be unique and index-contiguous. The
event-derived current publisher, final catalog version, ordered index-to-key mapping,
and every activation generation must exactly match this complete pinned evidence after
apply. Task 5 independently owns complete immutable version metadata and complete
current active/reverse-head proof; CN-6A neither rewrites nor advances its getter
checkpoint. During `caught_up=false` bootstrap, a later Task-5 head is expected:
CN-6A may commit successive bounded chunks using its own FO-pinned Registry evidence
and event-derived projection, but it never sets `ready_verified_at` and exposes no
activation authority. Task 5 must not be behind the CN-6A target; if it is, the chunk
is retryable and applies nothing. Before the first transition to `caught_up=true`,
CN-6A must reach the exact current Task-5 block number/hash. Under the Task-5 share
lock it then proves every immutable identity and current active/inactive state agrees
with Task 5 and that the ticker, token, and provider-ID reverse active heads all point
to the same exact keys or are absent in both projections. A generation match alone is
insufficient because deactivation does not increment generation. Any publisher,
catalog, order, immutable identity, active-state, or reverse-head mismatch at that
identical authority boundary is a pinned-getter/Task-5 reconciliation hard halt with
no checkpoint advance. A CN-6A readiness fact is usable by H2 only while both
consumers remain caught up, unhalted, and exactly same-head reconciled.

## 3. Consumer-owned schema

CN-6A adds only:

- `rwa_registry_lifecycle_lock_v2` singleton;
- `rwa_registry_lifecycle_checkpoint_v2`, permanently binding consumer key, chain,
  Registry, start block, last-applied block/hash/observation, finalized horizon and
  caught-up/halted state;
- `rwa_registry_lifecycle_inbox_v2`, immutable raw plus exact decoded event fields and
  canonical event-block timestamp;
- `rwa_registry_activation_instances_v2`, immutable
  `(chain,Registry,assetVersionKey,activationGeneration)` facts including exact
  activation event, evidence/review IDs, approved/deadline/inclusion time, catalog
  version, and later deactivation reference if any;
- `rwa_registry_asset_lifecycle_current_v2`, replaceable current generation/active/
  event/catalog projection per asset key;
- `rwa_registry_publisher_history_v2` and one current publisher projection;
- `rwa_registry_ballot_events_v2`, immutable finalized ballot facts by day;
- `rwa_registry_lifecycle_event_results_v2`, one closed matched/unmatched/drift
  disposition per canonical event;
- `rwa_registry_lifecycle_runtime_v2`, exact identity, applied/finalized heads,
  `sync_in_progress`, `attempt_id`, `last_attempt_at`, `last_success_at`,
  `ready_verified_at`, caught-up, halted, a closed failure code,
  unresolved-authority-incident count, and last incident.
- `rwa_registry_lifecycle_attempts_v2`, one durable started/succeeded/failed/
  superseded record per opaque attempt ID with start/end database times and a closed
  operational result.

No table stores a private key, signed transaction, arbitrary JSON RPC response, or
caller-supplied checkpoint. Immutable inbox identities use
`(chainId,contractAddress,blockHash,transactionHash,logIndex)` through FO's helper.

## 4. Ordered reducer

Canonical order is `(blockNumber,transactionIndex,logIndex)`. The complete stream
begins at the exact deployment block.

- `PublisherSet`: update current publisher and append immutable history; zero is a
  valid disabled publisher.
- `AssetVersionRegistered`: generation remains zero; first registration fixes key,
  ticker/token/provider/decimals/registration identity; conflicts are hard failures.
- `AssetVersionActivated`: require prior registration; increment that asset's
  generation exactly once; require event `approvedAt <= eventBlockTimestamp <
  validUntil` and `validUntil=approvedAt+604800`; create the immutable activation
  instance and set active/current catalog state.
- `AssetVersionDeactivated`: require a currently active instance; mark only that exact
  generation inactive with immutable reason/time/catalog event.
- `BallotPublished`: retain the exact day/key/token/decimals/tally/catalog/budget/
  purchase-window/published event and the then-current activation generation. It is
  a chain fact, not permission to purchase.

The catalog transition grammar is exact:

1. `AssetVersionRegistered` never changes `catalogVersion`.
2. A standalone explicit deactivation transaction emits one deactivation carrying
   exactly `previousCatalogVersion + 1`.
3. One activation transaction may emit zero, one, two, or three conflict
   deactivations immediately before its target activation. All those events and the
   target activation carry the same catalog version, exactly
   `previousCatalogVersion + 1`.
4. Conflict order is Registry order: ticker conflict, then a distinct token conflict,
   then a distinct provider-ID conflict. If multiple indices identify the same
   conflicting key, that key is deactivated once at its earliest applicable position.
5. A conflict event after the target activation, in another transaction, out of this
   order, with another catalog version, or a reuse of that version after the target
   activation is forbidden.
6. The final reduced catalog version must equal the pinned getter exactly.

Catalog values never regress or skip. Same-key deactivation/reactivation increments
the activation generation on reactivation and never reuses a previous activation
instance.

The reducer may match a finalized activation to a local nomination proposal by exact
review ID, asset key, evidence hash, approval/deadline and timely inclusion, and a
ballot to a local closed result by exact day/key/tally/catalog/budget/window. Exact
matches record finalized result facts. Missing or mismatched local provenance is a
closed nonauthorizing drift disposition that retains the chain event and advances the
cursor; it never fabricates or overwrites a proposal/result. Structural decode,
generation/catalog gaps, inbox conflicts, or pinned-getter disagreement are hard
halts with no checkpoint advance.

## 5. Atomicity, locks, readiness, and errors

The FO adapter's `lockAndReadCheckpoint` acquires:

```text
Task-5 Registry mirror singleton FOR SHARE
-> CN-6A lifecycle singleton
-> CN-6A checkpoint
-> CN-6A runtime row
-> touched lifecycle/current/proposal/result rows in ascending stable key order
```

Then one transaction inserts/verifies inbox rows, reduces all events, writes closed
event dispositions/runtime, and advances the CN-6A checkpoint. A crash at any seam
rolls all of it back. Exact replay returns the existing result. Competing workers from
one base produce one commit and one `fo_checkpoint_advanced` result.

Readiness requires exact configured identity, checkpoint initialized, `caught_up`,
applied head equal by both number and hash to the Task-5 getter mirror head, exact
publisher/catalog/index/immutable/current/reverse-head reconciliation, no halt, no
unresolved structural incident, `sync_in_progress=false`, and database time
`now <= ready_verified_at + 600 seconds` (the equality boundary is ready).
Local-provenance drift is public and nonauthorizing for the affected event: H2 requires
an exact matched current activation instance, so an unmatched activation for that
asset cannot supply H2 authority even if unrelated assets remain readable.

Every sync attempt uses the same fail-closed two-phase runtime protocol as H2:

1. a short standalone compare-and-set transaction installs a fresh opaque
   `attempt_id` after locking the lifecycle singleton, checkpoint, and runtime row
   `FOR UPDATE` in that order; it sets `sync_in_progress=true`, records
   `last_attempt_at`, and clears `ready_verified_at` before any RPC;
2. after that commit, RPC/FO/decode/pinned evidence may run without a database lock;
3. the successful FO transaction requires that same current `attempt_id`, performs
   its check again after taking the singleton, checkpoint, and runtime row `FOR UPDATE`,
   either a nonauthorizing partial-bootstrap apply or the complete same-head Task-5
   reconciliation, then sets `sync_in_progress=false` and records `last_success_at`
   from post-lock database time; only the caught-up same-head case writes
   `ready_verified_at`, while a partial chunk keeps it null, and both clear the failure
   code;
4. any RPC, decode, FO, reorg, generation, catalog, or reconciliation failure is
   recorded in a second short transaction that locks the same three rows `FOR UPDATE`
   and compare-and-sets the same `attempt_id`;
   older workers cannot overwrite a newer attempt. Structural/reconciliation failures
   set the durable halt; retryable transport failures leave readiness false without
   fabricating a checkpoint.

The attempt lease is exactly 300 seconds by database time. While
`now < last_attempt_at + 300 seconds`, a second invocation returns
`rwa_lifecycle_sync_busy` without replacing the attempt. At equality or later, one
successor transaction may compare-and-set the prior attempt to `superseded`, append a
durable operational takeover audit (never an unresolved-authority incident or halt),
install a new attempt ID, and proceed; simultaneous
successors race on that compare-and-set and only one wins. Any late success/failure
from the old attempt is ignored by the current runtime CAS and cannot touch readiness
or domain state. Readiness remains false until the winning successor commits a
successful exact apply.

Every readiness/authority reader locks the lifecycle singleton and checkpoint, then
holds the runtime row `FOR SHARE` through the caller transaction's commit. Attempt
start/takeover/success/failure and FO apply hold those same rows `FOR UPDATE`. Thus an
attempt start waits behind an authorization that already observed readiness, and an
authorization waits behind an attempt that has closed readiness. Old attempt IDs are
rechecked only after the writer locks are held and before any domain mutation.

### 5.1 Exact H2 lifecycle-head and activation-comparison seams

`readFinalizedRwaLifecycleHeadV2(client)` is the key-independent consumer seam. The
caller already holds the Task-5 Registry mirror singleton `FOR SHARE` and may hold H1
locks after it. On the same caller-owned client, it reads the protected Task-5 sync/
checkpoint head, then locks the CN-6A lifecycle singleton and checkpoint and holds the
runtime row `FOR SHARE`. It requires exact configured identity, initialized/caught-up/
unhalted/not-in-progress/readiness-fresh state and complete same-head Task-5
reconciliation. It returns one deeply frozen null-prototype receipt with exactly:

```js
{
  chainId: '4663',
  registryAddress: '<canonical lowercase address>',
  consumerKey: 'rwa_registry_lifecycle_v2',
  appliedBlockNumber: '<canonical uint256 decimal>',
  appliedBlockHash: '<canonical nonzero bytes32>',
  observationHash: '<canonical nonzero bytes32>',
  finalizedHorizonBlockNumber: '<canonical uint256 decimal>',
  finalizedHorizonBlockHash: '<canonical nonzero bytes32>',
  catalogVersion: '<canonical uint256 decimal>',
  catalogSnapshotHash: '<canonical nonzero bytes32 from Task 5>',
  caughtUp: true,
  halted: false,
  readyVerifiedAt: '<UTC ISO timestamp>',
  freshThrough: '<UTC ISO timestamp exactly readyVerifiedAt + 600 seconds>'
}
```

It works for no-log/zero-touched H2 ranges. Stable errors are
`rwa_lifecycle_unconfigured`, `rwa_lifecycle_halted`, `rwa_lifecycle_not_ready`, and
`rwa_lifecycle_task5_mismatch` in configuration -> halt -> active-attempt/catch-up/
freshness -> reconciliation precedence.

`compareFinalizedRwaActivationV2(client, headReceipt, assetVersionKey,
{observedActivationGeneration})` accepts only that exact frozen head receipt, one
canonical asset key, and one closed expectation object containing a canonical positive
uint256 decimal. It assumes the head locks remain held, then locks the asset current
row and the observed historical activation-instance row in that order, with keys and
generations sorted across a batch. It does not require the observed generation to be
current, active, or locally matched. It returns one deeply frozen null-prototype
comparison receipt:

```js
{
  chainId: '4663',
  registryAddress: '<canonical lowercase address>',
  assetVersionKey: '<canonical bytes32>',
  observedActivationGeneration: '<canonical positive uint256 decimal>',
  observedInstanceExists: true | false,
  observedLocalMatch: true | false,
  observedDeactivated: true | false,
  currentRegistered: true | false,
  currentActive: true | false,
  currentActivationGeneration: '<canonical uint256 decimal, including 0>',
  sameAsCurrent: true | false,
  currentCatalogVersion: '<canonical uint256 decimal>',
  appliedBlockNumber: '<same value as head receipt>',
  appliedBlockHash: '<same value as head receipt>'
}
```

Absent historical/local provenance is represented only by the closed booleans; no
nullable or caller-supplied authority field is invented. This comparison allows H2 to
classify coherent old/inactive generations as per-package stale and missing/unmatched
provenance as an authority incident without poisoning the Registry cursor.
`observedInstanceExists=false` forces `observedLocalMatch=false` and
`observedDeactivated=false`; `currentRegistered=false` forces `currentActive=false`
and generation `0`; `sameAsCurrent=true` iff the observed instance exists, the current
row is active, and both generations are equal. `currentCatalogVersion` equals the head
receipt's catalog version. Bad receipt/request/key shape is `rwa_activation_input`; a
receipt not identical to the still-locked head is `rwa_activation_head_changed`; an
impossible row/boolean relation is `rwa_activation_state_malformed`. Those errors
precede any comparison receipt and never reflect caller values.

### 5.2 Exact strict package-authoring seam

`requireFinalizedRwaActivationV2` accepts a caller-owned client, one canonical
`assetVersionKey`, and the exact closed expectation object shown in section 1. It never
connects, opens or ends a transaction, retries, performs RPC, or takes ownership of
the client. Chain ID, Registry address, and Task-5 head come only from immutable
configuration and the locked CN-6A/Task-5 state. The expected generation is a compare-
and-set expectation only; callers cannot provide or override authoritative chain,
Registry, Task-5 head, generation, current/active state, activation time, review/
evidence identity, catalog version, checkpoint, or readiness fields.

The strict helper composes the lifecycle-head and comparison seams above on the same
caller-owned client and held locks. It requires the observed instance to exist, be
locally matched, active, current, and exactly equal to the expected generation. It
acquires no Task-5, H1, or H2 lock and returns no query capability or raw control row;
the authoritative generation always comes from CN-6A state.

On success it returns one exact deeply frozen null-prototype receipt in this field
order:

```js
{
  chainId: '4663',
  registryAddress: '<canonical lowercase address>',
  assetVersionKey: '<canonical bytes32>',
  activationGeneration: '<canonical uint256 decimal>',
  active: true,
  localMatch: true,
  activationBlockNumber: '<canonical uint256 decimal>',
  activationBlockHash: '<canonical bytes32>',
  activationTransactionHash: '<canonical bytes32>',
  activationLogIndex: '<canonical uint256 decimal>',
  catalogVersion: '<canonical uint256 decimal>',
  catalogSnapshotHash: '<canonical nonzero bytes32 from the reconciled Task-5 head>',
  reviewId: '<canonical bytes32>',
  evidenceHash: '<canonical bytes32>',
  approvedAt: '<canonical uint64 decimal>',
  validUntil: '<canonical uint64 decimal>',
  includedAt: '<canonical uint64 decimal>',
  appliedBlockNumber: '<canonical uint256 decimal>',
  appliedBlockHash: '<canonical bytes32>',
  caughtUp: true,
  halted: false
}
```

Stable precedence is input shape/canonicality -> configured identity -> durable halt ->
active attempt/not-caught-up/readiness expiry -> Task-5 same-head reconciliation ->
current/active/local match -> expected-generation CAS. Closed errors are respectively
`rwa_activation_input`, `rwa_activation_unconfigured`, `rwa_activation_halted`,
`rwa_activation_not_ready`, `rwa_activation_task5_mismatch`,
`rwa_activation_not_authoritative`, and `rwa_activation_generation_stale`; messages
never reflect attacker values.

Stable domain errors are secret-safe and map through FO's safe-domain wrapper. They
must distinguish unconfigured, bad input/config, decode, timestamp/TTL, generation
gap/regression, catalog gap/regression, pinned-getter mismatch, inbox conflict, local
provenance drift, capacity, and halted checkpoint without exposing RPC URLs or raw
private service errors.

## 6. RED acceptance matrix

RED must prove:

1. exact export surfaces and no publisher/signer/sender/health mutation;
2. configuration identity, all topic/limit boundaries, an attempt-CAS pool transaction
   before RPC, no database lock held across RPC, and all RPC-derived ceilings before
   the main FO apply transaction/pool acquisition;
3. all five exact event decoders including dynamic strings and indexed fields;
4. missing/extra/reordered/mismatched `eventBlocks` reject after the attempt-CAS
   commit, record failure by that attempt ID, and occur before the main FO apply
   `pool.connect`/`BEGIN`;
5. pinned getter publisher/catalog/version/generation/order uniqueness, count cap,
   exact target, and complete Task-5 immutable/current/reverse-head reconciliation;
6. bootstrap from deployment, no-log ranges, bounded catch-up, exact replay, same-base
   competing workers, deep checkpoint disagreement, and before/after reorg checks,
   including Task 5 initially more than 20,000 blocks ahead: at least three bounded
   CN-6A commits expose no authority before exact same-head reconciliation;
7. raw+decoded inbox equality and conflicting same-identity rejection;
8. registration immutability and no catalog bump; activation TTL/inclusion; valid
   zero/one/two/three-conflict transactions and conflict deduplication/order; conflict
   after activation, cross-transaction/shared/wrong catalog, activation previous/+2/
   regressed catalog, standalone reuse, same-key cycles, generation gap/regression/
   overflow, and final pinned catalog equality;
9. exact local activation/ballot match versus every one-field mismatch/unmatched drift;
10. crash rollback after inbox, each reducer kind, result match, runtime, and before
    checkpoint advance;
11. Task-5 getter checkpoint/inbox and all H1/H2 tables remain unchanged;
12. all three exact H2 reader surfaces: key-independent lifecycle-head receipt,
    non-strict historical/current comparison, and strict authoring receipt; closed
    requests/deep freeze, stable error precedence, authoritative generation derivation,
    no-log head proof, coherent old/inactive return, missing/unmatched booleans, and
    rejection of missing/zero/future/stale/overflow/noncanonical/accessor/inherited/
    wrong-type expectations, caller-supplied authority, cross-head/halted/not-caught-
    up/in-progress/Task-5 disagreement, and receipt mutation;
13. real PostgreSQL proves Registry writer/share-lock ordering, singleton/checkpoint/
    runtime reader-writer serialization, readiness versus attempt start/takeover, old
    apply/failure versus takeover, constraints, rollback, and stable sorted multi-asset
    locking;
14. sync-attempt start plus RPC/pre-BEGIN/decode/FO/reorg/structural failure recording,
    process death after attempt start, the exact 300-second takeover boundary, two
    simultaneous successors, older-attempt success/failure CAS rejection, readiness
    freshness exact boundary, and no database lock across RPC;
15. wrong publisher/final catalog/index permutation, omitted explicit/conflict
    deactivation, wrong active flag with equal generations, wrong ticker/token/provider
    reverse head, and number/hash cross-head mismatches each apply nothing, advance no
    checkpoint, and make H2 authority unavailable;
16. source searches prove no `setPublisher`, `activateVersion`, `deactivateVersion`,
    `publishBallot`, private key, signer, transaction build/send/broadcast, Safe
    execution/package, health clearance, funds/token, worker schedule, deployment,
    environment activation, or cutover selector, and no direct RPC except the thin
    read-only FO adapter.

Focused commands after GREEN:

```powershell
node test/finalizedobservation.js
node test/stockcatalogv2.js
node test/rwanominations.js
node test/stockballotv2.js
node test/rwaregistrylifecycle.js
node test/rwaregistrylifecycle.postgres.js
node test/migrate.js
node test/gates.js
git diff --check
```

## 7. Implementation tasks

1. Independently review/freeze this plan with P0/P1=0.
2. Add pure decoder/reducer/schema/consumer RED and record the focused failure.
3. Implement schema and `src/rwaregistrylifecycle.js` only; do not schedule it.
4. Implement exact local proposal/result reconciliation and H2 read-only activation
   instance seam.
5. Add real-PG, migration, gate, knowledge, source-absence and full regression checks.
6. Run independent security/specification review and close every P0/P1.
7. Record CN-6A as implemented/approved/dormant. Then resume H2. CN-6B remains pending.

## 8. Completion boundary

CN-6A development closure is code, migrations, focused/integrated tests, read-only
machine facts, and independent review. It is not a configured RPC/Registry address,
scheduled worker, observed production finality, deployed contract, Safe execution,
signed/broadcast transaction, publisher, ballot cutover, funding, or activation.

## 9. Development closure record

Closed on 2026-08-28 as an implemented, reviewed, dormant dependency for H2:

- production source SHA-256
  `0FA1F23FADF8461877B6DD841D2DEB35300E8C66FDFD4DF1AB3AFA36C84AB11D`;
- schema SHA-256
  `3060A1E32CE3518636508B125DA6FAF41798D11011B9BC61E3671704D3D840D1`;
- unit and production-style sync test SHA-256 values
  `D39A1BFC8BC6BE123739699222D24E23C96D060913D90B618BBEFB0747D91A3F`
  and `6DEFF917CA2A603D1BA7FF61B71F00E35A50AB514659C2A41CB98FCCE2E2C37A`;
- lifecycle unit tests 28/28, production-style finalized RPC/sync, FO, Task-5,
  nominations, ballot, migration, gate, security, chain, H1, and diff checks green;
- independent final security and specification reviews both accepted the frozen
  bytes with P0=0/P1=0;
- the real-PostgreSQL lane truthfully skipped because
  `RWA_REGISTRY_LIFECYCLE_TEST_DATABASE_URL` was not configured. That remains an
  explicit X-gate environment evidence item, not claimed executed evidence.

No production configuration, schedule, deployment, Safe execution, transaction,
finality observation, publisher, funding, or cutover was performed.
