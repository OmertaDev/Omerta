import fs from 'node:fs';
const here='brand/market-v2-soul', assets='public/art/market-v2-soul';
const ledger=JSON.parse(fs.readFileSync(`${assets}/generation-ledger.json`));
const voice=ledger.jobs['SOUL-VOICE-A'].result.custom_voice_id;
const narration=[
 'Everybody wants control of the city. But control costs.',
 'Core supplies liquidity on both sides. The other reserves have different jobs.',
 'Sell through active downside ranges, and Ether becomes OMR.',
 'Buy through the upside ranges, and OMR becomes Ether.',
 "But crossing isn't the finish line. Before withdrawal, inventory can still convert back.",
 'Finalization removes an eligible position, separating returned principal from fees.',
 "Deployment spends capacity. Moving funds won't reset those limits.",
 'The city takes readings before it moves: completed pool history, checked against current conditions.',
 'Stress thresholds, cooldowns and capacity decide whether reserves can deploy.',
 'Surge fees, bond proceeds and an arbitrage share fund the War Chest.',
 'Refill takes a full recovery window, with enough spaced, healthy observations.',
 'Even then, only actual idle assets move. Lifetime limits stay spent.',
 "A price bounce doesn't create Ether. There is no guaranteed floor.",
 'Canonical sells pay nine percent, divided between four recipients.',
 'Three percent funds Core. Up to one extra percent funds stability as sell pressure rises.',
 'Fees settle in Ether or OMR, including partial fills.',
 "Opening buys have temporary limits and fees. Afterwards, there's no Hook buy tax.",
 'Other pools have their own rules. Pool liquidity fees are separate.',
 'Bonds reserve existing OMR, paid for in Ether and released through linear vesting.',
 "No minting. No sellback. A purchasing pause doesn't erase vested claims.",
 'Solvers commit a plan, then fund a two-pool arbitrage cycle.',
 'Profit is checked after costs and the reserve share. Failed gas and competition are still yours.',
 'Players can lock canonical liquidity-position NFTs. Rewards require fresh, qualifying depth samples.',
 'Rewards come from funded campaigns. A matured position can exit independently.',
 'Families fight for seasonal Turf fee rights. The protocol keeps the liquidity principal.',
 "Syndicates split those rights. Territorial status doesn't multiply the money.",
 'Before control changes, a checkpoint assigns fees already earned. Old claims keep their recipients.',
 'Sieges freeze participant wallets and divide funded escrow under bounded outcomes.',
 'At season exit, fees settle and protocol principal returns for retirement.',
 'The Safe binds and funds the system. Keepers simulate within budgets; the game cannot withdraw principal.',
 'Game cash, OMR, Ether and RWA allocations stay on separate ledgers.',
 'Trades change inventory. Funded revenue supports reserves. Conditions decide the next move.',
 'OMERTÀ. Control costs.'
];
const groups=[[0,7],[7,13],[13,18],[18,24],[24,29],[29,32],[32,33]];
const speak=t=>t.replaceAll('OMERTÀ','Oh-MAIR-tah').replaceAll('OMR','O M R').replaceAll('RWA','R W A').replaceAll('NFTs','N F Tees');
const chapters=groups.map(([from,to],i)=>({id:`SOUL-CH${String(i+1).padStart(2,'0')}`,beats:narration.slice(from,to).map((text,j)=>({id:`M04-B${String(from+j+1).padStart(2,'0')}`,text,spoken:speak(text)}))}));
fs.writeFileSync(`${here}/narrative-map.json`,JSON.stringify({voiceChoice:'A',voiceId:voice,chapterGapSeconds:0.25,chapters},null,2)+'\n');
const jobs=chapters.map(ch=>({id:ch.id,model:'fal-ai/minimax/speech-2.8-hd',folder:'audio',ext:'mp3',input:{prompt:ch.beats.map(b=>b.spoken).join(' '),voice_setting:{voice_id:voice,speed:1,pitch:0,vol:1,english_normalization:false},audio_setting:{sample_rate:44100,bitrate:256000,format:'mp3',channel:1},output_format:'url'}}));
fs.writeFileSync(`${here}/generation-requests/film-voice.json`,JSON.stringify(jobs,null,2)+'\n');
const shots=[
 ['city','Slow cinematic dolly forward from behind the man toward the harbor. His coat moves slightly in the cool wind; one hand settles naturally on the parapet. Distant harbor lamps shimmer on wet roofs. Quiet restrained human movement; preserve his silhouette and the original composition.'],
 ['vault','Slow lateral tracking shot past the patinated locking wheels toward the nearly empty vault interior. A narrow shaft of warm light drifts across worn brass. Dust in the air. All geometry and inventory remain fixed and believable; the steel door does not morph.'],
 ['harbor','Slow low dolly forward along the wet harbor, ripples move naturally on dark water, sea mist drifts gently and warm warehouse lights reflect. The ropes and moored vessel remain physically stable.'],
 ['family','An intimate restrained dolly in toward the table. The adult nearest camera slowly passes the sealed plain envelope across the table; another adult receives it with one natural hand movement. Others barely shift and breathe. Preserve natural anatomy, no dialogue, no lip-sync.']
];
const motion=shots.map(([id,action])=>({id:`SOUL-MOTION-${id}`,model:'bytedance/seedance-2.5/image-to-video',folder:'clips',ext:'mp4',input:{prompt:`Single continuous 8-second vertical cinematic shot. ${action} Retain the reference image's rich amber practical light, deep olive shadows, burgundy details, tactile 35mm grain and organic chiaroscuro. Understated film scene, not an advertisement pose. No cuts, no graphics, no captions, no logos, no new objects, no sudden zoom, no exaggerated action, no cartoon movement.`,image_url:ledger.jobs[`SOUL-PLATE-${id}`].url,duration:'8',resolution:'720p',aspect_ratio:'auto',generate_audio:false,bitrate_mode:'high',codec:'H264'}}));
fs.writeFileSync(`${here}/generation-requests/motion.json`,JSON.stringify(motion,null,2)+'\n');
console.log(JSON.stringify({voice:'A',chapters:7,spokenWords:jobs.reduce((n,j)=>n+j.input.prompt.split(/\s+/).length,0),shots:motion.length}));
