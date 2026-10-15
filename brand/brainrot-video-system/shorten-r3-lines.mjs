import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const p=path.join(here,'production-source.json');const d=JSON.parse(fs.readFileSync(p,'utf8'));
const fixes=[['01',15,'Shipment diverted.'],['02',9,"Cash. OMR’s different."],['02',10,'Sell some OMR.'],['02',19,'Principal stays protocol-owned.'],['03',6,'Foundry copy matches.'],['03',7,'Two screenshots. Solved.'],['03',12,'Form the operation.']];
const originals=JSON.parse(fs.readFileSync(path.join(here,'generation-requests/dialogue.json'),'utf8'));
const jobs=[];
for(const [film,line,speech] of fixes){const f=d.films.find(f=>f.id===film);const b=f.timeline[line-1];b.speech=speech;b.caption=speech;const id=`R3-V${Number(film)}-L${String(line).padStart(2,'0')}`;const original=originals.find(j=>j.id===id);jobs.push({...original,id:`${id}-v2`,input:{...original.input,text:speech.replace(/OMR/g,'O M R'),voice_setting:{...original.input.voice_setting,speed:1.22}}});}
for(const f of d.films)for(const s of f.shots){const bs=f.timeline.filter(b=>b.asset===s.id);s.dialogue=bs.map(b=>b.speech).join(' / ');s.caption=bs.map(b=>b.caption).join(' / ');}
fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
fs.writeFileSync(path.join(here,'generation-requests/dialogue-v2.json'),JSON.stringify(jobs,null,2)+'\n');
console.log('Seven shorter line requests prepared, factual meaning preserved.');
