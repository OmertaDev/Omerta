// Public Family coordination journey through real Crew, Family, discovery, crafting,
// cash/material custody and physical-world services. No default DATABASE_URL fallback.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { bus, travel, withCharacter } from '../src/game.js';
import { createCrew, inviteToCrew, acceptInvite, CREW_FIRST_CHARACTER_LOCKS } from '../src/crew.js';
import { createGang, joinGang, leaveGang } from '../src/social.js';
import { withItemTransaction } from '../src/items.js';
import { createCraftingContext, craftWorldGraphRecipe, salvageCar } from '../src/crafting.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS, WORLD_KERNEL_RECIPE } from '../src/content/world-kernel-pilot.js';
import { COORDINATION_OPERATION_PILOT } from '../src/content/coordination-operation-pilot.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { createMysteryContext, startMystery, completeNode, mysteryBoard } from '../src/mysteries.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import { normalizeOperationOutcomeRequirement } from '../src/world-knowledge.js';

const postgres = process.argv.includes('--postgres');
let pool, cleanup, reopen;
if (postgres) {
  assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
  const { Pool } = await import('pg');
  const base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `family_operations_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  reopen = () => new Pool({ connectionString: endpoint.toString(),
    options: `-c search_path=${namespace} -c lock_timeout=8000 -c statement_timeout=15000` });
  pool = reopen(); cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true });
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); reopen = () => new Pool();
  pool = reopen(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}
const key = () => crypto.randomUUID();
const actors = { organizer: 'family-organizer', locksmith: 'family-locksmith', supplier: 'family-supplier', researcher: 'family-researcher' };
const names = { organizer: 'Family Organizer', locksmith: 'Family Locksmith', supplier: 'Family Supplier', researcher: 'Family Researcher' };
const boss = actors.organizer, outsider = 'family-outsider';
const owner = (accountId) => ({ scope: 'account', id: accountId });
const chId = (accountId) => `${accountId}-ch`;
const tx = (action) => withItemTransaction(pool, action);
const social = (accountId, action, hooks) => withCharacter(pool, accountId, action, hooks);
const crafting = createCraftingContext({ registry: WORLD_KERNEL_REGISTRY, knowledgeEnabled: true, sharingEnabled: true });
const knowledge = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const secret = WORLD_KERNEL_OBJECTS[0].knowledge[0];
const notifications = [];
const changed = (value) => notifications.push(value);
const operationHints = [];
const operationChanged = (value) => operationHints.push(value);
const accountCash = async (accountId, characterId = chId(accountId)) => Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [characterId])).rows[0].cash);
const snapshot = async () => Object.fromEntries(await Promise.all(['characters', 'world_operations', 'world_operation_roles',
  'world_operation_commitments', 'world_operation_contributions', 'world_operation_capital', 'world_operation_events',
  'world_kernel_objects', 'world_kernel_events', 'item_instances', 'item_stacks', 'operation_escrow', 'item_events',
  'item_mutation_guards', 'transactions'].map(async (table) => [table,
  (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
async function refused(action, code) {
  const before = await snapshot(), worldCount = notifications.length, operationCount = operationHints.length;
  await assert.rejects(action, { code });
  sameSnapshot(await snapshot(), before, 'Refused action leaves cash, custody, promises, world state and exact audit records unchanged');
  assert.equal(notifications.length, worldCount); assert.equal(operationHints.length, operationCount);
}
function sameSnapshot(actual, expected, label) {
  const changes = [], brief = (value) => JSON.stringify(value)?.slice(0, 160);
  for (const table of Object.keys(expected)) {
    if (actual[table].length !== expected[table].length) changes.push({ table, before: expected[table].length, after: actual[table].length });
    for (let index = 0; index < Math.min(actual[table].length, expected[table].length); index++) {
      for (const field of new Set([...Object.keys(actual[table][index]), ...Object.keys(expected[table][index])])) {
        if (!isDeepStrictEqual(actual[table][index][field], expected[table][index][field])) {
          changes.push({ table, row: actual[table][index].id ?? index, field,
            before: brief(expected[table][index][field]), after: brief(actual[table][index][field]) });
        }
      }
    }
  }
  assert.deepEqual(changes.slice(0, 12), [], label);
}
async function invariants(label) {
  const collective = await familyOperationInvariants(pool), physical = await worldKernelInvariants(pool);
  assert.deepEqual(collective, { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] }, label);
  assert.deepEqual(physical, { ok: true, issues: [] }, label);
}
async function player(accountId, name) {
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [accountId]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [accountId]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash,muscle,cunning,speed) VALUES($1,$2,$3,1,'foundry',10000,100000,50,50,50)",
    [chId(accountId), accountId, name]);
}
async function salvage(accountId) {
  const carId = key();
  await pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,'junker','stock',30)", [carId, chId(accountId)]);
  await tx((client) => salvageCar(client, { accountId }, carId, 'recipe:car_salvage_basic', key()));
}
async function discover(accountId) {
  await social(accountId, (ch, client, h) => travel(ch, 'docks', client, h));
  let run = (await knowledge.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  const act = async (action) => { assert(action); run = (await knowledge.act(accountId, run.id,
    { expectedRevision: run.revision, actionId: action.id }, key())).instance; };
  await act(run.actions.find(({ kind, nodeId }) => kind === 'complete' && nodeId === 'briefing'));
  await act(run.actions.find(({ kind }) => kind === 'discover'));
  const claimId = (await knowledge.knowledgeBoard(accountId)).claims[0].id;
  await social(accountId, (ch, client, h) => travel(ch, 'foundry', client, h));
  return claimId;
}
let claimId;
async function share(roleId) {
  const targets = (await knowledge.knowledgeTargets(actors.locksmith, { characterName: names[roleId] })).targets;
  const target = targets.find(({ kind }) => kind === 'account'); assert(target);
  const { claim } = await knowledge.knowledgeGet(actors.locksmith, claimId);
  await knowledge.shareKnowledge(actors.locksmith, claimId, { targetId: target.id, expectedAclRevision: claim.aclRevision }, key());
}
async function revoke(roleId) {
  const { claim } = await knowledge.knowledgeGet(actors.locksmith, claimId);
  const grant = claim.grants.find((entry) => entry.kind === 'account' && entry.label === names[roleId]); assert(grant);
  await knowledge.revokeKnowledge(actors.locksmith, claimId, { grantId: grant.id, expectedAclRevision: claim.aclRevision }, key());
}
function noPrivateData(value, viewer) {
  const serialized = JSON.stringify(value);
  for (const hidden of [claimId, secret.contentHash, secret.domain, secret.proposition, secret.sourceRoot, secret.value.value,
    ...Object.values(actors).filter((actor) => actor !== viewer), ...Object.values(actors).map(chId),
    'resolution_seed', 'coordination_definition_json', 'receiptIds', 'knowledgeProof']) {
    assert(!serialized.includes(hidden), `Operation projection disclosed ${hidden}`);
  }
}
function fixture(name, chance = 1000, selectedPool = pool) {
  const definition = structuredClone(COORDINATION_OPERATION_PILOT[0]);
  const object = structuredClone(WORLD_KERNEL_OBJECTS[0]);
  if (name !== 'pilot') { definition.id += `.${name}`; object.id += `.${name}`; definition.world.objectId = object.id; }
  definition.resolution = { chancePermille: chance, skillBonuses: [] };
  const kernel = createWorldKernel({ pool: selectedPool, registry: WORLD_KERNEL_REGISTRY, objects: [object],
    enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const api = createFamilyOperations({ pool: selectedPool, registry: WORLD_KERNEL_REGISTRY, kernel,
    definitions: [definition], enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  return { definition, object, api, kernel, name, chance };
}
const command = (scenario, roleId, action, body = {}, commandKey = key()) =>
  scenario.api.command(actors[roleId], scenario.id, action, body, commandKey);
async function draft(name, chance = 1000) {
  const scenario = fixture(name, chance), requestKey = key();
  const created = await scenario.api.create(boss, { definitionId: scenario.definition.id }, requestKey);
  assert.equal(created.status, 'draft'); scenario.id = created.operationId;
  assert.deepEqual(await scenario.api.create(boss, { definitionId: scenario.definition.id }, requestKey), created);
  await command(scenario, 'organizer', 'publish');
  for (const role of scenario.definition.roles) await command(scenario, role.id, 'join', { roleId: role.id });
  return scenario;
}
async function fund(scenario, { approve = true } = {}) {
  await salvage(actors.locksmith); await salvage(actors.supplier);
  const item = (await tx((client) => craftWorldGraphRecipe(client, { accountId: actors.locksmith }, WORLD_KERNEL_RECIPE, key(), crafting))).outputs[0];
  scenario.itemId = item.id;
  scenario.cashBefore = await accountCash(boss);
  for (const role of scenario.definition.roles) for (const requirement of role.requirements) {
    await command(scenario, role.id, 'commit', { requirementId: requirement.id });
    await command(scenario, role.id, 'contribute', { requirementId: requirement.id,
      ...(requirement.kind === 'item' ? { itemId: item.id } : {}) });
  }
  assert.equal(await accountCash(boss), scenario.cashBefore - 100);
  assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1', [item.id])).rows[0].state, 'escrowed');
  if (approve) await command(scenario, 'organizer', 'approve');
  await invariants(`${scenario.name}: contributed custody`);
  return scenario;
}
const capitalState = async (scenario) => (await pool.query('SELECT state FROM world_operation_capital WHERE operation_id=$1', [scenario.id])).rows[0]?.state;
function faultPool(match) {
  let fired = false;
  return { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    return { release: (...args) => client.release(...args), async query(sql, params) {
      const result = await client.query(sql, params);
      if (!fired && match(sql, params)) { fired = true; throw Object.assign(Error('injected Family operation failure'), { code: 'family_injected_failure' }); }
      return result;
    } };
  } };
}

try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const [roleId, accountId] of Object.entries(actors)) await player(accountId, names[roleId]);
  await player(outsider, 'Family Outsider');
  const crew = await social(boss, (ch, client, h) => createCrew(ch, 'Archive Crew', client, h));
  const family = await social(boss, (ch, client, h) => createGang(ch, 'Archive Family', 'ARCV', client, h));
  for (const roleId of ['locksmith', 'supplier', 'researcher']) {
    await social(boss, (ch, client, h) => inviteToCrew(ch, names[roleId], client, h), CREW_FIRST_CHARACTER_LOCKS);
    await social(actors[roleId], (ch, client, h) => acceptInvite(ch, crew.id, client, h));
    await social(actors[roleId], (ch, client, h) => joinGang(ch, family.gangId, client, h));
  }
  bus.on('world:changed', changed); bus.on('coordination:changed', operationChanged);
  await assert.rejects(tx((client) => craftWorldGraphRecipe(client, { accountId: actors.locksmith }, WORLD_KERNEL_RECIPE, key(), crafting)), { code: 'knowledge_required' });
  claimId = await discover(actors.locksmith);
  await share('researcher');
  const pilot = fixture('pilot');
  await assert.rejects(pilot.api.catalog(outsider), { code: 'coordination_operation_unavailable' });
  noPrivateData(await pilot.api.catalog(boss), boss);
  await refused(() => pilot.api.create(actors.researcher, { definitionId: pilot.definition.id }, key()), 'coordination_operation_forbidden');

  const main = await fund(await draft('pilot'));
  let board = await main.api.get(boss, main.id);
  assert.equal(board.readiness.contributionsMet, true); assert.equal(board.readiness.worldReady, false);
  await refused(() => command(main, 'organizer', 'execute'), 'coordination_operation_not_ready');
  await share('organizer'); await command(main, 'organizer', 'approve');
  board = await main.api.get(boss, main.id);
  assert.equal(board.status, 'ready'); assert.equal(board.readiness.ready, true); noPrivateData(board, boss);
  for (const roleId of Object.keys(actors)) noPrivateData(await main.api.get(actors[roleId], main.id), actors[roleId]);
  await assert.rejects(main.api.get(outsider, main.id), { code: 'coordination_operation_unavailable' });
  await refused(() => command(main, 'organizer', 'execute', { actorAccountId: actors.locksmith }), 'bad_coordination_operation_request');
  await refused(() => command(main, 'researcher', 'execute'), 'coordination_operation_not_ready');
  await refused(() => command(main, 'supplier', 'withdraw', { requirementId: 'funding' }), 'coordination_operation_commitment');
  await revoke('researcher');
  assert.equal((await main.api.get(boss, main.id)).readiness.ready, false);
  await refused(() => command(main, 'organizer', 'execute'), 'coordination_operation_not_ready');
  await share('researcher');
  await revoke('organizer');
  assert.equal((await main.api.get(boss, main.id)).readiness.worldReady, false);
  await refused(() => command(main, 'organizer', 'execute'), 'coordination_operation_not_ready');
  await share('organizer');
  await social(actors.researcher, (ch, client, h) => leaveGang(ch, client, h));
  assert.equal((await main.api.get(boss, main.id)).readiness.participantsEligible, false);
  await refused(() => command(main, 'organizer', 'execute'), 'coordination_operation_not_ready');
  await social(actors.researcher, (ch, client, h) => joinGang(ch, family.gangId, client, h));
  await command(main, 'organizer', 'approve');
  const sourceOperation = (await pool.query('SELECT graph_id,coordination_definition_hash FROM world_operations WHERE id=$1', [main.id])).rows[0];
  const outcomeRequirement = { definitionId: sourceOperation.graph_id, definitionHash: sourceOperation.coordination_definition_hash, outcome: 'completed' };
  const outcomeRegistry = loadAndValidateGraphPackages([{ id: 'family-outcome-mystery', version: 1, dependsOn: [], nodes: [
    { id: 'outcome:ending', type: 'mystery_step', visibility: 'public', metadata: { terminal: true },
      conditions: [{ adapter: 'family_operation_outcome', requirement: outcomeRequirement }] },
  ] }]);
  const outcomeContext = (accountId, operationOutcomesEnabled = true, accountIds = []) => createMysteryContext({
    registry: outcomeRegistry, accountId, operationOutcomesEnabled, accountIds,
  });
  const outcomeBoard = (accountId) => mysteryBoard(pool, outcomeContext(accountId), owner(accountId), 'family-outcome-mystery');
  const outcomeAct = (accountId, context = outcomeContext(accountId), idempotencyKey = key()) => tx((client) =>
    completeNode(client, context, owner(accountId), 'family-outcome-mystery', 'outcome:ending', { idempotencyKey }));
  for (const accountId of [boss, actors.researcher, outsider]) await tx((client) =>
    startMystery(client, outcomeContext(accountId), owner(accountId), 'family-outcome-mystery', 1, key()));
  assert.equal((await outcomeBoard(boss)).nodes[0].available, false, 'Readiness is not a completed operation outcome');
  await assert.rejects(outcomeAct(boss), { code: 'operation_outcome_required' });
  for (const wrong of [{ ...outcomeRequirement, outcome: 'ready' }, { ...outcomeRequirement, definitionHash: 'untrusted' },
    { ...outcomeRequirement, accountId: boss }]) assert.throws(() => normalizeOperationOutcomeRequirement(wrong), { code: 'bad_operation_outcome_requirement' });
  const executeKey = key(), beforeHints = notifications.length;
  const resolved = await Promise.all([command(main, 'organizer', 'execute', {}, executeKey), command(main, 'organizer', 'execute', {}, executeKey)]);
  assert.deepEqual(resolved[0], resolved[1]); assert.equal(resolved[0].status, 'completed');
  assert.equal(notifications.length, beforeHints + 1);
  assert.equal(await accountCash(boss), main.cashBefore - 100); assert.equal(await capitalState(main), 'spent');
  const itemHistory = (await pool.query('SELECT event_kind,provenance_kind FROM item_events WHERE item_id=$1 ORDER BY sequence', [main.itemId])).rows;
  assert.equal(itemHistory[0].provenance_kind, 'crafted'); assert.equal(itemHistory.at(-1).event_kind, 'consumed');
  assert.equal((await main.kernel.get(outsider, main.object.id)).state, 'open');
  await invariants('completed operation and nested world mutation');
  assert.equal((await outcomeBoard(boss)).nodes[0].available, true);
  assert.equal((await outcomeBoard(actors.researcher)).nodes[0].available, true);
  const outsiderBoard = await outcomeBoard(outsider);
  assert.deepEqual(outsiderBoard.nodes[0].blockedBy, [{ adapter: 'family_operation_outcome' }]);
  assert(!JSON.stringify(outsiderBoard).includes(main.id));
  assert(!JSON.stringify(outsiderBoard).includes(outcomeRequirement.definitionHash));
  await assert.rejects(outcomeAct(outsider), { code: 'operation_outcome_required' });
  await assert.rejects(outcomeAct(boss, outcomeContext(boss, false)), { code: 'operation_outcome_required' });
  await assert.rejects(outcomeAct(boss, outcomeContext(boss, true, [outsider])), { code: 'operation_outcome_required' });
  const endingKey = key(), ending = await outcomeAct(boss, outcomeContext(boss), endingKey);
  assert.equal(ending.status, 'completed');
  assert.deepEqual(await outcomeAct(boss, outcomeContext(boss), endingKey), ending);
  console.log('family-operations: pinned participant outcome unlocks persistent mystery ending; outsider, uncommitted and disabled sources fail closed');
  const completed = await snapshot();
  assert.deepEqual(await command(main, 'organizer', 'execute', {}, executeKey), resolved[0]);
  sameSnapshot(await snapshot(), completed, 'Replay cannot mutate committed operation');
  await refused(() => command(main, 'organizer', 'cancel', {}, executeKey), 'idempotency_conflict');
  const newPool = reopen();
  try {
    const restarted = fixture('pilot', 1000, newPool);
    assert.equal((await restarted.api.get(boss, main.id)).status, 'completed');
    assert.deepEqual(await restarted.api.command(boss, main.id, 'execute', {}, executeKey), resolved[0]);
    assert.equal((await restarted.kernel.get(outsider, main.object.id)).state, 'open');
  } finally { await newPool.end(); }
  console.log('family-operations: real four-player journey, private views, live revalidation, concurrent replay and restart pass');

  const competing = await fund(await draft('competing'));
  const competingKeys = [key(), key()];
  const outcomes = await Promise.allSettled(competingKeys.map((commandKey) => command(competing, 'organizer', 'execute', {}, commandKey)));
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  const losingIndex = outcomes.findIndex(({ status }) => status === 'rejected');
  assert(['contention', 'coordination_operation_closed'].includes(outcomes[losingIndex].reason.code));
  await refused(() => command(competing, 'organizer', 'execute', {}, competingKeys[losingIndex]), 'coordination_operation_closed');
  assert.equal((await pool.query('SELECT id FROM world_kernel_events WHERE operation_id=$1', [competing.id])).rows.length, 1);

  const withdrawal = await fund(await draft('withdrawal'));
  await command(withdrawal, 'organizer', 'withdraw', { requirementId: 'funding' });
  assert.equal(await capitalState(withdrawal), 'refunded'); assert.equal(await accountCash(boss), withdrawal.cashBefore);
  assert.equal((await withdrawal.api.get(boss, withdrawal.id)).readiness.approved, false);
  await command(withdrawal, 'organizer', 'leave');
  await command(withdrawal, 'organizer', 'join', { roleId: 'organizer' });
  for (const requirementId of ['presence', 'funding']) {
    await command(withdrawal, 'organizer', 'commit', { requirementId });
    await command(withdrawal, 'organizer', 'contribute', { requirementId });
  }
  await command(withdrawal, 'organizer', 'approve');
  assert.equal((await withdrawal.api.get(boss, withdrawal.id)).readiness.ready, true);
  await command(withdrawal, 'organizer', 'cancel');
  assert.equal(await accountCash(boss), withdrawal.cashBefore); assert.equal(await capitalState(withdrawal), 'refunded');
  assert.equal((await pool.query('SELECT state,owner_id FROM item_instances WHERE id=$1', [withdrawal.itemId])).rows[0].owner_id, actors.locksmith);
  assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1', [withdrawal.itemId])).rows[0].state, 'active');
  assert.equal((await withdrawal.api.get(boss, withdrawal.id)).status, 'canceled');
  await invariants('withdrawal, replacement commitment and cancellation');

  const expired = await fund(await draft('expired'));
  await pool.query('UPDATE world_operations SET expires_at=$2 WHERE id=$1', [expired.id, new Date(Date.now() - 1000)]);
  await refused(() => command(expired, 'organizer', 'execute'), 'coordination_operation_expired');
  await command(expired, 'researcher', 'expire');
  assert.equal((await expired.api.get(boss, expired.id)).status, 'expired');
  assert.equal(await capitalState(expired), 'refunded'); assert.equal(await accountCash(boss), expired.cashBefore);
  await invariants('expiry refunds');

  const failed = await fund(await draft('failed', 0));
  const failure = await command(failed, 'organizer', 'execute');
  assert.equal(failure.status, 'failed'); assert.equal(await capitalState(failed), 'spent');
  assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1', [failed.itemId])).rows[0].state, 'consumed');
  assert.equal((await pool.query('SELECT id FROM world_kernel_objects WHERE id=$1', [failed.object.id])).rows.length, 0);
  assert.equal((await pool.query('SELECT id FROM world_kernel_events WHERE operation_id=$1', [failed.id])).rows.length, 0);
  assert.equal(await accountCash(boss), failed.cashBefore - 100);
  await invariants('failed operation spends escrow without a world transition');
  console.log('family-operations: competing execution, withdrawal/rejoin, cancellation, expiry and deterministic failure pass');

  for (const [name, match] of [
    ['world-rollback', (sql) => /^UPDATE world_kernel_objects SET state=/.test(sql)],
    ['resolved-rollback', (sql, params) => /^INSERT INTO world_operation_events/.test(sql) && params?.[7] === 'resolved'],
  ]) {
    const scenario = await fund(await draft(name));
    const faulty = fixture(name, 1000, faultPool(match)); faulty.id = scenario.id;
    const retryKey = key();
    await refused(() => command(faulty, 'organizer', 'execute', {}, retryKey), 'family_injected_failure');
    assert.equal((await scenario.api.get(boss, scenario.id)).status, 'ready');
    assert.equal(await capitalState(scenario), 'held');
    assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1', [scenario.itemId])).rows[0].state, 'escrowed');
    assert.equal((await command(scenario, 'organizer', 'execute', {}, retryKey)).status, 'completed');
    await invariants(`${name}: rollback and retry`);
  }

  const death = await fund(await draft('death'));
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [chId(boss)]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc,cash) VALUES('family-organizer-heir',$1,'Organizer Heir',1,'foundry',91)", [boss]);
  await command(death, 'organizer', 'cancel');
  assert.equal(await capitalState(death), 'forfeited');
  assert.equal(await accountCash(boss, 'family-organizer-heir'), 91);
  assert.equal((await death.api.get(boss, death.id)).status, 'canceled');
  const heirGraph = 'heir-outcome-mystery';
  const heirContext = createMysteryContext({ accountId: boss, operationOutcomesEnabled: true,
    registry: loadAndValidateGraphPackages([{ id: heirGraph, version: 1, dependsOn: [], nodes: [
      { id: 'heir:ending', type: 'mystery_step', visibility: 'public', conditions: [{ adapter: 'family_operation_outcome', requirement: outcomeRequirement }] },
    ] }]),
  });
  await tx((client) => startMystery(client, heirContext, owner(boss), heirGraph, 1, key()));
  await assert.rejects(tx((client) => completeNode(client, heirContext, owner(boss), heirGraph, 'heir:ending',
    { idempotencyKey: key() })), { code: 'operation_outcome_required' });
  assert.equal((await pool.query('SELECT owner_id,state FROM item_instances WHERE id=$1', [death.itemId])).rows[0].owner_id, actors.locksmith);
  assert.equal((await pool.query('SELECT id FROM transactions WHERE currency=$1', ['omr'])).rows.length, 0);
  await invariants('death cancellation and forfeiture');
  console.log(`family-operations: after-write rollback/retry, original-character death forfeiture and no OMR movement pass (${postgres ? 'postgres' : 'pg-mem'})`);
} finally {
  bus.off('world:changed', changed); bus.off('coordination:changed', operationChanged);
  await cleanup();
}
