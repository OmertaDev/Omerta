# Independent native ETH periphery review

2026-11-04; implementation phase on base `d70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e`, modified
`codex/pr310-native-eth-rewards` working tree. This is a bounded manual trust-boundary review of the
new native rail, not a complete backend/journal audit or deployment authorization. The adapted
access-control, execution-trace and external-precondition methods/pins are recorded in
[the independent contract review](INDEPENDENT-ETH-REVIEW.md).

Reviewed raw-file SHA-256 snapshot:

| File | SHA-256 |
| --- | --- |
| `src/ethstaking.js` | `7740bb5c022a8f0f40dfe2a99063dfd998d076bf38d2716d7a3c057ef3e1d764` |
| `src/ethrewardsworker.js` | `715e53bb4fcff992947d19312b63e9c942131566a476f1325ff30ceb26f54df8` |
| `src/marketv2keeper.js` | `a9c83d0e455981ba3f104f3f7c045b0b51c0f69747c3e99046b47501bacb8da8` |
| `public/eth-staking.js` | `1e06327f1195d33b44b0add5d1a31156aae94fca6b108e7890c17f7a34264733` |
| `tools/eth-rewards-readiness.js` | `6b0a6b89d215657e22d681ba00024283bc207dd1d11885ddaa6de05f3803d23e` |
| `tools/eth-rewards-keeper-plan.js` | `7add6310d397c0cda62224773e4bc1f898d1a106502f931c09af817855a2136a` |
| `tools/player-genesis-deployment-plan.js` | `9d2afa2664bf2ad55f48aa41377957e887ad97e96ccbe5c477d7c88e9fb5fd88` |
| `tools/player-genesis-preflight.js` | `516c6325775f05fec990b603c6117c96f282e2861148a777ca0b2c9498f55e6d` |

Direct dependencies inspected: `src/routes/ethstaking.js`, the existing `src/keepertransactions.js`
signing/reconciliation boundary, `src/marketv2abi.js`, ABI-pack generation, and the native additions to
the generic genesis preflight. Native synthetic test sources were inspected; parent-owned executed
tests and PostgreSQL journal evidence remain separate.

## Boundaries checked

- **Player authority:** both player routes require existing account authentication. The linked wallet
  is loaded by parameterized account-ID lookup and rechecked after simulation. The server returns only
  unsigned, zero-value registration/finite approval/stake/self-withdraw/self-claim calls. There is no
  player-rail key read, signing method, arbitrary transaction target, recipient or calldata input
  (`src/routes/ethstaking.js:3-5`; `src/ethstaking.js:31-52,151-203`). Wallet signatures are supplied by
  the actual wallet transaction, rather than an off-chain signature accepted by the server.
- **Read identity:** the player snapshot binds chain 4663, a confirmed fresh block, token/vault/collector
  runtimes, vault owner/original Safe, reciprocal distributor/vault/OMR identities, sealed OMR policy,
  live vault custody role and fixed 30-day constants. Configuration fingerprint, source block hash,
  chain and account link are rechecked before returning a call (`src/ethstaking.js:55-109,199-203`).
  Amount/index/epoch parsing preserves exact integers and 18 decimals; admission applies to new stake
  actions, while mature exits and claims omit pause/admission checks.
- **Browser transaction intent:** locally encoded selectors/arguments must equal the complete prepared
  calldata. Exact account, token/vault target, zero value, chain and expiry are checked. Wallet account
  and chain are checked again, the prepared block hash is read from the wallet provider, and a latest
  `eth_call` precedes sending. Approval and stake require separate user actions with fresh preparation;
  there is no automatic stake or resend (`public/eth-staking.js:15-35,100-139`). The API configuration,
  site origin and wallet provider remain trusted inputs; this does not make a compromised site trustless.
- **Automation opt-in:** sample environment switches are off. The worker requires the environment
  switch, exact manifest-byte SHA, valid chain-4663 ETH-only manifest, both manifest enable flags and
  PostgreSQL capability before reading credentials or constructing signing clients. Generated keeper
  drafts disable both flags. Local in-flight exclusion prevents overlapping ticks, and bounded public
  logging avoids serializing provider/key errors (`src/ethrewardsworker.js:16-73`;
  `tools/eth-rewards-keeper-plan.js:9-29`). The signing key belongs only to upkeep and must match the
  distinct manifest keeper; the governance Safe is not that signer.
- **Keeper scope:** allowed native jobs are collect/convert/fund/finalize/refresh. Runtime pins are
  checked at one fresh block; reciprocal vault/distributor and fixed manager receiver checks precede
  planning. Amounts use actual inventory and remaining per-call/day caps. Conversion checks active,
  pause, health, the on-chain minimum and bounded deadline. Calls are simulated, zero-value, encoded
  from the bounded job table, and reorg/freshness checked (`src/marketv2keeper.js:13-19,169-239,322-358`).
  The contract remains the final execution guard when chain state changes after preparation.
- **Signing/persistence:** native upkeep reuses the existing wallet/chain PostgreSQL advisory lock,
  nonce/unknown-pending checks, signed-byte integrity verification, gas budget and persisted-before-
  broadcast journal. Reconciliation resends only the identical signed transaction and validates
  receipt identity/canonicality; native jobs do not credit game cash or create custody balances
  (`src/keepertransactions.js:66-122,222-255,315-403`). This review inspected that call boundary but
  did not independently execute its PostgreSQL concurrency/recovery suite.
- **Deployment/readiness:** the offline planner predicts the fixed collector address, admits it only
  as a receiving contract holder, gives only the staking vault typed custody, binds the distributor
  once, and starts conversion inactive/paused. Runtime/preflight checks preserve reciprocal pins and
  no-operator collector admission. The readiness tool verifies reviewed candidate bytes, advancing
  fresh headers, Safe implementation/owners/threshold/modules/guard/fallback/nonce, actual runtimes,
  roles, policy and canonical key. It emits unsigned zero-value funding/Safe calls and never signs or
  broadcasts. Health confirmation is proposed separately from later activation after recovery grace;
  native funding remains independent (`tools/player-genesis-deployment-plan.js:184-202,232-258,340-360`;
  `tools/eth-rewards-readiness.js:25-37,62-139`).

## Additional operational assumptions

No confirmed custody or authorization bypass was found in this scoped manual review. These limits
remain explicit:

1. Default `eth_finalize` selects only the latest closed epoch (`src/marketv2keeper.js:193-201`). After
   a prolonged outage, older unfinalized funded epochs need an explicit `epochId` job or a manual
   permissionless finalization. Claims do not expire, but their prerequisite is not automatically
   backfilled by the default job.
2. Existing pending-journal reconciliation authorizes retained target plus runtime, rather than
   requiring the prior job kind still be listed (`src/marketv2keeper.js:388-391`;
   `src/keepertransactions.js:401-403`). Removing only a conversion job while retaining collector
   funding/collection jobs does not revoke an already signed pending conversion. On-chain conversion
   pause/health gates are the execution stop; disabling all native jobs stops worker reconciliation.
3. Snapshot/unsigned-proposal expiry is review metadata, not transaction cancellation. Keeper deadline,
   actual output floor and on-chain policy protect conversion at execution. Changing policy/config or
   stopping a worker cannot erase a transaction already handed to a chain/mempool.
4. The player interface fails closed when its manifest, collector identity or RPC cannot be verified.
   This can temporarily hide UI exits/claims even though direct on-chain mature exits/earned claims
   remain independent of conversion health. Token recipient/operator requirements still apply.
5. Safe health remains a manual attestation; finalized observations, minimum liquidity and fresh
   headers do not prove sequencer uptime, executable depth or absence of MEV.

No live keys, user wallets, production signing, sends or activation were used in this review. No
periphery tests or static engine were run by this reviewer; the parent must attach fresh native
synthetic/browser tests, ABI integrity checks and relevant PostgreSQL journal evidence to final hashes.
Material changes to authentication, recipient/target selection, manifest enablement or journal replay
policy reopen the affected part of this review.

## Final preflight addendum

Reviewed final preflight changes at `8f716e05269d079b98aa74f9a47a16e376d03873`, including the
restored clock guard in its ancestor `7310cb3ea41919e1e32ae14f5b66c0aa267e6e3d`. This addendum
supersedes only the earlier preflight-tool hash in the snapshot table. Original scope, exclusions,
trust assumptions and the five operational risks above remain unchanged.

| Final file/evidence | Raw SHA-256 |
| --- | --- |
| `tools/player-genesis-preflight.js` | `e4321f6272f919afcf49e941f6c95c509613f160ede9489ef9ba7dcd2f17897a` |
| `test/player-genesis-deployment.js` | `e70e1c2bf150554d94feb5a5039aa2aa9cd3e45ca42a2ef6e7ca29fd47b5d748` |
| `auditcontext/eth-player-genesis-preflight-focused.log` | `f5a2ec16a1d1a3140fe0266022b71b67483e51b94efbb9a1928a15161f24beca` |

The restored `MAX_FUTURE_CLOCK_SKEW_SECONDS = 15n` preserves the original independent wall-clock
bound. Snapshot and RPC-tip timestamps must be fresh at entry and again after the final RPC/reorg
reads; coherent replayed RPC data cannot establish freshness against a stale independent clock
(`tools/player-genesis-preflight.js:16,22-42,180-200`). Tests retain rejection at 16 seconds of future
skew and entry/completion replay/staleness cases (`test/player-genesis-deployment.js:368-396`).

The former success return referenced undefined external reward-pool variables and could throw after
configuration validation. It now returns the native asset, predicted collector/staking-vault
addresses and canonical pool from the validated plan. Predeploy explicitly labels bindings
`predicted-only`; prepared labels them `verified-dormant` only after actual deployed runtime,
reciprocal binding, custody/admission and dormant-state checks. Both retain
`executableDepthForBudgetVerified: false` (`tools/player-genesis-preflight.js:87-126,194-201`).
This resolves a preflight availability/evidence-reporting defect; it adds no executable purchase,
signing or broadcast authority and makes no live liquidity/depth guarantee.

The focused test selector runs the four existing preflight checks and asserts the count is exactly
four. Native evidence-shape assertions were added to both phase-success cases; the existing nonce,
code, Safe, registry, inventory, clock and partial-preparation refusal checks remain present. The
retained log shows all four PASS lines and `player-genesis-deployment: 4 focused checks passed`.
This reviewer read the final diff and that evidence without rerunning tests or changing source/tests.
No additional security finding was identified within this bounded addendum.
