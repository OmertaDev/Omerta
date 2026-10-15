import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'../..');
// New cinematic campaign. Source images must be genuine repository UI captures.
const rows=[
[
['Your next move.\nAn empire.','Your next move could build an empire.','streets',['A persistent mafia RPG'],[1]],
['Cash. Respect. Heat.','Crimes earn cash and respect. Heat follows.','streets',['Nerve / energy','Risk / reward'],[49]],
['Become good\nat something.','Train your skills and build a career through action.','skills',['Skills / careers','Ten trades'],[18,50]],
['A wreck has value.','Steal a car. Salvage eligible wrecks into materials.','garage',['Garage / armory','Salvage / materials'],[16,15,51]],
['Build your advantage.','Discover recipes to craft, repair, and track your gear.','crafting',['Inventory / provenance','Recipes / tools'],[12,13,14,19]],
['An empire has upkeep.','Build businesses. Run kitchens. Pay the people working them.','business',['Rackets / kitchens','Labor / upkeep'],[52,53],['business','kitchen']],
['Getting it there\nis the game.','Move cargo through markets and risky convoys.','market',['Markets / auctions','Convoys / boats'],[24,61,11,65],['market','logistics']],
['Bring a Crew.','Recruit a Crew. Coordinate heists and harder targets.','crew',['Crew heists','NPC raids'],[8,54,95],['crew','heists']],
['Strength becomes\nterritory.','Build a Family. Turn strength into territory.','family',['Hierarchy / wars','Diplomacy / alliances'],[9,10,57],['family','territory']],
['Control has a cost.','Territory earns income while diplomacy shapes the fight.','territory',['Commission / favors','Speakeasy status'],[58,59,90],['territory','speakeasy']],
['Make the deal.','Loans and escrow put consequences behind every deal.','loans',['Loans / collateral','Escrow / contracts'],[32,64]],
['Own the room.','Race, fight, and play the tables.','races',['Races / duels / boxing','Poker / casino / stable'],[62,63,89],['races','boxing','casino','stable']],
['The city hits back.','Rivals strike back. So do investigators, courts, and prison.','law',['PvP / bounties / hitmen','Law / courts / prison'],[25,55,60,91,33],['combat','law','prison']],
['One life.\nReal consequences.','Protection costs. Death can end a character.','estate',['Protection / death','Heirs / bloodlines'],[56]],
['Leave a legacy.','Your heirs, deeds, and reputation carry the legacy.','deeds',['Deeds / compounds','Honor / dynastic ties'],[66,67],['deeds','estate']],
['The season turns.','Seasons reshape the city while players build monuments.','city',['Seasons / megaprojects','Landmarks / collections'],[28,68,96]],
['The empire loop.','Equip your Crew to take control and reinvest.','family',['Player choices drive the loop'],[48],null,'flow',['EARN → EQUIP','COORDINATE → CONTROL','INCOME → UPKEEP → REINVEST']],
['Build something\nworth defending.','OMERTÀ. Build something worth defending.','territory',[],[],null,'end']
],
[
['Two currencies.\nDifferent jobs.','Game cash and OMR follow separate economic circuits.','finance',['Game cash ≠ OMR','ETH has separate custody'],[29]],
['A source for\nevery token.','Defined missions and funded rewards put OMR in reach.','finance',['Missions / seasons / pass','Genesis / funded pools'],[30,85,84]],
['Utility creates demand.','Spend on eligible gear, services, and upgrades.','store',['Equipment / services','Made status / commitments'],[31,71]],
['Spend. Recycle.\nRecirculate.','Eligible spending refills the Desk’s existing token inventory.','desk',['Existing inventory','No mint at resale'],[69],null,'flow',['PLAYER OMR → ELIGIBLE SPEND','DESK INVENTORY','FUNDED INVENTORY SALE → PLAYER']],
['One way.\nFunding required.','The funded Window converts OMR to cash only.','finance',['OMR → game cash','Cash cannot buy OMR'],[70],null,'flow',['PLAYER OMR','FUNDED WINDOW','GAME CASH — NO REVERSE ROUTE']],
['Funding sets\nthe limit.','Revenue can fund buybacks and rewards. Funding sets the limit.','treasury',['Bank / Vig / community','City / Family funded pools'],[72,73,74,35]],
['The canonical market.','Canonical sells route a nine-percent base fee.','desk',['Uniswap v4 / OMERTÀ Hook','Canonical pool policy'],[37,76],null,'flow',['CANONICAL ETH / OMR SWAP','9% BASE SELL FEE','RECIPIENT BUCKETS']],
['Where the fee goes.','Fees support development, RWA, community, and liquidity.','treasury',['0–1% extra stability charge','LP fee is additional'],[37],null,'flow',['2% · Developer','1.6% · RWA recipient','2.4% · Community','3% · POL → Core']],
['Core has limits.','That liquidity allocation funds Core. Stability uses finite reserves.','finance',['Core / War Chest','Bounded keepers / arbitrage'],[36,77,80],null,'flow',['HOOK POL ALLOCATION → CORE','SEPARATE WAR CHEST BUDGET','FINITE ACTION / LIFETIME CAPACITY']],
['Liquidity has territory.','Families contest future funded fees in seasonal Turf.','territory',['Turf / syndicates','Prospective fee rights'],[38,78],null,'flow',['DESIGNATED TURF LP FEES','FUNDED BRIDGE / CHECKPOINT','ENTITLED FAMILY CREDITS']],
['Fee rights.\nNot the principal.','Sieges allocate funded escrow while principal stays protocol-owned.','family',['Funded siege escrow','Protocol custody stays'],[32],null,'flow',['SIEGE → ADJUDICATED OUTCOME','FUTURE FUNDED FEE RIGHTS','POOL PRINCIPAL → PROTOCOL']],
['Inventory,\nnot new supply.','Inventory bonds vest existing OMR. They do not mint more.','desk',['Prefunded OMR','Linear vesting'],[34],null,'flow',['ETH PAYMENT','FUNDED OMR ENTITLEMENT','VESTED CLAIM']],
['Commit a position.','Liquidity commitments lock positions against prefunded campaign rewards.','finance',['Position NFT custody','Mature exit independent'],[79],null,'flow',['QUALIFYING LP POSITION','FINITE COMMITMENT','PREFUNDED REWARD CAMPAIGN']],
['Ownership has rules.','Eligible assets use distinct onchain ownership rails.','chain',['Identity / gear / vehicles','Withdrawal / backing'],[39,40,42,75],['chain','garage','deeds']],
['Real assets.\nSpecific rails.','Approved RWA acquisitions can reach eligible Street Deed vaults.','brokers',['Brokers / acquired units','Street Deed delivery'],[41,81,82],['brokers','deeds']],
['Three different steps.','Acquisition, allocation, and delivery each have separate rules.','deeds',['ETH Vault: allocation only','No automatic universal claim'],[83],null,'flow',['ACQUIRE APPROVED REAL UNITS','ALLOCATE TO ELIGIBLE PLAYERS','DELIVER TO ELIGIBLE DEED VAULT']],
['Source. Cost. Custody.','Every balance has a source. Every move has a cost.','finance',['Cash / OMR / ETH / RWA','Separate balances and rules'],[29]],
['The economy\nhas territory.','OMERTÀ. The economy has territory.','territory',[],[],null,'end']
],
[
['Somebody knows.','In this city, what you know changes everything.','evidence',['Mysteries / hidden information'],[20,22]],
['A shipment.\nAn investigation.','A missing shipment becomes an investigation.','cases',['Campaign Network','Actual prerequisites'],[4]],
['Everything connects.','Clues connect people, places, objects, and history.','case-detail',['World Graph','People / places / objects'],[2]],
['Your view is personal.','Your view is personal. Private intelligence stays private.','knowledge',['Own / shared / public','Permission boundaries'],[23]],
['Two originals.\nOne connection.','Find original evidence from two independent sources.','evidence',['Independent sources','Evidence / provenance'],[21,86]],
['A rumor is not proof.','Share knowledge carefully: forwarded rumors are not proof.','knowledge',['Knowledge sharing','Disclosure ≠ guilt'],[23,47]],
['Preparation matters.','Bring recipes and tools to the right facility.','crafting',['Facilities / recipe access','Tools / materials'],[17],['crafting','inventory']],
['Different players.\nDifferent pieces.','Bring equipment while another player brings the intelligence.','coordination',['Roles / contributions','Items / knowledge'],[7]],
['Authority matters.','Crew roles and Family authority decide who can act.','roles',['Crew participation','Family authorization'],[46],['roles','family']],
['An interface\ninto the city.','An Agent can read permitted context and propose a move.','consigliere',['Agents / Consigliere','Permitted context only'],[43,44,87]],
['Automation has limits.','Consequential proposals still need your approval.','approval',['Scoped automation','No unrestricted wallet control'],[45]],
['You make the move.','You confirm. The server checks authority and resources again.','approval',['Player Commands','Human confirmation'],[6,46]],
['The city keeps\nthe consequence.','The operation changes the world. Its receipt becomes history.','history',['Committed state / history','Visibility-filtered records'],[26,27,88]],
['A world that reacts.','The Director responds to real conditions with authored situations.','city',['Living World Director','Conditions → authored response'],[3],null,'flow',['CANONICAL WORLD CONDITIONS','ELIGIBLE AUTHORED SITUATION','PERSISTENT CONSEQUENCE']],
['One event\nopens another.','Divert cargo; exposure can trigger a new case.','cases',['A supported campaign branch','Prerequisites still apply'],[4],null,'flow',['SHIPMENT DIVERTED','CANAL MARKET ESTABLISHED','EXPOSURE → INFORMANT CASE']],
['Your next opening.','Opportunities connect the next move to what actually happened.','cases',['Opportunity feed','Available / authorized moves'],[5]],
['Information is power.','Secrets and alliances give your decisions lasting weight.','wire',['Wire / secrets / blackmail','Clue scrolls / social history'],[92,93,94]],
['Know more.\nMove together.','OMERTÀ. Know more. Move together.','history',[],[],null,'end']
]];
const titles=['BUILD AN EMPIRE','THE ECONOMY HAS TERRITORY','THE CITY REMEMBERS'];
const films=rows.map((arr,i)=>{const duration=i===1?75:72;const frames=duration*30;const beats=arr.map((r,n)=>({id:`C${i+1}-B${String(n+1).padStart(2,'0')}`,start:Math.round(n*frames/arr.length)/30,end:Math.round((n+1)*frames/arr.length)/30,headline:r[0],narration:r[1],caption:r[1],screen:r[2],tags:r[3],factIds:r[4].map(n=>'F'+String(n).padStart(2,'0')),...(r[5]?{screens:r[5]}:{}),kind:r[6]||'capture',...(r[7]?{flow:r[7]}:{}),kicker:`${String(i+1).padStart(2,'0')} / ${['THE EMPIRE','THE ECONOMY','THE INTELLIGENCE'][i]}`,focus:{x:0.505,y:0.52,scale:1.04},transition:n===0?'scope':[3,8,13].includes(n)?'spin':[5,10,15].includes(n)?'scope':n%3===1?'snap':'pan'}));if(i===1){beats[6].end=863/30;beats[7].start=863/30;beats[7].flowMode='allocation';beats[6].note='Canonical pool only. Actual launch policy and funding apply.';}return{id:String(i+1).padStart(2,'0'),title:titles[i],subtitle:['Earn power. Keep it.','Source. Cost. Custody.','Know more. Move together.'][i],duration,accent:['#B99C60','#AABBAE','#B25243'][i],beats};});
const data={version:4,date:'2026-09-24',format:{width:1080,height:1920,fps:30},setting:'Future fully live release; source UI is a local preview build with synthetic accounts. Chain/world-release integrations are illustrated where captures cannot establish activation.',style:'Cinematic noir; genuine game captures; selective 360/scope/snap edits; original audio',films};
fs.writeFileSync(path.join(here,'production-data.json'),JSON.stringify(data,null,2)+'\n');
const covered=new Set(films.flatMap(f=>f.beats.flatMap(b=>b.factIds)));const coverage=JSON.parse(fs.readFileSync(path.join(here,'coverage.json'),'utf8'));const missing=coverage.mechanics.filter(m=>!covered.has(m.id));if(missing.length)throw Error('Unmapped mechanisms: '+missing.map(m=>m.id).join(','));
fs.writeFileSync(path.join(here,'screenplay.md'),'# OMERTÀ — cinematic campaign\n\nThree new 60–75-second films. Full-release setting; actual local preview UI and clearly marked editorial system flows. Source claim boundaries remain in mechanics-coverage.md. Every mechanism family is mapped to an editorial beat, with spoken core loops and secondary visual labels; this is not a rules manual.\n\n'+films.map(f=>`## ${f.id}. ${f.title} — ${f.duration}s\n\n`+f.beats.map(b=>`**${b.start.toFixed(3)}–${b.end.toFixed(3)} · ${b.headline.replaceAll('\n',' ')}**\n\nVoice: ${b.narration}\n\nPicture: ${b.kind}; ${b.screens?.join(' → ')||b.screen}. ${b.transition} entry; slow pan after the impact.\n\nOn screen: ${b.tags.join(' · ')}${b.flow?'\n\nEditorial diagram: '+b.flow.join(' → '):''}\n\nFacts: ${b.factIds.join(', ')||'Brand CTA'}\n`).join('\n')).join('\n'));
fs.writeFileSync(path.join(here,'coverage-map.json'),JSON.stringify(coverage.mechanics.map(m=>({...m,beats:films.flatMap(f=>f.beats.filter(b=>b.factIds.includes(m.id)).map(b=>({film:f.id,beat:b.id,start:b.start,end:b.end})))})),null,2)+'\n');
console.log(JSON.stringify({films:films.map(f=>({id:f.id,duration:f.duration,words:f.beats.reduce((n,b)=>n+b.narration.split(/\s+/).length,0)})),mechanicFamilies:covered.size}));
