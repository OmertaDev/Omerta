# Bank, market and oracle review — 2026-09-08

This contribution covers the ten local implementation files below and their used interfaces and library calls. The root report records exact source versions, execution outcomes and remaining activation requirements. Source inspection and test design are distinct from executed evidence; see the root evidence ledger for the completed runs.

## State and authority model

| Implementation | Entry points and paths reviewed | Custody, authority and failure boundary |
| --- | --- | --- |
| `Alchemist.sol` | Constructor compatibility; LTV, fee, flow and caller setters; collateral/debt views; deposit, withdraw, withdrawAll, mint, repay, harvest and fee sweep | Per-user escrow; exact incoming asset delta and caller share floor; nonreentrant position changes; health checked after actual vault withdrawal; debt reduction and Transmuter funding revert together. Owner chooses policy beneath hard LTV/fee ceilings. |
| `CollateralEscrow.sol` | Constructor; deployToVault, withdraw, withdrawAll, totalAssets | Only immutable controller can move collateral. Exact temporary approval, actual received-share delta, fee-aware previewRedeem. External vault accounting and liquidity remain trusted; no arbitrary-token rescue. |
| `Denari.sol` | Constructor, issuer/burner administration, mint, burn; inherited transfer/permit | Owner appoints issuer and burner. The burner can burn any address without allowance; deployed Transmuter uses only its own acquired balance. The role itself is privileged and is not an owner-confiscation prohibition. |
| `Transmuter.sol` | Constructor and setters; requiredBuffer, bufferHealthy, fund, redeem | Fund allowlist plus exact actual asset delta; tracked reserves, not physical balance, are redemption authority. Burn and payout are atomic. Redemption is public, bounded by reserves and configured flow caps. Zero cap means unlimited. |
| `FlashGuard.sol` | Caller check, entry block stamp/check, block/day flow metering | Abstract shared guard; EOA/allowlisted caller policy and same-block separation apply only where invoked. It is not proof against all multi-block price, vault or governance risks. |
| `OmertaHook.sol` | Constructor/address flags, ERC165, recipient/tax/quote/observer/opening/surge setters, initialization and swap callbacks, fee accrual/sweep, tick accumulator and observation reads | Immutable PoolManager/authorized initializer; approved quote gate; actual swap deltas determine fees; bounded total fee and snapshotted opening deadline; manager settles held fees; permissionless sweep has fixed configured destinations. Observer call isolated with bounded gas. |
| `OmrTwapOracle.sol` | Constructor, token ordering, cumulative-price reads, update, consult | Exact V2 pair and fixed period. Counterfactual cumulative accrual and uint32 wrapping follow pair semantics. No zero-reserve price is manufactured, but real pair liquidity and meaningful market depth remain economic assumptions. |
| `OmrV4TwapOracle.sol` | Constructor/key binding, observe, update, consultation and cumulative-tick conversion | Reads exact canonical Hook/key, not keeper-chosen prices; geometric TWAP window and negative-tick rounding; old values expire. Tick observation does not measure active liquidity. |
| `StockTokenRegistry.sol` | Owner token registration/activation, publisher configuration, prior-day ballot publication and resolution | Closed token catalog; immutable closed-day choice and bounded purchase interval/budget. External token metadata and upgradeability require concrete token review. |
| `RwaStockBuyer.sol` | Constructor; paused dependency/keeper configuration; quote floors; buy and ETH sweep | Keeper-only, nonreentrant buy; exact resolved asset and immutable StockVault destination; real output delta, quote floor, caller minimum and budget. Safe chooses adapter/feed while paused; code presence alone does not verify their behavior. |

The Bank has no internal pooled collateral share price. Each escrow nevertheless owns shares in an external ERC-4626 vault, whose exchange rate is used to decide borrowing capacity. Denomination matching removes a currency conversion; it does not establish that a vault cannot lose value, be paused, lie in previews, charge unexpected fees or be upgraded. Existing position impairment is local to the position; it does not automatically pause otherwise healthy users. These limits were corrected in explanatory comments without changing runtime behavior.

Debt and supply are different quantities. A user may repay debt using underlying while the previously issued DNR remains outstanding and is now supported by Transmuter reserves. The valid model considers debt plus funded redemption backing, rather than claiming that every outstanding DNR remains bounded by escrow collateral alone. Direct token donations do not increase tracked Transmuter reserves. Native and ERC-20 Hook fees are tracked independently by currency.

## Adversarial passes and findings

Methods apply the pinned Pashov execution/trigger/impact gates, Plamen token-flow and unsolicited-transfer checks, and Trail of Bits context/specification/static/property review. Scenarios include hostile recipients, callback reentry, share donation/inflation, false-return and fee-bearing assets, nonlinear vault exits, rounding/dust, debt and reserve conservation, zero/unlimited cap transitions, stale oracle intervals, partial and exact-output swaps, opening/surge interaction, unauthorized pool initialization, observer failure, stale ballots, output substitution and adapter change. No upstream orchestration or unrelated mechanism coverage is claimed.

### M-01 — Hook self-recipient clears the claim without moving fees

Severity: **Low**, privileged configuration error with permanent loss of availability for the affected fee amount. An ordinary caller cannot set the recipient, but can trigger the permissionless sweep after the Safe has made the error.

Affected original path: `OmertaHook.setRecipients` accepts `address(this)` for any of its four legs. After real swap fees accrue, `sweep` clears the owed counters and sends that leg to the Hook itself. Its payable receive accepts native ETH; a standard ERC-20 transfer to self likewise preserves the token balance. No counter records the retained amount and there is no general recovery method. Rotating to a correct wallet cannot restore the erased claim. This is a configuration trap, not a proof that a stranger can steal fees.

The new market proof creates a real v4 PoolManager and actual OMR/ETH liquidity, sells OMR, selects the Hook as the developer recipient, and checks zero owed counters plus stranded ETH. Retain the original proof and pre-fix output; the final regression must reject self in all four recipient positions and demonstrate that previously accrued claims can still be swept to valid destinations. The root report records remediation and retest status.

### M-02 — A tick-only oracle can publish a fresh price for an empty pool

Severity: **Medium conditional integration risk**, open for the affected bond/liquidity activation. This is a demonstrated price-validity failure under the stated liquidity precondition, not a demonstrated production bond-drain transaction.

The market proof initializes the exact authorized Hook/key without active liquidity, then makes a public real PoolManager swap. Both token deltas are zero, while sqrtPrice changes from Q96 to 2×Q96. After 600 seconds, the oracle publishes approximately 4× the prior quote with a current update timestamp. The passage of time proves a tick interval, not the economic cost of that interval. Neither freshness nor a current nonzero spot liquidity check would prove continuous adequate liquidity over the whole averaging window.

The intended genesis path adds full-range liquidity atomically with initialization. That prevents the test's pre-funding condition in a correctly executed launch. Later LP custody/removal and economic depth still matter. Before using this oracle to arm bonds, bind evidence to the actual initialized pool, full-range position, custodian/lock policy, observation period and meaningful depth. Recheck these conditions on continued issuance; suspend issuance if they cease to hold. A future stronger on-chain observation design must cover liquidity throughout the window and requires review of the immutable Hook permission set. The signed bond quote, independently constrained backend pricing, hard rate ceiling and finite daily cap constrain loss; they do not turn an empty market's tick into a valid price.

### Configuration and dependency observations

| ID | Disposition | Required interpretation |
| --- | --- | --- |
| M-CFG-01 | Open concrete-dependency gate | Select and pin the actual Bank asset/ERC-4626 vault and RWA tokens/adapter/price source. The mocks used to test malicious behavior establish local checks, not live token/vault compatibility. |
| M-CFG-02 | Explicit cap semantics | Bank issuance/redemption flow cap zero is unlimited. Buffer seeding is mandatory; the post-mint buffer test rolls back an unseeded first borrow. Finite caps and funded reserves belong in activation verification. |
| M-CFG-03 | Tax-layer wiring | OMR transfer tax remains zero on the canonical Hook venue to avoid stacking two independent fee layers. Unhooked pools are possible; the Hook enforces policy only for pools that use it. |
| M-CFG-04 | No guaranteed dollar value from denomination labels | Stablecoin depeg, vault losses, withdrawal limits and insufficient liquid reserves can impair economic redemption. The local accounting checks are not a guarantee of asset valuation or simultaneous full redemption. |
| M-HYP-01 | Not promoted | Donation, stale quote, arbitrary-send and callback static warnings were followed through authorization, actual balance checks, nonreentrancy and rollback. No additional reachable unprivileged asset diversion was established within the supported asset model. |

## Evidence and limits

Relevant existing suites include `Bank`, `AlchemistRedTeam`, `TransmuterFundingRedTeam`, `FlashGuard`, `OmertaHook`, `OmertaHookObserverDoS`, both TWAP oracles, `RwaStockMachine` and `RwaStockMachineRedTeam`. Supplementary traces are in `test/audit/ComprehensiveMarketAudit.t.sol`. The root ledger supplies executed counts, seeds, failures, remediation and artifact hashes; names alone are not execution evidence.

The 89 market implementation diagnostic occurrences have explicit dispositions in `market-static-triage.json`; shared dependency and interface diagnostics are reconciled separately. Runtime changes require a fresh affected static run. Comment corrections alter source metadata and are retained in the before/after manifests, even where executable semantics are unchanged.

This review does not approve arbitrary ERC-20/ERC-4626 implementations, external stock valuation, an unselected live adapter, mutable Safe modules or production liquidity custody. All local production files in this group were included; concrete deployment dependencies still limit activation conclusions.
