// Residual legacy authority branches absent from the retained RC1 authority suites.
// Explicit fixtures isolate six canonical HTTP mutations; no world workers run.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit isolated PostgreSQL required');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.COORDINATION_TEST_DATABASE_URL).hostname));
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
for (const name of Object.keys(process.env)) if (/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL)/.test(name)) delete process.env[name];
for (const name of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[name] = crypto.randomBytes(32).toString('hex');
Object.assign(process.env, { RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off', CORE_PROGRESSION: 'on' });
const source = await sourceIdentity();
const directory = path.resolve(process.env.RC1_AUTHORITY_RESIDUAL_OUTPUT || `output/rc1-authority-residual-${source.revision.slice(0, 8)}`);
const { commandDatabase, addPlayer, characterId } = await import('./lib/player-command-support.js');
const { buildServer } = await import('../src/server.js');
const { CARS, carVal } = await import('../src/rules.js');
const configuration = { phase: 'local-prerelease', database: 'explicit loopback private schema', originalWorkers: false,
  fixtures: 'Three living funded accounts, one without character, owned cars/searches/convoy/club/raid; future accrual checkpoint. Fixtures are declared before each measured boundary.',
  scope: 'Six residual legacy HTTP mutations: search cancellation, car repair, convoy cancellation, race unlisting, club unlisting, raid leave/disband. Native canonical state, cost/custody, denial rollback and exact HTTP replay.',
  stateComparison: 'Every current-schema table except HTTP idempotency transport cache, one MVCC statement; receipt identity and body compared separately.',
  exclusions: ['Live provider/deployment identity', 'Global authority clearance by this individual test', 'Resource-world/matrix/soak qualification', 'Physical device behavior'] };
const proof = await createProofRecorder({ directory, source, configuration, runId: `authority-residual-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`,
  seed: 'authority-residual-v1', scenarioId: 'legacy-authority-residual', population: 4 });
const accounts = { owner: 'ar-owner', member: 'ar-member', outsider: 'ar-outsider', fresh: 'ar-fresh' };
const cid = role => characterId(accounts[role]);
const tokens = {}, cases = [], replays = [], completions = new Map();
let db, app, result, snapshotSql, sequence = 0;
async function snapshot() {
  const rows = (await app.pool.query(snapshotSql)).rows.sort((a, b) => a.name.localeCompare(b.name));
  return { rows, sha256: sha256(canonicalJson(rows)) };
}
async function call(role, method, url, payload = {}, key = crypto.randomUUID()) {
  const id = String(++sequence); let timer;
  const completed = new Promise((resolve, reject) => { completions.set(id, resolve); timer = setTimeout(() => reject(Error('Response completion timeout')), 30000); });
  try {
    const response = await app.inject({ method, url, payload, headers: { ...(role ? { authorization: `Bearer ${tokens[role]}` } : {}),
      'idempotency-key': key, 'x-rc1-completion': id } });
    await completed;
    const row = { role, method, url, payload, key, status: response.statusCode, body: response.json(), replayed: response.headers['x-idempotent-replay'] === 'true' };
    await proof.record({ kind: 'completed-http', ...row }); return row;
  } finally { clearTimeout(timer); completions.delete(id); }
}
async function ok(...args) { const row = await call(...args); assert.equal(row.status, 200, `${row.url}: ${JSON.stringify(row.body)}`); return row; }
async function deny(id, error, role, method, url, body = {}, status = 400) {
  const before = await snapshot(), response = await call(role, method, url, body), after = await snapshot();
  assert.equal(response.status, status, `${id}: ${JSON.stringify(response.body)}`);
  if (error) assert.equal(response.body.error, error, id);
  assert.deepEqual(after.rows, before.rows, `${id}: rejected authority changed`);
  cases.push({ id, status: 'PASS', response, before: before.sha256, after: after.sha256 });
}
async function retry(id, original) {
  const before = await snapshot(), response = await ok(original.role, original.method, original.url, original.payload, original.key), after = await snapshot();
  assert(response.replayed, id); assert.deepEqual(response.body, original.body, id); assert.deepEqual(after.rows, before.rows, id);
  replays.push({ id, status: 'PASS', before: before.sha256, after: after.sha256, key: original.key });
}
try {
  db = await commandDatabase('authority_residual');
  const schema = (await db.pool.query('SELECT current_schema() AS name')).rows[0].name;
  assert(/^command_authority_residual_[a-f0-9]+$/.test(schema));
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL); endpoint.searchParams.set('options', `-c search_path=${schema}`); process.env.DATABASE_URL = endpoint.toString();
  app = await buildServer();
  app.addHook('onResponse', async req => completions.get(req.headers['x-rc1-completion'])?.());
  for (const role of ['owner', 'member', 'outsider']) await addPlayer(app.pool, accounts[role], `Residual ${role}`, 'docks');
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [accounts.fresh]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [accounts.fresh]);
  await app.pool.query("UPDATE characters SET last_accrued_at=now()+interval '1 hour'");
  for (const role of Object.keys(accounts)) tokens[role] = app.jwt.sign({ sub: accounts[role], tv: 0 });
  const tables = (await app.pool.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename<>'idempotency' ORDER BY tablename")).rows.map(row => row.tablename);
  assert(tables.every(t => /^[a-z_][a-z0-9_]*$/.test(t)));
  snapshotSql = tables.map(t => `SELECT '${t}' AS name, COALESCE((SELECT json_agg(v ORDER BY v::text)::text FROM (SELECT row_to_json(r) v FROM "${t}" r) q), '[]') AS rows`).join(' UNION ALL ');
  const model = CARS.find(c => !c.rare).id;
  await app.pool.query('INSERT INTO cars(id,character_id,model_id,trim_id,dmg,race_limit) VALUES($1,$2,$3,\'stock\',50,100),($4,$5,$3,\'stock\',50,200)', ['ar-car',cid('owner'),model,'ar-foreign-car',cid('member')]);
  await app.pool.query('INSERT INTO searches(hunter,target) VALUES($1,$2),($2,$1)', [cid('owner'),cid('member')]);
  await app.pool.query("INSERT INTO convoys(id,owner_character,origin,destination,status) VALUES('ar-convoy',$1,'docks','foundry','loading')", [cid('owner')]);
  await app.pool.query("INSERT INTO convoy_cargo(convoy_id,good_id,qty) VALUES('ar-convoy','gin',2)");
  await app.pool.query("INSERT INTO speakeasies(district_id,owner_character,sale_price) VALUES('docks',$1,100000) ON CONFLICT(district_id) DO UPDATE SET owner_character=$1,sale_price=100000", [cid('owner')]);
  await app.pool.query("INSERT INTO world_raids(id,npc_id,leader_character,status) VALUES('ar-raid','residual-fixture',$1,'planning')", [cid('owner')]);
  await app.pool.query("INSERT INTO world_raid_members(raid_id,character_id) VALUES('ar-raid',$1),('ar-raid',$2)", [cid('owner'),cid('member')]);
  await proof.artifact('fixtures.json', { accounts, model, setup: configuration.fixtures, initial: await snapshot() });
  const routes = [['DELETE','/v1/streets/search'],['POST','/v1/garage/ar-car/repair'],['POST','/v1/convoy/cancel'],['POST','/v1/races/unlist/ar-car'],['POST','/v1/speakeasy/unlist'],['POST','/v1/world/raids/ar-raid/leave']];
  for (const [method,url] of routes) {
    await deny(`anonymous:${url}`, null, null, method, url, {}, 401);
    await deny(`no-character:${url}`, 'no_character', 'fresh', method, url);
  }
  const injection = { accountId: accounts.owner, characterId: cid('owner'), owner: cid('owner'), cost: 0, reward: 999999, hunter: cid('owner'), convoyId: 'ar-convoy', target: cid('member') };
  await deny('foreign-car-repair', 'no_car', 'outsider', 'POST', '/v1/garage/ar-car/repair', injection);
  await deny('foreign-race-unlist', 'no_car', 'outsider', 'POST', '/v1/races/unlist/ar-car', injection);
  await deny('foreign-convoy-cancel', 'no_convoy', 'outsider', 'POST', '/v1/convoy/cancel', injection);
  await deny('foreign-club-unlist', 'no_club', 'outsider', 'POST', '/v1/speakeasy/unlist', injection);
  await deny('foreign-raid-leave', 'not_crew', 'outsider', 'POST', '/v1/world/raids/ar-raid/leave', injection);
  const cancelSearch = await ok('member','DELETE','/v1/streets/search',injection);
  assert.deepEqual((await app.pool.query('SELECT hunter,target FROM searches ORDER BY hunter')).rows, [{ hunter: cid('owner'), target: cid('member') }]);
  await retry('search-cancel-replay',cancelSearch);
  await app.pool.query("UPDATE characters SET cash=0 WHERE id=$1",[cid('owner')]);
  await deny('repair-cost-required','cash','owner','POST','/v1/garage/ar-car/repair',injection);
  await app.pool.query("UPDATE characters SET cash=100000 WHERE id=$1",[cid('owner')]);
  for (const [field,error] of [['listed','listed'],['pledged','pledged']]) {
    await app.pool.query(`UPDATE cars SET ${field}=true WHERE id='ar-car'`);
    await deny(`repair-${field}`,error,'owner','POST','/v1/garage/ar-car/repair',injection);
    await app.pool.query(`UPDATE cars SET ${field}=false WHERE id='ar-car'`);
  }
  const expectedCost = Math.max(50,Math.floor(0.5*carVal(model,'stock')*0.2));
  for (const fixed of [false,true]) {
    const beforeCash=Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[cid('owner')])).rows[0].cash);
    const random=Math.random; let repaired;
    try { Math.random=()=>fixed?0:0.999999; repaired=await ok('owner','POST','/v1/garage/ar-car/repair',injection); }
    finally { Math.random=random; }
    assert.equal(repaired.body.fixed,fixed); assert.equal(repaired.body.cost,expectedCost);
    assert.equal(Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[cid('owner')])).rows[0].cash),beforeCash-expectedCost);
    assert.equal((await app.pool.query("SELECT dmg FROM cars WHERE id='ar-car'")).rows[0].dmg,fixed?0:50);
    await retry(`repair-${fixed?'fixed':'botched'}-replay`,repaired);
  }
  const repairLedger=(await app.pool.query("SELECT amount FROM transactions WHERE reason='repair' ORDER BY id")).rows;
  assert.equal(repairLedger.length,2); assert(repairLedger.every(row=>Number(row.amount)===-expectedCost));
  await deny('repair-clean-denied','clean','owner','POST','/v1/garage/ar-car/repair',injection);
  const race=await ok('owner','POST','/v1/races/unlist/ar-car',injection);
  assert.equal((await app.pool.query("SELECT race_limit FROM cars WHERE id='ar-car'")).rows[0].race_limit,null);
  assert.equal((await app.pool.query("SELECT race_limit FROM cars WHERE id='ar-foreign-car'")).rows[0].race_limit,200);
  await retry('race-unlist-replay',race);
  await app.pool.query("UPDATE convoy_cargo SET qty=10000 WHERE convoy_id='ar-convoy'");
  await deny('convoy-trunk-capacity','cargo','owner','POST','/v1/convoy/cancel',injection);
  await app.pool.query("UPDATE convoy_cargo SET qty=2 WHERE convoy_id='ar-convoy'");
  const convoy=await ok('owner','POST','/v1/convoy/cancel',injection);
  assert.equal(convoy.body.returned,2);
  assert.equal((await app.pool.query("SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id='gin'",[cid('owner')])).rows[0].qty,2);
  assert.equal((await app.pool.query("SELECT 1 FROM convoy_cargo WHERE convoy_id='ar-convoy'")).rowCount,0);
  assert.equal((await app.pool.query("SELECT status FROM convoys WHERE id='ar-convoy'")).rows[0].status,'done');
  await retry('convoy-cancel-replay',convoy);
  const club=await ok('owner','POST','/v1/speakeasy/unlist',injection);
  assert.equal((await app.pool.query("SELECT sale_price FROM speakeasies WHERE district_id='docks'")).rows[0].sale_price,null);
  await retry('club-unlist-replay',club);
  await deny('club-not-listed','not_listed','owner','POST','/v1/speakeasy/unlist',injection);
  const leave=await ok('member','POST','/v1/world/raids/ar-raid/leave',injection);
  assert.equal(leave.body.left,true);
  assert.deepEqual((await app.pool.query("SELECT character_id FROM world_raid_members WHERE raid_id='ar-raid' ORDER BY character_id")).rows,[{character_id:cid('owner')}]);
  await retry('raid-member-leave-replay',leave);
  const disband=await ok('owner','POST','/v1/world/raids/ar-raid/leave',injection);
  assert.equal(disband.body.disbanded,true);
  assert.equal((await app.pool.query("SELECT status FROM world_raids WHERE id='ar-raid'")).rows[0].status,'abandoned');
  assert.equal((await app.pool.query("SELECT 1 FROM world_raid_members WHERE raid_id='ar-raid'")).rowCount,0);
  await retry('raid-disband-replay',disband);
  await proof.artifact('final-state.json',await snapshot());
  result={status:'PASS_SCOPED',routes:routes.length,denials:cases.length,replayComparisons:replays.length,comparedTables:tables.length,
    assertions:['native-denials-preserve-authority','principal-injection-cannot-select-owner','repair-cost-and-ledger-server-derived','repair-outcomes-charge-once','cancelled-convoy-preserves-cargo','withdrawals-affect-only-canonical-owner','raid-member-and-leader-branches','exact-http-replay-has-no-new-effect'],fullAuthorityCoverage:false,releaseReady:false};
} catch(error) {
  result={status:'FAIL',error:error.message,stack:error.stack,completedDenials:cases.length}; process.exitCode=1;
  await proof.artifact('failure.json',result);
} finally {
  if(app)await app.close(); if(db)await db.cleanup(db.pool);
  await proof.artifact('cases.json',{cases,replays});
  const sealed=await proof.finish(result); await verifyArtifactIndex(directory,sealed);
  console.log(JSON.stringify({status:sealed.status,source:source.revision,directory,denials:result.denials,replayComparisons:result.replayComparisons,error:result.error}));
}
