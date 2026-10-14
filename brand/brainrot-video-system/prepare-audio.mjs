import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {characters} from './revision-3-look.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const dest=path.join(root,'generation-requests');fs.mkdirSync(dest,{recursive:true});
const d=JSON.parse(fs.readFileSync(path.join(root,'production-data.json'),'utf8'));
const previews=["This key needs four people? I bought some cargo. Where's my cargo?",'You wanted a mafia game. Find the rat. Oh mare tah.','Two independent sources. Disclosure, not guilt. His. You cannot read it.','Pickup only. Ambushed. The principal stays protocol owned.'];
const jobs=characters.map((c,i)=>({id:`${c.id}-voice`,model:'fal-ai/minimax/voice-design',input:{prompt:`An original fictional adult character, speaking natural conversational English with a neutral American accent. ${c.voice} Short fast spoken dialogue with understated comic timing. Close dry recording, no music, no announcer tone, no impersonation or resemblance to any named person.`,preview_text:previews[i]},folder:'voice-design',ext:'mp3'}));
fs.writeFileSync(path.join(dest,'voice-design.json'),JSON.stringify(jobs,null,2)+'\n');
const ledgerFile=path.resolve(root,'../../public/art/brainrot-r3/generation-ledger.json');
const ledger=JSON.parse(fs.readFileSync(ledgerFile,'utf8'));
if(characters.every(c=>ledger.jobs[`${c.id}-voice`]?.result?.custom_voice_id)){
 const voices=Object.fromEntries(characters.map(c=>[c.name,ledger.jobs[`${c.id}-voice`].result.custom_voice_id]));
 const speech=d.films.flatMap(f=>f.timeline.map((b,i)=>({id:`R3-V${Number(f.id)}-L${String(i+1).padStart(2,'0')}`,model:'fal-ai/minimax/speech-02-hd',input:{text:b.speech.replace(/OMERTÀ/g,'Oh mare tah').replace(/OMR/g,'O M R').replace('…',', '),voice_setting:{voice_id:voices[b.speaker],speed:1.15,pitch:0,vol:1,english_normalization:false},audio_setting:{sample_rate:44100,bitrate:256000,format:'mp3',channel:1},output_format:'url'},folder:'audio',ext:'mp3'})));
 fs.writeFileSync(path.join(dest,'dialogue.json'),JSON.stringify(speech,null,2)+'\n');console.log(`Prepared ${speech.length} dialogue requests using four new voice IDs.`);
}else console.log('Prepared four original voice designs; dialogue waits for generated voice IDs.');
