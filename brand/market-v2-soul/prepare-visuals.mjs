import fs from 'node:fs';
import path from 'node:path';
const here=path.resolve('brand/market-v2-soul'),out=path.resolve('public/art/market-v2-soul');
fs.mkdirSync(path.join(out,'captures'),{recursive:true});
const manifest=JSON.parse(fs.readFileSync('public/art/market-v2-film/manifest.json'));
delete manifest.audio; manifest.plates={};
for(const c of Object.values(manifest.captures)){const old=c.src;c.src=old.replace('market-v2-film','market-v2-soul');fs.copyFileSync(path.join('public',old),path.join('public',c.src));}
const style='Original cinematic crime-drama editorial photograph, vertical 9:16, tactile 35mm motion-picture negative, very fine organic grain, rich warm amber practical light, deep olive shadows, burgundy accents, controlled blacks with visible texture, beautiful realistic chiaroscuro, restrained halation, shallow depth of field. Premium photographed atmosphere with imperfect lived-in surfaces, emotionally evocative. NOT an illustration, NOT a 3D render, NOT cyberpunk. No text, logos, lettering, watermarks, charts, numbers, borders, split screens or celebrity resemblance. Keep the center-left shadow area uncluttered enough for later editorial compositing; photograph itself fills every edge. ';
const subjects=[
 ['city','A rain-dark waterfront city at blue hour seen from the roof of an old private club. In the foreground, a lone adult man in a beautifully worn dark wool suit stands in three-quarter back view, small in frame, looking over docks and old warehouses. Warm window light grazes his hand on a stone parapet. Towering wet urban depth, subtle fog, a few amber windows, no futuristic buildings. 50mm lens, slightly low camera. Quiet ambition, human scale, not a superhero pose.'],
 ['reserves','Extreme tactile close-up of unmarked brass counters and dark oxblood gaming chips on a worn green felt table, a few short finite stacks and an almost empty open leather case. One adult hand has just slid a stack away, motion implied but fingers anatomically correct. Raking amber lamp light, dramatic shadows, intimate low 85mm macro angle. Make depletion feel physical and precious, no readable denominations, no currency symbols.'],
 ['vault','The open throat of an old steel bank vault, heavy patinated brass locking wheels and polished worn steel bolts foreground right. Dim shelves hold only a few unmarked linen inventory bags. Warm light spills across a black marble threshold from an unseen door. Rich metallic material detail, low 40mm angle, cinematic deliberate negative space left. A place with real limits, not piles of gold or a fantasy treasury.'],
 ['harbor','An old commercial harbor at dawn, wet cobblestones and mooring ropes close to camera, a single warehouse window glowing honey amber through sea mist. Dark cargo cranes and a freighter create layered silhouettes. Deep olive water reflects burnt-orange light. Moody beautifully photographed working city, 50mm film lens, no people close to camera, no readable company markings.'],
 ['ledger','Close-up of an adult hand in a charcoal wool suit resting beside an open aged ledger and a mechanical desk calculator on a walnut table. Blank unmarked paper, no readable writing or numbers. A green banker lamp grazes paper fibers and worn brass edges. Heavy burgundy curtain soft in background. Off-center diagonal composition, 75mm lens, a human presence and atmosphere of careful decisions.'],
 ['family','After-hours private dining room in an old Italian-American social club, four original fictional adults in dark tailored coats sit around a small round table, mostly seen as natural three-quarter silhouettes with faces not prominent. One passes a plain sealed cream envelope across the table. Warm tungsten pool of light, olive velvet upholstery and burgundy walls, half-finished espresso, intimate solemn camaraderie. Wide 40mm low angle, no guns, no brands, no readable text.']
];
const jobs=subjects.map(([id,subject])=>({id:'SOUL-PLATE-'+id,model:'bytedance/seedream/v5/pro/text-to-image',folder:'frames',ext:'png',input:{prompt:style+subject,image_size:{width:1080,height:1920},num_images:1,output_format:'png',enable_safety_checker:true}}));
for(const [id] of subjects)manifest.plates[id]={src:`art/market-v2-soul/frames/SOUL-PLATE-${id}.png`,width:1080,height:1920,type:'image',provenance:'Generated original editorial atmosphere; not game footage.'};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const data=JSON.parse(fs.readFileSync('brand/market-v2-film/production-data.json')); delete data.film.captions; data.film.title='MARKET V2 — CONTROL COSTS'; data.revision='Soul visual draft; voice selection pending';
for(const [i,b] of data.film.beats.entries()){
 b.plate=i===0||i===32?'city':i<7?'reserves':i<13?'vault':i<18?'harbor':i<24?'ledger':i<29?'family':'city';
 b.layout=['hero','end'].includes(b.kind)?'cinema':b.kind==='capture'?'capture':'diagram';
}
fs.writeFileSync(path.join(here,'production-data.json'),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(here,'generation-requests/plates.json'),JSON.stringify(jobs,null,2)+'\n');
console.log('Six fresh cinema plates planned; isolated visual draft prepared.');
