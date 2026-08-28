# RWA Health H1 — Operational Watcher and Sticky Domain Freeze

**Date:** 2026-08-28  
**Status:** architecture frozen for RED after independent C0/I0/M0 review of
SHA-256 `54CA0F9F0D34C8EA1A33426C385E688B89F3B6694BD906AAC279468D90B690BF`;
RED, implementation, deployment, configuration, Safe execution, finality, and
production cutover remain pending  
**Parent authority:**
`docs/superpowers/specs/2026-08-26-grill-completion.md` section H and
`docs/superpowers/plans/2026-08-26-grill-completion-umbrella.md`  
**Consumes:** approved dormant Registry V2 getter mirror and finalized-observation
kernel; one authenticated RWA reviewer perimeter  
**Produces:** H1 only. `RwaHealthOverlay`, finalized clearance ingestion, ballot
cutover, purchase authority, delivery authority, and every value-moving action remain
later graph nodes.

## 1. Scope and security boundary

H1 is a server-side operational safety domain. It evaluates every finalized active
Stock Token version, records immutable observation evidence, and maintains a sticky
per-version blocker. It may enter or escalate `health_unknown` and
`operational_quarantine`; it can never clear or downgrade an open episode.

H1 owns no Registry activation, ballot, budget, purchase, allocation, delivery,
token, ETH, Safe, signer, transaction-broadcast, or finalized-chain authority. A
healthy provider response is operational evidence, not a replacement for Registry
V2, the shared finalized-observation kernel, or H2 Safe clearance.

The domain has three orthogonal closed classifications:

```text
episode severity: operational_quarantine > health_unknown > none
latest evaluation kind: operational_quarantine | health_unknown | healthy
readiness: blocked_episode | fresh_healthy | stale | registry_unavailable
```

Only readiness `fresh_healthy` authorizes an action wall. `stale` and
`registry_unavailable` never open or mutate an episode merely because time passed or
the Registry mirror disappeared, but both block every dependent action.

The following are categorically forbidden:

- a player, moderator, HTTP caller, watcher payload, or boolean clearing an episode;
- a later healthy observation silently clearing or replacing an episode;
- deleting or rewriting observations, episode starts, or evidence;
- using the legacy ticker-key catalog or legacy ballot as H1 authority;
- treating provider HTTP, a transaction hash, or a provisional receipt as chain
  finality;
- holding a database transaction or lock across HTTP/RPC work;
- an unbounded scan, unbounded response, overlapping local sweep, or concurrent
  apply that can fork one episode generation;
- exposing raw sensitive evidence rather than its hash-addressed commitment.

## 2. Closed predicate and classification policy

### 2.1 Expected identity

The expected identity comes only from one fresh, caught-up, finalized Registry V2
getter-mirror snapshot:

```text
chainId = 4663
registryAddress
catalogVersion
catalogSnapshotHash
assetVersionKey
normalizedTicker
tokenAddress
tokenDecimals
robinhoodAssetIdHash
active = true
activatedAt
```

H1 adds one narrow read seam beside the existing ballot seam:

```js
finalizedStockCatalogForHealthV2(client, { observedEpochSeconds })
```

It never connects, begins, commits, releases, writes, or reads a JavaScript clock.
Its first production statement acquires
`stock_catalog_sync_lock_v2(id=1) FOR SHARE`, held by the caller's transaction until
commit. Under pg-mem the capability-aware test path uses the same singleton read
without `FOR SHARE`; only the real-PostgreSQL harness proves row waiting. The helper
then reuses the exact configured getter-consumer identity, 600-second mirror
freshness, active-head joins, uint/address/hash validation, and bracketed sync-state
recheck of `finalizedStockCatalogForBallotV2`. It has no ballot close. Its exact,
deep-frozen success result is:

```js
{
  available: true,
  reason: null,
  source: 'robinhood_chain_registry_v2',
  finality: 'finalized',
  chainId: '4663',
  registryAddress: '0x...',
  catalogVersion: '<canonical uint256 decimal>',
  catalogSnapshotHash: '0x...32 bytes...',
  readyVerifiedAt: 'YYYY-MM-DDTHH:mm:ss.sssZ',
  historicalVersions: [{
    assetVersionKey: '0x...32 bytes...',
    normalizedTicker: 'AAPL',
    tokenAddress: '0x...20 bytes...',
    tokenDecimals: 18,
    robinhoodAssetIdHash: '0x...32 bytes...',
    active: false,
    registeredAt: 'YYYY-MM-DDTHH:mm:ss.sssZ',
    activatedAt: 'YYYY-MM-DDTHH:mm:ss.sssZ',
    deactivatedAt: 'YYYY-MM-DDTHH:mm:ss.sssZ'
  }],
  activeVersions: [{
    assetVersionKey: '0x...32 bytes...',
    normalizedTicker: 'AAPL',
    tokenAddress: '0x...20 bytes...',
    tokenDecimals: 18,
    robinhoodAssetIdHash: '0x...32 bytes...',
    active: true,
    registeredAt: 'YYYY-MM-DDTHH:mm:ss.sssZ',
    activatedAt: 'YYYY-MM-DDTHH:mm:ss.sssZ',
    deactivatedAt: null
  }]
}
```

The two arrays are disjoint, contain every finalized version exactly once between
them, and are each sorted by `assetVersionKey` byte order. Hashes and addresses are
canonical lowercase hex, `tokenDecimals` is a JavaScript integer, all Registry uints
are canonical decimal strings, and times are UTC ISO strings. Missing timestamps are
`null` only where the literal schema permits them. Every object, nested object, and
array is frozen recursively; extra properties are forbidden.

The exact deep-frozen unavailable result is:

```js
{
  available: false,
  reason: 'configuration | unsynchronized | identity | stale | malformed | changed',
  source: 'registry_unavailable',
  finality: null,
  chainId: '4663',
  registryAddress: '0x...20 bytes or zero address...',
  catalogVersion: '0',
  catalogSnapshotHash: '0x...zero hash...',
  readyVerifiedAt: null,
  historicalVersions: [],
  activeVersions: []
}
```

`registryAddress` is the configured canonical address when configuration exists and
the zero address only for `configuration`. No other unavailable reason or partial
array is permitted. Neither result exposes transport capability, raw evidence, or a
query client.

Every H1 header/page/action/reviewer transaction uses this reader and holds the
Registry share lock through commit. Registry mirror replacement already takes the
same singleton `FOR UPDATE`. The global lock order is exact:

```text
stock_catalog_sync_lock_v2(id=1) FOR SHARE/UPDATE
-> rwa_health_apply_lock_v2(id=1) FOR UPDATE
-> rwa_health_current_v2 rows by ascending assetVersionKey
```

No H1 transaction may acquire these in reverse order. Network work always occurs
before this transaction, so the share lock is never held over HTTP. An unscoped
legacy catalog read is forbidden as H1 authority.

The provider observation never supplies or overrides an expected field. One page
contains at most 256 active versions and one immutable sweep contains at most 2,048
active versions. The sweep freezes the complete active-set identity and processes it
in stable `assetVersionKey` order across at most eight independently atomic pages.
H1 must refuse production readiness above the measured 2,048-version capacity. H1
does not modify the existing nomination/Safe activation-package builder in this node;
that builder remains dormant, and the later CN/H integration node must consume this
capacity wall before package construction or broadcast can be enabled. If an
out-of-band Safe action exceeds the cap, the global `health_capacity_exceeded` wall
blocks every dependent action; H1 never claims partial coverage or green readiness.

Under the Registry share lock and then the H1 lock, every attempt compare-and-sets
`rwa_health_runtime_v2` to the exact finalized snapshot/count. A count above 2,048
sets `capacity_exceeded=true` and creates no batch/current green. A later exact fresh
snapshot at 2,048 or below clears the flag in the same lock order, but clearing is
not health evidence and authorizes nothing: a complete bounded sweep for that exact
snapshot must subsequently establish per-version fresh healthy state. A stale writer
cannot set or clear the wall because snapshot equality is rechecked under both locks.

### 2.2 Provider observation

Production observation uses the code-owned HTTPS endpoint
`https://api.robinhood.com/rhj/assets`. A test may inject `fetchFn`; production
configuration cannot replace the endpoint. One bounded response is fetched before
the apply transaction:

- deadline: 15 seconds;
- request uses `redirect: "error"`, `credentials: "omit"`,
  `accept: application/json`, and `accept-encoding: identity`, and sends no
  caller-controlled header;
- an AbortController enforces one 15-second deadline across headers and complete
  body consumption; a deadline during streaming aborts the stream;
- `content-encoding` must be absent or exactly `identity`; gzip, Brotli, deflate,
  stacked, or unknown encodings reject before parsing, so a compressed expansion can
  never bypass the decoded-byte budget;
- response content type must be `application/json` with at most an optional UTF-8
  charset;
- `content-length` may be absent. If present it must be one canonical ASCII unsigned
  decimal with no comma/sign/whitespace/leading zero (except `0`) and at most
  2,000,000; a declared value above the cap rejects before reading, a streamed count
  exceeding the declaration rejects immediately, and a different final count rejects;
- maximum decoded body: 2,000,000 bytes, enforced while streaming; a declared
  larger `content-length` rejects before reading, and the stream is cancelled as
  soon as the cumulative decoded bytes exceed the cap;
- UTF-8 decoding is fatal rather than replacement-based;
- content is parsed by H1's bounded recursive-descent JSON parser, not `JSON.parse`.
  It enforces JSON grammar while preserving numeric token spellings, creates only
  null-prototype data objects, rejects duplicate keys at every depth before value
  overwrite, and caps nesting at 32, total nodes at 65,536, key bytes at 128, and
  string bytes at 4,096. `tokenDecimals` accepts only the lexical integer form stated
  below, so `18.0` and `1.8e1` cannot collapse to `18`;
- parsed content must be one object with one dense `assets` array. The ruleset reads
  only its closed named paths; syntactically valid unknown provider fields are ignored
  and never become predicate authority, while the raw body hash still commits them;
- at most 2,048 provider assets;
- each asset must pass the dedicated H1 observation parser defined below; the
  activation/catalog parser is not reused because it discards distinctions that H1
  must preserve;
- provider asset IDs, normalized tickers, and chain-4663 token addresses must each
  be unique in the successfully parsed response.

The provider has no cryptographic non-omission or finality status. H1 records that
limitation explicitly and never describes the response as chain-finalized.

The H1 observation parser never silently filters a matched provider record. For
each raw record it produces this exact closed shape before predicate reduction:

```text
providerId: exact(bytes32) | absent | malformed
ticker: exact(normalizedTicker) | absent | malformed
chain4663Deployment:
  exact(address) | absent_from_valid_array | conflicting | malformed
status:
  active | recognized_non_active(code) | absent | unrecognized | malformed
fractionalCapability:
  enabled | recognized_disabled(code) | absent | unrecognized | malformed
decimals:
  exact_uint8(value) | absent | malformed
```

`recognized_non_active(code)` and `recognized_disabled(code)` accept only literal
codes frozen here. Status pass is `ASSET_STATUS_ACTIVE`; the sole verified non-active
code is `ASSET_STATUS_INACTIVE`. Fractional pass is either
`tradingCapabilities.market.fractional = "TRADING_STATUS_TRADABLE"` or
`tradingCapabilities.fractionalTradability = "tradable"`; verified disabled is the
same path with respectively `"TRADING_STATUS_UNTRADABLE"` or `"untradable"`. If
both fractional shapes exist they must agree. Any other string is `unrecognized`,
not verified failure. `absent_from_valid_array` is available only when the deployments
field is a dense array whose every entry passes the literal deployment schema and no
entry names chain 4663. Conflicting
duplicate chain entries are `conflicting`. Decimals accept a JSON integer in `[0,255]`
only; string coercion, floats, exponent notation, and JavaScript `Number` coercion
are forbidden. Tickers are trimmed ASCII then uppercased and must match
`^[A-Z0-9._-]{1,24}$`. Provider IDs must be 32-byte hex. Matching preserves the
exact source-string bytes used by the existing Registry activation tooling and
compares `keccak256(UTF8(rawProviderId))` with the Registry's
`robinhoodAssetIdHash`; this keeps mixed-case legacy-derived Registry hashes
verifiable. Canonical-lowercase provider IDs are also tracked for uniqueness, so two
case variants in one response are global identity ambiguity. Addresses use EIP-55
normalization for comparison but are committed/stored as lowercase hex.

The parser schema is literal. Each asset and deployment entry is a null-prototype
data object; arrays, primitives, accessors, prototypes, and coercible values never
substitute for one. `id`, `tokenSymbol`, `status`, and both named fractional-
capability leaves accept JSON strings only. Missing means `absent`; every present
non-string is `malformed`; an unrecognized string remains `unrecognized` where the
closed shape defines it. `deployments` is a dense JSON array only. Each deployment's
`chainId` is a numeric token with exact grammar `0|[1-9][0-9]*` and value in
`[0,2^256-1]`; strings, signs, leading zeros, fractions, exponents, booleans, null,
arrays, and objects are malformed. Exact integer `4663` selects the deployment;
other valid chain IDs remain valid entries and yield `absent_from_valid_array` when
no 4663 entry exists. `contractAddress` is a JSON string containing exactly a
20-byte hex address accepted through the frozen address normalization; missing,
non-string, or non-address values make the entire deployments array malformed,
including on another-chain entry. Two valid 4663 entries are `conflicting` even when
their normalized addresses are equal. Syntactically valid unknown keys on asset or
deployment objects are ignored as authority but remain committed by the raw-body
hash.

The first and only H1 predicate ruleset in this node is
`RWA_HEALTH_RHJ_ASSET_IDENTITY_V2`. Its ruleset hash is
`keccak256(abi.encode(bytes32(keccak256(UTF8("RWA_HEALTH_RHJ_ASSET_IDENTITY_V2"))),
bytes32(keccak256(UTF8("provider_record"))),
bytes32(keccak256(UTF8("supported_chain"))),
bytes32(keccak256(UTF8("ticker_identity"))),
bytes32(keccak256(UTF8("token_identity"))),
bytes32(keccak256(UTF8("token_decimals"))),
bytes32(keccak256(UTF8("provider_active"))),
bytes32(keccak256(UTF8("fractional_tradable"))),
uint8(0), uint8(1), uint8(2)))`, where
`0=pass/healthy`, `1=unknown/health_unknown`, and
`2=verified_failure/operational_quarantine`. A later source, predicate, threshold, or
interpretation is a new reviewed ruleset ID/hash; it never reinterprets old
evaluations. No response signature is claimed or required by this ruleset.

### 2.3 Closed predicates

For each expected active version the evaluator derives, rather than accepts, these
predicate results:

| Code | Pass condition | Verified failure | Unknown |
|---|---|---|---|
| `provider_record` | exactly one provider record hashes to the expected provider ID | none under this single-response non-omission model | response unavailable, oversized, malformed, globally ambiguous, or omits the expected record |
| `supported_chain` | record has the exact chain `4663` deployment | a valid record lacks chain 4663 or declares another selected chain | deployment data is malformed |
| `ticker_identity` | normalized ticker is exact | exact provider record has a different valid ticker | value cannot be normalized |
| `token_identity` | chain-4663 token address is exact | exact provider record has a different valid address | address is malformed |
| `token_decimals` | integer decimals equal the Registry snapshot | exact provider record has a different valid integer | decimals are absent/malformed |
| `provider_active` | provider status is exactly active | provider reports a valid non-active status | status is absent/unrecognized |
| `fractional_tradable` | provider reports documented fractional-trading capability | provider reports a valid disabled capability | capability is absent/malformed |

The version outcome is:

1. `operational_quarantine` if any predicate has a verified failure;
2. otherwise `health_unknown` if any predicate is unknown;
3. otherwise `healthy`.

For a deterministic episode open/escalation, `ruleCode` is the first predicate in
the table's fixed order whose result equals the winning severity; global source
failure therefore selects `provider_record`. Its immutable `reasonHash` equals that
evaluation's nonzero `evidenceHash`. Routine evaluations that neither open,
escalate, nor terminate remain fully represented by the evaluation row and do not
create redundant episode-event rows.

The evaluator stores only the closed predicate codes/results and commitments. Raw
provider payloads are not public domain state.

### 2.4 Batch failure

A timeout, redirect, non-2xx response, wrong content type/encoding, excessive body,
invalid UTF-8/JSON/top-level shape, malformed or duplicate provider identity makes
the whole bounded response globally ambiguous. One `health_unknown` evaluation is
planned for every expected active version from the unchanged finalized Registry
snapshot. After every raw record has a unique valid provider identity, a valid ID not
expected by the Registry is ignored; a matched record's malformed non-identity field
is reduced only for that expected version by the closed predicates. A valid response
missing one expected record likewise makes only that version unknown. These are
fail-closed availability classifications, not verified material drift, so ambiguity
or omission alone cannot escalate to `operational_quarantine`.

`failure_code` is closed to `provider_timeout`, `provider_redirect`,
`provider_http`, `provider_content_type`, `provider_content_encoding`,
`provider_oversized`, `provider_utf8`, `provider_json`, `provider_shape`,
`provider_identity_malformed`, or `provider_identity_duplicate`. Status codes,
exception strings, payload fragments, and URLs are never stored in that column.

## 3. IDs and immutable evidence

All hashes use canonical lowercase hex and `keccak256`; JSON commitments use the
repository's deterministic recursively key-sorted JSON encoder. Fixed preimages use
Solidity ABI encoding through `encodeAbiParameters`, never packed encoding. Tag
constants are `keccak256` of the literal ASCII tag shown below.

```text
predicate result: 0=pass, 1=unknown, 2=verified_failure
evaluation kind: 0=healthy, 1=health_unknown, 2=operational_quarantine
reviewer requested state: 1=health_unknown, 2=operational_quarantine
reviewer outcome: 0=opened, 1=escalated, 2=evidence_only

expectedIdentityHash = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_EXPECTED_IDENTITY_V2")),
  uint256(4663),
  address(registryAddress),
  bytes32(assetVersionKey),
  bytes32(keccak256(UTF8(normalizedTicker))),
  address(tokenAddress),
  uint8(tokenDecimals),
  bytes32(robinhoodAssetIdHash),
  uint256(catalogVersion),
  bytes32(catalogSnapshotHash)
))

orderedIdentityListHash = keccak256(abi.encode(bytes32[](
  expectedIdentityHash values ordered by ascending assetVersionKey
)))

activeSetHash = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_ACTIVE_SET_V2")),
  uint16(activeVersionCount),
  bytes32(orderedIdentityListHash)
))

providerEndpointHash = keccak256(UTF8("https://api.robinhood.com/rhj/assets"))
providerBodyHash = keccak256(exact decoded response bytes before UTF-8 decoding)
providerFailureHash = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_PROVIDER_FAILURE_V2")),
  bytes32(keccak256(UTF8(closedFailureCode)))
))
providerCommitment = providerBodyHash or providerFailureHash, never both

batchId = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_BATCH_V2")),
  uint256(4663),
  address(registryAddress),
  uint256(catalogVersion),
  bytes32(catalogSnapshotHash),
  bytes32(activeSetHash),
  uint256(cycleSlot),
  bytes32(ruleSetHash),
  bytes32(providerEndpointHash),
  bytes32(providerCommitment)
))

pageId = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_PAGE_V2")),
  bytes32(batchId),
  uint8(pageIndex),
  bytes32(firstAssetVersionKey),
  bytes32(lastAssetVersionKey),
  uint16(itemCount)
))

predicateCommitment = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_PREDICATES_V2")),
  uint8(provider_record),
  uint8(supported_chain),
  uint8(ticker_identity),
  uint8(token_identity),
  uint8(token_decimals),
  uint8(provider_active),
  uint8(fractional_tradable)
))

evidenceHash = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_EVIDENCE_V2")),
  bytes32(batchId),
  bytes32(pageId),
  bytes32(assetVersionKey),
  bytes32(expectedIdentityHash),
  bytes32(predicateCommitment),
  bytes32(providerCommitment)
))

evaluationId = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_EVALUATION_V2")),
  bytes32(batchId),
  bytes32(pageId),
  bytes32(assetVersionKey),
  bytes32(expectedIdentityHash),
  bytes32(predicateCommitment),
  uint8(evaluationKind),
  bytes32(evidenceHash)
))

episodeId = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_EPISODE_V2")),
  uint256(4663),
  address(registryAddress),
  bytes32(assetVersionKey),
  uint256(episodeGeneration)
))

reviewerActionId = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_REVIEWER_ACTION_V2")),
  uint256(4663),
  address(registryAddress),
  bytes32(assetVersionKey),
  uint256(targetEpisodeGeneration),
  bytes32(keccak256(UTF8(canonicalReviewerId))),
  uint8(requestedState),
  bytes32(keccak256(UTF8(ruleCode))),
  bytes32(reasonHash),
  bytes32(evidenceHash)
))

episodeEventId = keccak256(abi.encode(
  bytes32(keccak256("OMERTA_RWA_HEALTH_EPISODE_EVENT_V2")),
  bytes32(episodeId),
  uint8(eventKind),
  bytes32(sourceId),
  uint8(resultingSeverity),
  bytes32(evidenceHash)
))
```

`targetEpisodeGeneration` is the open generation, or prior terminal generation plus
one when the action opens the next episode; generation zero is forbidden.
Episode event kinds are `0=opened`, `1=escalated`, `2=evidence_only`,
`3=clearance_applied`, and `4=terminal`; `resultingSeverity` is `0=none`,
`1=health_unknown`, or `2=operational_quarantine`. `sourceId` is the exact
evaluation, reviewer-action, or future H2 clearance ID that caused the event.
`cycleSlot = floor(databaseEpochSeconds / 300)` is read from PostgreSQL in the
preflight described in section 6. The unique accepted-cycle key is
`(chain_id,registry_address,catalog_version,catalog_snapshot_hash,rule_set_hash,
provider_endpoint_hash,cycle_slot)`. Under the apply lock, the same acceptance key
and the same `active_set_hash` plus `provider_commitment` is an exact replay: no
second batch, page, evaluation, episode event, projection mutation, or sequence
increment is permitted. The same key with different content is
`health_slot_conflict` and applies nothing. A later slot is a new batch even when its
payload is byte-identical. Process-local clocks never participate.

Each page is exactly the next ascending slice of at most 256 identities. `pageIndex`
is zero-based and at most seven; `firstAssetVersionKey`, `lastAssetVersionKey`, and
`itemCount` must equal the corresponding immutable active-set slice. A page replay
with exact content is a no-op; different content under the same `pageId` or a page
whose boundaries do not match the batch is `health_page_conflict`.

Canonical JSON is used only for closed internal/public objects such as cursors; it
contains dense arrays, null-prototype data objects, UTF-8 strings, booleans, null,
and canonical decimal strings only. Floats, BigInt values, accessors, sparse arrays,
duplicate semantic keys, non-data properties, and unknown keys reject. The raw
provider body instead uses the bounded lexical parser above. The same `evaluationId`
is exact-idempotent; different content under one ID is a hard conflict.

Reviewer entry has the exact semantic ID above. The HTTP idempotency key is transport
replay protection and deliberately does not alter the semantic action ID; using a
fresh HTTP key for the same semantic entry replays the existing action. Reviewer
text is never accepted and is never part of a permissioning hash.

The first literal vector is a low-level cryptographic-formula vector only. It is
deliberately not a semantically valid provider/evaluation pair because its empty
provider array is combined with an arbitrary all-pass predicate commitment. It uses
registry `0x1111111111111111111111111111111111111111`,
catalog version `7`, snapshot `0x22..22`, asset key `0x33..33`, ticker `AAPL`, token
`0x4444444444444444444444444444444444444444`, decimals `18`, provider-ID hash
`0x55..55`, cycle slot `123456`, provider bytes `{"assets":[]}`, all-pass predicates,
episode generation `1`, reviewer `reviewer-main`, requested quarantine, rule
`reviewer_material_drift`, reason `0x66..66`, and reviewer evidence `0x77..77`.
Its outputs are literal:

```text
ruleSetHash             0xe573492c63c7d528d740eb1bc084c1a2b3a18f54ef80814e3c795c6033fd1a44
providerEndpointHash    0xd1616a50a719c165db656e87acb677b7c7b657b665298efd7637affc2a1f0940
providerBodyHash        0x301bac8171566f7339d37f74456521447fb173cb2857e16fd36223f00b6bffb2
expectedIdentityHash    0x31f93ef1d8559de405528c84466deb1a82c681b2c21739b8c2a0541de6abe7a1
orderedIdentityListHash 0x283dd429c3373f0773f65309fc41aae31fb82510a8a9c52947ce11832097ce5b
activeSetHash           0x07947b4429f7b3178d5c7a09cd9138954cf14caea7000828c16041dc5659e950
batchId                 0x56f9229bea2e725ace8af6589d4199ff81efdd49fedab40818482fde05b0dbc7
pageId                  0x021eaef8ce468814a91960655f408e12a2507193eb54aa341ca42c2165e1d777
predicateCommitment     0x57997db6fdedcea02ef32a0b2b63e2b4ee88f938c7ac39bfb17da1c6db5baa20
evidenceHash            0x0512f05825571476353452d0d3e0d7fc3c4ca68db615fb626d9f5c5895d7bf5f
evaluationId            0x197238d4ff6ea6f268ebdb14143ade4f2933612e88ae6c841cd07657b7aecb5c
episodeId               0xea515d89dd346a1aaee6d8b144dfc9eb58130136fe3eecef5267979afdcd4e8b
reviewerActionId        0x079de776ced65165fc079b850c36f5c50f0bba2d72d4cce7f7030277d7b37055
episodeEventId          0xf13bb7f31f1302bbc4beedfd18410f09d3738377d97347786070bfe7d3a2cc8a
```

The independent end-to-end healthy vector uses the same Registry/catalog/asset/
ticker/token/decimals/slot inputs, raw provider ID `0x` plus 32 `aa` bytes, and this
exact UTF-8 body with no trailing newline:

```json
{"assets":[{"id":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","tokenSymbol":"AAPL","deployments":[{"chainId":4663,"contractAddress":"0x4444444444444444444444444444444444444444"}],"status":"ASSET_STATUS_ACTIVE","tradingCapabilities":{"fractionalTradability":"tradable"},"tokenDecimals":18}]}
```

The bounded parser must independently derive all seven passes and `healthy`. The
literal dependent values are:

```text
robinhoodAssetIdHash    0x6f236a709c03559aa775103b0b8d9b9b21f8d50cd309dd3cac8be02b210e3906
providerBodyHash        0x3b5f77010541efb32b0d5240b89a4348f298675a75851cb98f8e5ed0297eb90c
expectedIdentityHash    0xa0faba01855d519ec80cf3444ded76a9474ae749633c95d30e5279ba32d611c8
orderedIdentityListHash 0x31341f566fb4a2e79dbf0ad133b22d07d1d3ebe849b6fa920c1780465ea7dd8e
activeSetHash           0x3b00dd34e55833c772669801a158d334953688d4de560da927c55f3e083e7beb
batchId                 0xed8e94f3aa0277a54173b26f3f5d8e341a2e375982c22216b5158e87611264ca
pageId                  0x087b89ee0cca9923ad927406256be8ce01b7fe5b3bad9f521059fd93fcadc95a
predicateCommitment     0x57997db6fdedcea02ef32a0b2b63e2b4ee88f938c7ac39bfb17da1c6db5baa20
evidenceHash            0xe85d47d8586fe0a1272f0379818e1687b5175ab509f3099122ea7c3f10094a0f
evaluationId            0x3a57071c40411ec64909c0661ac44cb43455e20851ba1aef9d707604c3f16f10
```

`0x22..22` means 32 repeated `0x22` bytes, and likewise for the other abbreviated
32-byte inputs. RED commits the expanded fixture. One implementation verifies it
with viem ABI encoding and a separate Foundry helper verifies the same values.
Mutation tests change every field, array order, enum, and tag. `abi.encodePacked`,
ad-hoc concatenation, and `JSON.stringify` are forbidden for every fixed-field ID.
End-to-end tests additionally mutate each raw record field and prove the dedicated
parser changes the expected predicate, evaluation kind, and dependent commitments.

## 4. Database ownership

H1 adds the following literal PostgreSQL shapes. Hash/address text is canonical
lowercase `0x` hex and is additionally validated by the domain before SQL. Every FK
uses `ON DELETE RESTRICT`. `NUMERIC(78,0)` is the closed unsigned-256 storage type;
the domain rejects negative values and values above `2^256-1` before SQL.

```sql
CREATE TABLE IF NOT EXISTS rwa_health_apply_lock_v2 (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rwa_health_runtime_v2 (
  chain_id INT NOT NULL CHECK (chain_id = 4663),
  registry_address TEXT PRIMARY KEY CHECK (char_length(registry_address) = 42),
  catalog_version NUMERIC(78,0) CHECK (catalog_version >= 0),
  catalog_snapshot_hash TEXT CHECK (catalog_snapshot_hash IS NULL OR char_length(catalog_snapshot_hash) = 66),
  active_version_count INT CHECK (active_version_count IS NULL OR active_version_count >= 0),
  capacity_exceeded BOOLEAN NOT NULL DEFAULT false,
  last_attempted_slot NUMERIC(78,0) CHECK (last_attempted_slot >= 0),
  last_completed_slot NUMERIC(78,0) CHECK (last_completed_slot >= 0),
  missed_slot_count BIGINT NOT NULL DEFAULT 0 CHECK (missed_slot_count >= 0),
  last_error_code TEXT CHECK (last_error_code IS NULL OR last_error_code IN
    ('health_registry_unavailable','health_registry_stale','health_capacity_exceeded',
     'health_slot_conflict','health_snapshot_changed','health_provider_timeout',
     'health_provider_http','health_provider_oversized','health_provider_malformed')),
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK ((active_version_count IS NULL AND capacity_exceeded = false)
      OR (active_version_count IS NOT NULL
          AND capacity_exceeded = (active_version_count > 2048))),
  CHECK (last_completed_slot IS NULL
      OR (last_attempted_slot IS NOT NULL AND last_completed_slot <= last_attempted_slot))
);

CREATE TABLE IF NOT EXISTS rwa_health_batches_v2 (
  batch_id TEXT PRIMARY KEY CHECK (char_length(batch_id) = 66),
  chain_id INT NOT NULL CHECK (chain_id = 4663),
  registry_address TEXT NOT NULL CHECK (char_length(registry_address) = 42),
  catalog_version NUMERIC(78,0) NOT NULL CHECK (catalog_version >= 0),
  catalog_snapshot_hash TEXT NOT NULL CHECK (char_length(catalog_snapshot_hash) = 66),
  active_set_hash TEXT NOT NULL CHECK (char_length(active_set_hash) = 66),
  rule_set_hash TEXT NOT NULL CHECK (char_length(rule_set_hash) = 66),
  provider_endpoint_hash TEXT NOT NULL CHECK (char_length(provider_endpoint_hash) = 66),
  provider_commitment TEXT NOT NULL CHECK (char_length(provider_commitment) = 66),
  cycle_slot NUMERIC(78,0) NOT NULL CHECK (cycle_slot >= 0),
  source_state TEXT NOT NULL CHECK (source_state IN ('observed','unknown')),
  failure_code TEXT CHECK (failure_code IN
    ('provider_timeout','provider_redirect','provider_http','provider_content_type',
     'provider_content_encoding','provider_oversized','provider_utf8','provider_json',
     'provider_shape','provider_identity_malformed','provider_identity_duplicate')),
  observed_at TIMESTAMPTZ NOT NULL,
  fetch_completed_at TIMESTAMPTZ NOT NULL,
  active_version_count INT NOT NULL CHECK (active_version_count BETWEEN 0 AND 2048),
  declared_page_count SMALLINT NOT NULL CHECK (declared_page_count BETWEEN 0 AND 8),
  applied_page_count SMALLINT NOT NULL DEFAULT 0 CHECK (applied_page_count BETWEEN 0 AND 8),
  applied_item_count INT NOT NULL DEFAULT 0 CHECK (applied_item_count BETWEEN 0 AND 2048),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','complete','abandoned')),
  completed_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,
  abandoned_code TEXT,
  CHECK (fetch_completed_at >= observed_at),
  CHECK ((source_state = 'observed' AND failure_code IS NULL)
      OR (source_state = 'unknown' AND failure_code IS NOT NULL)),
  CHECK ((active_version_count = 0 AND declared_page_count = 0)
      OR (active_version_count > 0 AND declared_page_count = ((active_version_count + 255) / 256))),
  CHECK (applied_page_count <= declared_page_count),
  CHECK (applied_item_count <= active_version_count),
  CHECK ((status = 'complete' AND completed_at IS NOT NULL
          AND abandoned_at IS NULL AND abandoned_code IS NULL
          AND applied_page_count = declared_page_count
          AND applied_item_count = active_version_count)
      OR (status = 'pending' AND completed_at IS NULL
          AND abandoned_at IS NULL AND abandoned_code IS NULL)
      OR (status = 'abandoned' AND completed_at IS NULL
          AND abandoned_at IS NOT NULL AND abandoned_code IN
            ('health_snapshot_changed','health_registry_stale'))),
  UNIQUE (batch_id,chain_id,registry_address,catalog_version,catalog_snapshot_hash),
  UNIQUE (batch_id,provider_commitment,source_state)
);
CREATE UNIQUE INDEX ux_rwa_health_cycle_v2 ON rwa_health_batches_v2
  (chain_id,registry_address,catalog_version,catalog_snapshot_hash,rule_set_hash,
   provider_endpoint_hash,cycle_slot);
CREATE UNIQUE INDEX ux_rwa_health_one_pending_batch_v2 ON rwa_health_batches_v2
  (chain_id,registry_address) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS rwa_health_private_provider_evidence_v2 (
  batch_id TEXT PRIMARY KEY,
  raw_body_hash TEXT NOT NULL CHECK (char_length(raw_body_hash) = 66),
  source_state TEXT NOT NULL DEFAULT 'observed' CHECK (source_state = 'observed'),
  byte_count INT NOT NULL CHECK (byte_count BETWEEN 0 AND 2000000),
  body_bytes BYTEA NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  retain_until TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (batch_id,raw_body_hash,source_state)
    REFERENCES rwa_health_batches_v2(batch_id,provider_commitment,source_state)
    ON DELETE RESTRICT,
  CHECK (byte_count = octet_length(body_bytes)),
  CHECK (retain_until >= captured_at + interval '35 days')
);

CREATE TABLE IF NOT EXISTS rwa_health_pages_v2 (
  page_id TEXT PRIMARY KEY CHECK (char_length(page_id) = 66),
  batch_id TEXT NOT NULL REFERENCES rwa_health_batches_v2(batch_id) ON DELETE RESTRICT,
  page_index SMALLINT NOT NULL CHECK (page_index BETWEEN 0 AND 7),
  first_asset_version_key TEXT NOT NULL CHECK (char_length(first_asset_version_key) = 66),
  last_asset_version_key TEXT NOT NULL CHECK (char_length(last_asset_version_key) = 66),
  item_count SMALLINT NOT NULL CHECK (item_count BETWEEN 1 AND 256),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','applied')),
  applied_at TIMESTAMPTZ,
  UNIQUE (batch_id,page_index),
  UNIQUE (batch_id,page_id),
  CHECK (first_asset_version_key <= last_asset_version_key),
  CHECK ((status = 'planned' AND applied_at IS NULL)
      OR (status = 'applied' AND applied_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS rwa_health_evaluations_v2 (
  evaluation_id TEXT PRIMARY KEY CHECK (char_length(evaluation_id) = 66),
  batch_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  chain_id INT NOT NULL CHECK (chain_id = 4663),
  registry_address TEXT NOT NULL CHECK (char_length(registry_address) = 42),
  catalog_version NUMERIC(78,0) NOT NULL CHECK (catalog_version >= 0),
  catalog_snapshot_hash TEXT NOT NULL CHECK (char_length(catalog_snapshot_hash) = 66),
  asset_version_key TEXT NOT NULL CHECK (char_length(asset_version_key) = 66),
  normalized_ticker TEXT NOT NULL,
  token_address TEXT NOT NULL CHECK (char_length(token_address) = 42),
  token_decimals SMALLINT NOT NULL CHECK (token_decimals BETWEEN 0 AND 255),
  robinhood_asset_id_hash TEXT NOT NULL CHECK (char_length(robinhood_asset_id_hash) = 66),
  expected_identity_hash TEXT NOT NULL CHECK (char_length(expected_identity_hash) = 66),
  evaluation_kind TEXT NOT NULL CHECK (evaluation_kind IN
    ('healthy','health_unknown','operational_quarantine')),
  predicate_commitment TEXT NOT NULL CHECK (char_length(predicate_commitment) = 66),
  provider_record SMALLINT NOT NULL CHECK (provider_record BETWEEN 0 AND 2),
  supported_chain SMALLINT NOT NULL CHECK (supported_chain BETWEEN 0 AND 2),
  ticker_identity SMALLINT NOT NULL CHECK (ticker_identity BETWEEN 0 AND 2),
  token_identity SMALLINT NOT NULL CHECK (token_identity BETWEEN 0 AND 2),
  token_decimals_result SMALLINT NOT NULL CHECK (token_decimals_result BETWEEN 0 AND 2),
  provider_active SMALLINT NOT NULL CHECK (provider_active BETWEEN 0 AND 2),
  fractional_tradable SMALLINT NOT NULL CHECK (fractional_tradable BETWEEN 0 AND 2),
  evidence_hash TEXT NOT NULL CHECK
    (char_length(evidence_hash) = 66 AND evidence_hash <> '0x0000000000000000000000000000000000000000000000000000000000000000'),
  observed_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','applied')),
  applied_at TIMESTAMPTZ,
  UNIQUE (batch_id,asset_version_key),
  UNIQUE (page_id,asset_version_key),
  UNIQUE (registry_address,asset_version_key,evaluation_id),
  UNIQUE (registry_address,asset_version_key,catalog_version,catalog_snapshot_hash,evaluation_id),
  UNIQUE (registry_address,asset_version_key,evaluation_id,evaluation_kind,evidence_hash),
  UNIQUE (registry_address,asset_version_key,evaluation_id,status),
  UNIQUE (registry_address,asset_version_key,evaluation_id,status,evaluation_kind,evidence_hash),
  UNIQUE (registry_address,asset_version_key,catalog_version,catalog_snapshot_hash,evaluation_id,status),
  UNIQUE (registry_address,asset_version_key,evaluation_id,status,
          evaluation_kind,observed_at,applied_at,evidence_hash),
  UNIQUE (registry_address,asset_version_key,catalog_version,catalog_snapshot_hash,
          evaluation_id,status,evaluation_kind,observed_at,applied_at,evidence_hash),
  FOREIGN KEY (batch_id,page_id)
    REFERENCES rwa_health_pages_v2(batch_id,page_id) ON DELETE RESTRICT,
  FOREIGN KEY (batch_id,chain_id,registry_address,catalog_version,catalog_snapshot_hash)
    REFERENCES rwa_health_batches_v2
      (batch_id,chain_id,registry_address,catalog_version,catalog_snapshot_hash)
    ON DELETE RESTRICT,
  CHECK ((status = 'planned' AND applied_at IS NULL)
      OR (status = 'applied' AND applied_at >= observed_at))
);
CREATE INDEX ix_rwa_health_eval_asset_v2 ON rwa_health_evaluations_v2
  (registry_address,asset_version_key,applied_at DESC NULLS LAST,evaluation_id DESC)
  WHERE status = 'applied';

CREATE TABLE IF NOT EXISTS rwa_health_reviewer_actions_v2 (
  reviewer_action_id TEXT PRIMARY KEY CHECK (char_length(reviewer_action_id) = 66),
  chain_id INT NOT NULL CHECK (chain_id = 4663),
  registry_address TEXT NOT NULL CHECK (char_length(registry_address) = 42),
  asset_version_key TEXT NOT NULL CHECK (char_length(asset_version_key) = 66),
  target_episode_id TEXT NOT NULL CHECK (char_length(target_episode_id) = 66),
  target_episode_generation NUMERIC(78,0) NOT NULL CHECK (target_episode_generation > 0),
  requested_state TEXT NOT NULL CHECK (requested_state IN
    ('health_unknown','operational_quarantine')),
  rule_code TEXT NOT NULL CHECK (rule_code IN
    ('reviewer_material_drift','reviewer_verification_unknown')),
  reason_hash TEXT NOT NULL CHECK
    (char_length(reason_hash) = 66 AND reason_hash <> '0x0000000000000000000000000000000000000000000000000000000000000000'),
  evidence_hash TEXT NOT NULL CHECK
    (char_length(evidence_hash) = 66 AND evidence_hash <> '0x0000000000000000000000000000000000000000000000000000000000000000'),
  reviewer_id TEXT NOT NULL,
  first_transport_key_hash TEXT NOT NULL CHECK (char_length(first_transport_key_hash) = 64),
  requested_at TIMESTAMPTZ NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('opened','escalated','evidence_only')),
  CHECK (applied_at >= requested_at),
  CHECK ((requested_state = 'operational_quarantine'
          AND rule_code = 'reviewer_material_drift')
      OR (requested_state = 'health_unknown'
          AND rule_code = 'reviewer_verification_unknown')),
  UNIQUE (target_episode_id,registry_address,asset_version_key,
           target_episode_generation,reviewer_action_id),
  UNIQUE (target_episode_id,registry_address,asset_version_key,
          target_episode_generation,reviewer_action_id,requested_state,rule_code),
  UNIQUE (target_episode_id,registry_address,asset_version_key,
          target_episode_generation,reviewer_action_id,requested_state,evidence_hash),
  UNIQUE (target_episode_id,registry_address,asset_version_key,
          target_episode_generation,reviewer_action_id,requested_state,rule_code,evidence_hash),
  UNIQUE (target_episode_id,registry_address,asset_version_key,
          target_episode_generation,reviewer_action_id,requested_state,evidence_hash,outcome)
);

CREATE TABLE IF NOT EXISTS rwa_health_episodes_v2 (
  episode_id TEXT PRIMARY KEY CHECK (char_length(episode_id) = 66),
  chain_id INT NOT NULL CHECK (chain_id = 4663),
  registry_address TEXT NOT NULL CHECK (char_length(registry_address) = 42),
  asset_version_key TEXT NOT NULL CHECK (char_length(asset_version_key) = 66),
  generation NUMERIC(78,0) NOT NULL CHECK (generation > 0),
  initial_state TEXT NOT NULL CHECK (initial_state IN
    ('health_unknown','operational_quarantine')),
  opened_at TIMESTAMPTZ NOT NULL,
  opening_evaluation_id TEXT,
  opening_evaluation_status TEXT CHECK (opening_evaluation_status = 'applied'),
  opening_reviewer_action_id TEXT,
  opening_rule_code TEXT NOT NULL CHECK (opening_rule_code IN
    ('provider_record','supported_chain','ticker_identity','token_identity',
     'token_decimals','provider_active','fractional_tradable',
     'reviewer_material_drift','reviewer_verification_unknown')),
  opening_reason_hash TEXT NOT NULL CHECK
    (char_length(opening_reason_hash) = 66 AND opening_reason_hash <> '0x0000000000000000000000000000000000000000000000000000000000000000'),
  opening_evidence_hash TEXT NOT NULL CHECK
    (char_length(opening_evidence_hash) = 66 AND opening_evidence_hash <> '0x0000000000000000000000000000000000000000000000000000000000000000'),
  clearance_id TEXT,
  clearance_generation NUMERIC(78,0),
  clearance_block_number NUMERIC(78,0),
  clearance_block_hash TEXT,
  clearance_applied_at TIMESTAMPTZ,
  terminal_status TEXT CHECK (terminal_status IN
    ('healthy_after_clearance','post_clearance_failure_superseded')),
  terminal_evaluation_id TEXT,
  terminal_evaluation_status TEXT CHECK (terminal_evaluation_status = 'applied'),
  terminal_evaluation_kind TEXT CHECK (terminal_evaluation_kind IN
    ('healthy','health_unknown','operational_quarantine')),
  terminal_evaluation_evidence_hash TEXT,
  closed_at TIMESTAMPTZ,
  UNIQUE (registry_address,asset_version_key,generation),
  UNIQUE (episode_id,registry_address,asset_version_key,generation),
  UNIQUE (registry_address,asset_version_key,generation,episode_id),
  UNIQUE (registry_address,asset_version_key,generation,episode_id,opened_at),
  FOREIGN KEY (registry_address,asset_version_key,opening_evaluation_id,
               initial_state,opening_evidence_hash)
    REFERENCES rwa_health_evaluations_v2
      (registry_address,asset_version_key,evaluation_id,evaluation_kind,evidence_hash)
    ON DELETE RESTRICT,
  FOREIGN KEY (registry_address,asset_version_key,opening_evaluation_id,
               opening_evaluation_status)
    REFERENCES rwa_health_evaluations_v2
      (registry_address,asset_version_key,evaluation_id,status) ON DELETE RESTRICT,
  FOREIGN KEY (episode_id,registry_address,asset_version_key,generation,
               opening_reviewer_action_id,initial_state,opening_rule_code,opening_evidence_hash)
    REFERENCES rwa_health_reviewer_actions_v2
      (target_episode_id,registry_address,asset_version_key,target_episode_generation,
       reviewer_action_id,requested_state,rule_code,evidence_hash)
    ON DELETE RESTRICT,
  FOREIGN KEY (registry_address,asset_version_key,terminal_evaluation_id,
               terminal_evaluation_status,terminal_evaluation_kind,
               terminal_evaluation_evidence_hash)
    REFERENCES rwa_health_evaluations_v2
      (registry_address,asset_version_key,evaluation_id,status,evaluation_kind,evidence_hash)
    ON DELETE RESTRICT,
  CHECK ((opening_evaluation_id IS NULL) <> (opening_reviewer_action_id IS NULL)),
  CHECK ((opening_evaluation_id IS NULL) = (opening_evaluation_status IS NULL)),
  CHECK ((terminal_evaluation_id IS NULL) = (terminal_evaluation_status IS NULL)),
  CHECK ((terminal_evaluation_id IS NULL) = (terminal_evaluation_kind IS NULL)),
  CHECK ((terminal_evaluation_id IS NULL) = (terminal_evaluation_evidence_hash IS NULL)),
  CHECK (opening_evaluation_id IS NULL OR opening_reason_hash = opening_evidence_hash),
  CHECK ((clearance_id IS NULL AND clearance_generation IS NULL
          AND clearance_block_number IS NULL AND clearance_block_hash IS NULL
          AND clearance_applied_at IS NULL)
      OR (clearance_id IS NOT NULL AND char_length(clearance_id) = 66
          AND clearance_generation = generation AND clearance_block_number >= 0
          AND char_length(clearance_block_hash) = 66 AND clearance_applied_at IS NOT NULL)),
  CHECK ((terminal_status IS NULL AND terminal_evaluation_id IS NULL AND closed_at IS NULL)
      OR (terminal_status IS NOT NULL AND terminal_evaluation_id IS NOT NULL AND closed_at IS NOT NULL
          AND clearance_applied_at IS NOT NULL AND closed_at >= clearance_applied_at)),
  CHECK ((terminal_status IS NULL AND terminal_evaluation_kind IS NULL)
      OR (terminal_status = 'healthy_after_clearance' AND terminal_evaluation_kind = 'healthy')
      OR (terminal_status = 'post_clearance_failure_superseded'
          AND terminal_evaluation_kind IN ('health_unknown','operational_quarantine')))
);
CREATE UNIQUE INDEX ux_rwa_health_one_open_episode_v2
  ON rwa_health_episodes_v2(registry_address,asset_version_key)
  WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS rwa_health_episode_events_v2 (
  event_id TEXT PRIMARY KEY CHECK (char_length(event_id) = 66),
  episode_id TEXT NOT NULL,
  registry_address TEXT NOT NULL CHECK (char_length(registry_address) = 42),
  asset_version_key TEXT NOT NULL CHECK (char_length(asset_version_key) = 66),
  episode_generation NUMERIC(78,0) NOT NULL CHECK (episode_generation > 0),
  event_kind TEXT NOT NULL CHECK (event_kind IN
    ('opened','escalated','evidence_only','clearance_applied','terminal')),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('evaluation','reviewer','h2_clearance')),
  source_id TEXT NOT NULL CHECK (char_length(source_id) = 66),
  source_evaluation_id TEXT,
  source_evaluation_status TEXT CHECK (source_evaluation_status = 'applied'),
  source_evaluation_kind TEXT CHECK (source_evaluation_kind IN
    ('healthy','health_unknown','operational_quarantine')),
  source_reviewer_action_id TEXT,
  source_reviewer_state TEXT CHECK (source_reviewer_state IN
    ('health_unknown','operational_quarantine')),
  source_reviewer_outcome TEXT CHECK (source_reviewer_outcome IN
    ('opened','escalated','evidence_only')),
  source_clearance_id TEXT,
  resulting_severity TEXT NOT NULL CHECK (resulting_severity IN
    ('none','health_unknown','operational_quarantine')),
  evidence_hash TEXT NOT NULL CHECK
    (char_length(evidence_hash) = 66 AND evidence_hash <> '0x0000000000000000000000000000000000000000000000000000000000000000'),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (episode_id,source_kind,source_id),
  UNIQUE (episode_id,registry_address,asset_version_key,episode_generation,event_id),
  UNIQUE (episode_id,registry_address,asset_version_key,episode_generation,
          event_id,resulting_severity),
  UNIQUE (episode_id,registry_address,asset_version_key,episode_generation,
          event_id,evidence_hash),
  UNIQUE (episode_id,registry_address,asset_version_key,episode_generation,
          event_id,resulting_severity,evidence_hash),
  FOREIGN KEY (episode_id,registry_address,asset_version_key,episode_generation)
    REFERENCES rwa_health_episodes_v2
      (episode_id,registry_address,asset_version_key,generation) ON DELETE RESTRICT,
  FOREIGN KEY (registry_address,asset_version_key,source_evaluation_id,
               source_evaluation_status,source_evaluation_kind,evidence_hash)
    REFERENCES rwa_health_evaluations_v2
      (registry_address,asset_version_key,evaluation_id,status,evaluation_kind,evidence_hash)
    ON DELETE RESTRICT,
  FOREIGN KEY (episode_id,registry_address,asset_version_key,episode_generation,
               source_reviewer_action_id,source_reviewer_state,evidence_hash,
               source_reviewer_outcome)
    REFERENCES rwa_health_reviewer_actions_v2
      (target_episode_id,registry_address,asset_version_key,target_episode_generation,
       reviewer_action_id,requested_state,evidence_hash,outcome) ON DELETE RESTRICT,
  CHECK ((source_kind = 'evaluation' AND source_id = source_evaluation_id
          AND source_evaluation_id IS NOT NULL
          AND source_evaluation_status = 'applied'
          AND source_evaluation_kind IS NOT NULL
          AND source_reviewer_action_id IS NULL AND source_reviewer_state IS NULL
          AND source_reviewer_outcome IS NULL
          AND source_clearance_id IS NULL)
      OR (source_kind = 'reviewer' AND source_id = source_reviewer_action_id
          AND source_reviewer_action_id IS NOT NULL
          AND source_reviewer_state IS NOT NULL AND source_reviewer_outcome IS NOT NULL
          AND source_evaluation_id IS NULL AND source_evaluation_status IS NULL
          AND source_evaluation_kind IS NULL
          AND source_clearance_id IS NULL)
      OR (source_kind = 'h2_clearance' AND source_id = source_clearance_id
          AND source_clearance_id IS NOT NULL
          AND source_evaluation_id IS NULL AND source_evaluation_status IS NULL
          AND source_evaluation_kind IS NULL
          AND source_reviewer_action_id IS NULL AND source_reviewer_state IS NULL
          AND source_reviewer_outcome IS NULL)),
  CHECK ((source_kind = 'evaluation' AND
            ((event_kind = 'opened'
                AND source_evaluation_kind IN ('health_unknown','operational_quarantine')
                AND resulting_severity = source_evaluation_kind)
             OR (event_kind = 'escalated'
                AND source_evaluation_kind = 'operational_quarantine'
                AND resulting_severity = 'operational_quarantine')
             OR (event_kind = 'terminal' AND resulting_severity = 'none')))
      OR (source_kind = 'reviewer' AND
            event_kind = source_reviewer_outcome AND
            ((source_reviewer_outcome = 'opened'
                AND resulting_severity = source_reviewer_state)
             OR (source_reviewer_outcome = 'escalated'
                AND source_reviewer_state = 'operational_quarantine'
                AND resulting_severity = 'operational_quarantine')
             OR (source_reviewer_outcome = 'evidence_only'
                AND ((source_reviewer_state = 'health_unknown'
                        AND resulting_severity IN ('health_unknown','operational_quarantine'))
                     OR (source_reviewer_state = 'operational_quarantine'
                        AND resulting_severity = 'operational_quarantine')))))
      OR (source_kind = 'h2_clearance' AND event_kind = 'clearance_applied'
          AND resulting_severity IN ('health_unknown','operational_quarantine')))
);
CREATE INDEX ix_rwa_health_episode_events_v2 ON rwa_health_episode_events_v2
  (episode_id,created_at,event_id);

CREATE TABLE IF NOT EXISTS rwa_health_current_v2 (
  chain_id INT NOT NULL CHECK (chain_id = 4663),
  registry_address TEXT NOT NULL CHECK (char_length(registry_address) = 42),
  asset_version_key TEXT NOT NULL CHECK (char_length(asset_version_key) = 66),
  catalog_version NUMERIC(78,0) NOT NULL CHECK (catalog_version >= 0),
  catalog_snapshot_hash TEXT NOT NULL CHECK (char_length(catalog_snapshot_hash) = 66),
  last_evaluation_id TEXT,
  last_evaluation_status TEXT CHECK (last_evaluation_status = 'applied'),
  latest_evaluation_kind TEXT CHECK (latest_evaluation_kind IN
    ('healthy','health_unknown','operational_quarantine')),
  last_evaluation_evidence_hash TEXT,
  last_observed_at TIMESTAMPTZ,
  last_applied_at TIMESTAMPTZ,
  current_episode_id TEXT,
  current_episode_generation NUMERIC(78,0),
  current_severity TEXT CHECK (current_severity IN
    ('health_unknown','operational_quarantine')),
  episode_opened_at TIMESTAMPTZ,
  latest_episode_event_id TEXT,
  latest_material_event_id TEXT,
  latest_material_evidence_hash TEXT,
  clearance_id TEXT,
  clearance_generation NUMERIC(78,0),
  clearance_applied_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ,
  state_sequence BIGINT NOT NULL CHECK (state_sequence > 0),
  PRIMARY KEY (registry_address,asset_version_key),
  FOREIGN KEY (registry_address,asset_version_key,catalog_version,
               catalog_snapshot_hash,last_evaluation_id,last_evaluation_status,
               latest_evaluation_kind,last_observed_at,last_applied_at,
               last_evaluation_evidence_hash)
    REFERENCES rwa_health_evaluations_v2
      (registry_address,asset_version_key,catalog_version,catalog_snapshot_hash,
       evaluation_id,status,evaluation_kind,observed_at,applied_at,evidence_hash)
    ON DELETE RESTRICT,
  FOREIGN KEY (registry_address,asset_version_key,current_episode_generation,
               current_episode_id,episode_opened_at)
    REFERENCES rwa_health_episodes_v2
      (registry_address,asset_version_key,generation,episode_id,opened_at)
    ON DELETE RESTRICT,
  FOREIGN KEY (current_episode_id,registry_address,asset_version_key,
               current_episode_generation,latest_episode_event_id,current_severity)
    REFERENCES rwa_health_episode_events_v2
      (episode_id,registry_address,asset_version_key,episode_generation,event_id,resulting_severity)
    ON DELETE RESTRICT,
  FOREIGN KEY (current_episode_id,registry_address,asset_version_key,
               current_episode_generation,latest_material_event_id,
               latest_material_evidence_hash)
    REFERENCES rwa_health_episode_events_v2
      (episode_id,registry_address,asset_version_key,episode_generation,event_id,evidence_hash)
    ON DELETE RESTRICT,
  CHECK ((last_evaluation_id IS NULL AND last_evaluation_status IS NULL
          AND latest_evaluation_kind IS NULL
          AND last_evaluation_evidence_hash IS NULL
          AND last_observed_at IS NULL AND last_applied_at IS NULL AND next_due_at IS NULL)
      OR (last_evaluation_id IS NOT NULL AND last_evaluation_status = 'applied'
          AND latest_evaluation_kind IS NOT NULL
          AND last_evaluation_evidence_hash IS NOT NULL
          AND last_observed_at IS NOT NULL AND last_applied_at IS NOT NULL
          AND next_due_at IS NOT NULL)),
  CHECK ((current_episode_id IS NULL AND current_episode_generation IS NULL
          AND current_severity IS NULL AND episode_opened_at IS NULL
          AND latest_episode_event_id IS NULL AND latest_material_event_id IS NULL
          AND latest_material_evidence_hash IS NULL)
      OR (current_episode_id IS NOT NULL AND current_episode_generation > 0
          AND current_severity IS NOT NULL AND episode_opened_at IS NOT NULL
          AND latest_episode_event_id IS NOT NULL
          AND char_length(latest_episode_event_id) = 66
          AND latest_material_event_id IS NOT NULL
          AND char_length(latest_material_event_id) = 66
          AND latest_material_evidence_hash IS NOT NULL
          AND char_length(latest_material_evidence_hash) = 66)),
  CHECK ((clearance_id IS NULL AND clearance_generation IS NULL AND clearance_applied_at IS NULL)
      OR (clearance_id IS NOT NULL AND char_length(clearance_id) = 66
          AND current_episode_id IS NOT NULL
          AND clearance_generation = current_episode_generation
          AND clearance_applied_at IS NOT NULL)),
  CHECK (next_due_at IS NULL OR next_due_at = last_observed_at + interval '300 seconds')
);
```

The singleton row is inserted with `ON CONFLICT DO NOTHING` during schema boot.
Every batch/page/reviewer/action transaction first holds the Registry mirror share
lock, then locks the H1 singleton, then current rows in ascending
`asset_version_key` order. Batch progress/status, page/evaluation
`planned -> applied`, monotonic episode severity, H2 clearance fields, and terminal
fields are the only evidence-table updates and require exact compare-and-set
statements. Batch identity/evidence, page/evaluation content, reviewer actions, and
episode events are otherwise immutable. Episode severity is derived from its ordered
immutable events rather than duplicated in the episode row; episode updates are
closed to H2 clearance and terminal fields.
Current/runtime rows are the only freely replaced projections. Application source
contains no DELETE against H1 domain evidence. The one exception is the private raw-
body retention table: a selective worker may delete bytes only after `retain_until`,
only when no open episode, H2 attestation, or unexpired clearance package references
the batch. Batch/evaluation/hash history remains forever.

Cross-row equality is part of the apply transaction: page evaluation count must
equal `item_count`; the page slice must match the frozen active set; completing a
batch requires the exact declared page and item totals. The real-PostgreSQL harness
proves the partial unique index, composite ownership FKs, and check constraints.
Every latest/readiness/public/rebuild query must include only evaluations and pages
with `status='applied'`. It ignores all planned rows; an abandoned batch contributes
only its already-applied page prefix, never its remaining plan. Deterministic rebuild
orders accepted applied prefixes by batches `(cycle_slot,batch_id)`, pages
`(page_index,page_id)`, evaluations `(asset_version_key,evaluation_id)`, reviewer actions by
`(applied_at,reviewer_action_id)`, and H2 evidence by its independent finalized
consumer order. Rebuild must reproduce every current field and `state_sequence`.

Only a batch with `source_state='observed'` can own private exact response bytes, and
only when the frozen plan contains a nonhealthy evaluation or any matching version
already has an open episode. The insert recomputes `keccak256(body_bytes)` and
requires equality with both `raw_body_hash` and the parent batch's
`provider_commitment`; SQL independently binds batch/hash/source state and byte
count. A page that opens/escalates an episode cannot commit unless those bytes exist.
A fresh healthy evaluation used for an H2 clearance attestation likewise requires
its exact private body preimage. Raw bytes are never public; only the reviewer
perimeter and future H2 package builder may read them by exact batch/evaluation
identity, and every such read must recompute the hash and reject corruption before
returning bytes. Timeout, redirect, non-2xx, encoding/content-type/size/UTF-8/JSON/
shape/identity failures store no private body row because their durable provider
commitment is the closed failure-code hash, not a body hash. H2 must refuse clearance
review if any required preimage is absent or fails recomputation.

At most 255 `evidence_only` reviewer actions may target one episode. Exact semantic
replays are detected before this count and remain no-ops. The single possible
`health_unknown` to `operational_quarantine` escalation remains allowed after the
evidence-only cap. Further non-escalating semantic actions fail with
`health_evidence_limit`; they create neither transport completion nor domain rows.

H1 writes none of the five H2 clearance columns. H1 may write terminal fields only
while reducing a new evaluation after H2 has atomically populated matching clearance
fields. No generic update helper accepts H2 or terminal column names.

## 5. State transitions

| Current | Input | Result |
|---|---|---|
| no episode | healthy evaluation | effective `healthy`; no episode |
| no episode | unknown evaluation | open generation `1` as `health_unknown` |
| no episode | verified failure | open generation `1` as `operational_quarantine` |
| `health_unknown` open | healthy/unknown evaluation | episode and original timestamp unchanged |
| `health_unknown` open | verified failure | same episode/generation escalates effective state to `operational_quarantine`; original timestamp unchanged; append evaluation/evidence |
| `operational_quarantine` open | any H1 input | episode/state/generation unchanged; append evaluation only |
| any open episode | reviewer requests equal/lower severity | new semantic evidence appends one event and advances evidence head/sequence; exact semantic replay is a no-op; no downgrade or new generation |
| any open episode | reviewer requests higher severity | same generation escalates; original timestamp unchanged |
| H2-finalized clearance only | any | sticky latch removed only for the exact generation; still blocked in `clearance_applied_waiting_fresh_evaluation` |
| finalized clearance + strictly later healthy evaluation | H1 post-clearance evaluation reducer | episode terminal; effective `healthy`; next issue increments generation |
| finalized clearance + strictly later unknown/drift evaluation | H1 post-clearance evaluation reducer | old episode closes as `post_clearance_failure_superseded`; a new sticky episode opens at generation + 1 with the new classification and requires a new H2 clearance |

Repeated deterministic or reviewer entry cannot create a new generation, reset the
original timestamp, weaken state, or flood durable episode rows. Failed requests and
failed transactions create no episode, sequence, pause, or event.

Every distinct open/escalate/evidence-only/clearance/terminal event replaces
`latest_episode_event_id`, replaces `latest_material_evidence_hash` when the event
contains material evidence, and increments `state_sequence` once. A semantic replay
changes none of them. These fields are the reviewed evidence head that H2 must bind.

Registry deactivation never erases an episode. It changes the public eligibility
projection to `registry_inactive`; historical blocker evidence remains queryable.

## 6. Freshness and action wall

The database clock is the only domain clock. Production uses
`date_trunc('milliseconds',clock_timestamp())`; the pg-mem capability path uses
plain `now()` because its adapter has neither `clock_timestamp()` nor `date_trunc()`
and its timestamp adapter already round-trips millisecond precision; it makes no
row-wait timing claim. One internal `healthDbNowSql()` chooses exactly by
the repository's real-PostgreSQL capability flag:

- `observed_at` and `cycle_slot` come from one unlocked preflight query immediately
  before fetch: `WITH t AS (SELECT <healthDbNowSql> AS now) SELECT now,
  floor(extract(epoch FROM now)/300) FROM t`;
- `fetch_completed_at` comes from a second PostgreSQL query immediately after the
  bounded body/failure result exists, using the same millisecond truncation;
- each page's `applied_at` comes from `<healthDbNowSql>` after the Registry/H1/page
  locks are held and immediately before its inserts;
- episode `opened_at`, reviewer `requested_at`/`applied_at`, batch `completed_at`,
  H2 `clearance_applied_at`, and terminal `closed_at` are database timestamps read in
their owning transactions.

Every persisted domain timestamp is truncated to PostgreSQL millisecond precision.
Public timestamps are canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ`; cursor timestamps
round-trip byte-for-byte to the persisted instant. Database ordering always adds the
immutable ID tie-breaker, so equal milliseconds are deterministic. A
`state_sequence` at signed BIGINT maximum fails `health_state_conflict`; it never
wraps.

JavaScript wall time, provider fields, HTTP `Date`, and caller time never contribute
to IDs, slots, freshness, ordering, cursors, or episode timestamps. The monotonic
AbortController timer only enforces the 15-second I/O deadline. The domain requires
`fetch_completed_at >= observed_at`, every `applied_at >= fetch_completed_at`, and a
total fetch interval no greater than 15 seconds.

A healthy evaluation is fresh through exactly
`observed_at + interval '600 seconds'`; the first database instant after that is
stale. Waiting for a lock never makes evidence newer. A post-clearance evaluation is
strictly later only when both its `observed_at` and `applied_at` are greater than the
matching `clearance_applied_at`.

```js
requireFreshRwaHealth(client, assetVersionKey, {
  expectedEvaluationId,
  purpose,
  expectedEpisodeGeneration,
  expectedStateSequence,
  expectedEpisodeEventId,
  expectedMaterialEvidenceHash,
})
```

`client` must be the caller-owned object with a callable `query`; `assetVersionKey`
must be canonical lowercase nonzero bytes32 hex. The third argument is a plain data
object with exactly the six own properties shown above—none omitted and no extras,
getters, inherited values, coercion, `BigInt`, numbers, or alternate spellings. The
purpose-aware matrix is exact:

| Property | First three normal purposes | `quarantine_clearance_broadcast` |
|---|---|---|
| `expectedEvaluationId` | required canonical nonzero bytes32 | required canonical nonzero bytes32 |
| `purpose` | exactly the selected normal-purpose string | exact clearance-purpose string |
| `expectedEpisodeGeneration` | exactly `null` | canonical positive uint256 decimal string |
| `expectedStateSequence` | canonical positive signed-BIGINT decimal string | canonical positive signed-BIGINT decimal string |
| `expectedEpisodeEventId` | exactly `null` | canonical nonzero bytes32 |
| `expectedMaterialEvidenceHash` | exactly `null` | canonical nonzero bytes32 |

Any missing/extra/wrong-type/noncanonical field is `health_bad_input` before the
catalog reader, lock, or domain query. This argument contract is separate from the
receipt contract. Every caller supplies the current sequence as a common stale-state
guard; normal purposes also recheck absence of an episode under lock.

is the internal action seam. It:

1. uses only the caller's checked-out query client;
2. calls the health catalog reader, acquiring the Registry share lock;
3. locks the H1 singleton, then the exact current row, and reads database time;
4. requires the exact active finalized Registry identity, the current mirror active
   count at or below 2,048, no runtime capacity wall, and exact equality between the
   current evaluation's catalog snapshot and the live finalized mirror;
5. accepts only `ballot_publication`, `purchase_broadcast`, `delivery_start`, or
   `quarantine_clearance_broadcast` as purpose;
6. for the first three purposes, requires no open sticky episode;
7. for `quarantine_clearance_broadcast`, instead requires the exact currently open
   episode generation, no clearance already applied, and a fresh latest `healthy`
   evaluation for that still-sticky episode;
8. requires latest evaluation kind `healthy` and not stale;
9. requires the caller's expected evaluation ID and state sequence as stale-state guards;
10. for clearance, also requires the exact episode-event head and
   material-evidence head;
11. returns the fixed internal receipt below and performs no mutation, connection, commit,
    rollback, retry, HTTP, RPC, signing, or broadcast.

The receipt is internal-only despite containing no secrets. Its exact deeply frozen
shape is:

```js
{
  ok: true,
  purpose: 'ballot_publication | purchase_broadcast | delivery_start | quarantine_clearance_broadcast',
  chainId: '4663',
  registryAddress: '0x...20 bytes...',
  catalogVersion: '<canonical uint256 decimal>',
  catalogSnapshotHash: '0x...32 bytes...',
  assetVersionKey: '0x...32 bytes...',
  evaluationId: '0x...32 bytes...',
  evaluationKind: 'healthy',
  observedAt: 'YYYY-MM-DDTHH:mm:ss.sssZ',
  appliedAt: 'YYYY-MM-DDTHH:mm:ss.sssZ',
  freshThrough: 'YYYY-MM-DDTHH:mm:ss.sssZ',
  stateSequence: '<canonical positive signed-BIGINT decimal>',
  episodeId: null | '0x...32 bytes...',
  episodeGeneration: null | '<canonical uint256 decimal>',
  latestEpisodeEventId: null | '0x...32 bytes...',
  latestMaterialEvidenceHash: null | '0x...32 bytes...'
}
```

For the first three purposes all four episode/head fields are exactly `null`. For
`quarantine_clearance_broadcast` all four are non-null and equal the transaction-
checked current head. Every object is frozen recursively, fields are neither omitted
nor added, hashes/addresses are canonical lowercase hex, uints and signed BIGINT are
canonical decimal strings, and times are UTC ISO strings. The receipt contains no
raw evidence, reviewer identity, transport/idempotency key, query capability, URL,
signature, transaction, or clearance authorization.

Ballot publication, purchase broadcast, delivery start, and H2 Safe-clearance
package creation/broadcast must call the seam synchronously inside their own mutation
transaction after doing any needed preflight outside the transaction. The clearance
preflight may prepare only for the exact open generation and exact fresh evaluation;
the transaction-local seam rejects staleness, escalation, replacement generation, or
evaluation drift that occurred after preflight. It does not clear the episode. Only
finalized H2 evidence plus a strictly later healthy H1 evaluation can do that. H1
itself activates none of these consumer nodes.

## 7. Watcher and concurrency

```js
sweepRwaHealth(pool, { fetchFn = globalThis.fetch } = {})
```

The production worker runs a separately guarded five-minute timer. The sweep:

1. wakes on fixed PostgreSQL five-minute slot boundaries and first resumes the exact
   next planned page of any pending batch; only when none is pending does it obtain a
   new `observed_at`/`cycle_slot` and read one fresh finalized Registry V2 mirror
   snapshot without a write lock;
2. returns a named dormant/unavailable result when configuration or mirror readiness
   is absent;
3. bounds the active set before network work;
4. fetches and validates the provider response once, or derives one closed source
   failure;
5. reads `fetch_completed_at`, computes the immutable active set, batch, exact page
   boundaries, and evaluations, and deep-freezes all of them before any apply;
6. opens a header transaction, calls the health catalog reader to acquire the
   Registry share lock and recheck identity/version/snapshot/readiness, then locks the
   H1 singleton and checks slot replay,
   and inserts the batch plus every immutable planned page/evaluation before
   committing; the complete bounded plan is therefore durable before projection
   mutation and is resumable without another provider fetch;
7. for each missing page in ascending index, opens an independent transaction, calls
   the health catalog reader for the Registry share lock/recheck, then locks the H1
   singleton and affected current rows in ascending key order, rechecks the batch
   commitment, derives database `applied_at`, moves
   the exact planned page/evaluations to applied, inserts episode events, reduces
   sticky episodes/current, advances batch counters with compare-and-set, and commits
   that page once;
8. marks the batch complete only in the final page transaction after exact page/item
   equality; a zero-active-set batch completes in its header transaction.

The immutable sweep supports 0–2,048 versions in 0–8 pages; 257 is two valid pages,
not an all-or-nothing rejection. A crash after any page leaves prior pages durable
and the exact next page resumable by either replica. A poison record becomes one
closed per-version unknown result and cannot starve other pages. Global source
failure produces the same closed unknown predicate vector for all pages. No page is
green unless its exact evaluation committed, and public batch completeness remains
false until every declared page commits.

If the Registry snapshot changes or becomes stale before a planned page applies,
that transaction marks the batch `abandoned` with the closed reason and mutates no
page, evaluation, episode, event, or current row. An abandoned plan remains immutable
audit evidence and can never resume. The next fixed slot may create a new batch from
the new finalized snapshot. The partial unique index forbids a second pending batch
for one Registry.

Two processes may fetch concurrently, but the acceptance-key constraint and apply
lock permit one batch/projection transition per slot. A stale page never applies
after the Registry snapshot changes. A local in-flight guard prevents overlapping
fetches in one worker. The scheduler targets the next fixed slot boundary rather
than five minutes after completion, never runs two local fetches, and exposes
`lastAttemptedSlot`, `lastCompletedSlot`, `missedSlotCount`, and the last closed error
code. A slow run may miss a slot; it does not fabricate an observation, and natural
600-second freshness blocks consumers. Every network/parse/apply failure is isolated
by the existing `safe(label, fn)` wrapper and cannot stop unrelated jobs. The
measured implementation must complete a 2,048-version successful sweep inside a
240-second budget in the real-PostgreSQL harness, leaving one minute before the next
slot.

## 8. Reviewer and public API

H1 reuses the existing constant-time RWA reviewer key, durable reviewer latch,
per-reviewer rate limit, unforgeable route-trust token, and durable HTTP idempotency
ledger. It does not use `MOD_KEY` as reviewer authority.

```text
GET  /v1/rwa/health
GET  /v1/rwa/health/:assetVersionKey
POST /v1/rwa/reviewer/health/:assetVersionKey/enter
```

Public list query fields are closed to `state`, `limit`, and stable `cursor`; default
100, maximum 500. `state` is absent or exactly `healthy`, `health_unknown`,
`operational_quarantine`, `stale`, or `registry_inactive`. Each request opens a
read transaction, calls `finalizedStockCatalogForHealthV2` (thereby holding the
Registry share lock), derives eligibility against that one exact mirror snapshot,
and reads H1 rows in immutable
`(registry_address ASC,asset_version_key ASC)` order.

`registry_inactive` is never stored in H1. It is derived only when the exact
historical version in that finalized snapshot has `active=false`. This overrides
health readiness for public display/action blocking, but never closes, downgrades, or
rewrites its episode. A stale/unavailable/changed/identity-incomplete mirror returns
`health_registry_stale`, `health_registry_unavailable`, or
`health_snapshot_changed`; it never guesses inactivity, and
`state=registry_inactive` is not reported as an empty authoritative result.

The opaque cursor is base64url of this canonical JSON with no padding:

```json
{
  "kind": "rwa_health_v2",
  "state": "<exact filter or null>",
  "catalogSnapshotHash": "0x...",
  "registryAddress": "0x...",
  "assetVersionKey": "0x..."
}
```

Decode must yield one exact plain object, closed keys/types, the same filter and live
catalog snapshot, and values matching canonical re-encoding; otherwise it is
`health_bad_input` or `health_snapshot_changed`. Cursor fields are SQL seek values,
never authority. Stable keys that remain members cannot repeat. Health/filter
membership is deliberately weakly consistent across requests: a concurrent
evaluation/reviewer transition may cause a not-yet-returned row to enter or leave the
filter. The API does not claim a ranked immutable snapshot or no-skip membership
under concurrent state change. A Registry change is stronger and invalidates the
cursor instead of mixing catalogs.

The public predicate summary is always this ordered seven-element array, with each
`result` exactly `pass`, `unknown`, or `verified_failure`:

```json
[
  {"code":"provider_record","result":"pass"},
  {"code":"supported_chain","result":"pass"},
  {"code":"ticker_identity","result":"pass"},
  {"code":"token_identity","result":"pass"},
  {"code":"token_decimals","result":"pass"},
  {"code":"provider_active","result":"pass"},
  {"code":"fractional_tradable","result":"pass"}
]
```

The detail view returns effective state, readiness/freshness timestamps, that closed
predicate summary, episode generation/original time, clearance projection, and hash
commitments. List/detail omit provider asset IDs, raw payload fragments, reviewer
IDs, exception text, transport keys, internal URLs, and database fields not named by
this response contract.

Reviewer entry body is exact:

```json
{
  "state": "operational_quarantine | health_unknown",
  "ruleCode": "reviewer_material_drift | reviewer_verification_unknown",
  "reasonHash": "0x...32 bytes...",
  "evidenceHash": "0x...32 bytes..."
}
```

Only these pairs are valid; crossed pairs are `health_bad_input` before domain work:

```text
operational_quarantine <-> reviewer_material_drift
health_unknown          <-> reviewer_verification_unknown
```

The reviewer may enter/escalate only. There is no H1 clear endpoint.
The target must be an exact currently active finalized Registry V2 version read under
the shared Registry lock. An inactive historical version and its episode remain
readable, but H1 cannot open a new reviewer episode for it. Registry V2 does permit
deactivation followed by same-key reactivation and increments its on-chain activation
generation. Deactivation never deletes or closes an H1 episode. Reactivation changes
`activatedAt`, `catalogVersion`, and `catalogSnapshotHash`, so no evaluation from the
pre-deactivation snapshot is fresh or eligible and a complete new H1 sweep is
mandatory. An open pre-deactivation sticky episode remains open and blocking after
same-key reactivation and still requires H2 clearance; a terminal old episode remains
terminal history and does not reopen automatically, but the reactivated snapshot has
no green readiness until freshly evaluated. H1 neither fabricates nor infers the
Registry activation generation because the current finalized getter mirror does not
persist that mapping; CN-6 must add finalized lifecycle-event authority, and H2 must
bind the exact activation generation supplied by CN-6. No successor
`assetVersionKey` is invented merely because the same key reactivated.

The reviewer route first creates the existing durable HTTP idempotency reservation.
Its domain transaction then reads `requested_at`, locks the singleton, derives the
exact target generation and semantic action ID, and atomically writes the action,
episode/event transition, and current projection. HTTP completion storage occurs
after that commit under the existing fail-closed reservation protocol. An exact HTTP
replay returns the stored response. If completion storage failed after the domain
commit, the original key remains `in_progress`; the reviewer reads the action/detail
state and may use a fresh key. A fresh key with identical semantic content resolves
to the same action ID and inserts no second action/event/sequence mutation. Different
content under one transport key remains the existing durable
`idempotency_key_reuse`; more than 255 distinct non-escalating actions for an episode
is `health_evidence_limit`.

## 9. Error codes and precedence

Stable domain errors are:

```text
health_bad_input
health_asset_not_found
health_registry_unavailable
health_registry_stale
health_snapshot_changed
health_work_oversized
health_capacity_exceeded
health_slot_conflict
health_page_conflict
health_provider_timeout
health_provider_http
health_provider_oversized
health_provider_malformed
health_evidence_conflict
health_evidence_limit
health_state_conflict
health_not_fresh
health_blocked
```

Reviewer HTTP authentication/idempotency errors remain the existing RWA route codes.

Apply precedence is exact: input shape -> immutable Registry identity -> work bounds
-> canonical evidence/IDs -> singleton lock -> snapshot recheck -> replay/conflict ->
state transition -> append evidence -> projection update.

Normal action-wall precedence is:

```text
input/purpose -> asset existence -> Registry readiness/identity/capacity
-> exact snapshot equality -> reject open episode -> healthy kind -> freshness
-> expected evaluation ID -> expected state sequence
```

Clearance-broadcast precedence is:

```text
input/purpose -> asset existence -> Registry readiness/identity/capacity
-> exact snapshot equality -> require open episode -> expected episode generation
-> reject already-applied clearance -> healthy kind -> freshness
-> expected evaluation ID -> exact evidence-head tuple
```

Invalid input/purpose is `health_bad_input`; missing asset is
`health_asset_not_found`; absent/identity-invalid and stale mirrors are respectively
`health_registry_unavailable` and `health_registry_stale`; excess count is
`health_capacity_exceeded`; snapshot/evaluation/head mismatch is
`health_snapshot_changed`; episode branch/prior-clearance failure is `health_blocked`;
kind/freshness failure is `health_not_fresh`.

## 10. RED graph

The implementation ownership graph is binding:

```text
Modify  schema.sql
Modify  src/db.js
Modify  src/stockcatalogv2.js
Create  src/rwahealth.js
Modify  src/routes/rwa.js
Modify  src/worker.js
Modify  package.json
Create  test/fixtures/rwa-health-v2-vectors.json
Create  test/rwahealth.js
Create  test/rwahealth.postgres.js
Modify  test/rwaroutes.js
Modify  test/gates.js
Create  omerta-contracts/test/RwaHealthIdentityVectors.t.sol
Modify  docs/superpowers/plans/2026-08-26-grill-completion-umbrella.md
```

`src/db.js` registers only pg-mem compatibility implementations of `char_length(text)`
and `octet_length(bytea)` before applying the unchanged literal schema; real
PostgreSQL uses its native functions. The health catalog reader lives beside the ballot reader. All health domain/parser/
hash/paging/seam logic lives in `src/rwahealth.js`. Health public/reviewer routes are
registered inside the existing `registerRwa` closure so its constant-time reviewer
auth, latch, rate limit, trust symbol, and idempotency wrapper remain private and are
not copied or exported. `src/server.js` and `src/preflight.js` require no change: no
new secret, URL, boolean enable, or environment-controlled provider endpoint exists.

`src/worker.js` imports the H1 runner and registers an independent fixed-boundary
timer immediately after the guarded hourly timer and before any generic chain source
construction. Production calls `sweepRwaHealth(pool)` with no injected endpoint or
fetch. `fetchFn` exists only as an explicit function argument used by direct tests;
it is never read from config or a request. `test/rwahealth.postgres.js` is gated by a
dedicated test database URL and is the only lane that claims row waits/advisory
concurrency/performance. Package scripts expose the focused pg-mem and real-Postgres
lanes separately.

RED must prove all missing behavior against the current H1-absent branch:

1. the dedicated parser distinguishes every valid verified-failure state from each
   absent, unrecognized, conflicting, malformed, coercible, or filtered counterpart;
   valid other-chain-only deployments produce verified `supported_chain` failure;
   string/fraction/exponent/signed/overflow chain IDs and non-string ID/ticker/status/
   capability leaves produce unknown; a malformed address on another-chain entry
   invalidates the array; and duplicate 4663 entries are conflicting;
2. timeout during headers/body, redirects, non-2xx, content encoding, wrong content
   type, malformed/mismatched/oversized declared length, chunked overrun, exact
   2,000,000-byte boundary, invalid UTF-8/JSON/schema, duplicate keys at every depth,
   and duplicate identity ambiguity produce unknown, never green or fabricated
   quarantine; absent length plus a bounded valid stream succeeds;
3. lexical fixtures distinguish integer `18` from `18.0`, `1.8e1`, duplicate
   `tokenDecimals`, and nested duplicates without using `JSON.parse`;
4. a valid response omitting one expected provider record makes only that version
   unknown, while exact valid identity/status/tradability drift alone quarantines;
5. 0, 1, 256, 257, and 2,048 versions complete in exact 0/1/1/2/8 pages; 2,049
   produces the global capacity wall and no partial green; exact `2048 -> 2049 ->
   2048` recovery clears only the wall and still requires a complete new sweep;
6. a crash after each page leaves prior pages durable, resumes the exact next page,
   and completion is impossible until declared page/item equality;
7. exact 600-second observed-time freshness, fetch/apply time ordering, the
   post-clearance strict-both-times rule, and total absence of JavaScript time in
   domain outputs; a direct pg-mem `now()` query and ISO millisecond round-trip pass,
   production source uses `clock_timestamp()` after locks, and only real PostgreSQL
   claims row-wait timing;
8. healthy-after-issue does not clear; escalation preserves generation/original time;
9. reviewer can enter/escalate but cannot clear/downgrade/reset; crossed state/rule
   pairs and inactive historical targets reject before domain/transport completion;
   active -> healthy -> deactivate -> same-key reactivate rejects the old evaluation,
   requires a complete new sweep, preserves an open old episode as blocking, keeps a
   terminal old episode terminal, and never invents a successor version key;
   1,000 fresh
   idempotency keys carrying one semantic action create one action/event/sequence;
   255 distinct evidence-only actions succeed, 256 fails, and escalation remains
   possible;
10. unauthenticated/mod/player/forged-trust-token access fails before domain work;
11. HTTP idempotency replay/conflict/in-progress and crash boundaries between
    reservation, action insert, episode/current commit, and response completion are
    durable;
12. two replicas with different process-local start instants in one database slot
    accept one batch and one projection sequence; different slot content conflicts;
13. real PostgreSQL proves the Registry writer waits behind H1's held share lock, H1
    waits behind an active writer, the global lock order, and no page/reviewer/action
    commits against a mirror changed after the helper's confirm query;
14. Registry snapshot drift before a header or page apply rolls back only that
    transaction or abandons the exact pending plan; no stale later page can commit;
15. crash at every insert/episode/event/projection/counter seam rolls back that page
    atomically without rolling back earlier pages;
16. independent literal ID vectors match viem and Foundry; the semantic body derives
    all-pass/healthy end to end; mutating every raw/fixed field, tag,
    enum, and identity order changes its commitment; same ID/different evidence is a
    conflict;
17. literal DDL constraints reject cross-batch/page, cross-asset evaluation, wrong-
    generation episode/action/event/current substitutions, plus same-asset swaps of
    evaluation kind/observed time/applied time/evidence, episode severity/open time,
    event severity/evidence, current material-evidence head, reviewer evidence, and
    adverse-vs-healthy terminal evaluation kind; one-open-episode race, counters, and
    identical rebuild projection/sequence pass real PostgreSQL; one source ID cannot
    be replayed under a different event kind, reviewer outcome must match event kind,
    H2 sources can produce only nonterminal `clearance_applied`, and evaluation
    source kind/event kind/resulting severity must match the closed opened/escalated/
    terminal reducer table (no evaluation-backed `evidence_only`); reviewer opened,
    escalated, and evidence-only outcomes must match their exact requested-state/
    resulting-severity reducer branches, including rejection of unknown escalation;
18. abandon-after-header/each-page fixtures prove planned rows never win latest,
    readiness, public output, or rebuild; an applied prefix remains exact history;
19. public immutable-key seek paging rejects malformed/cross-filter/noncanonical/
    cross-snapshot cursors, never repeats stable keys, documents filter transitions,
    derives inactive only from a fresh finalized mirror, and exposes no forbidden
    evidence;
20. both internal seams reject extra/missing/wrong-type properties and return only
    the exact deeply frozen success/unavailable/receipt variants;
    `requireFreshRwaHealth` performs no connect/transaction/network/mutation;
    normal purposes reject every nonfresh/nonhealthy/open-episode state, while the
    clearance purpose requires exact fresh evaluation, open generation, sequence,
    event/evidence head and catches a preflight-to-transaction mutation; each input
    property is independently tested for omission, extra/undefined/accessor/inherited
    form, crossed normal/clearance nullability, zero/max/max-plus-one integer bounds,
    partial head, noncanonical hash, and purpose swap before the first query;
21. private provider bytes persist for issue/recovery evidence, are inaccessible to
    public routes, cannot be removed while referenced, and selective expiry leaves
    immutable hash/domain history intact; altered bytes/hash/count, a same-sized
    cross-batch body, a body on any source-failure batch, and post-storage corruption
    at reviewer/H2 read all reject;
22. fixed-slot scheduler tests prove local nonoverlap, no completion-relative drift,
    missed-slot telemetry, `safe` isolation, and independence from the generic chain
    event source;
23. a measured real-PostgreSQL 2,048-version fixture completes within 240 seconds;
24. source searches prove H1 has no signing, sending, Registry mutation, ballot,
    budget, purchase, delivery, token, ETH, Safe-clear, private-key, or generic
    execute surface.

Focused pg-mem tests cover deterministic and route behavior. A real-PostgreSQL
harness must cover row-wait concurrency, repeatable snapshot behavior, crash rollback,
and constraints before H1 is independently closed.

## 11. H2 handoff and closure truth

H2 alone will add the `RwaHealthOverlay` contract, seven-day Safe clearance package,
separate finalized-observation consumer identity/lock/checkpoint/raw-plus-decoded
inbox, ordered overlay-generation reducer, and atomic application into the H1
projection. Exact finalized clearance removes only the matching sticky generation;
a healthy evaluation with both `observed_at` and `applied_at` strictly later than the
finalized-clearance apply time is still required for effective green.

H2 must define a distinct authenticated reviewer clearance-attestation action. It is
not an H1 clear and cannot mutate H1 state. Its immutable ID binds:

```text
chainId + registryAddress + catalogSnapshotHash + assetVersionKey
+ episodeId + generation + currentSeverity + stateSequence
+ latestEpisodeEventId + latestMaterialEvidenceHash
+ recoveryEvidenceHash + freshHealthyEvaluationId + freshHealthyEvidenceHash
+ reviewerId + approvedAt + clearanceDeadline + exact Safe package hash
```

Exactly one configured reviewer must approve it, and
`clearanceDeadline = approvedAt + interval '7 days'`. The Safe package and overlay
event bind that attestation ID. H1 adverse entry/escalation actions cannot substitute
for clearance approval. Package creation and broadcast call the H1 clearance seam
with the entire bound head. Finalized H2 ingestion rechecks the entire tuple under
the Registry share lock, H1 lock, and its independent finalized-consumer order before
populating clearance fields. Any intervening episode event, new material evidence,
severity/sequence change, replaced healthy evaluation, deadline expiry, cross-asset/
Registry replay, or reviewer mismatch stales the package; mining or a transaction
hash does not waive the recheck. H2 also adds the composite clearance-evidence FKs
for episode events/current rows that H1 intentionally cannot reference yet.

H2 RED must reject absent/adverse-only/wrong-reviewer attestations, wrong Registry/
asset/episode/generation, substituted recovery or healthy evidence, expiry, and
mutations after review, signing, broadcast, mining, or immediately before finality.

H1 completion will not mean H2, CN-6, CB-bridge, A3, R, O2, delivery, deployment,
configuration, Safe execution, finality, or production cutover is complete. Until H2
and its consumer are independently closed, every sticky H1 episode is intentionally
unclearable and every dependent future pipeline remains dormant.
