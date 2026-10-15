// Credential is process-only. The ledger contains public prompts/results, never headers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {characters} from './revision-3-look.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const out=path.join(root,'public/art/brainrot-r3');
fs.mkdirSync(out,{recursive:true});
const ledgerPath=path.join(out,'generation-ledger.json');
const ledger=fs.existsSync(ledgerPath)?JSON.parse(fs.readFileSync(ledgerPath,'utf8')):{version:3,jobs:{},catalog:[]};
const key=process.env.FAL_KEY?.trim();
delete process.env.FAL_KEY;
if(!key)throw new Error('Process credential required');
const save=()=>fs.writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
const safeHost=url=>{const u=new URL(url);if(u.protocol!=='https:'||!['queue.fal.run','fal.run','api.fal.ai'].includes(u.hostname))throw new Error('Unexpected API host');return u.href;};
async function api(url,method='GET',body){const r=await fetch(safeHost(url),{method,headers:{Authorization:`Key ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});const txt=await r.text();let data;try{data=JSON.parse(txt);}catch{data={message:txt.slice(0,300)}};if(!r.ok){const e=new Error(`fal HTTP ${r.status}: ${JSON.stringify(data).slice(0,1000).replaceAll(key,'[redacted]')}`);e.status=r.status;throw e;}return data;}
async function submit(id,model,input,folder,ext){
 if(ledger.jobs[id]){console.log(`${id}: existing ${ledger.jobs[id].status}; not resubmitted`);return;}
 ledger.jobs[id]={id,model,input,folder,ext,status:'submitting',submittedAt:new Date().toISOString()};save();
 try{const r=await api(`https://queue.fal.run/${model}`,'POST',input);Object.assign(ledger.jobs[id],r,{status:'queued'});save();console.log(`${id}: queued ${r.request_id}`);}
 catch(e){ledger.jobs[id].status=e.status?'rejected':'submission-uncertain';ledger.jobs[id].error=e.message;save();throw e;}
}
async function collect(){
 for(const j of Object.values(ledger.jobs)){
  if(j.status==='downloaded'||j.status==='rejected'||j.status==='failed'||j.status==='submission-uncertain')continue;
  if(!j.status_url){console.log(`${j.id}: missing status URL; reconcile manually`);continue;}
  try{const s=await api(j.status_url);j.queueState=s.status;save();if(s.status!=='COMPLETED'){console.log(`${j.id}: ${s.status}`);continue;}
   const r=await api(j.response_url);j.result=r;j.status='generated';save();const media=r.images?.[0]||r.video||r.audio;const url=media?.url||r.audio_url;if(!url){console.log(`${j.id}: no media; inspect ledger`);continue;}
   const u=new URL(url);if(u.protocol!=='https:'||!(u.hostname.endsWith('.fal.media')||u.hostname.endsWith('.fal.ai')||u.hostname==='fal.media'))throw new Error('Unexpected media host');
   const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error(`Media HTTP ${response.status}`);const bytes=Buffer.from(await response.arrayBuffer());const dir=path.join(out,j.folder);fs.mkdirSync(dir,{recursive:true});const dest=path.join(dir,`${j.id}.${j.ext}`);fs.writeFileSync(dest,bytes);Object.assign(j,{status:'downloaded',url,src:`art/brainrot-r3/${j.folder}/${j.id}.${j.ext}`,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});save();console.log(`${j.id}: downloaded ${bytes.length} bytes`);
  }catch(e){if(e.status===422){j.status='failed';j.error=e.message;save();}console.log(`${j.id}: ${e.message.slice(0,280)}`);}
 }
}
async function command(line){
 const [cmd,...args]=line.trim().split(/\s+/);
 if(cmd==='exit'){process.exit(0);}
 if(cmd==='catalog'){for(const term of args.length?args:['seedance','seedream','h3','flux-3']){try{const result=await api(`https://api.fal.ai/v1/models?q=${encodeURIComponent(term)}&limit=10`);ledger.catalog.push({term,at:new Date().toISOString(),result});save();console.log(JSON.stringify({term,models:result.models?.map(m=>({id:m.endpoint_id,status:m.metadata?.status}))}));}catch(e){console.log(e.message);}}return;}
 if(cmd==='pricing'){for(const endpoint of args.length?args:['bytedance/seedream/v5/pro/text-to-image','bytedance/seedream/v5/pro/edit','bytedance/seedance-2.5/image-to-video']){try{const result=await api(`https://api.fal.ai/v1/models/pricing?endpoint_id=${encodeURIComponent(endpoint)}`);ledger.catalog.push({pricing:endpoint,at:new Date().toISOString(),result});save();console.log(JSON.stringify({endpoint,result}));}catch(e){console.log(e.message);}}return;}
 if(cmd==='refs'){for(const c of characters)await submit(c.id,c.model,{prompt:c.prompt,...c.settings},'refs','png');return;}
 if(cmd==='collect'){await collect();return;}
 if(cmd==='status'){console.log(JSON.stringify(Object.values(ledger.jobs).map(({id,status,queueState})=>({id,status,queueState}))));return;}
 if(cmd==='billing'){
  const ids=Object.values(ledger.jobs).map(j=>j.request_id).filter(Boolean);const events=[];
  for(let i=0;i<ids.length;i+=50){const q=new URLSearchParams({request_id:ids.slice(i,i+50).join(','),limit:'1000',start:ledger.jobs[Object.keys(ledger.jobs)[0]].submittedAt});const r=await api(`https://api.fal.ai/v1/models/billing-events?${q}`);events.push(...r.billing_events);}
  const known=new Set(ids);ledger.billing={checkedAt:new Date().toISOString(),events:events.filter(e=>known.has(e.request_id))};ledger.billing.totalUsd=ledger.billing.events.reduce((n,e)=>n+Number(e.cost_total),0);save();console.log(JSON.stringify({matchedRequests:ledger.billing.events.length,totalRequests:ids.length,totalUsd:ledger.billing.totalUsd}));return;
 }
 if(cmd==='batch'){
  const requestsDir=path.join(here,'generation-requests');const file=path.resolve(requestsDir,args[0]||'');if(!file.startsWith(requestsDir+path.sep))throw new Error('Request file outside allowed directory');const jobs=JSON.parse(fs.readFileSync(file,'utf8'));if(!Array.isArray(jobs)||jobs.length>80)throw new Error('Invalid bounded batch');
  for(const j of jobs){if(!/^[A-Za-z0-9-]+$/.test(j.id)||!['refs','frames','clips','audio','voice-design'].includes(j.folder)||!['png','mp4','mp3'].includes(j.ext))throw new Error('Invalid output destination');await submit(j.id,j.model,j.input,j.folder,j.ext);}return;
 }
 if(cmd==='frames'){
  const d=JSON.parse(fs.readFileSync(path.join(here,'production-data.json'),'utf8'));const shots=d.films.flatMap(f=>f.shots);const selected=args[0]==='all'?shots:shots.filter(s=>args.includes(s.id));
  if(!selected.length)throw new Error('No matching shots');
  for(const s of selected){const refs=characters.filter(c=>s.characters.includes(c.id)).map(c=>ledger.jobs[c.id]?.url);if(refs.some(x=>!x))throw new Error(`${s.id}: character refs missing`);await submit(`${s.id}-first`,'bytedance/seedream/v5/pro/edit',{prompt:s.firstFramePrompt,image_urls:refs.length?refs:[ledger.jobs['R3-C01'].url],image_size:{width:1080,height:1920},num_images:1,output_format:'png',enable_safety_checker:true},'frames','png');}return;
 }
 if(cmd==='motion'){
  const d=JSON.parse(fs.readFileSync(path.join(here,'production-data.json'),'utf8'));for(const id of args){const sourceId=id.replace(/-take\d+$/,'');const s=d.films.flatMap(f=>f.shots).find(s=>s.id===sourceId);if(!s)throw new Error(`Unknown shot ${id}`);const first=ledger.jobs[`${sourceId}-first`];if(first?.status!=='downloaded')throw new Error('First frame not downloaded');await submit(id,s.model,{prompt:s.generationPrompt,image_url:first.url,duration:'5',aspect_ratio:'auto',resolution:'720p',generate_audio:false,bitrate_mode:'high',codec:'H264'},'clips','mp4');}return;
 }
 throw new Error('Unknown command');
}
console.log('fal session ready; credential retained only in this process');
const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
for await(const line of lines){if(!line.trim())continue;try{await command(line);}catch(e){console.log(`STOP: ${e.message.replaceAll(key,'[redacted]')}`);}console.log('READY');}
