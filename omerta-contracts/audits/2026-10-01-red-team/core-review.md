# Root-contract adversarial review — 2026-10-01

## Scope and conclusion

Source commit: `e56cf576065c5f1bbb9bb55115f5961267f7d654`. This is a working-tree review; the repository contains unrelated changes and additional untracked launch contracts. Exact source hashes belong to the package's `source-hashes.json`. No production source was changed by this reviewer.

All root-level Solidity files other than `GenesisPlayerSale.sol` were read. The root `IOmrOracle.sol` interface was included as a dependency. `market-v2/`, the player sale, guarded auction/vendor sources, scripts, deployed addresses and backend implementations are covered separately or excluded from this subreport. This is source-phase review, not deployment or activation approval.

**The initial source pass identified no new unprivileged exploit. The Daybreak crosscheck subsequently identified correctness defects requiring remediation; see the appended record.** This statement is limited to the paths and assumptions below. It does not establish that defects are absent. Mechanical results are retained by the coordinating reviewer; this subreview did not independently execute Forge, a fork, Slither, Echidna or Medusa. Do not count source reading as executed proof.

## Applied methods and adaptations

Policy: `SECURITY-REVIEW-POLICY.md`. Methods read from the policy-pinned checkouts:

- Pashov `solidity-auditor/SKILL.md`, `senior-auditor-sop.md`, `shared-rules.md`, `judging.md`, execution-trace and economic-security references. Plain-language system modeling, backward attack tracing, accounting, arithmetic, role transitions, callback and dependency passes were applied.
- Plamen `rules/phase5-poc-execution.md`; EVM oracle-analysis, token-flow-tracing, external-precondition-audit and injectable vault-accounting references. A callable mechanism is not an exploit: harm assertions and executed evidence are required before a PoC is called confirmed.
- Trail of Bits audit-context-building instructions: entry points, dependent calls, enforced invariants and external assumptions were mapped before judging attack hypotheses.

Adaptation: this is one bounded delegated reviewer within the available team, not the upstream 12-agent Pashov orchestration or full Plamen driver. Reads used native PowerShell/rg; interfaces and callees were followed selectively. Source was read in bounded groups rather than a concatenated bundle. Mental-tool notes are consolidated below rather than emitted for each function at read time; therefore the upstream literal per-function marker protocol was not fully followed. Blanket template instructions that classify every hardcoded stablecoin value/normalization as a finding were adapted to the actual denomination-matched debt design and explicitly defined 18-decimal oracle interface; no severity is assigned without reachable harm.

## System and trust boundaries

| Surface | Assets and entry authority | Exit/transition authority | Material assumption |
| --- | --- | --- | --- |
| Token and staking | OMR fixed initial mint plus singular owner-appointed minter; user stake; explicit reward funding | User principal/rewards, rewards bounded by rewardPool | Exact-transfer configured OMR; owner chooses tax venues/exemptions and minter |
| Voucher/NFT | EIP-712 signer, global nonces, deadlines and daily/live gear caps | Holder transfer/burn; Safe rotates signer/configuration | Off-chain entitlement and event consumers must enforce their own database rules |
| Bank | User asset deposit to private escrow; ERC-4626 shares; DNR loan issuance | User withdrawal/repayment; permissionless yield harvest; DNR redemption | External vault previews/withdrawals and configured non-rebasing exact-transfer asset |
| Acquisition | Factory commits initcode/runtime/addresses; Safe/operator delayed role transitions; pinned ingress | Current supplied Core and AcquisitionVault have no ETH egress; budget/identity helpers | Partial source-stage rails must not be presented as a live purchase system |
| RWA | Owner activates immutable versions; publisher pins ballot; keeper buys; quote oracle floor; allocation signer | StockVault keeper delivery, optionally additionally signed; owner recovery | Approved stock token, adapter, quote source and off-chain allocation data |
| Liquidity | Owner adopts full-range NFT; keeper adds liquidity/funds fixed executor | Permissionless fee collection; fixed recipients; owner emergency NFT/assets recovery | Pinned manager/Permit2/hook/token/oracle and recipient compatibility |
| Settlement gas | Authorized gameplayVault records measured cost; contributions | Credited executor withdraws; delayed owner-controlled successor migration | The gameplayVault must supply valid settlement identity and gas measurements |
| Genesis | Safe binds exact launch tuple; permissionless clock progression | Fixed treasury/proceeds routing, migration/adoption | Actual pinned strategy/auction integration; chain clock; launch configuration |

## File coverage

`R` means source read with reachable branches, roles, state updates and external calls inspected. It is not a per-file proof of absence of defects.

| Root source | Status | Principal review targets |
| --- | --- | --- |
| AcquisitionAuthority.sol | R | Finalization, ownership/operator separation, delayed ingress, signature windows, hardcoded snapshot/storage ABI, pause |
| AcquisitionConstellationFactory.sol | R | CREATE nonce predictions, commitments, constructor reentry phase, atomic finalizers, bounded external calls |
| AcquisitionIntentExecution.sol | R | Finalization and domain-separated identity derivation; no execution entry point |
| AcquisitionReconciliation.sol | R | Factory-only finalization; no reconciliation execution entry point |
| AcquisitionVault.sol | R | Role collisions, ingress replay/caps, forced surplus, deficit repair, ownership handoff; no egress |
| AcquisitionVaultCore.sol | R | Snapshot validation, ingress identity/runtime, forced surplus classification, deficit repairs and cap conservation |
| Alchemist.sol | R | Per-user escrows, deposit delta/share floor, post-mint buffer, withdrawal LTV, repay rounding, fee/LTV compatibility, harvest post-state |
| BankBufferVault.sol | R | Deficit-only exact funding, immutable caps, actual transfer/reserve deltas, recovery |
| CollateralEscrow.sol | R | Controller-only custody, bounded temporary allowance, actual share delta, fee-aware redemption valuation |
| Denari.sol | R | Singular mint/burn authority, permit domain, arbitrary-burn trust boundary |
| DynastyNFT.sol | R | Signature/nonce/day cap before recipient callback, sequential IDs, pause affects mint only |
| FeeRevenueRouter.sol | R | Fixed split/remainder, nonce, feeContract authorization, forced-ETH route, recipient callback |
| FlashGuard.sol | R | Per-account block stamp, rolling flow caps, constructor caller exception and allowlist assumptions |
| GearVault.sol | R | Live supply cap survives minter rotation, burn conservation, callback mint/burn timing |
| GenesisLifecycleController.sol | R | Exact auction tuple binding, clock domain, dependency hashes, failure/live transitions, unsold tokens |
| GenesisOracle.sol | R | Expiry and zero-price fail-closed response; owner-set bounded validity window |
| GenesisProceedsSplitter.sol | R | Pool-state gating, immutable destinations, rounding conservation, token/native recovery |
| GenesisWalletCap.sol | R | Auction/controller hash authentication, bidder-owner equality, cumulative 0.28 ETH commitment |
| IOmrOracle.sol | R | Explicit OMR wei per ETH and last observation-time contract |
| KeeperGasVault.sol | R | Shared daily budget, per-keeper interval/target, effects before native callback |
| LiquidityBuybackExecutor.sol | R | One-shot unlock callback, signed balance deltas, actual spent/bought checks, floor/deadline/caps, fixed output recipients |
| OmertaBond.sol | R | Signer/payer binding, oracle/rate/discount/daily caps, vesting/liability conservation, callbacks and principal forwarding |
| OmertaFees.sol | R | Exact fee, monotonic nonce, mint-vs-nonmint routes, router-policy validation and recipient reentry |
| OmertaHook.sol | R | Hook-address permissions, authorized initialization, fee currency/direction, transient pre-price, observation accounting, sweep |
| OMR.sol | R | Mint access, permit, sell tax ceiling/split, mint/buy/exemption paths |
| OMRStaking.sol | R | Rate checkpoints, per-user index, principal-vs-rewards segregation, same-timestamp entry/claim |
| OmrTwapOracle.sol | R | Canonical pair/order/18 decimals, wraparound cumulative arithmetic, excessive-window rebaseline |
| OmrV4TwapOracle.sol | R | Observation-source capability, pool identity, negative mean-tick rounding, warmup/rebaseline, price units |
| PreVoteBudgetBook.sol | R | Safe/paused-state validation, source totals integrity, day/deadline bounds, one budget per day |
| ProtocolLiquidityVault.sol | R | Full-range NFT authentication, subscriber exclusion, health/warmup, liquidity budgets, fee isolation, Permit2 cleanup, emergency latch |
| RwaHealthOverlay.sol | R | Exact Safe, chain/registry identity, clearance TTL/sequence, activation generations and replay domains |
| RwaStockBuyer.sol | R | Prior-day ballot, keeper/adapter separation, oracle floor, actual output at StockVault, day cap |
| SettlementGasPool.sol | R | Replay, bounded saturating cost math, credit solvency, withdrawal callback, delayed config/migration, reserved-balance preservation |
| StockTokenRegistry.sol | R | Unique asset identities, owner/catalog vs publisher authority, historical ballot token pinning |
| StockTokenRegistryV2.sol | R | Immutable versions, conflict deactivation, same-key generation changes, ballot liveness |
| StockVault.sol | R | Keeper/allocation signature conjunction, delivery replay/caps, token amount and recipient binding |
| StreetDeed.sol | R | Signed identity, ownership-only unlock/burn, receiver-time lock state, remint after burn and nonce handling |
| Transmuter.sol | R | Denomination scale, exact funding, reserve segregation, burn-own-balance, rounding/caps and arbitrary-contract redemption |
| VoucherClaim.sol | R | Signature domain/fields, nonce/cap before callbacks, pre-funded OMR, gear live-supply accounting |

## Negative attack traces and invariants

### Bank and staking

[Feynman: Alchemist/CollateralEscrow] Each user owns a private container of external vault shares. Deposits buy shares; withdrawals sell enough shares to pay the requested asset amount. Borrowing records debt, then creates DNR. Harvest sells only value above the recorded principal and moves net proceeds into redemption reserves.

[Inversion: bank] Three attacks were traced: donate before another user's deposit to dilute their shares; borrow just past prospective reserve headroom; harvest a position at its LTV with an exit-fee vault. The caller's mandatory nonzero `minSharesOut` and actual share delta block the first from being silently accepted; the second mint rolls back at its post-mint `bufferHealthy` check; fee-aware valuation and the harvest post-state debt ceiling roll back the third before debt/backing divergence persists.

Concrete rounding check: yield=4 underlying units, fee=20%, debt at least 4*scale. net=4; naive fee=1; the clamp reduces fee to 0 so withdrawal=4, not 5. Debt reduction is at most moved net assets*scale. Repayment of residual debt d<scale pulls ceil(d/scale)=1 asset unit and clears only d; redemption floors to debtAmount/scale and rejects output=0. No positive rounding roundtrip was found.

[Feynman: OMRStaking] User deposits add only principal; rewards accrue with time and are paid only from an independently funded pool. An APY change closes the prior interval before installing the new rate.

[Inversion: staking] Claim with rewardPool=0; stake and claim at the same timestamp; enter after a long period of no stake. Pool-dry claims revert without removing principal. Stake first records the current reward index, so entry does not inherit past rewards. Unstake never tests rewardPool. Small flooring can reduce accrued dust; no path makes another user's principal available for reward payout with the intended exact-transfer OMR configuration.

### Authorization, callbacks and accounting

[Feynman: vouchers] A signed voucher chooses its recipient and amount. Anyone can submit it, but the value goes to the signed recipient and a nonce is consumed before token/NFT receiver code runs.

[Inversion: vouchers] Reuse a nonce; alter recipient/amount/gear ID; recursively claim during an ERC721/1155 callback. Domain/field hashing and nonce checks block the first two; claim guards block the third. Gear receiver burn during mint is allowed, but both minted and redeemed remain accounted, so `minted-redeemed<=cap` remains the cap model. StreetDeed holder may redeem during receipt; downstream event consumers must handle actual receipt/log order, and this source-only pass does not prove backend indexing semantics.

[Feynman: acquisition] Money arriving through the committed ingress becomes available, except money needed to repair a previous balance deficit. Forced money remains unattributed until the Safe explicitly reclassifies it.

[Inversion: acquisition] Force ETH and sync twice; rotate ingress to reset global lifetime credit; deposit during deficit and count the repair twice. `syncBalance` moves only current surplus, cumulative global deposits survive ingress generation changes, and `credit=msg.value-min(msg.value,preDeficit)` distinguishes repair from availability. Accounting identifiers bind chain/core/module/generation/sequence. Factory advances its phase before constructor/finalizer calls, preventing nested deployment progression. Remaining reservation/reconciliation balances cannot currently be changed by an executable outflow path.

[Socratic: AcquisitionAuthority pending getters] The manually numbered slots depend on the exact compiler/inheritance storage layout, not merely the struct definition. The coordinating reviewer executed `forge inspect AcquisitionAuthority storage-layout --json` and confirmed nomination slot 9, ingress proposal slot 18 and ingress mapping slot 29. The retained compiler/settings remain essential to this equivalence.

[Feynman: settlement] Crediting reserves an amount for one executor; withdrawing removes that reservation before paying the executor. Migration may spend only unreserved ETH.

[Inversion: settlement] Withdraw recursively; return the payment as a contribution during callback; migrate funds after credits consumed proposal headroom. The withdrawal guard/zeroed credit block double withdrawal; a callback contribution adds genuine assets without recreating the executor liability; migration rechecks its amount against current unreserved balance. Cost multiplication/addition saturate at the configured settlement cap instead of wrapping. The caller supplied `measuredSettlementGas` is trusted only because the entry point is restricted to gameplayVault; this pass did not prove its measurement implementation.

### Liquidity, prices and RWA

[Feynman: ProtocolLiquidityVault] The vault holds one authenticated full-range liquidity NFT. Automation adds liquidity from inventory under action/window budgets; earned fees are collected and paid to fixed destinations. Emergency recovery moves the NFT and free inventory to the original configured Safe.

[Inversion: liquidity] Present an NFT from another pool or subscribed position; steal a standing Permit2 allowance; recursively invoke the swap callback. Foundation identity/range/owner/liquidity/subscriber checks reject the first. Exact allowances are zeroed after modification, and failed transactions roll back. Buyback callback requires the manager plus its armed one-shot flag, clears that flag before swapping, and checks actual ETH/OMR deltas after settlement. LP adds isolate collected fees from input inventory; native manager dust is explicitly included in accounting rather than falsely counted as negative spend.

[Feynman: oracles] The pair/hook records time spent at each price. A completed average is converted into the interface's OMR wei per ETH; consumers enforce recency and nonzero output.

[Inversion: oracles] Manipulate only within one timestamp; use a reversed/noncanonical V2 pair; update after an excessive window. Same-timestamp manipulation does not retroactively add elapsed price time; constructor pair/token-order checks reject substitution; windows beyond four periods invalidate and rebaseline. V4 negative cumulative division rounds down deliberately. A long-duration price manipulation remains an economic assumption; no live pool depth or manipulation-cost claim was verified here. Constructor-supplied PERIOD values near the uint32 limit can make `PERIOD*4` overflow; these represent multi-decade windows and are configuration misuse, not a live unprivileged exploit claim.

[Feynman: RWA] The catalog binds token versions to symbols/provider identities. Published ballots keep the original version/generation. Buying pays the approved adapter, but only succeeds if the StockVault receives at least the oracle/caller output floor.

[Inversion: RWA] Keeper sets tiny minUnits; deactivate/reactivate a ballot asset under the same key; forged delivery alters destination. Buyer uses max(oracle floor, keeper floor) and an actual destination-balance delta. Registry generation mismatch keeps the old ballot inactive even after same-key reactivation; overlay clearance independently binds activation generation. StockVault allocation signatures bind delivery/token/to/units, with replay consumed before transfer. With allocationSigner=0, delivery is explicitly keeper-trusted and cap-limited rather than two-authority delivery; deployment must identify the intended mode.

## Findings, leads and unresolved verification

Confirmed findings: **none added by this reviewer**. No `[POC-PASS]` tag is claimed. There is no locally identified unit/property exploit hypothesis needing an unattempted mandatory harm PoC.

**Retained historical oracle residual (M02):** `OmertaHook`/`OmrV4TwapOracle` root implementation observations do not gate the accumulated tick on active liquidity. The coordinating test `test/audit/ComprehensiveMarketAudit.t.sol::test_risk_emptyLiquidityProducesZeroCostFreshTwap` initializes a zero-liquidity pool, executes a public swap with zero ETH/OMR balance delta that moves sqrtPrice from Q96 to 2*Q96, advances 600 seconds and reads approximately 4e18 OMR/ETH with a fresh timestamp. This is a conditional mechanism witness, not a new confirmed loss: exploitation requires a value-consuming rail to be armed while usable liquidity is absent. The separately configured liquidity health guard must fail closed, and deployment/consumer wiring remains mandatory verification. The historical M02 status must not be erased or presented as a new fix in this review. Mechanical execution of this witness is recorded in the coordinating package, not claimed independently here.

One integration lead was handed to the coordinating reviewer: `GenesisProceedsSplitter.recoverFailedLaunch()` is permissionless and checks only whether the canonical pool is initialized. If an actual deployment intentionally parks launch ETH there across transactions before initialization, any caller can route it early to treasury. Fixed destinations mean the caller cannot steal it. The current strategy integration appears intended to send residual atomically with migration, but the exact strategy and deployed funding order were not verified by this reviewer. Status: **LEAD; external/deployment prerequisite unverified**, not confirmed launch sabotage. PoC class: integration; local attempt: no; blocker: actual strategy/funding order outside this root-file scope (`EXTERNAL_DEP_NO_FORK` / deployment ordering). Resolve against the auction/strategy review before making a launch-readiness claim.

Other limitations are trust/configuration facts rather than vulnerability findings:

- AcquisitionCore, AcquisitionVault and constellation helpers are source-stage ingress/accounting rails with no withdrawal/purchase execution entry point. `AcquisitionAuthority.unpause` always reverts `LocalReadinessFailed(11)`. Do not fund/activate these as a completed purchase rail without the separate release work.
- `codehash` pins bytecode identity, not an underlying proxy implementation's governance. Trusted external asset/vault/oracle/router/migration semantics require separate deployment evidence.
- Several caps intentionally use zero=unlimited. Source checks do not prove live caps, signer separation, supported-chain identity, configured minter/burner, correct OMR tax exemptions, health guard installation or treasury recipients.
- Direct-push fixed-recipient routes can revert if recipients reject ETH; documented Safe-selected recipients and recovery/configuration abilities are part of that trust model. No unprivileged way to replace a recipient was found.
- Backend signer issuance, entitlement accounting, NFT reimport/event processing, database concurrency and actual gameplayVault gas measurement were not reviewed here.
- The coordinating evidence package must supply executed unit/fuzz/invariant outputs, raw static-analysis findings and triage. This subreport supplies source review and hypotheses, not an independently clean static-analysis result.

Conclusion: the assigned source pass produced no new confirmed exploit. Readiness remains conditional on the full package's mechanical results, source/deployment pins, open integration-lead disposition and the intentionally incomplete acquisition phase.

## Daybreak crosscheck and oracle remediation

The initial pass understated the significance of two correctness defects: StreetDeed's signed burn/remint could alter a supposedly immutable district, and both root oracle constructors accepted periods that made their own update arithmetic overflow. These require retained findings even though they are signer/trusted-configuration dependent. The coordinating reviewer is handling StreetDeed and the consolidated finding IDs.

Oracle defect (low severity, configuration-dependent liveness): `period=1,073,741,824` is accepted by the original constructors. At the first eligible update, checked `PERIOD*MAX_WINDOW_MULT` evaluates 4,294,967,296, exceeding uint32max. The transaction panics before publishing an average; every subsequent eligible update encounters the same immutable arithmetic failure. Both `OmrTwapOracle` and `OmrV4TwapOracle` share this root cause. There is no unprivileged way to choose/change the immutable period after deployment, but accepting a configuration that permanently disables a public oracle is a concrete correctness defect.

The surgical correction adds `PeriodTooLong()` and rejects `period_ > type(uint32).max / MAX_WINDOW_MULT` in each constructor. The largest accepted period is 1,073,741,823; multiplying it by four equals 4,294,967,292 and fits uint32.

Tests added to both existing oracle suites:

- `test_maximum_period_closes_a_window_without_overflow`: deploy max/4, advance an entire real window, call update and assert the expected nonzero price plus current observation time.
- `test_period_above_window_arithmetic_limit_reverts`: reject max/4+1 at construction with the precise error.
- `test_uint32_maximum_period_reverts`: reject uint32max with the precise error.

PoC ledger: class=unit; tests authored=yes; execution by this reviewer=no (coordinating reviewer owns the compiler/build run to avoid shared artifact interference); pre-fix evidence=`[CODE-TRACE]` with complete real constants, not `[POC-PASS]`. The coordinating reviewer must retain the executed regression output and any separately executed pre-fix harm witness before claiming mechanical proof. No deployment occurred. Updated source/test hashes must supersede the initial package hashes.

## Final-seed timestamp regression — 2026-10-02

The coordinating run retained in `evidence/forge-final-patched.txt` found `testFuzz_no_prepool_or_prebaseline_time_qualifies(4294967295,18299,10599,true)` failing with `InvalidTick(-6923984)`. The prior source and mock both used uint32 elapsed time since their last accumulator write. Seeding an oracle just before that elapsed duration completed a full uint32 cycle, then reading 600 seconds later, made the counterfactual cumulative reset rather than continue. This contaminates a genuinely short observation window. It was a real root-hook correctness defect mirrored by the fixture, not a reason to narrow the fuzz domain. This requires extreme multi-decade idle times; no live profitable extraction claim is made.

The hook now retains a uint64 last-write wall timestamp in the spare bytes of its existing private accumulator slot (total packed width 23 bytes). Counterfactual reads and writes calculate full elapsed seconds, multiply at int256 width and cast into the existing int56 modulo cumulative. External uint32 timestamp/int56 cumulative signatures are unchanged. Both V2 and V4 oracles separately retain a private full baseline timestamp so an entire uint32 keeper-gap cycle cannot alias a fresh short window. The full-gap rebaseline check precedes the wrapped early-window check; the existing uint32 rebaseline event saturates very long discarded durations at uint32max.

The deterministic source fixture was updated to mirror full elapsed accounting. Regressions preserve the exact failing fuzz input, exercise the real hook's read continuity and subsequent accumulator write after a >2^32 idle interval, and exercise both oracles after exact2^32 and 2^32+PERIOD keeper gaps. Original fuzz bounds were preserved. No tests were run by this reviewer; the coordinating reviewer executes and retains focused/full results and storage-layout confirmation. Legacy zero-liquidity oracle risk M02 is separate and remains open under the package's activation exclusions.
