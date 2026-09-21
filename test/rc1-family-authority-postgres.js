// Scoped full-server Family authority and persistent HTTP replay regression.
// No workers/providers run; resource fixtures are explicit, before measurement.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit isolated PostgreSQL required');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.COORDINATION_TEST_DATABASE_URL).hostname));
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
for (const key of Object.keys(process.env)) if (/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL)/.test(key)) delete process.env[key];
for (const key of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[key] = crypto.randomBytes(32).toString('hex');
Object.assign(process.env, { RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off', CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on' });
const source = await sourceIdentity(), directory = path.resolve(process.env.RC1_FAMILY_AUTHORITY_OUTPUT || `output/rc1-family-authority-${source.revision.slice(0, 8)}`);
const { commandDatabase, addPlayer, characterId } = await import('./lib/player-command-support.js');
const { buildServer } = await import('../src/server.js');
const { M3, ROSTER_POSTS } = await import('../src/rules.js');
const configuration = { phase: 'local-prerelease', database: 'explicit loopback private schema', originalWorkers: false,
  fixtures: 'Seven funded level-eligible living players and one account without character; initial last_accrued_at one hour ahead isolates separately committed accrual. All Family membership, rank, posts and chat use canonical HTTP. Measured effects are nonmonetary; no economy invariant claim for funded fixtures.',
  authorityComparison: 'All current-schema tables except persistent HTTP idempotency transport cache; one PostgreSQL MVCC statement; no sequence or worker-concurrency claim',
  exclusions: ['Complete global authority matrix', 'Natural progression', 'Other Family routes, tribute success, war/turf terminals, deadline expiry', 'Websocket delivery', 'Client rendering/XSS execution', 'Native worker/deployment/physical-device behavior', 'Arbitrary concurrent authorization revocation schedules; no in-flight revocation defect established', 'HTTP receipt expiration'] };
const proof = await createProofRecorder({ directory, source, configuration, runId: `family-authority-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`,
  seed: 'family-authority-v1', scenarioId: 'legacy-family-authority', population: 8 });
const roles = ['boss', 'under', 'soldier', 'capo', 'otherboss', 'othermember', 'outsider', 'fresh'];
const accounts = Object.fromEntries(roles.map(role => [role, `fa-${role}`]));
const names = Object.fromEntries(roles.map(role => [role, `Family ${role}`]));
let db, app, stateSQL, tables, sequence = 0, snapshots = new Set(), result, phase = 'initialization';
const tokens = {}, completions = new Map(), cases = [], requests = [], replays = [];
async function boot() {
  app = await buildServer();
  app.addHook('onResponse', async req => { completions.get(req.headers['x-rc1-completion'])?.(); });
}
async function call(role, method, url, payload = {}, key = crypto.randomUUID()) {
  const id = String(++sequence); let timer;
  const completed = new Promise((resolve, reject) => { completions.set(id, resolve); timer = setTimeout(() => reject(Error('Response completion timeout')), 30000); });
  try {
    const response = await app.inject({ method, url, ...(method === 'GET' ? {} : { payload }), headers: {
      ...(role ? { authorization: `Bearer ${tokens[role]}` } : {}), 'idempotency-key': key, 'x-rc1-completion': id } });
    await completed;
    const row = { role, method, url, payload: method === 'GET' ? null : payload, key, status: response.statusCode,
      body: response.json(), replayed: response.headers['x-idempotent-replay'] === 'true', phase };
    requests.push(row); await proof.record({ kind: 'completed-http', ...row }); return row;
  } finally { clearTimeout(timer); completions.delete(id); }
}
async function ok(...args) { const row = await call(...args); assert.equal(row.status, 200, `${row.method} ${row.url}: ${JSON.stringify(row.body)}`); return row; }
async function snapshot() {
  const rows = (await app.pool.query(stateSQL)).rows.sort((a, b) => a.name.localeCompare(b.name)), hash = sha256(canonicalJson(rows));
  if (!snapshots.has(hash)) { await proof.artifact(`state-${hash}.json`, rows); snapshots.add(hash); }
  return { hash, rows };
}
async function deny(id, error, role, method, url, payload = {}, status = 400) {
  const before = await snapshot(), row = await call(role, method, url, payload), after = await snapshot();
  const entry = { id, expectedStatus: status, expectedError: error, request: row, before: before.hash, after: after.hash, status: 'CHECKING' }; cases.push(entry);
  await proof.artifact(`denial-${String(cases.length).padStart(3, '0')}.json`, entry);
  assert.equal(row.status, status, `${id}: ${JSON.stringify(row.body)}`);
  if (error) assert.equal(row.body.error, error, id);
  assert.deepEqual(after.rows, before.rows, `${id}: rejected request changed authority`);
  entry.status = 'PASS'; return row;
}
async function retry(id, original) {
  const before = await snapshot(), row = await ok(original.role, original.method, original.url, original.payload, original.key), after = await snapshot();
  assert.equal(row.replayed, true, id); assert.deepEqual(row.body, original.body, id); assert.deepEqual(after.rows, before.rows, id);
  replays.push({ id, before: before.hash, after: after.hash, originalKey: original.key }); return row;
}
try {
  db = await commandDatabase('family_authority');
  const schema = (await db.pool.query('SELECT current_schema() AS name')).rows[0].name;
  assert(/^command_family_authority_[a-f0-9]+$/.test(schema));
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL); endpoint.searchParams.set('options', '-c search_path='+schema); process.env.DATABASE_URL = endpoint.toString();
  await boot();
  for (const role of roles.filter(role => role !== 'fresh')) await addPlayer(app.pool, accounts[role], names[role], 'foundry');
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [accounts.fresh]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [accounts.fresh]);
  await app.pool.query("UPDATE characters SET last_accrued_at=now()+interval '1 hour'");
  for (const role of roles) tokens[role] = app.jwt.sign({ sub: accounts[role], tv: 0 });
  const a = (await ok('boss','POST','/v1/gangs',{name:'Authority Family A',tag:'AFA'})).body.gangId;
  const b = (await ok('otherboss','POST','/v1/gangs',{name:'Authority Family B',tag:'AFB'})).body.gangId;
  assert(a && b && a!==b);
  for(const role of ['under','soldier','capo']) await ok(role,'POST','/v1/gangs/'+a+'/join');
  await ok('othermember','POST','/v1/gangs/'+b+'/join');
  await ok('boss','POST','/v1/gangs/promote',{characterId:characterId(accounts.under),role:'underboss'});
  await ok('boss','POST','/v1/gangs/promote',{characterId:characterId(accounts.capo),role:'capo'});
  tables=(await app.pool.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename',[schema])).rows.map(r=>r.tablename).filter(name=>name!=='idempotency');
  assert(tables.every(name=>/^[a-z_0-9]+$/.test(name)));
  stateSQL=tables.map(name=>"SELECT '"+name+"' AS name, COALESCE(jsonb_agg(v ORDER BY v::text),'[]'::jsonb)::text AS rows FROM (SELECT to_jsonb(t) AS v FROM "+String.fromCharCode(34)+name+String.fromCharCode(34)+' t) q').join(' UNION ALL ');
  const routes = ['POST /v1/gangs','POST /v1/gangs/:id/join','POST /v1/gangs/leave','POST /v1/gangs/kick',
    'POST /v1/gangs/promote','POST /v1/gangs/tribute','POST /v1/gangs/tribute/omr','POST /v1/gangs/war/:targetGangId',
    'POST /v1/gangs/chat','POST /v1/roster/:post','DELETE /v1/roster/:post'];
  for(const route of routes) assert(app.routes.some(r=>r.method+' '+r.url===route),'Missing reviewed route '+route);
  await proof.artifact('inventory.json',{routes,authorityTables:tables,postgres:(await app.pool.query('SELECT version() AS version')).rows[0].version,configuration});
  const initial=await snapshot(); phase='measured';
  const post=ROSTER_POSTS[0].id, soldier=characterId(accounts.soldier);
  for(const route of routes) {
    const [method,pattern]=route.split(' '), url=pattern.replace(':id',a).replace(':targetGangId',b).replace(':post',post);
    const payload={name:'No authority',tag:'NOA',characterId:soldier,memberId:soldier,role:'capo',text:'Private family probe',amount:M3.TRIBUTE_MIN};
    await deny(route+':anonymous',null,null,method,url,payload,401);
    await deny(route+':no-character','no_character','fresh',method,url,payload);
  }
  for(const role of ['soldier','capo','outsider']) for(const [method,url,payload] of [
    ['POST','/v1/gangs/kick',{characterId:characterId(accounts.othermember)}],
    ['POST','/v1/gangs/promote',{characterId:soldier,role:'underboss'}],
    ['POST','/v1/gangs/war/'+b,{}],
    ['POST','/v1/roster/'+post,{memberId:soldier}],['DELETE','/v1/roster/'+post,{}]])
    await deny(role+':'+method+' '+url,'rank',role,method,url,{...payload,accountId:accounts.boss,gangId:a,gangRole:'boss'});
  await deny('underboss-cannot-promote','rank','under','POST','/v1/gangs/promote',{characterId:soldier,role:'capo'});
  await deny('underboss-cannot-kick-boss','rank','under','POST','/v1/gangs/kick',{characterId:characterId(accounts.boss)});
  await deny('boss-cannot-kick-foreign','no_member','boss','POST','/v1/gangs/kick',{characterId:characterId(accounts.othermember)});
  await deny('boss-cannot-promote-foreign','no_member','boss','POST','/v1/gangs/promote',{characterId:characterId(accounts.othermember),role:'capo'});
  await deny('boss-cannot-assign-foreign','no_member','boss','POST','/v1/roster/'+post,{memberId:characterId(accounts.othermember)});
  await deny('boss-role-not-assignable','bad_role','boss','POST','/v1/gangs/promote',{characterId:soldier,role:'boss'});
  await deny('second-underboss-denied','underboss','boss','POST','/v1/gangs/promote',{characterId:soldier,role:'underboss'});
  for(const url of ['/v1/gangs/leave','/v1/gangs/tribute','/v1/gangs/tribute/omr','/v1/gangs/chat'])
    await deny('outsider:'+url,'no_gang','outsider','POST',url,{amount:10,text:'Foreign room',gangId:a});
  await deny('member-cannot-join-other','in_gang','soldier','POST','/v1/gangs/'+b+'/join');
  const promotion=await ok('boss','POST','/v1/gangs/promote',{characterId:soldier,role:'capo'}); await retry('promotion-exact',promotion);
  const beforeTamper=await snapshot(), tampered=await call('boss','POST',promotion.url,{characterId:soldier,role:'underboss'},promotion.key);
  assert.equal(tampered.status,422);assert.equal(tampered.body.error,'idempotency_key_reuse');assert.deepEqual((await snapshot()).rows,beforeTamper.rows);
  await proof.artifact('changed-identity-rejection.json',{request:tampered,before:beforeTamper.hash,after:(await snapshot()).hash});
  const assigned=await ok('under','POST','/v1/roster/'+post,{memberId:soldier});await retry('underboss-post-retry',assigned);
  const vacated=await ok('under','DELETE','/v1/roster/'+post);await retry('vacate-retry',vacated);
  const demotion=await ok('boss','POST','/v1/gangs/promote',{characterId:characterId(accounts.under),role:'soldier'});await retry('demotion-retry',demotion);
  await deny('fresh-command-after-demotion','rank','under','POST','/v1/roster/'+post,{memberId:soldier});
  await retry('old-assignment-after-demotion-no-write',assigned);
  const chat=await ok('soldier','POST','/v1/gangs/chat',{text:'Restricted family authority line'});await retry('chat-retry',chat);
  assert((await ok('boss','GET','/v1/gangs/chat')).body.messages.some(row=>row.text==='Restricted family authority line'));
  for(const role of ['outsider','othermember']) assert(!(await ok(role,'GET','/v1/gangs/chat')).body.messages.some(row=>row.text==='Restricted family authority line'));
  const key=crypto.randomUUID(), pair=await Promise.all([ok('boss','POST','/v1/gangs/kick',{characterId:soldier},key),ok('boss','POST','/v1/gangs/kick',{characterId:soldier},key)]);
  assert.equal(pair.filter(row=>!row.replayed).length,1);assert.deepEqual(pair[0].body,pair[1].body);
  const kicked=pair.find(row=>!row.replayed);await proof.artifact('concurrent-kick.json',pair);
  await deny('fresh-chat-after-kick','no_gang','soldier','POST','/v1/gangs/chat',{text:'After revocation'});
  assert.deepEqual((await ok('soldier','GET','/v1/gangs/chat')).body.messages,[]);
  await retry('historic-chat-after-kick-no-write',chat);
  const joined=await ok('outsider','POST','/v1/gangs/'+a+'/join');await retry('ordinary-open-join',joined);
  assert(!(await ok('outsider','GET','/v1/gangs/chat')).body.messages.some(row=>row.text==='Restricted family authority line'),'New joiner saw prejoin private chat');
  const left=await ok('outsider','POST','/v1/gangs/leave');await retry('leave-retry',left);await retry('old-join-after-leave-no-write',joined);
  assert.equal((await app.pool.query('SELECT count(*) n FROM gang_members WHERE character_id=$1',[characterId(accounts.outsider)])).rows[0].n,'0');
  const restartBefore=await snapshot();await app.close();app=null;await boot();const restartAfter=await snapshot();
  await proof.artifact('restart-bootstrap.json',{before:restartBefore.hash,after:restartAfter.hash,note:'Original schema timestamp may differ; every subsequent replay compares all authority tables.'});
  for(const [id,row] of [['kick',kicked],['assignment-after-demotion',assigned],['join-after-leave',joined],['chat-after-kick',chat]]) await retry('restart-'+id,row);
  const final=await snapshot(), balances=rows=>JSON.parse(rows.find(row=>row.name==='characters').rows).map(row=>({id:row.id,cash:row.cash,bank:row.bank,ammo:row.ammo,cb:row.cb})).sort((a,b)=>a.id.localeCompare(b.id));
  assert.deepEqual(balances(final.rows),balances(initial.rows));
  result={status:'PASS_SCOPED',routes:routes.length,denials:cases.length,replayComparisons:replays.length,concurrentFreshEffects:1,
    comparedTables:tables.length,retainedSnapshots:snapshots.size,requestCount:requests.length,initialStateHash:initial.hash,finalStateHash:final.hash,configuration,fullAuthorityCoverage:false,releaseReady:false};
} catch(error) {
  result={status:'FAIL',error:error.message,stack:error.stack,completedDenials:cases.filter(row=>row.status==='PASS').length,configuration};
  await proof.artifact('failure.json',result);process.exitCode=1;
} finally {
  if(app)await app.close();if(db)await db.cleanup(db.pool);
  await proof.artifact('cases.json',{cases,replays});const sealed=await proof.finish(result);await verifyArtifactIndex(directory,sealed);
  console.log(JSON.stringify({status:sealed.status,source:source.revision,denials:result.denials,replayComparisons:result.replayComparisons,directory,error:result.error}));
}
