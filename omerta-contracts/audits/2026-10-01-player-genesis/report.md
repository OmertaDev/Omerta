# Player Genesis predeployment review — 2026-10-01

Status: scoped predeployment implementation review complete. This report does not authorize deployment or activation.

## Scope and method

Review new `src/GenesisPlayerSale.sol`, `src/market-v2/OmertaGenesisCoordinatorV2.sol`, `src/genesis-auction/OmertaGuardedAuction.sol`, and the locally vendored auction/dependencies identified by `src/genesis-auction/vendor/SOURCE-MANIFEST.json`. Follow production PoolManager, PositionManager, Permit2, OMR transfer, and OmertaHookV2 calls needed for migration. This is a predeployment change review, not a new comprehensive upstream CCA audit or gameplay/backend review.

Source HEAD: `e56cf576065c5f1bbb9bb55115f5961267f7d654`; working tree dirty with unrelated changes. Final reviewed file hashes are retained in `source-hashes.json`; changed files require renewed review. v4-periphery dependency commit `ad04c9f24a170accf5ea1b2836bbafd514537ca6`; Permit2 `cc56ad0f3439c502c246fc5cfcc3db92bb8b7219`. v4-core and OpenZeppelin are tracked vendored files in the parent repository, not independent Git checkouts; source hashes and parent HEAD identify them. Scoped `git status --short -- omerta-contracts/lib` was empty. Compiler: Solidity 0.8.26 (`8a97fa7a.Windows.msvc`), optimizer 800 runs, Cancun; coordinator and production PositionManager use via IR under foundry.toml restrictions. No chain, deployed addresses, deployed runtime hashes, live whitelist, or launch transaction has been verified.

Function inventory: player sale `cap`, `leaf`, `open`, `contribute`, `settle`, `releaseProceeds`, `cancel`, `refund`, `claim`, `recoverUnsold`; coordinator constructor/bind, auction checkpoint, common claim predicate, combined migration/callback, public-only fallback, private liquidity initialization, residual withdrawal, token dust recovery and ETH receive; guarded auction constructor, native claim clock views and overridden shared single/batch internal token claim path. Public upstream bid/checkpoint/exit/currency sweep/unsold token sweep paths were followed for integration; unchanged upstream auction mechanisms were source-pinned and selected integration paths reviewed, without claiming a comprehensive upstream audit.

Methods are adapted to native Foundry and the existing implementation/review agents, rather than executing upstream orchestrators. Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`: senior-auditor-sop and shared rules, access-control/math/economic/execution/invariant/periphery passes. Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: depth-state-trace, complete state graph, cross-function consistency, cross-domain external assumptions, concrete evidence before verdict. Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc`: audit-context-building trust and call maps followed by adversarial analysis. Local checkouts' HEADs were verified. No claim of running 12 upstream agents, remote vulnerability databases, or external scanners follows from using these methods.

## Trust and state model

Assets: player deposited ETH and tranche OMR; public bid ETH and public OMR; coordinator OMR reserve; initial liquidity NFT; treasury/vig/founder residual credits. The Merkle publisher is trusted to establish gameplay eligibility, one-person rules, snapshot timing and correct wallet association. The contract proves membership and enforces cumulative wallet caps; it cannot prove gameplay or unique humans. Leaves bind chain ID, sale address, wallet and tier. The immutable integration code hash blocks direct runtime replacement; it is not proof against upgradeable dependency changes.

The configurator binds auction and sale once before the auction's native start clock. Getter checks require native ETH, same token, same coordinator/gate and integration, but the configurator remains trusted to select reviewed runtime implementations and deployment parameters. Coordinator pins direct dependency runtime code hashes and checks them during migration; proxies can retain runtime while changing implementations, so these are not proxy-upgrade defenses. PoolManager, PositionManager, Permit2, hook and standard OMR semantics remain external trust dependencies. Production hook restricts initialization to its configured authorized address; binding verifies that address is the coordinator and requires the exact hook PoolKey. Actual liquidity NFT owner, position PoolId and liquidity are checked after mint; the ETH spend must be at least 99% and at most 100% of the 37.5% liquidity budget. Matching OMR inventory cannot silently reduce the budget.

Anyone checkpoints a graduated finalized auction, opens the funded player sale before its opening deadline, settles wallets after the 48-hour window, and requests migration. Only coordinator releases player proceeds; the callback requires an active migration and exact accepted value. Public sweep, pool initialization, liquidity mint and player ETH release must commit atomically. Claims require successful migration and the auction's native clock cliff. Player refund and claim flags are written before external transfers; callback/reentrancy failures roll back. Anyone may recover only unsold tranche inventory to its fixed recipient. No signed authorizations, bridge oracles, database locks or upgrade mechanism are introduced in these contracts; corresponding signer/database/bridge tests are out of scope.

## Findings

### PG-01 — High: terminal player deadline strands graduated public filled bids

Initial implementation, confirmed source trace: `GenesisPlayerSale.releaseProceeds()` rejects timestamp at or after `migrationDeadline`; `cancel()` then becomes available and refunds player deposits. Coordinator `migrate()` has only this player release route. `OmertaGuardedAuction._internalClaimTokens()` requires coordinator migration success permanently. CCA `_processExit()` refunds only the unused portion of a graduated bid and sets its purchased token amount; it cannot return the spent principal after graduation.

Concrete trace: a public auction graduates; a bidder has a positive fill; the player window closes; reserve funding is absent or all player wallets are not settled before migrationDeadline. Migration never succeeds. Deadline arrives and player cancellation is possible. Public bidder exit returns only unused ETH. Public token claim remains closed and migration cannot be retried even after funding or settlement is repaired. The public filled principal and token entitlement have no reachable recovery path.

Prerequisites are an operational lapse or a persistent migration failure, rather than privileged theft. The permanent denial of purchased assets makes severity high. Reported promptly to implementation and root agents. Disposition: resolved. Coordinator now exposes permissionless `migratePublicAfterCancellation()` after sale cancellation, excluding player ETH from the liquidity calculation and preserving player full refunds. Source review confirms the player deadline no longer irrevocably blocks public migration. `testCancelledPlayersRefundAndPublicSaleStillMigrates` covers the fallback using a mock auction and real PM/hook. Executed real CCA/PM/Permit2/hook `testRealAuctionPlayerTimeoutRefundsAndPublicMigrationRecovers` passed, demonstrating player full principal refund and public purchased-token claim after fallback migration. Permanent failures of immutable liquidity dependencies/configuration still require separate launch prevention checks and are a residual operational risk, not a promise of public full-principal refunds.

## Adversarial passes and hypothesis dispositions

Wallet/tier replay: proof includes wallet, tier, immutable chain and sale address; contribute checks current chain and cumulative request. Multiple leaves for the same wallet do not create separate counters. Off-chain duplicate humans remain a publisher risk.

Accounting/rounding: per-wallet token flooring and accepted-payment ceiling avoid releasing refundable dust as aggregate revenue. For oversubscription, integer totalRequested exceeds floor(inventory*price/Q96), so proportional tokens imply ceil(cost) no larger than each deposit. Sum token floors does not exceed inventory. Low price with zero integer tranche capacity is rejected at opening. Final executed fuzz evidence remains pending.

Callback/reentrancy: refund/claim/release outer guards and state-before-transfer prevent repeated principal or tokens; settling another wallet has no external transfer. Reverting refund receivers affect their own withdrawal, not another participant's settlement. Position mint does not use a safe NFT receiver callback in pinned production PositionManager.

Permissionless preinitialization grief: invalidated under production OmertaHookV2 `beforeInitialize`, which requires the authorized initializer. Requires deployment verification of the hook and initializer; a permissive arbitrary hook is outside that conclusion.

Early public currency sweep grief: invalidated by pinned CCA `sweepCurrency()` checking `msg.sender == FUNDS_RECIPIENT`; coordinator has no external early-sweep wrapper.

Residual liability: coordinator assigns residual only from public/player proceeds minus actual migration spend; forced ETH donations are not counted as sale proceeds. Public fee-controller drift does not apply to direct guarded auction construction with zero protocol controller. Token reserve shortfall or wrong hook configuration reverts migration atomically but exposes PG-01's deadline problem.

Liveness: every participant must settle, but settlement is permissionless and independently callable. Keepers/indexers must enumerate all participants from events and finish before the deadline. Eligibility publisher Sybil control, immutable root correctness and the larger wallet caps are economic assumptions, not established by Solidity tests.

## Executed evidence and static analysis

Forge 1.7.1 (`4072e48705af9d93e3c0f6e29e93b5e9a40caed8`) and Slither 0.11.6 versions were executed. On 2026-10-01 native Foundry commands from `omerta-contracts/` used `C:/Users/Jorge/.foundry/bin/forge.exe test --match-path <test path> --use cache/verify/solc-0.8.26.exe -vv`; output was captured with PowerShell Tee-Object and retained under this report's `evidence/` directory. Individual runs exited 0:

| Path | Evidence file | Result |
| --- | --- | --- |
| test/GenesisPlayerSale.t.sol | genesis-player-sale-tests.txt | 10 passed, including 512-run settlement-solvency fuzz |
| test/OmertaGuardedAuction.t.sol | guarded-auction-tests.txt | 6 passed against real CCA, both token claim paths, clock/domain guards and failed auction refund |
| test/market-v2/PlayerGenesisIntegrationV2.t.sol | player-genesis-integration-tests.txt | 3 passed against real CCA/PM/Permit2/hook, combined proceeds, timeout public fallback, failed liquidity funding rollback/retry |
| test/GenesisPlayerSaleInvariant.t.sol | genesis-player-sale-invariants.txt | 3 properties passed, each 128 runs × 64 calls (8,192 calls/property), zero uncaught reverts |

Invariant environment: FOUNDRY_INVARIANT_RUNS=128, FOUNDRY_INVARIANT_DEPTH=64, FOUNDRY_INVARIANT_FAIL_ON_REVERT=false. Initial individual runs did not retain fixed random seeds. Final combined run uses fixed seed `0x20261001`: **29 tests/properties passed, zero failed/skipped**, retained in `tests.log`; the final current-market regression uses the same seed and **124 tests passed, zero failed/skipped**, retained in `market-regressions.log`. Each ordinary fuzz property ran 512 cases, and each stateful invariant ran 128 histories × 64 calls. The combined result includes all 10 sale tests (two arithmetic/solvency fuzz), seven coordinator tests (including live liquidity fuzz and binding rejection for wrong hook PoolKey), six guarded auction tests, three real dependency integrations and three stateful properties.

Exact final PowerShell commands from `omerta-contracts/` (both LASTEXITCODE=0; bundled Forge binary version independently confirmed 1.7.1 with the same commit above):

```powershell
$env:FOUNDRY_FUZZ_SEED='0x20261001'
$env:FOUNDRY_INVARIANT_RUNS='128'
$env:FOUNDRY_INVARIANT_DEPTH='64'
& .\cache\verify\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe test --match-contract '(GenesisPlayerSaleTest|GenesisPlayerSaleInvariantTest|OmertaGuardedAuctionTest|GenesisCoordinatorV2Test|PlayerGenesisIntegrationV2Test)' --offline --use .\cache\verify\solc-0.8.26.exe -vv *> audits/2026-10-01-player-genesis/tests.log
& .\cache\verify\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe test --match-path 'test/market-v2/*.t.sol' --offline --use .\cache\verify\solc-0.8.26.exe -vv *> audits/2026-10-01-player-genesis/market-regressions.log
```

Stateful driver uses four preseeded wallet tiers, fixed Q96 price/inventory, randomized contribution/proof failure, settlement, release/failure, timeouts, refund and claim. It checks wallet caps, aggregate accounting, ETH solvency, token custody, and complete refund exit after each history. Chain mutation and unsold recovery are covered by unit source/tests rather than this driver's action set. Final invariant setup verifies all four live participant liabilities before randomized actions. Artifact and SHA-256 runtime-template hashes are retained in `artifact-hashes.json`; these are compiler templates before constructor immutables, not deployed bytecode verification. Default sale runtime template is 7,436 bytes, guarded auction 16,935 bytes, and coordinator 17,655 bytes; each is below the 24,576-byte EIP-170 deployed-code limit. Source-size compliance does not substitute for deployment/runtime verification.

Aderyn was not found on PATH. On 2026-10-01, Slither `. --ignore-compile --filter-paths 'lib|test|vendor' --json audits/2026-10-01-player-genesis/slither.json` failed exit 1: Foundry build-info refers to absent `out/build-info/0cb8e952a004ca61.output.json`. Raw traceback retained in `slither.log`. This is an unavailable analysis result; no detector diagnostics or static clean conclusion were produced. No environment repair was attempted. Manual static/source diagnostic triage found compiler mutability suggestions in the existing hook, with no security impact; the contract compilation succeeded.

## Conclusion

PG-01 is remediated and its real dependency integration regression passed. No additional confirmed high/critical defect was identified in the scoped source passes. This is bounded review evidence for the hashed source and predeployment implementation phase, not an assurance that no defects remain. Focused final verification and current-market regression passed; automated Slither analysis was unavailable. The implementation is suitable to proceed to deployment preparation and production-stack rehearsal, with those limitations retained. Deployment/source-bytecode verification, runtime dependency verification, auction/hook parameters, matching OMR reserve, liquidity ownership, whitelist creation and publisher controls, monitor/keeper operations, and owner launch acceptance remain separate requirements. Claims use the auction's absolute native-clock CLAIM_BLOCK; no fresh delay starts at migration, so launch parameters must implement the intended common cliff.



