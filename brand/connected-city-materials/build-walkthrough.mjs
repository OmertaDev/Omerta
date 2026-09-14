import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(root,'../hype-flywheel-video');
const media=path.resolve(root,'../../public/art/marketing-walkthrough');
fs.mkdirSync(media,{recursive:true});
const evidence=JSON.parse(fs.readFileSync(path.join(root,'walkthrough/evidence.json'),'utf8'));
const record=title=>evidence.records.find(r=>r.title===title);
const scenes=[
 {title:'Inside the implementation.',label:'A REAL LOCAL API DEMONSTRATION',text:'This is Omerta running locally, with synthetic accounts and real API handlers. We will salvage a wreck, craft a material, and complete a shared investigation.',display:{environment:'Real repository handlers / pg-mem',accounts:'Synthetic demonstration accounts',capture:evidence.capturedAt,productionTransactions:0}},
 {title:'The wreck becomes material.',label:'WORLD GRAPH / SALVAGE',text:'The World Graph records the change. This salvage recipe consumes one wreck and produces six scrap steel, two wire, and two salvage parts.',record:'Materials after salvage',display:record('Materials after salvage').body},
 {title:'Inputs become an output.',label:'WORLD GRAPH / CRAFTING',text:'Crafting hardened steel consumes four scrap steel and three hundred in game cash. The resulting inventory holds one hardened steel and two remaining scrap steel.',record:'Inventory after crafting',display:record('Inventory after crafting').body},
 {title:'Two original sources.',label:'COORDINATION / INDEPENDENT DISCOVERY',text:'Two investigators uncover different original sources: the Docks manifest and the Foundry impression. Independence belongs to the source. Copying a discovery cannot create another one.',display:{sources:['docks.manifest','foundry.impression'],originalDiscoverers:2,demonstration:'Two separate synthetic accounts'}},
 {title:'Share the missing piece.',label:'COORDINATION / DELIBERATE SHARING',text:'The second investigator shares the Foundry evidence. The first account can now see both sources. The engine checks access before using that evidence to unlock the next step.',record:'Both sources visible',display:{claims:record('Both sources visible').body.claims?.map(c=>({source:c.source,owned:c.owned}))??record('Both sources visible').body}},
 {title:'The ledger is complete.',label:'COORDINATION / CORROBORATED CONCLUSION',text:'The real response now marks the Split Ledger completed. Two original discoverers and two surviving sources support one corroborated account. This pilot pays no reward.',record:'Investigation result',display:{graphId:record('Investigation result').body.graphId,status:record('Investigation result').body.status,revision:record('Investigation result').body.revision,actions:record('Investigation result').body.actions}},
 {title:'Built. Next. Clearly marked.',label:'THE CONNECTED CITY / AVAILABILITY',text:'World Graph phase one is implemented. Coordination pilots are default off. Market version two remains an implementation candidate, not deployed or funded. Explore the connected city at omerta dot fun.',display:{worldGraph:'Phase 1 implemented',coordination:'Phases 00–01 / default-off API pilots',marketV2:'Candidate / not deployed or funded',explore:'www.omerta.fun'}}
];
const probe=path.join(project,'node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe');
for(const [i,s] of scenes.entries()){
 const dest=path.join(media,`voice-${i}.mp3`);
 if(!fs.existsSync(dest)){
  if(!process.env.FAL_KEY)throw new Error('FAL_KEY is required in this process');
  const response=await fetch('https://fal.run/fal-ai/minimax/speech-02-hd',{method:'POST',headers:{Authorization:`Key ${process.env.FAL_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({text:s.text,voice_setting:{voice_id:'Deep_Voice_Man',speed:1.05,pitch:0,vol:1,english_normalization:false},audio_setting:{sample_rate:44100,bitrate:256000,format:'mp3',channel:1},output_format:'url'}),signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`TTS returned HTTP ${response.status}`);
  const result=await response.json();
  const audio=await fetch(result.audio.url);
  if(!audio.ok)throw new Error('Audio retrieval failed');
  fs.writeFileSync(dest,Buffer.from(await audio.arrayBuffer()));
 }
 s.frames=Math.ceil((Number(execFileSync(probe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',dest],{encoding:'utf8'}))+0.7)*30);
 if(s.record){const r=record(s.record);s.endpoint=`${r.method} ${r.url} · HTTP ${r.status}`;}
 console.log(`Narration ${i+1}/${scenes.length} ready`);
}
scenes[4].display={sources:scenes[4].display.claims.map(c=>c.source.root+' / owned: '+c.owned)};
fs.writeFileSync(path.join(project,'src/marketing-extension/walkthrough-data.json'),JSON.stringify(scenes,null,2));
fs.writeFileSync(path.join(root,'walkthrough/transcript.txt'),scenes.map(s=>`${s.title}\n${s.text}`).join('\n\n'));
let elapsed=0;const stamp=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
const cues=scenes.map(s=>{const start=elapsed;elapsed+=s.frames/30;return `${stamp(start)} --> ${stamp(elapsed)}\n${s.text}`;});
fs.writeFileSync(path.join(root,'walkthrough/Inside-Omerta.vtt'),'WEBVTT\n\n'+cues.join('\n\n'));
