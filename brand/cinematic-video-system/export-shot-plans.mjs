import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),here=path.join(root,'brand/cinematic-video-system');
const data=JSON.parse(fs.readFileSync(path.join(here,'production-data.json'),'utf8'));
const ledger=JSON.parse(fs.readFileSync(path.join(root,'public/art/cinematic-r4/generation-ledger.json'),'utf8'));
const audio=JSON.parse(fs.readFileSync(path.join(root,'public/art/cinematic-r4/audio/audio-report.json'),'utf8'));
const matrix=JSON.parse(fs.readFileSync(path.join(here,'coverage.json'),'utf8'));
const rows=[];
for(const film of data.films){
 const filmAudio=audio.films.find(f=>f.id===film.id);
 for(const [i,beat] of film.beats.entries()){
  const line=filmAudio.lines[i],take=path.basename(line.source,'.mp3'),job=ledger.jobs[take];
  if(line.text!==beat.narration||Math.abs(line.start-beat.start)>0.001||Math.abs(line.end-beat.end)>0.001)throw Error('Audio/editorial mismatch '+beat.id);
  const refs=(beat.screens?.length?beat.screens:[beat.screen]).map(id=>`public/art/cinematic-r4/captures/${id}.png`);
  rows.push({film:film.id,shot:beat.id,start:beat.start,end:beat.end,duration:beat.end-beat.start,purpose:beat.headline.replaceAll('\n',' '),visual:beat.kind==='flow'?`Labeled editorial diagram: ${beat.flow.join(' | ')}`:beat.kind==='end'?'OMERTÀ wordmark and short CTA over genuine source image':`Actual local game UI: ${beat.screens?.join(' → ')||beat.screen}`,character:'Synthetic local preview account; no generated actor',action:beat.narration,environment:beat.kind==='flow'?'Editorial explanation of full-release system':'Real repository game interface',camera:`${beat.transition} entrance; ${beat.screens?.length?'each capture receives a separate slow pan':'slow pan / push-in'}; focus ${JSON.stringify(beat.focus)}`,lighting:`Preserve source art; black and ivory with ${film.accent} accent`,audio:`Original film ${film.id} score and transition SFX; see audio-plan.md`,dialogue:beat.narration,caption:beat.caption,uiOverlay:beat.tags.join(' · '),transition:beat.transition,falModel:job.model,generationPrompt:job.input.text,generationSettings:job.input,negativePrompt:null,failureConditions:'Reject cut-off speech, changed words, missing source UI, invented controls, crossed custody paths, illegible essential labels, unverified launch claims or copyrighted third-party meme assets. No synthetic video prompt is used.',referenceAssetsRequired:refs,selectedNarrationAsset:line.source,evidence:beat.factIds.map(id=>matrix.mechanics.find(m=>m.id===id))});
 }
}
fs.writeFileSync(path.join(here,'shot-plans.json'),JSON.stringify(rows,null,2)+'\n');
const headers=['film','shot','start','end','duration','purpose','visual','character','action','environment','camera','lighting','audio','dialogue','caption','uiOverlay','transition','falModel','generationPrompt','failureConditions','referenceAssetsRequired'];
const q=v=>'"'+String(Array.isArray(v)?v.join(' | '):v??'').replaceAll('"','""')+'"';
fs.writeFileSync(path.join(here,'shot-plans.csv'),'\ufeff'+headers.join(',')+'\r\n'+rows.map(r=>headers.map(k=>q(r[k])).join(',')).join('\r\n'));
console.log(JSON.stringify({shots:rows.length,verifiedAudioScriptMatches:true,downloadedFalRequests:Object.values(ledger.jobs).filter(j=>j.status==='downloaded').length}));
