// Native Family conservation proof; the observer never mutates gameplay state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { addedRows, equation, exactSum, negate, sha256 } from './rc1-resource-journal.js';
import { sourceInventory } from './rc1-qualification.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const development = process.argv.includes('--development');
const terminalFixtures = process.argv.includes('--terminal-fixtures');
const sourceBytes = () => Object.fromEntries(git('ls-files', '--', 'src', 'content', 'schema.sql', 'package.json', 'package-lock.json',
  'tools/rc1-resource-family.js', 'tools/rc1-resource-journal.js', 'tools/rc1-qualification.mjs').split(/\r?\n/).filter(Boolean).sort()
  .map((file) => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const source = { commit: git('rev-parse', 'HEAD'), clean: !git('status', '--porcelain'), hashes: sourceBytes() };
assert(source.clean || development, 'Commit source before a native evidence run');
const pinnedFiles = development ? [] : sourceInventory(source.commit).files;
function assertPinned() {
  for (const file of pinnedFiles) assert(file.accepted.includes(crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex')), `Unpinned source: ${file.path}`);
}
assertPinned();
assert(process.env.RC1_RESOURCE_DATABASE_URL, 'Explicit isolated PostgreSQL administrative endpoint required');
const endpoint = new URL(process.env.RC1_RESOURCE_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
const runId = `resource-family-${source.commit.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(process.env.RC1_RESOURCE_OUTPUT || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
assert(!fs.existsSync(path.join(output, 'result.json')), 'Never overwrite evidence'); fs.mkdirSync(output, { recursive: true });
const report = { schemaVersion: 1, runId, source, owner: 'Codex/resource_proof', gate: 'C02-FAMILY-TREASURY', outcome: 'FAIL',
  gateStatus: 'OPEN_REQUIRED_PROOF', evidenceClass: development ? 'DEVELOPMENT_DIAGNOSTIC' : 'NATIVE_FIXTURE_ASSISTED',
  startedAt: new Date().toISOString(), invocation: { command: 'node tools/rc1-resource-family.js', arguments: process.argv.slice(2), node: process.version, platform: process.platform },
  configuration: { terminalFixtures, clocks: 'Unmodified application and PostgreSQL wall clocks', chain: 'unconfigured', workers: 'explicit canonical resolver calls only',
    timerMode: terminalFixtures ? 'Initial scored-war/open-contest fixtures expire after 60 real seconds' : 'Canonical declaration/scoring and new contests use original production lifetimes',
    operatorConfiguration: 'Local fixture flags only; installed dependency tree and deployed services/integrations are not attested' },
  exclusions: ['Natural account progression and Family formation; baseline grants are disclosed', 'Full-resource simulation and deployed-environment attestation',
    'Crash/backup restore; server reopen only', 'Other Family resource systems outside tribute/reserve, war, turf and dissolution'], scenarios: [] };
if (terminalFixtures) report.exclusions.push('Canonical war declaration/scoring and full production contest/war lifetime');
const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n'); save();
const database = `rc1_family_${crypto.randomBytes(8).toString('hex')}`, admin = new Pool({ connectionString: endpoint.toString() });
let app, baselineChecks, ordinal = 0;
const actors = {}, requests = [];
const family = (role) => `family-proof-${role}`, character = (role) => `family-proof-${role}-character`;
const commandKey = (name) => `rc1-family-${name}`;
const snapshotQueries = {
  characters: 'SELECT id,account_id,cash::text,bank::text,ammo,cb,alive FROM characters ORDER BY id',
  accounts: 'SELECT account_id,omr::text,staked::text,rewards::text,unbonding::text FROM account_persistent ORDER BY account_id',
  desk: 'SELECT id,balance::text,lifetime_in::text,lifetime_sold::text,lifetime_bought::text FROM desk_inventory ORDER BY id',
  families: 'SELECT * FROM gangs ORDER BY id', members: 'SELECT * FROM gang_members ORDER BY gang_id,character_id',
  districts: 'SELECT * FROM districts ORDER BY id', bids: 'SELECT * FROM district_bids ORDER BY district_id,gang_id',
  transactions: 'SELECT id,character_id,account_id,currency,amount::text,reason,counterparty FROM transactions ORDER BY id',
  cars: 'SELECT * FROM cars ORDER BY id', territory: 'SELECT * FROM territory_rackets ORDER BY district_id',
};
async function snapshot() {
  const client = await app.pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const state = {};
    for (const [key, sql] of Object.entries(snapshotQueries)) state[key] = (await client.query(sql)).rows;
    state.clock = (await client.query('SELECT clock_timestamp() AS now, pg_current_snapshot()::text AS snapshot')).rows[0];
    await client.query('COMMIT'); return state;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
const stable = ({ clock, ...state }) => state;
const gang = (state, id) => state.families.find((row) => row.id === id);
const escrow = (state, id) => exactSum(state.bids.filter((row) => row.gang_id === id).map((row) => row.amount));
const unchanged = ({ before, after }) => assert.deepEqual(stable(after), stable(before), 'Replay/refusal/abort must preserve all observed authoritative state');
async function invariants() {
  const { runLedgerInvariants } = await import('../src/invariants.js'); const result = await runLedgerInvariants(app.pool, { alert: false });
  baselineChecks ??= result.checks; assert.equal(result.checks.length, baselineChecks.length);
  for (const check of result.checks) {
    const initial = baselineChecks.find((row) => row.name === check.name); assert(initial);
    if (!initial.ok) assert(['character cash', '$OMR conservation', 'car conservation'].includes(initial.name), `Unexpected fixture drift: ${initial.name}`);
    assert.equal(exactSum([check.drift]), exactSum([initial.drift]), `Canonical invariant changed: ${check.name}`);
  }
  return result.checks.map((row) => ({ name: row.name, drift: row.drift, ok: row.ok, fixtureAdjustedPass: true }));
}
function reconcile(before, after, transfers = []) {
  const receipts = addedRows(before.transactions, after.transactions), equations = [];
  const authority = (rows) => rows.length ? rows.map((row) => ({ table: 'transactions', id: row.id, reason: row.reason })) : [{ rule: 'No receipt: balance unchanged' }];
  const sum = (rows, reason) => exactSum(rows.filter((row) => row.reason === reason).map((row) => row.amount));
  for (const ch of after.characters) for (const resource of ['cash', 'ammo', 'cb']) {
    const prior = before.characters.find((row) => row.id === ch.id); assert(prior);
    const rows = receipts.filter((row) => row.character_id === ch.id && row.currency === resource);
    const transfersIn = rows.filter((row) => row.reason === 'jump:steal');
    const transfersOut = rows.filter((row) => ['gang:tribute', 'jump:stolen'].includes(row.reason));
    const creation = rows.filter((row) => row.reason === 'melt');
    const destruction = rows.filter((row) => row.reason === 'jump');
    assert.equal(rows.length, transfersIn.length + transfersOut.length + creation.length + destruction.length, 'Unclassified personal movement');
    equations.push(equation({ resource, owner: ch.id, before: resource === 'cash' ? exactSum([prior.cash, prior.bank]) : prior[resource],
      after: resource === 'cash' ? exactSum([ch.cash, ch.bank]) : ch[resource], created: exactSum(creation.map((row) => row.amount)),
      destroyed: negate(exactSum(destruction.map((row) => row.amount))), transferredIn: exactSum(transfersIn.map((row) => row.amount)),
      transferredOut: negate(exactSum(transfersOut.map((row) => row.amount))), authority: authority(rows) }));
  }
  for (const account of after.accounts) {
    const prior = before.accounts.find((row) => row.account_id === account.account_id); assert(prior);
    const rows = receipts.filter((row) => row.account_id === account.account_id && row.currency === 'omr');
    assert(rows.every((row) => row.reason === 'gang:tribute'));
    equations.push(equation({ resource: 'omr', owner: account.account_id, before: prior.omr, after: account.omr,
      transferredOut: negate(exactSum(rows.map((row) => row.amount))), authority: authority(rows) }));
  }
  const recycled = receipts.filter((row) => row.reason === 'desk:recycle');
  assert(recycled.every((row) => row.currency === 'omr' && ['vanity:gang:seal', 'gang:dissolved'].includes(row.counterparty)));
  equations.push(equation({ resource: 'omr', owner: 'desk_inventory', before: before.desk[0].balance, after: after.desk[0].balance,
    transferredIn: exactSum(recycled.map((row) => row.amount)), authority: authority(recycled) }));
  const ids = new Set([...before.families.map((row) => row.id), ...after.families.map((row) => row.id),
    ...before.bids.map((row) => row.gang_id), ...after.bids.map((row) => row.gang_id)]);
  for (const id of ids) {
    const prior = gang(before, id), final = gang(after, id);
    for (const [resource, field] of [['cash', 'treasury'], ['omr', 'omr_reserve'], ['ammo', 'ammo_bank']]) {
      const rows = receipts.filter((row) => row.counterparty === id && row.currency === resource);
      const from = transfers.filter((row) => row.from === id), to = transfers.filter((row) => row.to === id);
      const burns = rows.filter((row) => row.reason === 'gang:dissolved' || row.reason === 'vanity:gang:seal' || row.reason === 'gang:war' || row.reason.startsWith('turf:seize:'));
      const known = new Set(['gang:tribute', 'melt:tithe', 'turf:claim', 'turf:claim:refund', 'turf:claim:burn']);
      assert(rows.every((row) => known.has(row.reason) || burns.includes(row)), 'Unclassified Family movement');
      equations.push(equation({ resource, owner: id, before: prior?.[field] ?? 0, after: final?.[field] ?? 0,
        created: sum(rows, 'melt:tithe'), destroyed: resource === 'omr' ? '0' : negate(exactSum(burns.map((row) => row.amount))),
        transferredIn: exactSum([negate(sum(rows, 'gang:tribute')), sum(rows, 'turf:claim:refund'), ...(resource === 'cash' ? to.map((row) => row.amount) : [])]),
        transferredOut: exactSum([negate(sum(rows, 'turf:claim')), ...(resource === 'cash' ? from.map((row) => row.amount) : []),
          ...(resource === 'omr' ? burns.map((row) => negate(row.amount)) : [])]),
        authority: [...authority(rows), ...[...from, ...to].map((row) => ({ rule: 'resolveWarIfDue canonical outcome and locked paired treasury transfer', ...row }))] }));
    }
    const rows = receipts.filter((row) => row.counterparty === id && row.currency === 'cash' && row.reason.startsWith('turf:claim'));
    equations.push(equation({ resource: 'cash', owner: `turf-escrow:${id}`, before: escrow(before, id), after: escrow(after, id),
      transferredIn: negate(sum(rows, 'turf:claim')), transferredOut: sum(rows, 'turf:claim:refund'), destroyed: negate(sum(rows, 'turf:claim:burn')), authority: authority(rows) }));
  }
  return { receipts, equations, transfers };
}
async function observe(name, action, validate = () => {}, transfers = () => []) {
  const before = await snapshot(), requestStart = requests.length; let after, result, journal;
  try {
    result = await action(); after = await snapshot(); journal = reconcile(before, after, transfers({ before, after, result }));
    await validate({ before, after, result, ...journal }); const checks = await invariants();
    const entry = { name, outcome: 'PASS', beforeHash: sha256(stable(before)), afterHash: sha256(stable(after)),
      boundaries: [before.clock, after.clock], requests: requests.slice(requestStart), ...journal, canonicalInvariants: checks };
    fs.appendFileSync(path.join(output, 'movements.ndjson'), JSON.stringify(entry) + '\n');
    report.scenarios.push({ name, outcome: 'PASS', journalHash: sha256(entry), equations: journal.equations.length }); save(); return result;
  } catch (error) {
    let snapshotError; if (!after) try { after = await snapshot(); } catch (failure) { snapshotError = failure.message; }
    fs.writeFileSync(path.join(output, 'first-failed-boundary.json'), JSON.stringify({ name, before, after, result, journal,
      requests: requests.slice(requestStart), snapshotError, error: { code: error.code, message: error.message, stack: error.stack } }, null, 2) + '\n');
    report.scenarios.push({ name, outcome: 'FAIL' }); save(); throw error;
  }
}
async function call(role, url, key, body, expected = [200]) {
  const order = ++ordinal, response = await app.inject({ method: 'POST', url, headers: {
    authorization: `Bearer ${actors[role].token}`, 'idempotency-key': commandKey(key) }, payload: body });
  const result = { status: response.statusCode, body: response.json(), replayed: response.headers['x-idempotent-replay'] === 'true' };
  requests.push({ order, completedOrder: requests.length + 1, role, url, key: commandKey(key), body, ...result });
  assert(expected.includes(result.status), `${url}: ${result.status} ${JSON.stringify(result.body)}`); return result;
}
async function replay(name, role, url, key, body, prior) {
  return observe(name, async () => { const result = await call(role, url, key, body); assert(result.replayed); assert.deepEqual(result.body, prior.body); return result; }, unchanged);
}
async function ledgerFailure(reason, currency = null) {
  assert(/^[a-z:]+$/.test(reason)); assert(currency === null || ['omr', 'cash', 'ammo'].includes(currency));
  await app.pool.query(`CREATE FUNCTION rc1_family_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.reason='${reason}' ${currency ? `AND NEW.currency='${currency}'` : ''} THEN RAISE EXCEPTION 'rc1 deliberate Family ledger failure'; END IF; RETURN NEW; END $$`);
  await app.pool.query('CREATE TRIGGER rc1_family_fail BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION rc1_family_fail()');
}
async function removeLedgerFailure() { await app.pool.query('DROP TRIGGER rc1_family_fail ON transactions'); await app.pool.query('DROP FUNCTION rc1_family_fail()'); }
async function failedCall(name, role, url, key, body) { return observe(name, () => call(role, url, key, body, [500]), unchanged); }
async function resolveWar(id) {
  const { resolveWarIfDue } = await import('../src/social/gangs.js'); const client = await app.pool.connect();
  try { await client.query('BEGIN'); const result = await resolveWarIfDue(client, id); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

try {
  await admin.query(`CREATE DATABASE ${database}`); endpoint.pathname = `/${database}`; process.env.DATABASE_URL = endpoint.toString();
  process.env.JWT_SECRET = `rc1-family-${crypto.randomBytes(32).toString('hex')}`; process.env.MOD_KEY = `rc1-family-${crypto.randomBytes(32).toString('hex')}`;
  Object.assign(process.env, { MARKET_SEED: 'rc1-family-proof-fixed-market-fixture-v1', SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off' });
  for (const name of ['CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'REDIS_URL', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL']) delete process.env[name];
  const { buildServer } = await import('../src/server.js'); const { M3, seasonFx } = await import('../src/rules.js');
  const { resolveContest } = await import('../src/social/gangs.js'); app = await buildServer();
  report.database = { name: database, version: (await app.pool.query('SELECT version() AS version')).rows[0].version };
  report.productionTimers = { warMs: M3.WAR_MS, contestMs: M3.CONTEST_MS, currentSeasonContestMultiplier: seasonFx('contestMsMult') };
  for (const role of ['a', 'b', 'c', 'd', 'e']) {
    const account = `family-proof-${role}-account`;
    await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
    await app.pool.query('INSERT INTO account_persistent(account_id,omr) VALUES($1,$2)', [account, role === 'd' ? 2000 : 0]);
    await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash,muscle,speed,energy) VALUES($1,$2,$1,1,'foundry',10000,1000000,$3,$3,200)", [character(role), account, role === 'a' ? 500 : 1]);
    actors[role] = { account, token: app.jwt.sign({ sub: account, tv: 0 }) };
    if (role !== 'e') await app.pool.query('INSERT INTO gangs(id,name,tag) VALUES($1,$2,$3)', [family(role), `Proof Family ${role.toUpperCase()}`, `F${role.toUpperCase()}`]);
    await app.pool.query('INSERT INTO gang_members(gang_id,character_id,role) VALUES($1,$2,$3)', [family(role === 'e' ? 'd' : role), character(role), role === 'e' ? 'soldier' : 'boss']);
  }
  await app.pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES('family-melt-car',$1,'junker','stock',20)", [character('d')]);
  for (const district of ['foundry', 'brick']) await app.pool.query('UPDATE districts SET holder_gang=NULL,npc_holder=NULL,garrison=0,watch_hour=NULL,contest_until=NULL WHERE id=$1', [district]);
  if (terminalFixtures) {
    const deadline = new Date(Date.now() + 60000);
    await app.pool.query('UPDATE gangs SET war_with=$2,war_until=$3,war_score_us=$4,war_score_them=$5 WHERE id=$1', [family('a'), family('b'), deadline, 1, 0]);
    await app.pool.query('UPDATE gangs SET war_with=$2,war_until=$3,war_score_us=$4,war_score_them=$5 WHERE id=$1', [family('b'), family('a'), deadline, 0, 1]);
    for (const district of ['foundry', 'brick']) await app.pool.query('UPDATE districts SET holder_gang=$2,garrison=30000,contest_until=$3 WHERE id=$1', [district, family('a'), deadline]);
  }
  report.fixtureGrants = { accounts: 5, cashPerCharacter: '1000000', omrTotal: '2000', families: 4, memberships: 5,
    allInitialFamilyBuckets: '0', cars: 1, eligibility: 'respect10000; attacker muscle/speed500, other actors1; energy200; default ammo25',
    districts: terminalFixtures ? 'Two initially held empty contests with 60-second deadlines' : 'Two initially unheld districts; no contest',
    war: terminalFixtures ? 'Initially paired scored war with 60-second deadline' : 'No initial war; declaration and scoring must be canonical' };
  fs.writeFileSync(path.join(output, 'initial-state.json'), JSON.stringify(await snapshot(), null, 2) + '\n'); await invariants();
  await ledgerFailure('gang:tribute', 'cash');
  try { await failedCall('tribute:cash-ledger-rollback', 'a', '/v1/gangs/tribute', 'tribute-a', { amount: 700000 }); }
  finally { await removeLedgerFailure(); }
  for (const [role, amount] of [['a', 700000], ['b', 700000], ['c', 200000], ['d', 1000]]) {
    const tribute = await observe(`tribute:cash:${role}`, () => call(role, '/v1/gangs/tribute', `tribute-${role}`, { amount }), ({ receipts }) => {
      assert.equal(receipts.length, 1); assert.equal(receipts[0].reason, 'gang:tribute'); assert.equal(receipts[0].amount, negate(String(amount)));
    });
    if (role === 'a') await replay('tribute:cash-exact-replay', role, '/v1/gangs/tribute', `tribute-${role}`, { amount }, tribute);
  }
  // Start the production clocks immediately; all shorter branches run while they elapse.
  if (!terminalFixtures) {
    const declared = await observe('war:canonical-declaration', () => call('a', `/v1/gangs/war/${family('b')}`, 'declare-war'));
    assert(new Date(declared.body.until).getTime() - Date.now() > M3.WAR_MS - 10000);
    await replay('war:declaration-exact-replay', 'a', `/v1/gangs/war/${family('b')}`, 'declare-war', undefined, declared);
    await observe('war:canonical-score', () => call('a', `/v1/streets/${character('b')}/jump`, 'war-score'), ({ result, after }) => {
      assert(result.body.win && result.body.war); assert.equal(Number(gang(after, family('a')).war_score_us), 1);
    });
    for (const district of ['foundry', 'brick']) await observe(`turf:canonical-seize:${district}`, () => call('a', `/v1/districts/${district}/seize`, `seize-${district}`));
  }
  const stake = async (role, district, amount) => observe(`turf:stake:${district}:${role}`, () => call(role, `/v1/districts/${district}/claim`, `stake-${district}-${role}`, { amount }));
  const first = await stake('a', 'foundry', 100000); await stake('b', 'foundry', 150000); await stake('c', 'foundry', 120000);
  await stake('a', 'brick', 100000); await stake('b', 'brick', 100000);
  await replay('turf:stake-exact-replay', 'a', '/v1/districts/foundry/claim', 'stake-foundry-a', { amount: 100000 }, first);
  await observe('turf:lower-stake-denial', () => call('a', '/v1/districts/foundry/claim', 'lower-stake', { amount: 90000 }, [400]), unchanged);
  await ledgerFailure('turf:claim');
  try { await failedCall('turf:stake-ledger-rollback', 'b', '/v1/districts/foundry/claim', 'raise-b', { amount: 160000 }); }
  finally { await removeLedgerFailure(); }
  await observe('turf:stake-retry-after-rollback', () => call('b', '/v1/districts/foundry/claim', 'raise-b', { amount: 160000 }));
  await ledgerFailure('gang:tribute', 'omr');
  try { await failedCall('tribute:omr-ledger-rollback', 'd', '/v1/gangs/tribute/omr', 'omr-tribute', { amount: 500 }); }
  finally { await removeLedgerFailure(); }
  const omr = await observe('tribute:omr-concurrent-duplicate', () => Promise.all([
    call('d', '/v1/gangs/tribute/omr', 'omr-tribute', { amount: 500 }, [200, 409]),
    call('d', '/v1/gangs/tribute/omr', 'omr-tribute', { amount: 500 }, [200, 409]),
  ]), ({ result, receipts }) => { assert(result.some((row) => row.status === 200)); assert.equal(receipts.length, 1); assert.equal(receipts[0].amount, '-500'); });
  await replay('tribute:omr-exact-replay', 'd', '/v1/gangs/tribute/omr', 'omr-tribute', { amount: 500 }, omr.find((row) => row.status === 200));
  await observe('reserve:unauthorized-seal', () => call('e', '/v1/gangs/vanity/seal', 'seal-denied', undefined, [400]), unchanged);
  await ledgerFailure('vanity:gang:seal');
  try { await failedCall('reserve:seal-ledger-rollback', 'd', '/v1/gangs/vanity/seal', 'seal'); } finally { await removeLedgerFailure(); }
  const seal = await observe('reserve:seal-spend', () => call('d', '/v1/gangs/vanity/seal', 'seal'), ({ after, receipts }) => {
    assert.equal(gang(after, family('d')).seal, 1);
    assert.equal(exactSum(receipts.filter((row) => row.reason === 'vanity:gang:seal').map((row) => row.amount)), '-150');
    assert.equal(exactSum(receipts.filter((row) => row.reason === 'desk:recycle').map((row) => row.amount)), '150');
  });
  await replay('reserve:seal-exact-replay', 'd', '/v1/gangs/vanity/seal', 'seal', undefined, seal);
  const melt = await observe('armory:canonical-melt-tithe', () => call('d', '/v1/garage/family-melt-car/melt', 'melt'), ({ result }) => assert(result.body.tithe > 0));
  await replay('armory:melt-exact-replay', 'd', '/v1/garage/family-melt-car/melt', 'melt', undefined, melt);
  await observe('dissolution:bidder-leaves-before-settlement', () => call('c', '/v1/gangs/leave', 'bidder-leave'), ({ after, result }) => {
    assert(result.body.dissolved); assert.equal(escrow(after, family('c')), '120000'); assert(!gang(after, family('c')));
  });
  // Last-member cleanup must be atomic even after cash and OMR burn receipts were inserted.
  await ledgerFailure('gang:dissolved', 'ammo');
  try {
    const departure = await observe('dissolution:first-member-leave', () => call('e', '/v1/gangs/leave', 'first-leave'));
    assert.equal(departure.body.dissolved, false);
    await failedCall('dissolution:late-ammo-ledger-rollback', 'd', '/v1/gangs/leave', 'last-leave');
  } finally { await removeLedgerFailure(); }
  // Rejoin through the canonical route so the final departure batch races two real members.
  await observe('dissolution:canonical-rejoin', () => call('e', `/v1/gangs/${family('d')}/join`, 'rejoin'));
  const left = await observe('dissolution:concurrent-last-members', () => Promise.all([
    call('d', '/v1/gangs/leave', 'last-leave'), call('e', '/v1/gangs/leave', 'second-leave'),
  ]), ({ result, before, after, receipts }) => {
    assert.equal(result.filter((row) => row.body.dissolved).length, 1); assert(!gang(after, family('d')));
    for (const [currency, field] of [['cash', 'treasury'], ['omr', 'omr_reserve'], ['ammo', 'ammo_bank']]) {
      const rows = receipts.filter((row) => row.reason === 'gang:dissolved' && row.currency === currency);
      assert.equal(rows.length, 1); assert.equal(exactSum(rows.map((row) => row.amount)), negate(String(gang(before, family('d'))[field])));
      assert(Number(gang(before, family('d'))[field]) > 0);
    }
  });
  await replay('dissolution:exact-replay', 'd', '/v1/gangs/leave', 'last-leave', undefined, left[0]);
  const waiting = await snapshot();
  report.deadlines = { war: gang(waiting, family('a')).war_until, contests: waiting.districts.filter((row) => ['foundry', 'brick'].includes(row.id)).map((row) => ({ district: row.id, until: row.contest_until })) }; save();
  const deadline = Math.max(new Date(report.deadlines.war).getTime(), ...report.deadlines.contests.map((row) => new Date(row.until).getTime()));
  while (Date.now() <= deadline) {
    console.log(JSON.stringify({ runId, stage: 'waiting-for-original-deadlines', secondsRemaining: Math.ceil((deadline - Date.now()) / 1000) }));
    await new Promise((resolve) => setTimeout(resolve, Math.min(20000, deadline - Date.now() + 25)));
  }
  assert(new Date((await app.pool.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime() >= deadline);
  // A late credit failure happens after the loser debit, inside the real resolver transaction.
  await app.pool.query(`CREATE FUNCTION rc1_war_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.id='${family('a')}' AND NEW.treasury > OLD.treasury THEN RAISE EXCEPTION 'rc1 deliberate spoils failure'; END IF; RETURN NEW; END $$`);
  await app.pool.query('CREATE TRIGGER rc1_war_fail BEFORE UPDATE ON gangs FOR EACH ROW EXECUTE FUNCTION rc1_war_fail()');
  try { await observe('war:spoils-credit-rollback', () => assert.rejects(() => resolveWar(family('a')), { code: 'P0001' }), unchanged); }
  finally { await app.pool.query('DROP TRIGGER rc1_war_fail ON gangs'); await app.pool.query('DROP FUNCTION rc1_war_fail()'); }
  await observe('war:concurrent-terminal-resolution', () => Promise.all([resolveWar(family('a')), resolveWar(family('b'))]), ({ result, before, after, receipts }) => {
    assert.equal(result.filter(Boolean).length, 1); const settled = result.find(Boolean);
    assert.equal(settled.winner, family('a')); assert.equal(settled.spoils, Math.floor(Number(gang(before, family('b')).treasury) * M3.WAR_SPOILS)); assert(settled.spoils > 0);
    assert.equal(receipts.length, 0, 'Canonical war spoils are an internal transfer, not a mint/burn receipt');
    assert.equal(Number(gang(after, family('a')).wars_won), 1); assert.equal(gang(after, family('a')).war_with, null);
  }, ({ result }) => [{ from: family('b'), to: family('a'), amount: result.find(Boolean).spoils }]);
  await observe('war:terminal-replay', () => resolveWar(family('a')), unchanged);
  await ledgerFailure('turf:claim:refund');
  try { await observe('turf:settlement-refund-rollback', () => assert.rejects(() => resolveContest(app.pool, 'foundry'), { code: 'P0001' }), unchanged); }
  finally { await removeLedgerFailure(); }
  await observe('turf:concurrent-challenger-and-dead-bidder-settlement', () => Promise.all([resolveContest(app.pool, 'foundry'), resolveContest(app.pool, 'foundry')]), ({ result, before, after, receipts }) => {
    assert.equal(result.filter((row) => row?.bids > 0).length, 1); assert.equal(after.districts.find((row) => row.id === 'foundry').holder_gang, family('b'));
    const dead = receipts.filter((row) => row.counterparty === family('c')); assert.equal(dead.length, 1); assert.equal(dead[0].reason, 'turf:claim:burn'); assert.equal(dead[0].amount, '-120000');
    assert.equal(exactSum(receipts.filter((row) => row.reason === 'turf:claim:refund').map((row) => row.amount)), '50000');
    assert.equal(exactSum(receipts.filter((row) => row.reason === 'turf:claim:burn').map((row) => row.amount)), '-330000');
  });
  await observe('turf:defender-tie-settlement', () => resolveContest(app.pool, 'brick'), ({ result, receipts }) => {
    assert.equal(result.winner, family('a')); assert.equal(result.changed, false);
    assert.equal(exactSum(receipts.filter((row) => row.reason === 'turf:claim:refund').map((row) => row.amount)), '50000');
    assert.equal(exactSum(receipts.filter((row) => row.reason === 'turf:claim:burn').map((row) => row.amount)), '-150000');
  });
  await observe('turf:terminal-replay', () => resolveContest(app.pool, 'foundry'), unchanged);
  const beforeRestart = await snapshot(); await app.close(); app = await buildServer(); assert.deepEqual(stable(await snapshot()), stable(beforeRestart));
  await replay('dissolution:server-reopen-replay', 'd', '/v1/gangs/leave', 'last-leave', undefined, left[0]);
  await observe('war:server-reopen-replay', () => resolveWar(family('a')), unchanged);
  await observe('turf:server-reopen-replay', () => resolveContest(app.pool, 'brick'), unchanged);
  const final = await snapshot(); assert.equal(final.bids.length, 0); assert(final.families.every((row) => !row.war_with));
  fs.writeFileSync(path.join(output, 'final-state.json'), JSON.stringify(final, null, 2) + '\n'); report.outcome = 'SCOPED_PASS';
} catch (error) { report.error = { code: error.code, message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  if (app) await app.close(); await admin.end();
  try { assert.equal(git('rev-parse', 'HEAD'), source.commit); assert.deepEqual(sourceBytes(), source.hashes); assertPinned(); report.source.immutableDuringRun = true; }
  catch (error) { report.source.immutableDuringRun = false; report.source.error = error.message; report.outcome = 'FAIL'; process.exitCode = 1; }
  report.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, 'requests.json'), JSON.stringify(requests, null, 2) + '\n');
  const publicCoverage = { schemaVersion: 1, source: source.commit, outcome: report.outcome, gate: report.gate, gateStatus: report.gateStatus,
    fixtureAssisted: true, timerMode: report.configuration.timerMode, executedScenarios: report.scenarios.filter((row) => row.outcome === 'PASS').map((row) => row.name),
    failures: report.scenarios.filter((row) => row.outcome !== 'PASS').map((row) => row.name), exclusions: report.exclusions,
    remaining: ['Full native simulation/resource matrix', 'Deployed source/configuration/dependency attestation', 'Complete broader Family resource and charter variants'],
    owner: report.owner, rerun: 'node tools/rc1-resource-family.js', privacy: 'No tokens, raw requests, actor identities or connection strings included' };
  fs.writeFileSync(path.join(output, 'coverage-summary.json'), JSON.stringify(publicCoverage, null, 2) + '\n');
  report.artifacts = fs.readdirSync(output).filter((file) => file !== 'result.json').map((file) => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') }));
  save(); console.log(JSON.stringify({ runId, outcome: report.outcome, output, error: report.error?.message }));
}
