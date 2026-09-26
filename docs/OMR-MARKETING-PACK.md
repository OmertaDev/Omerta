# OMR marketing and distribution pack

This pack describes the current canonical ETH/OMR market and its companion contracts. Deployment, funding, signer activation and game integration require separate evidence; publishing this copy does not establish that a product is live. Exact mechanics and limits are documented in the [market design](../omerta-contracts/docs/market/DESIGN.md).

## The positioning in one sentence

**OMR connects a mafia RPG to a market with funded liquidity, vested inventory bonds, player liquidity commitments and competitive family rights to earned fees.**

## Canonical long-form explainer

Omertà gives players reasons to acquire and use OMR through status, access and family competition. The market adds a concrete set of financial mechanisms: canonical trading fees fund named recipients, finite reserve compartments hold actual liquidity, bonds sell OMR already in inventory, and eligible liquidity commitments can earn prefunded ETH.

Each product has its own source of funds and its own rights. Holding OMR alone does not grant a share of the treasury, a stock dividend, a guaranteed reward rate or a redemption price.

### Trading fees and where they go

| Canonical sell fee component | Share of the fee-bearing settled amount | Destination |
| --- | --- | --- |
| Developer | 2.0% | Fixed developer recipient |
| RWA | 1.6% | Fixed RWA recipient |
| Community | 2.4% | Fixed community recipient |
| Protocol-owned liquidity | 3.0% | Core funding adapter |
| Sell-pressure surge | 0–1.0% | Stability / War Chest funding adapter |

The base sell fee is 9%; the bounded surge can bring the total hook fee to 10%. Uniswap LP fees are additional. Fee currency follows the actual settled swap: receipts may be ETH or OMR. Each recipient's accrued fees can be collected independently.

Buys after the opening window have no hook buy tax. The immutable opening configuration can apply a buy fee up to 10%, an actual gross ETH limit per swap and a window of at most 200 blocks. Those are constructor ceilings; the selected deployment values must be published. A per-swap limit does not restrict one person across multiple transactions.

These are the canonical pool's rules. Other trading venues have their own policies. Slippage, price impact, LP fees and gas still affect the amount a trader receives.

### Funded market support

Core holds two-sided protocol liquidity. Lower Cushion and Garrison deploy funded ETH into ranges that acquire OMR during weakness. Upper Cushion and Desk deploy funded OMR into ranges that supply buying demand. War Chest holds capital for permitted recovery. Turf has its own seasonal range and fee recipient.

Every deployment consumes bounded authority: per-action, episode and lifetime limits, observation requirements, cooldowns and available assets. Adding funds or removing a position does not reset consumed capacity. Recovery requires qualifying observations and transfers actual War Chest assets within the remaining limits.

A range can convert back if price reverses before its liquidity is removed. Market observations measure historical pool activity; they are not an external fair-value guarantee. The Safe can pause deployment, exit positions and retire idle capital to itself. The reserves therefore provide conditional liquidity support without creating an OMR holder redemption right.

### Inventory bonds

Bonds exchange ETH for OMR already funded in the bond contract. The full future payout is reserved at purchase and vests linearly. The contract cannot mint OMR.

Immutable terms include a discount of at most 10%, vesting from one to 365 days, limits per purchase, epoch and lifetime in both ETH and OMR, and price/depth checks. These bounds do not specify the terms of a particular offer. A 10% discount on the ETH price means approximately 11.11% more OMR per ETH.

Vested claims remain available during a purchase pause or oracle outage. The Safe can recover only unpromised inventory. Proceeds go to the fixed reserve recipient; funding that recipient does not create unlimited deployment capacity. Selling claimed OMR on the canonical market still pays its applicable fees.

### Player liquidity commitments

A commitment places an actual canonical liquidity-position NFT into custody for a finite term. It is a commitment of LP inventory, with exposure to changes in the position's asset composition.

Campaign rewards are prefunded ETH. Two distinct qualifying observations measure useful depth; the lower adjacent sample bounds credited depth-time. Rewards are capped by the campaign's per-position terms and remaining funds at checkpoint time. Timing and available funds matter; a campaign does not promise an APY.

The depositor can recover the NFT at maturity even if rewards are exhausted, the strategy is paused or the oracle is unavailable. Earned LP fees remain attached to the NFT, and already credited campaign rewards can be claimed separately.

### Families, Turf and sieges

Turf gives families rights to future funded LP fees from specified seasonal price ranges. It gives no right to withdraw the protocol's LP principal. A syndicate can contain up to four families with shares totaling 100%.

Before ownership or treasury changes, the fee bridge checkpoints accrued fees so historical beneficiaries retain their credits. Sieges freeze participant wallets and escrow actual fees. A successful attacker receives its configured share of the escrow and future ownership; expiry defaults to the defender.

Typed, replay-checked game settlements authenticate the authoritative server's outcomes. They do not independently simulate combat on-chain. Corridor, loyalty and fortification status do not multiply monetary claims.

### Arbitrage and reserve funding

A solver funds an atomic ETH-to-OMR-to-ETH cycle across the canonical pool and an unhooked alternative pool. Execution must meet its declared positive minimum profit after trading fees. A fixed share of realized profit, capped at 50%, accrues to the reserve recipient; the solver receives its collateral and remaining profit through claims.

Commit/reveal binds the exact plan to its solver. It does not promise exclusive arbitrage, private order flow or immunity to competing trades. Failed attempts can still cost gas.

### RWA and extraction claims

A fee allocation to an RWA recipient does not itself execute a stock purchase or entitle passive OMR holders to stock. Asset eligibility, acquisition, allocation, custody and delivery need their own verified configuration and activation evidence.

Similarly, the market's liquidity inventory is not a withdrawal reserve for every game balance. Describe extraction only against its own funded custody, authorized claims and current activation state. Assets remaining in a deed account can follow that deed, but its owner may remove them before transfer.

### The speculative appeal

The investment thesis depends on people continuing to enjoy and pay for the game, useful OMR demand, actual fee revenue, sufficient market depth and disciplined inventory management. Families and liquidity providers can have specific funded rights when they participate in those products; passive token ownership alone does not confer those rights.

Supply concentration, resale pressure, adverse selection, governance decisions, compromised keys, unavailable infrastructure and weak player retention can undermine the thesis. Contract limits bound particular actions; they do not guarantee price appreciation or successful operation.

## Technical social thread — 10 posts

**1/** OMR connects a mafia RPG to a market built around actual inventory: protocol liquidity, vested bonds, player liquidity commitments and family Turf.

**2/** Canonical sells pay a 9% base hook fee: 2% developer, 1.6% RWA, 2.4% community and 3% POL. A bounded 0–1% sell-pressure surge funds stability. LP fees are additional.

**3/** Normal buys have no hook buy tax after the immutable opening window. Opening fee, duration and quote-size limits are deployment parameters. Other venues have their own rules.

**4/** Core, Lower Cushion, Garrison, Upper Cushion, Desk, War Chest and Turf keep separate inventory and budgets. Market recovery cannot create ETH or reset lifetime spending authority.

**5/** Bonds sell funded OMR. They reserve the complete entitlement when ETH arrives and vest it over the configured term. No bond mint authority; no guaranteed sellback.

**6/** LP commitments hold real position NFTs. Campaigns pay from prefunded ETH against sampled useful depth and fixed limits. NFT maturity exit remains available independently of reward funding.

**7/** Family Turf earns funded LP fee credits. Families cannot withdraw protocol principal. Sieges escrow actual fees, and ownership changes checkpoint old entitlements first.

**8/** Arbitrage uses solver collateral. The cycle must realize its minimum profit; a fixed share funds reserves. Competition can still make a transaction fail and cost gas.

**9/** Holding OMR is not a treasury share or automatic stock dividend. Any RWA or extraction product needs its own verified assets, permissions and activation.

**10/** Assess the game, net buying demand, actual reserves, fees, governance and executable liquidity. Implementation evidence and deployment evidence answer different questions.

## Short variants

### Gamer-first

Build a character, organize a family and compete for standing in Omertà. OMR connects that activity to a market where inventory bonds, liquidity commitments and family Turf have explicit terms. A family can earn funded fees without owning the protocol's liquidity principal. Check which products are activated before committing funds.

### Investor-first

OMR's speculative case rests on a game people want to keep playing and market products they choose to use. Trading can fund liquidity and reserves; bonds sell existing inventory; liquidity commitments and Turf distribute only funded entitlements. None of those mechanisms guarantees token appreciation.

### Builder-first

Follow the canonical PoolKey, actual swap deltas, fixed fee recipients, reserve accounts, committed bond inventory, LP NFT custody and funded family credits. Verify code, configuration, deployed runtime and activation together. The [market runbook](../omerta-contracts/docs/market/RUNBOOK.md) documents the operational boundaries.

### Graphic caption

**THE OMR MARKET**

Funded liquidity. Vested inventory bonds. Player LP commitments. Family Turf.

The game creates reasons to participate. The contracts define inventory, authority and funded claims.

## FAQ

**Does a bond create new OMR?**
The inventory-bond contract transfers OMR already funded in it. This claim concerns the bond mechanism; token supply and the token's own authority must be checked separately.

**Does the reserve guarantee a floor?**
No. Available capital and deployment limits are finite, positions can lose value, and the Safe can withdraw protocol inventory.

**Does holding OMR earn the LP rewards or Turf fees?**
Those rights arise from an eligible liquidity commitment or recorded family entitlement, not passive OMR possession.

**Is the discount a guaranteed profit?**
No. Vesting, price movement, trading fees, slippage and gas affect eventual proceeds.

**Are these products live?**
Use verified deployed addresses, funding balances, accepted configuration and activation records. Source code or marketing publication alone cannot answer that question.

## Distribution and source discipline

Use this text only with artwork whose rates, products and activation claims match it. Verify an existing graphic before reusing it. Publish exact offer terms and product status with any launch announcement.

- [Market design](../omerta-contracts/docs/market/DESIGN.md)
- [Market release and operations runbook](../omerta-contracts/docs/market/RUNBOOK.md)
- [Trading hook](../omerta-contracts/src/market-v2/OmertaHookV2.sol)
- [Stability controller](../omerta-contracts/src/market-v2/OmertaStabilityControllerV2.sol)
- [Reserve funding](../omerta-contracts/src/market-v2/OmertaReserveFundingV2.sol)
- [Inventory bonds](../omerta-contracts/src/market-v2/OmertaInventoryBondV2.sol)
- [Liquidity commitments](../omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol)
- [Turf rights](../omerta-contracts/src/market-v2/OmertaTurfV2.sol)
- [Typed game settlement](../omerta-contracts/src/market-v2/OmertaGameSettlementV2.sol)
- [Arbitrage](../omerta-contracts/src/market-v2/OmertaArbitrageV2.sol)
