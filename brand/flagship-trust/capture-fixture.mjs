// Isolated source-pinned capture harness. No game source is modified.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL, fileURLToPath} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const source = 'C:/Users/Jorge/.codex/worktrees/flagship-trust-source/Omerta';
const revision = '3280817300cdcff3301745b1fce0bac9fe290129';
if (process.env.DATABASE_URL || process.env.NODE_ENV === 'production') throw Error('Disposable local memory only.');
process.chdir(source);
Object.assign(process.env, {NODE_ENV:'development', POPULATION_OFF:'on', RATE_LIMIT:'off', INVITE_MODE:'off', WORLD_GRAPH_KERNEL:'off', COORDINATION_OPERATIONS:'off', LIVING_WORLD_DIRECTOR:'DIRECTOR_DISABLED'});
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options) => {
  const target = new URL(typeof url === 'string' ? url : url.url || String(url));
  if (!['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) throw Error('External network disabled in capture fixture.');
  return originalFetch(url, options);
};
const {buildServer} = await import(pathToFileURL(path.join(source, 'src/server.js')).href);
const app = await buildServer();
const people = new Map();
const records = [];
const evidence = {revision, createdAt:new Date().toISOString(), environment:'Disposable pg-mem; loopback only; actual pinned repository UI and handlers', syntheticSetup:[], records};
const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !/token|secret|signature|authorization|wallet_address|nonce/i.test(key)).map(([key,item]) => [key,clean(item)])) : value;
const save = () => fs.writeFileSync(path.join(dir,'capture-evidence.json'),JSON.stringify(clean(evidence),null,2)+'\n');
const call = async (method, url, person, payload) => {
  const response = await app.inject({method,url,headers:{...(person?{authorization:`Bearer ${people.get(person).token}`} : {}),'idempotency-key':crypto.randomUUID()},...(payload===undefined?{}:{payload})});
  const body = response.json();
  // Never export private participant identity for an informant action.
  if (!url.endsWith('/rat')) records.push({method,url,person,status:response.statusCode,response:clean(body)});
  if(response.statusCode>=400) throw Error(`${method} ${url}: ${response.statusCode} ${body.error || body.message}`);
  save();return body;
};
let heistId;
let advanced = false;
app.get('/capture/session/:person', async (req,reply) => {
  const person=people.get(req.params.person);
  if(!person)return reply.code(404).send('Unknown disposable account');
  return reply.type('text/html').header('Cache-Control','no-store').send(`<!doctype html><title>Development capture</title><script>localStorage.setItem('omerta_token',${JSON.stringify(person.token)});localStorage.setItem('omerta_sfx','off');location.replace('/');</script>`);
});
app.get('/capture/evidence', async (_req,reply) => reply.header('Cache-Control','no-store').send(clean(evidence)));
app.post('/capture/advance', async () => {
  if(advanced)return{ok:true,alreadyPrepared:true};
  for(const [id,name] of [['nico','Nico Vale'],['mara','Mara Serrano']]){
    if(!people.get(id).character){const me=await call('GET','/v1/me',id);people.get(id).character=me.character?.id;}
    const character=people.get(id).character;
    if(!character)throw Error(`Create ${name} in the actual interface first.`);
    await app.pool.query('UPDATE characters SET respect=5760,cash=150000,muscle=180,cunning=160,speed=190,energy=100,nerve=100,heat=10,jail_until=NULL WHERE id=$1',[character]);
  }
  evidence.syntheticSetup.push('Explicit composite time jump: both sample characters seeded with qualifying heist resources/stats. This is not a natural progression recording.');
  await call('POST','/v1/path','nico',{path:'wheel'});
  await call('POST','/v1/path','mara',{path:'gun'});
  await call('POST','/v1/crew','nico',{name:'The Night Shift'});
  const car=crypto.randomUUID();
  await app.pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg,listed,pledged,minted_onchain,race_limit,pink_slip) VALUES($1,$2,'junker','stock',12,false,false,false,null,false)",[car,people.get('nico').character]);
  evidence.syntheticSetup.push('One starter car seeded for an inventory/garage illustration; no claimed purchase receipt.');
  const plan=await call('POST','/v1/heists/plan','nico',{job:'payroll',role:'wheelman'});heistId=plan.id;
  evidence.heist={id:heistId,job:'payroll',leaderRole:'wheelman',otherRole:'muscle'};
  advanced=true;save();return {ok:true,heistId};
});
app.post('/capture/heist/join', async () => {
  if(!heistId)throw Error('Prepare the composite first.');
  return call('POST',`/v1/heists/${heistId}/join`,'mara',{role:'muscle'});
});
app.post('/capture/heist/resolve', async () => {
  if(!heistId)throw Error('Prepare the composite first.');
  await call('POST',`/v1/heists/${heistId}/rat`,'mara');
  evidence.syntheticSetup.push('Documented informant branch exercised in disposable scenario; the public outcome does not reveal the informant.');
  const result=await call('POST',`/v1/heists/${heistId}/execute`,'nico');
  save();return result;
});

for(const [id,name] of [['nico',null],['mara','Mara Serrano'],['agent','Relay Nine']]){
  const guest=await call('POST','/v1/auth/guest',null,{});people.set(id,{token:guest.token});
  if(id==='agent'){const key=await call('POST','/v1/auth/agent-key',id,{});people.get(id).token=key.token;}
  if(name){await call('POST','/v1/character',id,{name});people.get(id).character=(await call('GET','/v1/me',id)).character.id;}
}
// A real supported action selected from a real agent turn, with no language-model/API spend.
const turn=await call('GET','/v1/agent/turn','agent');
const chosen=turn.actions.find(action=>action.kind==='crime' && action.executable);
if(chosen){
  evidence.agentExample={controller:'Deterministic player-operated sample client; not an LLM inference',before:clean(turn.state),choice:{id:chosen.id,kind:chosen.kind,cost:chosen.cost,risk:chosen.risk}};
  const acted=await call('POST','/v1/agent/act','agent',{turnId:turn.turnId,actionId:chosen.id});
  evidence.agentExample.result=clean(acted.result);
  evidence.agentExample.after=clean(acted.turn?.state);
}
save();
await app.listen({host:'127.0.0.1',port:8827});
console.log(JSON.stringify({url:'http://127.0.0.1:8827/capture/session/nico',revision,network:'loopback-only',database:'disposable pg-mem'}));
