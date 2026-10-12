import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadGraphPackages } from '../../src/worldgraph.js';
import { validateGraph } from '../../src/worldgraph-validate.js';
import { withItemTransaction, createItem } from '../../src/items.js';
import { createMysteryContext, startMystery, completeNode, cancelMystery } from '../../src/mysteries.js';
import { createCityNpcAuthority } from '../../src/city-world-opportunities-contract.js';
import { normalizeCityOpportunityCondition, normalizeCityOpportunityEffect,
  cityRecurringWindow, cityRaisedHeat } from '../../src/city-world-opportunity-adapters.js';

const frozen = value => { if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); } return value; };
const graphId = 'npc-recovery-fixture', toolId = 'item:npc_recovery_tool', holdId = 'm:npc-recovery:hold';
const core = frozen({ id: 'npc-recovery-core', version: 1, season: 'core', dependsOn: [], nodes: [
  { id: toolId, type: 'item_template', visibility: 'hidden', metadata: { inventoryClass: 'unique' } },
  { id: 'source:npc_recovery_tool', type: 'source', visibility: 'public', produces: [{ templateId: toolId, quantity: 1 }] },
] });
function fixture(version = 1, effects = null) {
  return frozen({ id: graphId, version, season: 'core', dependsOn: [core.id], nodes: [
    { id: 'm:npc-recovery:begin', type: 'mystery_step', version, visibility: 'public', conditions: [{ adapter: 'npc_present' }] },
    { id: holdId, type: 'mystery_step', version, visibility: 'public', requires: ['m:npc-recovery:begin'], conditions: [
      { adapter: 'npc_present' }, { adapter: 'item_ownership', templateId: toolId },
      { adapter: 'explicit_interaction', interactionId: 'hold-tool' },
    ], effects: effects || [{ adapter: 'item_escrow', templateId: toolId },
      { adapter: 'heat_raise', amount: 6 }, { adapter: 'npc_favor_award', amount: 1 }] },
  ] });
}
function observed(pool, queries, fault = null) {
  return { connect: async () => {
    const inner = await pool.connect();
    return new Proxy(inner, { get(target, key) {
      if (key === 'query') return async (sql, params) => {
        const text = String(sql).replace(/\s+/g, ' ').trim(); queries.push(text);
        const result = await target.query(sql, params);
        if (fault?.(text, params)) throw new Error('city opportunity injected late fault');
        return result;
      };
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    } });
  } };
}

export async function cityWorldOpportunityControls(pool, { postgres }) {
  const mode = postgres ? 'postgres' : 'pg-mem';
  let accessorRead = false;
  assert.throws(() => normalizeCityOpportunityCondition({ get adapter() { accessorRead = true; return 'npc_present'; } }));
  assert.equal(accessorRead, false);
  for (const value of [{ adapter: 'heat', maximum: 101 }, { adapter: 'heat', maximum: -1 },
    { adapter: 'npc_favor', minimum: 4 }, { adapter: 'npc_present', npcCharacterId: 'client-target' },
    { adapter: 'recurring_window', periodMs: 60000, openMs: 60001, offsetMs: 0 },
    { adapter: 'recurring_window', periodMs: 60000, openMs: 1, offsetMs: 60000 },
    { adapter: 'recurring_window', periodMs: 60000, openMs: 1, offsetMs: 0, nowMs: 1 }]) {
    assert.throws(() => normalizeCityOpportunityCondition(value));
  }
  for (const value of [{ adapter: 'heat_raise', amount: 7 }, { adapter: 'heat_raise', amount: -1 },
    { adapter: 'heat_raise', amount: 0 }, { adapter: 'npc_favor_award', amount: 2 },
    { adapter: 'npc_favor_award', amount: 1, npcCharacterId: 'client-target' }]) assert.throws(() => normalizeCityOpportunityEffect(value));
  const window = { adapter: 'recurring_window', periodMs: 60000, openMs: 1000, offsetMs: 500 };
  assert.equal(cityRecurringWindow(500, window).open, true); assert.equal(cityRecurringWindow(1499, window).open, true);
  assert.equal(cityRecurringWindow(1500, window).open, false); assert.equal(cityRecurringWindow(60500, window).open, true);
  assert.deepEqual(cityRaisedHeat(99, { adapter: 'heat_raise', amount: 6 }), { before: 99, after: 100 });
  assert.deepEqual(cityRaisedHeat(105, { adapter: 'heat_raise', amount: 6 }), { before: 105, after: 105 });
  const registry = loadGraphPackages([core, fixture()]);
  for (const effects of [[{ adapter: 'heat_raise', amount: 6 }, { adapter: 'heat_raise', amount: 1 }],
    [{ adapter: 'npc_favor_award', amount: 1 }, { adapter: 'npc_favor_award', amount: 1 }]]) {
    assert.throws(() => createMysteryContext({ registry: loadGraphPackages([core, fixture(1, effects)]), accountId: 'test' }));
  }
  const invalid = frozen({ id: 'npc-invalid-type', version: 1, season: 'core', dependsOn: [], nodes: [
    { id: 'e:npc-invalid', type: 'evidence', visibility: 'hidden', conditions: [{ adapter: 'heat', maximum: 30 }] },
  ] });
  assert.throws(() => validateGraph(loadGraphPackages([invalid])));
  const owner = { account: crypto.randomUUID(), character: crypto.randomUUID() };
  const npc = { account: crypto.randomUUID(), character: crypto.randomUUID() };
  const wrong = { account: crypto.randomUUID(), character: crypto.randomUUID() };
  for (const [person, isNpc] of [[owner, false], [npc, true], [wrong, false]]) {
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [person.account]);
    await pool.query(`INSERT INTO characters(id,account_id,name,season,loc,respect,cash,is_npc)
      VALUES($1,$2,$3,1,'docks',10000,777,$4)`, [person.character, person.account, 'Control ' + person.character.slice(0, 8), isNpc]);
  }
  const root = { scope: 'character', id: owner.character }, now = Date.parse('2026-10-12T07:00:00Z');
  const authority = { accountId: owner.account, characterId: owner.character, generation: 1,
    district: 'docks', npcCharacterId: npc.character, npcGeneration: 1 };
  assert.throws(() => createMysteryContext({ registry, accountId: owner.account, now, npcAuthority: authority }));
  const ctx = client => createMysteryContext({ registry, accountId: owner.account, now,
    npcAuthority: createCityNpcAuthority(client, authority) });
  const queries = [], traced = observed(pool, queries);
  const tool = await withItemTransaction(pool, client => createItem(client, root, toolId, 'crafted', 'npc-control-tool'));
  const started = await withItemTransaction(traced, client => startMystery(client, ctx(client), root, graphId, 1, 'npc-control-start'));
  const actorLocks = queries.filter(sql => /FROM characters.*FOR UPDATE/.test(sql));
  assert.match(actorLocks[0], /WHERE id IN \(\$1,\$2\) ORDER BY id FOR UPDATE$/);
  assert(queries.findIndex(sql => /FROM characters.*FOR UPDATE/.test(sql)) < queries.findIndex(sql => /FROM mystery_instances.*FOR UPDATE/.test(sql)));
  await withItemTransaction(pool, client => completeNode(client, ctx(client), root, graphId, 'm:npc-recovery:begin', { idempotencyKey: 'npc-control-begin' }));
  let injected = false;
  const faulty = observed(pool, [], (sql, params) => {
    if (!injected && /^INSERT INTO mystery_node_state/.test(sql) && params?.[1] === holdId && params?.[2] === 'completed') { injected = true; return true; }
    return false;
  });
  const options = { idempotencyKey: 'npc-control-hold', interactionId: 'hold-tool' };
  await assert.rejects(withItemTransaction(faulty, client => completeNode(client, ctx(client), root, graphId, holdId, options)));
  assert.equal(injected, true);
  const state = async () => ({
    heat: Number((await pool.query('SELECT heat FROM characters WHERE id=$1', [owner.character])).rows[0].heat),
    favor: Number((await pool.query('SELECT favor FROM city_npc_favors WHERE owner_character_id=$1 AND owner_generation=1', [owner.character])).rows[0]?.favor || 0),
    item: (await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [tool.id])).rows[0],
    instance: (await pool.query('SELECT status FROM mystery_instances WHERE id=$1', [started.instanceId])).rows[0].status,
  });
  assert.deepEqual(await state(), { heat: 0, favor: 0, item: { owner_scope: 'character', owner_id: owner.character, state: 'active' }, instance: 'active' });
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM mystery_node_state WHERE instance_id=$1 AND node_id=$2', [started.instanceId, holdId])).rows[0].n), 0);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM item_mutation_guards WHERE idempotency_key=$1', [options.idempotencyKey])).rows[0].n), 0);
  const complete = key => withItemTransaction(pool, client => completeNode(client, ctx(client), root, graphId, holdId, { ...options, idempotencyKey: key }));
  const acknowledgments = postgres ? await Promise.all([complete(options.idempotencyKey), complete(options.idempotencyKey), complete('npc-control-hold-new')])
    : [await complete(options.idempotencyKey), await complete(options.idempotencyKey), await complete('npc-control-hold-new')];
  acknowledgments.forEach(value => assert.deepEqual(value, acknowledgments[0]));
  assert.equal((await state()).heat, 6); assert.equal((await state()).favor, 1);
  assert.equal((await state()).item.owner_scope, 'operation'); assert.equal((await state()).item.owner_id, started.instanceId);
  await pool.query("UPDATE characters SET alive=false,loc='canal',generation=2 WHERE id=$1", [npc.character]);
  await pool.query('UPDATE characters SET alive=false,generation=2 WHERE id=$1', [owner.character]);
  const retired = createMysteryContext({ registry: loadGraphPackages([core, fixture(2)]), accountId: owner.account, now });
  const wrongContext = createMysteryContext({ registry, accountId: wrong.account, now });
  for (const [context, ownerRoot, graph, instanceId] of [[wrongContext, root, graphId, started.instanceId],
    [retired, { scope: 'character', id: wrong.character }, graphId, started.instanceId],
    [retired, root, 'wrong-graph', started.instanceId], [retired, root, graphId, crypto.randomUUID()]]) {
    await assert.rejects(withItemTransaction(pool, client => cancelMystery(client, context, ownerRoot, graph, instanceId,
      { idempotencyKey: crypto.randomUUID() })), error => error.code === 'mystery_unavailable');
  }
  let cancelFault = false;
  const cancelPool = observed(pool, [], (sql, params) => {
    if (!cancelFault && /^UPDATE mystery_instances SET status=/.test(sql) && params?.[1] === 'canceled') { cancelFault = true; return true; }
    return false;
  });
  const cancel = candidate => withItemTransaction(candidate, client => cancelMystery(client, retired, root, graphId,
    started.instanceId, { idempotencyKey: 'npc-control-cancel' }));
  await assert.rejects(cancel(cancelPool)); assert.equal(cancelFault, true);
  assert.equal((await state()).instance, 'active'); assert.equal((await state()).item.owner_scope, 'operation');
  const released = await cancel(pool); assert.equal(released.releasedEscrowCount, 1);
  assert.deepEqual(await cancel(pool), released);
  const final = await state(); assert.equal(final.instance, 'canceled'); assert.equal(final.item.owner_scope, 'character');
  assert.equal(final.item.owner_id, owner.character); assert.equal(final.heat, 6); assert.equal(final.favor, 1);
  for (const privateValue of [npc.character, npc.account, 'npcGeneration', 'npcCharacterId']) assert(!JSON.stringify(released).includes(privateValue));
  console.log(JSON.stringify({ proof: 'city-world-opportunities controls PASS', mode,
    closedAdapters: true, boundedEffects: true, sortedActorLocks: true, postEffectRollback: true,
    duplicateCompletion: postgres ? 'three concurrent transactions' : 'serial pg-mem compensation proof',
    exactReceiptAck: true, oldVersionDeadActorsCustody: true, postReleaseRollback: true, forgedRecoveryDenied: 4,
    recoveryNoFavorOrHeat: true, publicNpcMetadataLeak: false }));
}
