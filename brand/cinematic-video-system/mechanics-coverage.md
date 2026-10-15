# Cinematic campaign: mechanisms, flywheels and claim coverage

Prepared 2026-09-24. Main source **32859cf7d198d2a003160b2bb1ef005991697d73**; checkout **e56cf576065c5f1bbb9bb55115f5961267f7d654**. This expands the previous 48-row matrix to **96 mechanic families**. The user has specified future fully-live release, three different films, and 60-75 seconds each. No production activation was verified here; the matrix is source evidence, not a deployment assertion. Existing campaign files remain unchanged.

## Creative coverage contract

Three films can cover every mechanic family by combining spoken causal stories with genuine screenshot inserts, short labels, and a companion coverage index. They cannot explain every rule or API endpoint in 3 x 75 seconds. Give each main chain time to register; use 360 rotations, snap zooms, speed ramps and freeze-frame punchlines at transitions, not over small text the viewer must read. Avoid borrowed MLG music, logos or game footage.

Primary source hierarchy: executable source/constants/contracts, then bounded implementation/release records, then older design prose. README contains superseded fees and PLEX descriptions. Source comments can also lag their own functions: payPlex still accepts respawn while the exact retired invariant is plex:mint. The current constants are materially different from some README prices.

## The three stories

### 1. BUILD AN EMPIRE (72s target)

Actions -> skills and assets -> materials/crafting/trade -> Crew capability -> Family control and business income -> upkeep, rivals and law -> reinvestment / consequence -> legacy.

Show garage, kitchen, skills, NPC relations, market, loans, races, boxing, casino, property, politics and megaprojects as labeled screenshot constellations around the main cause-and-effect story. Cash never auto-converts to OMR.

### 2. THE ECONOMY HAS TERRITORY (75s target)

Defined/funded OMR access -> useful spends -> Desk recycling and existing-inventory sales; separately funded cash redemption; canonical market activity -> explicit fee recipients/Core; designated Turf LP fees -> funded Family rights/siege -> prospective ownership. Bonds, LP commitments, NFT and RWA rails are bounded side loops.

Keep a four-way currency legend: GAME CASH / OMR / ETH / APPROVED RWA UNITS. Show the recycling loop and two distinct fee paths. Smaller named cards cover backing, prizes, Store/pass, staking/status, bonds, finite inventory, City distributions and RWA custody.

### 3. THE CITY REMEMBERS (72s target)

Permitted clue -> investigation -> independent evidence/knowledge -> collaborative preparation -> authorized contribution/approval/execution -> committed state -> authored Director response -> available opportunity -> new investigation.

Agent callouts identify READ / PROPOSE / YOU CONFIRM. Different participant screens demonstrate asymmetric information. Use a real committed history receipt and actual resulting opportunity; do not promise every action creates one.

## Film 2 voiceover (130 words)

Cash builds the empire. OMR follows a different circuit. Defined missions and funded rewards put it in reach. Spend it on upgrades, services and status. Spent tokens return to the Desk: existing inventory, sold again.

The Window turns OMR into game cash, within its funded limits. Cash cannot buy OMR.

On the canonical ETH-OMR market, sell fees support development, community, RWA funding and protocol-owned liquidity.

Core liquidity and seasonal Turf are separate. Families contest future Turf fees. Sieges allocate funded escrow. The principal stays with the protocol.

Inventory bonds sell funded OMR over time. Liquidity commitments use funded rewards. Eligible gear and vehicles can move onchain. Approved RWA purchases can reach eligible Street Deed vaults.

Every balance has a source. Every move has a cost.

OMERTÀ. The economy has territory.

This voiceover describes assumed released functionality. It is not investment advice, a return promise or proof that chain/RWA systems are active today. The full-release assumptions belong in production metadata; audience-facing screens should show genuine advertised-release UI, not fabricated settlement receipts.

## Economic map: keep the denominations and custody separate

| Flow | What moves | Important boundary |
|---|---|---|
| Crime, business, trade and territory | Internal game cash, items and resources | No cash -> OMR conversion. Materials are not tokens. |
| Defined mission / daily / season / pass / City awards | OMR according to specific reward and funding rules | Mission rewards are account-once; funded pools can be empty. New world operations are not token faucets. |
| PvP loot, bids, sales, loans, tribute | Existing balances or assets move | Transfers are not token issuance. OMR and game-cash escrows differ. |
| OMR service/status/item spend | OMR leaves player, recycles to Desk under specified reasons | Not a universal burn or deflationary promise. Withdrawal is excluded. |
| Desk sale | Existing held OMR inventory to buyer | Requires actual inventory; does not mint. Real ETH settlement requires activated rails. |
| Window | OMR -> funded game cash | Fixed configured quote, pool and cap; no reverse path. A configured OMR cut funds Family yield and the remaining spend recycles. |
| Community/Bank/Vig | Source-specific real revenue -> actual OMR buybacks -> distinct funded destinations | Do not route all ETH receipts through the same percentage. Mint revenue is explicitly excluded from Vig. |
| Family game treasury / OMR reserve | Authorized game costs / funded OMR status spending | These differ from chain Turf credits and protocol custody. |
| Canonical Hook | Fee in actual settled ETH or OMR -> independent recipient buckets | POL bucket funds Core. Hook tax applies to this pool, not every OMR venue. |
| Seasonal Turf LP fees | Actual collected designated-lane fees -> bridge -> entitled Family or siege escrow | Separate from Hook tax. Checkpoint determines economic cutoff. Principal remains protocol-owned; already credited fees do not migrate. |
| V2 inventory bond | ETH -> entitlement to already funded OMR -> vested claim | No token minting. No guaranteed discount or investment return. |
| LP commitment | Canonical position NFT custody -> qualifying observations -> funded campaign rewards | Finite lock; reward funds may run out; maturity exit remains independent. |
| RWA purchase / allocation / delivery | Actual acquired approved units -> eligible allocation -> extracted deed account delivery | Three distinct acts. Old fictional ticker Portfolio is retired. ETH Vault allocation does not send ETH. |
| Token withdrawal | In-game debit + reserve-backed token release | Do not recycle the withdrawal; that would count the same unit twice. |

## Verified numeric values: optional, not a slide obligation

Only the canonical Hook percentages are recommended for a clear public economic overlay. The other values below are inspected-source settings, not immutable promises for the eventual release. Read the advertised build again before baking them into screenshots or narration.

| Value | Source-verified meaning | Evidence |
|---|---|---|
| 9% base canonical sell Hook fee | 2% developer + 1.6% RWA recipient + 2.4% community + 3% POL | OmertaHookV2.BASE_SELL_BPS=900 and _allocateBase; Market V2 DESIGN |
| 0-1% extra sell-pressure charge | Additional stability bucket; total Hook max 10%; pool LP fee is extra | OmertaHookV2.MAX_SURGE_BPS=100, MAX_HOOK_BPS=1000 |
| Up to four Family recipients | Turf split shares must total 10,000 bps | OmertaTurfV2 Split and validation |
| 500 game-cash units per OMR; minimum 6 OMR; 1,500 OMR rolling daily cap | Inspected Window configuration, constrained by funded cash pool | src/rules.tail.js EXCHANGE |
| 5% of Window redemption OMR | Funded Family pool share; remaining OMR follows Desk recycling | src/rules.tail.js FAMILY_YIELD.FUND_BPS=500; src/exchange.js redeem |
| Five standing-ranked Family seats, weights 5:4:3:2:1 | Distribution weights over an available funded Family pool | src/rules.tail.js FAMILY_YIELD; src/exchange.js payFamilyYield |
| 3 OMR all-dailies bonus | Only when all applicable jobs are claimed and event fund covers it; not an unconditional daily income promise | src/rules.tail.js M4.DAILY_ALL_OMR; src/growth.js |
| 30 / 60 / 12 OMR | Inspected rename / title / car plate service costs; README has older values | src/rules.tail.js VANITY |

Do not state a total supply, circulating supply, initial price, APR/APY, market return, bond discount, reward yield, seasonal prize amount or allocation schedule without the exact chosen release's published configuration. The historical legacy bond mint and V2 inventory bond are different models. The treasury-source percentages are source-specific and some are environment-overridable, so no universal revenue pie should be drawn.

## Changes from the earlier coverage pass

- Economy V3 recycling is now explicit; older uses of “burn” in accounting comments are not evidence of token destruction.
- PLEX mint is retired; respawn and eligible Store SKUs remain OMR-spend rails. The earned mission mint credit is a separate entitlement.
- RWA is now individually scoped because the expanded brief asks for all mechanisms. Implemented Brokers acquisition/allocation and Street Deed delivery are gated; L06 assumes real release activation and genuine capture. No automatic stock ownership from generic gameplay.
- The player's ETH Vault ledger is allocation-only, distinct from token withdrawals and RWA stock delivery.
- NFT coverage includes eligible cars/boats and deterministic rarity upgrades, not generic export of every World Graph item.
- Gameplay staking/status, protocol POL and onchain LP NFT commitments are three different concepts.
- F48 has been expanded into named progression, property, political, social, competition and economic families below.

## Mechanism-family coverage index

“Implemented” means source exists, not that a production session was verified. “Gated/candidate” needs the fully-live publication assumption. “Planned” is not silently made implemented by that assumption. “LOCAL” evidence belongs to the dirty local adviser work, not pinned main. Voice lanes carry the causal story; support lanes use labeled actual screenshots. Source aliases in F01-F48 retain their definitions in the previous fact matrix.

| ID | Film | Mechanic | Evidence status | Supported full-release claim / boundary | Source |
|---|---|---|---|---|---|
| F01 | 1 | Core gameplay | Implemented; release blocked | Browser mafia RPG: choose actions, manage resources/heat, acquire assets, cooperate/compete. New world progression requires real group authority; never imply a fresh solo player can instantly finish it. | `README.md:16–29,65–72`; RC1:69–83 |
| F02 | 3 | World Graph | Gated; component-ready | Connects actual player, Crew, Family, territory, inventory, information and operations. Translate as “the city remembers” for committed world changes, not omniscience. | CORE:16–29,33–45 |
| F03 | 3 | Living World Director | Gated | Observes canonical conditions, selects authored situations, tracks committed consequences. Cannot invent evidence/assets, resolve an operation or move money. No generative infinite story claim. | DIRECTOR:7–11,27–35; `src/director/config.js:19–25` |
| F04 | 3 | Campaign Network | Gated | Missing Shipment → diverted depot → Black Market → exposure → Informant is implemented. Branches require actual prerequisites. | NETWORK:3–17; RC1:59–66 |
| F05 | 3 | Opportunities | Gated | Prioritized, authorized next moves with known preparation, collaborators and genuine deadlines. Hidden work is not leaked; “related business” is not always proven causation. | FEED:3–17,39–46 |
| F06 | 3 | Player Commands | Gated; component-ready | Player chooses server-issued actions; current authority and requirements are checked at execution; consequential actions show confirmation. | CMD:7–38 |
| F07 | 3 | Coordination Engine | Gated | Family operations implement roles, promises versus contributions, knowledge, escrow, approval and resolution. Old Phase 0-only README is superseded by the newer component record. | CORE:78–90 |
| F08 | 1 | Crews | Implemented; new world adapters gated | Current members contribute their own items/intelligence. Same-Crew requirements are definition-specific. Membership is not a permanent authorization grant. | CORE:19,78–90; NETSRC:136–152; `src/crew.js` |
| F09 | 1 | Families / hierarchy | Implemented; world authority gated | Boss/underboss permissions matter; individual contributions require the owner's action. Four-person Foundry operation is a real pilot, not a requirement for every operation. | CORE:21,78–90; `src/social.js` |
| F10 | 1 | Territory | Implemented; new world control gated | Existing district seizure/war differs from control of a route/object. A successful authorized operation can change canonical control/state. Neither implies ownership of LP principal. | `README.md:69,108`; CORE:21–23; NETWORK:9–17 |
| F11 | 1 | Markets | Implemented; campaign market gated | Existing goods/escrow Exchange coexist with Canal market infrastructure. Canal establishment does not mint vendor stock or automatically move token price. | `src/economy.js`; `src/social.js`; NETWORK:12–17 |
| F12 | 1 | Crafting | Implemented; knowledge-gated progression gated | Inputs are consumed; knowledge/location can unlock a recipe. Canal Cargo Seal uses salvage inputs at Foundry. No automatic OMR reward from crafting. | CORE:25–27,41; NETSRC:49–59; `src/crafting.js:936–970` |
| F13 | 1 | Inventory | Implemented | Real custody, owned unique items and fungible resource balances. UI can show only the authorized owner's inventory or deliberately contributed resources. | CORE:27–29; `src/items.js:970–1069` |
| F14 | 2 | Item provenance | Implemented | A game item has creation/custody/use history. Eligible car/boat/gear extraction is a separate, capped onchain rail; provenance alone is not NFT export. | src/items.js; src/nft.js; src/chain.js |
| F15 | 1 | Materials | Implemented | Scrap steel, wire, salvage parts and other admitted materials are physical game resources. OMR is separate. | `src/content/core-materials.js`; `src/content/automotive-salvage.js`; NETSRC:56–59 |
| F16 | 1 | Salvage | Implemented | Consumes a real owned eligible vehicle through salvage service; outputs enter custody. Do not portray arbitrary stolen scenery as an eligible asset. | `src/crafting.js:970`; CORE:41; HANDOFF:49 |
| F17 | 1 | Facilities | Gated bounded content | Foundry Archive and Canal Supply Depot have states, location, requirements and control. Not an unlimited facility-building sandbox. | CORE:21–23,41; NETSRC:81–87 |
| F18 | 1 | Professions | Broader item-profession system planned | Skill specializations and ten use-XP trades are implemented. The broader World Graph profession/blueprint ladder remains a design; do not equate the two. | src/skills.js; src/mastery.js; src/rules.tail.js MASTERY; docs/superpowers/specs/2026-09-04-world-graph-phase-2b-professions-blueprints-design.md |
| F19 | 1 | Durability / tool economy | Bounded implementation; broader plan | Authored content crafting has tool durability/repair state. Do not generalize to every World Graph item or the whole proposed Phase 2c system. | `src/content/crafting.js:124–140,261–281`; `src/content/compiler.js:684–691`; Phase 2c design |
| F20 | 3 | Mysteries | Gated bounded content | Investigations use actual knowledge, item provenance, location and operation receipts; evidence can reveal an irreversible branch. Not an endless procedural murder generator. | CORE:120–154; NETSRC:88–121 |
| F21 | 3 | Evidence | Gated | Independent original evidence can corroborate a public disclosure. Duplicate forwarded claims do not become independent proof. | NETSRC:122–132; CORE:25,144 |
| F22 | 3 | Asymmetric information | Gated | Own/private/shared/public views differ; hidden requirements stay hidden. A public object does not expose its private past. | DIRECTOR:55; FEED:18–32 |
| F23 | 3 | Knowledge systems | Gated | Authentic discoveries and deliberate sharing grant access; revocation or membership loss can remove it. No AI access to all secrets. | CORE:25,144; FEED:26–31 |
| F24 | 1 | Logistics | Implemented; new campaigns gated | Existing convoys/port systems; buyer-owned bulk cargo ships from the buyer’s trunk. Partial ambushes respect capacity; a funded destination toll requires another Family’s territory. New canonical shipment-route states require materials and group actions. No magical teleport from trade to warehouse inventory. | `src/market.js:314–333`; `src/convoy.js:70–99,254–266,327–347`; `src/port.js`; NETWORK:9–15 |
| F25 | 1 | Law pressure | Implemented; Director use bounded | Heat, law and court systems exist. Director can observe authored pressure; it does not automatically summon an arrest for every suspicious event. | `src/law.js`; NETWORK:25–29 |
| F26 | 3 | Dynamic world state | Gated persistent objects | Actions commit state and events together. Distinct recovery/interception/destruction/exposure outcomes persist. | CORE:21–23; NETWORK:11–15 |
| F27 | 3 | Persistent consequences | Gated; demonstrated in seeded journeys | History survives restart/replay; UI filters visibility. “Remembers this consequence,” not “remembers every betrayal forever.” Some tested branches did not produce follow-up opportunities. | RC1:59–66,85–97; FEED:18–46 |
| F28 | 2 | Seasonal systems | Implemented; funding/chain gates separate | Existing rollover, modifiers, objectives/rewards. Do not promise a payout to all participants or assert new world pilots emit OMR. | `src/worker.js`; `src/season.js`; `src/server.js:1940–1951` |
| F29 | 2 | OMR | Implemented ledger; chain rails gated/dormant | OMR, internal gameplay cash and real ETH have distinct custody and purpose. Cash cannot buy OMR; the funded Window permits one-way OMR-to-game-cash redemption. DNR is separate again. | src/economy.js swap; src/exchange.js redeem; src/chain.js; omerta-contracts/docs/market-v2/DESIGN.md |
| F30 | 2 | OMR sources | Implemented/configured; economic and chain gates | Account-once mission rewards; fund-bounded daily completion transfers; backed prize/season/pass payments; eligible genesis drop; purchased Desk inventory; funded City distribution; PvP loot, loan collateral settlement and trades are transfers. No recurring Street Wage or referral OMR. World Graph operations do not mint OMR. | src/growth.js; src/pass.js; src/drop.js; src/bank.js; src/desk.js; src/invariants.js; src/emission.js |
| F31 | 2 | OMR sinks | Implemented ledger paths | Most OMR spends RECYCLE to Desk inventory, then can be sold as existing inventory. Vanity, status, respec, counter-intelligence, eligible PLEX/Store uses, upgrades and specified services are not a universal deflationary burn. Withdrawal is the explicit recycle exclusion. | src/desk.js:1-40; src/rules.tail.js:3508-3546; src/vig.js payPlex; src/store.js; src/vanity.js |
| F32 | 2 | Escrow | Implemented; new Family operations gated | Different custody systems: game-cash bounties/loans/Family-operation capital; OMR auction bids and collateral; item contributions; chain-funded Turf siege escrow. Never draw them as one interchangeable pot. | src/social/contracts.js; src/loans.js; src/auction.js; src/operations.js; omerta-contracts/src/market-v2/OmertaTurfV2.sol |
| F33 | 2 | Bounties | Implemented | Funded player/Family contracts, expiry/refund and claim rules. No invented automated AI assassination or fixed return. | `README.md:110–112`; `src/social/contracts.js:15–19,114–139` |
| F34 | 2 | Bonds | Legacy deployed dormant / V2 candidate | Use Market V2 inventory bonds in the future release: ETH purchases existing prefunded OMR with bounded terms and linear vesting. They cannot mint OMR. Legacy OmertaBond minting is a separate dormant design and must not be spliced into this flow. | src/bonds.js; omerta-contracts/docs/market-v2/DESIGN.md; omerta-contracts/src/market-v2/OmertaInventoryBondV2.sol |
| F35 | 2 | Treasuries | Gameplay implemented; chain policy separate | Distinguish Family game-cash treasury, Family OMR reserve, protocol ETH/OMR reserves and RWA units. Game-cash contracts/upkeep use authorized Family funds. Standing-weighted Family OMR distributions use funded pools; Turf credits use their own chain rail. | src/territory.js; src/social/contracts.js; src/exchange.js; src/community.js; omerta-contracts/docs/market-v2/DESIGN.md |
| F36 | 2 | Protocol-owned liquidity | Deployed dormant legacy / V2 candidate | Protocol custody of liquidity. Under L02–L03, Core funding and separately configured seasonal Turf ranges operate; designated Turf LP fees can support Family credits while principal stays protocol-owned. | `omerta-contracts/deployments/4663/manifest.json:3,255–262`; market-v2 design |
| F37 | 2 | Uniswap v4 / OMERTÀ Hook | Implemented candidate, not established active | At the assumed full release, show the canonical Hook operating under L02. Use an actual settled receipt. Its POL fee allocation funds Core; designated seasonal Turf LP fees follow a separate bridge. | `omerta-contracts/docs/market-v2/DESIGN.md`; `docs/WIKI.md`; deployment manifest |
| F38 | 2 | Liquidity territory | Candidate/gated | Turf rights concern future funded LP fees, not withdrawal/ownership of pool principal. Keep this separate from game district control. | `omerta-contracts/docs/market-v2/DESIGN.md:48,95–103`; `omerta-contracts/src/market-v2/OmertaTurfV2.sol:11–13` |
| F39 | 2 | NFT-compatible / provenanced items | Provenance implemented; export readiness distinct | Item compatibility is specific. Cars/boats use deterministic OMR rarity upgrades and eligible GearVault extraction; equipment has capped mint rails. The Canal Cargo Seal is explicitly non-exportable. | src/nft.js; src/chain.js; src/content/campaign-network.js; omerta-contracts/src/GearVault.sol |
| F40 | 2 | NFT rails | Deployed/gated, not universal item ownership | Identity NFT, eligible gear/car/boat NFTs and Street Deed NFTs are different objects with different rights. An extracted Street Deed can have a token-bound account. Holding identity alone does not confer every entitlement. | src/nft.js; src/deeds.js; src/stockdeliver.js; omerta-contracts/DEPLOYMENT.md |
| F41 | 2 | RWA integrations | Implemented bounded acquisition/allocation/delivery machinery; chain and compliance/activation gates; production operation unverified | Approved real acquisitions can fund activity-weighted Brokers allocations for eligible NFT holders. Eligible extracted Street Deeds provide the ERC-6551 delivery target. Allocation is not delivery. The old fictional ticker Portfolio is retired; the ETH Vault is allocation-only and separate. Include in future-release film only with actual activated rail/capture, never fabricated stock performance. | src/brokers.js:1-27; src/treasury.js:1-44; src/stockdeliver.js:1-47; src/rwastockkeeper.js; src/stockcatalogv2.js; src/portfolio.js |
| F42 | 2 | Onchain settlement | Implemented/devnet proof; dormant manifest | Wallet/voucher/watcher paths exist. Requires configured, funded, activated rails; in-game event persistence is not a blockchain transaction. | `README.md:31–48,76–80`; deployment manifest |
| F43 | 3 | AI Agents / Agent Turn | Implemented, bounded | Can expose permitted state and allowed actions. Deep City exploration is read-only; World Graph actions are excluded from autonomous Agent Act. | `src/agentgateway.js:1705–1707,1725–1727` |
| F44 | 3 | Consigliere adviser | LOCAL experimental | Scoped adviser, staged proposals and official human confirmation. Not proved deployed/integrated at inspection; L04 explicitly assumes the same released world/command integration for the launch film. No specific Muse interoperability claim. | LOCAL `docs/agent-gateway-capabilities.md:11–31,48–52`; `docs/agent-gateway-review/README.md:95–101` |
| F45 | 3 | Autonomous / semi-autonomous agents | Bounded implementation | Agent Alpha has limited permitted actions; excludes wallet, mint, withdrawal, PvP and borrowing automation. Do not label all agent actions approval-per-click if bounded automation exists. | `src/agentgateway.js:1705–1707`; LOCAL gateway capabilities |
| F46 | 3 | Human approval | Implemented boundaries | New player commands revalidate confirmation/authorization; local adviser proposals need human confirmation; contributions require each owner. No officer/AI silently spends a teammate's inventory. | CMD:19,27–38; CORE:82–86; LOCAL capabilities:48–52 |
| F47 | 3 | Betrayal / social history | Events implemented; guilt inference unsupported | A participant notebook can prove their own disclosure action; it does not establish whether it was authorized or betrayal. No psychic rat detection. | NETSRC:107,120,166–173; NETWORK:13–15 |
| F48 | 1 | Other current mechanics | Implemented; per-system gates | Expanded below into individually assigned mechanic families; coverage means named or demonstrated, not every API endpoint explained. | F49-F96 below |
| F49 | 1 | Crime, energy, nerve, heat and respect | Implemented | Actions consume resources, carry consequences and advance respect/levels; cash progression is not OMR conversion. | src/game.js; src/rules.js; src/growth.js |
| F50 | 1 | Skills, careers and trade mastery | Implemented | Build specializations and repeated actions develop trades; mastery XP is not currency; character skills and account legends have different death rules. | src/skills.js; src/mastery.js; src/career.js; src/rules.tail.js MASTERY |
| F51 | 1 | Garage, tuning, repair and armory | Implemented | Own, tune, repair, fence or salvage eligible assets; weapons/ammo/armor support bounded game actions. | src/economy.js; src/races.js; src/crafting.js |
| F52 | 1 | Businesses, rackets and operating upkeep | Implemented | Buy and upgrade businesses, collect bounded game-cash income, pay wages/upkeep; rivals can shakedown/heist/take over eligible assets. | src/business.js; src/economy.js; src/territory.js |
| F53 | 1 | Kitchen, labs, trade ranks and hired sellers | Implemented | Inputs -> cooking -> inventory -> sale; equipment and worker costs create recurring expenses. Display as fictional game commerce. | src/kitchen.js; src/rules.tail.js KITCHEN |
| F54 | 1 | Crew heists and informants | Implemented | Named seats use distinct capabilities; members join, leader executes, success/failure is shared; a rat can cause a specific heist to fail. This is separate from AI guessing guilt. | src/heists.js; src/crew.js |
| F55 | 1 | PvP, hitmen, protection and loss | Implemented | Rivalries, funded contracts, bodyguards, hospitalization and lethal loss affect what players risk. Loot moves existing assets. | src/social.js; src/social/contracts.js; src/soldiers.js |
| F56 | 1 | Death, heirs, bloodlines and legacy | Implemented | Character death can destroy or redistribute character assets; account legacy, defined inheritance and vendettas persist. Not everything survives. | src/social.js; src/bloodline.js; src/dynasty.js; src/estate.js |
| F57 | 1 | Family wars, diplomacy and coalitions | Implemented | Territory control, pacts, oathbreaking and coalitions affect conflict rules; a treaty is not a token distribution. | src/social.js; src/diplomacy.js; src/territory.js |
| F58 | 1 | Commission politics and decrees | Implemented | Qualified Families vote on bounded city rules with public political records. Decrees do not conjure funds. | src/commission.js |
| F59 | 1 | NPC relationships and favor networks | Implemented | Named contacts, standings, favors and grudges respond to authored player actions; benefits and inheritance are bounded. | src/underworld.js; src/favors.js; src/contacts.js |
| F60 | 1 | Law, investigations, juries and counter-pressure | Implemented | Heat and lawful consequences create costs and constraints; specified OMR services alter bounded conditions, never blanket immunity. | src/law.js; src/rules.tail.js |
| F61 | 1 | Port, boats and shipping | Implemented | Own eligible boats, undertake shipping and manage cargo/risk; convoy goods originate in custody, never a free material faucet. | src/port.js; src/convoy.js; src/shipment.js |
| F62 | 1 | Races, fight management and duels | Implemented | Vehicle races, managed boxers and ranked duels are separate competitive loops; stake currency and consent rules differ by activity. | src/races.js; src/boxing.js; src/duels.js |
| F63 | 1 | Gambling, poker and table escrow | Implemented | Fictional game-cash tables and escrow; the Den does not accept or pay OMR. Keep distinct from tokenomics. | src/casino.js; src/ring.js |
| F64 | 1 | Loans and collateral | Implemented | Funded player-to-player game-cash loans can use permitted collateral; repayment/default transfers existing balances/items, with specified fees. | src/loans.js |
| F65 | 1 | Player markets and auction house | Implemented | P2P cars/goods and separate OMR auction custody. Sale receipts, bid refunds and house fees are distinct flows. | src/market.js; src/social/exchange.js; src/auction.js |
| F66 | 1 | Street Deeds, compounds and collections | Implemented; export gated | Mapped property, named deeds, compound status and collections support legacy. In-game ownership is not automatically extracted NFT custody. | src/deeds.js; src/estate.js; src/collection.js |
| F67 | 1 | Dynastic ties and honor | Implemented | Marriages, bloodline ties, public honor and sworn consequences survive or change under their own rules. Not invulnerability. | src/dynasty.js; src/honor.js |
| F68 | 1 | City megaprojects | Implemented | Players contribute actual cash, OMR or goods toward a bounded monument; completion and contributor records persist. OMR follows the recycle policy. | src/megaproject.js; src/rules.tail.js DESK |
| F69 | 2 | OMR spending -> Desk recycling -> sale | Implemented; real ETH sale requires chain wiring | Specified spends move to a finite Desk shelf; sales transfer inventory to a buyer. No automatic burn, guaranteed revenue or mint. | src/desk.js; src/game.js ledger; src/rules.tail.js DESK |
| F70 | 2 | One-way Window and city cash pool | Implemented | OMR redemption draws game cash from a funded, capped pool. A dry pool refuses without taking OMR. Family share and Desk recycling are separate destinations. | src/exchange.js; src/rules.tail.js EXCHANGE/FAMILY_YIELD |
| F71 | 2 | OMR staking, commitments and Made status | Implemented | Staking changes custody/exposure and supports status laddders. Optional time commitments alter effective stake. Personal yield is retired; locked stake is not immune to PvP loot. | src/economy.js stake/lockStake/unstake; src/made.js |
| F72 | 2 | Vig, revenue buybacks and funded prizes | Implemented; real swap/chain gates | Qualifying real revenue funds actual OMR buybacks; reserve and prize accounting are bounded by received assets. Source-specific splits apply; mint revenue is excluded from Vig. | src/vig.js; src/fees.js; src/invariants.js |
| F73 | 2 | The Bank and activity-weighted City distribution | Implemented; funding/chain gates | A designated protocol-profit leg buys OMR for qualified game activity distribution. It is not an unlimited faucet or a promised return. DNR/credit machinery is a separate denomination. | src/bank.js; omerta-contracts/README.md |
| F74 | 2 | Family yield and community buybacks | Implemented; source-specific activation | Seasonal standing distributes a funded OMR pool to Family reserves. Community revenue buybacks and Window cuts are distinct inflows. A Family reserve is not a personal ETH wallet. | src/community.js; src/exchange.js |
| F75 | 2 | Withdrawal, backing and settlement | Implemented; chain gates | Link an authorized wallet; reserve-backed withdrawal/voucher rails and confirmation apply. In-game OMR debits pair with hard token release; do not recycle withdrawn units. | src/chain.js; src/watcher.js; src/defi.js; src/rules.tail.js DESK.NOT_RECYCLED |
| F76 | 2 | Hook fee routing and opening policy | Implemented V2 candidate | Canonical pool sells have 9% base Hook fee split 2% developer / 1.6% RWA / 2.4% community / 3% POL; additional sell pressure is 0-1% to stability. Pool LP fees are extra; opening buy rules separate. | omerta-contracts/src/market-v2/OmertaHookV2.sol; omerta-contracts/docs/market-v2/DESIGN.md |
| F77 | 2 | Finite stability inventory and War Chest | Implemented V2 candidate | Core, Lower Cushion/Garrison, Upper Cushion/Desk and Turf use separate bounded inventory. War Chest funds eligible regeneration; price recovery does not create reserves or guarantee a floor. | omerta-contracts/src/market-v2/OmertaStabilityControllerV2.sol; omerta-contracts/docs/market-v2/DESIGN.md |
| F78 | 2 | Turf syndicates, sieges and seasonal rights | Implemented V2 candidate; game integration assumed | Families or bounded syndicates can receive future funded lane fees. Atomic checkpoints separate old/new rights. Siege escrow follows configured allocation; principal remains protocol owned. | omerta-contracts/src/market-v2/OmertaTurfV2.sol; OmertaGameSettlementV2.sol; OmertaTurfFeeBridgeV2.sol |
| F79 | 2 | Player LP NFT commitments | Implemented V2 candidate | Canonical PositionManager NFT is held for a finite commitment; funded campaigns use sampled qualifying depth. Maturity exit is independent of reward availability. | omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol |
| F80 | 2 | Arbitrage and bounded keepers | Implemented V2 candidate | Solver-bound commit/reveal cycles require actual realized profit and a configured reserve share. Keepers run bounded jobs; they are not autonomous player agents or guaranteed-profit bots. | omerta-contracts/src/market-v2/OmertaArbitrageV2.sol; src/marketv2solver.js; src/marketv2keeper.js |
| F81 | 2 | RWA Brokers activation and acquisition | Implemented; gated | Eligible activity/activation weights allocate actual acquired approved units. Ballot, registry, buyer and custody restrictions apply. No price appreciation or yield promise. | src/brokers.js; src/treasury.js; src/rwastockkeeper.js; src/stockcatalogv2.js |
| F82 | 2 | Street Deed RWA delivery | Implemented; chain dormant | Acquired and allocated eligible units can be delivered into the eligible extracted Street Deed token-bound account. No extracted deed means allocation waits; delivery is a separate confirmed act. | src/stockdeliver.js; src/deeds.js |
| F83 | 2 | ETH Vault allocation | Implemented accounting; delivery absent by design | Spending specified OMR can allocate ETH already held; this ledger does not transfer ETH to a player. Keep separate from RWA stock delivery and token withdrawals. | src/treasury.js |
| F84 | 2 | Store, PLEX and Season Pass | Implemented; chain/payment gates | Mint is ETH-only or earned credit. Respawn and eligible Store items support OMR uses; the pass has specified status/consumable rewards and pool-backed OMR tiers. | src/vig.js payPlex; src/store.js; src/pass.js; src/growth.js |
| F85 | 2 | Genesis, launch auction and community drop | Implemented gated lifecycle | Auction/migration/oracle-warmup/live are explicit phases. Drop eligibility uses published allocation, wallet proof and bounded window. Do not splice launch-only minting into recurring economy claims. | src/genesislaunch.js; src/genesiscca.js; src/drop.js |
| F86 | 3 | Investigation evidence and independent corroboration | Gated world systems | Evidence unlocks bounded conclusions; duplicate screenshots are not independent proof. Supported disclosure history is not a psychic verdict of betrayal. | src/mysteries.js; src/world-knowledge.js; src/content/campaign-network.js |
| F87 | 3 | Agent interface and human authority | Implemented bounded gateway; adviser prototype | Agents see permitted context and allowed actions. Adviser proposes; consequential authorized commands require the real confirmation path. Existing scoped agent automation has its own limited action set. | src/agentgateway.js; src/agentturn.js; LOCAL docs/agent-gateway-capabilities.md |
| F88 | 3 | Notifications, social memory and public records | Implemented; new world projections gated | Feeds, city records, player discoveries and authorized activity views show committed changes without exposing every private action. | src/citywire.js; src/streets.js; src/phone.js; src/world-projection.js; src/world-consequences.js |
| F89 | 1 | The Stable: racing dogs and horses | Implemented | Buy, train and enter racing animals in bounded PvE/PvP activity; dogs race dogs and horses race horses. These are distinct from boxer management. | src/stable.js |
| F90 | 1 | Speakeasies and social status | Implemented | District clubs support proprietors, rounds, bottle service, decor and social prestige. OMR status spends follow the global recycle policy. | src/speakeasy.js |
| F91 | 1 | The Pen and prison breaks | Implemented | Jailed players have yard work, contraband, protection, guard bribes and eligible prison conflict; cooperative escape has its own participant conditions. | src/pen.js |
| F92 | 3 | The Wire: intelligence and counter-intelligence | Implemented | Specific game surveillance, sweeps, dossiers, informants and feed access expose only the game information those systems authorize; no access to off-platform private communications. | src/wire.js |
| F93 | 3 | Secrets and blackmail | Implemented | Discover held game secrets, demand hush payments or expose under the system rules. Distinguish real game evidence from disinformation. This does not make adviser deductions omniscient. | src/secrets.js; src/wire.js |
| F94 | 3 | Clue scrolls and treasure trails | Implemented | A qualifying crime drop can begin a multi-step district/time riddle trail leading to its specified casket. Separate from World Graph campaign mysteries. | src/clues.js |
| F95 | 1 | NPC Families, world raids and Blood War | Implemented | Shared NPC raid reservoirs and a separate Blood War legend support PvE conflict. These are distinct from player turf wars and the new Living World Director. | src/world.js; src/npcwar.js |
| F96 | 1 | Landmarks and named city history | Implemented | Status dedications can change who is named on a city plaque; defined account history survives death. Spending follows global Desk recycling despite older burn comments. | src/landmarks.js; src/rules.tail.js DESK |

## Canonical Deep City cross-check

All **40/40** systems in pinned main's src/explore.js catalog have an explicit mechanic-family assignment. This catches easily overlooked activities such as the Stable, the Pen, Wire, Secrets, Speakeasy and clue scrolls. The 96-row index additionally covers world architecture and token/RWA/market systems outside that 40-system engagement catalog.

- The Streets: F49
- The Kitchen: F53
- Wet Work: F55
- Contracts: F33
- The Dueling Ladder: F62
- Crew Heists: F54
- Clue Scrolls: F94
- A Family: F09
- The Commission: F58
- Territory: F10
- The World: F95
- The Blood War: F95
- The Empire: F52
- Convoys: F24
- The Port: F61
- The Black Market: F65
- Loan Sharking: F64
- The Den: F63
- The Speakeasy: F90
- The Fights: F62
- Street Races: F62
- The Stable: F89
- The Law: F60
- The Pen: F91
- The Wire: F92
- Secrets: F93
- Skills: F50
- The Underworld: F59
- The Estate: F66
- The Made Man: F71
- The Auction House: F65
- The Collection: F39
- Going Legit: F83
- The Megaproject: F68
- Street Life: F59
- Landmarks: F96
- Street Deeds: F66
- Vanity: F31
- The Store and Pass: F84
- Growth and Social: F88

## Capture and editorial acceptance

1. Capture the actual game UI. Record URL/build, account role, date, screen and redactions in the shot manifest. A local seeded QA screen is real app rendering but is not proof of a public release or real settlement.
2. Show an action and its actual supported consequence; do not manufacture changed balances, approval receipts or secret information in overlays.
3. For Film 2, capture currency labels and custody transitions. Every connecting arrow must name what moves: game cash, OMR, ETH, item custody or approved units.
4. For Film 3, a different participant's knowledge requires their authorized view. Show human confirmation for consequential adviser proposals and preserve Family authorization.
5. Use a legible held screenshot for each mechanism family at least once across the three-film collection. Labels can carry breadth; narration carries the five or six key relationships. Where genuine UI is absent, show an explicitly editorial architecture graphic rather than fabricating a gameplay screen.
6. Recheck exact displayed tokenomics against the release being advertised. No fake investment chart, price appreciation, earning guarantee, universal LP-principal takeover or omniscient AI.

Artifacts: coverage.json is the machine-readable mapping; this file is the editor's fact/claim guide. No app changes, generation submissions, transactions or publication occurred in this research pass.
