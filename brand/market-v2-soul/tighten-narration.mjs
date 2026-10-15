import fs from 'node:fs';
const here='brand/market-v2-soul';
const d=JSON.parse(fs.readFileSync(`${here}/narrative-map.json`));
const lines=[
 'Everybody wants control. But control costs.',
 'Core provides two-sided liquidity. Other reserves have different jobs.',
 'Sell through active downside ranges: Ether becomes OMR.',
 'Buy through upside ranges: OMR becomes Ether.',
 "Crossing isn't final. Until withdrawal, inventory can still convert back.",
 'Finalization removes eligible positions, separating principal from fees.',
 "Deployment spends capacity. Deposits and withdrawals don't reset it.",
 'Completed pool history informs each move, checked against current conditions.',
 'Stress gates, cooldowns and capacity limit deployment.',
 'Surge fees, bond proceeds and arbitrage shares fund the War Chest.',
 'Refill requires a full window of spaced, healthy observations.',
 'Only actual idle assets move. Lifetime limits stay spent.',
 'A bounce creates no Ether. No guaranteed floor.',
 'Canonical sells pay nine percent, split four ways.',
 'Three percent funds Core. Up to one extra percent funds stability.',
 'Fees settle in Ether or OMR, including partial fills.',
 'Opening buys have temporary fees and limits. Afterwards, no Hook buy tax.',
 'Other venues have their own rules. Pool liquidity fees are separate.',
 'Pay Ether for bonds backed by existing OMR, released through linear vesting.',
 "No minting. No sellback. Purchasing pauses don't erase vested claims.",
 'Solvers commit a plan, then fund a two-pool arbitrage cycle.',
 'Profit is checked after costs and reserve share. Failed gas remains your risk.',
 'Lock canonical position NFTs. Rewards require fresh, qualifying depth samples.',
 'Rewards need funded campaigns. Mature positions can exit independently.',
 'Families fight for seasonal Turf fees. The protocol keeps principal.',
 "Syndicates split rights. Status doesn't multiply money.",
 'A checkpoint assigns earned fees before control changes. Existing claims keep their recipients.',
 'Sieges freeze wallets and allocate only funded escrow.',
 'At season exit, fees settle; principal returns for retirement.',
 "The Safe binds and funds systems. Keepers have budgets. The game can't withdraw principal.",
 'Game cash, OMR, Ether and RWA stay separate.',
 'Trades change inventory. Revenue funds reserves. Conditions gate the next move.',
 'OMERTÀ. Control costs.'
];
const speak=t=>t.replaceAll('OMERTÀ','Oh-MAIR-tah').replaceAll('OMR','O M R').replaceAll('RWA','R W A').replaceAll('NFTs','N F Tees');
let i=0;for(const ch of d.chapters){ch.sourceId=ch.id==='SOUL-CH07'?ch.id:ch.id+'-v2';for(const b of ch.beats){b.text=lines[i++];b.spoken=speak(b.text);}}
d.revision=2;fs.writeFileSync(`${here}/narrative-map.json`,JSON.stringify(d,null,2)+'\n');
const jobs=d.chapters.filter(ch=>ch.id!=='SOUL-CH07').map(ch=>({id:ch.sourceId,model:'fal-ai/minimax/speech-2.8-hd',folder:'audio',ext:'mp3',input:{prompt:ch.beats.map(b=>b.spoken).join(' '),voice_setting:{voice_id:d.voiceId,speed:1,pitch:0,vol:1,english_normalization:false},audio_setting:{sample_rate:44100,bitrate:256000,format:'mp3',channel:1},output_format:'url'}}));
fs.writeFileSync(`${here}/generation-requests/film-voice-v2.json`,JSON.stringify(jobs,null,2)+'\n');
console.log(JSON.stringify({selectedVoice:'A',spokenWords:d.chapters.flatMap(ch=>ch.beats).reduce((n,b)=>n+b.spoken.split(/\s+/).length,0)}));
