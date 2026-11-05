# PR #310: native ETH rewards for OMR stakers

Review date: November 4, 2026 (America/New_York). Phase: repository implementation,
before deployment or activation. Primary implementation revision:
`83ba8baac52d64614a2f4b82a7b230db1e16c80f`, with deployment/preflight follow-ups
`7310cb3ea41919e1e32ae14f5b66c0aa267e6e3d` and
`8f716e05269d079b98aa74f9a47a16e376d03873`, based on PR #310 head
`d70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e`. Historical source-transfer metadata
is sealed separately at `cfe621381ca778af58892b64b9ae5889c1e2394d`.
The final verification manifest identifies exact source/artifact/evidence hashes.

## Result and scope

The extra 50-bps trading allocation funds native ETH rewards for OMR held in
`OmertaEthStakingV2`. The 350-bps base allocation and its 127/51/76/96 split are
unchanged. LP fees and bounded stability charges remain separate. Manager and
Hook constructor/getter APIs, auction admission, and existing claim/refund rights
remain intact. Active WBTC holder-manifest contracts, tests and the off-chain
epoch generator are retired; historical review records retain their original meaning.

Each OMR deposit creates its own 30-day withdrawal lock. Mature principal continues
earning until withdrawn; top-ups do not extend earlier locks. Rewards use OMR-seconds
in 30-day receipt-time funding epochs. Closed finalized epochs have immutable budgets
and no claim expiry. Partial mature exits remove only future weight. Relocking changes
withdrawal eligibility without manufacturing reward weight. Native claims and mature
principal exits remain independent of conversion pause and oracle/health state.

The fixed collector receives manager bucket 4, verifies actual receipt deltas and
forwards native ETH to its reciprocal runtime-pinned staking vault. Only the Safe or
keeper may convert OMR through the canonical manager/router/Hook/key, under immutable
caps, a bounded Safe health lease, recovery grace, fresh observations, deadlines and
actual minimum output. No arbitrary recipient, owner sweep or external purchase route
is introduced. The vault is the custody operator; the collector is receiving-only.

Scope includes these two contracts, direct token/router/manager/Hook/observation
boundaries, their tests, deployment/preflight/runtime bindings, bundled ABIs, keeper
jobs and disabled wallet UI/worker integration. The independent reviews retain
function-level traces, hypotheses and assumptions:

- [Contract model](../../../auditcontext/DOSSIER-contracts.md) and
  [independent contract review](../../../auditcontext/INDEPENDENT-ETH-REVIEW.md).
- [Periphery model](../../../auditcontext/DOSSIER-periphery.md) and
  [independent periphery review](../../../auditcontext/INDEPENDENT-ETH-PERIPHERY-REVIEW.md).
- [Static review](STATIC-REVIEW.md), [individual dispositions](STATIC-TRIAGE.json)
  and [compiler/source pins](COMPILATION.json).

The manual passes adapt the repository policy's pinned Pashov access/math/execution,
Plamen economics/external-precondition and Trail of Bits context/property methods.
They are bounded agent-led passes, not claims that whole upstream orchestrations ran.

## Executed verification

Forge 1.7.1 (`4072e48705af9d93e3c0f6e29e93b5e9a40caed8`), native Solidity
0.8.38+commit.1835d247, optimizer 800 and Cancun were used with unchanged compilation
restrictions: market periphery/tests via IR; restricted manager non-IR.

- Full Forge: **1,714 passed, zero failed, two opt-in Robinhood fork setups skipped**,
  across 126 suites. Fuzz seed `0x5`, 512 runs for each of 83 fuzz properties;
  23 invariants at 64 runs × 64 calls. The native rail includes 28 staking tests,
  two staking invariants, 16 collector tests and four real-market integration tests.
- Actual restricted token/manager/Hook/router/market-state integration exercises
  buy/sell fee collection, canonical OMR conversion, native funding, stake-time shares,
  native claims and mature exits. Negative cases bind the concrete canonical market.
- Native keeper, ABI, readiness, upkeep, worker and wallet-preparation suites pass
  against synthetic RPC; source/bytecode trust checks pass. Browser checks use an
  isolated synthetic provider with outbound requests aborted.
- Eighteen keeper transport cases pass against a new loopback-only PostgreSQL 18.4
  test cluster, including atomic bookkeeping rollback and independent-worker advisory
  locking. The test cluster was stopped. No production database or chain was used.
- The player planner's nine unchanged offline checks passed in earlier full-command
  prefixes. All four affected preflight checks and their mutation controls pass on
  final source with `--preflight-only`. The default 13-check CI command remains intact;
  no successful local exit of that entire default command is claimed. The fresh
  PositionManager artifact passes all 71 source pins and exact compiler remappings.
- Gate inventory and SQL-shape checks pass. Historical compatibility remains
  source-only: exact approved postimages project to pinned predecessor bytes;
  unknown changes still reject. Prior backend/native execution results do not transfer.

The first focused run exposed a test fixture deadline sampled before a cheatcode time
jump. It was interrupted after that failure, then fixed with `vm.getBlockTimestamp()`;
the isolated retest and full run pass. Production deadline validation was unchanged.
The initial Slither Foundry adapter failed on missing split build-info output. A fresh
native standard-JSON compilation reproduced both target creation/runtime templates
byte-for-byte; Slither then analyzed that exact closure. These initial failures are
retained alongside their successful replacements.

Player preflight also exposed two fail-closed port defects: the removed external-pool
helper block had taken the original 15-second clock-skew constant with it, and the
returned evidence still referenced removed external-pool locals. The constant is
restored; native collector/vault/key evidence now distinguishes predicted addresses
from verified dormant bindings without claiming executable depth. Both failures and
the final four-check result are retained. A donor PositionManager artifact was rejected
for different remappings and replaced with the fresh isolated build. The current-native
control census was updated to its exact five new inputs and one additional replacement;
historical pins, mutation refusals and native workloads are preserved.

Slither 0.11.6/crytic-compile 0.4.2 ran 102 detectors and retained 124 diagnostics.
All 32 native and eight shared-router diagnostics were traced. No confirmed in-scope
critical/high/medium defect was established. The other 84 dependency diagnostics are
retained with explicit dispositions/exclusions; 67 are outside a full vendor re-audit.
A findings exit is not a clean scan. Raw static inputs/results are in
`evidence/raw-static.zip`; compiler, detector and archive hashes are retained.

## Limits and deployment gates

This is scoped implementation evidence, not activation approval. Safe/keeper timing,
health attestations, executable conversion depth and MEV remain operational/economic
assumptions. Funded rewards vary with actual receipts; no yield, earnings or availability
guarantee is established. Deployment-specific addresses, authorities, runtime acceptance,
liquidity, custody reconciliation and funding remain unverified.

All UI/worker production opt-ins remain off. The five-step browser deployment route
stays fail-closed: it expects approved pre-existing rewards dependencies, while a
collector needs its actual canonical Hook deployed first. The full player deployment
planner orders those dependencies; accepting a browser sequence remains separate.
Default upkeep finalizes the latest closed epoch; older missed epochs require an
explicit epoch job or permissionless manual finalization. Removing a job does not
cancel already signed transactions; on-chain pause/health checks stop conversion.
The UI can fail closed while direct on-chain claims/exits remain available.

The existing blocked Daybreak family-fee combined backend/EVM/wallet review is outside
this change and is not cleared or bypassed. Fresh full hosted npm/PostgreSQL cohorts,
combined-main acceptance and production/fork activation evidence are not transferred
from prior PR revisions. No merge, deployment, production signing, funding or activation
is performed by this patch.
