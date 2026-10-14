# v4 hook and settlement review — 2026-10-14

## Result and phase

The current working-tree hooks resisted the reported attack paths exercised here.
Ten new regression tests preserve their existing defenses. No production contract
was edited and no critical/high exploit was confirmed within this scope. This is
a local source/test review, with no deployment, activation, RPC fork, or broadcast.

Source baseline: `e56cf576065c5f1bbb9bb55115f5961267f7d654`, **dirty**. Existing
changes were preserved. [manifest.json](manifest.json) pins the reviewed source,
test files, compiler configuration, dependency versions, compiled artifact hashes,
and retained evidence. [baseline.patch](baseline.patch),
[baseline-status.txt](baseline-status.txt), and
[baseline-hashes.json](baseline-hashes.json) record the starting state.

The conclusion applies to those file hashes and their recorded configuration.
There is no claim about a deployed chain/address or an entire protocol audit.

## Inputs and methods

Both supplied X threads were retrieved and read, along with the linked Bucket
report and the directly relevant public Letscash and BuilDefi reports from the
supplied SB-Security repository. [Source manifest](source-posts/README.md) pins
the post snapshots, report revisions, hashes, and relevant findings. External
findings are review hypotheses, not automatically findings about this project.

The repository security policy's pinned method checkouts were verified:

| Method | Commit | Applied work |
| --- | --- | --- |
| Pashov | `c577eb7799c349de0acb187ba00ca98e14e436fd` | Access-control, execution-trace, boundary, and invariant passes from `solidity-auditor/references/hacking-agents/`. |
| Plamen | `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` | `agents/depth-external.md`, `agents/depth-state-trace.md`, phase-5 attacker/defender verification of concrete paths. |
| Trail of Bits | `d3323cefbcf645678b8dc481de204b02ad3d02dc` | Context/trust-boundary building, property-test principles, and `fp-check` source-to-sink/false-positive verification. |

Also applied `.agents/skills/v4-security-foundations/SKILL.md`. These were focused
manual passes and native tool runs with four available agent slots. The complete
upstream orchestration and every upstream tool were not invoked.

## Scope and system model

Primary scope: `src/market-v2/OmertaHookV2.sol`, `src/OmertaHook.sol`,
`src/market-v2/OmertaSwapRouterV2.sol`,
`src/market-v2/core/OmertaPoolManagerV2.sol`, and
`src/market-v2/OmertaGenesisCoordinatorV2.sol`.

Followed dependencies include the restricted token's transfer/operator policy,
`GenesisPlayerSale`, manager protocol-fee helpers, finalized hook epochs and
`OmertaMarketStateV2`, and pinned v4 core/periphery, Permit2, and OpenZeppelin
callee behavior. Inventory/stability observation gates were inspected for the
reported instantaneous-state hypothesis; this was not a complete strategy audit.

Trust and asset boundaries:

- Manager-only hook callbacks additionally bind the canonical pool key. The
  initializer's identity is the manager-authenticated `sender`, not hook data.
- Hook fee claims are credited from actual swap deltas, not contract balances.
  The hook takes the matching currency and returns a matching positive fee delta;
  the manager requires all transient deltas to settle before relocking.
- The current manager independently accrues its immutable 500 bps base in both
  directions, including approved zero-fee and unhooked routes. The hook detects
  that accounting mode and does not collect the base twice. Its policy getter is
  not evidence of runtime integrity; deployment must bind the reviewed bytecode.
- The router derives its payer from `swap`'s caller. A pending full-payload hash
  and immutable manager authenticate the single callback. Limits apply to actual
  fee-adjusted deltas, and OMR settlement checks the exact received balance change.
- Hook swaps do not execute arbitrary recipient/observer processing. Fee payouts
  use accrued claims and effects before transfers; current-hook buckets are
  isolated and claim redirection belongs only to the bucket recipient.
- Graduation joins sale proceeds, initialization, and real position minting in
  one reverting transaction. It does not catch arbitrary mint/unlock failures
  and translate them into a terminal refund state.
- The hooks consume neither off-chain signatures nor trader identity encoded in
  `hookData`; signer replay/indexer concurrency is outside these mechanisms.

## Hypotheses and disposition

| ID | Reported class | Working-tree evidence and disposition |
| --- | --- | --- |
| V4-01 | Forged callback, pool identity, or hook data | All six active callbacks reject a nonmanager; all five key components are checked in each callback. Differential fuzzing preserves settlement and claims for arbitrary hook data. No exploit reproduced. |
| V4-02 | Predictable pool initialized at an attacker price | Real manager calls to initialize a fresh hook and the coordinator's pool reject the unauthorized initializer. Both pools remain uninitialized and the intended initializer subsequently succeeds. |
| V4-03 | Temporary `take()` balances fabricate eligibility/revenue | A real unlock with an unpaid `take` reverts `CurrencyNotSettled` and rolls back assets/claims. A fully repaid transfer to the hook increases surplus but creates no claims; sweeping cannot distribute that surplus as fees. |
| V4-04 | Fee based on requested rather than filled amount | Price-limit partial fills exercise buy/sell and exact-input/output paths. Nonzero charges use the actual unspecified-side delta and remain within the relevant cap. Restricted-manager integration tests separately enforce base revenue. See the economic limitation below. |
| V4-05 | Nested unlock permanently fails graduation/enables refunds | The coordinator bubbles exact `AlreadyUnlocked`; sale release, auction sweep, pool initialization, and migration state roll back. Cancellation remains false. A subsequent normal migration succeeds. |
| V4-06 | Unsolicited balances contaminate graduation spend/refunds | Forced 7 ETH at the coordinator and 2 ETH at PositionManager cannot alter proceeds-derived residual rights or block minting. Exactly 9 ETH remains surplus after accounting for residual credits. |
| V4-07 | Recipient/processing failures or loops brick swaps | Current hook callbacks contain bounded accounting and manager reads/takes, with pull payouts. Existing compatibility-hook observer regressions verify observer work outside settlement cannot poison a swap unlock. |
| V4-08 | Graduation exceeds signed/per-tick liquidity limits | Checked v4 casts/per-tick checks fail closed; canonical initialization prevents prior dust at the boundary ticks. With current fixed OMR supply `1e26` and native budget bounded by `int128.max`, the full-range token/native formulas bound `L` to about `1.31e32` (including boundary correction); even the spacing-1 core limit exceeds `1.91e32`. An arbitrary replacement token/reserve/manager needs renewed analysis. No current-supply exploit established. |
| V4-09 | Flash spot/liquidity or static size cap implies safety | Market snapshots require a complete fixed epoch, historical minimum liquidity, and freshness. Tests cover refresh spam, zero-liquidity intervals, boundary swaps and time-weighted prices. Opening caps and a bounded pressure surcharge do not guarantee sandwich resistance. |

No new production-code finding was promoted from these hypotheses. The record
retains both rejected hypotheses and limits rather than reporting every static
diagnostic as a vulnerability.

## Executed evidence

Tools: Forge 1.7.1 (`4072e48705af9d93e3c0f6e29e93b5e9a40caed8`), native solc
`0.8.26+commit.8a97fa7a.Windows.msvc`, Slither 0.11.6. Configuration: optimizer
enabled, 800 runs, Cancun; the configured per-file IR restrictions are retained
in [foundry-config.json](foundry-config.json). Commands ran from `omerta-contracts`
using `C:/Users/Jorge/.foundry/bin/forge.exe`.

All fuzz commands below use `--fuzz-runs 512 --fuzz-seed 0x2109737503393554544`.
All completed tests passed. Counts below are suite executions and include
inherited cases rerun under more than one test contract. This is scoped coverage,
not the full repository suite. The three final invariant executions performed
768,000 calls in total with zero reverts.

| Command suffix / suite | Result | Evidence |
| --- | --- | --- |
| `test --match-path test/market-v2/OmertaHookV2.t.sol -vv` | 17 unit/fuzz tests + 1 invariant; invariant 512 runs x 500 calls = 256,000 calls, zero reverts | `baseline-hook-tests.log` |
| `test --match-contract '^(GenesisCoordinatorV2Test\|PlayerGenesisIntegrationV2Test\|RestrictedMarketIntegrationV2Test\|RestrictedPoolManagerV2Test\|RestrictedRevenueBoundariesV2Test)$' -vv` | 80 passed; includes two invariant executions at 512 x 500 = 256,000 calls each, zero reverts | `boundary-retest.log`; original `boundary-suites.txt` also retained |
| `test --match-path 'test/market-v2/*RegressionV2.t.sol' -vv` | Initial 16 passed, including 7 new hook tests and the first 2 new graduation tests | `exploit-regressions.log` |
| `test --match-path test/market-v2/GraduationSettlementRegressionV2.t.sol -vv` | Final 10 passed: 3 new tests + 7 inherited coordinator cases | `graduation-regressions.log` |
| `test --match-path test/OmertaHook.t.sol -vv` | 52 passed | `compatibility-hook-tests.log` |
| `test --match-path test/audit/OmertaHookObserverDoS.t.sol -vv` | 2 passed; this deterministic suite needs no fuzz argument | `observer-regressions.log` |
| `test --match-contract '^(LPRevenueEnforcementV2Test\|MarketStateV2Test)$' -vv` | 12 passed | `market-boundary-tests.log` |

The baseline hook invariant run's exit was zero (captured tool completion); the
other completed test commands additionally retain `.exit` files. The original
boundary run's random seed was not retained, so the final deterministic rerun is
the reproducible evidence. No failing exploit was found that required a
production fix or a pre-fix/post-fix proof.

New graduation regressions execute real PoolManager, PositionManager, Permit2,
hook, coordinator, and sale code with an auction fixture and mock ERC20. Existing
restricted-market/player-genesis integration suites cover the sealed-policy
integration. This combination is not a target-chain rehearsal.

Slither analyzed both hooks, router, manager, and coordinator: 63 raw diagnostics
across five successful outputs, individually grouped/dispositioned in
[STATIC-TRIAGE.md](STATIC-TRIAGE.md). Raw JSON, logs, and detector exit statuses are
retained. Diagnostics yield nonzero detector exit codes; JSON `success: true`
confirms analysis ran, not that there were no findings. The coordinator's first
native attempt failed with stack-too-deep; the configured IR rerun succeeded.

Static command pattern:

```powershell
$env:PATH = 'C:/Users/Jorge/.foundry/bin;' + $env:PATH
slither <target.sol> --compile-force-framework solc --solc cache/verify/solc-0.8.26.exe --exclude-dependencies --filter-paths lib --json <evidence.json>
# For the coordinator's successful analysis, additionally:
$env:FOUNDRY_VIA_IR = 'true'
```

## Residuals and release boundary

- Fee modes have different economic bases: exact input deducts a percentage of
  actual output; exact output adds a percentage of actual input. Both pay the
  specified on-leg rate, but that does not prove identical cost for equivalent
  final fills. At a linear price, a 5% output fee needs `Q / 0.95` gross output
  to deliver `Q`; a 5% input fee costs `1.05 * Q` units at that price. This review
  preserves the explicit unspecified-leg convention rather than silently
  changing tax economics. No equality-of-economic-rate claim is made.
- The raw liquidity measure, opening size cap, and sell-pressure toll do not
  promise protection against all MEV, wash volume, or splitting strategies.
  Actual router slippage limits and chosen price limits remain necessary.
- Historical epoch guards are not guarantees about instantaneous spot prices;
  the complete inventory/stability economic policies were outside this review.
- No chain-specific fork, target runtime/address verification, full symbolic
  proof, or full repository/release suite was executed. The source-only changes
  here are tests and review evidence. Any deployment needs the repository's
  separate owner launch acceptance and exact runtime/configuration checks.
