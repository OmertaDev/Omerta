import fs from 'node:fs';
import path from 'node:path';
import {chapters} from '../flagship-rebuild/story-source.mjs';

const root = process.cwd();
const dir = path.join(root, 'public/art/flagship-animation');
const utterances = JSON.parse(fs.readFileSync(path.join(root, 'public/art/flagship-rebuild/audio/utterance-timing.json')));
const at = (prefix) => {
  const u = utterances.find(u => u.text.startsWith(prefix));
  if (!u) throw Error(`Missing narration anchor: ${prefix}`);
  return Math.round(u.start * 24) / 24;
};
const s = (start, scene, opts = {}) => ({start: typeof start === 'string' ? at(start) : start, scene, ...opts});
const shots = [
  s(0, 'opening'),
  s(15, 'street', {headline:'A name. A little cash.', labels:['Nico Vale','A small bankroll','A city of choices']}),
  s('He takes a small job.', 'street', {headline:'Take the job.', labels:['A street job','Nerve spent','Cash + respect']}),
  s('Another job could', 'street', {labels:['Another job?','Spend nerve','Build a bankroll']}),
  s('Training spends', 'street', {variant:'training', labels:['Train','Energy spent','Stats improve']}),
  s('Banking protects', 'street', {variant:'banking', labels:['The bank run','Exposed in transit','Protected on arrival']}),
  s('Three choices', 'drive', {asset:'street-background', labels:['Different choices. Different risks.']}),
  s('That is how', 'closing', {asset:'street-background', headline:'One decision.', labels:['Then its consequence.']}),
  s(52, 'paths', {variant:'overview', headline:'Six Paths. Six ways forward.'}),
  s('The Gun brings', 'paths', {focus:0}),
  s('The Ledger,', 'paths', {focus:1}),
  s('The Kitchen,', 'paths', {focus:2}),
  s('The Wheel,', 'paths', {focus:3}),
  s('The Shadow,', 'paths', {focus:4}),
  s('The Ring,', 'paths', {focus:5}),
  s('Every advantage', 'paths', {variant:'overview', headline:'Every advantage costs something.'}),
  s('Nico chooses', 'paths', {focus:3, labels:['Nico · The Wheel','Faster convoys','Slower cooking']}),
  s('Mara chooses', 'paths', {focus:0, variant:'mara', labels:['Mara · The Gun','Street combat','Preparation still matters']}),
  s('Nico starts thinking', 'recruitment', {asset:'street-background', variant:'joined', headline:'Become someone worth calling.', labels:['Nico · The Wheel','Mara · The Gun','Different strengths']}),
  s(90, 'cargo', {labels:['Coffee purchased. Cargo loaded.']}),
  s('Getting a bargain', 'drive', {labels:['The route is part of the decision.']}),
  s('Cars need repairs.', 'cargo', {variant:'repair', asset:'street-background', headline:'Keep it running.', labels:['Cars need repairs.']}),
  s('Boats open sea runs', 'drive', {variant:'sea', asset:'dock-background', labels:['Sea runs. Different risks.']}),
  s('A business has upkeep', 'paths', {focus:2, labels:['Time and upkeep','A Kitchen batch takes time']}),
  s('Races, boxing', 'paths', {focus:5, labels:['A city worth returning to','Races · Boxing · The Den · Speakeasy']}),
  s('Loans, auctions', 'street', {asset:'street-background', labels:['Other opportunities','Loans · Auctions · Fixers','Pay attention.']}),
  s(125, 'recruitment', {asset:'street-background', variant:'joined', headline:'The Night Shift.', labels:['Nico Vale','Mara Serrano','Mutual aid · Crew chat']}),
  s('Then comes the Payroll', 'approach', {headline:'The Payroll Office.', labels:['A wheelman. Muscle. A stake.']}),
  s('Nico takes the wheelman', 'recruitment', {variant:'empty', labels:['Nico · Wheelman','Muscle · Open seat','Stake committed']}),
  s('Mara joins.', 'recruitment', {variant:'joined', headline:'Mara joins.', labels:['Nico · Wheelman','Mara · Muscle','Preparation changes the odds.']}),
  s('It cannot tell Nico', 'approach', {variant:'waiting', labels:['It cannot guarantee loyalty.']}),
  s('He commits.', 'approach', {variant:'commit', headline:'Commit.'}),
  s('The law was waiting.', 'ambush', {labels:['The law was waiting.','Somebody talked.']}),
  s('Both players go to jail.', 'prison', {labels:['Both arrested. No informant named.']}),
  s('Nico can read exactly', 'prison', {variant:'hold', headline:'Who do you believe?', labels:['The outcome cannot answer that.']}),
  s(178, 'opening', {variant:'aftermath', headline:'Would you invite them again?'}),
  s('Bigger risks can cost more', 'loss', {headline:'A character can die.', labels:['The account continues.']}),
  s('Your account continues', 'loss', {variant:'legacy', headline:'What survives?', labels:['An heir keeps a limited legacy.']}),
  s('Eligible gear and vehicles', 'loss', {variant:'extraction', labels:['Extracted gear and vehicles leave play.']}),
  s('Combat cannot take', 'balances', {variant:'wallet', headline:'A boundary outside the city.', labels:['Game cash','In-game OMR','External wallet']}),
  s('What do you keep in play?', 'closing', {asset:'prison-background', headline:'What are you prepared to lose?'}),
  s(212, 'evidence', {variant:'permission', labels:['Private discovery','Shared with permission','Choose who knows.']}),
  s('Two investigators', 'evidence', {labels:['Independent source A','Independent source B','A copied clue is not another witness.']}),
  s('Objects tell stories too', 'evidence', {variant:'craft', labels:['Salvage + materials','Eligible recipe','A traceable item history']}),
  s("Beyond Nico's small Crew", 'family', {headline:'Bigger ambitions.', labels:['Family territory','Treasury · Rivalries · Wars','Family ambitions']}),
  s('Shared operations', 'family', {variant:'operation', labels:['Contributions','Approval','Then commitment']}),
  s('Convoys can be ambushed.', 'drive', {labels:['Convoys can be ambushed.']}),
  s('Commission seats', 'family', {variant:'commission', labels:['Commission seats','Votes on specific city rules','Bounded authority']}),
  s("Events and the Director's", 'closing', {asset:'dock-background', headline:'The city changes around you.', labels:['Events · Authored situations']}),
  s(252, 'agent', {headline:'Who is across the street?', labels:['A player-operated agent','Resources and permissions still apply.']}),
  s('Here it reads', 'agent', {variant:'action', labels:['Read. Choose. Act.','A street job changes its next decision.']}),
  s('The next decision', 'agent', {variant:'result', labels:['A new state','Permissions and resources still apply.']}),
  s("The city's NPCs", 'recruitment', {asset:'street-background', variant:'joined', labels:['Bring friends','Build an agent','Choices have consequences']}),
  s(280, 'cargo', {variant:'equipment', asset:'street-background', labels:['Equipment. Access. People.']}),
  s('Money helps', 'balances', {headline:'Three balances. Different jobs.', labels:['Game cash','In-game OMR','Wallet OMR']}),
  s('Most OMR spends', 'balances', {variant:'recycle', headline:'Most spends recycle OMR.', labels:['Game cash','In-game OMR','Wallet OMR']}),
  s('The funded Window', 'balances', {variant:'window', headline:'One way through the Window.', labels:['In-game OMR','Game cash','Funded conversion · No automatic wallet payout']}),
  s('Trading fees fund', 'fees', {labels:['Developer','Community','Assets','Liquidity']}),
  s('Inventory bonds', 'bonds', {labels:['Inventory bonds','Existing OMR · released over time','Released OMR']}),
  s('Liquidity rewards', 'liquidity', {labels:['Liquidity rewards','Eligible positions','Funded campaigns']}),
  s('Some realized', 'liquidity', {variant:'profit', labels:['Reserves','A share of realized profit','Arbitrage profit only']}),
  s('Families compete', 'liquidity', {variant:'rights', labels:['Trading-fee rights','Designated fees','Principal stays put']}),
  s('Real-world assets include', 'rwa', {labels:['Stock Tokens','Exposure beyond the game','Exposure, not company shares']}),
  s('Commission choices', 'rwa', {variant:'process', labels:['Commission choices','Acquisition and custody','Eligibility governs participation']}),
  s('Holding OMR', 'closing', {asset:'finance-background', headline:'Holding OMR promises no universal payout.'}),
  s('These systems shape', 'family', {labels:['Organize together','Decide together','Trust remains your choice']}),
  s(350, 'opening', {variant:'reprise'}),
  s('Nico has learned', 'drive', {asset:'street-background', labels:['Earn. Specialize. Live with the result.']}),
  s('The next invitation', 'opening', {variant:'reprise', headline:'The next invitation is yours.'}),
  s('You can buy equipment.', 'cargo', {variant:'equipment', asset:'street-background', labels:['You can buy equipment.']}),
  s('You cannot buy trust.', 'closing', {asset:'opening-background', headline:'You cannot buy trust.'}),
  s('Choose your path.', 'recruitment', {asset:'dock-background', variant:'joined', labels:['Choose your path.','Find your people.','Make your name.']}),
  s(379, 'end', {headline:'Who will you bring?', labels:['omerta.fun','Play now']}),
];
shots.sort((a,b)=>a.start-b.start);
const finalShots=shots.map((shot,i)=>({...shot,id:`A${String(i+1).padStart(2,'0')}`,end:shots[i+1]?.start??390}));
for(const shot of finalShots) if(shot.end<=shot.start) throw Error(`Empty shot: ${shot.id}`);
const captions = JSON.parse(fs.readFileSync(path.join(root,'public/art/flagship-rebuild/audio/captions.json')));
const film={title:'OMERTÀ: Trust Is the Game',duration:390,fps:24,technique:'Original painted assets with layered 2.5D animation',editorialPremise:'Public launch; play now',shots:finalShots,captions,audio:{src:'art/flagship-animation/audio/animated-mix.wav'},opening:JSON.parse(fs.readFileSync(path.join(dir,'opening-scene.json'))),chapters:chapters.map(({id,title,start,end})=>({id,title,start,end}))};
fs.writeFileSync(path.join(dir,'film.json'),JSON.stringify(film,null,2)+'\n');
fs.writeFileSync(path.join(root,'brand/flagship-animation/shot-list.md'),'# OMERTÀ — Animated film\n\nOriginal painted animation. No website screenshots.\n\n'+finalShots.map(s=>`- ${s.id} · ${s.start.toFixed(2)}–${s.end.toFixed(2)}s · ${s.scene} · ${s.headline||s.labels?.join(' / ')||s.variant||'Action'}${s.focus!==undefined?' · Path '+s.focus:''}`).join('\n')+'\n');
console.log(JSON.stringify({shots:finalShots.length,duration:film.duration,captions:captions.length,frames:390*24,minimumShotSeconds:Math.min(...finalShots.map(s=>s.end-s.start))},null,2));
