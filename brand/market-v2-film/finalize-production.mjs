import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),here=path.join(root,'brand/market-v2-film'),assets=path.join(root,'public/art/market-v2-film'),out=path.join(root,'output/market-v2-film');
const dataPath=path.join(here,'production-data.json'),data=JSON.parse(fs.readFileSync(dataPath,'utf8'));
const caption=JSON.parse(fs.readFileSync(path.join(assets,'audio/04-captions.json'),'utf8'));
const audio=JSON.parse(fs.readFileSync(path.join(assets,'audio/audio-report.json'),'utf8'));
const report=(audio.films||[]).find(f=>f.id==='04')||audio.film;
if(!report||report.status!=='mixed-verified')throw Error('Audio mix must be verified before finalization.');
const film=data.film;
for(let i=0;i<film.beats.length;i++){
 const a=report.lines[i],b=film.beats[i];if(a.text!==b.narration||Math.abs(a.start-b.start)>.001||Math.abs(a.end-b.end)>.001)throw Error('Audio/editorial mismatch '+b.id);
}
film.captions=caption.lines.map(c=>({text:c.text,startMs:c.start*1000,endMs:c.end*1000,timestampMs:null,confidence:null}));film.captionTiming=caption.timing;
fs.writeFileSync(dataPath,JSON.stringify(data,null,2)+'\n');
const manifestPath=path.join(assets,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));manifest.audio={src:'art/market-v2-film/audio/04-mix.wav'};fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
fs.mkdirSync(out,{recursive:true});
const time=s=>{const m=Math.round(s*1000);return `${String(Math.floor(m/3600000)).padStart(2,'0')}:${String(Math.floor(m/60000)%60).padStart(2,'0')}:${String(Math.floor(m/1000)%60).padStart(2,'0')}.${String(m%1000).padStart(3,'0')}`;};
fs.writeFileSync(path.join(out,'Market-V2-captions.vtt'),'WEBVTT\n\n'+caption.lines.map(c=>`${time(c.start)} --> ${time(c.end)}\n${c.text}\n`).join('\n'));
const ledger=JSON.parse(fs.readFileSync(path.join(assets,'generation-ledger.json'),'utf8'));
const shots=film.beats.map((b,i)=>{const a=report.lines[i],j=ledger.jobs[path.basename(a.source,'.mp3')];return{...b,duration:b.end-b.start,purpose:b.headline.replaceAll('\n',' '),visual:`${b.kind} / ${b.state}: ${b.nodes.join(' | ')}`,character:'No synthetic actor; genuine game account UI where shown',camera:'Animated inventory diagram with restrained pans, scope/spin transitions and readable holds',lighting:'Black and ivory with copper and ink-blue accents',audio:'Original mechanical-noir score; see audio-plan.md',caption:b.narration,falModel:j.model,generationPrompt:j.input.prompt||j.input.text,generationSettings:j.input,selectedAudio:a.source,referenceAssets:b.screen?[manifest.captures[b.screen].src]:[],failureConditions:'No invented prices or balances; no guaranteed floor; no fee/principal conflation; no unrestricted game custody; no cut-off dialogue.'};});
fs.writeFileSync(path.join(here,'shot-plans.json'),JSON.stringify(shots,null,2)+'\n');
const columns=['id','start','end','duration','chapter','purpose','visual','narration','caption','camera','audio','falModel','generationPrompt','selectedAudio','failureConditions'];const q=x=>'"'+String(x??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(here,'shot-plans.csv'),'\ufeff'+columns.join(',')+'\r\n'+shots.map(s=>columns.map(k=>q(s[k])).join(',')).join('\r\n'));
console.log(JSON.stringify({duration:film.duration,shots:shots.length,captionPages:film.captions.length,allNarrationMatches:true}));
