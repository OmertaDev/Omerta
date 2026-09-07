# Registry V2, RWA Nominations, and Finalized Ballots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use
> `superpowers:subagent-driven-development` and execute this plan task by task.
> Every production behavior follows strict TDD: write the behavioral test, run it
> and preserve the expected RED evidence, then write the minimum production code.

**Goal:** Replace ticker-keyed approval semantics with an additive immutable
version registry and finalized mirror; add the founder-approved public family
nomination/review workflow; and make Commission ballots bind a finalized asset
version plus a maximum ETH budget frozen before voting.

**Architecture:** A new Safe-owned `StockTokenRegistryV2` is additive to the
legacy registry. It enforces deterministic identity, immutable history, active
uniqueness, exact seven-day activation TTL, and immutable closed ballot
publication. A finalized-chain reader mirrors complete version snapshots into
new v2 tables without mutating the ticker-unique legacy table. A focused
`rwanominations.js` domain module owns family cadence, support, expiry, reviewer
and Safe-proposal state. Commission v2 ballot tables snapshot a finalized
catalog and exact native-ETH maximum before the first vote; votes store version
keys and invalid candidates stop counting without changing the cutoff.

**Tech stack:** Solidity 0.8.26, Foundry 1.7.1, OpenZeppelin Contracts 5.6.1,
Node.js ESM, Fastify, PostgreSQL/pg-mem, viem, native `node:assert` test suites.

**Spec:** `docs/superpowers/specs/2026-08-26-grill-completion.md`, sections C,
N, and the C/N portions of U and X.

## Implementation and authority status — 2026-08-27

- Tasks 1–5 are implemented, independently approved, and dormant. Task 5's
  authenticated manual `maxEthWei` input remains preparation evidence only; it
  is not AcquisitionVault-backed production budget provenance.
- The shared FO Tasks 1–5 and the follow-on immutable `eventBlocks` timestamp
  evidence/fix are implemented, independently approved, and dormant.
- Task 6 below is a frozen future acceptance contract. Its registry lifecycle
  consumer, publisher, production worker wiring, H2 dependency, and
  AcquisitionVault budget bridge are not implemented by this plan state.
- No V2 addition here is production configured, deployed, Safe-executed,
  chain-finalized, funded, or active. `RWA_STOCK_PIPELINE` names a future explicit
  selector; no such selector exists in current production code.

## Global constraints

- Supported production chain ID is the repository-pinned `4663`.
- `assetVersionKey` is exactly
  `keccak256(abi.encode(uint256(chainId), keccak256(bytes(normalizedTicker)), token, robinhoodAssetIdHash))`.
- Ticker normalization is trim plus ASCII uppercase and then validation against
  `[A-Z0-9._-]{1,24}`. Solidity receives already-normalized text and rejects any
  lowercase, whitespace, non-ASCII, empty, or overlength value.
- Token amounts, catalog versions, block numbers, and wei values never cross
  JavaScript `Number`. Solidity uses `uint256`; PostgreSQL uses `NUMERIC(78,0)`;
  JavaScript/API uses canonical unsigned base-10 strings.
- An asset version's chain, ticker hash/text, token, provider ID hash, and token
  decimals never change. A changed identity is a new key and historical version.
- Active uniqueness is independent across ticker hash, token address, and
  provider ID hash. One activation atomically deactivates every distinct active
  conflict and activates the target, or reverts wholly.
- Safe activation calldata binds exact asset version, nonzero evidence hash,
  nonzero review ID, `approvedAt`, and exact `validUntil = approvedAt + 7 days`.
  Inclusion must satisfy `approvedAt <= block.timestamp < validUntil`.
- Provider HTTP observations and family nominations are evidence only. They
  never directly create a voteable candidate.
- Only a complete finalized-chain observation is mirrored. RPC work happens
  before the database transaction. Failed/partial sync keeps the last complete
  snapshot untouched.
- Production-configured but unsynchronized catalog is empty and fail-closed.
  The legacy static allowlist may remain only for explicitly chain-dormant local
  development and is never copied into v2 authoritative tables.
- One authorized RWA reviewer suffices. Reviewer authentication is separate from
  player JWT and the general moderator key.
- Nomination cadence is family-keyed: one new nomination in any rolling 168
  hours, immutable 30-day deadline, one current endorsement per other seated
  family, sponsor counts once, fixed threshold three.
- Duplicate open version-key submission returns the existing row and an explicit
  endorsement opportunity. It never inserts, silently endorses, or consumes the
  weekly sponsorship allowance.
- Commission vote rows store exact version keys. Before close, a version that is
  no longer voteable stops counting; the family may recast before the unchanged
  cutoff. Tie/silence may use the first still-valid snapshotted active candidate.
  No valid candidate creates a durable skipped result.
- The exact maximum ETH budget is frozen before a ballot opens and cannot change
  after any candidate/vote row exists. This plan prepares and records authority;
  it moves no ETH.
- Preserve legacy registry/catalog/ballot code and tables as migration inputs.
  Do not reinterpret their keys or rows in place.
- Use stable error codes, transaction-time seat/role checks, idempotent exact
  retries, bounded payloads, public hash-addressed evidence, and no secrets.

## State machines

### Asset activation lifecycle

`review_approved -> safe_package_ready -> safe_submitted -> executed_pending_finality -> synced_active`

Terminal/side states: `approval_stale`, `evidence_drift`, `safe_cancelled`,
`execution_failed`, `reorged`, `synced_inactive`. Only `synced_active` is voteable.

### Nomination lifecycle

`pending <-> review_requested -> under_review -> approved | rejected | not_eligible`

`pending | review_requested | under_review -> expired` at the immutable original
deadline. `approved` remains non-voteable until the asset activation lifecycle
reaches `synced_active`.

### Ballot lifecycle

`unopened -> open -> closed_ready -> publisher_submitted -> published_pending_finality -> finalized`

Fail-closed terminal results are `skipped_catalog_empty`,
`skipped_no_valid_candidate`, and later acquisition-domain skip reasons. A
skipped day never publishes a ballot or authorizes a purchase.

## Shared interfaces frozen by this plan

### Solidity asset and ballot interface

```solidity
interface IStockTokenRegistryV2 {
    struct Activation {
        address token;
        bytes32 robinhoodAssetIdHash;
        string ticker;
        string name;
        uint8 tokenDecimals;
        bytes32 evidenceHash;
        bytes32 reviewId;
        uint64 approvedAt;
        uint64 validUntil;
    }

    struct AssetVersion {
        uint256 chainId;
        bytes32 tickerHash;
        address token;
        bytes32 robinhoodAssetIdHash;
        string ticker;
        string name;
        uint8 tokenDecimals;
        bool active;
        uint64 registeredAt;
        uint64 activatedAt;
        uint64 deactivatedAt;
    }

    struct Ballot {
        bytes32 assetVersionKey;
        address token;
        uint8 tokenDecimals;
        bytes32 tallyHash;
        uint256 catalogVersion;
        uint256 maxEthWei;
        uint64 purchaseUntil;
        uint64 publishedAt;
    }

    function assetVersionKey(
        string memory normalizedTicker,
        address token,
        bytes32 robinhoodAssetIdHash
    ) external view returns (bytes32);
    function activateVersion(Activation calldata activation) external returns (bytes32 versionKey);
    function deactivateVersion(bytes32 versionKey, bytes32 reasonHash) external;
    function publishBallot(
        uint256 day,
        bytes32 versionKey,
        bytes32 tallyHash,
        uint256 catalogVersion,
        uint256 maxEthWei,
        uint64 purchaseUntil
    ) external;
    function resolveBallot(uint256 day)
        external
        view
        returns (
            bytes32 versionKey,
            address token,
            uint8 tokenDecimals,
            bytes32 tallyHash,
            uint256 catalogVersion,
            uint256 maxEthWei,
            uint64 purchaseUntil,
            bool active
        );

    function activationGeneration(bytes32 versionKey) external view returns (uint256);
    function ballotActivationGeneration(uint256 day) external view returns (uint256);
}
```

Every successful activation advances the version's monotonic activation
generation. Publication snapshots that generation separately from the frozen
`Ballot` fields and rejects a version whose current activation occurred at or
after `(day + 1) * 1 days`. `resolveBallot(...).active` requires the exact
snapshotted generation as well as all three active reverse heads. A winner that
is deactivated after close can therefore never regain purchase authority after
same-key reactivation.

### Finalized catalog read model

```js
{
  source: 'robinhood_chain_registry_v2',
  finality: 'finalized',
  chainId: '4663',
  registryAddress: '0x...',
  catalogVersion: '12',
  finalizedBlockNumber: '123456',
  finalizedBlockHash: '0x...',
  syncedAt: 'ISO-8601',
  snapshotHash: '0x...',
  voteable: true,
  stale: false,
  assets: [{
    assetVersionKey: '0x...', tickerHash: '0x...', ticker: 'AAPL', name: '...',
    tokenAddress: '0x...', tokenDecimals: 18,
    robinhoodAssetIdHash: '0x...', registryIndex: '0', active: true
  }],
  activeAssets: [/* current finalized active projection; empty while stale */]
}
```

### Nomination public statuses

`pending`, `review_requested`, `under_review`, `approved`, `rejected`,
`not_eligible`, `expired`.

Activation execution statuses are separate:
`not_applicable`, `safe_package_ready`, `safe_submitted`,
`executed_pending_finality`, `synced_active`, `approval_stale`,
`evidence_drift`, `safe_cancelled`, `execution_failed`, `reorged`.

## File structure

- `omerta-contracts/src/interfaces/IStockTokenRegistryV2.sol` — frozen consumer ABI.
- `omerta-contracts/src/StockTokenRegistryV2.sol` — additive immutable version registry and ballot publisher.
- `omerta-contracts/test/StockTokenRegistryV2.t.sol` — focused contract unit/fuzz tests.
- `omerta-contracts/test/StockTokenRegistryV2Invariant.t.sol` — active uniqueness/history invariants.
- `src/stockcatalogv2.js` — deterministic keys, Safe packages, finalized mirror, public read model.
- `tools/robinhood-stock-catalog-v2.js` — unsigned v2 proposal/export CLI.
- `test/stockcatalogv2.js` — mirror, key, package, finality, and failure-atomicity tests.
- `src/rwanominations.js` — nomination/support/review domain state machine.
- `test/rwanominations.js` — domain/concurrency/expiry tests.
- `src/routes/rwa.js` — thin public/player/reviewer route registration.
- `test/rwaroutes.js` — authentication, validation, stable error, and response tests.
- `src/commission.js` — consume v2 catalog for exact-version ballots while retaining legacy functions during migration.
- `src/rwastockkeeper.js` — v2 exact-version ballot publication and finality observation seam.
- `src/worker.js` — bounded calls into v2 sync/expiry/publication functions; no new domain logic.
- `src/server.js` — one `registerRwa` integration call and v2 ticker route switch.
- `schema.sql` — additive `rwa_*_v2`/`stock_*_v2` tables; no legacy semantic mutation.
- `test/commission.js` — exact-version/frozen-budget ballot behavior.
- `test/stockballotv2.js` — publication/finality/skipped-day behavior.
- `package.json` — focused tests in the full suite plus `stock-catalog-v2` script.

---

### Task 1: Additive Immutable `StockTokenRegistryV2`

**Files:**

- Create: `omerta-contracts/src/interfaces/IStockTokenRegistryV2.sol`
- Create: `omerta-contracts/src/StockTokenRegistryV2.sol`
- Create: `omerta-contracts/test/StockTokenRegistryV2.t.sol`
- Create: `omerta-contracts/test/StockTokenRegistryV2Invariant.t.sol`

**Consumes:** OpenZeppelin `Ownable2Step`, `Ownable`, `IERC20Metadata`; owner is
the Safe and publisher is a separately configured address or zero.

**Produces:** the frozen Solidity interface above plus:

```solidity
function supportedChainId() external view returns (uint256);
function publisher() external view returns (address);
function catalogVersion() external view returns (uint256);
function activationGeneration(bytes32 versionKey) external view returns (uint256);
function ballotActivationGeneration(uint256 day) external view returns (uint256);
function versionCount() external view returns (uint256);
function versionKeyAt(uint256 index) external view returns (bytes32);
function getVersion(bytes32 versionKey) external view returns (AssetVersion memory);
function activeVersionForTickerHash(bytes32 tickerHash) external view returns (bytes32);
function activeVersionForToken(address token) external view returns (bytes32);
function activeVersionForProviderIdHash(bytes32 providerIdHash) external view returns (bytes32);
function setPublisher(address publisher_) external;
function getBallot(uint256 day) external view returns (Ballot memory);
```

- [x] **Step 1: Write contract tests first and record the production mutation each catches**

Tests use a real 18-decimal mock ERC-20 and literal expected hashes independently
calculated with `keccak256(abi.encode(...))`. Cover:

1. constructor pins chain/owner/publisher and starts with zero versions/catalog version;
2. key includes chain, normalized ticker hash, token, and provider hash;
3. lowercase/whitespace/non-ASCII/empty/overlength ticker is rejected;
4. zero/non-contract token, empty provider/evidence/review/name, wrong decimals are rejected;
5. TTL must be exactly seven days and execution is valid at `validUntil-1` but stale at `validUntil`;
6. first activation registers one immutable enumerable version and increments catalog version once;
7. reactivation of the same inactive identity does not duplicate history;
8. changed token/provider/ticker produces a different version rather than overwriting history;
9. activating a version that conflicts by ticker, token, and provider deactivates every distinct old active version atomically;
10. active reverse heads all point to the target and inactive history remains readable;
11. unauthorized activation/deactivation/publisher change and publisher ballot calls revert;
12. deactivation requires a nonzero reason and clears all heads without deleting history;
13. publisher can publish only a prior UTC day, only once, and only an active version;
14. ballot snapshots exact key/token/decimals/tally/catalog version and never redirects after deactivation;
15. empty catalog is representable and no ballot can be published;
16. ownership remains two-step and zero publisher disables publication.

The stateful invariant handler activates/reactivates/deactivates a bounded pool
of at least six real mock tokens and asserts after every call:

- at most one active version for any ticker hash/token/provider hash;
- every nonzero active head points to an active enumerable version with the same dimension;
- no historical key disappears or changes immutable fields;
- `catalogVersion` increases exactly once for every successful activation or deactivation and never on revert;
- a published ballot's key/token/decimals/tally/catalog values never change.

- [x] **Step 2: Run the focused suites and preserve expected RED**

```powershell
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/StockTokenRegistryV2*.t.sol' -vv
```

Expected RED: compilation fails because the v2 interface/contract and required
selectors do not exist. Fix test syntax only until the failure names the missing
production feature.

- [x] **Step 3: Implement minimum secure contract**

Use custom errors and complete events. Store every key once in `_versionKeys`.
On first registration, read `IERC20Metadata(token).decimals()` and require it
equals the supplied `tokenDecimals`; on reactivation require every immutable
field including name and decimals matches the existing record. Deactivate the
union of the three current active heads without double-processing the same key,
then activate target and increment `catalogVersion` once for the whole atomic
activation. Explicit deactivation increments once only when state changes.

`resolveBallot` returns the snapshotted token/decimals and a live `active` value
that is true only when the exact version remains active and all three reverse
heads still point to it.

- [x] **Step 4: Run GREEN, full contract baseline, size, and self-review**

```powershell
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/StockTokenRegistryV2*.t.sol' -vv
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' build --sizes
```

Commit only Task 1 files and include RED/GREEN output, invariant run count, and
runtime size in the report.

---

### Task 2: Deterministic V2 Tooling and Finalized Catalog Mirror

**Files:**

- Create: `src/stockcatalogv2.js`
- Create: `tools/robinhood-stock-catalog-v2.js`
- Create: `test/stockcatalogv2.js`
- Modify: `schema.sql`
- Modify: `package.json`

**Consumes:** Task 1 ABI and legacy pure RHJ parsers/top-15 selector from
`src/stockcatalog.js`.

**Produces:**

```js
computeStockAssetVersionKey({ chainId, ticker, tokenAddress, robinhoodAssetIdHash })
buildStockTokenActivationV2({ asset, registryAddress, evidenceHash, reviewId, approvedAt })
buildStockTokenDeactivationV2({ assetVersionKey, registryAddress, reasonHash })
syncFinalizedStockCatalogV2(pool)
approvedStockTokenCatalogV2(db)
stockTokenRegistryV2ReaderConfigured()
stockTokenCatalogV2Ready(db)
__setStockTokenRegistryV2Reader(fn)
```

`buildStockTokenActivationV2` returns one Safe Transaction Builder-compatible
call to `activateVersion`; it computes `validUntil = approvedAt + 604800`
seconds and exposes all human-readable fields beside calldata. It never sends.

The injected/real reader returns one complete object:

```js
{
  source: 'robinhood_chain_registry_v2',
  finality: 'finalized',
  chainId: '4663',
  registryAddress,
  catalogVersion: '12',
  finalizedBlockNumber: '123456',
  finalizedBlockHash,
  observedAt,
  activeHeads: {
    tickerHash: [/* exact dimension/key pairs */],
    tokenAddress: [/* exact dimension/key pairs */],
    robinhoodAssetIdHash: [/* exact dimension/key pairs */]
  },
  assets: [/* all historical AssetVersion rows in registry order */]
}
```

The real reader obtains one finalized block and pins every registry getter to
that exact block number. After every version and reverse-head getter completes,
it re-reads that numbered block and rejects a same-height hash change. Literal
`finality: 'finalized'` and the complete reverse-head proof are mandatory;
latest-block or confirmation-count fallbacks are rejected.

`snapshotHash` is the v1 hash
`keccak256(abi.encode(chainId, registryAddress, catalogVersion,
finalizedBlockNumber, finalizedBlockHash, normalizedHistoricalAssetTupleArray))`.
The array is in exact registry-index order. Each tuple includes key, chain,
ticker hash/text, name, token, decimals, provider hash, index, active flag, and
all three lifecycle timestamps. `sync_id` equals this snapshot hash;
`observedAt`/`syncedAt` are excluded.

**Additive schema:**

```sql
CREATE TABLE IF NOT EXISTS stock_catalog_sync_lock_v2 (
  id INT PRIMARY KEY
);
INSERT INTO stock_catalog_sync_lock_v2 (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS stock_catalog_sync_state_v2 (
  id INT PRIMARY KEY,
  chain_id INT NOT NULL,
  registry_address TEXT NOT NULL,
  catalog_version NUMERIC(78,0) NOT NULL,
  finalized_block_number NUMERIC(78,0) NOT NULL,
  finalized_block_hash TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_asset_versions_v2 (
  asset_version_key TEXT PRIMARY KEY,
  chain_id INT NOT NULL,
  ticker_hash TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_decimals INT NOT NULL,
  robinhood_asset_id_hash TEXT NOT NULL,
  registry_index NUMERIC(78,0) NOT NULL,
  active BOOLEAN NOT NULL,
  registered_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  last_catalog_version NUMERIC(78,0) NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_asset_active_heads_v2 (
  dimension_type TEXT NOT NULL,
  dimension_value TEXT NOT NULL,
  asset_version_key TEXT NOT NULL,
  PRIMARY KEY (dimension_type, dimension_value),
  UNIQUE (dimension_type, asset_version_key)
);

CREATE TABLE IF NOT EXISTS stock_catalog_sync_runs_v2 (
  sync_id TEXT PRIMARY KEY,
  chain_id INT NOT NULL,
  registry_address TEXT NOT NULL,
  catalog_version NUMERIC(78,0) NOT NULL,
  finalized_block_number NUMERIC(78,0) NOT NULL,
  finalized_block_hash TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  asset_count INT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_catalog_evidence_v2 (
  evidence_hash TEXT PRIMARY KEY,
  asset_version_key TEXT NOT NULL,
  evidence_uri TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Every sync unconditionally locks the seeded row before reading singleton state,
including the first sync. An unchanged `catalogVersion` freezes the complete
ordered history, lifecycle state, active flags, and reverse heads; only finalized
block identity and freshness may advance. All observation/lifecycle timestamps
must be nonzero where required, coherent, and within the shared PostgreSQL/
JavaScript supported epoch before any database connection.

`approvedStockTokenCatalogV2(db)` reads singleton state, the PostgreSQL clock,
and ordered history on one dedicated connection in one read-only repeatable-read
transaction. PostgreSQL computes the strict stale predicate as
`now() > synced_at + interval '600 seconds'`; exactly 600 seconds remains fresh.
`stockTokenRegistryV2ReaderConfigured()` is the worker/test-reader predicate.
The public `stockTokenCatalogV2Ready(db)` is stricter: before any database read,
it requires one normalized production configuration consisting of an absolute
HTTP(S) RPC URL and canonical nonzero V2 registry address; then the coherent
snapshot must be synchronized, nonempty, fresh/voteable, and from that exact
configured registry. Injected readers cannot weaken public readiness. The same
normalized configuration is consumed by the default reader and observation
validation, so configured/ready state cannot disagree with synchronization.

- [x] **Step 1: Write RED tests**

Cover hand-derived ABI key equality with Task 1, uppercase normalization,
rejection of malformed base-10/address/hash/decimals values, exact TTL calldata,
no duplicate selection, retained top-15 semantics, complete finalized snapshot
commit, current active heads for all three dimensions, multiple historical rows
sharing inactive fields, gap/duplicate/head-conflict rejection, wrong chain or
non-finalized/malformed reader rejection, last-known-good preservation after
read or validation failure, monotonic catalog/block rejection, idempotent exact
same snapshot, fail-closed empty/unsynchronized production catalog, and a
greater-than-ten-minute critical-mirror age that retains auditable history but
sets `stale:true`, `voteable:false`, and returns no `activeAssets`.

Mutation targets: replacing `encodeAbiParameters` with packed encoding, coercing
catalog version/block to `Number`, deleting inactive rows, writing before full
validation, clearing last known state on RPC failure, or accepting two active
heads for one dimension must each break a named test.

- [x] **Step 2: Run RED**

```powershell
node test/stockcatalogv2.js
```

Expected: module/schema/functions are missing. Preserve the exact expected
failure before implementation.

- [x] **Step 3: Implement mirror and CLI**

Use `viem.encodeAbiParameters` plus `keccak256`, never packed encoding. Validate
the full observation and independently recompute every key before `BEGIN`.
Inside one transaction, upsert all historical rows, mark observed state exactly,
rebuild the three-dimension active-head table, insert a deterministic sync-run
row, and update singleton state last. Any error rolls back. Do not delete legacy
tables or v2 historical versions.

Use a distinct `STOCK_TOKEN_REGISTRY_V2_ADDRESS`; never reinterpret the legacy
registry address. Public reads return all ordered history plus `activeAssets`
and explicit `voteable/stale`. Reader uint64 timestamps remain canonical decimal
seconds through JavaScript and are converted by parameterized SQL, never a
JavaScript `Number`. `stock_catalog_evidence_v2` is intentionally not written
in Task 2 because the getter snapshot has no finalized activation-event evidence
provenance; Tasks 4 and 6 own that evidence lifecycle.

The CLI supports explicit `--activate`, `--deactivate-key`, `--evidence-hash`,
`--review-id`, `--approved-at`, `--registry`, and existing
`--initial-top-volume`. It prints JSON only; it never reads a wallet or sends.

- [x] **Step 4: Run GREEN and relevant baseline**

```powershell
node test/stockcatalogv2.js
node test/stockcatalog.js
node test/chainparams.js
```

Commit Task 2 files and report RED/GREEN plus a literal sample key independently
matched to the Solidity test vector.

---

### Task 3: Family Nomination and Support Domain State Machine

**Files:**

- Create: `src/rwanominations.js`
- Create: `test/rwanominations.js`
- Modify: `schema.sql`
- Modify: `package.json`

**Consumes:** `computeStockAssetVersionKey`, Task 2 v2 catalog read model, and
`seatedGangs` from `src/commission.js`.

**Produces:** domain functions only; HTTP registration is Task 4.

```js
createRwaNomination(ch, input, client, h)
setRwaNominationEndorsement(ch, nominationId, input, client, h)
renewRwaNominationSponsorSupport(ch, nominationId, client, h)
refreshRwaNominationSeatState(db)
expireRwaNominations(db)
rwaNominationBoard(db, { limit, cursor, finalizedOnly })
claimRwaNominationReview(db, nominationId, reviewer)
disposeRwaNominationReview(db, nominationId, reviewer, disposition)
```

`disposeRwaNominationReview` in this task records only the terminal review fact;
Task 4 builds/persists the exact Safe package for `approved`.

A nomination may introduce a newly discovered provider asset before it exists
in the finalized registry mirror; otherwise nomination-to-activation would be
circular. It must persist the full immutable candidate identity and evidence,
independently recompute the V2 key, and use the mirror only for contextual
conflict/board data.

**Additive schema:**

```sql
CREATE TABLE IF NOT EXISTS rwa_nominations_v2 (
  id TEXT PRIMARY KEY,
  asset_version_key TEXT NOT NULL,
  chain_id INT NOT NULL,
  ticker TEXT NOT NULL,
  ticker_hash TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_decimals INT NOT NULL,
  robinhood_asset_id_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  sponsor_family_id TEXT NOT NULL,
  sponsor_account_id TEXT NOT NULL,
  sponsor_support_active BOOLEAN NOT NULL DEFAULT true,
  rationale TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  evidence_uri TEXT,
  prior_nomination_id TEXT,
  status TEXT NOT NULL,
  execution_status TEXT NOT NULL DEFAULT 'not_applicable',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pending_until TIMESTAMPTZ NOT NULL,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  disposition_by TEXT,
  disposition_at TIMESTAMPTZ,
  disposition_reason TEXT,
  approved_at TIMESTAMPTZ,
  valid_until TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_rwa_nominations_open_key_v2
  ON rwa_nominations_v2(asset_version_key)
  WHERE status IN ('pending','review_requested','under_review');

CREATE TABLE IF NOT EXISTS rwa_nomination_endorsements_v2 (
  nomination_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  active BOOLEAN NOT NULL,
  rationale TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (nomination_id, family_id)
);

CREATE TABLE IF NOT EXISTS rwa_nomination_events_v2 (
  event_id TEXT PRIMARY KEY,
  nomination_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  family_id TEXT,
  account_id TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  details_hash TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rwa_nomination_reviewer_state_v2 (
  id INT PRIMARY KEY,
  reviewer_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

If pg-mem does not support the partial unique index, preserve the PostgreSQL
index in schema and use a test adapter or an additional open-key lock table; do
not weaken production race safety.

Concurrent same-key creation uses `INSERT ... ON CONFLICT DO NOTHING RETURNING`
without a conflict target, followed by a same-transaction read of the existing
open nomination when no row was inserted. The loser creates no implicit
endorsement and consumes no cadence. Domain scans/workers use an optional
bounded options object: default limit 100, hard maximum 500, stable cursor,
`hasMore`, and next cursor; they never scan all history in one tick.

The reviewer-state DDL is forward-compatible only in Task 3. Task 3 accepts a
nonempty opaque reviewer identity for atomic claim ownership but does not seed
or treat the table as authentication authority; Task 4 owns that perimeter.
All standing mutations take a post-lock database wall-clock reading equivalent
to `clock_timestamp()`: exactly 168 hours permits a fresh family nomination,
and at or after immutable `pending_until`, expiry wins before endorsement,
renewal, claim, or disposition.

- [x] **Step 1: Write RED domain tests**

Cover boss/underboss and current-seat requirements, exact version-key
recomputation, bounded rationale/evidence URI, 168-hour rolling cooldown,
immutable sponsor/deadline, duplicate redirect without insert/cooldown/implicit
support, same ticker/different key coexistence, sponsor cannot endorse itself,
one mutable slot per other family, transaction-time seat loss, historical event
retention, sponsor support disabled after observed seat loss and requiring
explicit renewal after reseating, fixed three-family threshold, support fall
demotion before claim, stable queue order, manual below-threshold claim, no
demotion after claim, hard expiry in all nonterminal states, and terminal review
remaining terminal after deadline.

Include a concurrency test with two simultaneous same-key submissions proving
one row and no cooldown consumption for the loser. Include an expiry-versus-
endorsement race proving expiry wins at the boundary.

- [x] **Step 2: Run RED**

```powershell
node test/rwanominations.js
```

- [x] **Step 3: Implement minimal domain model**

All writes run inside their existing transaction/client and re-read seats and
current nomination state immediately before mutation. Use UTC database time for
deadlines. Keep append-only events separate from current endorsement slots.
Board/refresh detects sponsor seat loss and permanently clears
`sponsor_support_active`; current reseating alone does not set it. Explicit
renewal requires the currently seated original sponsor's boss/underboss.

Compute current support from current seats, sponsor state, and active current
endorsements; never trust a cached support integer as authority.

- [x] **Step 4: Run GREEN and Commission baseline**

```powershell
node test/rwanominations.js
node test/commission.js
```

Commit Task 3 files.

---

### Task 4: Public Nomination Routes, Single Reviewer, and Exact Safe Packages

**Files:**

- Create: `src/routes/rwa.js`
- Create: `test/rwaroutes.js`
- Modify: `src/server.js`
- Modify: `schema.sql`
- Modify: `package.json`

**Consumes:** Tasks 2–3 functions and the existing player `auth`/character lock.

**Reviewer authentication:** require both `RWA_REVIEWER_KEY` and
`RWA_REVIEWER_ID`. The caller sends `X-Rwa-Reviewer-Key`; compare the key with a
timing-safe equality over equal-length byte buffers. Never log/store/return the
key. No fallback to `MOD_KEY`. Reviewer ID is the configured public identity and
exactly one row may be active.

**Routes:**

```text
GET  /v1/rwa/nominations
POST /v1/rwa/nominations
POST /v1/rwa/nominations/:id/endorsement
POST /v1/rwa/nominations/:id/sponsor-renewal
POST /v1/rwa/reviewer/nominations/:id/claim
POST /v1/rwa/reviewer/nominations/:id/disposition
GET  /v1/rwa/reviewer/queue
```

Player create body contains exact discovered identity plus rationale,
`evidenceHash`, optional HTTPS/IPFS `evidenceUri`, and no active/approval flag.
Endorsement body is `{ active: boolean, rationale?: string }`. Disposition body
is `{ disposition: 'approved'|'rejected'|'not_eligible', reason, evidenceHash }`.

For `approved`, in the same transaction:

1. verify review is unexpired and claimed by configured reviewer;
2. compute `approvedAt` from database time and `validUntil = +7 days`;
3. build Task 2 exact v2 activation Safe call;
4. persist immutable package JSON, calldata hash, evidence hash, review ID,
   approved/valid times, and `safe_package_ready`;
5. close the nomination review state.

Add table:

```sql
CREATE TABLE IF NOT EXISTS rwa_nomination_safe_proposals_v2 (
  nomination_id TEXT PRIMARY KEY,
  asset_version_key TEXT NOT NULL,
  registry_address TEXT NOT NULL,
  safe_transaction JSONB NOT NULL,
  calldata_hash TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  review_id TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  safe_tx_hash TEXT,
  execution_tx_hash TEXT,
  execution_block_number NUMERIC(78,0),
  execution_block_hash TEXT,
  finalized_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [x] **Step 1: Write RED route tests**

Use the real Fastify server/test DB. Cover keyless public board, player auth,
boss/seat errors, request/body bounds, stable codes, duplicate response with
explicit endorsement action, reviewer disabled when either env var is absent,
bad/malformed key, general mod key rejection, one reviewer identity, claim and
terminal disposition permissions, exact approval package/TTL/calldata, deadline
race rollback, no package for rejection/not-eligible, no secret in responses or
events, and public separation of review versus execution/sync status.

- [x] **Step 2: Run RED**

```powershell
node test/rwaroutes.js
```

- [x] **Step 3: Implement thin routes and reviewer boundary**

Put business logic in `rwanominations.js`; `server.js` adds only
`registerRwa(app, { pool, auth, withCharacter: G.withCharacter })`. Apply a
bounded per-key/per-account route rate limit where the repository supports it;
database uniqueness/cadence remains the authoritative anti-spam wall.

Add functions to update proposal lifecycle only from finalized Task 2 mirror
evidence. A submitted tx hash alone never marks active. `expireRwaApprovals`
sets `approval_stale` at `validUntil` without changing terminal nomination
status.

- [x] **Step 4: Run GREEN and auth/routes baselines**

```powershell
node test/rwaroutes.js
node test/auth.js
node test/routes.js
node test/commission.js
```

Commit Task 4 files.

---

### Task 5: Version-Snapshot Commission Ballot and Frozen Maximum Budget

**Files:**

- Create: `test/stockballotv2.js`
- Modify: `src/commission.js`
- Modify: `src/routes/rwa.js`
- Modify: `src/server.js`
- Modify: `schema.sql`
- Modify: `test/commission.js`
- Modify: `package.json`

**Consumes:** Task 2 finalized catalog; legacy decree/seat ranking behavior stays
unchanged.

**Produces:**

```js
openTickerBallotV2(db, { day, maxEthWei, detailsHash, actorId })
castTickerVoteV2(ch, selection, client, h)
tallyTickerBallotV2(db, day)
closeTickerBallotV2(db, day)
tickerBallotBoardV2(db)
```

**Additive schema:**

```sql
CREATE TABLE IF NOT EXISTS ticker_ballot_days_v2 (
  day INT PRIMARY KEY,
  state TEXT NOT NULL,
  catalog_version NUMERIC(78,0) NOT NULL,
  catalog_snapshot_hash TEXT NOT NULL,
  max_eth_wei NUMERIC(78,0) NOT NULL,
  opened_by TEXT NOT NULL,
  open_details_hash TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  purchase_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ticker_ballot_candidates_v2 (
  day INT NOT NULL,
  asset_version_key TEXT NOT NULL,
  ticker TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_decimals INT NOT NULL,
  registry_index NUMERIC(78,0) NOT NULL,
  PRIMARY KEY (day, asset_version_key)
);

CREATE TABLE IF NOT EXISTS commission_ticker_votes_v2 (
  day INT NOT NULL,
  family_id TEXT NOT NULL,
  asset_version_key TEXT NOT NULL,
  ticker TEXT NOT NULL,
  standing NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, family_id)
);

CREATE TABLE IF NOT EXISTS ticker_ballot_results_v2 (
  day INT PRIMARY KEY,
  status TEXT NOT NULL,
  asset_version_key TEXT,
  ticker TEXT,
  token_address TEXT,
  token_decimals INT,
  catalog_version NUMERIC(78,0) NOT NULL,
  max_eth_wei NUMERIC(78,0) NOT NULL,
  votes INT NOT NULL DEFAULT 0,
  weighted INT NOT NULL DEFAULT 0,
  decided_by TEXT NOT NULL,
  skip_reason TEXT,
  tally_hash TEXT NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL,
  purchase_until TIMESTAMPTZ,
  publication_status TEXT NOT NULL DEFAULT 'not_submitted',
  registry_tx_hash TEXT,
  finalized_block_number NUMERIC(78,0),
  finalized_block_hash TEXT,
  finalized_at TIMESTAMPTZ
);
```

Opening is an authenticated operational database action exposed at
`POST /v1/rwa/ballots/:day/open` behind the existing mod boundary for this
slice. It moves no funds and cannot claim Safe execution. Body values are
`maxEthWei` canonical positive decimal string and nonzero `detailsHash`.
Opening current/future day snapshots every currently finalized active v2 asset
and exact catalog version/hash. Exact idempotent retry succeeds; changed retry
fails. Once opened, budget/candidates never change.

The V2 board/cast domain is implemented and tested but remains dormant. Current
production `/v1/commission/ticker` still calls the legacy board/cast directly.
A later explicit cutover node must introduce and test the future selector before
switching that route; there is no `RWA_STOCK_PIPELINE` implementation today. At
that future cutover, temporary client compatibility may accept either exact
`assetVersionKey` or a ticker that resolves to exactly one snapshotted candidate;
storage is always the key.

- [x] **Step 1: Write RED tests**

Cover positive canonical wei validation without `Number`, open-before-vote,
exact retry, changed retry rejection, no candidate mutation after open, one
family vote/change, exact standing ranking, candidate selection by key,
compatibility ticker resolution, no-seat/rank errors, current active-version
validation on each cast, deactivated vote exclusion from live board/tally,
recast, unchanged close time, tie/silence active default, no-valid-candidate
durable skip, empty-catalog durable skip, exact two-hour `purchaseUntil`, exact
budget/key/token/decimals snapshot, deterministic hand-derived tally hash, and
one immutable result under concurrent close.

Tally hash canonical input is a JSON-free ABI-like byte encoding implemented
identically in one pure helper and independently asserted with literal vectors:
chain ID, day, catalog version, budget, sorted valid vote tuples
`(familyIdHash,assetVersionKey,standing,weight)`, decided-by code, and result key
or zero. Do not hash mutable display names.

- [x] **Step 2: Run RED**

```powershell
node test/stockballotv2.js
node test/commission.js
```

- [x] **Step 3: Implement ballot v2**

Keep legacy exported functions for legacy tests/migration, but route new traffic
through explicit v2 functions. Current voteability requires candidate snapshot
membership plus current Task 2 active head equality. Invalid votes remain public
with `valid:false` and exclusion reason but do not contribute weight.

At close, if no valid vote winner exists, choose first still-valid candidate by
frozen `registry_index`, then key. If none exists, write skipped result. Close
uses one transaction and a primary-key race; it never extends/reopens.

- [x] **Step 4: Run GREEN and full Commission/catalog baseline**

```powershell
node test/stockballotv2.js
node test/commission.js
node test/stockcatalogv2.js
node test/stockcatalog.js
node test/client.js
```

Commit Task 5 files.

---

### Tasks 6A/6B: Registry Lifecycle Consumer and Dormant Publisher (split authority)

The historical combined Task 6 below is superseded as an executable unit by the
dependency-cycle split frozen on 2026-08-28:

- **Task 6A / CN-6A** is normative in
  `docs/superpowers/plans/2026-08-28-rwa-registry-lifecycle-cn6a.md`. It produces only
  the read-only one-cursor finalized Registry lifecycle/generation consumer, its exact
  H2 activation-authority seam, migrations, and tests. It consumes FO and Task 5; it
  has no publisher, worker schedule, signer, sender, Safe package, funds, or cutover.
- **Task 6B / CN-6B** runs later, only after H2 and the AcquisitionVault-backed budget
  bridge. It owns `publishResolvedStockBallotV2`, the exact unsigned/signed-byte
  persistence and dormant worker/cutover integration described below, and consumes
  CN-6A's projection. It must reuse CN-6A's single scanner, checkpoint, inbox, reducer,
  event-time evidence, and readiness; it may not add another Registry cursor.

The remaining combined text is retained as a requirement ledger, not permission to
implement both halves together. Every lifecycle/finality/reducer/helper clause maps to
CN-6A; every publish, transaction-byte, worker, or cutover clause maps to CN-6B. Any
conflict is resolved in favor of the dedicated CN-6A plan, H2 plan, umbrella DAG, and
this split.

#### Historical combined Task 6 requirement ledger

**Files:**

- Modify: `schema.sql`
- Modify: `src/db.js`
- Modify: `src/rwastockkeeper.js`
- Modify: `src/stockcatalogv2.js`
- Modify: `src/rwanominations.js`
- Modify: `src/commission.js`
- Create: `src/rwaregistrylifecycle.js`
- Modify: `src/worker.js`
- Modify: `test/stockballotv2.js`
- Modify: `test/stockcatalogv2.js`
- Modify: `test/rwanominations.js`
- Create: `test/rwaregistrylifecycle.js`
- Create: `test/rwaregistrylifecycle.postgres.js`
- Modify: `test/migrate.js`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Consumes:** Task 1 `publishBallot`, Task 5 ready result, the independently
approved shared finalized-observation kernel, and Task 2's pure registry getter/
snapshot validation logic. It does not implement another finalized-head reader,
log scanner, cursor, or reorg detector. H2 readiness and AcquisitionVault-backed
pre-vote budget provenance are mandatory gates before publisher reachability;
Task 6 may be developed dormant before those dependencies but cannot activate or
cut over without them.

**Produces:**

```js
publishResolvedStockBallotV2(pool)
syncFinalizedRwaRegistryLifecycle(pool)
applyFinalizedRwaActivationEvents(client, decodedBatch)
applyFinalizedRwaBallotEvents(client, decodedBatch)
```

The publisher accepts no ticker/token/budget from a caller. It reads the one
closed-ready result, verifies current exact active version and unchanged frozen
catalog/result, computes the on-chain call from stored key/tally/catalog version,
and is dormant until the required H2 and budget gates pass. Before the first
broadcast, it must persist the exact signed transaction bytes and their canonical
hash. Every retry may rebroadcast only those identical bytes; a lease must never
re-sign or construct a replacement transaction. No production signer,
broadcaster, address, or worker reachability is supplied by this plan state.
Skipped results are terminal and never submitted. If the immutable purchase
window elapses before publication,
`purchase_window_elapsed_before_publication` is terminal with no extension,
reopening, runner-up, or replacement winner.

`syncFinalizedRwaRegistryLifecycle(pool)` is the sole registry-lifecycle FO
coordinator. It observes all five ordered RegistryV2 topics—`PublisherSet`,
`AssetVersionRegistered`, `AssetVersionActivated`,
`AssetVersionDeactivated`, and `BallotPublished`—under one registry identity,
cursor, `rwa_registry_lifecycle_lock_v2`,
`rwa_registry_lifecycle_checkpoint_v2`, raw-plus-decoded
`rwa_registry_lifecycle_inbox_v2`, reducer, and atomic commit.
`applyFinalizedRwaActivationEvents` and `applyFinalizedRwaBallotEvents` are
transition helpers beneath that one adapter and transaction. They use only the
supplied query client and never connect, begin, commit, roll back, release,
retry, or perform RPC.

The consumer maps every decoded log before `BEGIN` to the exact committed FO
`eventBlocks` entry `(blockNumber, blockHash, blockTimestamp)`. Its fixed initial
ceilings are 10,000 blocks, 2,000 logs, 2,000,000 bytes, 256 unique touched
asset-version keys, 64 ballot days, and 256 proposal/result matches. A ceiling
failure applies and advances nothing. The generic FO kernel owns no registry/H
schema or domain policy, and Task 5's getter consumer retains a separate
identity, lock, checkpoint, raw inbox, and readiness.

Activation-instance authority is exactly
`(chainId=4663, registryAddress, assetVersionKey, activationGeneration)`.
Generation is derived from the complete ordered registry stream beginning at the
exact deployment block and reconciled to pinned getters. Review inclusion is
timely only when `approvedAt <= eventBlockTimestamp < validUntil`; finalization
may occur later. A local `approval_stale` projection yields when a later
finalized event proves timely canonical inclusion. Unmatched canonical events
are retained as immutable chain facts, advance the cursor, raise persistent
public drift, and never authorize a local proposal/result. A finalized checkpoint
disagreement halts this consumer for separately reviewed recovery; it never
auto-rewinds, deletes, or fabricates history.

Only an exact finalized activation event can produce `synced_active`, and only
an exact finalized ballot event can produce `finalized`. Provisional receipts
and transaction hashes remain non-authorizing and may become `reorged`; they
never stay voteable/finalized after disappearance. H2 owns the separate future
`syncFinalizedRwaHealthOverlay(pool)` identity,
`rwa_health_overlay_lock_v2`, `rwa_health_overlay_checkpoint_v2`, raw-plus-decoded
`rwa_health_overlay_inbox_v2`, overlay-generation reducer, and atomic clearance
apply. H2 cannot read or advance this registry cursor, and this consumer cannot
clear health. Finalized clearance also requires a new post-finality health
evaluation before green.

- [ ] **Step 1: Add RED lifecycle tests**

Cover exact publication payload, no caller-supplied substitution, lease/retry,
tx-hash submission not finality, finalized exact event matching, wrong contract/
chain/key/evidence/review rejection, reorg removal, activation TTL based on chain
inclusion timestamp, finality after timely inclusion, proposal `approval_stale`
without inclusion, registry consumer checkpoint/inbox bootstrap and exact replay,
crash rollback at insert/apply/advance seams, competing-worker compare-and-swap,
worker safe wrappers that do not overlap RPC with a DB transaction, unmatched
canonical-event progress plus persistent non-authorizing drift, local-stale
reconciliation to timely finalized proof, deep finalized reorg halt, exact
signed-byte persistence/rebroadcast, and terminal elapsed purchase-window
behavior.

- [ ] **Step 2: Run RED**

```powershell
node test/stockballotv2.js
node test/stockcatalogv2.js
node test/rwanominations.js
```

- [ ] **Step 3: Implement lifecycle sync and worker calls**

Future worker ordering is: finalized getter-catalog sync, one finalized
registry-lifecycle sync, nomination seat/expiry/approval refresh, prior-day
ballot close, H2/budget-gated ready ballot submission, then the next lifecycle
sync. Each call is independently wrapped with the existing `safe(label, fn)` and
bounded to one ready publication per tick. This wiring remains dormant and must
not be placed behind a pretend `RWA_STOCK_PIPELINE` branch: the selector does not
exist until its later explicit cutover node implements and tests it.

No worker path fabricates a finalized block, advances on an HTTP provider fact,
duplicates FO transport logic, advances a last-applied checkpoint before typed
domain apply, or deletes last-known-good finalized state after an outage.

- [ ] **Step 4: Run GREEN, full Node suite, and knowledge checks**

```powershell
node test/stockballotv2.js
node test/stockcatalogv2.js
node test/rwanominations.js
node test/rwaroutes.js
npm test
npm run knowledge
node tools/knowledge-test.js
```

If `npm run knowledge` changes generated artifacts, include only deterministic
generated changes caused by this plan. Commit Task 6 files.

---

### Task 7: Plan-Level Traceability, Migration Runbook, and Final Review Closure

**Files:**

- Create: `docs/runbooks/registry-v2-nomination-ballot-migration.md`
- Modify: `CHAIN-DEPLOY.md`
- Modify: `SPEC.md`
- Modify: `docs/WIKI.md`
- Modify: `test/docs.js` only where an existing runtime claim becomes true
- Modify: generated knowledge artifacts if required

This task is documentation/tooling only and does not deploy, sign, fund, or
activate production.

- [ ] **Step 1: Write the runbook against implemented interfaces**

Document legacy/v2 coexistence, deterministic key reproduction, top-15 one-time
selection, evidence/reviewer ceremony, seven-day TTL edge, unsigned Safe package,
finality/reorg sync, empty-catalog behavior, ballot opening/frozen budget,
deactivated-vote recast, skipped-day result, v2 cutover prerequisites, rollback
to legacy reads without rewriting v2 history, environment variables, alerts,
and exact commands for focused/full tests.

- [ ] **Step 2: Update product docs honestly**

Describe code as implemented/tested but not deployed. Do not copy dirty files
wholesale: patch only the relevant sections and preserve unrelated user edits in
the main dirty worktree. Never claim that RHJ/provider evidence, Safe execution,
production finality, independent audit, or launch occurred.

- [ ] **Step 3: Verify docs, full suites, static analysis, and contract sizes**

```powershell
node test/docs.js
npm test
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' build --sizes
node tools/knowledge-test.js
git status --short
```

Run ContextPlus static analysis if the transport is available; otherwise record
the allowed native fallback and run the repository's smallest relevant lint/
syntax/test checks.

- [ ] **Step 4: Whole-plan independent review**

Generate one merge-base-to-head review package and dispatch the most capable
reviewer for spec compliance, contract/backend security, concurrency, migration
safety, test honesty, and legacy compatibility. Fix every Critical/Important
finding through one implementation dispatch and scoped re-review. Ledger or fix
minors explicitly. Delete this plan's SDD scratch workspace only after the final
review is clean.

## Out of scope for this plan

- RWA health/quarantine predicates beyond finalized catalog activation status.
- Acquisition-vault ETH custody, `mainOperator`, purchase intents, oracle,
  adapter, buying, reconciliation, allocation, and delivery.
- OMRGameplayVault, Broker stake TWA, loss settlement, or gas-pool integration.
- Graphical operator console activation; this plan stabilizes APIs it will later
  consume.
- Production deployment, Safe signing/execution, funding, provider credentials,
  or live role changes.

## Plan rulings

- **Ruling: additive v2 instead of in-place key mutation** — legacy keys and
  ticker-unique rows already have a different meaning — cost if wrong: a later
  migration deploys one extra contract/table family, which is safer than silent
  identity corruption.
- **Ruling: at least one independent purchase price source; median only when
  multiple exist** — this is the exact founder design text — cost if wrong: the
  acquisition plan may tighten to three sources without changing registry or
  nomination semantics.
- **Ruling: v2 ballot opening uses an authenticated operational preparation
  action until AcquisitionVault exists** — a frozen pre-vote budget is required
  now, while on-chain budget authority is a downstream dependency — cost if
  wrong: the downstream vault replaces who supplies the value, not the immutable
  ballot-day record or API shape.
- **Ruling: sponsor reseating requires an observed seat-loss transition plus
  explicit renewal** — current Commission has no historical seat-term ledger;
  the v2 refresh/event seam makes the requirement enforceable without rewriting
  all standing mutations — cost if wrong: extremely fast loss/reseat between
  refreshes needs a future seat-term hook, surfaced by the worker cadence review.
