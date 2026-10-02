# Market and Genesis correctness review — 2026-10-01

## Scope and evidence level

Source checkout HEAD: `e56cf576065c5f1bbb9bb55115f5961267f7d654`. This report describes a manual review of the working-tree source; the parent evidence manifest supplies dirty-state/file hashes, compiler settings, test execution and deployment exclusions. No production source was changed. No live chain interaction was performed. No independently executed proof or new test is claimed by this reviewer.

Applied the repository SECURITY-REVIEW-POLICY, pinned pashov senior-auditor SOP and access-control, math-precision, economic-security and execution-trace passes, plus pinned Plamen phase5-poc-execution evidence/harm rules. Adaptation: the parent partitions work into the available four agent slots, rather than upstream twelve-agent orchestration. No standalone execution framework was silently substituted.

Reviewed each function in all twelve `src/market-v2` source files and interfaces, `src/GenesisPlayerSale.sol`, and `src/genesis-auction/OmertaGuardedAuction.sol`. Followed the wrapper into CCA finality, bid submission/exit/refund, single/batch claims, proceeds/unsold sweeps, AuctionStorage and CheckpointAccountingLib/BidLib. Third-party CCA storage/math implementation and Solady primitives are dependency surfaces, not a claim of complete independent re-audit of all vendor code.

## System and trust boundaries

- Canonical currency0 is native ETH; currency1 is the 18-decimal OMR token. Increasing v4 ticks means more OMR per ETH, hence lower OMR economic value.
- The hook accepts canonical-pool callbacks only from the immutable manager and initialization only through the pinned initializer. Sell fees accrue into immutable beneficiary buckets and are paid separately from swapping.
- Observations represent completed fixed intervals. The hook caches price/liquidity between actual mutations; refresh never invents extra epochs. Minimum raw active liquidity is a prerequisite, not an executable-depth guarantee.
- Stability capital is gifted funding, separately accounted by tranche, with immutable action/episode/lifetime budgets. Safe can pause, exit and retire its idle principal; fee rights belong to fixed recipients.
- Bond inventory is finite and prefunded; available tokens become nontransferable vesting liabilities. Reserve proceeds are separate native liabilities.
- Commitment rewards move only prefunded campaign budget into depositor liabilities while canonical NFTs remain locked. Pauses/stale samples break reward anchors; maturity withdrawal does not depend on the oracle.
- Solver arbitrage uses caller collateral and manager net settlement; only positive realized profit is shared. Hash commitments bind chain, contract, solver and plan.
- Territorial adjudication is trusted for future ownership/status. Fee bridge checkpoints actual controller counters before recipient changes, freezes siege recipients and preserves principal custody.
- Genesis integrates immutable sale, coordinator, auction, token, hook and periphery identities. ETH release, auction sweep, pool initialization and position mint occur atomically. Both public claim functions traverse the launch gate; currency refunds retain upstream semantics.

## Function coverage and checked properties

| Source | Checked paths and principal property |
|---|---|
| IOmertaMarketStateV2 | Snapshot fields/scales and consumer obligations |
| OmertaHookV2 | Constructor/flags, all callbacks, poolKey/interfaces, opening limits, exact-input/output fee currency, actual partial-fill amounts, accrue/pay/sweep/claim, pressure integration, epoch/cumulative observation, unsupported callbacks: canonical authority and bucket conservation |
| OmertaMarketStateV2 | Constructor, refresh/snapshot: finalized epoch, stale invalidation, signed floor mean, variance scale and bounded stress |
| OmertaStabilityControllerV2 | Constructor/getters/fund/pause/deploy/collect/exit/expireTurf/finalize/claimFees/recovery/regenerate/retire/inventory/ranges/callback/settlement: principal-fee separation, zero arbitrary external execution, one-shot callback, actual manager settlement and persistent lifetime counters |
| OmertaReserveFundingV2 | Receive/bind/flush: immutable funding compartment, no caller recipient choice, temporary approval cleared |
| OmertaInventoryBondV2 | Constructor/fund/pause/purchase/quote/claim/claimable/proceeds/retire/observation/price: exact deposits, nonreplay, aggregate caps, collateral survives retire, claims survive stale oracle/pause |
| OmertaCommitmentVaultV2 | Constructor/getters/create/fund/pause/commit/receiver/checkpoint/withdraw/reward/recover/depth/anchor: canonical NFT custody, no single-sample reward, prefunded liabilities, depositor-bound maturity exit |
| OmertaArbitrageV2 | Constructor/key/hash/commit/execute/callback/claims/receive: solver binding, complete OMR cycle, no collateral credited as profit, fixed reserve share and replay protection |
| OmertaTurfV2 | Constructor/bind/treasury/season/turf/ownership/status/siege start/resolve/expiry/deposit/claim/settlement/splits: revisions/replay domain, normalized bounded splits, funded escrow, frozen siege wallets and no principal authority |
| OmertaTurfFeeBridgeV2 | Constructor/bind/receive/checkpoint/close: immutable attribution lane, source counters distinguish donations, season expiry removes liquidity before closure |
| OmertaGameSettlementV2 | Constructor/bind/register/archive/treasury/ownership/status/siege paths: adjudicator guard and atomic source checkpoint before financial recipient change |
| OmertaGenesisCoordinatorV2 | Constructor/bind/checkpoint/claims/migrate/callback/cancellation/mint/residual/dust/receive: pinned identity, one-time binding, initialization atomicity, allowance cleanup, minted NFT owner/pool/liquidity and measured native spend |
| GenesisPlayerSale | Constructor/cap/leaf/open/contribute/settle/release/cancel/refund/claim/recover: Merkle chain/contract/wallet/tier domain, per-wallet rounding, all participants settled, released/cancelled phase exclusion and inventory reservation |
| OmertaGuardedAuction | Constructor/clock views/internal claim: both inherited token claim routes use common gate, chain/runtime identity pinned; no gate blocks failed-auction ETH refunds |

## Leads and residual conditions

### MKT-L01 — immutable matching reserve needs explicit launch feasibility proof

Status: invalidated as a supported-configuration defect; deployment feasibility requirement. `OmertaGenesisCoordinatorV2.sol:163–178` budgets 37.5% of total sale proceeds but limits matching OMR to immutable `tokenReserve`; migration requires the entire native budget to determine liquidity. If the price/proceeds combination requires more OMR than that immutable limit, topping up the coordinator beyond `tokenReserve` cannot increase the permitted LP input. Public claims remain gated on migration success (`:127–128`). The player cancellation fallback removes player proceeds but still needs the public-only budget to fit. This is distinct from the existing insufficient-balance/retry test, which restores a balance below an otherwise adequate reserve.

Recommendation: prove reserve adequacy across the supported auction step schedule, total public supply, final price bounds and maximum player acceptance; add a boundary test where held inventory exceeds reserve but public-only matching demand exceeds it. The test should assert whether public buyers retain an eventual claim/refund route, not merely that migration reverts. No severity is assigned without a reachable supported-configuration witness.

PoC ledger: required YES if classified as a defect; class integration; attempted NO; current evidence CODE-TRACE; no confirmed harm assertion.

### MKT-L02 — price inversion has a narrower numerical domain than v4 prices

Status: invalidated for the documented launch floor; unsupported numerical-range limitation. At `OmertaGenesisCoordinatorV2.sol:166`, the intermediate full quotient `2^288 / priceX96` must fit uint256 before its square root is taken. Therefore `priceX96 <= 2^32` reverts, although some resulting square roots could fit uint160 and the v4 domain. For example `priceX96 = 2^31` would require an intermediate `2^257` but square root near `2^128.5`, within uint160. This implies an extraordinarily small nominal OMR price (below roughly 0.0543 wei per whole 18-decimal token), and no supported-launch reachability was established.

Recommendation: explicitly bound the launch price domain or calculate the square-root ratio without requiring the squared ratio to fit uint256. Add lower-price boundary coverage only if these values are supported.

PoC ledger: required YES if classified as a defect; class unit/integration; attempted NO; current evidence CODE-TRACE; no deployed harm asserted.

### Accepted design limits that are not findings

- Completed-epoch averages and raw-liquidity thresholds cannot prove market fair value or sustained executable depth. Capitalized multi-epoch manipulation/wash volume remains an economic assumption, bounded by immutable budgets; no profitable executable witness was established.
- Campaign rewards deliberately sample depth and use first-come budget allocation; checkpoint partitioning may lose tiny reward rounding dust, while aggregate payments remain prefunded. NFT maturity remains available.
- Hook fee rounding truncates dust. Surge pressure is bounded and decays with time; documentation explicitly does not promise split/order independence or sandwich protection.
- Adjudicator can select future family ownership/status and Safe can retire capital. These are trusted powers, not permission bypasses.
- Constructor codehash checks do not by themselves secure a proxy's implementation slot. Supported dependencies must be verified non-upgradeable or their governance accepted separately.

## Invalidated hypotheses

Bond claim theft via arbitrary claimant fails because settlement always pays the recorded beneficiary. Bond retirement cannot remove promised inventory. Repeated nonce purchases fail. Solver commitment copying binds the wrong solver and cannot redirect claims. Forged unlock callbacks fail manager/hash checks and hashes are consumed before manager modification. Commitment old-owner approval does not confer authority over vault-owned NFTs and unsolicited safe transfers fail the receiver handshake. Territorial wallet rotation checkpoints earlier fees; active sieges retain frozen recipient lists. Single and batch auction claims share the overridden internal gate. Sale rounding uses per-wallet accepted payments so migration does not release refundable principal; cancellation is excluded after release.

## Validation and conclusion

Existing relevant tests were inspected by name and representative implementation: market-v2 suites, GenesisPlayerSale and its invariant suite, OmertaGuardedAuction, and real auction/player/coordinator integration. Parent runs own the execution log and test result; inspected tests are not represented here as executed evidence. No independent static-analysis success or complete vendor fuzz campaign is claimed.

No confirmed correctness defect was found in this manual slice. The two initial numerical/configuration leads were resolved against supported launch documentation below; neither is a confirmed supported-configuration defect. This conclusion is limited to the exact source/configuration and evidence above; it does not assert absence of bugs or authorize deployment.

## Dependency closure requested by parent

The endpoint-depth intermediate-removal hypothesis is closed for the supported PositionManager custody model. `lib/v4-periphery/src/PositionManager.sol` guards increase (`:293`), increase-from-deltas (`:306`), decrease (`:338`) and burn (`:409`) with `onlyIfApproved(msgSender(), tokenId)`. `base/ERC721Permit_v4.sol` authorizes the current owner/current owner operators/token approval; Solmate `lib/v4-core/lib/solmate/src/tokens/ERC721.sol:107` clears token approval on transfer. The original depositor's operators cannot modify vault-owned liquidity. Vault exposes no manager approval forwarding or ERC1271 signature authority. This closes unauthorized intermediate changes; price may still move between samples, consistent with documented sampled-depth design.

Stale-anchor trace: commit rejects observations older than deposit through `_checkpoint` invalidation; first valid sample creates no payout. Invalid/reverting/stale observations clear lastObservedAt and lastDepth. Repeated valid epoch/time reverts without credit. A subsequent valid epoch after anchor break starts a new interval. Independent depositor maturity exit does not require checkpoint, campaign funds, pause clearance or a functioning market-state source.


## Resolution against documented launch parameters

Read `PLAYER-GENESIS.md:28–35,62–64,77–83`, `LAUNCH-GUIDE.md:225–229`, and the Genesis coordinator/real-player integration fixtures. The player-first route explicitly requires choosing enough LP reserve for **both** sale inventories and final price bounds. Its proposed 10% player inventory is not a final constructor/deployment parameter; there is no approved root participant count, player inventory or exact coordinator reserve in these docs. Older launch tooling must not be broadcast for this route. Thus importing the older public-only reserve unchanged is expressly outside the supported player-first instructions.

### MKT-L01 reserve adequacy derivation

Let `U` be public inventory in base units, `V` player inventory, `p` final Q96 ETH-per-OMR-base-unit price, and `C = Σ cap(days_i)` the eligibility-root total ETH contribution ceiling (`cap<=5 ETH` per unique eligible wallet). Public clearing price is monotone, so public net accepted proceeds `A` satisfy `A/p_real <= U` (upstream currencyRaised floor makes this conservative), with `p_real=p/Q96`. Player allocated total is at most V; per-wallet ceil payments imply `B <= V*p_real+n wei`, also `B<=C`, where `n` is contributing-wallet count. Therefore:

`nativeBudget <= 3/8 * [ U*p_real + min(C, V*p_real+n) ]`.

For the actual finite usable range, define normalized square-root price `s=sqrtPriceX96/Q96`, lower `a=sqrtLowerX96/Q96`, upper `b=sqrtUpperX96/Q96`. Ignoring integer rounding only for this algebraic expression, exact matching token/native ratio is:

`r = s*b*(s-a)/(b-s) = s² * (1-a/s)/(1-s/b)`.

Thus launch preflight must prove `tokenReserve >= nativeBudget*r + integer rounding margin` for every approved price/contribution combination; the safe executable check uses the repository LiquidityAmounts/SqrtPriceMath at the actual integer sqrt price, rather than assuming exact 3/8 times combined inventory. In the effectively infinite-range approximation this reduces to `3/8*[U + min(C/p_real,V+n/p_real)]`.

For the documented public-only inventory `U=4,410,000 OMR`, the approximation is exactly `1,653,750 OMR`, matching LAUNCH-GUIDE. Adding a hypothetical player tranche `V=441,000 OMR` requires up to another `165,375 OMR` plus rounding/range margin; if instead player inventory means 10% of the *combined* sale inventory, then `V=490,000 OMR`, and extra matching inventory is `183,750 OMR`. The planning prose does not finalize that denominator, so neither figure is an approved configuration. The real integration fixture uses public U=1,000 OMR, player V=100 OMR and reserve=1,000 OMR, comfortably above approximate need 412.5 OMR; coordinator fixture also overcollateralizes its inventory.

At the documented floor (~205,882 OMR/ETH), `s≈453.742`; tick spacing 60 usable upper tick 887220 gives `b≈1.8407e19`, so the finite-range multiplier differs from infinite range by below roughly `2.5e-17`. This is tiny but **positive** near this floor, so exact-reserve launch math must retain a deterministic dust margin or compute the actual required integer inputs. A raw inventory percentage alone is not executable feasibility evidence.

Disposition: no supported witness of inadequate immutable reserve established. Explicit deployment preflight requirement, already required by PLAYER-GENESIS. Root participant count/caps and exact reserve are not frozen, so release feasibility remains unverified rather than a source vulnerability. No new harm proof authored for an unsupported configuration.

### MKT-L02 documented price range

At 205,882 OMR/ETH the Q96 ETH/base-token price is approximately `Q96/205882≈3.848e23`, over `8.9e13` times the rejecting `2^32` boundary. CCA clearing price never decreases from its configured floor. Consequently the documented floor excludes the low-price inversion overflow throughout the auction and player settlement. Its upper price bound is constrained by MaxBidPriceLib and source supply, and the coordinator checks resulting TickMath bounds.

Disposition: low-price lead invalidated for documented launch economics. Preserve only as unsupported arbitrary-constructor numerical-range limitation. No supported harm test needed; the launch floor itself excludes the premise.

## Daybreak cross-check: generic vendored CCA fee quote inconsistency

Daybreak identified a separate generic-dependency issue after the initial guarded-route pass: `ContinuousClearingAuction.lbpInitializationParams` subtracted the fee controller's reported amount without bounding it, while `sweepCurrency` already clamps the same amount to currency raised. A nonzero controller returning `raised+1` made the initialization parameter read panic (arithmetic underflow), even though sweeping retained defined behavior. This is a quote/API liveness inconsistency under a misbehaving trusted controller, not demonstrated theft. Current `OmertaGuardedAuction` always passes `address(0)` for the fee controller, so the condition is unreachable through the supported guarded route.

Remediation: apply the existing sweep clamp in the initialization read. Source provenance retains all original upstream package commits and upstream file hashes; README and the manifest localPatches entry describe the divergence. Added `test/ContinuousClearingAuctionFeeQuote.t.sol` using a real completed/graduated generic auction: an excessive fee quote must return zero net initialization proceeds and agree with the clamped sweep, while the zero-controller route retains the full raise. Zero net proceeds do not imply successful downstream liquidity migration; this patch cannot create capital or neutralize malicious fee governance.

PoC ledger: required YES; class integration; authored YES; executed by this reviewer NO (parent coordinates compilation/testing); no POC-PASS claimed here. Parent evidence determines final confirmation and retest disposition.
