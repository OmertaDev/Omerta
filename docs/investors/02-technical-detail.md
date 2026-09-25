**Omertà: technical investor detail, game mechanics and contract economics**

Updated September 25, 2026, America/New_York. Read alongside the [plain-language explanation](01-plain-language.md). The two guides differ in technical depth. This guide uses the current game and market implementation as its sole economic model.

For a passive token buyer, the potential appeal is recurring player utility, useful liquidity and disciplined inventory distribution. LP campaign rewards, Turf fee claims and solver profits belong to participants who meet the relevant contract conditions; they do not become a universal OMR dividend.

**1. The market contracts and their tokenomics**

The ten market implementation contracts are written and define the current model. They implement trading fees, observations, segregated market-support budgets, inventory bonds, LP commitments, Turf fee rights, game settlement and arbitrage. Production activation, selected constructor parameters and funding need separate evidence.

Inventory bonds sell pre-existing OMR and have no mint authority. OMR itself retains an owner-controlled minter role; inventory-funded sales do not impose an immutable cap on the token’s supply.

| Module | Economic function |
|---|---|
| OmertaHookV2 | Immutable canonical trading fees, bounded opening policy and decaying sell-pressure surge |
| OmertaMarketStateV2 | Finalized interval price, volatility, depth/turnover and stress observations |
| OmertaStabilityControllerV2 | Separately funded LP compartments, constrained deployment and recovery |
| OmertaReserveFundingV2 | Fixed-destination ETH/OMR funding adapter |
| OmertaInventoryBondV2 | Discounted vested sales of already held OMR |
| OmertaCommitmentVaultV2 | Prefunded ETH rewards for useful committed LP NFTs |
| OmertaTurfV2 | Seasonal rights to funded LP fees assigned to Families/syndicates |
| OmertaTurfFeeBridgeV2 | Checkpointing and routing actual LP fee entitlements |
| OmertaGameSettlementV2 | Typed authorized game-result adapter |
| OmertaArbitrageV2 | Solver-funded atomic arbitrage with a reserve share of actual profit |

**Fees and market measurements.** The canonical pair is native ETH as currency0 and OMR as currency1. Base sell fee is 900 basis points: 200 developer, 160 RWA, 240 community, 300 POL. A 0–100 basis-point surge goes to stability. Total hook sell fee is at most 10%, with LP fee additional. Constructor bounds permit LP fees up to 10%; that is a code ceiling, not a selected launch rate.

After opening, buys have zero hook tax. An immutable opening window can last at most 200 blocks, tax buys up to 10% and apply a per-swap actual gross ETH cap. Exact-output buys include the opening surcharge within that cap. No per-swap limit proves a per-human anti-whale limit. Fees follow the unspecified settled asset: exact-input sell ETH, exact-output sell OMR, exact-input opening buy OMR, exact-output opening buy ETH. Per-recipient claims are independently sweepable and a recipient can redirect only its own claim. Rates/recipients/policy are otherwise immutable under this design.

Surge pressure decays linearly over 60 seconds since the last sell update; a buy does not reset it. Let p be decayed prior raw-tick pressure, m the current positive sell tick movement and L the full-stress threshold. The additional basis-point fee uses the following integer arithmetic:

| Condition | Additional rate |
|---|---|
| m = 0 | `floor(100p/L)` |
| p + m ≤ L | `floor(100(2p+m)/(2L))` |
| p + m > L | `100 − floor(100(L−p)²/(2Lm))` |

Stored pressure caps at L. This is a bounded stress-pricing rule, not proof of sandwich resistance or economic neutrality when trades are split.

Observation epochs last between 60 seconds and one day. Validity requires a full finalized interval, freshness and minimum liquidity. Mean tick uses time weighting; volatility is the square root of tick variance. The OMR/ETH quotation is `sqrtPriceX96² × 1e18 / 2^192`. Sell imbalance is `max(sell−buy,0)/(sell+buy)`, or zero with no volume, attenuated by turnover relative to 1% of minimum virtual ETH depth. Stress takes the capped maximum of normalized volatility and sell imbalance. These are measurements of the market's own trading, not independent intrinsic value; wash trading and sustained manipulation remain relevant risks.

**Reserve compartments.** Core, Lower Cushion, Garrison, Upper Cushion, Desk, WarChest and Turf maintain separate inventory and authority. Core holds two-sided liquidity. Lower Cushion/Garrison deploy ETH to acquire OMR during weakness; Upper Cushion/Desk deploy OMR to sell during strength. WarChest retains funds for allowed regeneration; Turf uses seasonal fixed ranges.

Raw price is OMR/ETH, so a higher tick means a lower ETH value per OMR. With anchor A and tick-spacing-rounded width W = clamped twice-volatility, bands are Core `[A−4W,A+4W]`, Lower Cushion `[A+W,A+2W]`, Garrison `[A+2W,A+3W]`, Upper Cushion `[A−2W,A−W]`, Desk `[A−3W,A−2W]`.

Separate stress-on/off thresholds create hysteresis. Downside deployment requires stressed regime; upside deployment requires its absence. Funding, per-action, episode and lifetime budgets, unique observations, cooldowns, current/historical liquidity and spot deviation all constrain deployment. The configuration bounds include at most one-day age, at least one-minute cooldown/recovery spacing, at most 2,000-tick spot deviation and a configured pre-rounding width cap of at most 10,000 ticks. Rounding W to tick spacing can exceed that cap by up to spacing minus one; the Core range spans 8W. A compartment has at most one active position.

Converted LP inventory can reverse with price until its position is actually removed. Permissionless finalization requires actual directional conversion and a later block; crossing a line on a chart is not a final settled buyback. Principal and earned fees are separately accounted.

Recovery needs X healthy observations across a complete Y-sample window, with Y ≤32 and spacing/uniqueness requirements; gaps reset evidence. Regeneration moves actual WarChest capital within missing episode and remaining lifetime limits. Funding or removing a position does not recreate consumed lifetime spending authority.

The Safe can pause deployment, exit positions and retire idle principal to itself. Oracle failure does not need to block existing claims, collection or seasonal maturity exits. These reserves therefore offer conditional market support, not irrevocable backing or holder redemption rights. Fixed funding adapters route actual inventory only to their designated compartment and do not enlarge spend authority. The intended routing sends the 3% POL fee bucket to Core; surge receipts, inventory-bond proceeds and the arbitrage reserve share fund WarChest. Other non-Turf LP fee recipients can also use that reserve adapter. Developer, RWA and community destinations are explicit deployment inputs. Canonical hook fees do not impose a universal tax on independent pools.

**Inventory bonds.** Sale inventory is prefunded OMR; no mint authority. Immutable discount ≤10%, vesting 1–365 days, per-purchase/epoch/lifetime caps in both ETH and OMR, absolute rate cap and market depth/deviation checks apply. For ETH input E, reference rate R in OMR per ETH and discount d, payout is approximately E × R / (1 − d), with both integer divisions rounded down. A 10% discount means paying 90% of the reference price, so the inventory quantity multiplier is 1/0.9. Purchase binds expected epoch, minimum output, buyer, nonce and deadline ≤5 minutes, and reserves the complete future payout immediately. Notes are nontransferable. Claims remain available during pause/oracle outage; governance can recover only unpromised inventory. Proceeds reach a fixed recipient, and later selling the OMR still incurs applicable market fees.

**LP commitments.** These lock a genuine canonical PositionManager NFT, not just an OMR balance. Empty, foreign, subscribed or already committed positions are rejected. Campaign rewards are prefunded ETH with fixed terms, duration ≤365 days and lock range from at least one hour to at most 365 days. The position must cover the entire reference band and satisfy volatility conditions.

Useful depth is the minimum of its ETH-side depth and OMR-side depth converted to ETH. First observation establishes an anchor; subsequent valid unique observations accrue:

`eligible seconds = max(0, min(currentObservedAt, maturesAt) − previousObservedAt)`

`depth-seconds = min(previous useful depth, current useful depth) × eligible seconds`

`reward wei = depth-seconds × rewardWeiPerEthDay / (1e18 × 86,400)`

Reward is clipped by position limits and available campaign ETH. Gaps, invalid observations and pause-generation changes break accrual. Two endpoint samples do not prove continuous usefulness. Checkpoint order can matter when the budget is scarce; this is not a guaranteed APY. At maturity the original depositor can recover the NFT despite oracle/pause/budget problems; credited rewards remain separately claimable. Underlying LP fees remain attached to the position. Governance cannot recover committed NFTs or credited rewards, but may recover unearned budget after campaign expiry plus grace under its rules.

**Turf and siege fees.** A season has at most 64 fixed slabs and lasts at most 365 days. Up to four Families form a syndicate with positive shares totaling 10,000 basis points. Ownership gives future **funded LP fee credits**, not LP principal. Credits can be ETH or OMR. The bridge checkpoints old entitlements before ownership, siege or treasury changes so prior beneficiaries keep their earned amounts.

Typed game settlements require the fixed adjudicator, correct revision, fresh epoch and lane-specific replay identity. This authenticates a server outcome; it does not independently replay combat on-chain. Siege lasts one hour to seven days within the season, freezing attacker/defender treasury addresses and escrowing actual fees. An attacker victory receives its configured share of escrow and future ownership; the defender receives remainder. Expiry defaults to defender. Corridor/loyalty/fortification are bounded game state, not arbitrary yield multipliers. Seasonal exit is permissionless; earned fee claims survive while LP principal remains protocol-controlled.

**Arbitrage.** A solver supplies all ETH collateral and performs atomic ETH→OMR→ETH trades between canonical and an unhooked alternate pool in the same PoolManager. Plan commitments bind chain, contract, solver and exact plan; reveal is after the commitment block and within 64 blocks, with transaction deadline ≤5 minutes. Alternate LP fee is capped at 1%.

The whole first input and acquired OMR must be consumed, and realized profit must meet or exceed a positive declared minimum after trading/hook costs. An immutable reserve share is at most 50% **of profit**; the solver gets collateral plus remaining profit by pull claim. This grants no treasury trading bankroll, arbitrary-call execution or private exclusive arbitrage right. The contract's profit floor does not itself deduct solver gas; failed attempts can still cost gas.

Sources: [Market design](../../omerta-contracts/docs/market/DESIGN.md), [Market runbook](../../omerta-contracts/docs/market/RUNBOOK.md), [Hook](../../omerta-contracts/src/market-v2/OmertaHookV2.sol), [market state](../../omerta-contracts/src/market-v2/OmertaMarketStateV2.sol), [stability controller](../../omerta-contracts/src/market-v2/OmertaStabilityControllerV2.sol), [reserve funding](../../omerta-contracts/src/market-v2/OmertaReserveFundingV2.sol), [inventory bonds](../../omerta-contracts/src/market-v2/OmertaInventoryBondV2.sol), [commitments](../../omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol), [Turf](../../omerta-contracts/src/market-v2/OmertaTurfV2.sol), [Turf fee bridge](../../omerta-contracts/src/market-v2/OmertaTurfFeeBridgeV2.sol), [game settlement](../../omerta-contracts/src/market-v2/OmertaGameSettlementV2.sol), [arbitrage](../../omerta-contracts/src/market-v2/OmertaArbitrageV2.sol).

**2. Scope, configuration and activation evidence**

This is an economic and functional explanation of the current source, not a new security audit or a live valuation. The market’s public design is documented in [DESIGN.md](../../omerta-contracts/docs/market/DESIGN.md), with operational checks in the [runbook](../../omerta-contracts/docs/market/RUNBOOK.md). Exact Solidity names and paths are retained for source traceability.

Contract existence, deployment, integration, funding and activation are separate facts. Code bounds such as a 10% maximum bond discount or a 365-day maximum campaign are not selected commercial terms. A funded promise requires actual inventory and enforceable claim accounting. Current source must be matched to deployed bytecode and configuration before attributing a live balance, price, reward rate or operational status to it.

This guide establishes no current market capitalization, realized yield, executable exit price or mainnet activation state. Gameplay tuning can change through its defined configuration paths; current [rules](../../src/rules.tail.js), [generated definitions](../../src/rules.generated.js) and [game guide](../../AGENTS.md) remain the detailed references.

**3. The value domains and the accounting boundary**

| Domain | Authority and economic meaning |
|---|---|
| Game cash | Server ledger. Used for most ordinary RPG transactions. It is not dollars in a bank and has no general OMR cash-out conversion. |
| Game OMR | Server ledger, generally account-persistent rather than character-only. Liquid, staked, unbonding, escrow, Family reserve and prize balances have different rules. |
| ERC-20 OMR | Actual chain tokens with 18 decimals. On-chain issuance and transfers are distinct from internal ledger credits/debits. |
| ETH | Network gas, entry fees, primary token purchases, liquidity and selected revenue streams. |
| DNR / Denari | Optional Bank debt token. Separate from game cash and OMR. |
| Stock tokens | External issuer's ERC-20 products, if acquired and lawfully delivered through a separately activated system. |
| NFTs | Gear/vehicle class tokens, street deeds and dynasty portraits have different ownership and utility. |
| Respect / prestige / standing / mastery | Noncurrency progression and reputation. They do not give a universal financial claim. |

PostgreSQL owns gameplay truth. Transactions, locks and typed ledger reasons reconcile value movements. Energy, income and other clocks use elapsed-time accrual. RNG is server-generated and logged; it is not automatically publicly verifiable on-chain randomness. Chain watchers reconcile confirmed payments, claims and transfers into backend state. EIP-712 signatures constrain authorized messages but do not prove that the server fairly awarded the underlying game benefit.

Internal accounting uses six-decimal OMR amounts in many game paths; contracts use 18 decimals. A ledger reason called `mint` or `burn` does not necessarily mean an ERC-20 `_mint` or `_burn` occurred. In particular, many game sinks return inventory to the Desk. Withdrawal is an internal outflow paired with delivery of existing chain tokens.

There is no general game-cash-to-OMR swap or laundering route. The current one-way Exchange defaults to **500 game cash per OMR**, minimum **6 OMR**, rolling per-account limit **1,500 OMR/24 hours**, funded from eligible game cash sinks. Empty tills refuse rather than fabricate cash. A 5% OMR Family-funding share accompanies the window under current rules; the remaining sink treatment feeds the Desk. This is neither a USD peg nor an external market price.

The finite career ladder currently contains **nine once-per-account OMR mission awards totaling 1,320 OMR**. Completing all daily jobs can pay **3 OMR if the event fund has enough**. These two mechanisms differ: the career award is an enumerated internal credit; the daily award moves already funded game OMR. Player payments, looting and funded prizes are other sources. None of these gameplay functions grants the ERC-20 mint role, and an internal reward is not automatically backed for immediate withdrawal.

The game has no general cash-to-OMR conversion or personal in-game staking yield. Finite mission credits and funded awards supply the specific reward paths described above.

Sources: [data/economy architecture](../../knowledge/data-economy.md), [Exchange](../../src/exchange.js), [growth and reward execution](../../src/growth.js), [mission definitions](../../src/rules.generated.js), [current rule constants](../../src/rules.tail.js).

**4. The game loop and all major system families**

The core loop is jobs and risks → cash, materials and respect → abilities and productive assets → richer cooperative or competitive opportunities → defense against rivals, law, upkeep and death → selected persistent legacy.

Characters have health, energy, nerve and heat; trained muscle, cunning and speed; equipment, vehicles, skills and specialized progression. Level is `floor(sqrt(respect / 10)) + 1`. Level L requires `10 × (L−1)²` respect. Base energy regenerates 12/minute and nerve 6/minute before relevant modifiers; Runner rank adds energy regeneration. Level-up resource refills are limited to ten per rolling day. Gym training consumes ten energy with a shared three-minute cooldown.

Ranks run from Street Thug at level 1 through Hustler 10, Runner 22, Enforcer 35, Associate 50, Soldier 65, Capo 80, Underboss 95, Mob Boss 110 and Don of the City 125. Rank affects game capabilities; it is not a protocol governance token weight.

Three four-tier skill branches—Enforcer, Operator and Wheelman—add prerequisites, passive bonuses and active capstones, with one point per four levels. Ten trade masteries advance independently to level 50. Eight regimen disciplines cap at 25 and affect capacities, costs or contest performance. These systems coexist; a high character level is not identical to high trade mastery.

| System family | How it works and why it matters |
|---|---|
| Crimes and missions | Jobs consume nerve and depend on build and server RNG. Case It, Standard and Go Loud vary success, rewards, heat and jail severity. Missions, dailies, onboarding and career coaching provide objectives. Mission claiming has a four-hour cadence. |
| Cars, guns, armor and workshop | Steal, acquire, tune, repair, race or fence vehicles; melt eligible vehicles into ammunition or salvage materials. Equipment affects survival/combat. Crafting and consumables create additional resource uses. |
| District commerce | Docks, Neon Mile, Old Foundry, Brick Yards, Canal Row and Cathedral Hill have distinct opportunities/perks. Travel, capacity, timing and fees constrain arbitrage. Executable goods pricing uses four-hour blocks. |
| Kitchen | Inputs become timed production batches. Lab/module choice, quality, cuts, sales style, demand, hired dealers and wages interact with heat and Bureau raids. |
| Businesses and rackets | Purchase and upgrade income-producing fronts, collect capped accrued income, manage upkeep and scrutiny, employ specialists, and face raids, shakedowns or takeover. Cash productivity is not automatic OMR productivity. |
| Heists and operations | Roles, preparation, execution, shared outcomes, hot loot and fencing create cooperation; informants and notoriety create risk. Graph operations separately require declared roles, contributions and private evidence. |
| Convoys and port | Move owned cargo through actual transit windows. Guards, insurance, tolls, interceptions, piracy, boats and route capacity affect returns. Cargo must originate from owned supply. |
| Player markets | Escrowed goods exchanges, orders, car auctions with reserves/anti-snipe rules and a separate OMR Auction House/consignment system. A listing is not guaranteed liquidity. |
| Cash credit | Funded loans, collateral, directed offers, repayment, default, transferable loan paper, collection and wanted debtors. The Loan House is separate from on-chain Denari lending. |
| Races and fighting | Car races, pink slips, nitrous, Grand Prix; boxers, training, managers, bouts, exhibitions and titles; ELO duels and divisions; stable breeding, training and racing. |
| Gambling Den | Game-cash craps, Numbers, PvP dice, blackjack, poker, tournaments, fight/track betting and related contests. The Den does not accept or pay OMR. OMR access gates elsewhere do not change the wager currency. |
| Law and prison | Heat and longer investigations; bribes, lawyers/retainers, indictment, forfeiture, pleas, juries, trials, informants and witness protection. Prison includes work, commissary, protection, shanks, factions and solo/cooperative escapes. |
| Intelligence | Wire services, subscriptions, sweeps, trace/dossiers, disinformation, blackmail, informants, secrets, contacts and favors. Access to information follows permissions rather than granting every player omniscience. |
| Social power | Small Crews, larger Families, tribute, treasuries, contracts, diplomacy, wars, territorial operations, defenses, strongholds, sieges and Commission decrees. |
| Legacy and status | Estates, streets/deeds, speakeasies, decor, titles, collections, trophies, landmarks, megaprojects, passes, vanity, dynastic marriages, bloodlines and named soldiers with permadeath. |
| Living world | Day/night and events, economic weather, NPC residents/cartels, occupations, frontier expansion, uprisings and cooperative threats. NPCs provide counterparties; their activity must not be counted as human adoption. |
| Narrative and material graph | Versioned cases, story bundles, personal/group mysteries, salvage, materials, tools and cooperation. Activation is explicit; existence of a content bundle does not prove it is active in production. |
| Agent access | JSON API and MCP, executable action suggestions, bounded autonomous turns and a separately permissioned adviser/confirmation layer. Agent capability does not make the backend decentralized. |

The material/narrative system is deliberately restrained. The current Phase 1 graph introduces no OMR authority; its explicit currency movement is a 300-game-cash hardened-steel crafting sink. Unique custody and escrow have their own histories. Cases include district, Path, Don, group and seasonal narratives; current narrative rewards are mementos/story flags rather than OMR or permanent power. Bellini Restoration adds finite daily material sources, timed work, tools/durability and repair. Its material barter is narrow: allowlisted compatible materials, whole lots, five open offers and 24-hour expiration, rather than a new unrestricted currency exchange.

Sources: [gameplay guide](../../AGENTS.md), [feature inventory](../../SPEC.md), [executable rules](../../src/rules.tail.js), [generated definitions](../../src/rules.generated.js), [economy implementation](../../src/economy.js). Current executable rules determine behavior where descriptive material is incomplete.

**5. Six Paths, cooperation, politics and seasons**

A first Path costs **10,000 game cash at level 5**. A change costs **150 OMR**, with a **seven-day cooldown**. Home mastery gains are 1.5×; rival mastery gains 0.6×; other mastery gains are neutral.

| Path | Main advantage | Explicit drawback | Home / rival trades |
|---|---|---|---|
| Gun | +10% street attack; +15% hit effectiveness | −5% goods sale proceeds | Wet Work, Protection / Commerce, Cook |
| Ledger | +10% front/racket income; +5% goods sales | −5% street attack | Commerce, Big Scores / Wet Work, Protection |
| Kitchen | +0.15 cook quality; dealing heat ×0.75 | Jail duration ×1.10 | Cook, Larceny / Gambler, Fisticuffs |
| Wheel | Convoy time ×0.90 | Cook time ×1.15 | Wheels, Seamanship / Cook, Gambler |
| Shadow | Search time ×0.85 | Duel/bout contest factor ×0.95 | Larceny, Wet Work / Fisticuffs, Commerce |
| Ring | Duel/bout factor ×1.05 | Healing cost ×1.15 | Fisticuffs, Gambler / Seamanship, Big Scores |

A **Crew** is account-scoped, up to four members from level 3, persists across character death and supports coordination/protection. It has no common territorial treasury. Weekly completed objectives can pay 5,000 game cash per eligible contributor.

A **Family** is up to 20 members, founded at level 5 for 25,000 cash. It has roles, treasury, tribute and territorial/political functions; the character's seat is vacated at death. Ordinary war declaration starts at the greater of 10,000 cash and 2% of the target treasury before modifiers, with a 30-minute base duration and 20% base spoils.

The **Commission** seats the top five eligible Families by `season tribute + 10,000 × season war wins`. Voting weights are 5:4:3:2:1. Weekly public proposals, bounded decrees, deposits, a head-seat veto and override process affect the game. This is not a blanket OMR-holder DAO controlling the Safe or every Solidity parameter.

**Seasons last 28 days:** Opening 1–7, Long Game 8–21, Reckoning 22–28. Reckoning lowers the turf challenge floor to 75% and contest/watch durations to 50%. Rollover resets respect/level and selected seasonal metrics, including kills/ELO and Family seasonal standing, and converts `floor(level/2)` into persistent prestige. It does not execute the complete death wipe or erase every inventory item, stat and balance.

Sources: [Path execution](../../src/growth.js), [Crew](../../src/crew.js), [Commission](../../src/commission.js), [season worker](../../src/worker.js), [rule definitions](../../src/rules.tail.js).

**6. Death, custody, holding incentives and NFTs**

A lethal street attack requires a completed search, equipped gun, compatible district and eligibility, at least 40 energy and 50 rounds, and compliance with protection/cooldown rules. Safehouses, hospital, prison, witness protection, Crew/Family restrictions and bodyguards matter. Bodyguards can intercept lethality before revival insurance. They are bounded game protections rather than a promise against loss.

For an eligible ordinary player kill, the base economic consequences include:

- 25% pocket cash and cash still clearing into the bank, subject to modifiers and a 50% cash-loot ceiling.
- 50% liquid plus unbonding in-game OMR.
- 20% staked in-game OMR, including time-locked stake.
- A 15% chance to take an eligible gear item, plus separate bounded loot/seizure systems.
- Ordinary cash/OMR/gear looting requires victim level 10+, although lower-level characters can still die.
- After loot, death duty takes 25% of remaining liquid/unbonding OMR; remaining staked OMR is excluded from duty.

Example: 1,000 liquid plus 1,000 staked OMR → killer takes 500+200 → duty takes 125 → account retains **375 liquid and 800 staked**. External wallet OMR is outside this game-balance calculation.

Character death closes the life, vacates the Family seat and wipes character cash/bank, ordinary vehicles, guns, assets/rackets/businesses, skills and many inventories/activities after applicable settlement. Banking cash protects it from ordinary pocket theft, not the death wipe. The account retains applicable remaining OMR/stake, wallet/paid status, estates/deeds, collections/legends and Crew continuity. Prestige increases by `floor(level/2)`; the heir's cash starts at `500 + 100 × accumulated prestige`. Some NPC, honor and mastery memory carries forward; baseline mastery inheritance is 25%, with trait exceptions. Historical graph escrow does not automatically become heir property.

Safehouse base shelter is four hours with a twelve-hour rolling daily cap. Normal unstaking creates a six-hour unbonding window. The latter makes capital more lootable before it becomes liquid.

The current in-game holding ladder is:

| Effective staked OMR | Rung | Cumulative benefit |
|---|---|---|
| 60 | Earner | +1 trunk, +5 energy, +1 nerve, +1 garage |
| 180 | Operator | +2 trunk, +10 energy, +2 nerve, +2 garage |
| 450 | Capo | +3 trunk, +15 energy, +3 nerve, +3 garage, +2.5% fencing factor |
| 900 | Kingmaker | +4 trunk, +20 energy, +4 nerve, +4 garage, +5% fencing factor |

Made dues are **120 OMR/30 days**, persist at account level and add one rung capped at the top. The high-stakes room separately needs 300 staked OMR plus level 30 or tier-2 Madame standing. Optional 7/30/90-day locks multiply the stake's ladder weight by 1.25/1.5/2.0 only. They block unstaking until maturity, not combat looting, and do not multiply token principal. An active lock can only be upgraded under the required duration/multiplier conditions.

NFT distinctions:

| Asset | Actual right and limitations |
|---|---|
| GearVault ERC-1155 | Class-based gear, car and boat tokens. Exported assets are wallet-owned and inert in gameplay; no simultaneous racing, upgrading, collateral use or duplicate game ownership. Cap applies to current on-chain minted-minus-redeemed supply, not immutable lifetime rarity. |
| StreetDeed ERC-721 | A uniquely named street collectible, stable ID from name, history and a re-entry rail. Not an automatic productive turf/rent claim or paid-account entitlement. It can be linked to a token-bound account for stock custody. |
| DynastyNFT ERC-721 | Bloodline/portrait/history collectible with uncapped sequential supply. Selling it does not sell the user's login, paid game entitlement or automatic financial rights. It is distinct from the stock-holding deed. |

Gear/vehicle reimport burns the exported token and restores game ownership through confirmed event processing. Gear redemptions require one unit; vehicle classes can batch. Reimport releases live supply cap headroom. Safe-set caps and mutable metadata mean scarcity and presentation are partly governance policy.

Street deeds are transfer-locked until the holder unlocks, and relock on receipt. Stock contents of a token-bound account can change before a deed sale; a displayed balance is not a promise that the seller leaves it there. Dynasty artwork/history follows backend semantics, including freezing sold portrait semantics after the first transfer. The standard 5% royalty is marketplace signaling, not guaranteed universal collection; the owner can change royalty configuration.

Sources: [combat](../../src/social/combat.js), [death/estate execution](../../src/social/estate.js), [NFT game bridge](../../src/nft.js), [GearVault](../../omerta-contracts/src/GearVault.sol), [StreetDeed](../../omerta-contracts/src/StreetDeed.sol), [DynastyNFT](../../omerta-contracts/src/DynastyNFT.sol).

**7. OMR supply and governance**

OMR is ERC-20 plus ERC-2612 Permit with two-step ownership. Its constructor mints **100 million OMR to the Safe**. There is no immutable maximum supply, public holder burn feature, token-level dividend, rebase, treasury redemption right or universal token-weighted governance.

The owner chooses one minter. Setting that address to zero disables minting until the owner appoints a minter again. The owner can select another contract or an externally owned address. The market’s inventory bond does not need or hold mint authority: it reserves existing OMR on purchase. This limits that sale mechanism without removing the token owner’s separate issuance power.

The token also has an owner-configured transfer sell tax for registered AMM destinations, exemptions and recipients, capped at 10% for that layer. Canonical v4 operation is intended to leave the token transfer tax off and charge inside OmertaHookV2. Enabling both can stack charges; two individual ceilings are not a combined ceiling. Funding a registered destination can also be taxable without the relevant exemption.

No team/investor allocation schedule or founder vesting follows from the founding mint alone. Circulating supply, public float, concentrations, treasury inventory, grants and enforceable locks require inspection of actual distributions and custody commitments. Inventory bonds reserve promised OMR immediately but release it to buyers over vesting; this can increase sellable float without increasing total supply.

Sources: [OMR](../../omerta-contracts/src/OMR.sol), [inventory bonds](../../omerta-contracts/src/market-v2/OmertaInventoryBondV2.sol), [canonical Hook](../../omerta-contracts/src/market-v2/OmertaHookV2.sol).

**8. Game receipts and inventory recycling**

Paid character-creation receipts route 100% to developer/operations under OmertaFees. A successful character-creation business therefore does not automatically translate into OMR market purchases. Respawn, reroll and Store receipts have their own source-specific routing. They must be measured separately from canonical market fees, funded prize distributions and internal ledger transfers.

Game OMR spent on many features returns to Desk inventory. The funded-till Window allocates 5% of its spent OMR to Family funding and the remainder to the Desk. This backend inventory account and the stability controller’s **Desk compartment** are different pieces of custody/accounting: the latter deploys OMR into bounded upside liquidity ranges. No relationship should be assumed merely from their shared label.

The market controller provides the current market rules for support and inventory deployment. Core supplies ordinary two-sided liquidity; Lower Cushion and Garrison can acquire OMR into weakness; Upper Cushion and Desk can sell OMR into strength. Inventory bonds reserve and vest already held OMR for ETH. These funded flows can improve market depth and distribute inventory, while also creating costs and future sellers.

“Return velocity” describes how often OMR is spent and becomes available as inventory. More turnover can produce revenue but is not permanent token destruction. Gross receipts, buybacks, reserves, rewards and subsequent reward sales must be reconciled separately to measure persistent market absorption.

Sources: [fee contract](../../omerta-contracts/src/OmertaFees.sol), [game Window](../../src/exchange.js), [market funding design](../../omerta-contracts/docs/market/DESIGN.md), [stability controller](../../omerta-contracts/src/market-v2/OmertaStabilityControllerV2.sol).

**9. Withdrawals, actual exit costs and the meaning of backing**

The game withdrawal rail requires a qualifying paid/minted account, valid wallet destination, sufficient liquid balance and active configured chain services. The backend debits the gross game balance; the signed voucher specifies the net delivered amount.

At current default rates, for a single uniformly aged lot with age t hours:

`early surcharge rate = 0.50 × max(0, 1 − t/48)`

`net OMR = gross OMR × (1 − 0.02 − early surcharge rate)`

The flat toll and early surcharge are **added**, not multiplied in sequence. The ledger replays credits and debits newest-first, so a recent award cannot simply be labeled part of an old balance to avoid the charge. Mixed-age balances require lot-by-lot computation. A staking round trip is not an automatic age reset or exemption. Ordinary in-game spending is not this withdrawal event.

| Age of a 1,000-OMR game lot | Withdrawal toll + surcharge | OMR delivered | Value remaining after illustrative 9% exact-input sale tax |
|---|---:|---:|---:|
| 0 hours | 2% + 50% | 480 | 436.8 OMR-equivalent |
| 24 hours | 2% + 25% | 730 | 664.3 OMR-equivalent |
| 48+ hours | 2% + 0% | 980 | 891.8 OMR-equivalent |

The last column assumes unchanged unit price and excludes LP fees, spread, price impact, slippage and gas. It is value arithmetic, not the literal asset denomination of an ETH sale. A separate wallet buyer who never enters game custody does not pay this game withdrawal toll.

If backing is insufficient, the request queues. The lifetime signing gate counts prior signed/claimed commitments against cumulative reserve funding; automation additionally checks physical custody for outstanding unclaimed signatures. It must not issue unlimited unsecured vouchers merely because the ledger shows a balance. Canceling an unsigned queued withdrawal refunds the net amount only: the toll already paid is nonrefundable. Queueing is a real liquidity constraint, not equivalent to immediate cash-out.

`VoucherClaim` validates server EIP-712 vouchers, one-use nonces, recipient, deadline, chain/contract domain, pause and daily limits. Its maximum voucher life is 30 days. OMR claims transfer pre-held tokens; gear vouchers invoke GearVault. Zero daily cap means unlimited for that field; zero gear cap instead prevents minting that class. The Safe can rotate signer, pause and sweep unspent inventory, so signed-claim backing still depends on authorized treasury behavior.

Three very different uses of “backing” must be distinguished:

1. **Withdrawal backing:** enough existing OMR to deliver a permitted game claim. It does not promise a dollar value.
2. **Protocol liquidity/treasury:** assets used by the project. Holding OMR does not automatically own a pro-rata redeemable portion.
3. **Treasury ETH allocation ledger:** current `treasury.js` can debit game OMR and earmark ETH internally, but explicitly implements **no ETH payout, withdrawal or chain delivery** for that allocation. Default minimum is 150 OMR, rolling per-account cap 12,000 OMR/day and a 5% price premium. This is not an implemented burn-to-redeem floor. The internal sink also recycles to the Desk rather than destroying ERC-20 supply.

Family yields are funded transfers to Family reserves, allocated among leading eligible Families with 5:4:3:2:1 weights. They are not automatically withdrawable personal dividends. Community buyback inventory and personal withdrawal inventory therefore have different custody/accounting destinations. Do not combine all “reward pools” into a single supposedly fungible reserve.

Sources: [withdrawal execution](../../src/chain.js), [fresh-first tax arithmetic](../../src/tax.js), [VoucherClaim](../../omerta-contracts/src/VoucherClaim.sol), [treasury allocation limitations](../../src/treasury.js), [community custody rationale](../../src/community.js).

**10. Funded OMR staking and market-liquidity custody**

OMRStaking is a separate prefunded token-staking contract. It is distinct from both lootable in-game stake and the market’s LP commitment vault. It cannot mint OMR. Reward accrual uses a configured simple annualized rate with a source ceiling of 50%:

`reward = staked OMR × annual rate × elapsed seconds / (365 days)`

The field is named APY, but there is no automatic compounding. Rate changes checkpoint past accrual through an index. Anyone can fund rewards; claims can revert when the reward pool is short. Principal withdrawal has no staking maturity lock and does not depend on reward availability. A configured rate is not evidence of funded or sustainable income. No live rate or funding is asserted here.

The market’s LP commitment vault instead holds qualifying PositionManager NFTs and pays prefunded ETH for measured useful liquidity under fixed campaign terms. The stability controller owns its protocol-funded positions and enforces compartment, action, episode and lifetime budgets. Turf beneficiaries own rights to credited fees, while protocol governance retains its defined principal-recovery powers. These are separate assets and return profiles.

Oracle and keeper availability matter to new market actions. Finalized observations must meet freshness, depth and deviation conditions; stale or insufficient data can prevent new commitments or deployment. Recovery of mature LP commitments and claims of already credited rewards are designed to remain available through the specified oracle/pause failures. A nominally healthy position can still lose economic value with token prices.

Sources: [OMR staking](../../omerta-contracts/src/OMRStaking.sol), [LP commitment vault](../../omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol), [market observations](../../omerta-contracts/src/market-v2/OmertaMarketStateV2.sol), [stability controller](../../omerta-contracts/src/market-v2/OmertaStabilityControllerV2.sol).

**11. THE BANK: optional collateralized debt and realized-yield funding**

The Bank is a separate deployment/activation scope, not active merely because the core token contracts exist. Its main components are **Denari, Alchemist, CollateralEscrow, Transmuter and FlashGuard**, with optional BankBufferVault support.

The intended loop is underlying collateral, such as a specified USDC-like asset → deposit into a selected ERC-4626 yield vault → issue DNR debt against that collateral → use realized excess yield to reduce debt and supply redemption reserves. The exact asset, vault, fees, legal/product availability and production configuration require separate validation.

**Denari** is an 18-decimal debt token with initially zero supply. The intended minter is Alchemist and burner Transmuter. Governance can replace these roles. A replacement minter can issue arbitrary supply, and the authorized burner can burn a holder's tokens without ordinary allowance. Collateralization is enforced by the configured composition, not an intrinsic unchangeable property of the ERC-20.

**Alchemist** gives each depositor a dedicated CollateralEscrow holding ERC-4626 shares. Collateral and debt are denominated in the same underlying unit. Default loan-to-value is 50%, hard maximum 90%. Debt has no built-in interest accrual, and the design uses no conventional price-triggered liquidation auction. Borrowing and withdrawals remain constrained by redeemable collateral value and LTV.

The default performance fee is 20% of the gross yield withdrawn for debt service: the remaining 80% repays debt. The fee is capped at 30%; an unset fee recipient disables it. LTV plus harvest fee cannot exceed 100%, so with a 20% fee the LTV ceiling is effectively 80%. That constraint cannot be ignored when quoting the separate 90% absolute LTV maximum.

Deposits check exact received assets and minimum shares. Borrowing/withdrawal cannot occur in the deposit block. Contract callers need an allowlist on relevant paths; EOAs are permitted. These are scoped guards, not a universal claim to block every flash-loan strategy.

Permissionless harvest withdraws realized yield above tracked principal, charges the eligible fee, reduces debt and sends underlying to Transmuter. Repayment also uses underlying assets, not a DNR burn; that payment supports redemption of outstanding DNR elsewhere. Overpayments do not create negative debt credits.

Illustration only: 1,000 USDC collateral, 500 DNR debt, constant 8% realized annual yield and 20% performance fee would leave roughly **64 USDC/year** to reduce debt. A simple static estimate is **500/64 = 7.8125 years**. That is not a forecast: vault yield, collateral value, fees, withdrawals and policy can change. “Self-repaying” means external realized yield services debt; it does not mean free money or guaranteed repayment by a date.

**Transmuter** accepts and burns DNR in exchange for underlying at a 1:1 accounting-unit conversion, rounding to underlying precision. One underlying unit is not guaranteed to retain one US dollar of value if the asset depegs. Redemption needs sufficient liquid reserves and flow capacity. Default reserve target is 20% of DNR supply, with a hard governance minimum of 5%. Thin reserves stop new debt under health checks. A redemption exceeding actual liquid reserves still reverts; there is no unlimited instant redemption promise or implemented queue in this contract. An initial reserve seed is needed before meaningful borrowing.

Underlying vault losses can reduce debt headroom or block withdrawals/borrowing despite the absence of liquidation auctions. Depositor collateral, borrower debt and liquid reserves are different balance-sheet components. A ratio labeled healthy does not guarantee all holders can redeem simultaneously.

**FlashGuard** tracks bounded mint/redemption flows; zero limits mean unlimited where defined. Its daily windows roll after 24 elapsed hours rather than necessarily matching UTC days. **BankBufferVault** can top up the fixed Transmuter from prefunded assets within deficit/action/day bounds. It cannot manufacture reserves, and governance can recover its unused funding when appropriately paused.

The Bank's economic link to OMR is realized profit-funded buybacks and gameplay distribution. The current City-leg code allocates its bought OMR to eligible active players, not automatically to passive token holders, NFT owners, stakers or the team. Eligibility needs at least 25 activity score across three distinct qualifying trades/categories per day. Qualifying actions must have game throttles; raw unlimited cash trading and unthrottled casino loops are excluded. NPCs are excluded; agent players can qualify. Allocation is pro rata and linear, not an advertised fixed yield.

The harvest fee's configured split is 37.2% treasury / 62.8% community **of the fee**. Treasury-funded City and community/Family destinations have separate books; do not treat the whole harvest, the whole fee or all reserves as the same personal OMR payout pool. Reward recipients may later sell bought OMR, so buyback volume is not synonymous with permanent market absorption.

Sources: [Denari](../../omerta-contracts/src/Denari.sol), [Alchemist](../../omerta-contracts/src/Alchemist.sol), [CollateralEscrow](../../omerta-contracts/src/CollateralEscrow.sol), [Transmuter](../../omerta-contracts/src/Transmuter.sol), [FlashGuard](../../omerta-contracts/src/FlashGuard.sol), [BankBufferVault](../../omerta-contracts/src/BankBufferVault.sol), [City distribution](../../src/bank.js).

**12. Stock tokens, deed accounts and acquisition readiness**

There are several different systems with financial vocabulary:

- The **treasury ETH allocation** is the non-delivering internal claim described above.
- The **Stock Machine** aims to buy actual approved external stock tokens and deliver eligible allocations.
- The **Bank** issues DNR against an external collateral strategy; it does not make OMR a share of a stock fund.

The proposed Stock Machine combines curated assets, Family ballots, bounded acquisition, frozen active-play allocations and delivery to StreetDeed token-bound accounts. Mere OMR possession or ownership of a Dynasty portrait does not produce a pro-rata stock dividend.

`StockTokenRegistryV2` supplies canonical asset identity and lifecycle controls for the stock-token integration. The Safe decides eligible catalog entries; a publisher commits server-authoritative ballot results. A token address matching a symbol is not sufficient proof of asset identity or legal availability.

`RwaStockBuyer` is a bounded buyer: a closed ballot selects an approved token, the Safe chooses a venue adapter, independent quote oracle and destination vault, and a keeper triggers spending. It measures actual canonical stock units received and requires at least the stricter of the keeper's floor and the fresh independent oracle floor. It spends prefunded ETH within limits and enforces one-shot ballot use. An adapter/oracle and operational funding are essential dependencies; a generic contract does not make all stock purchases executable automatically.

`StockVault` distributes pre-bought ERC-20 inventory. It does not mint stock tokens. The backend computes who earned how many units, normally targeting a deed's ERC-6551 account. With an independent allocation signer configured, typed attestations bind epoch/account, asset, recipient, units, delivery ID and deadline, and keeper-only delivery paths close. With zero allocation signer, authorized keeper delivery remains available. The Safe controls keepers/signers/caps, pause and sweep of undelivered units. Zero caps mean unlimited. The chain checks messages and assets, not the fairness of gameplay scoring or recipient suitability.

Conservation constraints such as delivered ≤ allocated ≤ held are unit-accounting limits, not guarantees of purchase price, stock value, issuer solvency or legal eligibility. A deed's account owner may move its stock tokens before selling the deed, so NFT buyers must check actual contents and control semantics.

The acquisition constellation contains custody/authority, ingress, budget, topology and intent groundwork. AcquisitionConstellationFactory composes five child contracts: AcquisitionVaultCore, AcquisitionAuthority, PreVoteBudgetBook, AcquisitionIntentExecution and AcquisitionReconciliation. This is not a completed autonomous investment service: current `AcquisitionAuthority.unpause()` always fails its local-readiness check, and `AcquisitionIntentExecution` implements identity/topology rather than an actual purchase executor. Registry/finality and health scaffolding do not close that gap.

`RwaHealthOverlay` adds deployment/asset-version-bound Safe clearance and generation/expiry machinery. It is an authorization/health layer, not an issuer guarantee. `SettlementGasPool` supplies prefunded, capped reimbursement credits for successful authorized gameplay settlement; credits are pull-payment liabilities and sponsorship is not an investor deposit or a yield product. These supporting modules need their own activation scope.

Robinhood currently describes its Stock Tokens as **tokenized debt securities issued by Robinhood Assets (Jersey) Limited**, providing economic exposure to the referenced securities without legal/beneficial rights in those underlying issuers. Its documentation expressly prohibits US/US-person offers, sales and delivery and describes other jurisdictional restrictions. Therefore “the game pays everyone real company shares” is inaccurate in both rights and availability. Contracts that do not enforce recipient KYC themselves do not remove these restrictions. [Official Stock Token description and restrictions](https://docs.robinhood.com/chain/stock-tokens/).

Sources: [treasury and stock bookkeeping](../../src/treasury.js), [stock delivery](../../src/stockdeliver.js), [StockVault](../../omerta-contracts/src/StockVault.sol), [RwaStockBuyer](../../omerta-contracts/src/RwaStockBuyer.sol), [RegistryV2](../../omerta-contracts/src/StockTokenRegistryV2.sol), [AcquisitionAuthority](../../omerta-contracts/src/AcquisitionAuthority.sol), [AcquisitionIntentExecution](../../omerta-contracts/src/AcquisitionIntentExecution.sol), [SettlementGasPool](../../omerta-contracts/src/SettlementGasPool.sol).

**13. Agents, operational trust and holder rights**

Agents are first-class game participants with public account flags, 90-day keys and stricter cadence: approximately one action/three seconds versus a human one/second with burst five. Agent Turn issues executable action suggestions and Agent Act revalidates turn/action identities. The bounded Alpha runner permits 1–50 attempts, default one, and excludes autonomous PvP, borrowing, mint/wallet/withdrawal, replacement characters and human-only faucets. A separately authorized general API agent may use broader capabilities; these runner exclusions are not universal blockchain restrictions.

Scoped advisers and the gateway stage proposals and require the relevant player's official confirmation and current authorization to commit sensitive actions. Authored stories and world graph actions are not automatically injected into the autonomous expected-value queue. Agent activity can increase participation but creates balancing, Sybil, concentration and retention questions. Human users, agents and NPCs should be measured separately.

| Authority | What it controls | What a passive OMR holder should infer |
|---|---|---|
| Governance Safe | Minter appointment, game/auxiliary signers and configurable parameters, pauses and authorized recovery; canonical Hook rates and recipients are immutable | Material governance and custody trust remains; Safe control is distinct from token-holder voting |
| Game server/database | Combat RNG, rewards, balances, eligibility, death, membership and progression | Most gameplay is not trustless on-chain execution |
| Voucher/allocation signers | Authorized withdrawal/NFT/stock delivery messages | Signature validity proves authorization, not underlying fair gameplay |
| Keepers/indexers | Oracle updates, claims/revenue reconciliation, bounded buys | Downtime, funding exhaustion, reorgs or mismatched configuration can halt useful services |
| Commission/Families | Specified game politics and competitive rewards | Game authority is distinct from ownership of protocol treasury |
| External vaults/DEX/stock issuers/network | Yield, liquidity, token rights, transfer availability, chain settlement | Integrations add risks the OMR token cannot remove |

Source protections include replay defenses, domain binding, pause, reentrancy guards, exact-delivery checks, per-class or flow caps and committed-inventory restrictions. They are valuable design controls. Their existence and historical test counts are not a guarantee that every future configuration, contract composition, signer and game service is safe.

Sources: [agent guide](../../AGENTS.md), [core architecture](../../knowledge/architecture.md), [market runbook](../../omerta-contracts/docs/market/RUNBOOK.md).

**14. The speculative investment thesis, tested against the mechanics**

The plausible bullish thesis has five components. First, players enjoy the game enough to return and pay independent of token profits. Second, OMR utility makes some of that willingness to pay become recurring OMR acquisition or retained balances. Third, spending, losses, competition and subscriptions give reasons to reacquire tokens. Fourth, real receipts support bounded purchases, rewards and useful liquidity. Fifth, supply release and governance are disciplined enough that these demand sources exceed issuance and resale pressure.

The market implements this thesis through concrete mechanisms: compartmentalized liquidity can support executable trading, inventory bonds sell already held OMR, prefunded ETH campaigns reward qualifying LP commitments, Families contest actual Turf fees, and solver-funded arbitrage can replenish reserves from realized profit. These are concrete mechanisms with separate funding, eligibility and authority limits. Their effect on passive OMR value remains indirect and depends on activation, adoption, market conditions and the balance between buying and selling.

Participation changes the return profile. An LP commitment earns against useful liquidity and campaign funding; a Family's Turf position earns its allocated fees; a solver earns realized trading profit after its costs and reserve share. None is an automatic payment to all OMR holders. Bank and RWA integrations form additional, separately gated systems. Agent-native play could extend activity or distribution. Code existence is not evidence of profitable operation or a proven network effect.

The practical demand/supply question is whether buyers' willingness to acquire OMR at a given price can absorb tokens offered from new issuance, recycled inventory, reward balances and existing holders. These seller categories must be kept nonoverlapping when measuring them; subtracting seller flows from a number already defined as net purchases would count them twice.

This is an analysis framework, not an equation that determines price mechanically. Timing, order-book/AMM depth, liquidity withdrawal and expectations also matter. The same tokens can appear in gross buyback and later reward-sale statistics; reporting only the first leg exaggerates sustained absorption.

OMR has no automatic claim to all business profits. A more successful character-mint business can generate developer revenue without directly buying OMR because mint receipts are 100% developer. Other revenue routes buy OMR but distribute or resell it. Treasury growth, player count, game cash wealth and token price can therefore diverge.

**Worked valuation and friction examples**

| Example | Calculation | Interpretation |
|---|---|---|
| 9% hook fee, exact-input sale | `1 / 0.91 − 1 = 9.8901%` | Break-even appreciation when the fee is deducted from ETH output; no buy hook tax, LP fees, slippage or gas assumed |
| 10% hook fee, exact-input sale | `1 / 0.90 − 1 = 11.1111%` | Same assumptions, at the total hook ceiling |
| 9% or 10% hook fee, exact-output sale | `required OMR = base OMR input × (1 + fee)` | An OMR-input surcharge implies 9% or 10% break-even appreciation under the same simplified assumptions |
| Inventory bond at 10% discount, 9% exact-input sale fee, unchanged reference price | `0.91 / 0.90 ≈ 1.011111` | About 1.11% static margin before other costs; a 10% output fee reduces that margin to zero |
| Inventory bond at 10% discount, 9% exact-output input surcharge, unchanged reference price | `1 / (0.90 × 1.09) ≈ 1.019368` | About 1.94% static margin before other costs; a 10% input surcharge gives about 1.01%. Integer rounding, routing, LP fees, price impact and vesting price movement still apply |
| 10m additional OMR minted | `100m → 110m`; original fraction `100/110 ≈ 90.909%` | Existing aggregate ownership fraction falls 9.091%; price need not fall by that exact percentage |

ETH-denominated appreciation and USD appreciation also differ because ETH's price changes. A token's displayed unit price is not the liquidation value of a large holding. FDV based on 100 million is not a permanent maximum valuation measure when governance can authorize further minting.

**What would strengthen or weaken the case**

| Evidence to request | Why it matters |
|---|---|
| Verified live token/pool/bond/campaign identities and exact activation state | Prevents confusing a dormant contract, unrelated ticker or synthetic UI balance with a tradable asset |
| Actual Safe distributions, grants, sale allocations, locks and mint-role/cap history | Reveals concentration and future circulating supply |
| Human cohort retention, paying conversion, repeat purchases and churn | Tests durable willingness to pay instead of token-incentivized signups |
| Separate human, agent and NPC activity | Avoids manufactured adoption metrics |
| Revenue by external source, excluding comps/internal transfers | Establishes real funding rather than circular accounting |
| Buybacks minus resales/reward exits, measured over time | Tests actual persistent market absorption |
| Executable depth and sale price at realistic position sizes | Tests exit liquidity, not merely headline TVL or the last small trade |
| Funded reward pools, claim queues and reserve coverage | Tests whether offered rewards/exits can actually settle |
| Treasury/LP custody and emergency powers | Establishes who can recover market-support capital |
| Realized Bank yield and asset/vault exposures | Distinguishes actual revenue from configured annual rates |
| Market compartment balances, spent episode/lifetime budgets and recovery policy | Tests how much funded support remains and who may withdraw capital |
| LP campaign funding, committed useful liquidity and credited rewards | Tests real LP incentives instead of an assumed universal token yield |
| Turf fee receipts/beneficiaries and realized solver profit | Separates paid economic activity from unfunded projections |
| Stock-token eligibility, canonical assets, delivery history and restrictions | Tests whether the RWA story can serve the intended audience |
| Release evidence tied to exact deployed source, signers and backend | Limits reliance on obsolete audit/test statements |

The principal adverse scenarios are weak retention, subsidy-seeking users, speculative demand collapsing, reward/bond selling exceeding organic buying, recycled inventory pressuring price, governance over-issuance or adverse parameter changes, compromised keys/server, unfunded queues, keeper/oracle failures, inadequate DEX routing, poor liquidity, external vault/stock issuer losses and jurisdictional constraints. Permanent-loss gameplay can create engagement for some players and unacceptable friction for others.

No current fair value, price target, expected return or investor suitability conclusion follows from this source review. The defensible description is **a utility-token speculation on a complex game and its revenue-funded token economy, with concentrated governance and material execution risk**. Its appeal must be earned through adoption and net economic demand, not inferred from the number of contracts.

**15. Investor rights and limits at a glance**

| Topic | Current economic meaning |
|---|---|
| Supply | 100m founding mint; the owner retains minter appointment authority |
| Inventory bonds | Prefunded OMR reserved immediately and vested; no mint authority, ETH principal repayment or guaranteed spread |
| Trading fees | Canonical sells pay 9% base plus 0–1% surge, with LP fees additional; normal post-opening buys have zero hook tax |
| Spending | Many game sinks recycle inventory; they do not burn ERC-20 supply |
| Game rewards | Specific finite mission credits and funded awards; no general cash-to-OMR conversion |
| Token holding | No automatic share of business profit, company ownership, treasury redemption or Safe control |
| In-game stake | Holding benefits and optional locks; still subject to game loot rules |
| Token-staking contract | Configured annualized accrual paid from an existing OMR reward pool |
| LP commitment | Actual eligible position NFT locked for prefunded, bounded ETH rewards |
| Market support | Constrained use of actual compartment inventory, with defined governance recovery powers |
| Turf | Allocated actual LP fees, siege escrow and future fee entitlements; no ownership of protocol principal |
| Arbitrage | Solver supplies capital and receives realized profit after reserve allocation; gas is an additional cost |
| Game exit | 2% toll plus a declining fresh-balance surcharge; physical token delivery requires backing |
| Bank | Debt serviced by realized external yield, with strategy and reserve risks |
| Stock tokens | Separate issuer rights, eligibility, acquisition and delivery requirements; no universal OMR dividend |
| NFTs | Asset-specific rights; a portrait or deed does not convey the account login |
| Implementation status | Written contracts define the model; deployment, funding and activation require separate evidence |

Detailed gameplay tuning is maintained in the linked executable rules and modules. This guide explains the current market and its supporting game systems; exact source identifiers remain available for verification.
