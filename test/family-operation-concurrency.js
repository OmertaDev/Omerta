// Native PostgreSQL lock proofs for the Family participant union and shared world target.
// Other Family suites cover the complete discovery/crafting/API journey.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { dbCaps } from '../src/db.js';
import { withCharacter } from '../src/game.js';
import { acceptInvite, inviteToCrew, CREW_FIRST_CHARACTER_LOCKS } from '../src/crew.js';
import { createItem, withItemTransaction } from '../src/items.js';
import { loadGraphPackages } from '../src/worldgraph.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';

assert(process.argv.includes('--postgres'), 'This observed lock proof requires --postgres');
assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit isolated PostgreSQL endpoint required');
const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
const { Pool } = await import('pg');
const base = new Pool({ connectionString: endpoint.toString() });
const namespace = `family_concurrency_${crypto.randomBytes(8).toString('hex')}`;
await base.query(`CREATE SCHEMA ${namespace}`);
const pool = new Pool({ connectionString: endpoint.toString(), max: 12,
  options: `-c search_path=${namespace} -c lock_timeout=7000 -c statement_timeout=10000` });
dbCaps.skipLocked = true;
const key = () => crypto.randomUUID();
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const releases = new Set();
async function within(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error(`${label}: exceeded the 12-second proof budget`)), 12000);
  })]); } finally { clearTimeout(timer); }
}
function pausedPool(match) {
  const reached = deferred(), resume = deferred(); let fired = false;
  releases.add(resume.resolve);
  return { reached: reached.promise, resume: resume.resolve, pool: {
    query: (...args) => pool.query(...args), async connect() {
      const client = await pool.connect();
      return { release: (...args) => client.release(...args), async query(sql, params) {
        const result = await client.query(sql, params);
        if (!fired && match(sql, params, result)) { fired = true; reached.resolve(); await resume.promise; }
        return result;
      } };
    },
  } };
}
function tracedPool(match) {
  const reached = deferred(); let fired = false;
  return { reached: reached.promise, pool: { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    return { release: (...args) => client.release(...args), async query(sql, params) {
      if (!fired && match(sql, params)) {
        fired = true; reached.resolve(Number((await client.query('SELECT pg_backend_pid() pid')).rows[0].pid));
      }
      return client.query(sql, params);
    } };
  } } };
}
async function observedLock(trace, label) {
  const pid = await within(trace.reached, `${label}: reached lock statement`), deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const row = (await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0];
    if (row?.wait_event_type === 'Lock') return;
    // Poll a real backend lock wait; elapsed sleep never establishes race ordering.
    await new Promise((done) => setTimeout(done, 20));
  }
  assert.fail(`${label}: PostgreSQL never reported the required lock wait`);
}
const settle = (promise) => promise.then((value) => ({ value }), (error) => ({ error }));
const registry = loadGraphPackages([{ id: 'family-lock-fixture', version: 1, dependsOn: [], nodes: [
  { id: 'item:family-lock-key', type: 'item_template', version: 1, visibility: 'public' },
] }]);
const object = { id: 'facility:family-lock-target', type: 'facility', title: 'Locked workshop', locationId: 'docks',
  states: ['closed', 'open'], initialState: 'closed', publicStates: ['closed', 'open'], knowledge: [],
  actions: [{ id: 'open', from: 'closed', to: 'open', itemTemplateId: 'item:family-lock-key', materials: [] }] };
const definition = { id: 'operation:family-lock', version: 1, title: 'Open the workshop', lifetimeSeconds: 3600,
  executorRoleId: 'organizer', roles: [
    { id: 'organizer', title: 'Organizer', requirements: [{ id: 'presence', kind: 'participation', quantity: 1 }] },
    { id: 'supplier', title: 'Supplier', requirements: [
      { id: 'key', kind: 'item', templateId: 'item:family-lock-key', quantity: 1 },
      { id: 'funding', kind: 'capital', quantity: 100 },
    ] },
  ], world: { objectId: object.id, actionId: 'open', itemRoleId: 'supplier', itemRequirementId: 'key' },
  resolution: { chancePermille: 1000, skillBonuses: [] } };
function service(selectedPool = pool) {
  const kernel = createWorldKernel({ pool: selectedPool, registry, objects: [object], enabled: true,
    knowledgeEnabled: true, sharingEnabled: true });
  return { kernel, api: createFamilyOperations({ pool: selectedPool, registry, kernel, definitions: [definition],
    enabled: true, knowledgeEnabled: true, sharingEnabled: true }) };
}
const { api, kernel } = service();
const command = (run, actor, action, value = {}, selectedApi = api, commandKey = key()) =>
  selectedApi.command(actor, run.id, action, value, commandKey);
async function player(id, family, role) {
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$2,1,'docks',10000,100000)", [`${id}-ch`, id]);
  await pool.query('INSERT INTO gang_members(gang_id,character_id,role) VALUES($1,$2,$3)', [family, `${id}-ch`, role]);
}
async function family(name) {
  const group = { familyId: `family-${name}`, crewId: `crew-${name}`, boss: `boss-${name}`,
    donor: `donor-${name}`, replacement: `replacement-${name}` };
  await pool.query('INSERT INTO gangs(id,name,tag) VALUES($1,$1,$2)', [group.familyId, name.toUpperCase()]);
  await player(group.boss, group.familyId, 'boss');
  await player(group.donor, group.familyId, 'soldier');
  await player(group.replacement, group.familyId, 'soldier');
  await pool.query('INSERT INTO crews(id,name,leader_account) VALUES($1,$1,$2)', [group.crewId, group.boss]);
  await pool.query('INSERT INTO crew_members(crew_id,account_id,name) VALUES($1,$2,$2)', [group.crewId, group.boss]);
  return group;
}
async function draft(group) {
  const receipt = await api.create(group.boss, { definitionId: definition.id }, key());
  const run = { ...group, id: receipt.operationId };
  await command(run, group.boss, 'publish');
  await command(run, group.boss, 'join', { roleId: 'organizer' });
  await command(run, group.donor, 'join', { roleId: 'supplier' });
  return run;
}
async function fulfill(run, actor, requirementId, extra = {}) {
  await command(run, actor, 'commit', { requirementId });
  await command(run, actor, 'contribute', { requirementId, ...extra });
}
async function historicalDepositor(name) {
  const run = await draft(await family(name));
  await fulfill(run, run.donor, 'funding');
  await command(run, run.donor, 'leave');
  await command(run, run.replacement, 'join', { roleId: 'supplier' });
  await command(run, run.replacement, 'commit', { requirementId: 'funding' });
  assert.equal((await pool.query('SELECT state FROM world_operation_capital WHERE operation_id=$1', [run.id])).rows[0].state, 'refunded');
  for (const table of ['world_operation_roles', 'world_operation_commitments']) {
    assert.equal((await pool.query(`SELECT 1 FROM ${table} WHERE operation_id=$1 AND account_id=$2`, [run.id, run.donor])).rows.length, 0,
      'Original depositor occurs only in capital history, not the current role/promise union');
  }
  await withCharacter(pool, run.boss, (ch, client, h) => inviteToCrew(ch, run.donor, client, h), CREW_FIRST_CHARACTER_LOCKS);
  return run;
}
const snapshotTables = ['world_operations', 'world_operation_roles', 'world_operation_commitments',
  'world_operation_contributions', 'world_operation_capital', 'world_operation_events', 'world_kernel_objects',
  'world_kernel_events', 'item_instances', 'item_stacks', 'operation_escrow', 'item_events', 'item_mutation_guards'];
async function snapshot() {
  const records = await Promise.all(snapshotTables.map(async (table) => [table,
    (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]));
  const cash = (await pool.query('SELECT id,cash FROM characters ORDER BY id')).rows;
  return { records: Object.fromEntries(records), cash };
}
const characterLock = (actor) => (sql, params) => sql === 'SELECT * FROM characters WHERE account_id = $1 AND alive FOR UPDATE' && params[0] === actor;
const accept = (selectedPool, run) => withCharacter(selectedPool, run.donor, (ch, client, h) => acceptInvite(ch, run.crewId, client, h));

try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  // Invite acceptance holds the historical depositor character first. Cancellation
  // must release its Crew lock through a mapped NOWAIT rollback, not wait in ABBA.
  const first = await historicalDepositor('first');
  const invitation = pausedPool(characterLock(first.donor));
  const accepting = settle(accept(invitation.pool, first));
  await within(invitation.reached, 'Invite owns historical depositor');
  const before = await snapshot();
  const refusal = await within(settle(command(first, first.boss, 'cancel')), 'Coordinator must not wait behind invite');
  assert.equal(refusal.error?.code, 'contention');
  assert.deepEqual(await snapshot(), before, 'NOWAIT refusal preserves custody, cash, history and receipt state');
  invitation.resume();
  const accepted = await within(accepting, 'Invite completes after coordinator rollback');
  assert.ifError(accepted.error); assert.equal(accepted.value.crew, 'joined');
  assert.equal((await api.get(first.boss, first.id)).status, 'recruiting');

  // Reverse order: the coordinator already owns the complete union. Real invite
  // acceptance is observed waiting on that historical character, then succeeds.
  const second = await historicalDepositor('second');
  const cancellation = pausedPool((sql, params) => sql === "SELECT * FROM world_operations WHERE id=$1 AND coordination_mode='family' FOR UPDATE" && params[0] === second.id);
  const canceling = settle(command(second, second.boss, 'cancel', {}, service(cancellation.pool).api));
  await within(cancellation.reached, 'Coordinator owns participant union');
  const inviteTrace = tracedPool(characterLock(second.donor));
  const acceptingSecond = settle(accept(inviteTrace.pool, second));
  await observedLock(inviteTrace, 'Invite waits for coordinator participant lock');
  cancellation.resume();
  const canceled = await within(canceling, 'Coordinator cancellation commits');
  assert.ifError(canceled.error); assert.equal(canceled.value.status, 'canceled');
  const acceptedSecond = await within(acceptingSecond, 'Reverse-order invite completes');
  assert.ifError(acceptedSecond.error); assert.equal(acceptedSecond.value.crew, 'joined');
  assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [`${second.donor}-ch`])).rows[0].cash), 100000);

  // Disjoint participant sets reach the same existing world row. The losing
  // operation must return contention before consuming any escrow or cash.
  const siblings = [];
  for (const name of ['left', 'right']) {
    const run = await draft(await family(name));
    const item = await withItemTransaction(pool, (client) => createItem(client, { scope: 'account', id: run.donor },
      'item:family-lock-key', 'crafted', key()));
    run.itemId = item.id;
    await fulfill(run, run.boss, 'presence');
    await fulfill(run, run.donor, 'funding');
    await fulfill(run, run.donor, 'key', { itemId: item.id });
    await command(run, run.boss, 'approve');
    assert.equal((await api.get(run.boss, run.id)).readiness.ready, true);
    siblings.push(run);
  }
  await pool.query('INSERT INTO world_kernel_objects(id,object_kind,definition_hash,state,revision,location_id) VALUES($1,$2,$3,$4,0,$5)',
    [object.id, object.type, kernel.definitions[0].contentHash, object.initialState, object.locationId]);
  const [left, right] = siblings;
  const resolving = pausedPool((sql, params) => sql === 'SELECT state,revision,definition_hash FROM world_kernel_objects WHERE id=$1 FOR UPDATE NOWAIT' && params[0] === object.id);
  const executing = settle(command(left, left.boss, 'execute', {}, service(resolving.pool).api));
  await within(resolving.reached, 'First sibling owns world row');
  const sharedBefore = await snapshot();
  const lost = await within(settle(command(right, right.boss, 'execute')), 'Sibling returns immediate world contention');
  assert.equal(lost.error?.code, 'contention');
  assert.deepEqual(await snapshot(), sharedBefore, 'World contention rolls back all losing operation side effects');
  resolving.resume();
  const won = await within(executing, 'Winning sibling commits world mutation');
  assert.ifError(won.error); assert.equal(won.value.status, 'completed'); assert.equal(won.value.world.revision, 1);
  const afterWin = await snapshot();
  const stale = await settle(command(right, right.boss, 'execute'));
  assert.equal(stale.error?.code, 'coordination_operation_not_ready');
  assert.deepEqual(await snapshot(), afterWin, 'Stale world state cannot consume losing operation deposits');
  await command(right, right.boss, 'cancel');
  assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [right.itemId])).rows[0],
    { owner_scope: 'account', owner_id: right.donor, state: 'active' });
  assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [`${right.donor}-ch`])).rows[0].cash), 100000);
  assert.equal(Number((await pool.query('SELECT count(*) n FROM world_kernel_events WHERE object_id=$1', [object.id])).rows[0].n), 1);
  assert.deepEqual(await familyOperationInvariants(pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] },
    'Indexed invariants reconcile live, canceled and completed operations with historical deposits');
  async function corrupt(sql, values, bucket, issue) {
    await assert.rejects(withItemTransaction(pool, async (client) => {
      await client.query(sql, values);
      const audit = await familyOperationInvariants(client);
      assert.equal(audit.ok, false); assert(audit[bucket].includes(issue), `${bucket} must contain ${issue}`);
      throw Object.assign(Error('Roll back deliberate invariant corruption'), { code: 'expected_corruption_rollback' });
    }), { code: 'expected_corruption_rollback' });
  }
  await corrupt('UPDATE world_operations SET revision=revision+1 WHERE id=$1', [left.id], 'historyIssues', `${left.id}:history`);
  await corrupt("UPDATE world_operation_contributions SET character_id='unrelated-character' WHERE operation_id=$1 AND node_id='supplier/key'",
    [left.id], 'custodyIssues', `${left.id}:contribution`);
  await corrupt("UPDATE world_operation_capital SET state='held' WHERE operation_id=$1", [first.id], 'capitalIssues', `${first.id}:balance`);
  assert.equal((await familyOperationInvariants(pool)).ok, true, 'Corruption probes leave the healthy native fixture unchanged');
  console.log('Family operation native concurrency: historical capital union vs real Crew invite both orders; sibling world contention/rollback/refund passed');
  console.log('Family operation indexed invariants: history, contribution custody and exact held-capital corruption detected; rollback restored healthy audit');
} finally {
  for (const release of releases) release();
  await pool.end();
  await base.query(`DROP SCHEMA ${namespace} CASCADE`);
  await base.end();
}
