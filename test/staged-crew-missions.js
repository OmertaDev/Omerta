// Current operation runtime and real storage; this domain fixture never connects to production.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { makeDb } from '../src/db.js';
import { withItemTransaction } from '../src/items.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import { createMysteryContext, startMystery, completeNode, commitChoice, exploreMystery } from '../src/mysteries.js';
import { createOperationContext, openOperation, assignRole, contribute, completeOperation, operationBoard, roleBoard } from '../src/operations.js';
import { DISTRICT_STORY_ARC_PACKAGES } from '../src/content/district-story-arcs.js';
import { STAGED_CREW_MISSIONS_PACKAGE as mission } from '../src/content/staged-crew-missions.js';

assert(!process.env.DATABASE_URL, 'Staged Crew domain proof requires disposable pg-mem.');
const registry = loadAndValidateGraphPackages([...DISTRICT_STORY_ARC_PACKAGES, mission]);
const root = mission.nodes.find(node => node.type === 'social_gate');
assert.equal(root.metadata.minimumDistinctAccounts, 3);
assert(Object.isFrozen(mission) && Object.isFrozen(root.metadata.roles));
const pool = await makeDb(), crewId = crypto.randomUUID();
const actors = ['Planner', 'Lookout', 'Driver', 'Outsider'].map(name => ({ name, account: crypto.randomUUID(), character: crypto.randomUUID() }));
const contexts = actors.map(actor => createOperationContext({ registry, accountId: actor.account }));
const tx = action => withItemTransaction(pool, action);
const act = (index, fn, operationId, fields = {}) => tx(client => fn(client, contexts[index], operationId, { idempotencyKey: crypto.randomUUID(), ...fields }));
const count = async (table, operationId) => Number((await pool.query('SELECT COUNT(*) n FROM ' + table + ' WHERE operation_id=$1', [operationId])).rows[0].n);
const money = () => Promise.all(actors.map(async actor => ({
  character: (await pool.query('SELECT cash,bank,heat,ammo,respect FROM characters WHERE id=$1', [actor.character])).rows[0],
  account: (await pool.query('SELECT omr FROM account_persistent WHERE account_id=$1', [actor.account])).rows[0],
  transactions: Number((await pool.query('SELECT COUNT(*) n FROM transactions WHERE character_id=$1 OR account_id=$2', [actor.character, actor.account])).rows[0].n),
})));
try {
  await pool.query('INSERT INTO crews(id,name,leader_account) VALUES($1,$2,$3)', [crewId, 'Pier Domain Crew', actors[0].account]);
  for (const [index, actor] of actors.entries()) {
    await pool.query('INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$3,1,$4,10000,5000)',
      [actor.character, actor.account, 'Pier ' + actor.name, 'docks']);
    await pool.query('INSERT INTO account_persistent(account_id,omr) VALUES($1,77)', [actor.account]);
    if (index < 3) await pool.query('INSERT INTO crew_members(crew_id,account_id,name) VALUES($1,$2,$3)', [crewId, actor.account, 'Pier ' + actor.name]);
  }
  const open = (key = crypto.randomUUID()) => tx(client => openOperation(client, contexts[0], mission.id, root.id, 1, key));
  await assert.rejects(open(), error => error?.code === 'operation_locked', 'A guessed mission root cannot bypass its real personal case.');
  const docks = DISTRICT_STORY_ARC_PACKAGES.find(pkg => pkg.id === 'district-docks-story');
  const mysteryContext = createMysteryContext({ registry, accountId: actors[0].account });
  const owner = { scope: 'character', id: actors[0].character };
  const mystery = (fn, ...args) => tx(client => fn(client, mysteryContext, owner, docks.id, ...args));
  await mystery(startMystery, 1, 'pier-personal-start');
  await mystery(completeNode, 'mystery:district-docks-story-introduction', { idempotencyKey: 'pier-personal-meet', interactionId: 'district-docks-story:meet' });
  await mystery(commitChoice, 'choice:district-docks-story-approach', 'witness', { idempotencyKey: 'pier-personal-choice', interactionId: 'district-docks-story:choose' });
  await mystery(completeNode, 'mystery:district-docks-story-witness', { idempotencyKey: 'pier-personal-witness', interactionId: 'district-docks-story:witness' });
  await mystery(exploreMystery, { idempotencyKey: 'pier-personal-explore' });
  await mystery(completeNode, 'mystery:district-docks-story-report', { idempotencyKey: 'pier-personal-report', interactionId: 'district-docks-story:report' });
  const before = await money(), opened = await open('pier-open');
  assert.equal(opened.status, 'forming');
  assert.equal((await open('pier-open-again')).operationId, opened.operationId, 'The same Crew root opens one durable operation.');
  const roles = root.metadata.roles;
  await tx(client => assignRole(client, contexts[0], opened.operationId, roles[0].id, { idempotencyKey: 'pier-planner' }));
  await assert.rejects(tx(client => assignRole(client, contexts[0], opened.operationId, roles[1].id, { idempotencyKey: 'pier-double-role' })),
    error => error?.code === 'operation_distinct_account');
  for (let index = 1; index < 3; index++) await tx(client => assignRole(client, contexts[index], opened.operationId, roles[index].id,
    { idempotencyKey: 'pier-role-' + index }));
  assert.equal((await operationBoard(pool, contexts[0], opened.operationId)).status, 'active');
  await assert.rejects(roleBoard(pool, contexts[3], opened.operationId), error => error?.code === 'operation_forbidden');
  const steps = mission.nodes.filter(node => node.type === 'operation_step').sort((a, b) => a.metadata.order - b.metadata.order);
  const contribution = (index, step, key) => tx(client => contribute(client, contexts[index], opened.operationId, step.id,
    { idempotencyKey: key || crypto.randomUUID(), interactionId: step.conditions.find(condition => condition.adapter === 'explicit_interaction').interactionId }));
  await assert.rejects(contribution(2, steps[3]), error => ['operation_prerequisite', 'operation_order'].includes(error?.code), 'The getaway cannot run before execution.');
  await assert.rejects(act(0, completeOperation, opened.operationId), error => error?.code === 'operation_incomplete');
  const unavailable = async nodeId => {
    try { await tx(client => contribute(client, contexts[1], opened.operationId, nodeId, { idempotencyKey: crypto.randomUUID(), interactionId: 'quiet_pier_mark_route' })); }
    catch (error) { return { code: error.code, message: error.message }; }
    assert.fail('Private, wrong-type and nonexistent contributions must be refused.');
  };
  assert.deepEqual(await unavailable(steps[0].id), await unavailable('operation:no-such-pier-step'));
  assert.deepEqual(await unavailable('evidence:quiet-pier-route'), await unavailable(steps[0].id));

  // Fail after the private evidence write but before its contribution can complete.
  let failed = false;
  const faultPool = { async connect() {
    const inner = await pool.connect();
    return new Proxy(inner, { get(target, property) {
      if (property === 'query') return async (sql, params) => {
        if (!failed && /INSERT INTO world_operation_contributions/i.test(String(sql))) { failed = true; throw Error('owned pier contribution fault'); }
        return target.query(sql, params);
      };
      const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
    } });
  } };
  await assert.rejects(withItemTransaction(faultPool, client => contribute(client, contexts[0], opened.operationId, steps[0].id,
    { idempotencyKey: 'pier-plan-retry', interactionId: 'quiet_pier_mark_route' })), /owned pier contribution fault/);
  assert(failed); assert.equal(await count('world_operation_contributions', opened.operationId), 0);
  assert.equal((await pool.query('SELECT node_id FROM world_operation_node_state WHERE operation_id=$1 AND node_id<>$2', [opened.operationId, root.id])).rows.length, 0,
    'Failed contribution compensates private evidence and stage writes.');
  await contribution(0, steps[0], 'pier-plan-retry');
  const privateTexts = mission.nodes.filter(node => node.type === 'evidence').map(node => node.metadata.privateEvidence);
  const shared = JSON.stringify(await operationBoard(pool, contexts[0], opened.operationId));
  assert(privateTexts.every(text => !shared.includes(text)), 'The shared board excludes all role-private evidence.');
  const planner = JSON.stringify(await roleBoard(pool, contexts[0], opened.operationId));
  const lookout = JSON.stringify(await roleBoard(pool, contexts[1], opened.operationId));
  assert(planner.includes(privateTexts[0]) && !lookout.includes(privateTexts[0]));
  await contribution(1, steps[1]);
  assert(JSON.stringify(await roleBoard(pool, contexts[1], opened.operationId)).includes(privateTexts[1]));
  assert(!JSON.stringify(await roleBoard(pool, contexts[0], opened.operationId)).includes(privateTexts[1]));
  await contribution(0, steps[2]); await contribution(2, steps[3]);
  assert.equal(await count('world_operation_contributions', opened.operationId), 4);
  await assert.rejects(act(1, completeOperation, opened.operationId), error => error?.code === 'operation_completion_role');
  const [first, second] = await Promise.all([
    act(0, completeOperation, opened.operationId, { idempotencyKey: 'pier-close-one' }),
    act(0, completeOperation, opened.operationId, { idempotencyKey: 'pier-close-two' }),
  ]);
  assert.equal(first.status, 'completed'); assert.equal(second.status, 'completed');
  assert.equal([...first.effects, ...second.effects].filter(effect => effect.kind === 'unique_item_award').length, 1,
    'Concurrent closer calls have one actual award winner.');
  const reward = (await pool.query('SELECT id,owner_scope,owner_id FROM item_instances WHERE template_id=$1', ['item:quiet_pier_manifest'])).rows;
  assert.equal(reward.length, 1); assert.equal(reward[0].owner_scope, 'account'); assert.equal(reward[0].owner_id, actors[2].account);
  assert.deepEqual(await act(0, completeOperation, opened.operationId, { idempotencyKey: 'pier-close-one' }), first);
  assert.deepEqual(await money(), before, 'All stages and completion preserve currencies and combat resources.');
  const publicJson = JSON.stringify(await operationBoard(pool, contexts[0], opened.operationId));
  assert(![crewId, ...actors.flatMap(actor => [actor.account, actor.character])].some(id => publicJson.includes(id)), 'The shared board publishes no ownership IDs.');

  // A new actual Crew snapshot cannot let a deceased assigned participant's heir finish its run.
  const nextCrew = crypto.randomUUID();
  await pool.query('INSERT INTO crews(id,name,leader_account) VALUES($1,$2,$3)', [nextCrew, 'Pier Replacement Crew', actors[0].account]);
  for (const actor of actors.slice(0, 3)) await pool.query('UPDATE crew_members SET crew_id=$2 WHERE account_id=$1', [actor.account, nextCrew]);
  const abandoned = await open('pier-replacement-open');
  for (let index = 0; index < 3; index++) await tx(client => assignRole(client, contexts[index], abandoned.operationId, roles[index].id,
    { idempotencyKey: 'pier-replacement-role-' + index }));
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [actors[1].character]);
  const retired = await tx(client => contribute(client, contexts[0], abandoned.operationId, steps[0].id,
    { idempotencyKey: 'pier-replacement-plan', interactionId: 'quiet_pier_mark_route' }));
  assert.equal(retired.status, 'abandoned');
  assert.equal((await pool.query('SELECT id FROM item_instances WHERE template_id=$1', ['item:quiet_pier_manifest'])).rows.length, 1);
  console.log('staged-crew-missions PASS: real mystery bridge, three consenting distinct roles, ordered planning/lookout/execution/getaway, private evidence and ownership projection, contribution rollback/exact retry, concurrent one-winner close, durable driver artifact and participant death abandonment');
} finally { await pool.end(); }
