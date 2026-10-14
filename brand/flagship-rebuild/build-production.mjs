import fs from 'node:fs';
import path from 'node:path';
import {chapters} from './story-source.mjs';

const root=process.cwd();
const dir=path.join(root,'brand/flagship-rebuild');
const publicDir=path.join(root,'public/art/flagship-rebuild');
fs.mkdirSync(publicDir,{recursive:true});
const write=(p,v)=>fs.writeFileSync(p,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');
const cam=(x,y,scale)=>({x,y,scale});
const beat=(start,kind,headline,opts={})=>({start,kind,headline,...opts});
const shots=[
 beat(0,'cinema','One seat is empty.',{asset:'family-film',anchor:'Nico has put up the stake.',labels:['NICO VALE / THE PAYROLL OFFICE']}),
 beat(3.6,'gameplay','Who gets the other seat?',{capture:'heist-open',focus:cam(.35,.81,2.35),endFocus:cam(.355,.81,2.5),anchor:'One seat is empty.'}),
 beat(9,'gameplay','OMERTÀ',{capture:'heist-open',focus:cam(.48,.65,1.5),endFocus:cam(.48,.65,1.65),anchor:'This is OMERTÀ',labels:['Multiplayer mafia strategy RPG','Play in your browser']}),

 beat(15,'gameplay','A name. A little cash.',{capture:'intake',focus:cam(.5,.40,1.85),endFocus:cam(.5,.47,2.25),anchor:'Nico starts with a name'}),
 beat(20.8,'gameplay','Take the job.',{capture:'job',focus:cam(.37,.60,2.45),endFocus:cam(.47,.50,3.0),anchor:'He takes a small job.',labels:['PICKPOCKET / COST: 2 NERVE']}),
 beat(27.5,'gameplay','A real result.',{capture:'job',focus:cam(.50,.51,3.25),endFocus:cam(.50,.51,3.1),anchor:'Cash and respect go up.',labels:['+$102 GAME CASH','+2 RESPECT']}),
 beat(32,'flow','What matters next?',{mode:'resources',labels:['Another job / Spend nerve','Train / Spend energy','Bank / Money in transit'],anchor:'Another job could build his bankroll.'}),
 beat(40.5,'gameplay','Safety takes time.',{capture:'loop',focus:cam(.345,.70,2.1),endFocus:cam(.45,.735,2.25),camera:[{at:0,x:.345,y:.70,scale:2.1},{at:.34,x:.345,y:.70,scale:2.1},{at:.68,x:.45,y:.735,scale:2.25},{at:1,x:.45,y:.735,scale:2.25}],anchor:'Banking protects money',labels:['Money in transit is exposed']}),
 beat(47,'type','One decision.\nThen its consequence.',{anchor:'That is how a place',labels:[]}),

 beat(52,'flow','How will you make your name?',{mode:'sequence',labels:['THE GUN / Street combat','THE LEDGER / Fronts & trade','THE KITCHEN / Cook quality','THE WHEEL / Convoy speed','THE SHADOW / Faster searches','THE RING / Duels & bouts'],anchor:'As he progresses',note:'An advantage comes with a drawback.'}),
 beat(71,'gameplay','Nico chooses the Wheel.',{capture:'trade',focus:cam(.49,.065,2.0),endFocus:cam(.49,.065,2.15),anchor:'Nico chooses the Wheel',labels:['Faster convoys','Slower cooking']}),
 beat(78,'flow','Two people. Different strengths.',{mode:'roster',labels:['NICO VALE / THE WHEEL','MARA SERRANO / THE GUN'],anchor:'Mara chooses the Gun.',note:'Preparation still matters.'}),
 beat(84.5,'cinema','Become someone worth calling.',{asset:'hero-film',anchor:'What can he do',labels:[]}),

 beat(90,'gameplay','A sack of coffee.',{capture:'trade',focus:cam(.37,.55,2.45),endFocus:cam(.37,.57,2.7),anchor:'He buys a sack of coffee.',labels:['SPOT: $119','DEBIT: $123','IN TRUNK: 1'],note:'Game cash. Purchase fee included in debit.'}),
 beat(98,'flow','The route is part of the price.',{mode:'route',labels:['BUY / Goods in the trunk','MOVE / Time & exposure','SELL / The next market'],anchor:'Getting a bargain',note:'A trade opportunity, not a guaranteed profit.'}),
 beat(103,'gameplay','Repair it. Sell it. Break it down.',{capture:'garage',focus:cam(.245,.69,2.75),endFocus:cam(.255,.72,2.95),anchor:'Cars need repairs.'}),
 beat(106.5,'cinema','Sea routes. Different risks.',{asset:'port-film',anchor:'Boats open sea runs',labels:[]}),
 beat(111,'gameplay','Income takes time and upkeep.',{capture:'kitchen',focus:cam(.45,.51,1.9),endFocus:cam(.45,.51,2.05),anchor:'A business has upkeep',labels:['Business upkeep','Production takes time']}),
 beat(116,'cinema','A city you return to.',{asset:'speakeasy-film',anchor:'Races, boxing',labels:['Races · Boxing · The Den · The Speakeasy']}),
 beat(121,'cinema','Pay attention.',{asset:'market-film',anchor:'Loans, auctions',labels:['Loans · Auctions · Fixers']}),

 beat(125,'gameplay','The Night Shift.',{capture:'crew',focus:cam(.31,.53,2.4),endFocus:cam(.31,.54,2.6),anchor:'Nico forms a Crew',labels:['A small circle. Mutual aid.']}),
 beat(132,'gameplay','The Payroll Office.',{capture:'heist-open',focus:cam(.34,.785,2.2),endFocus:cam(.345,.795,2.4),anchor:'Then comes the Payroll Office job.'}),
 beat(137.5,'flow','Two roles. One job.',{mode:'roster',labels:['NICO VALE / WHEELMAN','OPEN SEAT / MUSCLE'],anchor:'This heist needs',note:'The stake is committed.'}),
 beat(143.5,'gameplay','Mara joins.',{capture:'heist-ready',focus:cam(.35,.54,2.4),endFocus:cam(.35,.55,2.5),anchor:'Mara joins.',labels:['NICO VALE + MARA SERRANO']}),
 beat(149,'gameplay','Preparation changes the odds.',{capture:'heist-ready',focus:cam(.33,.575,2.55),endFocus:cam(.34,.575,2.8),anchor:'Preparation improves their odds.',labels:['It cannot guarantee loyalty.']}),
 beat(154,'gameplay','Commit.',{capture:'heist-ready',focus:cam(.39,.575,3.4),endFocus:cam(.395,.577,3.5),anchor:'He commits.',labels:[]}),
 beat(158,'type','The law was waiting.',{anchor:'The law was waiting.',labels:[],transition:'cut'}),
 beat(161,'gameplay','Somebody talked.',{capture:'consequence',focus:cam(.886,.375,3.2),endFocus:cam(.884,.375,3.3),anchor:'Somebody talked.',labels:[],transition:'cut'}),
 beat(165,'gameplay','Both players go to jail.',{capture:'consequence',focus:cam(.43,.53,2.1),endFocus:cam(.43,.53,2.25),anchor:'Both players go to jail.',labels:['No informant is named.']}),
 beat(172,'type','Who do you believe?',{anchor:'Nico can read exactly',labels:[],note:'The result cannot answer that.'}),

 beat(178,'cinema','Would you invite them again?',{asset:'family-film',anchor:'Jail ends.',labels:[]}),
 beat(185,'cinema','A character can die.',{asset:'funeral-film',anchor:'Bigger risks can cost more',labels:[]}),
 beat(190,'flow','What survives?',{mode:'sequence',labels:['THE CHARACTER / Can be lost','THE ACCOUNT / Continues','THE HEIR / Limited legacy'],anchor:'Your account continues',note:'Seasons have their own rules.'}),
 beat(199,'gameplay','Keep it in play?',{capture:'garage',focus:cam(.255,.70,2.8),endFocus:cam(.255,.70,2.9),anchor:'Eligible gear and vehicles',labels:['Extracted gear & vehicles become inactive in-game']}),
 beat(206,'type','What are you prepared to lose?',{anchor:'Combat cannot take',labels:['Unrelated external-wallet assets stay outside combat.']}),

 beat(212,'flow','Keep it private.\nOr choose who knows.',{mode:'sequence',labels:['DISCOVERY','PERMISSION','SHARED KNOWLEDGE'],anchor:'Elsewhere in the city',note:'World Graph / Information and its history'}),
 beat(219,'flow','Two sources.\nNot two copies.',{mode:'sequence',labels:['INDEPENDENT EVIDENCE A','INDEPENDENT EVIDENCE B'],anchor:'Two investigators',note:'Some investigations require independently obtained evidence.'}),
 beat(225,'flow','Everything came from somewhere.',{mode:'route',labels:['SALVAGE','MATERIAL + RECIPE','CRAFTED ITEM'],anchor:'Objects tell stories too',note:'A traceable history follows the eligible item.'}),
 beat(232,'gameplay','Bigger ambitions.',{capture:'territory',focus:cam(.50,.55,1.7),endFocus:cam(.52,.58,1.95),anchor:"Beyond Nico's small Crew",labels:['Family treasury · Territory · Rivalries']}),
 beat(239,'flow','Put something behind the promise.',{mode:'roster',labels:['CONTRIBUTE','APPROVE','COMMIT'],anchor:'Shared operations',note:'Family operations are separate from Crew chat.'}),
 beat(243,'gameplay','A route worth fighting for.',{capture:'heist-ready',focus:cam(.47,.88,1.8),endFocus:cam(.50,.88,1.95),anchor:'Convoys can be ambushed.',labels:['Convoy risk · Commission votes']}),
 beat(248,'cinema','The city changes around you.',{asset:'foundry-film',anchor:'Events and the Director',labels:['Events · Authored situations']}),

 beat(252,'type','Who is across the street?',{anchor:'Not every rival',labels:['Human players · Player-operated agents · NPCs']}),
 beat(258,'flow','An agent takes its turn.',{mode:'resources',labels:['NERVE / 10 → 7','GAME CASH / $500 → $607','RESPECT / +4'],anchor:'Here it reads',note:'Actual recorded action: a street job.'}),
 beat(267,'flow','A new state.\nA new decision.',{mode:'sequence',labels:['READ AVAILABLE ACTIONS','CHOOSE AN ACTION','RECEIVE THE RESULT'],anchor:'The next decision',note:'Resources and permissions still apply.'}),
 beat(274,'cinema','Every choice leaves a consequence.',{asset:'docks-film',anchor:"The city's NPCs are separate.",labels:[]}),
 beat(277,'gameplay','Who will you bring?',{capture:'crew',focus:cam(.31,.53,2.4),endFocus:cam(.31,.54,2.6),anchor:'Whether you bring friends',labels:[]}),

 beat(280,'gameplay','Equipment. Access. People.',{capture:'garage',focus:cam(.255,.68,2.3),endFocus:cam(.255,.70,2.5),anchor:'Nico needs equipment',labels:[]}),
 beat(286,'flow','What are you spending?',{mode:'balances',labels:['GAME CASH / City life','IN-GAME OMR / Selected gear & services','WALLET OMR / Onchain, separate'],anchor:'Money helps',note:'Some privileges require holding or staking. Many spends recycle OMR.'}),
 beat(300,'flow','One way through the Window.',{mode:'route',labels:['IN-GAME OMR','FUNDED WINDOW','GAME CASH'],anchor:'The funded Window',note:'No cash-to-OMR conversion. No automatic wallet payout.'}),
 beat(308,'flow','Fees return to separate budgets.',{mode:'fees',labels:['DEVELOPER','COMMUNITY','REAL-WORLD ASSETS','LIQUIDITY'],anchor:'Trading fees fund',note:'Protocol-controlled liquidity stays protocol-controlled.'}),
 beat(315,'flow','Inventory. Positions. Realized profit.',{mode:'sequence',labels:['BONDS / Existing OMR, released over time','LIQUIDITY REWARDS / Eligible positions + funded campaigns','RESERVES / A share of realized arbitrage profit'],anchor:'Inventory bonds release',note:'Qualification and funding determine rewards.'}),
 beat(326,'gameplay','A right worth competing for.',{capture:'territory',focus:cam(.49,.54,1.8),endFocus:cam(.50,.54,2.0),anchor:'Families compete',labels:['Designated trading-fee rights'],note:'The pool’s principal remains protocol-controlled.'}),
 beat(332,'flow','Assets beyond the city.',{mode:'sequence',labels:['STOCK TOKENS / Exposure outside the game','COMMISSION / Choices within its authority','ACQUISITION · CUSTODY · ELIGIBILITY'],anchor:'Real-world assets include',note:'Stock Tokens are exposure, not ownership of company shares.'}),
 beat(342,'type','Power has rules.',{anchor:'Holding OMR does not',labels:['Holding OMR does not promise everyone a payout.']}),
 beat(347,'gameplay','Trust is still your decision.',{capture:'heist-open',focus:cam(.35,.81,2.4),endFocus:cam(.355,.81,2.5),anchor:'They cannot decide',labels:[]}),

 beat(350,'cinema','The next invitation.',{asset:'family-film',anchor:'The next job comes round.',labels:[]}),
 beat(355,'gameplay','Another empty seat.',{capture:'heist-open',focus:cam(.35,.81,2.4),endFocus:cam(.355,.81,2.5),anchor:'Another stake.',labels:[]}),
 beat(359,'cinema','Make your name.',{asset:'hero-film',anchor:'Nico has learned',labels:[]}),
 beat(364,'gameplay','Who comes with you?',{capture:'heist-ready',focus:cam(.35,.54,2.4),endFocus:cam(.35,.54,2.5),anchor:'The next invitation',labels:[]}),
 beat(369,'cinema','You can buy equipment.',{asset:'counting-film',anchor:'You can buy equipment.',labels:[]}),
 beat(372.5,'type','You cannot buy trust.',{anchor:'You cannot buy trust.',labels:[]}),
 beat(374,'cinema','Make your name.',{asset:'docks-film',anchor:'Choose your path.',labels:['Choose your path. Find your people.']}),
 beat(379,'end','Who will you bring?',{anchor:'Who will you bring?',labels:['omerta.fun','Play now.']}),
];

const captionsPath=path.join(publicDir,'audio/captions.json');
const captions=fs.existsSync(captionsPath)?JSON.parse(fs.readFileSync(captionsPath)):[];
// Narration bookmarks may refine the initial editorial timing without altering chapter boundaries.
const normalize=s=>s.toLowerCase().replace(/[’]/g,"'").replace(/[^a-z0-9à]+/g,' ').trim();
const joined=captions.map(c=>normalize(c.text));
for(const s of shots){
 const chapter=chapters.find(c=>s.start>=c.start&&s.start<c.end);
 s.chapterId=chapter.id;
 const wanted=normalize(s.anchor||'');
 if(wanted&&s.start!==chapter.start){
  const index=captions.findIndex((c,i)=>c.startMs>=chapter.start*1000&&c.startMs<chapter.end*1000&&joined.slice(i,i+8).join(' ').startsWith(wanted));
  if(index>=0)s.start=Math.round(captions[index].startMs/1000*24)/24;
 }
}
shots.sort((a,b)=>a.start-b.start);
const beats=shots.map((s,i)=>({...s,id:`R${String(i+1).padStart(2,'0')}`,end:shots[i+1]?.start??390}));
for(const b of beats)if(b.end<=b.start)throw Error('Overlapping or empty beat '+b.headline);
const old=JSON.parse(fs.readFileSync(path.join(root,'public/art/flagship-trust/manifest.json')));
const assets={...Object.fromEntries(Object.entries(old.assets).filter(([key])=>!['invitation','family','city','ledger'].includes(key)))};
const inventory=JSON.parse(fs.readFileSync(path.join(root,'brand/flagship-trust/media-inventory.json')));
for(const [key,file] of Object.entries({'family-film':'interior-family','hero-film':'hero-poster','market-film':'interior-market','port-film':'interior-port','speakeasy-film':'interior-speakeasy','funeral-film':'cine-funeral','foundry-film':'district-foundry','docks-film':'district-docks','counting-film':'crime-counting'})){
 const source=inventory.assets.find(a=>a.path===`public/art/hype/${file}.mp4`);
 const stream=source.streams.find(s=>s.codec_type==='video');
 assets[key]={src:source.path.replace(/^public\//,''),width:stream.width,height:stream.height,type:'video',duration:source.durationSeconds,provenance:'Existing project-generated cinematic atmosphere, not recorded gameplay. Original source '+source.generationModel};
}
const mix=path.join(publicDir,'audio/rebuild-mix.wav');
const manifest={assets,brandLogo:old.brandLogo,...(fs.existsSync(mix)?{audio:{src:'art/flagship-rebuild/audio/rebuild-mix.wav',scratch:true,label:'Connected local narration and recut existing noir score; selected Voice A remains pending'}}:{})};
const production={film:{title:'OMERTÀ: Trust Is the Game',duration:390,fps:24,beats},captions};
write(path.join(dir,'production-data.json'),production);write(path.join(publicDir,'production-data.json'),production);write(path.join(publicDir,'manifest.json'),manifest);
write(path.join(dir,'voiceover-script.md'),'# OMERTÀ: Trust Is the Game\n\nRebuilt narrative, full public-launch premise. '+chapters.flatMap(c=>c.text.trim().split(/\s+/)).length+' words.\n\n'+chapters.map(c=>`## ${c.start}–${c.end}s · ${c.title}\n\n${c.text}`).join('\n\n'));
write(path.join(dir,'editorial-checks.json'),{duration:390,beats:beats.length,secondsByKind:beats.reduce((a,b)=>(a[b.kind]=(a[b.kind]||0)+b.end-b.start,a),{}),heistRevelation:beats.find(b=>b.headline==='Somebody talked.').start,paidSpendUsd:0,creativePremise:'Fully released and publicly available. User direction September 30, 2026.',visualMethod:'Camera moves over unaltered genuine UI captures; source-grounded motion graphics; short existing generated atmosphere clips. No invented UI events.'});
console.log(JSON.stringify({beats:beats.length,captions:captions.length,audio:!!manifest.audio,secondsByKind:JSON.parse(fs.readFileSync(path.join(dir,'editorial-checks.json'))).secondsByKind}));
