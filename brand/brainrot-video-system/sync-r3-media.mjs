import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'../..');
const dir=path.join(root,'public/art/brainrot-r3');
const ledger=JSON.parse(fs.readFileSync(path.join(dir,'generation-ledger.json'),'utf8'));
const d=JSON.parse(fs.readFileSync(path.join(here,'production-data.json'),'utf8'));
const selectedFile=path.join(dir,'selections.json');
const selections=fs.existsSync(selectedFile)?JSON.parse(fs.readFileSync(selectedFile,'utf8')):{};
const target=path.join(dir,'manifest.json');const manifest=JSON.parse(fs.readFileSync(target,'utf8'));
const probe=path.join(root,'brand/hype-flywheel-video/node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe');
const measure=src=>Number(execFileSync(probe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',path.join(root,'public',src)],{encoding:'utf8',windowsHide:true}).trim());
for(const f of d.films){
 for(const s of f.shots){
  const j=selections[s.id]?ledger.jobs[selections[s.id]]:null;
  const first=ledger.jobs[`${s.id}-poly-first-v2`]?.status==='downloaded'?ledger.jobs[`${s.id}-poly-first-v2`]:ledger.jobs[`${s.id}-poly-first`];
  if(j?.status==='downloaded'&&j.ext==='mp4'){manifest.assets[s.id]={src:j.src,kind:'video',duration:measure(j.src),muted:true,requestId:j.request_id,sha256:j.sha256};}
  else if(first?.status==='downloaded'){manifest.assets[s.id]={src:first.src,kind:'image',duration:5,muted:true,status:'draft-first-frame',requestId:first.request_id,sha256:first.sha256};}
 }
 const mix=`art/brainrot-r3/audio/R3-V${Number(f.id)}-mix.wav`;
 if(fs.existsSync(path.join(root,'public',mix)))manifest.audio[f.id]={src:mix};
}
manifest.status='internal-production-draft';manifest.actualCostUsd=ledger.billing?.totalUsd??null;
manifest.captureStatus='Release UI capture slots remain pending; editorial graphics are not gameplay recordings.';
fs.writeFileSync(target,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({selectedMotion:Object.values(manifest.assets).filter(a=>a.kind==='video').length,firstFrames:Object.values(manifest.assets).filter(a=>a.kind==='image').length,audioFilms:Object.keys(manifest.audio).length}));
