import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Ajv from 'ajv';
import { CITY_ENCOUNTER_SCHEMAS } from '../src/city-encounters-contract.js';
const postgres=process.argv.includes('--postgres');
let admin,namespace,app;
for(const key of ['JWT_SECRET','MOD_KEY','MARKET_SEED']) process.env[key]=crypto.randomBytes(32).toString('hex');
for(const [key,value] of Object.entries({SOCIAL_VERIFY_MODE:'off',RATE_LIMIT:'off',INVITE_MODE:'off',POPULATION_OFF:'on',CORE_PROGRESSION:'off'}))process.env[key]=value;
try {
  if(postgres){
    assert(process.env.CITY_ENCOUNTERS_TEST_DATABASE_URL,'Explicit native fixture required');
    const endpoint=new URL(process.env.CITY_ENCOUNTERS_TEST_DATABASE_URL);
    assert(!endpoint.search && !endpoint.hash,'Fixture URLs cannot override driver host or connection options');
    assert(['postgres:','postgresql:'].includes(endpoint.protocol)&&['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname));
    assert(/^\/(omerta_query|omerta_check|city_encounters_[a-z0-9_]+)$/.test(endpoint.pathname));
    const {Pool}=await import('pg');admin=new Pool({connectionString:endpoint.toString()});namespace='city_encounters_'+crypto.randomBytes(8).toString('hex');
    await admin.query(`CREATE SCHEMA ${namespace}`);endpoint.searchParams.set('options',`-c search_path=${namespace}`);process.env.DATABASE_URL=endpoint.toString();
  }else assert(!process.env.DATABASE_URL,'Memory proof requires disposable pg-mem');
  const {buildServer}=await import('../src/server.js');app=await buildServer();
  if(postgres){const row=(await app.pool.query('SELECT current_schema() AS schema,version() AS version')).rows[0];assert.equal(row.schema,namespace);assert.match(row.version,/^PostgreSQL /);}
  const ajv=new Ajv({strict:false});for(const [name,schema]of Object.entries(CITY_ENCOUNTER_SCHEMAS))ajv.addSchema(schema,'#/components/schemas/'+name);
  const valid=(schema,value)=>assert(ajv.getSchema('#/components/schemas/'+schema)(value),JSON.stringify(ajv.getSchema('#/components/schemas/'+schema).errors));
  const call=(actor,method,url,payload,key=crypto.randomUUID())=>app.inject({method,url,...(payload===undefined?{}:{payload}),headers:{...(actor?.headers||{}),...(method==='POST'?{'idempotency-key':key}:{})}});
  const ok=r=>{assert.equal(r.statusCode,200,r.body);return r.json();};
  const player=async name=>{const guest=ok(await call(null,'POST','/v1/auth/guest',{birthDate:'1990-01-01'}));const headers={authorization:'Bearer '+guest.token};
    ok(await call({headers},'POST','/v1/character',{name}));const account=app.jwt.verify(guest.token).sub,row=(await app.pool.query('SELECT id,generation,loc FROM characters WHERE account_id=$1 AND alive',[account])).rows[0];
    await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[row.id,new Date(Date.now()+86400000)]);return{...row,account,headers};};
  const p=await player('Tactics Witness'),other=await player('Tactics Outsider');
  const board=async owner=>{const r=await call(owner,'GET','/v1/city/encounters');assert.equal(r.headers['cache-control'],'private, no-store');
    const vary=r.headers.vary.split(/,\s*/);assert(vary.includes('Authorization'));assert(vary.every(value=>['Authorization','Accept-Encoding'].includes(value)));
    const b=ok(r);valid('CityEncounterBoard',b);return b;};
  const act=async(owner,action,key)=>{const b=ok(await call(owner,action.method,action.path,action.body,key));valid('CityEncounterAck',b);return b;};
  const core=async()=>({character:(await app.pool.query('SELECT cash,bank,respect,health,energy,nerve,ammo,heat FROM characters WHERE id=$1',[p.id])).rows[0],
    items:Number((await app.pool.query('SELECT count(*) n FROM item_instances WHERE owner_scope=\'character\' AND owner_id=$1',[p.id])).rows[0].n),
    ledger:Number((await app.pool.query('SELECT count(*) n FROM transactions WHERE character_id=$1 OR account_id=$2',[p.id,p.account])).rows[0].n)});
  assert.equal((await call(null,'GET','/v1/city/encounters')).statusCode,401);
  assert.equal((await call(p,'GET','/v1/city/encounters?owner='+other.id)).statusCode,400);
  const before=await core(),initial=await board(p);assert.equal(initial.active,null);assert.deepEqual(initial.clues,[]);
  assert.equal(initial.scenarios.length,1);assert(!Object.hasOwn(initial.scenarios[0],'clue'),'The award clue is hidden before resolution');
  const start=initial.scenarios[0].action,startKey=crypto.randomUUID(),opened=await act(p,start,startKey);
  assert.deepEqual(await act(p,start,startKey),opened);assert.equal(Number((await app.pool.query('SELECT count(*) n FROM city_encounters WHERE owner_character_id=$1',[p.id])).rows[0].n),1);
  assert.equal((await call(p,start.method,start.path,{...start.body,scenarioId:'neon-patrol'})).statusCode,400,'Canonical district gate');
  assert.equal((await call(p,start.method,start.path,start.body)).statusCode,409,'One active encounter');
  let b=await board(p),first=b.active.actions.find(a=>a.id==='guard'),key=crypto.randomUUID(),reply=await act(p,first,key);
  assert.equal(reply.encounter.revision,2);assert.deepEqual(await act(p,first,key),reply,'Exact-key turn replay does not advance twice');
  assert.equal((await call(p,first.method,first.path,{...first.body,move:'strike'},key)).statusCode,422,'Changed-body key reuse is refused');
  assert.equal((await call(p,first.method,first.path,first.body)).statusCode,409,'A fresh key cannot advance an old revision');
  const foreign={...first.body,characterId:other.id,generation:Number(other.generation),district:other.loc};
  const f=await call(other,first.method,first.path,foreign),missing=await call(other,first.method,'/v1/city/encounters/missing/turn',foreign);
  assert.equal(f.statusCode,400);assert.deepEqual(f.json(),missing.json(),'Other-owner and missing encounters are indistinguishable');
  const retire=reply.encounter.actions.find(a=>a.id==='retreat');await act(p,retire);assert.equal((await board(p)).active,null);
  b=await board(p);await act(p,b.scenarios[0].action);
  const current=await board(p),turn=current.active.actions.find(a=>a.id==='guard'),faultKey=crypto.randomUUID();
  const connect=app.pool.connect.bind(app.pool);let faulted=false;const patched=[];
  app.pool.connect=(...connectArgs)=>{if(connectArgs.length)return connect(...connectArgs);return connect().then(client=>{const original=client.query,query=original.bind(client);patched.push([client,original]);client.query=async(...args)=>{
    if(!faulted&&String(args[0]).startsWith('UPDATE idempotency SET status=$3')){faulted=true;throw new Error('Controlled late encounter receipt failure');}
    return query(...args);};return client;});};
  let failed;try{failed=await call(p,turn.method,turn.path,turn.body,faultKey);}finally{app.pool.connect=connect;for(const[client,original]of patched)client.query=original;}
  assert(faulted);assert.equal(failed.statusCode,503);assert.equal((await board(p)).active.revision,current.active.revision,'Late failure rolls encounter and receipt back');
  const recovered=await act(p,turn,faultKey);assert.equal(recovered.encounter.revision,current.active.revision+1);
  assert.deepEqual(await act(p,turn,faultKey),recovered);
  await act(p,recovered.encounter.actions.find(a=>a.id==='retreat'));
  // Learn the real skill through its core endpoint; client data cannot manufacture negotiation.
  await app.pool.query('UPDATE characters SET respect=10000 WHERE id=$1',[p.id]);
  ok(await call(p,'POST','/v1/skills/fast_talker',{}));
  const trainingBaseline=await core();
  await act(p,(await board(p)).scenarios[0].action);
  const prepared=await board(p),negotiate=prepared.active.actions.find(a=>a.id==='negotiate');assert(negotiate.available);
  const truce=await act(p,negotiate);assert.equal(truce.encounter.status,'truce');assert(truce.encounter.clue);
  assert.equal((await board(p)).clues.length,1,'Confirmed outcome creates one durable discovery');
  assert.deepEqual(await core(),trainingBaseline,'Every actual encounter and replay leaves core resources, items and money unchanged');
  for(let n=0;n<17;n++){await act(p,(await board(p)).scenarios[0].action);await act(p,(await board(p)).active.actions.find(a=>a.id==='retreat'));}
  assert.equal((await board(p)).clues.length,1,'Earned clue survives the bounded recent-history page');
  assert.equal((await board(other)).history.length,0);assert.deepEqual((await board(other)).clues,[]);
  // Full announced-intent tactical route resolves with native state; no DTO/state injection.
  await act(p,(await board(p)).scenarios[0].action);
  let rounds=0;
  while((b=await board(p)).active&&rounds++<12){const encounter=b.active;
    const move=encounter.intent==='strike'?'guard':encounter.intent==='brace'&&encounter.stamina>=2?'feint':encounter.stamina>=2?'strike':'guard';
    await act(p,encounter.actions.find(a=>a.id===move));}
  assert.equal((await board(p)).active,null);assert(rounds<=12);
  assert.equal((await board(p)).history[0].status,'won','Responding to each real announced intent wins the tactical drill');
  assert.equal(before.ledger,trainingBaseline.ledger);assert.equal(before.character.cash,trainingBaseline.character.cash);
  console.log('City encounters: actual prepare/intent/turns/core skill, exact replay, stale revision/body/owner/district/privacy, late rollback/retry and persistent clues passed');
}finally{if(app)await app.close();if(admin){await admin.query(`DROP SCHEMA ${namespace} CASCADE`);await admin.end();}}
