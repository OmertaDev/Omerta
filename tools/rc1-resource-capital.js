// Canonical Family-operation capital lifecycle proof on isolated PostgreSQL.
// Only initial eligibility is a fixture. No persisted deadline/status is rewritten.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { makeDb } from '../src/db.js';
import { withCharacter, travel, ledger, notify, loadOwned, persistAccountFields, ESTATE_ACCOUNT_FIELDS } from '../src/game.js';
import { runEstate } from '../src/social/estate.js';
import { withItemTransaction } from '../src/items.js';
import { createCraftingContext, craftWorldGraphRecipe, salvageCar } from '../src/crafting.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS, WORLD_KERNEL_RECIPE } from '../src/content/world-kernel-pilot.js';
import { COORDINATION_OPERATION_PILOT } from '../src/content/coordination-operation-pilot.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { addedRows, equation, exactSum, negate, sha256 } from './rc1-resource-journal.js';
import { sourceInventory } from './rc1-qualification.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const development = process.argv.includes('--development');
const sourceBytes = () => Object.fromEntries(git('ls-files', '--', 'src', 'content', 'schema.sql', 'package.json', 'package-lock.json',
  'tools/rc1-resource-capital.js', 'tools/rc1-resource-journal.js').split(/\r?\n/).filter(Boolean).sort()
  .map((file) => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const source = { commit: git('rev-parse', 'HEAD'), clean: !git('status', '--porcelain'), hashes: sourceBytes() };
assert(source.clean || development, 'Commit source before a qualifying run; --development is diagnostic');
const pinnedFiles = development ? [] : sourceInventory(source.commit).files;
const assertPinnedSource = () => {
  for (const file of pinnedFiles)
    assert(file.accepted.includes(crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex')), `Checkout differs from pinned source: ${file.path}`);
};
assertPinnedSource();
assert(process.env.RC1_RESOURCE_DATABASE_URL, 'Explicit isolated PostgreSQL endpoint required');
const endpoint = new URL(process.env.RC1_RESOURCE_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
const runId = `resource-capital-${source.commit.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(process.env.RC1_RESOURCE_OUTPUT || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
assert(!fs.existsSync(path.join(output, 'result.json')), 'Never overwrite retained evidence');
fs.mkdirSync(output, { recursive: true });
const report = { schemaVersion: 1, runId, source, owner: 'Codex/resource_proof', gate: 'C02-OPERATION-CAPITAL', outcome: 'FAIL',
  evidenceClass: development ? 'DEVELOPMENT_DIAGNOSTIC' : 'NATIVE_FIXTURE_ASSISTED', startedAt: new Date().toISOString(),
  invocation: { command: 'node tools/rc1-resource-capital.js', arguments: process.argv.slice(2), node: process.version, platform: process.platform },
  configuration: { authority: 'createFamilyOperations public create/command service; runEstate canonical death transaction',
    clocks: 'Unmodified application and PostgreSQL wall clocks', fixtureExpirySeconds: 60, productionPilotExpirySeconds: 86400,
    worker: 'No Family-operation expiry worker exists; canonical expire command performs recovery',
    contractRails: 'No chain calls', simulation: false, population: 4,
    serviceFlags: { enabled: true, knowledgeEnabled: true, sharingEnabled: true },
    omittedOperatorConfiguration: 'HTTP/server feature flags, deployment services, integrations and secret-source identities are not attested by this direct-service fixture' },
  exclusions: ['Original 24-hour pilot lifetime and long-duration simulation', 'HTTP transport/authentication and full Player Command dispatcher',
    'Natural progression and combat-earned death (canonical estate transaction is invoked by the trusted harness)',
    'Full resource simulation matrix and deployed configuration', 'Process crash and backup restore; pool/service reopen only'], scenarios: [] };
const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
save();
const database = `rc1_capital_${crypto.randomBytes(8).toString('hex')}`, admin = new Pool({ connectionString: endpoint.toString() });
let pool, initialChecks, ordinal = 0;
const actors = { organizer: 'capital-organizer', locksmith: 'capital-locksmith', supplier: 'capital-supplier', researcher: 'capital-researcher' };
const character = (account) => `${account}-character`, boss = actors.organizer;
const commandKey = (name) => `rc1-capital-${name}`;
const actions = [];
const tables = ['world_operations', 'world_operation_roles', 'world_operation_commitments', 'world_operation_contributions',
  'world_operation_capital', 'world_operation_events', 'item_instances', 'item_stacks', 'operation_escrow', 'item_events',
  'item_mutation_guards', 'world_kernel_objects', 'world_kernel_events', 'gang_members', 'crew_members', 'cars'];
async function snapshot() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const state = {
      characters: (await client.query('SELECT id,account_id,cash::text,bank::text,alive FROM characters ORDER BY id')).rows,
      transactions: (await client.query('SELECT id,character_id,account_id,currency,amount::text,reason,counterparty FROM transactions ORDER BY id')).rows,
    };
    for (const table of tables) state[table] = (await client.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    state.clock = (await client.query('SELECT clock_timestamp() AS database_time, pg_current_snapshot()::text AS snapshot')).rows[0];
    await client.query('COMMIT'); return state;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
const stable = ({ clock, ...state }) => state;
const held = (state, operation) => exactSum(state.world_operation_capital.filter((row) => row.operation_id === operation && row.state === 'held').map((row) => row.amount));
async function invariants(label) {
  const result = await runLedgerInvariants(pool, { alert: false });
  initialChecks ??= result.checks;
  assert.equal(result.checks.length, initialChecks.length);
  for (const row of result.checks) {
    const baseline = initialChecks.find((entry) => entry.name === row.name); assert(baseline);
    if (!baseline.ok) assert(['character cash', 'car conservation'].includes(row.name), `Unexpected fixture drift: ${row.name}`);
    assert.equal(exactSum([row.drift]), exactSum([baseline.drift]), `${label}: ${row.name}`);
  }
  return result.checks.map((row) => ({ name: row.name, drift: row.drift, ok: row.ok, fixtureAdjustedPass: true }));
}
function movements(before, after) {
  const receipts = addedRows(before.transactions, after.transactions), checks = [];
  for (const person of after.characters) {
    const prior = before.characters.find((row) => row.id === person.id);
    const entries = receipts.filter((row) => row.character_id === person.id && row.currency === 'cash');
    const term = (reason) => exactSum(entries.filter((row) => row.reason === reason).map((row) => row.amount));
    const allowed = new Set(['coordination:capital:deposit', 'coordination:capital:refund', 'travel', 'death:estate', 'death:legacy']);
    assert(entries.every((row) => allowed.has(row.reason)), `Unclassified cash movement: ${JSON.stringify(entries)}`);
    const authority = entries.map((row) => ({ table: 'transactions', id: row.id, reason: row.reason }));
    if (!prior) authority.push({ table: 'characters', id: person.id, rule: 'runEstate creates one heir with base 500; extra legacy has its own receipt' });
    checks.push(equation({ resource: 'cash', owner: person.id, before: prior ? exactSum([prior.cash, prior.bank]) : 0,
      after: exactSum([person.cash, person.bank]), created: exactSum([prior ? 0 : 500, term('death:legacy')]),
      destroyed: negate(exactSum([term('death:estate'), term('travel')])),
      transferredOut: negate(term('coordination:capital:deposit')), transferredIn: term('coordination:capital:refund'),
      authority: authority.length ? authority : [{ rule: 'No cash receipt; owner balance unchanged' }] }));
  }
  for (const operation of new Set([...before.world_operation_capital, ...after.world_operation_capital].map((row) => row.operation_id))) {
    const entries = receipts.filter((row) => row.counterparty === operation && row.reason.startsWith('coordination:capital:'));
    const sum = (reason) => exactSum(entries.filter((row) => row.reason === `coordination:capital:${reason}`).map((row) => row.amount));
    checks.push(equation({ resource: 'cash', owner: `operation:${operation}`, before: held(before, operation), after: held(after, operation),
      transferredIn: negate(sum('deposit')), transferredOut: sum('refund'), destroyed: negate(exactSum([sum('spend'), sum('forfeit')])),
      authority: entries.length ? entries.map((row) => ({ table: 'transactions', id: row.id, reason: row.reason }))
        : [{ rule: 'No capital receipt; held custody unchanged' }] }));
    const history = after.transactions.filter((row) => row.counterparty === operation && row.reason.startsWith('coordination:capital:'));
    const total = (reason) => exactSum(history.filter((row) => row.reason === `coordination:capital:${reason}`).map((row) => row.amount));
    assert.equal(held(after, operation), exactSum([negate(total('deposit')), negate(total('refund')), total('spend'), total('forfeit')]), 'Every held unit has one receipt-backed disposition');
    for (const entry of history) {
      assert.equal(entry.currency, 'cash');
      if (['coordination:capital:spend', 'coordination:capital:forfeit'].includes(entry.reason)) {
        assert.equal(entry.character_id, null); assert.equal(entry.account_id, null);
      } else assert(entry.character_id && entry.account_id);
    }
  }
  return { checks, receipts, operationEvents: addedRows(before.world_operation_events, after.world_operation_events),
    itemEvents: addedRows(before.item_events, after.item_events) };
}
async function observe(name, action, validate = () => {}) {
  const before = await snapshot(), started = actions.length;
  let after, result, journal;
  try {
    result = await action(); after = await snapshot(); journal = movements(before, after);
    await validate({ before, after, result, ...journal });
    const canonicalInvariants = await invariants(name);
    const entry = { name, outcome: 'PASS', beforeHash: sha256(stable(before)), afterHash: sha256(stable(after)),
      boundaries: [before.clock, after.clock], actions: actions.slice(started), ...journal, canonicalInvariants };
    fs.appendFileSync(path.join(output, 'movements.ndjson'), JSON.stringify(entry) + '\n');
    report.scenarios.push({ name, outcome: 'PASS', journalHash: sha256(entry), movements: journal.checks.length }); save();
    return result;
  } catch (error) {
    if (!after) { try { after = await snapshot(); } catch { /* retain pre-state if database fails */ } }
    fs.writeFileSync(path.join(output, 'first-failed-boundary.json'), JSON.stringify({ name, before, after, result, journal,
      actions: actions.slice(started), error: { code: error.code, message: error.message, stack: error.stack } }, null, 2) + '\n');
    report.scenarios.push({ name, outcome: 'FAIL' }); save(); throw error;
  }
}
const unchanged = ({ before, after }) => assert.deepEqual(stable(after), stable(before), 'Refusal/replay/rollback changes no authoritative state');
const stateOf = (state, operation) => state.world_operation_capital.find((row) => row.operation_id === operation)?.state;
function service(name, lifetimeSeconds = 86400, selectedPool = pool) {
  const definition = structuredClone(COORDINATION_OPERATION_PILOT[0]), object = structuredClone(WORLD_KERNEL_OBJECTS[0]);
  definition.id += `.rc1-${name}`; object.id += `.rc1-${name}`; definition.world.objectId = object.id;
  definition.lifetimeSeconds = lifetimeSeconds;
  const kernel = createWorldKernel({ pool: selectedPool, registry: WORLD_KERNEL_REGISTRY, objects: [object], enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const api = createFamilyOperations({ pool: selectedPool, registry: WORLD_KERNEL_REGISTRY, kernel, definitions: [definition], enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  return { name, definition, object, api, kernel };
}
async function invoke(scenario, role, action, input = {}, key = commandKey(`${scenario.name}-${ordinal + 1}`)) {
  const request = { ordinal: ++ordinal, scenario: scenario.name, operationId: scenario.id ?? null, account: actors[role], action, input, key, startedAt: new Date().toISOString() };
  try {
    const result = action === 'create' ? await scenario.api.create(actors[role], input, key)
      : await scenario.api.command(actors[role], scenario.id, action, input, key);
    actions.push({ ...request, completedOrdinal: actions.length + 1, result }); return result;
  }
  catch (error) { actions.push({ ...request, completedOrdinal: actions.length + 1, error: { code: error.code, message: error.message } }); throw error; }
}
async function draft(name, lifetimeSeconds) {
  const scenario = service(name, lifetimeSeconds);
  await observe(`${name}:create`, async () => { const created = await invoke(scenario, 'organizer', 'create', { definitionId: scenario.definition.id }, commandKey(`${name}-create`)); scenario.id = created.operationId; return created; });
  await observe(`${name}:publish`, () => invoke(scenario, 'organizer', 'publish'));
  await observe(`${name}:join-organizer`, () => invoke(scenario, 'organizer', 'join', { roleId: 'organizer' }));
  await observe(`${name}:commit-capital`, () => invoke(scenario, 'organizer', 'commit', { requirementId: 'funding' }));
  return scenario;
}
async function deposit(scenario, name = 'deposit', key = commandKey(`${scenario.name}-deposit`)) {
  return observe(`${scenario.name}:${name}`, () => invoke(scenario, 'organizer', 'contribute', { requirementId: 'funding' }, key), ({ after, receipts }) => {
    assert.equal(stateOf(after, scenario.id), 'held'); assert.equal(held(after, scenario.id), '100');
    assert.equal(receipts.filter((row) => row.reason === 'coordination:capital:deposit').length, 1);
  });
}
async function rejected(name, action, code) {
  return observe(name, () => assert.rejects(action, { code }), unchanged);
}
async function installFailure(reason) {
  assert(['deposit', 'refund', 'spend', 'forfeit'].includes(reason));
  await pool.query(`CREATE FUNCTION rc1_capital_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.reason='coordination:capital:${reason}' THEN RAISE EXCEPTION 'rc1 deliberate capital failure'; END IF;
    RETURN NEW; END $$`);
  await pool.query('CREATE TRIGGER rc1_capital_fail BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION rc1_capital_fail()');
}
async function removeFailure() {
  await pool.query('DROP TRIGGER rc1_capital_fail ON transactions'); await pool.query('DROP FUNCTION rc1_capital_fail()');
}

try {
  await admin.query(`CREATE DATABASE ${database}`); endpoint.pathname = `/${database}`;
  process.env.DATABASE_URL = endpoint.toString(); pool = await makeDb();
  report.database = { name: database, version: (await pool.query('SELECT version() AS version')).rows[0].version };
  // Explicit pre-measurement eligibility, social and material-acquisition fixtures.
  for (const account of Object.values(actors)) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
    await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash,muscle,cunning,speed) VALUES($1,$2,$2,1,'foundry',10000,100000,50,50,50)", [character(account), account]);
  }
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES('capital-crew','Capital Crew',$1)", [boss]);
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES('capital-family','Capital Family','CAP')");
  for (const account of Object.values(actors)) {
    await pool.query("INSERT INTO crew_members(crew_id,account_id,name) VALUES('capital-crew',$1,$1)", [account]);
    await pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('capital-family',$1,$2)", [character(account), account === boss ? 'boss' : 'soldier']);
  }
  for (const role of ['locksmith', 'supplier']) await pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,'junker','stock',30)", [`capital-${role}-car`, character(actors[role])]);
  report.fixtureGrants = { accounts: Object.values(actors), perCharacter: { cash: '100000', respect: 10000, location: 'foundry', muscle: 50, cunning: 50, speed: 50 },
    family: 'capital-family', crew: 'capital-crew', cars: ['capital-locksmith-car', 'capital-supplier-car'], initialOperations: 0,
    omittedClaims: ['Natural formation/progression', 'Natural acquisition of fixture cars'] };
  const baseline = await snapshot(); fs.writeFileSync(path.join(output, 'initial-state.json'), JSON.stringify(baseline, null, 2) + '\n');
  await invariants('fixture-baseline');
  const expiry = await draft('expiry', 60); await deposit(expiry);
  await rejected('expiry:early-refused', () => invoke(expiry, 'researcher', 'expire'), 'coordination_operation_forbidden');
  const withdrawal = await draft('withdrawal');
  await installFailure('deposit');
  try { await rejected('deposit:ledger-failure-rollback', () => invoke(withdrawal, 'organizer', 'contribute', { requirementId: 'funding' }, commandKey('withdrawal-deposit')), 'P0001'); }
  finally { await removeFailure(); }
  const burst = await observe('deposit:concurrent-exact-duplicate', () => Promise.allSettled([
    invoke(withdrawal, 'organizer', 'contribute', { requirementId: 'funding' }, commandKey('withdrawal-deposit')),
    invoke(withdrawal, 'organizer', 'contribute', { requirementId: 'funding' }, commandKey('withdrawal-deposit')),
  ]), ({ result, after, receipts }) => {
    const succeeded = result.filter((row) => row.status === 'fulfilled'); assert(succeeded.length);
    for (const row of succeeded) assert.deepEqual(row.value, succeeded[0].value);
    for (const row of result.filter((entry) => entry.status === 'rejected')) assert(['contention', '55P03'].includes(row.reason.code));
    assert.equal(held(after, withdrawal.id), '100'); assert.equal(receipts.length, 1);
  });
  await observe('deposit:lost-response-replay', async () => {
    const result = await invoke(withdrawal, 'organizer', 'contribute', { requirementId: 'funding' }, commandKey('withdrawal-deposit'));
    assert.deepEqual(result, burst.find((row) => row.status === 'fulfilled').value); return result;
  }, unchanged);
  await rejected('deposit:unauthorized-role', () => invoke(withdrawal, 'researcher', 'contribute', { requirementId: 'funding' }), 'coordination_operation_role');
  await installFailure('refund');
  try { await rejected('refund:ledger-failure-rollback', () => invoke(withdrawal, 'organizer', 'withdraw', { requirementId: 'funding' }, commandKey('withdrawal-refund')), 'P0001'); }
  finally { await removeFailure(); }
  const refunded = await observe('refund:withdraw', () => invoke(withdrawal, 'organizer', 'withdraw', { requirementId: 'funding' }, commandKey('withdrawal-refund')),
    ({ after }) => assert.equal(stateOf(after, withdrawal.id), 'refunded'));
  await observe('refund:exact-replay', async () => { assert.deepEqual(await invoke(withdrawal, 'organizer', 'withdraw', { requirementId: 'funding' }, commandKey('withdrawal-refund')), refunded); }, unchanged);
  await observe('withdrawal:cancel', () => invoke(withdrawal, 'organizer', 'cancel'));
  const cancellation = await draft('cancellation'); await deposit(cancellation);
  await installFailure('refund');
  try { await rejected('cancellation:refund-rollback', () => invoke(cancellation, 'organizer', 'cancel', {}, commandKey('cancellation-cancel')), 'P0001'); }
  finally { await removeFailure(); }
  const canceled = await observe('cancellation:refund', () => invoke(cancellation, 'organizer', 'cancel', {}, commandKey('cancellation-cancel')),
    ({ after, result }) => { assert.equal(result.status, 'canceled'); assert.equal(stateOf(after, cancellation.id), 'refunded'); });
  await observe('cancellation:exact-replay', async () => { assert.deepEqual(await invoke(cancellation, 'organizer', 'cancel', {}, commandKey('cancellation-cancel')), canceled); }, unchanged);
  // Knowledge is acquired and shared through the canonical account-scoped service.
  const knowledge = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
  const social = (account, work) => withCharacter(pool, account, work);
  await observe('knowledge:travel-to-source', () => social(actors.locksmith, (ch, client, h) => travel(ch, 'docks', client, h)));
  let discovery = (await observe('knowledge:start', () => knowledge.create(actors.locksmith, graph.id, { expectedContentHash: graph.contentHash }, commandKey('knowledge-start')))).instance;
  for (const type of ['complete', 'discover']) {
    const action = discovery.actions.find((row) => row.kind === type); assert(action);
    discovery = (await observe(`knowledge:${type}`, () => knowledge.act(actors.locksmith, discovery.id,
      { expectedRevision: discovery.revision, actionId: action.id }, commandKey(`knowledge-${type}`)))).instance;
  }
  const claim = (await knowledge.knowledgeBoard(actors.locksmith)).claims[0]; assert(claim);
  for (const account of [boss, actors.researcher]) {
    const target = (await knowledge.knowledgeTargets(actors.locksmith, { characterName: account })).targets.find((row) => row.kind === 'account'); assert(target);
    const current = (await knowledge.knowledgeGet(actors.locksmith, claim.id)).claim;
    await observe(`knowledge:share:${account}`, () => knowledge.shareKnowledge(actors.locksmith, claim.id,
      { targetId: target.id, expectedAclRevision: current.aclRevision }, commandKey(`share-${account}`)));
  }
  await observe('knowledge:return-to-foundry', () => social(actors.locksmith, (ch, client, h) => travel(ch, 'foundry', client, h)));
  const crafting = createCraftingContext({ registry: WORLD_KERNEL_REGISTRY, knowledgeEnabled: true, sharingEnabled: true });
  for (const role of ['locksmith', 'supplier']) await observe(`materials:salvage:${role}`, () => withItemTransaction(pool, (client) =>
    salvageCar(client, { accountId: actors[role] }, `capital-${role}-car`, 'recipe:car_salvage_basic', commandKey(`salvage-${role}`))));
  const crafted = await observe('materials:craft-operation-key', () => withItemTransaction(pool, (client) =>
    craftWorldGraphRecipe(client, { accountId: actors.locksmith }, WORLD_KERNEL_RECIPE, commandKey('archive-key'), crafting)));
  const spending = await draft('spending'); await deposit(spending);
  for (const role of ['locksmith', 'supplier', 'researcher']) await observe(`spending:join:${role}`, () => invoke(spending, role, 'join', { roleId: role }));
  for (const role of spending.definition.roles) for (const requirement of role.requirements) {
    if (requirement.kind === 'capital') continue;
    await observe(`spending:commit:${requirement.id}`, () => invoke(spending, role.id, 'commit', { requirementId: requirement.id }));
    await observe(`spending:contribute:${requirement.id}`, () => invoke(spending, role.id, 'contribute',
      { requirementId: requirement.id, ...(requirement.kind === 'item' ? { itemId: crafted.outputs[0].id } : {}) }));
  }
  await observe('spending:approve', () => invoke(spending, 'organizer', 'approve'));
  assert((await spending.api.get(boss, spending.id)).readiness.ready, 'All canonical authored prerequisites must be met');
  await installFailure('spend');
  try { await rejected('spending:world-and-custody-rollback', () => invoke(spending, 'organizer', 'execute', {}, commandKey('spending-execute')), 'P0001'); }
  finally { await removeFailure(); }
  const spent = await observe('spending:execute', () => invoke(spending, 'organizer', 'execute', {}, commandKey('spending-execute')),
    ({ after, result }) => { assert.equal(result.status, 'completed'); assert.equal(stateOf(after, spending.id), 'spent'); assert.equal(held(after, spending.id), '0'); });
  await observe('spending:exact-replay', async () => { assert.deepEqual(await invoke(spending, 'organizer', 'execute', {}, commandKey('spending-execute')), spent); }, unchanged);
  await rejected('spending:new-key-terminal-denial', () => invoke(spending, 'organizer', 'execute'), 'coordination_operation_closed');
  // Let the validated fixture deadline actually pass. Both clocks remain real.
  const deadline = new Date((await expiry.api.get(boss, expiry.id)).expiresAt).getTime();
  while (Date.now() <= deadline) {
    const remaining = deadline - Date.now() + 30;
    console.log(`Waiting for actual operation expiry: ${Math.ceil(remaining / 1000)} seconds remain`);
    await new Promise((resolve) => setTimeout(resolve, Math.min(20000, remaining)));
  }
  const clock = (await pool.query('SELECT clock_timestamp() AS now')).rows[0].now;
  assert(new Date(clock).getTime() >= deadline, 'Database and application agree the untouched deadline elapsed');
  await installFailure('refund');
  try { await rejected('expiry:refund-rollback', () => invoke(expiry, 'researcher', 'expire', {}, commandKey('expiry-expire')), 'P0001'); }
  finally { await removeFailure(); }
  const expired = await observe('expiry:canonical-refund', () => invoke(expiry, 'researcher', 'expire', {}, commandKey('expiry-expire')),
    ({ after, result }) => { assert.equal(result.status, 'expired'); assert.equal(stateOf(after, expiry.id), 'refunded'); });
  await observe('expiry:exact-replay', async () => { assert.deepEqual(await invoke(expiry, 'researcher', 'expire', {}, commandKey('expiry-expire')), expired); }, unchanged);
  const death = await draft('death'); await deposit(death);
  let heir;
  await observe('death:canonical-estate-and-heir', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const victim = (await client.query('SELECT * FROM characters WHERE id=$1 AND alive FOR UPDATE', [character(boss)])).rows[0];
      const victimAcct = (await client.query('SELECT * FROM account_persistent WHERE account_id=$1 FOR UPDATE', [boss])).rows[0];
      const victimOwned = await loadOwned(client, victim);
      const estate = await runEstate(client, { ledger, notify, victimAcct, victimOwned }, victim, 'RC1 resource proof');
      await persistAccountFields(client, boss, victimAcct, ESTATE_ACCOUNT_FIELDS);
      await client.query('COMMIT'); heir = estate.heirId; return { heirId: heir };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }, ({ after }) => { assert.equal(stateOf(after, death.id), 'held'); assert(after.characters.find((row) => row.id === heir)?.alive); });
  const heirBefore = (await snapshot()).characters.find((row) => row.id === heir).cash;
  await installFailure('forfeit');
  try { await rejected('death:forfeit-rollback', () => invoke(death, 'organizer', 'cancel', {}, commandKey('death-cancel')), 'P0001'); }
  finally { await removeFailure(); }
  const forfeited = await observe('death:replacement-cancellation-forfeits', () => invoke(death, 'organizer', 'cancel', {}, commandKey('death-cancel')),
    ({ after, result }) => {
      assert.equal(result.status, 'canceled'); assert.equal(stateOf(after, death.id), 'forfeited');
      assert.equal(after.characters.find((row) => row.id === heir).cash, heirBefore, 'Heir receives no original depositor capital');
    });
  await observe('death:forfeit-exact-replay', async () => { assert.deepEqual(await invoke(death, 'organizer', 'cancel', {}, commandKey('death-cancel')), forfeited); }, unchanged);
  const beforeRestart = await snapshot(); await pool.end(); pool = await makeDb();
  assert.deepEqual(stable(await snapshot()), stable(beforeRestart));
  const reopened = service('death'); reopened.id = death.id;
  await observe('restart:forfeit-receipt', async () => { assert.deepEqual(await invoke(reopened, 'organizer', 'cancel', {}, commandKey('death-cancel')), forfeited); }, unchanged);
  const final = await snapshot();
  assert.equal(final.world_operation_capital.filter((row) => row.state === 'held').length, 0, 'All deposited capital has a terminal disposition');
  assert.equal(final.world_operation_capital.length, 5);
  for (const row of final.world_operation_capital) {
    assert.equal(row.account_id, boss); assert.equal(row.character_id, character(boss));
    assert.equal(row.role_id, 'organizer'); assert.equal(row.requirement_id, 'funding'); assert.equal(exactSum([row.amount]), '100');
    const entries = final.transactions.filter((entry) => entry.counterparty === row.operation_id && entry.reason.startsWith('coordination:capital:'));
    assert.equal(entries.length, 2, 'Exactly one deposit and one terminal disposition per requirement');
    for (const entry of entries.filter((entry) => entry.reason.endsWith(':deposit') || entry.reason.endsWith(':refund'))) {
      assert.equal(entry.account_id, row.account_id); assert.equal(entry.character_id, row.character_id);
    }
  }
  report.dispositions = Object.fromEntries(['held', 'refunded', 'spent', 'forfeited'].map((state) => [state,
    exactSum(final.world_operation_capital.filter((row) => row.state === state).map((row) => row.amount))]));
  assert.deepEqual(report.dispositions, { held: '0', refunded: '300', spent: '100', forfeited: '100' });
  fs.writeFileSync(path.join(output, 'final-state.json'), JSON.stringify(final, null, 2) + '\n');
  report.outcome = 'SCOPED_PASS';
} catch (error) { report.error = { code: error.code, message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  if (pool) await pool.end(); await admin.end();
  try { assert.equal(git('rev-parse', 'HEAD'), source.commit); assert.deepEqual(sourceBytes(), source.hashes); assertPinnedSource(); report.source.immutableDuringRun = true; }
  catch (error) { report.source.immutableDuringRun = false; report.source.error = error.message; report.outcome = 'FAIL'; process.exitCode = 1; }
  report.endedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, 'actions.json'), JSON.stringify(actions, null, 2) + '\n');
  report.artifacts = fs.readdirSync(output).filter((file) => file !== 'result.json').map((file) => ({ file,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') }));
  save(); console.log(JSON.stringify({ runId, outcome: report.outcome, output, error: report.error?.message }));
}
