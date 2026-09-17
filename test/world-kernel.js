// Phase 1 vertical slice through real social, discovery, salvage, crafting and world services.
// PostgreSQL uses only an explicit loopback scratch database and a disposable schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { bus, travel, withCharacter } from '../src/game.js';
import { createCrew, inviteToCrew, acceptInvite, leaveCrew, CREW_FIRST_CHARACTER_LOCKS } from '../src/crew.js';
import { createGang, joinGang, leaveGang, kickMember as kickFamilyMember, promoteMember } from '../src/social.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import { createCraftingContext, craftWorldGraphRecipe, salvageCar } from '../src/crafting.js';
import { inventoryBoard, transferItem, withItemTransaction } from '../src/items.js';
import { compileWorldObjects, createWorldKernel } from '../src/world-kernel.js';

const postgres = process.argv.includes('--postgres');
let pool, cleanup, reopen;
if (postgres) {
  assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit WORLD_KERNEL_TEST_DATABASE_URL required');
  const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
  const { Pool } = await import('pg');
  const base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `world_kernel_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  reopen = () => new Pool({ connectionString: endpoint.toString(),
    options: `-c search_path=${namespace} -c lock_timeout=10000 -c statement_timeout=15000` });
  pool = reopen();
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true });
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg();
  reopen = () => new Pool(); pool = reopen(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}

const key = () => crypto.randomUUID();
const reject = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const requirement = { contentHash: graph.contentHash, ...graph.nodes.find(({ id }) => id === 'docks-source').claim };
const recipeId = 'recipe:kernel_lock_tool';
const registry = loadAndValidateGraphPackages([...PHASE1_WORLD_GRAPH_PACKAGES, {
  id: 'world-kernel-fixture', version: 1, season: 'core', dependsOn: ['core-materials', 'automotive-salvage'],
  nodes: [{ id: recipeId, type: 'recipe', version: 1, visibility: 'public', repeatability: 'repeatable',
    consumes: [{ templateId: 'mat:wire', quantity: 1, quality: 'standard' }],
    produces: [{ templateId: 'item:precision_lock_tool', quantity: 1 }],
    conditions: [{ adapter: 'knowledge', requirement }], metadata: { title: 'Recorded lock tool' } }],
}]);
const object = (id) => ({ id, type: 'workshop', title: 'The abandoned press', locationId: 'foundry',
  states: ['sealed', 'operational'], initialState: 'sealed', publicStates: ['operational'], knowledge: [requirement],
  actions: [{ id: 'restore', from: 'sealed', to: 'operational', itemTemplateId: 'item:precision_lock_tool',
    materials: [{ templateId: 'mat:scrap_steel', quantity: 2 }, { templateId: 'mat:salvage_parts', quantity: 1 }] }] });
const objects = ['workshop:press', 'workshop:race', 'workshop:update-rollback', 'workshop:event-rollback',
  'workshop:family-race', 'workshop:crew-race', 'workshop:knowledge-race'].map(object);
const owner = (id) => ({ scope: 'account', id });
const tx = (action) => withItemTransaction(pool, action);
const social = (id, action, hooks) => withCharacter(pool, id, action, hooks);
const crafting = createCraftingContext({ registry, knowledgeEnabled: true, sharingEnabled: true });
const coordination = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const observed = { commits: 0, eventWrites: 0, eventCommits: 0 };
function observedPool({ failAfter = null } = {}) {
  let failed = false;
  return { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    let wroteEvent = false;
    return { release: (...args) => client.release(...args), async query(sql, params) {
      const statement = typeof sql === 'string' ? sql : sql.text;
      const result = await client.query(sql, params);
      if (/^INSERT INTO world_kernel_events\b/.test(statement.trim())) { wroteEvent = true; observed.eventWrites++; }
      if (statement === 'COMMIT') { observed.commits++; if (wroteEvent) observed.eventCommits++; }
      if (!failed && failAfter?.test(statement)) {
        failed = true; throw Object.assign(Error('injected world write failure'), { code: 'injected_world_failure' });
      }
      return result;
    } };
  } };
}
const service = (options = {}) => createWorldKernel({ pool: observedPool(), registry, objects,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true, ...options });
const engine = service();
const notifications = [];
const onChanged = (event) => notifications.push({ event, committedEvents: observed.eventCommits });
const input = (objectId, itemId, expectedRevision = 0) => ({ objectId, actionId: 'restore', itemId, expectedRevision });
const snapshotTables = ['world_kernel_objects', 'world_kernel_events', 'item_instances', 'item_stacks',
  'item_events', 'item_mutation_guards', 'transactions', 'characters'];
const snapshot = async () => Object.fromEntries(await Promise.all(snapshotTables.map(async (table) => [table,
  (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
async function denied(accountId, payload, code = 'world_unavailable', target = engine) {
  const before = await snapshot(), hints = notifications.length;
  await reject(target.execute(accountId, payload, key()), code);
  assert.deepEqual(await snapshot(), before, 'Refused world action must preserve canonical objects, inventory and audit records');
  assert.equal(notifications.length, hints, 'Refused action must not emit a world change');
}
async function player(id, name) {
  await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$3)', [id, 'test', id]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  await pool.query('INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$3,1,$4,10000,100000)',
    [`${id}-ch`, id, name, 'foundry']);
  return id;
}
async function discover(accountId) {
  let run = (await coordination.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  const act = async (action) => {
    assert(action, 'Discovery must use a currently issued action');
    run = (await coordination.act(accountId, run.id,
      { expectedRevision: run.revision, actionId: action.id }, key())).instance;
  };
  await act(run.actions.find(({ kind, nodeId }) => kind === 'complete' && nodeId === 'briefing'));
  await act(run.actions.find(({ kind }) => kind === 'discover'));
  return (await coordination.knowledgeBoard(accountId)).claims[0].id;
}

const pendingReleases = new Set();
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
async function within(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, fail) => {
    timer = setTimeout(() => fail(Error(`${label}: exceeded the 12-second proof budget`)), 12000);
  })]); } finally { clearTimeout(timer); }
}
// Pauses only after PostgreSQL has executed the matched statement and acquired its locks.
function pausedPool(match) {
  const reached = deferred(), resume = deferred();
  pendingReleases.add(resume.resolve);
  let fired = false;
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
// withCharacter can use more than one connection for settlement and its action.
// Identify the backend at the relevant lock statement, not merely at first connect.
function tracedPool(match) {
  const waiting = deferred(); let fired = false;
  return { waiting: waiting.promise, pool: { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    return { release: (...args) => client.release(...args), async query(sql, params) {
      if (!fired && match(sql, params)) {
        fired = true; waiting.resolve(Number((await client.query('SELECT pg_backend_pid() pid')).rows[0].pid));
      }
      return client.query(sql, params);
    } };
  } } };
}
async function observedLock(trace, label) {
  const pid = await within(trace.waiting, `${label}: lock statement reached`);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const row = (await pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0];
    if (row?.wait_event_type === 'Lock') return;
    // This interval polls an actual PostgreSQL wait, never assumes a race won after a sleep.
    await new Promise((done) => setTimeout(done, 20));
  }
  assert.fail(`${label}: PostgreSQL never reported the required lock wait`);
}
const mutationSnapshot = async () => Object.fromEntries(await Promise.all(snapshotTables
  .filter((table) => !['characters', 'transactions'].includes(table)).map(async (table) => [table,
    (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));

try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const boss = await player('kernel-boss', 'Kernel Boss');
  const member = await player('kernel-member', 'Kernel Member');
  const outsider = await player('kernel-outsider', 'Kernel Outsider');
  bus.on('world:changed', onChanged);

  // These relationships use the game's normal mutation wrappers and domain commands.
  const crew = await social(boss, (ch, client, h) => createCrew(ch, 'Press Crew', client, h));
  await social(boss, (ch, client, h) => inviteToCrew(ch, 'Kernel Member', client, h), CREW_FIRST_CHARACTER_LOCKS);
  await social(member, (ch, client, h) => acceptInvite(ch, crew.id, client, h));
  const family = await social(boss, (ch, client, h) => createGang(ch, 'Press Family', 'PRES', client, h));
  await social(member, (ch, client, h) => joinGang(ch, family.gangId, client, h));
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM crew_members WHERE crew_id=$1', [crew.id])).rows[0].n), 2);
  assert.equal((await pool.query('SELECT role FROM gang_members WHERE character_id=$1', [`${boss}-ch`])).rows[0].role, 'boss');

  await reject(engine.get(outsider, objects[0].id), 'world_unavailable');
  await reject(engine.get(boss, objects[0].id), 'world_unavailable');
  await reject(service({ enabled: false }).get(boss, objects[0].id), 'world_unavailable');
  await reject(service({ accountIds: [outsider] }).get(boss, objects[0].id), 'world_unavailable');
  for (let index = 0; index < 3; index++) {
    const carId = `kernel-junker-${index}`;
    await pool.query('INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,$3,$4,60)',
      [carId, `${boss}-ch`, 'junker', 'stock']);
    const receipt = await tx((client) => salvageCar(client, { accountId: boss }, carId, 'recipe:car_salvage_basic', key()));
    assert(receipt.outputs.some(({ templateId }) => templateId === 'mat:wire'));
  }
  const salvaged = await inventoryBoard(pool, owner(boss));
  assert.equal(salvaged.stacks.find(({ templateId }) => templateId === 'mat:wire').qty, 6);
  assert.equal((await pool.query('SELECT id FROM cars WHERE character_id=$1', [`${boss}-ch`])).rows.length, 0);
  await reject(tx((client) => craftWorldGraphRecipe(client, { accountId: boss }, recipeId, key(), crafting)), 'knowledge_required');
  await social(boss, (ch, client, h) => travel(ch, 'docks', client, h));
  const claimId = await discover(boss);
  assert.equal((await engine.get(boss, objects[0].id)).state, 'sealed');
  assert.equal((await engine.get(boss, objects[0].id)).revision, 0);
  await reject(engine.get(outsider, objects[0].id), 'world_unavailable');
  const items = [];
  for (let index = 0; index < 5; index++) {
    const receipt = await tx((client) => craftWorldGraphRecipe(client, { accountId: boss }, recipeId, key(), crafting));
    items.push(receipt.outputs[0].id);
  }
  assert(items.every(Boolean));
  const provenance = (await pool.query("SELECT item_id,provenance_kind FROM item_events WHERE event_kind='created'")).rows;
  assert.equal(provenance.length, 5); assert(provenance.every(({ provenance_kind }) => provenance_kind === 'crafted'));
  await tx((client) => transferItem(client, owner(boss), owner(outsider), items[4], 'fixture foreign custody', key()));
  const main = input(objects[0].id, items[0]);
  const collectiveObject = structuredClone(objects[0]);
  collectiveObject.actions[0].execution = 'family_operation';
  const collectiveOnly = service({ objects: [collectiveObject] });
  await denied(boss, main, 'world_unavailable', collectiveOnly);
  assert.notEqual(collectiveOnly.definitions[0].contentHash, engine.definitions[0].contentHash,
    'Collective-only authorization is part of the pinned object definition');
  await denied(boss, main); // Actor is still in docks, while the physical object is in foundry.
  await social(boss, (ch, client, h) => travel(ch, 'foundry', client, h));
  await denied(boss, input(objects[0].id, items[4]));
  await denied(member, main, 'world_forbidden');
  await denied(outsider, main);
  await denied(boss, main, 'world_unavailable', service({ knowledgeEnabled: false }));
  await denied(boss, { ...main, familyId: family.gangId }, 'bad_world_definition');
  await denied(boss, { ...main, expectedRevision: -1 }, 'bad_world_request');

  await social(member, (ch, client, h) => leaveGang(ch, client, h));
  const divergent = await social(member, (ch, client, h) => createGang(ch, 'Other Family', 'OTHR', client, h));
  await denied(boss, main);
  // A member leaving the rival family uses the real domain path; the owner's Family remains.
  await social(member, (ch, client, h) => leaveGang(ch, client, h));
  await social(member, (ch, client, h) => joinGang(ch, family.gangId, client, h));
  assert.notEqual(divergent.gangId, family.gangId);
  await pool.query("UPDATE accounts SET status='banned' WHERE id=$1", [boss]);
  await denied(boss, main);
  await pool.query("UPDATE accounts SET status='active' WHERE id=$1", [boss]);
  await pool.query('UPDATE characters SET alive=false WHERE account_id=$1', [member]);
  await denied(boss, main);
  await pool.query('UPDATE characters SET alive=true WHERE account_id=$1', [member]);
  console.log('world-kernel: real Crew/Family, salvage/discovery/crafting, provenance and authority gates pass');

  const firstKey = key(), beforeMain = await inventoryBoard(pool, owner(boss));
  const first = await engine.execute(boss, main, firstKey);
  assert.equal(first.state, 'operational'); assert.equal(first.revision, 1);
  assert.equal(notifications.length, 1); assert.equal(notifications[0].committedEvents, 1);
  assert.deepEqual(notifications[0].event, { objectId: objects[0].id, revision: 1 });
  const afterMain = await inventoryBoard(pool, owner(boss));
  assert.equal(afterMain.items.length, beforeMain.items.length - 1);
  for (const [templateId, spent] of [['mat:scrap_steel', 2], ['mat:salvage_parts', 1]]) {
    assert.equal(beforeMain.stacks.find((stack) => stack.templateId === templateId).qty
      - afterMain.stacks.find((stack) => stack.templateId === templateId).qty, spent);
  }
  const publicState = await engine.get(outsider, objects[0].id);
  assert.equal(publicState.state, 'operational'); assert.equal(publicState.controllerFamilyId, family.gangId);
  for (const secret of [claimId, requirement.contentHash, requirement.domain, requirement.proposition, requirement.sourceRoot]) {
    assert(!JSON.stringify(publicState).includes(secret), 'Object projection does not expose knowledge provenance');
  }
  const event = (await pool.query('SELECT * FROM world_kernel_events WHERE id=$1', [first.eventId])).rows[0];
  assert.equal(event.crew_id, crew.id); assert.equal(event.family_id, family.gangId);
  assert.equal(event.actor_account_id, boss); assert.equal(event.item_id, items[0]);
  const committed = await snapshot();
  assert.deepEqual(await engine.execute(boss, main, firstKey), first);
  assert.deepEqual(await snapshot(), committed); assert.equal(notifications.length, 1);
  await reject(engine.execute(boss, { ...main, itemId: items[1] }, firstKey), 'idempotency_conflict');
  await denied(boss, input(objects[0].id, items[1]), 'world_stale');
  assert.equal((await engine.get(outsider, objects[0].id)).revision, 1, 'Stale action cannot erase the committed object');

  const raceInput = input(objects[1].id, items[1]);
  const raced = await Promise.allSettled([engine.execute(boss, raceInput, key()), engine.execute(boss, raceInput, key())]);
  assert.equal(raced.filter(({ status }) => status === 'fulfilled').length, 1, 'Competing commands consume once');
  assert.equal(raced.find(({ status }) => status === 'rejected').reason.code, 'world_stale');
  assert.equal((await pool.query('SELECT id FROM world_kernel_events WHERE object_id=$1', [objects[1].id])).rows.length, 1);
  assert.equal((await pool.query("SELECT id FROM item_events WHERE item_id=$1 AND event_kind='consumed'", [items[1]])).rows.length, 1);
  assert.equal(notifications.length, 2);

  for (const [index, failAfter] of [[2, /^UPDATE world_kernel_objects SET state=/m], [3, /^INSERT INTO world_kernel_events/m]]) {
    const failureInput = input(objects[index].id, items[index]);
    const failing = service({ pool: observedPool({ failAfter }) });
    await denied(boss, failureInput, 'injected_world_failure', failing);
    assert.equal((await engine.get(boss, objects[index].id)).revision, 0);
    const retryKey = key();
    const recovered = index === 2
      ? (await Promise.all([engine.execute(boss, failureInput, retryKey), engine.execute(boss, failureInput, retryKey)]))
      : [await engine.execute(boss, failureInput, retryKey)];
    if (index === 2) assert.deepEqual(recovered[0], recovered[1], 'Concurrent identical keys resolve to the same committed receipt');
    assert.equal(recovered[0].revision, 1, 'Retry after rolled-back writes succeeds exactly once');
  }
  assert.equal(notifications.length, 4);
  const anotherPool = reopen();
  try {
    assert.deepEqual(await service({ pool: anotherPool }).get(outsider, objects[0].id), publicState,
      'Canonical state survives a new connection pool and kernel service');
    assert.deepEqual(await service({ pool: anotherPool }).execute(boss, main, firstKey), first);
  } finally { await anotherPool.end(); }
  assert.equal(notifications.length, 4, 'A fresh service replay does not emit a second change');

  const invalidDefinitions = [
    (definition) => { definition.knowledge = []; },
    (definition) => { definition.knowledge = []; definition.initialState = 'operational'; },
    (definition) => { definition.actions[0].itemTemplateId = 'mat:wire'; },
    (definition) => { definition.actions[0].materials[0].quantity = -1; },
    (definition) => { definition.actions[0].materials.push({ ...definition.actions[0].materials[0] }); },
    (definition) => { definition.actions[0].to = definition.actions[0].from; },
    (definition) => { definition.actions[0].familyId = family.gangId; },
    (definition) => { definition.actions[0].execution = 'direct'; },
    (definition) => { definition.actions[0].execution = undefined; },
  ];
  for (const alter of invalidDefinitions) {
    const definition = structuredClone(objects[0]); alter(definition);
    assert.throws(() => compileWorldObjects(registry, [definition]), (error) => error.code === 'bad_world_definition');
  }
  const publicOnly = structuredClone(objects[0]);
  publicOnly.knowledge = []; publicOnly.publicStates = [...publicOnly.states];
  assert.equal(compileWorldObjects(registry, [publicOnly]).length, 1,
    'Empty knowledge is valid only when every authored state is public');

  if (postgres) {
    async function salvage(accountId, suffix) {
      const carId = `kernel-race-junker-${suffix}`;
      await pool.query('INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,$3,$4,60)',
        [carId, `${accountId}-ch`, 'junker', 'stock']);
      await tx((client) => salvageCar(client, { accountId }, carId, 'recipe:car_salvage_basic', key()));
    }
    const tool = async (accountId) => (await tx((client) => craftWorldGraphRecipe(client,
      { accountId }, recipeId, key(), crafting))).outputs[0].id;
    const familyKick = (customPool) => withCharacter(customPool, boss,
      (ch, client, h) => kickFamilyMember(ch, `${member}-ch`, client, h));
    const rejoinFamily = () => social(member, (ch, client, h) => joinGang(ch, family.gangId, client, h));
    const crewLeave = (customPool) => withCharacter(customPool, boss,
      (ch, client, h) => leaveCrew(ch, client, h), CREW_FIRST_CHARACTER_LOCKS);
    const rejoinCrew = async () => {
      await social(member, (ch, client, h) => inviteToCrew(ch, 'Kernel Boss', client, h), CREW_FIRST_CHARACTER_LOCKS);
      await social(boss, (ch, client, h) => acceptInvite(ch, crew.id, client, h));
    };
    const characterLock = (accountId) => (sql, params) => /FROM characters\b/.test(sql)
      && /FOR UPDATE/.test(sql) && (params?.includes(accountId) || params?.includes(`${accountId}-ch`));
    const crewLock = (sql, params) => /FROM crews\b/.test(sql) && /FOR UPDATE/.test(sql) && params?.includes(crew.id);
    await salvage(boss, 'boss');
    const familyAction = input(objects[4].id, await tool(boss));
    const crewAction = input(objects[5].id, await tool(boss));

    // A real Family kick commits while the world action waits for its actor lock.
    // The action must re-read every Crew member's Family before spending anything.
    const kickBarrier = pausedPool((sql, params) => /^DELETE FROM gang_members\b/.test(sql.trim()) && params?.includes(`${member}-ch`));
    const kickingFirst = familyKick(kickBarrier.pool);
    await within(kickBarrier.reached, 'Family kick has deleted membership');
    const familyTrace = tracedPool(characterLock(boss));
    const beforeKick = await mutationSnapshot(), beforeKickHints = notifications.length;
    const afterKickAction = reject(service({ pool: familyTrace.pool }).execute(boss, familyAction, key()), 'world_unavailable');
    await observedLock(familyTrace, 'World action waits for Family kick');
    kickBarrier.resume();
    await within(Promise.all([kickingFirst, afterKickAction]), 'Family removal before world action');
    assert.deepEqual(await mutationSnapshot(), beforeKick);
    assert.equal(notifications.length, beforeKickHints);
    await rejoinFamily();

    // Reverse order: a world action holding checked membership completes first;
    // a real kick waits and cannot invalidate that already committed command.
    const familyBarrier = pausedPool((sql, params) => /SELECT gang_id,role FROM gang_members\b/.test(sql)
      && /FOR SHARE/.test(sql) && params?.includes(`${member}-ch`));
    const worldBeforeKick = service({ pool: familyBarrier.pool }).execute(boss, familyAction, key());
    await within(familyBarrier.reached, 'World action has locked Family membership');
    const kickingTrace = tracedPool(characterLock(boss));
    const kickAfterWorld = familyKick(kickingTrace.pool);
    await observedLock(kickingTrace, 'Family kick waits for world action');
    familyBarrier.resume();
    const [familyResult] = await within(Promise.all([worldBeforeKick, kickAfterWorld]), 'World action before Family removal');
    assert.equal(familyResult.revision, 1);
    assert.equal((await pool.query('SELECT gang_id FROM gang_members WHERE character_id=$1', [`${member}-ch`])).rows.length, 0);
    await rejoinFamily();
    console.log('world-kernel: observed PostgreSQL Family kick races serialize and reject stale affiliation');

    // The action's own actor leaves its Crew. A surviving crewmate retains the
    // Crew, so refusal proves current membership rather than mere object deletion.
    const leaveBarrier = pausedPool((sql, params) => /^DELETE FROM crew_members\b/.test(sql.trim()) && params?.includes(boss));
    const leavingFirst = crewLeave(leaveBarrier.pool);
    await within(leaveBarrier.reached, 'Crew departure has deleted actor membership');
    const crewTrace = tracedPool(crewLock);
    const beforeLeave = await mutationSnapshot(), beforeLeaveHints = notifications.length;
    const afterLeaveAction = reject(service({ pool: crewTrace.pool }).execute(boss, crewAction, key()), 'world_unavailable');
    await observedLock(crewTrace, 'World action waits for Crew departure');
    leaveBarrier.resume();
    await within(Promise.all([leavingFirst, afterLeaveAction]), 'Crew departure before world action');
    assert.deepEqual(await mutationSnapshot(), beforeLeave);
    assert.equal(notifications.length, beforeLeaveHints);
    await rejoinCrew();

    const crewBarrier = pausedPool(crewLock);
    const worldBeforeLeave = service({ pool: crewBarrier.pool }).execute(boss, crewAction, key());
    await within(crewBarrier.reached, 'World action has locked its Crew');
    const leavingTrace = tracedPool(crewLock);
    const leaveAfterWorld = crewLeave(leavingTrace.pool);
    await observedLock(leavingTrace, 'Crew departure waits for world action');
    crewBarrier.resume();
    const [crewResult] = await within(Promise.all([worldBeforeLeave, leaveAfterWorld]), 'World action before Crew departure');
    assert.equal(crewResult.revision, 1);
    assert.equal((await pool.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [boss])).rows.length, 0);
    console.log('world-kernel: observed PostgreSQL Crew departure races serialize and reject stale membership');

    // The underboss learns only through a grant from an independent account.
    // No shared character lock masks the claim-level revoke/read boundary.
    await social(boss, (ch, client, h) => promoteMember(ch, `${member}-ch`, 'underboss', client, h));
    await social(outsider, (ch, client, h) => travel(ch, 'docks', client, h));
    const foreignClaim = await discover(outsider);
    const grant = async () => {
      const targets = (await coordination.knowledgeTargets(outsider, { characterName: 'Kernel Member' })).targets;
      const target = targets.find(({ kind }) => kind === 'account'); assert(target);
      const { claim } = await coordination.knowledgeGet(outsider, foreignClaim);
      return coordination.shareKnowledge(outsider, foreignClaim,
        { targetId: target.id, expectedAclRevision: claim.aclRevision }, key());
    };
    const coordinator = (customPool) => createCoordinationService({ pool: customPool, registry: COORDINATION_KNOWLEDGE_PILOT,
      enabled: true, knowledgeEnabled: true, sharingEnabled: true });
    const revoke = (customPool, sharing) => coordinator(customPool).revokeKnowledge(outsider, foreignClaim,
      { expectedAclRevision: sharing.claim.aclRevision, grantId: sharing.claim.grants.find(({ kind }) => kind === 'account').id }, key());
    let sharing = await grant();
    await salvage(member, 'member');
    const knowledgeAction = input(objects[6].id, await tool(member));
    const claimLock = (sql, params) => /FROM coordination_claims\b/.test(sql)
      && /FOR UPDATE/.test(sql) && params?.includes(foreignClaim);
    const revokeBarrier = pausedPool((sql) => /^UPDATE coordination_claim_grants\b/.test(sql.trim()));
    const revokingFirst = revoke(revokeBarrier.pool, sharing);
    await within(revokeBarrier.reached, 'Revocation has updated grant while holding claim');
    const knowledgeTrace = tracedPool(claimLock);
    const beforeRevoke = await mutationSnapshot(), beforeRevokeHints = notifications.length;
    const afterRevokeAction = reject(service({ pool: knowledgeTrace.pool }).execute(member, knowledgeAction, key()), 'world_unavailable');
    await observedLock(knowledgeTrace, 'World action waits for pending claim revocation');
    revokeBarrier.resume();
    await within(Promise.all([revokingFirst, afterRevokeAction]), 'Claim revocation before world action');
    assert.deepEqual(await mutationSnapshot(), beforeRevoke);
    assert.equal(notifications.length, beforeRevokeHints);

    sharing = await grant();
    const knowledgeBarrier = pausedPool(claimLock);
    const worldBeforeRevoke = service({ pool: knowledgeBarrier.pool }).execute(member, knowledgeAction, key());
    await within(knowledgeBarrier.reached, 'World action has locked its required claim');
    const revokingTrace = tracedPool(claimLock);
    const revokeAfterWorld = revoke(revokingTrace.pool, sharing);
    await observedLock(revokingTrace, 'Claim revocation waits for world action');
    knowledgeBarrier.resume();
    const [knowledgeResult] = await within(Promise.all([worldBeforeRevoke, revokeAfterWorld]), 'World action before claim revocation');
    assert.equal(knowledgeResult.revision, 1);
    await reject(coordination.knowledgeGet(member, foreignClaim), 'knowledge_unavailable');
    assert.equal(notifications.length, 7, 'Only three additional committed race actions emitted world changes');
    console.log('world-kernel: observed PostgreSQL claim-lock races serialize and reject revoked evidence');
  }

  // Family dissolution releases current control while retaining historical facts.
  const durableEvents = (await pool.query('SELECT * FROM world_kernel_events ORDER BY id')).rows;
  const controlledBefore = (await pool.query('SELECT id,state,revision FROM world_kernel_objects WHERE controller_family_id=$1 ORDER BY id', [family.gangId])).rows;
  assert(controlledBefore.length >= 4);
  await social(member, (ch, client, h) => leaveGang(ch, client, h));
  await social(boss, (ch, client, h) => leaveGang(ch, client, h));
  assert.equal((await pool.query('SELECT id FROM gangs WHERE id=$1', [family.gangId])).rows.length, 0);
  assert.equal((await pool.query('SELECT id FROM world_kernel_objects WHERE controller_family_id=$1', [family.gangId])).rows.length, 0,
    'No canonical world object may remain controlled by a dissolved Family');
  assert.deepEqual((await pool.query('SELECT * FROM world_kernel_events ORDER BY id')).rows, durableEvents,
    'Dissolution preserves the original Family in immutable action provenance');
  for (const prior of controlledBefore) {
    const current = await engine.get(outsider, prior.id);
    assert.equal(current.controllerFamilyId, null);
    assert.equal(current.state, prior.state); assert.equal(current.revision, Number(prior.revision));
  }
  console.log('world-kernel: Family dissolution clears control and preserves state and event provenance');
  console.log(`world-kernel: persistent public state, replay/race, both write rollbacks and post-commit hints pass (${postgres ? 'postgres' : 'pg-mem'})`);
} finally {
  for (const release of pendingReleases) release();
  bus.off('world:changed', onChanged);
  await cleanup();
}
