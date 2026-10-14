import fs from 'node:fs';
const here='brand/market-v2-soul',assets='public/art/market-v2-soul';
const narrative=JSON.parse(fs.readFileSync(`${here}/narrative-map.json`));
const ledger=JSON.parse(fs.readFileSync(`${assets}/generation-ledger.json`));
const jobs=narrative.chapters.map(ch=>{
 const j=ledger.jobs[ch.sourceId||ch.id];if(j?.status!=='downloaded')throw Error('Selected voice chapter not ready: '+ch.id);
 return{id:ch.id+'-ALIGN-v2',model:'fal-ai/elevenlabs/forced-alignment',folder:'alignment',ext:'json',input:{audio_url:j.url,text:ch.beats.map(b=>b.spoken).join(' ')}};
});
fs.writeFileSync(`${here}/generation-requests/alignment.json`,JSON.stringify(jobs,null,2)+'\n');
console.log('Seven selected chapter alignments prepared.');
