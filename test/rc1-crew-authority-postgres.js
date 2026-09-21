// Scoped full-server Crew authority and persistent HTTP replay regression.
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
const source = await sourceIdentity(), directory = path.resolve(process.env.RC1_CREW_AUTHORITY_OUTPUT || `output/rc1-crew-authority-${source.revision.slice(0, 8)}`);
const { commandDatabase, addPlayer, characterId } = await import('./lib/player-command-support.js');
const { buildServer } = await import('../src/server.js');
const { CREW } = await import('../src/rules.js');
const configuration = { phase: 'local-prerelease', database: 'explicit loopback private schema', originalWorkers: false,
  fixtures: 'Seven funded level-eligible living players and one account without character; initial last_accrued_at one hour ahead isolates separately committed accrual. All Crew memberships, invites, requests, targets and chat use canonical HTTP.',
  authorityComparison: 'All current-schema tables except persistent HTTP idempotency transport cache; one PostgreSQL MVCC statement; no sequence or worker-concurrency claim',
  exclusions: ['Complete global authority matrix', 'Natural progression', 'Objective reward success or expiry', 'Websocket delivery', 'Client rendering/XSS execution', 'Native worker/deployment/physical-device behavior', 'Arbitrary concurrent leave/kick/use schedules', 'HTTP receipt expiration'] };
const proof = await createProofRecorder({ directory, source, configuration, runId: `crew-authority-${source.revision.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`,
  seed: 'crew-authority-v1', scenarioId: 'legacy-crew-authority', population: 8 });
const roles = ['boss', 'member', 'otherboss', 'othermember', 'outsider', 'requester', 'invitee', 'fresh'];
const accounts = Object.fromEntries(roles.map(role => [role, `ca-${role}`]));
const names = Object.fromEntries(roles.map(role => [role, `Crew ${role}`]));
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
  db = await commandDatabase('crew_authority');
  const schema = (await db.pool.query('SELECT current_schema() AS name')).rows[0].name;
  assert(/^command_crew_authority_[a-f0-9]+$/.test(schema));
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL); endpoint.searchParams.set('options', `-c search_path=${schema}`); process.env.DATABASE_URL = endpoint.toString();
  await boot();
  for (const role of roles.filter(role => role !== 'fresh')) await addPlayer(app.pool, accounts[role], names[role], 'foundry');
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [accounts.fresh]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [accounts.fresh]);
  await app.pool.query("UPDATE characters SET last_accrued_at=now()+interval '1 hour'");
  for (const role of roles) tokens[role] = app.jwt.sign({ sub: accounts[role], tv: 0 });
  const a = (await ok('boss', 'POST', '/v1/crew', { name: 'Authority A' })).body.id;
  const b = (await ok('otherboss', 'POST', '/v1/crew', { name: 'Authority B' })).body.id;
  for (const [leader, member, crew] of [['boss', 'member', a], ['otherboss', 'othermember', b]]) {
    await ok(leader, 'POST', '/v1/crew/invite', { name: names[member] }); await ok(member, 'POST', `/v1/crew/accept/${crew}`);
  }
  await ok('boss', 'POST', '/v1/crew/recruiting', { on: true });
  await ok('requester', 'POST', `/v1/crew/request/${a}`);
  await ok('member', 'POST', '/v1/crew/invite', { name: names.invitee }); // Ordinary members may invite by design.
  tables = (await app.pool.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename', [schema])).rows.map(r => r.tablename).filter(name => name !== 'idempotency');
  assert(tables.every(name => /^[a-z_0-9]+$/.test(name)));
  stateSQL = tables.map(name => `SELECT '${name}' AS name, COALESCE(jsonb_agg(v ORDER BY v::text),'[]'::jsonb)::text AS rows FROM (SELECT to_jsonb(t) AS v FROM "${name}" t) q`).join(' UNION ALL ');
  const routes = app.routes.filter(r => ['POST', 'DELETE'].includes(r.method) && /^\/v1\/crew(?:\/|$)/.test(r.url)).map(r => `${r.method} ${r.url}`).sort();
  assert.equal(routes.length, 14, 'Crew mutation inventory changed; review every addition');
  await proof.artifact('inventory.json', { routes, authorityTables: tables, postgres: (await app.pool.query('SELECT version() AS version')).rows[0].version, configuration });
  const initial = await snapshot(); phase = 'measured';
  for (const route of routes) {
    const [method, pattern] = route.split(' '), url = pattern.replace(':crewId', a).replace(':characterId', characterId(accounts.requester));
    const payload = { name: names.outsider, text: 'isolated authority probe', on: true, kind: 'kill' };
    await deny(`${route}:anonymous`, null, null, method, url, payload, 401);
    // Crew-first lock hooks reject missing membership before the character lookup.
    const crewFirst = ['DELETE /v1/crew/member/:characterId', 'POST /v1/crew/leave',
      'POST /v1/crew/request/:characterId/accept', 'POST /v1/crew/recruiting'].includes(route);
    await deny(`${route}:no-character`, crewFirst ? 'no_crew' : 'no_character', 'fresh', method, url, payload);
  }
  const leaderOnly = [['DELETE', `/v1/crew/member/${characterId(accounts.member)}`, {}], ['POST', '/v1/crew/recruiting', { on: false }],
    ['POST', `/v1/crew/request/${characterId(accounts.requester)}/accept`, {}], ['DELETE', `/v1/crew/request/${characterId(accounts.requester)}`, {}],
    ['POST', '/v1/crew/target', { name: names.outsider, kind: 'kill' }], ['DELETE', '/v1/crew/target', {}]];
  for (const [method, url, payload] of leaderOnly) {
    await deny(`${method} ${url}:member`, 'not_leader', 'member', method, url, { ...payload, leader_account: accounts.member, crewId: a });
    await deny(`${method} ${url}:outsider`, 'no_crew', 'outsider', method, url, { ...payload, accountId: accounts.boss, crewId: a });
  }
  await deny('foreign-Crew-kick', 'not_member', 'boss', 'DELETE', `/v1/crew/member/${characterId(accounts.othermember)}`);
  await deny('foreign-Crew-request-accept', 'no_request', 'otherboss', 'POST', `/v1/crew/request/${characterId(accounts.requester)}/accept`);
  await deny('foreign-Crew-request-decline', 'no_request', 'otherboss', 'DELETE', `/v1/crew/request/${characterId(accounts.requester)}`);
  await deny('stolen-invite-accept', 'no_invite', 'outsider', 'POST', `/v1/crew/accept/${a}`, { accountId: accounts.invitee });
  await deny('stolen-invite-decline', 'no_invite', 'outsider', 'POST', `/v1/crew/decline/${a}`, { accountId: accounts.invitee });
  await deny('member-create-another', 'in_crew', 'member', 'POST', '/v1/crew', { name: 'Forbidden Duplicate' });
  await deny('member-request-another', 'in_crew', 'member', 'POST', `/v1/crew/request/${b}`);
  await deny('target-own-member', 'crew', 'boss', 'POST', '/v1/crew/target', { name: names.member });
  await deny('claim-incomplete', 'not_done', 'member', 'POST', '/v1/crew/objective/claim', { reward: 999999, accountId: accounts.boss });
  await deny('claim-outsider', 'no_crew', 'outsider', 'POST', '/v1/crew/objective/claim', { crewId: a });
  await deny('chat-outsider', 'no_crew', 'outsider', 'POST', '/v1/crew/chat', { text: 'foreign room', crewId: a });
  const target = await ok('boss', 'POST', '/v1/crew/target', { name: names.outsider, kind: 'hospitalize' }); await retry('target-exact-retry', target);
  const chat = await ok('member', 'POST', '/v1/crew/chat', { text: 'Private Crew evidence line' }); await retry('chat-exact-retry', chat);
  assert((await ok('boss', 'GET', '/v1/crew/chat')).body.messages.some(row => row.text === 'Private Crew evidence line'));
  assert.deepEqual((await ok('outsider', 'GET', '/v1/crew/chat')).body.messages, []);
  assert.deepEqual((await ok('othermember', 'GET', '/v1/crew/chat')).body.messages, []);
  const accept = await ok('boss', 'POST', `/v1/crew/request/${characterId(accounts.requester)}/accept`); await retry('accept-request-retry', accept);
  const decline = await ok('invitee', 'POST', `/v1/crew/decline/${a}`); await retry('decline-invite-retry', decline);
  const leave = await ok('requester', 'POST', '/v1/crew/leave'); await retry('leave-retry', leave);
  await retry('old-accepted-request-after-leave', accept);
  assert.equal((await app.pool.query('SELECT count(*) n FROM crew_members WHERE account_id=$1', [accounts.requester])).rows[0].n, '0');
  await ok('requester', 'POST', `/v1/crew/request/${a}`);
  const declineRequest = await ok('boss', 'DELETE', `/v1/crew/request/${characterId(accounts.requester)}`); await retry('decline-request-retry', declineRequest);
  const clear = await ok('boss', 'DELETE', '/v1/crew/target'); await retry('clear-target-retry', clear);
  const key = crypto.randomUUID(), beforeConcurrent = await snapshot();
  const pair = await Promise.all([ok('boss', 'DELETE', `/v1/crew/member/${characterId(accounts.member)}`, {}, key), ok('boss', 'DELETE', `/v1/crew/member/${characterId(accounts.member)}`, {}, key)]);
  assert.equal(pair.filter(row => !row.replayed).length, 1, 'Concurrent same-key kick must have one fresh effect');
  assert.deepEqual(pair[0].body, pair[1].body); const kicked = pair.find(row => !row.replayed);
  const afterConcurrent = await snapshot(); await proof.artifact('concurrent-kick.json', { before: beforeConcurrent.hash, after: afterConcurrent.hash, pair });
  await deny('revoked-member-target', 'no_crew', 'member', 'POST', '/v1/crew/target', { name: names.outsider });
  await deny('revoked-member-chat', 'no_crew', 'member', 'POST', '/v1/crew/chat', { text: 'after revocation' });
  assert.deepEqual((await ok('member', 'GET', '/v1/crew/chat')).body.messages, []);
  await retry('historic-chat-after-revocation-no-write', chat);
  const restartBefore = await snapshot(); await app.close(); app = null; await boot(); const restartAfter = await snapshot();
  await proof.artifact('restart-bootstrap.json', { before: restartBefore.hash, after: restartAfter.hash, note: 'Bootstrap compared separately; replay comparisons include every authority table before/after each retry.' });
  for (const [id, row] of [['kick', kicked], ['accepted-then-left', accept], ['chat-after-revocation', chat], ['target-cleared', target]]) await retry(`restart-${id}`, row);
  const crewRows = (await app.pool.query('SELECT c.id,c.leader_account,count(m.account_id)::int members FROM crews c LEFT JOIN crew_members m ON m.crew_id=c.id GROUP BY c.id,c.leader_account ORDER BY c.id')).rows;
  assert(crewRows.every(row => row.members >= 1 && row.members <= CREW.MAX_MEMBERS));
  const final = await snapshot();
  const balances = snapshotRows => JSON.parse(snapshotRows.find(row => row.name === 'characters').rows).map(row => ({ id: row.id, cash: row.cash, bank: row.bank, ammo: row.ammo, cb: row.cb })).sort((a,b)=>a.id.localeCompare(b.id));
  assert.deepEqual(balances(final.rows), balances(initial.rows), 'Coordination-only actions moved character resources');
  result = { status: 'PASS_SCOPED', routes: routes.length, denials: cases.length, replayComparisons: replays.length, concurrentFreshEffects: 1,
    comparedTables: tables.length, retainedSnapshots: snapshots.size, requestCount: requests.length, crewRows, restartCanonicalStateEqual: restartBefore.hash === restartAfter.hash,
    initialStateHash: initial.hash, finalStateHash: final.hash, configuration, fullAuthorityCoverage: false, releaseReady: false };
} catch (error) {
  result = { status: 'FAIL', error: error.message, stack: error.stack, completedDenials: cases.filter(row=>row.status==='PASS').length, configuration };
  await proof.artifact('failure.json', result); process.exitCode = 1;
} finally {
  if (app) await app.close();
  if (db) await db.cleanup(db.pool);
  await proof.artifact('cases.json', { cases, replays });
  const sealed = await proof.finish(result); await verifyArtifactIndex(directory, sealed);
  console.log(JSON.stringify({ status: sealed.status, source: source.revision, denials: result.denials, replayComparisons: result.replayComparisons, directory, error: result.error }));
}
