# Shared Finalized-Observation Kernel Implementation Plan

> **For Codex:** execute this plan with `superpowers:subagent-driven-development`
> and strict `superpowers:test-driven-development`. Each task gets one focused
> implementation commit and an independent review before its dependent begins.

**Goal:** Add one domain-neutral exact-head observation and atomic consumer-apply
kernel that registry, RWA health, acquisition, and gameplay finality consumers
can reuse without sharing authority, cursors, tables, or policy.

**Architecture:** `src/finalizedobservation.js` owns canonical RPC observation:
configuration/identity validation, finalized-horizon discovery, bounded target
selection, an exact unpaginated log read, per-event block-hash checks, pinned
getter reads, and target/horizon rechecks. It returns immutable evidence but
publishes no domain state. A generic transaction coordinator then calls a typed
consumer adapter to lock/compare its own checkpoint, insert its own inbox, apply
its own transitions, and advance its own last-applied checkpoint atomically.
Task 2's registry reader is integrated only after the kernel itself is approved.
The approved event-time extension retains exact event-block timestamps from the
same block responses already used for hash verification. H2 and C/N Task 6 later
create separate concrete schemas/adapters and never reuse the getter consumer's
authority.

**Tech stack:** Node.js ESM, viem-compatible public client seams, PostgreSQL/pg-
mem transaction adapters, native `node:assert`, repository knowledge checks.

## Implementation and authority status — 2026-08-27

- FO Tasks 1–4 are implemented and independently approved.
- FO Task 5's complete getter mirror is implemented and independently approved,
  including its disposable real-PostgreSQL evidence. It remains dormant and
  unscheduled.
- The scoped Task-1 `eventBlocks` extension from the follow-on finalized
  event-time plan is implemented and independently approved, including the
  reviewed type-disjoint BigInt commitment and strict pre-pool commit validator.
- The H2 and CN-6 consumers defined below are acceptance contracts only: their
  runtime/schema/workers do not yet exist. Nothing in this plan is production
  configured, deployed, Safe-executed, chain-finalized, funded, or active.

## Binding boundaries

- FO depends only on approved CN-1..4 infrastructure and general chain parameter
  conventions. It does not depend on H, Task 5, CN-6, AcquisitionVault, gameplay,
  a deployed address, a reviewer secret, a signer, or a private key.
- FO owns no database table, HTTP route, worker schedule, domain readiness label,
  ABI decoder, Safe package, policy decision, or contract deployment.
- The consumer supplies expected chain, exact canonical nonzero contract,
  inclusive deployment/start block, topic allow-list, current typed checkpoint,
  hard work limits, and a getter callback. Start block never defaults to a live
  head and all block-sized values remain `BigInt`/canonical decimal strings.
- For a checkpoint at `C` and finalized horizon `F`, target
  `N = min(F, C + maxBlockSpan)`. Logs cover exactly `C+1..N` (or
  `startBlock..N` during explicit bootstrap), and getters are pinned to `N`.
  `F` is evidence only; the observation is caught up only when `N == F`.
- “Complete” is one successful unpaginated response from the configured trusted
  RPC for the reviewed bounded range, with no truncation signal and exact bounds/
  identity/order/hash checks. FO makes no cryptographic provider non-omission
  claim and introduces no unapproved quorum dependency.
- Every log must be non-removed, from the exact address, carry an allowed topic0,
  lie inside the requested interval, include canonical block/transaction hashes
  and transaction/log indices, be uniquely and stably ordered, stay within log/
  byte limits, and match an independently fetched exact block hash.
- The immutable observation also commits `eventBlocks`, one deeply frozen exact
  record per unique normalized-log block in first canonical log-occurrence order:
  `{blockNumber: bigint, blockHash: bytes32, blockTimestamp: bigint}`. The record
  reuses the exact numbered-block response already fetched for hash verification;
  no caller, target-head inference, receipt, or later database lookup may supply
  its nonnegative `blockTimestamp`. Multiple logs in one block share one record,
  a log-free observation carries `eventBlocks: []`, and changing only a timestamp
  changes the observation commitment.
- The getter callback receives only a pinned facade. It cannot choose another
  address/block or access the raw client. FO rechecks target block/hash after
  every payload RPC and performs a final target/horizon bracket. Natural advance
  of the `finalized` tag is allowed; drift of any exact numbered block is not.
- RPC finishes before `BEGIN`. The typed consumer transaction then locks and
  compare-and-swaps its checkpoint, verifies/replays exact inbox identities,
  applies typed domain state, and advances its last-applied checkpoint. Any error
  rolls back all three. An inbox-only advance may not be called last-applied.
- Existing `src/watcher.js`/`chain_cursor` confirmation-depth flows remain legacy
  consumers and are not upgraded or reused as finalized authority in this slice.

## Stable kernel surface

```js
export class FinalizedObservationError extends Error {
  constructor(code, message, cause)
}

export function normalizeFinalizedObservationConfig(input)
export function finalizedInboxIdentity(input)

export async function observeFinalized({
  client,
  identity,       // chainId, contractAddress, startBlock
  checkpoint,     // nullable lastAppliedBlockNumber/hash
  topics,
  limits,         // maxBlockSpan, maxLogs, maxBytes
  readGetters,    // receives pinned { readContract } facade and head evidence
})

export async function commitFinalizedObservation(pool, observation, adapter)
```

The immutable observation contains canonical identity, checkpoint base,
`finalizedHorizon`, bounded `head`, exact `range`, normalized ordered logs,
`eventBlocks`, getter evidence, evidence hash, and `caughtUp`. Before opening a
database transaction, each typed consumer must map every decoded log to exactly
one committed `(blockNumber, blockHash, blockTimestamp)` event-block record and
reject a missing, extra, reordered, or mismatched association. Consumer adapters
implement a documented capability contract equivalent to:

```js
{
  lockAndReadCheckpoint(client, observation),
  insertOrVerifyInbox(client, observation),
  applyDomainState(client, observation),
  advanceCheckpoint(client, observation),
  readCommittedResult(client, observation),
}
```

## Stable internal errors

`fo_unconfigured`, `fo_bad_config`, `fo_wrong_chain`, `fo_head_unavailable`,
`fo_checkpoint_identity`, `fo_checkpoint_reorg`, `fo_head_regression`,
`fo_range_gap`, `fo_work_oversized`, `fo_rpc_unavailable`, `fo_log_removed`,
`fo_log_address`, `fo_log_topic`, `fo_log_range`, `fo_log_identity`,
`fo_log_order`, `fo_log_duplicate`, `fo_log_block_hash`, `fo_head_mismatch`, and
`fo_checkpoint_advanced`.

These are internal stable categories. Each concrete consumer maps them to its
own public readiness/status vocabulary without exposing secrets or raw provider
payloads.

---

### Task 1: Freeze the public contract and RED observation matrix

**Files:**

- Create: `test/finalizedobservation.js`
- Modify: `package.json`

**Step 1: Add missing-module and export-contract tests**

Import the four planned exports and assert the exact stable error-code list.
Require the module to be ESM and free of environment reads at import time.

**Step 2: Add a deterministic fake public client**

The fake records every `getChainId`, `getBlock`, `getLogs`, and getter call. It
must support block numbers beyond `2^53`, target/horizon hash drift, normal
finalized-tag advancement, malformed logs, duplicate identities, byte/log caps,
and event-block hash changes.

**Step 3: Add the RED observation cases**

Cover:

- canonical config and rejection of wrong chain, zero/bad address, absent start,
  zero/unsafe limits, unordered/duplicate topics, and Number block inputs;
- bootstrap from inclusive deployment block and subsequent exact contiguous
  `checkpoint+1` range;
- bounded `N < F`, pinned getters at `N`, `caughtUp=false`, then `N == F`;
- finalized tag advancing naturally while exact target/horizon hashes stay valid;
- empty log range as success;
- removed, wrong-address/topic/range, malformed identity, unordered, duplicate,
  conflicting, oversized-log and oversized-byte failures;
- per-unique-event-block hash lookup/cache and mismatch rejection;
- target disappearance/regression/hash drift before, between, and after payload
  calls; checkpoint hash mismatch before scanning;
- pinned facade refusing caller address/block overrides and no raw-client escape;
- deterministic evidence/identity hashes independent of input object key order.

**Step 4: Run RED**

```powershell
node test/finalizedobservation.js
```

Expected: module/export failure before production code exists. Preserve the
failure in the task report. Commit tests only if repository convention permits a
RED commit; otherwise keep the evidence and continue to Task 2 in one focused
implementation commit.

---

### Task 2: Implement pure identity, limits, errors, and inbox identity

**Files:**

- Create: `src/finalizedobservation.js`
- Modify: `test/finalizedobservation.js`

**Step 1: Implement exact canonical parsers**

Use canonical decimal-string/`BigInt` helpers for chain/block/index fields,
checksum/canonical address normalization, bytes32/topic validation, positive
hard limits, and inclusive start/checkpoint identity. Never coerce authority to
`Number`.

**Step 2: Implement stable error construction**

Errors expose only code and safe message; raw URLs, secrets, request bodies, and
provider error payloads are retained only as an optional non-enumerable cause.

**Step 3: Implement exact inbox identity**

Normalize and hash/serialize exactly
`(chainId, contractAddress, blockHash, transactionHash, logIndex)`. Changing any
one dimension changes identity; field order/input object order does not.

**Step 4: Run focused GREEN subset and mutation checks**

```powershell
node test/finalizedobservation.js
node --check src/finalizedobservation.js
```

Deliberately mutate one max-bound and one identity dimension assertion, observe
failure, then restore.

---

### Task 3: Implement exact bounded finalized observation

**Files:**

- Modify: `src/finalizedobservation.js`
- Modify: `test/finalizedobservation.js`

**Step 1: Select coherent target and range**

Read chain ID and finalized horizon; fetch exact horizon identity; validate the
stored checkpoint block/hash when present; select bounded `N`; fetch exact `N`;
derive the exact inclusive range or a typed no-work observation.

**Step 2: Read and validate one exact log response**

Make one unpaginated `getLogs` request for the exact range/address/topics. Reject
provider truncation indicators, work-limit excess, every malformed/foreign/
removed/out-of-range/unordered/duplicate log, and conflicting same-identity data.
Fetch/cache every unique event block and compare its hash.

**Step 3: Expose only a pinned getter facade**

The facade injects exact address and `blockNumber: N`, rejects overrides, and
rechecks exact target identity after each getter. The callback result must be
plain serializable bounded evidence; reject functions/cycles/oversized output.

**Step 4: Final bracket and evidence hash**

Re-read exact target/horizon blocks. Permit a later finalized tag height, but
reject any changed exact numbered hash, regression below target, or unavailable
numbered block. Return immutable normalized evidence and deterministic hash.

**Step 5: Run full observation matrix**

```powershell
node test/finalizedobservation.js
node --check src/finalizedobservation.js
git diff --check
```

Deliberately disable one event-block-hash comparison and one getter target
recheck; prove the relevant tests fail, then restore.

---

### Task 4: Implement atomic typed-consumer transaction coordination

**Files:**

- Modify: `src/finalizedobservation.js`
- Modify: `test/finalizedobservation.js`

**Step 1: Add a test-only concrete consumer schema/adapter**

Use test-local lock/checkpoint/inbox/domain tables. Do not add generic production
DDL. The checkpoint binds chain, contract, start block, last-applied block/hash,
finalized horizon metadata, and caught-up/verified timestamps.

**Step 2: Add RED crash/concurrency/replay tests**

Cover RPC completion before connection/`BEGIN`; exact transaction order; rollback
after inbox insert, during domain apply, and before checkpoint advance; no partial
rows/state/cursor; same-observation exact replay; conflicting same inbox identity;
stale checkpoint CAS; two workers where one commits and the other receives
`fo_checkpoint_advanced`; caller cannot supply a pre-opened transaction/client.

**Step 3: Implement coordinator**

Own exactly one fresh pool client and transaction. Lock/validate the consumer
checkpoint against the immutable observation base; invoke each adapter method in
fixed order; commit only after typed apply and last-applied advance; rollback and
release on all failures. Wrap unknown adapter errors without erasing stable
domain errors. Never retry a caller-owned transaction.

**Step 4: Run GREEN and transaction mutation checks**

```powershell
node test/finalizedobservation.js
node --check src/finalizedobservation.js
```

Deliberately move checkpoint advance before domain apply and prove the crash test
fails; restore before commit.

**Step 5: Commit and independently review the kernel**

Commit only `src/finalizedobservation.js`, `test/finalizedobservation.js`, and the
test registration in `package.json`. Review for BigInt safety, raw-client escape,
RPC/DB overlap, false completeness claims, callback capability leaks, crash
atomicity, work bounds, and secret-safe errors. Critical/Important findings block
Task 5; use at most five fix/re-review loops.

---

### Task 5: Integrate Task 2 registry getter enumeration through FO

**Files:**

- Modify: `src/stockcatalogv2.js`
- Modify: `schema.sql`
- Modify: `test/stockcatalogv2.js`
- Create: `test/stockcatalogv2.postgres.js`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify only if a genuinely generic regression is exposed:
  `test/finalizedobservation.js`

**Consumes:** independently approved Tasks 1–4. This task begins only after the
Task 5 ballot fix has committed, been independently approved, and the shared
worktree is clean because `stockcatalogv2.js` is shared scope.

**Step 1: Add RED adapter tests**

Prove the default production registry observation uses FO's bounded/pinned
facade, every Task 2 getter stays at the FO target, Task 2 validation/snapshot
hash/readiness output is unchanged, a bounded not-caught-up observation cannot
refresh ready freshness, and no second head/log/cursor implementation remains.
The production consumer requires canonical-decimal
`STOCK_TOKEN_REGISTRY_V2_START_BLOCK`, binds chain `4663`, exact configured
registry address and start block, and uses reviewed code constants
`maxBlockSpan=10000n`, `maxLogs=2000`, and `maxBytes=2000000`.

**Step 2: Extract only pure at-block enumeration**

Retain Task 2's normalized production config, complete registry history/head
enumeration, immutable snapshot validator/hash, database synchronizer, and public
read model. Extract a pure enumeration callback that receives only FO's pinned
`readContract` facade and exact head evidence. Route the default production
transport through FO without changing injected-reader test seams or weakening
exact registry readiness. The consumer-owned viem wrapper must make one raw
`eth_getLogs` request for the exact address/range and a topic-0 OR matrix covering
all five V2 registry event signatures; it normalizes JSON-RPC quantities to
`BigInt`, exposes no raw request capability to the getter callback, never sorts
provider output, and provides no retry/pagination/fallback authority.

**Step 3: Add the separate durable getter-mirror consumer**

Add a getter-mirror-specific checkpoint and raw finalized-log inbox, permanently
bound to the consumer key, chain, contract and start block. The checkpoint stores
the exact applied block/hash, prior FO observation commitment, finalized horizon,
`caught_up`, verification time, and a distinct `ready_verified_at`. Existing
pre-FO rows are not backfilled as ready. Inbox identity is exactly FO's five-part
identity and a duplicate must match every stored byte or fail atomically.

Keep this consumer categorically separate from CN-6: raw logs are observation
evidence only; Task 5 does not decode or claim activation, reviewer, publisher,
Safe or ballot-lifecycle provenance. Its domain apply remains Task 2's complete
getter snapshot and current-head replacement. Under a permanent mirror lock, one
transaction orders checkpoint lock, inbox insert/verify, getter-domain apply,
and checkpoint advance. A partial bounded observation may advance applied state
but not `ready_verified_at`; caught-up success advances it once; exact replay
advances neither. Public ten-minute readiness uses PostgreSQL time against
`ready_verified_at`, with exactly 600 seconds fresh and the first microsecond
after stale.

**Step 4: Prove the concrete transaction on real PostgreSQL**

Create a disposable unique-schema test lane, refusing any database not explicitly
provided as `TEST_DATABASE_URL`. Use two independent connections and real
`NUMERIC(78,0)`, `TIMESTAMPTZ`, row locks and transactions. Cover concurrent
bootstrap and same-base alternatives, exact replay, inbox conflicts, failure
after each atomic stage, values beyond `2^53`, deterministic lock order/deadlock
bounds, partial-versus-caught-up readiness, the exact 600-second-plus-one-
microsecond boundary, coherent repeatable-read public views, and proof that all
RPC completed before the mutation coordinator's explicit `pool.connect()` and
`BEGIN`. One optimistic read-only checkpoint query may acquire and release a
pooled client before RPC to determine FO's base; it must open no transaction or
lock, must finish before RPC begins, and no mutation client or database lock may
span RPC. Trace both `pool.query` and explicit checkout/transaction events so
this boundary is non-vacuous. Wire this lane into the real-PostgreSQL CI job;
pg-mem remains fast shape coverage and is not concurrency evidence.

**Step 5: Run focused and coupled suites**

```powershell
node test/finalizedobservation.js
node test/stockcatalogv2.js
node test/stockballotv2.js
node test/rwanominations.js
node test/preflight.js
node --check src/finalizedobservation.js
node --check src/stockcatalogv2.js
# With an explicitly disposable database:
$env:TEST_DATABASE_URL='<throwaway-postgres-url>'
node test/stockcatalogv2.postgres.js
```

**Step 6: Commit and independently review the integration**

Review specifically for Task 2 regression, current-address readiness, exact
ten-minute PostgreSQL boundary, bounded target/horizon coherence, no readiness
refresh while catching up, real transaction atomicity, separate getter/CN-6
consumer authority, and no duplicate finality transport. No worker, route,
contract, H, activation lifecycle, publisher, Safe, reviewer, or funds code is
allowed in this commit. The schema and real-PostgreSQL additions are the narrow
master-spec-required exception to the original Task 5 file boundary; legacy
`chain_cursor` and confirmation-depth watcher state remain forbidden.

---

### Task 6: Plan-level verification and handoff to H/CN-6

**Files:**

- Modify: `docs/superpowers/plans/2026-08-26-finalized-observation-kernel.md`
- Modify: generated knowledge only through `npm run knowledge`

**Step 1: Run native verification**

```powershell
node test/finalizedobservation.js
node test/stockcatalogv2.js
node test/stockballotv2.js
npm test
npm run knowledge
node tools/knowledge-test.js
git diff --check
```

Run ContextPlus static analysis/blast-radius where the connector is authoritative;
record its exact worktree-index limitation otherwise. Native tests remain the
acceptance evidence.

**Step 2: Prove absence of authority bleed**

Use exact searches/tests to show FO reads no environment/private key/reviewer
secret, owns no production table/route/worker, signs/sends no transaction, moves
no funds/token, and maps no domain readiness state. Prove legacy `watcher.js` and
`chain_cursor` remain outside all new authoritative consumers.

**Step 3: Freeze consumer handoff contracts**

The accepted H2 entry point is:

```js
syncFinalizedRwaHealthOverlay(pool)
```

H2 owns its exact chain `4663`, immutable overlay address, inclusive deployment
start block, exact clearance topic set, and separately reviewed code-owned work
limits. It owns `rwa_health_overlay_lock_v2`,
`rwa_health_overlay_checkpoint_v2`, an immutable raw-plus-decoded
`rwa_health_overlay_inbox_v2`, an ordered overlay-generation reducer, and one
atomic clearance apply. It may not read or advance the Task 5 getter-mirror
checkpoint/inbox or the CN-6 registry-lifecycle checkpoint/inbox, and neither of
those consumers may clear an H episode. Exact finalized clearance removes only
the sticky latch; a new successful health evaluation performed after finalized
apply remains mandatory before the effective state can become green.

The accepted CN-6 entry point and transaction helpers are:

```js
syncFinalizedRwaRegistryLifecycle(pool)
applyFinalizedRwaActivationEvents(client, decodedBatch)
applyFinalizedRwaBallotEvents(client, decodedBatch)
```

`syncFinalizedRwaRegistryLifecycle` owns one registry-wide cursor,
`rwa_registry_lifecycle_lock_v2`, `rwa_registry_lifecycle_checkpoint_v2`, a
raw-plus-decoded `rwa_registry_lifecycle_inbox_v2`, one reducer, and one atomic
adapter for all five
ordered RegistryV2 topics: `PublisherSet`, `AssetVersionRegistered`,
`AssetVersionActivated`, `AssetVersionDeactivated`, and `BallotPublished`. Both
helpers execute beneath that one adapter and transaction using only the supplied
query client. They never connect, begin, commit, roll back, release, retry, or
perform RPC. The fixed initial ceilings are 10,000 blocks, 2,000 logs, 2,000,000
bytes, 256 unique asset-version keys, 64 ballot days, and 256 proposal/result
matches; exceeding any ceiling fails closed without partial checkpoint advance.

Before `BEGIN`, CN-6 maps each decoded event to its exact committed event-block
record. Activation-instance identity is
`(4663, registryAddress, assetVersionKey, activationGeneration)`, derived from
the complete ordered stream starting at the exact deployment block. Inclusion
is timely only when `approvedAt <= eventBlockTimestamp < validUntil`. A local
`approval_stale` label yields when later finalized evidence proves timely
canonical inclusion. Unmatched canonical events remain immutable chain facts,
advance the cursor, and raise persistent public drift, but never authorize a
proposal or result. Finalized checkpoint disagreement halts the consumer for a
separately reviewed recovery; it never auto-rewinds or deletes history.

The future publisher is a separate dormant component. Before any broadcast it
must persist the exact signed transaction bytes and canonical hash; every retry
may rebroadcast only those identical bytes. No signer or broadcaster exists in
this slice. If the purchase window elapses before publication,
`purchase_window_elapsed_before_publication` is terminal: no extension,
reopening, runner-up, or replacement winner is permitted. H2 readiness and
AcquisitionVault-backed pre-vote budget provenance are mandatory before any
CN-6 publisher becomes reachable. `RWA_STOCK_PIPELINE` is only a future cutover
selector name and is absent from current production code.

Later acquisition/gameplay consumers follow the same separate-identity rule;
they receive neither the getter, registry, nor health consumer's cursor as
authority.

**Step 4: Independent whole-slice review**

Review the normalized final range for exact-head coherence, bounded completeness
wording, replay/crash/reorg behavior, Task 2 compatibility, and DAG compliance.
Report separately which facts are implemented/reviewed versus merely planned,
configured, deployed, Safe-executed, finalized, or active. FO remains dormant
library infrastructure until a separately approved concrete consumer is wired.

**Accepted completion truth:** Tasks 1–5 and the event-time extension are
implemented, independently reviewed, and dormant. This handoff documentation is
not evidence that H2/CN-6 is implemented, that any address/RPC/signer is
configured, that a contract is deployed, that a Safe package is signed or
executed, that a chain event is finalized, that ETH is funded, or that a feature
is active.
