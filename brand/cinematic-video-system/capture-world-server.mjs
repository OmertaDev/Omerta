// Disposable capture fixture. Actual application/services, no mocked gameplay responses.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
if(process.env.DATABASE_URL || process.env.NODE_ENV==='production') throw new Error('Local memory fixture only.');
process.env.COORDINATION_ENGINE='on';
process.env.COORDINATION_KNOWLEDGE='on';
process.env.COORDINATION_KNOWLEDGE_SHARING='on';
process.env.COORDINATION_ACCOUNT_IDS='cinematic-world-a,cinematic-world-b,cinematic-world-c';
process.env.SEASON_PHASE='opening';
process.env.RATE_LIMIT='off';
process.env.CHAIN_RPC_URL='http://127.0.0.1:1';
process.env.DEFI_RPC_URL='http://127.0.0.1:1';
const {buildServer}=await import('../../src/server.js');
const {compileContentPack}=await import('../../src/content/compiler.js');
const {activateContentBundle}=await import('../../src/content/runtime.js');
const {SCOPES}=await import('../../src/gateway/security.js');
const app=await buildServer();
const here=path.dirname(fileURLToPath(import.meta.url));
const people={mara:'cinematic-world-a',luca:'cinematic-world-b',nina:'cinematic-world-c'};
const tokens=new Map(),delegates=new Map(),records=[],packs=new Map();
const capture={createdAt:new Date().toISOString(),sourceHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),environment:'Actual dirty-checkout OMERTA UI and production handlers, disposable pg-mem fixture, loopback only',fixtureSeed:'Synthetic identities, balances, eligible location and owned junker cars; seeded memberships. Case progress, knowledge grants, crafting and proposals use actual game services/HTTP routes.',limits:['No production activation or real-player session claimed.','No external AI provider or external RPC called; adviser capabilities are invoked deterministically by fixture orchestration.','Authored case choices and knowledge receipts are actual persisted local service outcomes, not proof that the newer main-branch Living World Director/Campaign Network is integrated here.','All wallet/token/NFT/RWA settlement is excluded; no real wallets or financial transactions.','Puzzle answers used by the fixture come from source-controlled author definitions and are not exposed as adviser knowledge.'],panels:{},records};
const clean=(v)=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['token','nonce','digest','authorization','secret','credential'].includes(k.toLowerCase())).map(([k,x])=>[k,clean(x)])):v;
const save=()=>fs.writeFileSync(path.join(here,'capture-world-evidence.json'),JSON.stringify(clean(capture),null,2)+'\n');
let pendingArgs=null;
const bootstrap=(token,url)=>`<!doctype html><meta charset="utf-8"><title>Local capture session</title><p>Opening disposable OMERTÀ fixture.</p><script>localStorage.setItem('omerta_token',${JSON.stringify(token)});localStorage.setItem('omerta_sfx','off');location.replace(${JSON.stringify(url)});</script>`;
// All routes register before the first app.inject (Fastify finalizes routes at readiness).
app.get('/capture-session/:person',async(req,reply)=>{
  const who=people[req.params.person];if(!who)return reply.code(404).send('Unknown fixture');
  reply.type('text/html').header('Cache-Control','no-store');
  return bootstrap(tokens.get(who),'/');
});
app.get('/capture-consigliere/:person',async(req,reply)=>{
  const who=people[req.params.person];if(!who)return reply.code(404).send('Unknown fixture');
  reply.type('text/html').header('Cache-Control','no-store');
  let target='/consigliere';
  if(who===people.mara && pendingArgs){
    // Each visit stages a fresh proposal through the real gateway; nothing executes here.
    const p=await gateway(who,'respond_to_coordination_request',pendingArgs);
    if(p.data?.confirmationUrl)target=p.data.confirmationUrl;
    capture.panels.latestPendingConfirmation=target;save();
  }
  return bootstrap(tokens.get(who),target);
});
app.get('/capture-record',async(_req,reply)=>reply.header('Cache-Control','no-store').send(clean({...capture,records:undefined})));

async function call(method,url,who=people.mara,payload,options={}){
  const r=await app.inject({method,url,...(payload===undefined?{}:{payload}),headers:{authorization:`Bearer ${options.delegated?delegates.get(who):tokens.get(who)}`,...(method==='POST'&&!url.startsWith('/v1/gateway')?{'idempotency-key':crypto.randomUUID()}: {})}});
  let body;try{body=r.json();}catch{body={message:r.body.slice(0,200)};}
  records.push({at:new Date().toISOString(),method,url,account:who,request:clean(payload),status:r.statusCode,body:clean(body)});
  if(r.statusCode>=400)throw new Error(`${method} ${url}: ${r.statusCode} ${body.error||body.message}`);
  return body;
}
const gateway=(who,capability,args={})=>call('POST','/v1/gateway/call',who,{capability,arguments:args,requestId:crypto.randomUUID()},{delegated:true});
async function stage(name,work){try{await work();records.push({stage:name,ok:true});}catch(e){records.push({stage:name,ok:false,message:e.message});console.log(JSON.stringify({stage:name,error:e.message}));}save();}
async function fixture(id,name,loc){
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'capture-fixture',$1)",[id]);
  await app.pool.query('INSERT INTO account_persistent(account_id,omr) VALUES($1,350)',[id]);
  await app.pool.query("INSERT INTO characters(id,account_id,name,loc,season,respect,cash,bank,ammo,heat,path) VALUES($1,$2,$3,$4,1,100000,250000,50000,240,18,'enforcer')",[id+'-character',id,name,loc]);
  tokens.set(id,app.jwt.sign({sub:id,tv:0}));
}
await fixture(people.mara,'Mara Voss','foundry');
await fixture(people.luca,'Luca Vale','docks');
await fixture(people.nina,'Nina Cross','foundry');
for(const name of ['foundry-furnace-ledger','two-man-rule','books-open-at-midnight','docks-missed-tide','cathedral-saints-account']){
  await stage(`activate ${name}`,async()=>{
    const source=JSON.parse(fs.readFileSync(path.join(here,'../../content/packs',name,'pack.json'),'utf8'));
    const bundle=compileContentPack(source);packs.set(name,bundle);
    const activated=await activateContentBundle(app.pool,{bundle,expectedHash:bundle.contentHash,operatorId:'local-cinematic-capture'});
    records.push({service:'activateContentBundle',pack:name,result:activated});
  });
}
await stage('organizations',async()=>{
  const crew=await call('POST','/v1/crew',people.mara,{name:'The Night Shift'});
  for(const person of ['luca','nina'])await app.pool.query('INSERT INTO crew_members(crew_id,account_id,name) VALUES($1,$2,$3)',[crew.id,people[person],person==='luca'?'Luca Vale':'Nina Cross']);
  records.push({fixture:'seed crew membership',crewId:crew.id,members:Object.values(people)});
  await call('POST','/v1/gangs',people.mara,{name:'The Voss Family',tag:'VOSS'});
});
await stage('salvage and crafting',async()=>{
  for(let i=0;i<2;i++){
    const car=crypto.randomUUID();
    await app.pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg,listed,pledged,minted_onchain,race_limit,pink_slip) VALUES($1,$2,'junker','stock',80,false,false,false,null,false)",[car,people.mara+'-character']);
    await call('POST',`/v1/worldgraph/recipes/recipe:car_salvage_basic/salvage/${car}`);
  }
  await call('POST','/v1/worldgraph/recipes/recipe:hardened_steel/craft');
  capture.panels.inventory='/v1/worldgraph/inventory';
});
const bundleNode=(bundle,id)=>bundle.nodes.find(n=>n.id===id);
async function contentAct(who,instance,action,extra={}){
  return (await call('POST',`/v1/content/instances/${instance.id}/act`,who,{expectedRevision:instance.revision,actionId:action.id,...extra})).instance;
}
async function contentStart(who,name,scopeKind='personal',roleId='investigator'){
  const bundle=packs.get(name);
  let instance=(await call('POST',`/v1/content/${bundle.namespace}/instances`,who,{scopeKind,roleId})).instance;
  const start=instance.actions.find(a=>a.kind==='start_instance');if(start)instance=await contentAct(who,instance,start);
  return instance;
}
function answer(bundle,action){const node=bundleNode(bundle,action.nodeId);return bundleNode(bundle,node.payload.answerSpecId).payload.acceptedValues[0];}
await stage('active Furnace Ledger choice',async()=>{
  let instance=await contentStart(people.mara,'foundry-furnace-ledger');
  const solve=instance.actions.find(a=>a.kind==='solve');
  instance=await contentAct(people.mara,instance,solve,{answer:answer(packs.get('foundry-furnace-ledger'),solve)});
  capture.panels.maraFurnace={instanceId:instance.id,namespace:instance.namespace,status:instance.status,actionTitles:instance.actions.map(a=>a.title||a.kind)};
});
await stage('completed Midnight case',async()=>{
  const bundle=packs.get('books-open-at-midnight');let instance=await contentStart(people.nina,'books-open-at-midnight');
  for(let i=0;i<6&&instance.status!=='completed';i++){
    const action=instance.actions[0];if(!action)break;
    const extra=action.kind==='solve'?{answer:answer(bundle,action)}:action.kind==='choose'?{choiceId:action.options.find(o=>o.available).id}:{};
    instance=await contentAct(people.nina,instance,action,extra);
  }
  await call('POST',`/v1/content/instances/${instance.id}/claim`,people.nina,{expectedRevision:instance.revision});
  capture.panels.ninaCompletedMidnight={instanceId:instance.id,status:instance.status};
});
await stage('two role Crew investigation',async()=>{
  const bundle=packs.get('two-man-rule');let instance=await contentStart(people.mara,'two-man-rule','crew','watcher');
  await call('POST',`/v1/content/instances/${instance.id}/join`,people.luca,{expectedRevision:instance.revision,roleId:'signatory'});
  instance=(await call('GET',`/v1/content/instances/${instance.id}`,people.mara)).instance;
  instance=await contentAct(people.mara,instance,instance.actions.find(a=>a.kind==='start_instance'));
  const action=instance.actions.find(a=>a.kind==='solve');
  instance=await contentAct(people.mara,instance,action,{answer:answer(bundle,action)});
  capture.panels.crewTwoManRule={instanceId:instance.id,status:instance.status,watcherCompleted:true,signatoryPending:true};
});
await stage('split ledger independent shared evidence',async()=>{
  const graph=(await call('GET','/v1/coordination')).graphs.find(g=>g.id==='omerta.coordination.split-ledger');
  const instances={};
  for(const [who,source] of [[people.mara,'foundry-source'],[people.luca,'docks-source']]){
    let v=(await call('POST',`/v1/coordination/${graph.id}/instances`,who,{expectedContentHash:graph.contentHash})).instance;
    for(let i=0;i<3;i++){
      const a=i===2?v.actions.find(x=>x.nodeId===source):v.actions[0];
      v=(await call('POST',`/v1/coordination/instances/${v.id}/act`,who,{expectedRevision:v.revision,actionId:a.id})).instance;
    }
    instances[who]=v;
  }
  const local=(await call('GET','/v1/coordination/knowledge',people.mara)).claims[0];
  const source=(await call('GET','/v1/coordination/knowledge',people.luca)).claims[0];
  const target=(await call('GET','/v1/coordination/knowledge/targets?characterName=Mara%20Voss',people.luca)).targets.find(t=>t.kind==='account');
  await call('POST',`/v1/coordination/knowledge/${source.id}/share`,people.luca,{targetId:target.id,expectedAclRevision:source.aclRevision});
  await call('POST','/v1/coordination/knowledge/archive',people.mara,{claimId:source.id});
  await call('POST','/v1/coordination/knowledge/links',people.mara,{fromClaimId:local.id,toClaimId:source.id,relation:'corroborates'});
  let v=await call('GET',`/v1/coordination/instances/${instances[people.mara].id}`,people.mara);
  if(v.instance)v=v.instance;
  // Discover the newly unlocked conclusion, preserving final execution for player approval.
  const discover=v.actions.find(a=>a.nodeId==='conclusion'&&a.kind==='discover')||v.actions[0];
  if(discover)v=(await call('POST',`/v1/coordination/instances/${v.id}/act`,people.mara,{expectedRevision:v.revision,actionId:discover.id})).instance;
  const finish=v.actions.find(a=>a.nodeId==='conclusion');
  if(finish)pendingArgs={instanceId:v.id,actionId:finish.id,expectedRevision:v.revision};
  capture.panels.splitLedger={instanceId:v.id,status:v.status,knowledgeClaims:2,sharedOriginal:true,corroborationLink:true,awaitingConfirmation:!!pendingArgs};
});
await stage('scoped adviser and confirmed preparation history',async()=>{
  const created=await call('POST','/v1/gateway/connections',people.mara,{provider:'claude',label:'OMERTÀ Consigliere',scopes:SCOPES,expiresInSeconds:604800});
  delegates.set(people.mara,created.token);
  for(const capability of ['get_player_context','get_inventory','get_crew','get_shared_discoveries','get_coordination_requests'])await gateway(people.mara,capability);
  const graph=(await call('GET','/v1/coordination')).graphs.find(g=>g.id==='omerta.coordination.dead-letter');
  const proposal=(await gateway(people.mara,'prepare_coordination_request',{graphId:graph.id,expectedContentHash:graph.contentHash})).data;
  const human=await call('GET',`/v1/gateway/preparations/${proposal.id}`,people.mara);
  await call('POST',`/v1/gateway/preparations/${proposal.id}/confirm`,people.mara,{nonce:human.nonce,digest:human.digest});
  capture.panels.completedAdviserReceipt=proposal.confirmationUrl;
  if(pendingArgs)capture.panels.latestPendingConfirmation=(await gateway(people.mara,'respond_to_coordination_request',pendingArgs)).data.confirmationUrl;
  capture.panels.consigliereRefresh='/capture-consigliere/mara';
});
await stage('final genuine product boards',async()=>{
  for(const who of Object.values(people))await call('GET','/v1/content',who);
  await call('GET','/v1/coordination/knowledge',people.mara);
  await call('GET','/v1/worldgraph/inventory',people.mara);
  await call('GET','/v1/gateway/activity',people.mara);
});
save();
await app.listen({host:'127.0.0.1',port:8825});
console.log(JSON.stringify({url:'http://127.0.0.1:8825/capture-session/mara',consigliere:'http://127.0.0.1:8825/capture-consigliere/mara',panels:capture.panels,stages:records.filter(r=>r.stage).map(({stage,ok,message})=>({stage,ok,message}))}));
