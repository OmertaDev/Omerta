# Restricted liquidity automation — implementation and security review

**Date:** 2026-09-08. **Release phase:** local implementation candidate, before deployment.
**Target:** Robinhood mainnet, chain 4663. **Base repository revision:**
`e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`, with substantial pre-existing working-tree changes.
The source and artifact manifests identify this review's exact bytes; the base commit alone does
not identify the implementation. No production transaction, funding, recipient rotation or
activation occurred during this review.

The implementation closes the routine fee, custody, buyback, reserve delivery and keeper-recovery
paths under explicit initial policy. The review found and corrected contract startup/configuration
defects and backend receipt, rounding, historical-price and outage-recovery defects. The final
focused contract, PostgreSQL, local EVM and full backend checks passed. The source, artifact and
evidence manifests identify the exact reviewed files and retained execution results.

## Authorized behavior and scope

The owner requested implementation of the proposed unattended liquidity flow and an audit of the
new contracts. The earlier instruction **character mint revenue is 100% DEV** remains binding.
Other agreed allocations remain unchanged: non-mint fees 25% Vig / 10% treasury / 15% community /
50% DEV; bonds 75% POL / 15% DEV / 5% treasury / 5% Vig; LP trading fees 75% Desk / 25% Vig;
genesis proceeds 37.5% LP / 25% treasury / 22.5% Vig / 15% founder. Existing sell-tax splits remain
unchanged. Routing rounding remainders is documented in the relevant contract and tests.

| Production component | Reviewed authority and behavior |
| --- | --- |
| `FeeRevenueRouter` and modified `OmertaFees` | Separate non-mint routing with fixed recipients; mint remains directly payable to DEV. Atomic payment/nonce rollback on rejection. |
| `LiquidityBuybackExecutor` | Four distinct fixed-purpose instances; exact native-to-OMR swap, physical delivery, action/day/cooldown/oracle bounds, no arbitrary call or mint authority. |
| `ProtocolLiquidityVault` | Fixed v4 pool and dependencies, protected full-range foundation, exact contributions/refunds, bounded inventory funding, 75/25 fee routing, warmup and emergency custody. |
| Modified `OmertaBond` and `ILiquidityHealth` | Installed health guard and limited emergency guardian; future-price rejection; old vested claims remain available through issuance pause. |
| `GenesisLifecycleController` | Exact CCA/LBP commitment, correct clock and ABI, actual migration success, fixed unsold/proceeds recovery, one-time foundation adoption and warmup. |
| `KeeperGasVault` | Prefunded operating subsidy, allowlisted destination, refill cap, common day budget and cooldown; owner-only paused recovery. |
| `BankBufferVault` | Optional exact-asset deficit funding through the pinned Transmuter, no debt issuance or arbitrary destination. |
| Keeper, indexer, policy and existing withdrawal queue | Durable signed bytes and nonce recovery, canonical receipt proofs, exact SQL bookkeeping, historical price policy, actual claim backing, deployment-bound health and capped daily offerings. |
| Deployment/operations integration | Offline artifact-bound CREATE/Safe plan, explicit public policy manifest, separate worker clock, approved RPC fallback, bounded execution and exception alarms. |

The source inventory includes the complete callees used by those components: the reviewed local
OMR/Hook/splitter and Bank boundaries, OpenZeppelin guards/ownership/transfers, v4 PoolManager and
PositionManager, and Permit2. Static analysis includes ten top-level contracts, including the
unchanged Hook and splitter integrations. This is not a new audit of arbitrary ERC-4626 assets,
proxy implementations, all upstream AMM behavior, an unrelated game feature or the complete
withdrawal-signing service. The queue changes and their signer boundary are explicitly included.

The previous comprehensive review and mint amendment retain their original scopes and source
hashes. This package supplements them; it does not rewrite their historical conclusions.

## System and failure model

Safe governance selects the initial recipients, budgets, dependencies and emergency roles.
Restricted keeper identities trigger typed operations. Those identities have no Safe ownership,
OMR minter authority, general transaction executor, NFT withdrawal authority or voucher-signer
authority. The existing queue helper uses its separately configured voucher key. Distinct keys
do not establish process isolation when both keys are configured on the same worker.
Protected principal remains in the vault-owned position. Emergency recovery is available only
after the unhealthy latch and pays the immutable Safe destination.

The important sequence is **receive revenue → spend within policy → deliver actual tokens →
confirm the receipt → credit the appropriate books**. Vig reserve and prize tokens physically
reach VoucherClaim before the ledger recognizes them. Prize earmarks do not create immediate
reserve authority. Desk and Community receipts remain separate, and POL inventory creates no
gameplay issuance. Direct token revenue never fabricates an ETH sale or an oracle price.

The transport stores exact signed bytes, nonce, expected code hash, payload and budgets before
broadcast. One PostgreSQL advisory-lock domain coordinates each chain/wallet. An uncertain
submission resumes those bytes rather than creating another spend. Canonicality is checked
before settlement and after required external receipt proof; accounting and journal completion
are atomic. Unexpected runtime, nonce use, event attribution or reorganization holds the wallet.

The global indexer covers permissionless calls as well as the owned keeper. Every transaction's
supported events must be accounted before the page cursor advances; the cursor retains its
preceding block hash. Multiple events inside one outer transaction are selected by canonical
log identity and their own preceding transfer segment. The initial L2 block and page size are
explicit manifest policy. A backlog runs before new spending and queue completion.

Hook native receipts require historical runtime/recipient proof and absence of recipient changes
anywhere in the same block. The indexer and direct keeper share this verifier. Token receipts
require exact OMR Transfer evidence. A real `rotate → sweep → restore` local block is retained as
an intentionally held receipt, not booked under the restored destination.

The wrapper completes only already-queued withdrawals with the existing extraction configuration.
It verifies the claim contract, token, owner, signer and chain before using exact lifetime and
physical backing bounds. Missing extraction configuration stays dormant. A backing deficit
prevents new keeper planning and health publication; it does not create a new withdrawal rail.

Genesis state derives from the pinned contracts. An upstream strategy may return an outer
success after catching migration failure; that alone cannot open markets. The controller verifies
actual pool migration and custody, then waits for a fresh observation after foundation warmup.
The backend publishes a deployment-bound 90-second health row. A separate web process refreshes
that row before new quotes/auctions, and missing or stale state closes the new commitment paths.
Bond readiness also requires the configured minter, guard, oracle and positive contract caps.
The daily policy never raises an existing offering or refills the lifetime tranche.

## Methods and independent passes

The governing [agent-led review policy](../../SECURITY-REVIEW-POLICY.md) pins:

- Pashov methods at `c577eb7799c349de0acb187ba00ca98e14e436fd`: entry-point explanation, adversarial
  access/callback/asset-flow passes and concrete failure traces.
- Plamen methods at `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: oracle and time boundaries,
  token/ETH conservation, state accounting and external integration analysis.
- Trail of Bits methods at `d3323cefbcf645678b8dc481de204b02ad3d02dc`: context/callee tracing,
  invariant testing, static triage, negative testing and false-positive checks.

The passes were adapted to three cooperating review agents plus the coordinating implementation
review, native Windows tooling and the actual repository. No whole upstream orchestrator is
claimed to have run. Independent reviews covered POL custody, buyback/bond/Genesis/Bank, fee/gas
and static output, transaction transport, and receipt/policy/queue accounting. Findings were
cross-checked with the owning implementation and retained as executed regressions where stated.
Some POL observations were source/state traces without a retained pre-fix bytecode run; that
distinction is preserved in its subreport.

## Material findings and corrections

| Finding or boundary | Impact before correction | Final evidence/status |
| --- | --- | --- |
| `AUT-BOND-01`: future-dated price | A faulty selected oracle could extend accepted observation age. Conditional oracle defect, not a demonstrated unprivileged drain. | Actual archived-bytecode proof, then zero/future/stale/boundary regressions. Fixed. |
| `POL-01`: pause before bootstrap | An empty vault could be paused but could not resume into normal startup. | Owner resume now keeps it unhealthy and unactivated until foundation setup. Fixed. |
| `POL-02/03`: inventory binding and absent hook hash | A split-stream executor could satisfy only a primary-recipient check; an unused zero-hook hash could drift. | Exclusive POL stream, same oracle/health, zero secondary, and absent-hook handling. Fixed. |
| `AUT-GEN-01/02/03`: commitment, clock and ABI | Incomplete strategy tuple checks, an inconsistent Orbit clock selection, and a narrower sweep getter. | Genuine pre-fix failed tests retained; exact tuple/clock/uint256 fixes pass. |
| `AUT-GEN-04`: stopped controller renunciation | Owner renunciation could irreversibly strand unsold tokens behind the controller's exclusive authority. | Executed 7-OMR recovery-loss proof; renunciation rejected and two-step rotation preserved. Fixed. |
| Receipt destination/segment attribution | Nested calls, multiple executor fills or missing OMR transfers could be rejected incorrectly or credited without the required exact evidence. | Selected canonical log segments, sequence uniqueness and exact delivery proofs. Fixed. |
| Native Hook rotation within one block | End-of-block recipients could misattribute a sweep paid to a temporary destination. | Both direct settlement and indexer hold it; actual local EVM reproduction moves no books. Fixed by refusal. |
| Price time and policy continuity | Old fills could appear newly fresh; future prints and omitted Desk/Vig circuit breakers could authorize invalid accounting. | Canonical timestamps, historical anchors, restored continuity and exact Desk band/floor. Fixed. |
| SQL and queue rounding | Floating-point conversions could round reserve credit upward or sign one micro-OMR beyond exact backing. | Exact decimal SQL and six-decimal integer queue checks; retained pre-fix oversign. Fixed. |
| Health cache and Desk output floor | An older healthy snapshot could overwrite a newer unhealthy local phase; floating-point multiplication weakened the minimum output. | Monotonic accepted writes only, integer price comparison/output ceiling and negative-age rejection. Fixed. |
| Scheduler and startup recovery | Frequent jobs/history truncation or a failed legacy primary-RPC boot check could starve later jobs and fallback recovery. | Bounded current-key lookup, fair due-job ordering, independent schedule and repeated validated fallback probes. Fixed. |

Severity and preconditions of individual Solidity findings are preserved in the subreports.
Backend findings are concrete correctness/financial-boundary defects in the initial draft or
newly exercised queue path. This table does not label every failed test as an exploitable contract
bug, and it does not claim an exploit where the evidence only established misconfiguration or
availability risk.

## Executed verification

| Verification | Executed result |
| --- | --- |
| Combined new/changed liquidity contract tests | **145 passed, 0 failed, 0 skipped**, 12 suites; fixed seed `0x20260908`. |
| Existing core, bond, character and splitter regressions | **135 passed, 0 failed, 0 skipped**, six suites. |
| Bank integration regression run | **66 passed**, including the real Transmuter/Denari boundaries. This overlaps some focused new tests and is not added to a unique total. |
| Stateful properties | Six new properties: three POL, two fee/gas, one Bank; each 128 runs × 64 calls, **49,152 aggregate handler calls**, zero handler reverts. |
| Fuzzing | 512 cases per selected property, with exact commands and per-test output retained. Counts are not described as unique coverage where repeated suites overlap. |
| Size gate | Canonical `forge build --sizes --skip FuzzTester` passed. The existing upstream synthetic FuzzTester is the same documented CI exclusion. POL runtime is 23,220 bytes. |
| PostgreSQL transport | **18 groups passed**, including locking across independent module instances and PostgreSQL connections, durable replay, atomic rollback and historical Hook proof. |
| PostgreSQL canonical indexer | **27 groups passed**, including independent Node-process locking, page rollback, nested/multiple fills, historical pricing, backlog and deep reorganization. |
| PostgreSQL queue | **12 groups passed**, including exact backing, existing signer/domain proof and physical reserve holds. |
| PostgreSQL daily policy | **8 groups passed**, including concurrent creation, lifetime caps, manual stop and expiry. |
| Independent accounting/policy/queue regressions | **8 + 3 + 1 passed**; failing pre-fix executions are retained separately. |
| Full real-PostgreSQL gameplay gate | **203 passed, 0 failed**. |
| SQL preparation gate | **3,661 static statements parsed**; 166 classified interpolated sites and 33 nonliteral sites are explicitly counted. New dynamic journal UPDATE columns are closed and declared. |
| Repository integrity gates | Passed, including content-bound RPC concurrency declarations, SQL interpolation and test invocation across all workflows. |
| Unsigned deployment builder | **11 checks passed** with explicit synthetic inputs; artifact/source/ABI/compiler mismatch and missing policy refuse. |
| Actual local EVM rehearsal | **19 groups passed**; 11 real settled keeper transactions plus one deliberately held native Hook transaction. Full wrapper health/indexing/dormant-queue behavior is exercised. |
| Full backend `npm test` | **Passed, exit 0**, including all configured pretests, gameplay/API regressions, configuration inventory, repository gates, documentation and generated code-index verification. |

The first full backend attempt encountered the newly added Vig continuity regression before its
fix; its failed output is retained. A later full attempt reached the configuration inventory and
exposed a scanner that recognized only direct `process.env` reads, missing the real injected
environment consumers. The inventory now verifies those default bindings and production callers,
with explicit operational classification for the old-sender and key-conflict aliases. Both missing
and stale classifications remain checked. An independent trailing-check run also caught stale
repository-size claims in SPEC and the current deployment/audit inventory; those measured counts
are updated without changing economic rules. The final code-indexer check also exposed a homepage
handler attribution error after the existing invite wrapper; its common callback-factory provenance
is corrected with negative parser regressions. These tooling/documentation corrections do not
change the game routes or liquidity execution.
The final complete run passed after these corrections; all earlier failed outputs remain retained.
The initial broad size command also included the already-excluded upstream FuzzTester; its
failure is retained alongside the canonical passing size command. Earlier compiler/harness
failures are retained and explained in their subreports rather than presented as passing tests.

The local EVM rehearsal uses actual OMR, fees/router, Hook, v4 PoolManager, PositionManager,
Permit2 runtime, POL vault, executors and gas vault. It uses an administered GenesisOracle and
an EOA governance stand-in. Actual CCA bidding/LBP migration, Bank activation and daily issuance
are not asserted as part of that one rehearsal; their bounded controller/Bank/policy tests are
separate. No production RPC received a state-changing request.

## Static analysis and compiler identity

All **ten** Slither result files report `success: true`: **767 diagnostic occurrences**, **293
unique IDs**, and **zero untriaged IDs**. The per-ID dispositions are 80 false positives, 38 accepted
design constraints and 175 informational records. Returned dependency findings are retained.
Slither's diagnostic exit statuses are preserved; success is established by the structured run
result and complete triage, not by relabeling those statuses as zero.

Toolchain: Forge 1.7.1, Solidity 0.8.26, optimizer 800, Cancun; POL and PositionManager use their
declared via-IR profile while PoolManager uses its normal-profile artifact. Slither is 0.11.6.
Crytic selected the solc-select executable; its executable hash matches the requested native
compiler. OpenZeppelin 5.6.1, forge-std 1.9.6, v4-core 1.0.2, v4-periphery
`ad04c9f24a170accf5ea1b2836bbafd514537ca6`, and Permit2
`cc56ad0f3439c502c246fc5cfcc3db92bb8b7219` are pinned. Source/compiler/runtime-template hashes,
immutable references and exact settings are retained in the artifact manifest.

## Remaining operating and release constraints

1. The user has not supplied the final Safe/recipient addresses or financial limits. The generated
   public templates deliberately contain unusable placeholders. An actual deployment requires
   resolving them, proving the Safe owners/threshold and runtime/getter bindings, and simulating
   the exact ordered configuration batch. This audit performs none of those live actions.
2. Direct runtime hashes do not authenticate proxy implementations or guarantee arbitrary
   external assets. The accepted system uses reviewed direct implementations. Concrete Bank
   asset/ERC-4626 activation remains separate.
3. Protected nominal full-range liquidity, current in-range custody and warmup are distinct from
   a proof of market depth at every historical intermediate price. Oracle suitability, independent
   price ceilings and finite spending/issuance caps remain necessary. Slippage bounds do not
   promise absence of MEV or economically optimal execution.
4. Fixed rejecting recipients can stop atomic routing. The keeper cannot change destinations to
   bypass them. Immutable misconfiguration, a latched principal recovery or failed genesis can
   require an explicit governance replacement/migration decision.
5. A compromised allowed keeper can consume its finite operational/trading allowances within
   fixed routing. Gas budgets are UTC calendar buckets; POL uses its bounded trailing window.
   Service reserves must be deliberately funded. No mint/treasury/player allocation is silently
   converted into a new gas or Bank funding authority.
6. An exceptional native Hook block containing recipient changes is deliberately held. Recovery
   requires evidence for historical attribution; deletion of journal/cursor rows is not a remedy.
   The custody and ledger continue to be separate authorities until confirmation succeeds.
7. The older fee watcher has deployment/nonce migration constraints. Replacing an existing fee
   contract requires fresh deployment-scoped indexing or an independently reviewed migration;
   changing only the contract address is insufficient.
8. CI definitions now invoke the new suites and retain the original size gate. Local gates are
   executed evidence; no new pushed GitHub CI result is claimed for this uncommitted working tree.

The operating instructions and unsigned commands are in
[LIQUIDITY-AUTOMATION.md](../../LIQUIDITY-AUTOMATION.md). Detailed boundary reports:
[buyback/bond](review-buyback-bond.md), [POL](review-pol-vault.md),
[Genesis](review-genesis-controller.md), [Bank](review-bank-buffer.md),
[fee/gas/static](review-revenue-gas-static.md), [keeper](review-keeper.md), and
[accounting/indexer/queue](review-accounting-indexer.md).
