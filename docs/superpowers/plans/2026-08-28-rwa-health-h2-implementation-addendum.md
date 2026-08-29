# RWA Health H2 — Implementation Clarification Addendum

**Date:** 2026-08-28
**Status:** implementation decisions frozen after independent attestation/package and
finalized-consumer preflights both accepted with P0=0/P1=0; RED and GREEN pending
**Parent:** `2026-08-28-rwa-health-h2.md`

This addendum closes implementation seams found after CN-6A became concrete. It does
not widen H2 authority. The parent plan remains controlling where this addendum is
silent. No deployment, configuration, scheduling, Safe execution, signing, sending,
funding, finality claim, or cutover is authorized.

## 1. Dependency order and H2 read seams

Package authoring cannot become GREEN before the minimal H2 control/readiness schema
exists. Implement the H2 singleton, checkpoint, runtime, attempt, and per-asset overlay
generation projection plus these transaction-local surfaces before package GREEN:

```js
readRwaHealthOverlayAuthoringContextV2(client, assetVersionKey)
requireRwaHealthOverlayReadyV2(client, {
  expectedH2BlockNumber,
  expectedH2BlockHash,
  expectedReadyVerifiedAt
})
```

The authoring-context helper takes the H2 singleton/checkpoint/runtime share locks in
the parent lock order, validates the same readiness predicates, reads the exact asset
projection, and returns this exact deeply frozen null-prototype receipt in this order:

```js
{
  chainId: '4663',
  consumerKey: 'rwa_health_overlay_v2',
  registryAddress: '<canonical lowercase nonzero address>',
  overlayAddress: '<canonical lowercase nonzero address>',
  safeAddress: '<canonical lowercase nonzero address>',
  startBlockNumber: '<canonical uint256 decimal>',
  appliedBlockNumber: '<canonical uint256 decimal>',
  appliedBlockHash: '<canonical lowercase nonzero bytes32>',
  observationHash: '<canonical lowercase nonzero bytes32>',
  finalizedHorizonBlockNumber: '<canonical uint256 decimal>',
  finalizedHorizonBlockHash: '<canonical lowercase nonzero bytes32>',
  caughtUp: true,
  halted: false,
  readyVerifiedAt: '<exact UTC ISO timestamp>',
  freshThrough: '<exact UTC ISO timestamp>',
  assetVersionKey: '<canonical lowercase nonzero bytes32>',
  currentOverlayGeneration: '<canonical uint256 decimal>',
  nextOverlayGeneration: '<canonical positive uint256 decimal>'
}
```

An absent asset projection is exactly current generation `0` and next generation `1`,
and is admissible only under a caught-up exact deployment checkpoint. The singleton,
checkpoint, runtime, and exact asset-projection share locks remain held through caller
commit. Error precedence is input -> unconfigured -> active/uninitialized/not-caught-
up -> halted -> authority incident -> freshness expiry. Package creation calls only
this authoring-context seam; it does not separately call
`requireRwaHealthOverlayReadyV2`. The latter remains the downstream ballot/purchase/
delivery readiness seam. The body carries `expectedOverlayGeneration` only as a
compare-and-set expectation.

The finalized consumer remains the only writer of H2 projection/readiness state. Until
it has produced a caught-up, unhalted, fresh head, authoring fails closed.

## 2. Hash and configuration types

The Safe call-intent ABI tuple is exactly:

```text
bytes32 tag
uint256 chainId
address safeAddress
address to
uint256 value
uint8 operation
bytes4 selector
bytes32 calldataHash
```

The dormant configuration names are exactly:

```text
RWA_HEALTH_OVERLAY_V2_ADDRESS
RWA_HEALTH_OVERLAY_V2_START_BLOCK
RWA_HEALTH_OVERLAY_V2_SAFE_ADDRESS
```

They are operational values, never enable flags. Configuration, H2 control rows,
contract immutable getters, and every package must agree exactly.

## 3. Reviewer route validation and closed responses

The two reviewer POST routes install a synchronous route-level `preValidation`
normalizer. It validates path/body shape and copies the request into a frozen null-
prototype value before reviewer authentication performs its first database query.
Authentication, durable reviewer latching, and idempotency reservation then run in
their existing order over the normalized body. Invalid input creates no reviewer,
idempotency, package, or domain row.

Creation succeeds with HTTP 200 and exactly this JSON-safe projection in this order:

```js
{
  clearanceId,
  assetVersionKey,
  status: 'safe_package_ready' | 'safe_submitted',
  approvedAt,
  clearanceDeadline,
  expectedOverlayGeneration,
  expectedSafeNonce,
  safeServiceTransactionHash,
  clearancePayloadHash,
  safeCallIntentHash,
  calldataHash,
  safeTransaction: { to, value: '0', operation: 0, data },
  changed
}
```

Hashes and keys are canonical lowercase nonzero bytes32. `approvedAt` and
`clearanceDeadline` are canonical uint64 decimal strings;
`expectedOverlayGeneration` is a canonical positive uint256 decimal;
`expectedSafeNonce` is `null` or a canonical uint256 decimal including `"0"`;
`safeServiceTransactionHash` is `null` or a canonical lowercase nonzero bytes32;
and `changed` is a boolean. A new package returns `safe_package_ready`/`true`. A
new-idempotency-key semantic replay returns the current stored open status
(`safe_package_ready` or `safe_submitted`) and `false`. An HTTP idempotency replay
returns the originally stored response byte-for-byte even if the package later moved
to `safe_submitted`. Submission succeeds with HTTP 200 and exactly:

```js
{
  clearanceId,
  assetVersionKey,
  status: 'safe_submitted',
  safeServiceTransactionHash,
  changed
}
```

The response never contains reviewer identity, recovery bytes, provider bytes/URL,
private evaluation context, a signature, or an unverified execution/finality claim.

The dormant operator read surface is reviewer-authenticated and omitted from OpenAPI:

```text
GET /v1/rwa/health/:assetVersionKey/clearance-attestations/:clearanceId
```

It validates both path hashes before its first database query and returns the creation
projection above without `changed`, reflecting the current closed status
`safe_package_ready | safe_submitted | approval_stale | finalized_applied |
finalized_rejected`. At or after the deadline it first normalizes an open package to
`approval_stale`. A missing exact package is `h2_package_not_found`; no list or public
read surface exists.

One allowlisted `RwaHealthOverlayError` family is handled explicitly by the server.
Authoring/submission codes and HTTP statuses are closed to:

```text
h2_input                         400
h2_readiness_input               400
h2_unconfigured                  503
h2_not_ready                     409
h2_halted                        503
h2_authority_incident            503
h2_readiness_stale               409
h2_readiness_changed             409
h2_health_not_authoritative      409
h2_activation_not_authoritative  409
h2_semantic_conflict             409
h2_approval_stale                409
h2_submission_conflict           409
h2_submission_terminal           409
h2_package_not_found             404
h2_contention                     409
h2_internal                       500
```

Messages remain constant and secret-safe. `h2_input` is authoring/submission/path
input; `h2_readiness_input` is reserved for the parent downstream readiness request.
H1 errors map exactly as follows: `health_bad_input -> h2_input`; every other closed
H1 error (`health_asset_not_found`, Registry unavailable/stale, snapshot/work/capacity/
slot/page/provider/evidence/state conflicts, not-fresh, and blocked) maps to
`h2_health_not_authoritative`. CN-6A maps exactly:

```text
rwa_activation_input                                      -> h2_input
rwa_activation_unconfigured | rwa_lifecycle_unconfigured  -> h2_unconfigured
rwa_activation_halted | rwa_lifecycle_halted              -> h2_halted
rwa_activation_not_ready | rwa_lifecycle_not_ready        -> h2_not_ready
rwa_activation_task5_mismatch | rwa_activation_state_malformed
rwa_activation_not_authoritative | rwa_activation_generation_stale
all other closed CN-6A lifecycle/activation failures       -> h2_activation_not_authoritative
```

Raw `err.code` is never exposed generically. Creation/submission precedence is exact:
input -> immutable configuration -> H1 authority -> CN-6A activation authority -> H2
authoring readiness -> open semantic/package state -> deadline -> row CAS.

## 4. Semantic replay and expiry

`semantic_request_hash` is the canonical lowercase `0x`-prefixed result of
`keccak256(abi.encode(...))` over this exact tuple:

```text
bytes32 keccak256("OMERTA_RWA_HEALTH_CLEARANCE_SEMANTIC_REQUEST_V2")
uint256 chainId
address registryAddress
address overlayAddress
address safeAddress
uint256 catalogVersion
bytes32 catalogSnapshotHash
bytes32 assetVersionKey
uint256 activationGeneration
uint256 activationBlockNumber
bytes32 activationBlockHash
bytes32 activationTransactionHash
uint256 activationLogIndex
bytes32 activationEvidenceHash
bytes32 activationReviewId
uint64 activationApprovedAt
uint64 activationValidUntil
uint64 activationIncludedAt
bytes32 episodeId
uint256 episodeGeneration
uint8 currentSeverity
uint64 stateSequence
bytes32 latestEpisodeEventId
bytes32 latestMaterialEventId
bytes32 latestMaterialEvidenceHash
bytes32 freshHealthyEvaluationId
bytes32 freshHealthyEvidenceHash
bytes32 recoveryEvidenceHash
bytes32 reviewerIdHash
uint256 nextOverlayGeneration
bool hasExpectedSafeNonce
uint256 expectedSafeNonceValue
```

For `expectedSafeNonce:null`, the final pair is `(false,0)`; for nonce `"0"` it is
`(true,0)`. Recovery enters only through `keccak256(decodedRecoveryBytes)`, never the
base64url text. The tuple includes every package-semantic H1/CN-6A/H2 fact and exact
immutable activation provenance, but excludes approval/deadline/calldata derived from
them and all liveness-only readiness timestamps, checkpoint/observation hashes, and
finalized horizons. Harmless readiness refreshes therefore do not change it.

There is at most one open package for `(registryAddress, assetVersionKey,
expectedOverlayGeneration)` where status is `safe_package_ready|safe_submitted`. Open-
status lookup only: an exact semantic hash returns that stored package; a different
hash conflicts. Terminal rows do not participate in the partial unique constraint or
semantic-replay lookup. After `approval_stale` or `finalized_rejected`, a later
attestation may use a new whole-second approval time and clearance ID if every current
authority check passes again, even when its semantic hash equals a terminal row.

`now >= clearanceDeadline` is authoritatively stale on every creation, submission,
operator read, and finalized-consumer path even if the stored status has not yet been
normalized. Add an idempotent bounded `expireRwaHealthClearancePackagesV2` domain
helper (maximum 100 rows per call), but do not schedule it. Stored-status normalization
is operational housekeeping; no expired package can authorize before it runs.

## 5. Finalized result and incident decisions

`rwa_health_overlay_event_results_v2` includes literal authorizing disposition
`applied`. Its H1 episode-event `evidence_hash` is exactly the event's
`recoveryEvidenceHash`; the H1 material event/evidence head remains unchanged.

When multiple nonstructural conditions disagree, use this deterministic precedence:

```text
attestation_missing
package_mismatch
reviewer_mismatch
activation_instance_missing
activation_provenance_unmatched
stale_registry_generation
expired
stale_h1_head
applied
```

The first five nonauthorizing outcomes insert an immutable
`rwa_health_overlay_incidents_v2` row with `authority_incident=true`, increment the
runtime unresolved count, and clear readiness. The three stale outcomes insert the
same immutable record with `authority_incident=false` and do not globally close
readiness. `inbox_id` is the incident primary key and an exact FK to the one canonical
event-result identity; `incident_id` is a deterministic unique hash of that identity
and disposition. Exact replay verifies the existing incident and never increments the
counter. The unresolved counter increments only when a new
`authority_incident=true` row is inserted, in the same transaction as the result and
checkpoint. Such insertion forces `ready_verified_at=NULL`. The successful apply
epilogue may populate readiness only when the locked unresolved count is zero. H2 adds
no incident-clear mutation; recovery/rebuild remains a separately reviewed operation.

## 6. Healthy-only sequence proof and work bound

The attestation binds the baseline healthy evaluation and H1 `stateSequence`. At
finalized apply, let `delta = current.stateSequence - attested.stateSequence`.
Query the same asset's applied evaluations strictly after the baseline `applied_at`,
ordered by `(applied_at,evaluation_id)`, retrieving at most 2,049 rows so the last row
is an overflow sentinel. Require:

- canonical nonnegative `delta <= 2048`;
- no sentinel and exactly `delta` later evaluations;
- each later evaluation is `healthy`, applied, and on the identical catalog snapshot;
- for `delta=0`, zero later rows and the locked current evaluation ID, evidence, and
  applied timestamp equal the attested baseline;
- for `delta>0`, the last later row is the exact locked H1 current evaluation and no
  row lies beyond that endpoint;
- the current episode/severity/material/event heads otherwise remain the attested
  values.

A reviewer/material/unknown/adverse change increments state without an admissible
healthy row and therefore fails the exact count/head proof. Two distinct evaluations
with one `applied_at`, the 2,049th sentinel, unexplained sequence movement, or a row
beyond the current endpoint fails closed as `stale_h1_head`; it never authorizes and
never creates a global incident.

## 7. Existing-database constraints

Appending `CREATE TABLE` statements is insufficient. A targeted, transactional,
idempotent migration must install and validate the applied-only composite foreign keys
from H1 episode/current/`h2_clearance` event tuples to
`rwa_health_finalized_clearances_v2`. Invalid legacy non-null clearance tuples fail
before the schema stamp. No generic column migration may silently omit these authority
constraints. `rwa_health_finalized_clearances_v2` admits only rows whose literal
`disposition='applied'` and exposes these exact named unique constraints:

```sql
CONSTRAINT uq_rwa_health_finalized_episode_v2 UNIQUE
  (clearance_id,registry_address,asset_version_key,episode_id,episode_generation,
   h1_clearance_generation,execution_block_number,execution_block_hash,finalized_applied_at),
CONSTRAINT uq_rwa_health_finalized_event_v2 UNIQUE
  (clearance_id,registry_address,asset_version_key,episode_id,episode_generation,
   h1_clearance_event_id,recovery_evidence_hash),
CONSTRAINT uq_rwa_health_finalized_current_v2 UNIQUE
  (clearance_id,registry_address,asset_version_key,episode_id,episode_generation,
   h1_clearance_generation,finalized_applied_at,h1_clearance_event_id)
```

The exact H1 constraints are:

```sql
ALTER TABLE rwa_health_episodes_v2
  ADD CONSTRAINT fk_rwa_health_episode_h2_clearance_v2 FOREIGN KEY
  (clearance_id,registry_address,asset_version_key,episode_id,generation,
   clearance_generation,clearance_block_number,clearance_block_hash,clearance_applied_at)
  REFERENCES rwa_health_finalized_clearances_v2
  (clearance_id,registry_address,asset_version_key,episode_id,episode_generation,
   h1_clearance_generation,execution_block_number,execution_block_hash,finalized_applied_at)
  ON DELETE RESTRICT;

ALTER TABLE rwa_health_episode_events_v2
  ADD CONSTRAINT fk_rwa_health_event_h2_clearance_v2 FOREIGN KEY
  (source_clearance_id,registry_address,asset_version_key,episode_id,
   episode_generation,event_id,evidence_hash)
  REFERENCES rwa_health_finalized_clearances_v2
  (clearance_id,registry_address,asset_version_key,episode_id,
   episode_generation,h1_clearance_event_id,recovery_evidence_hash)
  ON DELETE RESTRICT;

ALTER TABLE rwa_health_current_v2
  ADD CONSTRAINT fk_rwa_health_current_h2_clearance_v2 FOREIGN KEY
  (clearance_id,registry_address,asset_version_key,current_episode_id,
   current_episode_generation,clearance_generation,clearance_applied_at,
   latest_episode_event_id)
  REFERENCES rwa_health_finalized_clearances_v2
  (clearance_id,registry_address,asset_version_key,episode_id,
   episode_generation,h1_clearance_generation,finalized_applied_at,
   h1_clearance_event_id)
  ON DELETE RESTRICT;
```

Fresh schema installs the constraints directly. Existing-database migration compares
each exact `pg_get_constraintdef` and referenced column order, requires
`convalidated=true`, and rejects a name-only, drifted, or unvalidated match. Missing
constraints are added `NOT VALID`, all legacy rows are validated inside the same
transaction, then `VALIDATE CONSTRAINT` completes before the schema stamp. Rerun is an
exact no-op only when the named definitions and validation state match.
