**Launching Omerta through pons — design proposal, 14 October 2026**

We can adopt pons, but its standard launch would replace several enforceable properties of our current market. The decision is whether additional distribution justifies a different token, different funding model, venue-dependent revenue, and a new market observation system.

My recommendation is to negotiate a concrete distribution partnership first. Prefer marketing and discovery support for our current market if pons will support its restrictions. Ask about a bespoke launch integration if preserving those properties is essential. Adopt the standard factory route only if we deliberately accept the economic changes below. A promise of exposure is insufficient justification for this redesign.

This proposal examines the current working-tree implementation under `omerta-contracts/src/market-v2/`. HEAD is `e56cf576065c5f1bbb9bb55115f5961267f7d654`; many relevant files are modified or untracked, so HEAD alone does not identify the inspected implementation. [Research evidence](pons-launch-evidence-2026-10-14.json) records selected source hashes and the live pons snapshot. This is architecture research, not a security clearance or a production activation check.

**What the live launch actually does.** The root pons docs describe its earlier platform. The relevant new-launch system is [pons v2](https://docs.ponsfamily.com/v2). Read-only RPC calls at Robinhood Chain block **88,627,146**, timestamp **2026-10-14 19:44:42 UTC**, found the following active configuration:

| Parameter | Observed value |
|---|---:|
| Chain | Robinhood Chain, 4663 |
| Public creation | Enabled |
| Available configuration | One enabled configuration, ID 0 |
| Token supply | 1 billion, 18 decimals |
| Virtual quote reserve | 1.68 ETH |
| Graduation reserve | 4.2 ETH, net of fees |
| Base curve / graduated hook fee | 1% / 1% |
| Optional creator tax ceiling | 10% |
| Creation fee | 0.0005 ETH |
| Graduated LP fee / tick spacing | 0 / 200 |
| Opening buy tax | Starts at 99%; live window 3 seconds |

The deployed [factory](https://robinhoodchain.blockscout.com/address/0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e?tab=contract) creates its own ERC20 and curve. It does not offer an interface to import our token or choose our hook. Configurations are owner-managed; request a 100-million-supply configuration if preserving denomination matters. That would still leave the factory-token and settlement incompatibilities.

The factory's verified token implementation mints all inventory to the curve, with no free team allocation or subsequent minting. It permits ordinary transfers and holder burns. The curve uses constant-product pricing with a virtual quote reserve; buyers receive tokens immediately. This differs materially from our proposed timed auction and jointly gated player claims.

Using the verified graduation arithmetic, with supply `S`, virtual quote `P`, and real graduation reserve `T`:

```
public purchases = S × T / (P + T)
LP tokens        = S × P × T / (P + T)²
locked remainder = S × P² / (P + T)²
```

| Derived default allocation | Approximate tokens | Share |
|---|---:|---:|
| Curve purchasers | 714.286 million | 71.4286% |
| Permanent LP against 4.2 ETH | 204.082 million | 20.4082% |
| Permanently locked outside LP | 81.633 million | 8.1633% |
| Free treasury/team allocation | 0 | 0% |

The smaller LP allocation preserves the terminal curve price when virtual collateral disappears. Derived opening FDV is 1.68 ETH and graduation FDV approximately 20.58 ETH. These are marginal-price valuations, not realizable treasury value. Integer rounding is omitted here.

The [locker](https://robinhoodchain.blockscout.com/address/0x267444D099b10fB5Ed7c3Cc7B7c767AdcA574952?tab=contract) permanently holds the initial full-range position and excess tokens. We cannot withdraw or rebalance that principal. Additional independently funded LP positions are technically possible under the hook's permissions and remain removable by their owners; they do not receive ordinary LP fees in this zero-fee pool.

**What we gain, and what we give up.**

| Dimension | Potential benefit | Cost or limitation |
|---|---|---|
| Discovery | Access to an existing launch browsing and trading audience | Visibility competes with other launches; traders may never become players |
| Promotion | pons explicitly offers marketing requests through its [Builders page](https://ponsfamily.com/builders) | No public commitment to campaign deliverables for Omerta |
| Distribution | Standard transferable ERC20 simplifies wallet and venue compatibility | We lose our sealed settlement boundary and universal native-market fee enforcement |
| Liquidity | Automatic public price discovery and permanent initial liquidity | Default capital is small, price is path-dependent, and our treasury receives no sale principal |
| Execution | Less custom primary-sale machinery | New dependency on pons' contracts, graduation process and fee operations |
| Credibility | Independently verifiable liquidity lock | Does not establish adequate exit depth, decentralized revenue control, or audited safety |
| Product focus | We can concentrate launch effort on a working game and player conversion | Some current financial-game features must be redesigned or activated later |

We already target chain 4663, so this does not inherently require a chain migration. It also does not establish a Robinhood brokerage listing or access to Robinhood's customer base; pons' [site](https://ponsfamily.com/analytics) expressly states it is not affiliated with Robinhood Markets.

Before contracting, ask for featured placement, dated posts and live events, integration links, campaign duration, creative responsibilities, costs, exclusivity, and attribution reporting. Measure unique funded wallets that enter the game, complete meaningful play and return after 7/30 days. Compare graduation rates, concentration and retention across comparable launches, including failures. Platform-wide turnover and a featured coin's market cap do not answer that question.

**The revenue model needs an explicit choice.** The [verified hook](https://robinhoodchain.blockscout.com/address/0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044?tab=contract) currently snapshots a 30% protocol share of base fees. With automatic buybacks disabled, the creator receives the remaining 70% plus the entire creator tax. The hook accrues fees in either currency; token-denominated amounts require conversion before normal quote-asset payout.

For the observed 1% base rate, the following are nominal fee-bucket comparisons:

| Creator tax | Total canonical charge | Omerta revenue before our split | pons share |
|---|---:|---:|---:|
| 0% | 1% | 0.7% | 0.3% |
| 1.3% | 2.3% | 2% | 0.3% |
| 4.3% | 5.3% | 5% | 0.3% |

These rates apply to assessed fee legs, not automatically to dashboard dollar turnover. Exact-input/output direction, conversion execution and rounding affect realized receipts. Test both curve and pool settlement rather than estimating revenue from quoted volume alone.

Our inspected manager enforces **5% base**, split **2% founder/operations, 1% RWA, 1% community, 1% POL**, plus bounded hook charges and separate LP fees. See [manager constants](../omerta-contracts/src/market-v2/core/OmertaPoolManagerV2.sol#L108) and its [split](../omerta-contracts/src/market-v2/core/OmertaPoolManagerV2.sol#L525). Some market docs still say 5.5% base and different allocations; source and planner currently agree on 5%. Resolve that drift before publishing launch terms.

A 4.3% creator tax could reproduce the nominal 5% aggregate Omerta bucket on the pons venue, with buybacks off. Splitting realized proceeds 40/20/20/20 approximates the current four base-revenue entitlements. It does not restore LP yield or revenue from other venues. Any holder can create or use another pool; a high creator tax creates an incentive to route around us.

The lower 2% Omerta-revenue scenario needs roughly **2.5 times** the comparable taxable turnover to match today's 5% base-revenue budget. With no creator tax, the multiplier is approximately **7.14 times**. This is a sensitivity calculation, assuming comparable execution and collection, not a volume forecast. Retain the lower fee only if conservative marketing and game-revenue forecasts fund actual obligations. Creator tax is fixed at creation, so this choice precedes launch.

I would initially disable pons' optional buyback. Under the observed settings it diverts half the creator base-fee remainder into purchases; the [vault](https://robinhoodchain.blockscout.com/address/0x42df2a798f82289E177311362e8f5ccC45c1219c?tab=contract) vests acquired tokens over five years, split 70% creator/30% protocol. Those purchases do not burn tokens and are unsuitable as immediately usable game inventory. Later activation should be a separate budget decision.

**Contract changes for a standard launch.**

| Component | Required design change |
|---|---|
| OMR and settlement | Use the factory token as canonical OMR. Replace `OmertaRestrictedOMRV2`, its custom `OmertaPoolManagerV2`, and policy-specific swap router on this route. Our transfer policy cannot be added afterward. |
| Pool/hook | Use the pons pool and its hook. A PoolKey has one hook; ours cannot be attached alongside it. A second Omerta pool would fragment liquidity and make its charges avoidable. |
| Primary sale | Replace guarded auction, `GenesisPlayerSale` purchase terms and `OmertaGenesisCoordinatorV2` migration with factory creation, curve trading and verified graduation. Preserve eligibility work where useful. |
| Creator revenue | Add a narrowly scoped recipient contract that can claim its own escrow balances, accept receipts and credit fixed-purpose buckets. Keep claims and downstream funding asynchronous; never execute game logic during swap settlement. Include restricted administration for recipient/buyback changes and account for direct rescue receipts. |
| Turf/family income | Replace `OmertaTurfFeeBridgeV2`'s LP-fee source with an explicitly funded creator-revenue allocation, or use another independently funded source. Zero LP fee means existing position-fee entitlements produce zero. Define beneficiary changes and settlement ordering before deploying the replacement. |
| Market observations | Replace concrete `OmertaMarketStateV2` hook dependency. Its continuous tick/liquidity integrals and flow measurements require a real new observation design, not an address change. |
| Controller, bonds, commitments | Redeploy compatible immutable consumers after observations and funding exist. Purchased inventory can support the current funded inventory-bond concept. Independently owned LP positions require independent capital and revised incentives. |
| Pair and ranges | Prefer native ETH. WETH/stable quotes require ERC20 settlement, currency order/decimal normalization and revised ETH-based accounting. Rebuild Turf boundaries and bands on the 200-tick grid, approximately 2.02% between adjacent grid points. |
| Operations and UI | Add phase-aware curve/v4 quotes and trades, canonical pool validation, graduation jobs, unswept fee accounting, escrow claims, revenue funding and updated activation states. Replace current keeper/solver assumptions rather than editing addresses. |

The observation problem is the hardest technical gap. Our [market state](../omerta-contracts/src/market-v2/OmertaMarketStateV2.sol#L35) depends on every-swap measurements from `OmertaHookV2`. pons has no downstream observation callback. Standard v4 slot0 sampling does not reproduce a continuous TWAP, and an EVM contract cannot independently read historical Swap logs.

To preserve the current full-epoch measurements, negotiate a new callback-capable pons deployment or adopt a disclosed signed/indexed oracle with independently reviewed trust assumptions and limits. The latter changes our trust guarantees. A deliberately weaker onchain sampled-price/depth design is also possible, but requires redesigned consumer policies and cannot reproduce continuous TWAP, epoch minimum liquidity or flow measurements. Until the selected feed is ready, keep observation-dependent controller actions, discounted bonds and liquidity-performance rewards inactive. Turf operations that require those epochs also need the replacement feed. Basic gameplay can launch independently.

Much of the game, ownership and prefunded ERC20 reward logic can be reused. Existing deployed contracts with immutable OMR/pool bindings need replacement deployments. The recorded [mainnet manifest](../omerta-contracts/deployments/4663/manifest.json) describes a dormant deployment; it is a September snapshot, not a fresh chain check. Reconcile actual balances, claims and reserves before a new token address becomes canonical.

**A concrete player-first launch through the standard factory.**

1. Secure the campaign and choose the economic model. Agree native ETH pairing, supply configuration, creator tax, recipient custody, sweep service and ownership-risk terms. Pin the launch economics with `expectedEconomics` immediately before creation.
2. Run meaningful-play qualification before creating the token. Freeze reproducible wallet eligibility, publish appeals and a reward allocation rule. Do not promise the auction's final-price parity, 48-hour purchase tranche or common claim cliff: the public curve cannot enforce them.
3. Fund three independent budgets: operating runway, ETH downside reserves, and ETH for purchasing OMR rewards/controller/bond inventory. Sale principal is unavailable for these budgets. Prefunding before creation means committing ETH, not claiming to own nonexistent reserved OMR.
4. Publish any treasury purchase budget, price/impact limits, resulting inventory targets and vesting. Prefer disclosed purchases after the opening protection window. Creator exemptions permit preferential opening execution; do not build undisclosed privileged acquisition into a player-first campaign. A large treasury buy itself moves the curve and can cause graduation.
5. Create through the Safe-controlled launch process with the fee recipient already deployed and automatic buybacks off. Publish the canonical address. Route the campaign into playable onboarding, then wallet/trading participation. Any user subsidy must be bounded and funded.
6. Transfer actually acquired reward inventory into a prefunded claim/vesting contract. Allocate proportionally under the published eligibility rule, specify unused-token handling and avoid equating a planned percentage with guaranteed inventory. Claims should depend on custody/funding conditions we can enforce.
7. Verify graduation, actual locked position, pool identity and received fee policy. Apply separate readiness thresholds for executable depth, holder concentration and operational runway. Reaching 4.2 ETH alone is insufficient.
8. Begin fee claims and publish realized allocations. Activate observation-dependent financial modules only after the replacement feed, inventory, reserves and production-stack rehearsal satisfy their release requirements.

This sequence preserves rewarding real players, but changes how their tokens are acquired and allocated. If a guaranteed player purchase tranche at the public clearing price is essential, standard pons cannot provide it; request a bespoke sale design.

**Trust and execution terms to resolve.** Verified source shows that the platform owner can redirect any launch's future creator fees and buyback beneficiary after three days' notice; abandonment is not an onchain prerequisite and the creator has no veto. Contractual limits would not remove that authority. The shared factory/hook owner was a 2-of-3 Safe at the recorded block.

Normal fee conversions depend on a platform-appointed sweep operator. Our recipient contract alone cannot guarantee their execution. Negotiate cadence, reporting and contingency behavior. The failed-graduation rescue can send swept assets to an owner-selected recipient after seven days for off-chain distribution; it is not an automatic individual refund system. These powers matter when financing recurring game obligations.

The [audit section](https://docs.ponsfamily.com/v2#audits) still says reviews are in progress and no audit has closed. Obtain final reports, findings/retests and the precise deployed revisions they cover before funded release. The same docs retain stale closed-launch and five-second-protection statements; live reads found public access and three seconds. Verified source is useful evidence, but does not establish audit completion.

**Decision rule.** Proceed with a standard launch only if the signed campaign, conservative venue-revenue forecast and independently funded inventory/runway justify both the engineering work and the lost guarantees. If mandatory market revenue, the existing observation guarantees, owned launch capital or fixed player-sale parity are essential, pursue a bespoke partnership or retain our launch and buy distribution support separately. Those alternatives also require pons' willingness to support our custom routing and transfer restrictions; they cannot be assumed to provide standard-launch reach.

The next concrete deliverable should be a joint term sheet covering campaign scope, exact economics, contract compatibility, fee-owner authority and observation support. After that decision, prepare the selected implementation and run targeted settlement/revenue tests, adversarial fee-bypass cases, oracle failure tests, invariants and an exact-stack chain fork rehearsal under the repository's release review policy. No launch transaction or contract implementation was performed for this study.
