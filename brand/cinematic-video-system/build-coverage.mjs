import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'brand/cinematic-video-system');
const main = execFileSync('git', ['rev-parse', 'origin/main'], {encoding:'utf8'}).trim();
const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const original = fs.readFileSync('brand/brainrot-video-system/00-FACT-MATRIX.md','utf8');
const rows = original.split(/\r?\n/).filter(x => /^\| F\d\d \|/.test(x)).map(line => {
  const [id, mechanic, status, supportedClaim, evidence] = line.split('|').slice(1,-1).map(x=>x.trim());
  return {id,mechanic,status,supportedClaim,evidence,primaryFilm:1,coverage:'supporting screenshot / short label'};
});
if(rows.length !== 48) throw new Error(`Expected 48 inherited rows; got ${rows.length}`);
const byId = Object.fromEntries(rows.map(x=>[x.id,x]));
for(const id of [2,3,4,5,6,7,20,21,22,23,26,27,43,44,45,46,47]) byId[`F${String(id).padStart(2,'0')}`].primaryFilm=3;
for(const id of [14,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42]) byId[`F${String(id).padStart(2,'0')}`].primaryFilm=2;
const patch = (id, props) => Object.assign(byId[id], props);
patch('F14',{supportedClaim:'A game item has creation/custody/use history. Eligible car/boat/gear extraction is a separate, capped onchain rail; provenance alone is not NFT export.',evidence:'src/items.js; src/nft.js; src/chain.js'});
patch('F18',{supportedClaim:'Skill specializations and ten use-XP trades are implemented. The broader World Graph profession/blueprint ladder remains a design; do not equate the two.',evidence:'src/skills.js; src/mastery.js; src/rules.tail.js MASTERY; docs/superpowers/specs/2026-09-04-world-graph-phase-2b-professions-blueprints-design.md'});
patch('F29',{supportedClaim:'OMR, internal gameplay cash and real ETH have distinct custody and purpose. Cash cannot buy OMR; the funded Window permits one-way OMR-to-game-cash redemption. DNR is separate again.',evidence:'src/economy.js swap; src/exchange.js redeem; src/chain.js; omerta-contracts/docs/market-v2/DESIGN.md'});
patch('F30',{supportedClaim:'Account-once mission rewards; fund-bounded daily completion transfers; backed prize/season/pass payments; eligible genesis drop; purchased Desk inventory; funded City distribution; PvP loot, loan collateral settlement and trades are transfers. No recurring Street Wage or referral OMR. World Graph operations do not mint OMR.',evidence:'src/growth.js; src/pass.js; src/drop.js; src/bank.js; src/desk.js; src/invariants.js; src/emission.js'});
patch('F31',{supportedClaim:'Most OMR spends RECYCLE to Desk inventory, then can be sold as existing inventory. Vanity, status, respec, counter-intelligence, eligible PLEX/Store uses, upgrades and specified services are not a universal deflationary burn. Withdrawal is the explicit recycle exclusion.',evidence:'src/desk.js:1-40; src/rules.tail.js:3508-3546; src/vig.js payPlex; src/store.js; src/vanity.js'});
patch('F32',{supportedClaim:'Different custody systems: game-cash bounties/loans/Family-operation capital; OMR auction bids and collateral; item contributions; chain-funded Turf siege escrow. Never draw them as one interchangeable pot.',evidence:'src/social/contracts.js; src/loans.js; src/auction.js; src/operations.js; omerta-contracts/src/market-v2/OmertaTurfV2.sol'});
patch('F34',{supportedClaim:'Use Market V2 inventory bonds in the future release: ETH purchases existing prefunded OMR with bounded terms and linear vesting. They cannot mint OMR. Legacy OmertaBond minting is a separate dormant design and must not be spliced into this flow.',evidence:'src/bonds.js; omerta-contracts/docs/market-v2/DESIGN.md; omerta-contracts/src/market-v2/OmertaInventoryBondV2.sol'});
patch('F35',{supportedClaim:'Distinguish Family game-cash treasury, Family OMR reserve, protocol ETH/OMR reserves and RWA units. Game-cash contracts/upkeep use authorized Family funds. Standing-weighted Family OMR distributions use funded pools; Turf credits use their own chain rail.',evidence:'src/territory.js; src/social/contracts.js; src/exchange.js; src/community.js; omerta-contracts/docs/market-v2/DESIGN.md'});
patch('F39',{supportedClaim:'Item compatibility is specific. Cars/boats use deterministic OMR rarity upgrades and eligible GearVault extraction; equipment has capped mint rails. The Canal Cargo Seal is explicitly non-exportable.',evidence:'src/nft.js; src/chain.js; src/content/campaign-network.js; omerta-contracts/src/GearVault.sol'});
patch('F40',{supportedClaim:'Identity NFT, eligible gear/car/boat NFTs and Street Deed NFTs are different objects with different rights. An extracted Street Deed can have a token-bound account. Holding identity alone does not confer every entitlement.',evidence:'src/nft.js; src/deeds.js; src/stockdeliver.js; omerta-contracts/DEPLOYMENT.md'});
patch('F41',{status:'Implemented bounded acquisition/allocation/delivery machinery; chain and compliance/activation gates; production operation unverified',supportedClaim:'Approved real acquisitions can fund activity-weighted Brokers allocations for eligible NFT holders. Eligible extracted Street Deeds provide the ERC-6551 delivery target. Allocation is not delivery. The old fictional ticker Portfolio is retired; the ETH Vault is allocation-only and separate. Include in future-release film only with actual activated rail/capture, never fabricated stock performance.',evidence:'src/brokers.js:1-27; src/treasury.js:1-44; src/stockdeliver.js:1-47; src/rwastockkeeper.js; src/stockcatalogv2.js; src/portfolio.js'});
patch('F48',{supportedClaim:'Expanded below into individually assigned mechanic families; coverage means named or demonstrated, not every API endpoint explained.',evidence:'F49-F96 below'});

const extras = [
  [49,1,'Crime, energy, nerve, heat and respect','Implemented','Actions consume resources, carry consequences and advance respect/levels; cash progression is not OMR conversion.','src/game.js; src/rules.js; src/growth.js'],
  [50,1,'Skills, careers and trade mastery','Implemented','Build specializations and repeated actions develop trades; mastery XP is not currency; character skills and account legends have different death rules.','src/skills.js; src/mastery.js; src/career.js; src/rules.tail.js MASTERY'],
  [51,1,'Garage, tuning, repair and armory','Implemented','Own, tune, repair, fence or salvage eligible assets; weapons/ammo/armor support bounded game actions.','src/economy.js; src/races.js; src/crafting.js'],
  [52,1,'Businesses, rackets and operating upkeep','Implemented','Buy and upgrade businesses, collect bounded game-cash income, pay wages/upkeep; rivals can shakedown/heist/take over eligible assets.','src/business.js; src/economy.js; src/territory.js'],
  [53,1,'Kitchen, labs, trade ranks and hired sellers','Implemented','Inputs -> cooking -> inventory -> sale; equipment and worker costs create recurring expenses. Display as fictional game commerce.','src/kitchen.js; src/rules.tail.js KITCHEN'],
  [54,1,'Crew heists and informants','Implemented','Named seats use distinct capabilities; members join, leader executes, success/failure is shared; a rat can cause a specific heist to fail. This is separate from AI guessing guilt.','src/heists.js; src/crew.js'],
  [55,1,'PvP, hitmen, protection and loss','Implemented','Rivalries, funded contracts, bodyguards, hospitalization and lethal loss affect what players risk. Loot moves existing assets.','src/social.js; src/social/contracts.js; src/soldiers.js'],
  [56,1,'Death, heirs, bloodlines and legacy','Implemented','Character death can destroy or redistribute character assets; account legacy, defined inheritance and vendettas persist. Not everything survives.','src/social.js; src/bloodline.js; src/dynasty.js; src/estate.js'],
  [57,1,'Family wars, diplomacy and coalitions','Implemented','Territory control, pacts, oathbreaking and coalitions affect conflict rules; a treaty is not a token distribution.','src/social.js; src/diplomacy.js; src/territory.js'],
  [58,1,'Commission politics and decrees','Implemented','Qualified Families vote on bounded city rules with public political records. Decrees do not conjure funds.','src/commission.js'],
  [59,1,'NPC relationships and favor networks','Implemented','Named contacts, standings, favors and grudges respond to authored player actions; benefits and inheritance are bounded.','src/underworld.js; src/favors.js; src/contacts.js'],
  [60,1,'Law, investigations, juries and counter-pressure','Implemented','Heat and lawful consequences create costs and constraints; specified OMR services alter bounded conditions, never blanket immunity.','src/law.js; src/rules.tail.js'],
  [61,1,'Port, boats and shipping','Implemented','Own eligible boats, undertake shipping and manage cargo/risk; convoy goods originate in custody, never a free material faucet.','src/port.js; src/convoy.js; src/shipment.js'],
  [62,1,'Races, fight management and duels','Implemented','Vehicle races, managed boxers and ranked duels are separate competitive loops; stake currency and consent rules differ by activity.','src/races.js; src/boxing.js; src/duels.js'],
  [63,1,'Gambling, poker and table escrow','Implemented','Fictional game-cash tables and escrow; the Den does not accept or pay OMR. Keep distinct from tokenomics.','src/casino.js; src/ring.js'],
  [64,1,'Loans and collateral','Implemented','Funded player-to-player game-cash loans can use permitted collateral; repayment/default transfers existing balances/items, with specified fees.','src/loans.js'],
  [65,1,'Player markets and auction house','Implemented','P2P cars/goods and separate OMR auction custody. Sale receipts, bid refunds and house fees are distinct flows.','src/market.js; src/social/exchange.js; src/auction.js'],
  [66,1,'Street Deeds, compounds and collections','Implemented; export gated','Mapped property, named deeds, compound status and collections support legacy. In-game ownership is not automatically extracted NFT custody.','src/deeds.js; src/estate.js; src/collection.js'],
  [67,1,'Dynastic ties and honor','Implemented','Marriages, bloodline ties, public honor and sworn consequences survive or change under their own rules. Not invulnerability.','src/dynasty.js; src/honor.js'],
  [68,1,'City megaprojects','Implemented','Players contribute actual cash, OMR or goods toward a bounded monument; completion and contributor records persist. OMR follows the recycle policy.','src/megaproject.js; src/rules.tail.js DESK'],
  [69,2,'OMR spending -> Desk recycling -> sale','Implemented; real ETH sale requires chain wiring','Specified spends move to a finite Desk shelf; sales transfer inventory to a buyer. No automatic burn, guaranteed revenue or mint.','src/desk.js; src/game.js ledger; src/rules.tail.js DESK'],
  [70,2,'One-way Window and city cash pool','Implemented','OMR redemption draws game cash from a funded, capped pool. A dry pool refuses without taking OMR. Family share and Desk recycling are separate destinations.','src/exchange.js; src/rules.tail.js EXCHANGE/FAMILY_YIELD'],
  [71,2,'OMR staking, commitments and Made status','Implemented','Staking changes custody/exposure and supports status laddders. Optional time commitments alter effective stake. Personal yield is retired; locked stake is not immune to PvP loot.','src/economy.js stake/lockStake/unstake; src/made.js'],
  [72,2,'Vig, revenue buybacks and funded prizes','Implemented; real swap/chain gates','Qualifying real revenue funds actual OMR buybacks; reserve and prize accounting are bounded by received assets. Source-specific splits apply; mint revenue is excluded from Vig.','src/vig.js; src/fees.js; src/invariants.js'],
  [73,2,'The Bank and activity-weighted City distribution','Implemented; funding/chain gates','A designated protocol-profit leg buys OMR for qualified game activity distribution. It is not an unlimited faucet or a promised return. DNR/credit machinery is a separate denomination.','src/bank.js; omerta-contracts/README.md'],
  [74,2,'Family yield and community buybacks','Implemented; source-specific activation','Seasonal standing distributes a funded OMR pool to Family reserves. Community revenue buybacks and Window cuts are distinct inflows. A Family reserve is not a personal ETH wallet.','src/community.js; src/exchange.js'],
  [75,2,'Withdrawal, backing and settlement','Implemented; chain gates','Link an authorized wallet; reserve-backed withdrawal/voucher rails and confirmation apply. In-game OMR debits pair with hard token release; do not recycle withdrawn units.','src/chain.js; src/watcher.js; src/defi.js; src/rules.tail.js DESK.NOT_RECYCLED'],
  [76,2,'Hook fee routing and opening policy','Implemented V2 candidate','Canonical pool sells have 9% base Hook fee split 2% developer / 1.6% RWA / 2.4% community / 3% POL; additional sell pressure is 0-1% to stability. Pool LP fees are extra; opening buy rules separate.','omerta-contracts/src/market-v2/OmertaHookV2.sol; omerta-contracts/docs/market-v2/DESIGN.md'],
  [77,2,'Finite stability inventory and War Chest','Implemented V2 candidate','Core, Lower Cushion/Garrison, Upper Cushion/Desk and Turf use separate bounded inventory. War Chest funds eligible regeneration; price recovery does not create reserves or guarantee a floor.','omerta-contracts/src/market-v2/OmertaStabilityControllerV2.sol; omerta-contracts/docs/market-v2/DESIGN.md'],
  [78,2,'Turf syndicates, sieges and seasonal rights','Implemented V2 candidate; game integration assumed','Families or bounded syndicates can receive future funded lane fees. Atomic checkpoints separate old/new rights. Siege escrow follows configured allocation; principal remains protocol owned.','omerta-contracts/src/market-v2/OmertaTurfV2.sol; OmertaGameSettlementV2.sol; OmertaTurfFeeBridgeV2.sol'],
  [79,2,'Player LP NFT commitments','Implemented V2 candidate','Canonical PositionManager NFT is held for a finite commitment; funded campaigns use sampled qualifying depth. Maturity exit is independent of reward availability.','omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol'],
  [80,2,'Arbitrage and bounded keepers','Implemented V2 candidate','Solver-bound commit/reveal cycles require actual realized profit and a configured reserve share. Keepers run bounded jobs; they are not autonomous player agents or guaranteed-profit bots.','omerta-contracts/src/market-v2/OmertaArbitrageV2.sol; src/marketv2solver.js; src/marketv2keeper.js'],
  [81,2,'RWA Brokers activation and acquisition','Implemented; gated','Eligible activity/activation weights allocate actual acquired approved units. Ballot, registry, buyer and custody restrictions apply. No price appreciation or yield promise.','src/brokers.js; src/treasury.js; src/rwastockkeeper.js; src/stockcatalogv2.js'],
  [82,2,'Street Deed RWA delivery','Implemented; chain dormant','Acquired and allocated eligible units can be delivered into the eligible extracted Street Deed token-bound account. No extracted deed means allocation waits; delivery is a separate confirmed act.','src/stockdeliver.js; src/deeds.js'],
  [83,2,'ETH Vault allocation','Implemented accounting; delivery absent by design','Spending specified OMR can allocate ETH already held; this ledger does not transfer ETH to a player. Keep separate from RWA stock delivery and token withdrawals.','src/treasury.js'],
  [84,2,'Store, PLEX and Season Pass','Implemented; chain/payment gates','Mint is ETH-only or earned credit. Respawn and eligible Store items support OMR uses; the pass has specified status/consumable rewards and pool-backed OMR tiers.','src/vig.js payPlex; src/store.js; src/pass.js; src/growth.js'],
  [85,2,'Genesis, launch auction and community drop','Implemented gated lifecycle','Auction/migration/oracle-warmup/live are explicit phases. Drop eligibility uses published allocation, wallet proof and bounded window. Do not splice launch-only minting into recurring economy claims.','src/genesislaunch.js; src/genesiscca.js; src/drop.js'],
  [86,3,'Investigation evidence and independent corroboration','Gated world systems','Evidence unlocks bounded conclusions; duplicate screenshots are not independent proof. Supported disclosure history is not a psychic verdict of betrayal.','src/mysteries.js; src/world-knowledge.js; src/content/campaign-network.js'],
  [87,3,'Agent interface and human authority','Implemented bounded gateway; adviser prototype','Agents see permitted context and allowed actions. Adviser proposes; consequential authorized commands require the real confirmation path. Existing scoped agent automation has its own limited action set.','src/agentgateway.js; src/agentturn.js; LOCAL docs/agent-gateway-capabilities.md'],
  [88,3,'Notifications, social memory and public records','Implemented; new world projections gated','Feeds, city records, player discoveries and authorized activity views show committed changes without exposing every private action.','src/citywire.js; src/streets.js; src/phone.js; src/world-projection.js; src/world-consequences.js'],
  [89,1,'The Stable: racing dogs and horses','Implemented','Buy, train and enter racing animals in bounded PvE/PvP activity; dogs race dogs and horses race horses. These are distinct from boxer management.','src/stable.js'],
  [90,1,'Speakeasies and social status','Implemented','District clubs support proprietors, rounds, bottle service, decor and social prestige. OMR status spends follow the global recycle policy.','src/speakeasy.js'],
  [91,1,'The Pen and prison breaks','Implemented','Jailed players have yard work, contraband, protection, guard bribes and eligible prison conflict; cooperative escape has its own participant conditions.','src/pen.js'],
  [92,3,'The Wire: intelligence and counter-intelligence','Implemented','Specific game surveillance, sweeps, dossiers, informants and feed access expose only the game information those systems authorize; no access to off-platform private communications.','src/wire.js'],
  [93,3,'Secrets and blackmail','Implemented','Discover held game secrets, demand hush payments or expose under the system rules. Distinguish real game evidence from disinformation. This does not make adviser deductions omniscient.','src/secrets.js; src/wire.js'],
  [94,3,'Clue scrolls and treasure trails','Implemented','A qualifying crime drop can begin a multi-step district/time riddle trail leading to its specified casket. Separate from World Graph campaign mysteries.','src/clues.js'],
  [95,1,'NPC Families, world raids and Blood War','Implemented','Shared NPC raid reservoirs and a separate Blood War legend support PvE conflict. These are distinct from player turf wars and the new Living World Director.','src/world.js; src/npcwar.js'],
  [96,1,'Landmarks and named city history','Implemented','Status dedications can change who is named on a city plaque; defined account history survives death. Spending follows global Desk recycling despite older burn comments.','src/landmarks.js; src/rules.tail.js DESK'],
];
for(const [n,primaryFilm,mechanic,status,supportedClaim,evidence] of extras) rows.push({id:`F${n}`,primaryFilm,mechanic,status,supportedClaim,evidence,coverage:'supporting screenshot / short label'});
for(const id of ['F01','F08','F09','F10','F12','F24','F54','F56','F02','F03','F04','F05','F07','F20','F23','F27','F29','F31','F36','F37','F38','F41','F69','F70','F78','F87']) (byId[id] || rows.find(x=>x.id===id)).coverage='spoken causal beat plus genuine UI';

const films=[
  {id:1,title:'BUILD AN EMPIRE',durationTargetSeconds:72,flywheel:'Actions -> skills and assets -> materials/crafting/trade -> Crew capability -> Family control and business income -> upkeep, rivals and law -> reinvestment / consequence -> legacy.',secondary:'Show garage, kitchen, skills, NPC relations, market, loans, races, boxing, casino, property, politics and megaprojects as labeled screenshot constellations around the main cause-and-effect story. Cash never auto-converts to OMR.'},
  {id:2,title:'THE ECONOMY HAS TERRITORY',durationTargetSeconds:75,flywheel:'Defined/funded OMR access -> useful spends -> Desk recycling and existing-inventory sales; separately funded cash redemption; canonical market activity -> explicit fee recipients/Core; designated Turf LP fees -> funded Family rights/siege -> prospective ownership. Bonds, LP commitments, NFT and RWA rails are bounded side loops.',secondary:'Keep a four-way currency legend: GAME CASH / OMR / ETH / APPROVED RWA UNITS. Show the recycling loop and two distinct fee paths. Smaller named cards cover backing, prizes, Store/pass, staking/status, bonds, finite inventory, City distributions and RWA custody.'},
  {id:3,title:'THE CITY REMEMBERS',durationTargetSeconds:72,flywheel:'Permitted clue -> investigation -> independent evidence/knowledge -> collaborative preparation -> authorized contribution/approval/execution -> committed state -> authored Director response -> available opportunity -> new investigation.',secondary:'Agent callouts identify READ / PROPOSE / YOU CONFIRM. Different participant screens demonstrate asymmetric information. Use a real committed history receipt and actual resulting opportunity; do not promise every action creates one.'},
];
const canonicalMap={
  'streets-crime':'F49','kitchen':'F53','wet-work':'F55','contracts':'F33','dueling-ladder':'F62',
  'crew-heists':'F54','clue-scrolls':'F94','family':'F09','commission':'F58','territory':'F10',
  'world':'F95','blood-war':'F95','business-empire':'F52','convoys':'F24','port':'F61',
  'black-market':'F65','loan-sharking':'F64','casino':'F63','speakeasy':'F90','boxing':'F62',
  'street-races':'F62','stable':'F89','law':'F60','pen':'F91','wire':'F92','secrets':'F93',
  'skills':'F50','underworld':'F59','estate':'F66','made-man':'F71','auction-house':'F65',
  'collection':'F39','going-legit':'F83','megaproject':'F68','street-life':'F59',
  'landmarks':'F96','street-deeds':'F66','vanity':'F31','store-pass':'F84','growth-social':'F88',
};
const explore=execFileSync('git',['show','origin/main:src/explore.js'],{encoding:'utf8'});
const systems=[...explore.matchAll(/\{ system: '[^']+', systemId: '([^']+)', name: '([^']+)'/g)].map(m=>({systemId:m[1],name:m[2],mechanicId:canonicalMap[m[1]]}));
if(systems.length!==40 || systems.some(s=>!s.mechanicId)) throw new Error('Unmapped canonical Explore system');
const economyVoiceover=`Cash builds the empire. OMR follows a different circuit. Defined missions and funded rewards put it in reach. Spend it on upgrades, services and status. Spent tokens return to the Desk: existing inventory, sold again.

The Window turns OMR into game cash, within its funded limits. Cash cannot buy OMR.

On the canonical ETH-OMR market, sell fees support development, community, RWA funding and protocol-owned liquidity.

Core liquidity and seasonal Turf are separate. Families contest future Turf fees. Sieges allocate funded escrow. The principal stays with the protocol.

Inventory bonds sell funded OMR over time. Liquidity commitments use funded rewards. Eligible gear and vehicles can move onchain. Approved RWA purchases can reach eligible Street Deed vaults.

Every balance has a source. Every move has a cost.

OMERTÀ. The economy has territory.`;
const data={date:'2026-09-24',revision:{main,localHead:head,productionActivationVerified:false},scope:'Three future-fully-live cinematic ads, 60-75 seconds each. Complete mechanism-family coverage; not every API action explained. No assets or paid generation performed by this coverage pass.',sourceHierarchy:'Executable services/constants/contracts at pinned main > bounded handoff/release docs > historical designs/README. Local experimental adviser is explicitly separate.',assumptions:['L01-L05 carried from the earlier fully-live brief, changing cinematic style only.','L06: advertised RWA acquisition, eligibility, allocation and deed-delivery rails are activated, funded, reviewed and captured from the advertised release. This is an assumed future availability condition, not evidence of current activation.','The release chooses Market V2 inventory bonds for this film; legacy bond-minting cannot be mixed into that graphic.','Actual screenshot balances and configured rules override historical example rates; screenshots are never fabricated to prove an unavailable action.'],films,economyVoiceover,economyVoiceoverWords:economyVoiceover.split(/\s+/).length,canonicalExploreCoverage:{source:'src/explore.js + src/engagement.js',mapped:systems.length,systems},mechanics:rows};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'coverage.json'),JSON.stringify(data,null,2)+'\n');

const md=`# Cinematic campaign: mechanisms, flywheels and claim coverage

Prepared 2026-09-24. Main source **${main}**; checkout **${head}**. This expands the previous 48-row matrix to **${rows.length} mechanic families**. The user has specified future fully-live release, three different films, and 60-75 seconds each. No production activation was verified here; the matrix is source evidence, not a deployment assertion. Existing campaign files remain unchanged.

## Creative coverage contract

Three films can cover every mechanic family by combining spoken causal stories with genuine screenshot inserts, short labels, and a companion coverage index. They cannot explain every rule or API endpoint in 3 x 75 seconds. Give each main chain time to register; use 360 rotations, snap zooms, speed ramps and freeze-frame punchlines at transitions, not over small text the viewer must read. Avoid borrowed MLG music, logos or game footage.

Primary source hierarchy: executable source/constants/contracts, then bounded implementation/release records, then older design prose. README contains superseded fees and PLEX descriptions. Source comments can also lag their own functions: payPlex still accepts respawn while the exact retired invariant is plex:mint. The current constants are materially different from some README prices.

## The three stories

${films.map(f=>`### ${f.id}. ${f.title} (${f.durationTargetSeconds}s target)\n\n${f.flywheel}\n\n${f.secondary}`).join('\n\n')}

## Film 2 voiceover (${data.economyVoiceoverWords} words)

${economyVoiceover}

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
${rows.map(r=>`| ${r.id} | ${r.primaryFilm} | ${r.mechanic} | ${r.status} | ${r.supportedClaim} | ${r.evidence} |`).join('\n')}

## Canonical Deep City cross-check

All **40/40** systems in pinned main's src/explore.js catalog have an explicit mechanic-family assignment. This catches easily overlooked activities such as the Stable, the Pen, Wire, Secrets, Speakeasy and clue scrolls. The 96-row index additionally covers world architecture and token/RWA/market systems outside that 40-system engagement catalog.

${systems.map(s=>`- ${s.name}: ${s.mechanicId}`).join('\n')}

## Capture and editorial acceptance

1. Capture the actual game UI. Record URL/build, account role, date, screen and redactions in the shot manifest. A local seeded QA screen is real app rendering but is not proof of a public release or real settlement.
2. Show an action and its actual supported consequence; do not manufacture changed balances, approval receipts or secret information in overlays.
3. For Film 2, capture currency labels and custody transitions. Every connecting arrow must name what moves: game cash, OMR, ETH, item custody or approved units.
4. For Film 3, a different participant's knowledge requires their authorized view. Show human confirmation for consequential adviser proposals and preserve Family authorization.
5. Use a legible held screenshot for each mechanism family at least once across the three-film collection. Labels can carry breadth; narration carries the five or six key relationships. Where genuine UI is absent, show an explicitly editorial architecture graphic rather than fabricating a gameplay screen.
6. Recheck exact displayed tokenomics against the release being advertised. No fake investment chart, price appreciation, earning guarantee, universal LP-principal takeover or omniscient AI.

Artifacts: coverage.json is the machine-readable mapping; this file is the editor's fact/claim guide. No app changes, generation submissions, transactions or publication occurred in this research pass.
`;
fs.writeFileSync(path.join(out,'mechanics-coverage.md'),md);
console.log(JSON.stringify({main,localHead:head,mechanics:rows.length,film2VoiceoverWords:data.economyVoiceoverWords,outputs:['mechanics-coverage.md','coverage.json']}));
