import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import { CAPABILITIES, CAPABILITY_BY_NAME, validateCapabilityInput } from '../src/gateway/capabilities.js';
import { createContextGateway } from '../src/gateway/context.js';
import { PHASE1_WORLD_GRAPH } from '../src/routes/worldgraph.js';
import { createMysteryContext, startMystery } from '../src/mysteries.js';
import { withItemTransaction, grantStack } from '../src/items.js';
import { missionReadiness, doMission } from '../src/growth.js';
import { MISSIONS, GUNS } from '../src/rules.js';

const pool = await makeDb();
const account = 'gateway-context-account';
const character = 'gateway-context-character';
const other = 'gateway-context-other';
const full = { scopes: [...new Set(CAPABILITIES.flatMap((entry) => entry.scopes))] };
const only = (...names) => ({ scopes: names.map((name) => `omerta.${name}`) });
const gateway = createContextGateway({ pool });
const run = (name, args = {}, context = full) => gateway.execute(name, account, args, context);
try {
  await pool.query(`INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
    VALUES ($1,$2,'Context Carla',1,'docks',0,7777),($3,$4,'Other Oliver',1,'foundry',0,8888)`,
  [character, account, `${other}-character`, other]);
  await pool.query('INSERT INTO account_persistent (account_id,omr) VALUES ($1,4321),($2,9999)', [account, other]);
  await pool.query(`INSERT INTO crews (id,name,leader_account) VALUES ('context-crew','Context Crew',$1),('foreign-crew','Foreign Crew',$2)`, [account, other]);
  await pool.query(`INSERT INTO crew_members (crew_id,account_id,name) VALUES ('context-crew',$1,'Context Carla'),('context-crew',$2,'Other Oliver')`, [account, other]);
  await pool.query(`INSERT INTO gangs (id,name,tag,treasury,ammo_bank,omr_reserve) VALUES
    ('context-family','Context Family','CTX',43210,432,4321),('foreign-family','Foreign Family','OTH',98765,987,9876)`);
  await pool.query(`INSERT INTO gang_members (gang_id,character_id,role) VALUES
    ('context-family',$1,'boss'),('foreign-family',$2,'boss')`, [character, `${other}-character`]);
  await pool.query(`INSERT INTO dynasty_marriages (account_a,account_b,proposed_by,accepted) VALUES ($1,$2,$1,true)`, [account, other]);
  await pool.query(`INSERT INTO gang_relations (gang_a,gang_b,proposed_by,accepted,until)
    VALUES ('context-family','foreign-family','context-family',true,$1)`, [new Date(Date.now() + 86400000)]);
  await pool.query(`INSERT INTO world_operations (id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id) VALUES
    ('context-operation','belladonna-demo',1,'operation:belladonna-lockbox','context-crew',$1),
    ('foreign-operation','belladonna-demo',1,'operation:belladonna-lockbox','foreign-crew',$2)`, [account, other]);
  await pool.query(`INSERT INTO cars (id,character_id,model_id,trim_id,dmg)
    VALUES ('context-car',$1,'junker','stock',60),('foreign-car',$2,'junker','stock',0)`, [character, `${other}-character`]);
  await pool.query(`INSERT INTO notifications (id,character_id,type,payload) VALUES
    ('context-secret-event',$1,'mystery.clue.discovered','{"solution":"NEVER_EXPORT_SOLUTION"}'),
    ('context-player-event',$1,'attack','{"cash":"PRIVATE_PAYLOAD"}'),
    ('foreign-event',$2,'attack','{"secret":"OTHER_ACCOUNT_SECRET"}')`, [character, `${other}-character`]);
  await pool.query(`INSERT INTO notifications (id,character_id,type,payload) VALUES
    ('unsupported-sensitive-type',$1,'admin_oracle_private','{}'),
    ('former-crew-notification',$1,'crew_request','{"crewId":"former-crew"}')`, [character]);
  await pool.query(`INSERT INTO event_results (id,kind,icon,headline,detail) VALUES
    ('context-public-world','city','city','A published city result','{"secret":"UNPUBLISHED_DETAIL"}')`);
  await withItemTransaction(pool, async (client) => {
    await grantStack(client, { scope: 'account', id: account }, 'mat:scrap_steel', 10, 'standard', 'gateway context fixture', 'context:grant');
    await grantStack(client, { scope: 'account', id: other }, 'mat:wire', 987, 'standard', 'gateway other fixture', 'context:other-grant');
  });
  assert.equal(CAPABILITIES.length, new Set(CAPABILITIES.map((entry) => entry.name)).size);
  for (const entry of CAPABILITIES) {
    assert.equal(entry.inputSchema.additionalProperties, false, entry.name);
    assert(entry.scopes.length, entry.name);
    assert(['READ', 'ANALYZE', 'PREPARE', 'COMMIT'].includes(entry.actionClass));
  }
  await assert.rejects(run('get_player_context', {}, {}), { code: 'gateway_scope_required' });
  await assert.rejects(run('get_inventory', { accountId: other }), { code: 'gateway_bad_input' });
  await assert.rejects(run('get_inventory', {}, only('player.read')), { code: 'gateway_scope_required' });
  assert.throws(() => validateCapabilityInput(CAPABILITY_BY_NAME.get('get_item'), { itemId: '../private' }), { code: 'gateway_bad_input' });
  assert.throws(() => validateCapabilityInput(CAPABILITY_BY_NAME.get('get_notifications'), { limit: 101 }), { code: 'gateway_bad_input' });
  assert.throws(() => validateCapabilityInput(CAPABILITY_BY_NAME.get('get_notifications'), { limit: '3' }), { code: 'gateway_bad_input' });

  const minimal = await run('get_player_context', {}, only('player.read'));
  assert.equal(minimal.player.name, 'Context Carla');
  for (const key of ['inventory', 'crew', 'family', 'world', 'economy', 'coordinationRequests', 'activeMysteries']) assert.equal(key in minimal, false, key);
  assert.doesNotMatch(JSON.stringify(minimal), /4321|7777|foreign-car|context-car|wallet_address|account_id|ammo|cash|bank/);

  const before = (await pool.query('SELECT cash,energy,last_accrued_at FROM characters WHERE id=$1', [character])).rows[0];
  const inventory = await run('get_inventory');
  assert.equal(inventory.account.stacks[0].qty, 10);
  assert.equal(inventory.equipment.cars[0].id, 'context-car');
  assert.doesNotMatch(JSON.stringify(inventory), /987|foreign-car|owner_id|account_id|ownerScope|ownerId/);
  assert.equal((await run('get_item', { itemId: 'context-car' })).item.type, 'vehicle');
  await assert.rejects(run('get_item', { itemId: 'foreign-car' }), { code: 'gateway_unavailable' });
  await assert.rejects(run('get_item', { itemId: 'item:belladonna_artifact' }), { code: 'gateway_unavailable' });

  const world = await run('get_world_context', {}, only('world.read'));
  assert.doesNotMatch(JSON.stringify(world), /mystery:belladonna-lock|evidence:belladonna-maker-mark|privateEvidence|condition|effect|salt|solution/);
  const nodeIds = new Set(world.nodes.map((node) => node.id));
  assert(world.edges.every((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)));
  const pageIds = new Set(); let cursor;
  do {
    const page = await run('get_discovered_world_nodes', { limit: 1, ...(cursor ? { cursor } : {}) }, only('world.read'));
    assert(page.nodes.length <= 1);
    const current = new Set(page.nodes.map((node) => node.id));
    assert(page.edges.every((edge) => current.has(edge.from) && current.has(edge.to)));
    for (const node of page.nodes) { assert.equal(pageIds.has(node.id), false); pageIds.add(node.id); }
    cursor = page.nextCursor;
  } while (cursor);
  assert.deepEqual(pageIds, nodeIds);
  const related = await run('get_related_entities', { entityId: 'mat:scrap_steel', limit: 1 }, only('world.read'));
  assert.equal(related.entity.id, 'mat:scrap_steel');
  assert(related.nodes.length <= 1);
  assert(related.edges.every((edge) => edge.from === related.entity.id || edge.to === related.entity.id));
  await assert.rejects(run('get_world_context', { limit: 101 }), { code: 'gateway_bad_input' });
  await assert.rejects(run('get_world_context', { cursor: 'private:1' }), { code: 'gateway_bad_input' });
  await assert.rejects(run('get_related_entities', { entityId: 'evidence:belladonna-maker-mark' }), { code: 'gateway_unavailable' });
  await assert.rejects(run('get_related_entities', { entityId: 'nonexistent' }), { code: 'gateway_unavailable' });

  await withItemTransaction(pool, (client) => startMystery(client,
    createMysteryContext({ registry: PHASE1_WORLD_GRAPH, accountId: account }),
    { scope: 'character', id: character }, 'belladonna-demo', 1, 'context:start'));
  const mystery = await run('get_mystery_context', { graphId: 'belladonna-demo' });
  assert(mystery.nodes.some((node) => node.id === 'mystery:belladonna-trace'));
  assert.doesNotMatch(JSON.stringify(mystery), /evidence:belladonna-maker-mark|privateEvidence|owner|solution|salt/);
  await assert.rejects(gateway.prepare('submit_mystery_action', account,
    { graphId: 'belladonna-demo', nodeId: 'evidence:belladonna-maker-mark', action: 'discover' }, full), { code: 'gateway_unavailable' });
  await assert.rejects(gateway.prepare('submit_mystery_action', account,
    { graphId: 'belladonna-demo', nodeId: 'nonexistent', action: 'discover' }, full), { code: 'gateway_unavailable' });
  await assert.rejects(run('get_operation_requirements', { operationId: 'foreign-operation' }), { code: 'operation_unavailable' });
  const operation = await run('get_operation_requirements', { operationId: 'context-operation' });
  assert.equal(operation.requiredRoleCount, 4);
  assert.doesNotMatch(JSON.stringify(operation), /openedByAccountId|opened_by_account_id|crew_id|privateEvidence|belladonna-investigate/);
  await pool.query('DELETE FROM crew_members WHERE account_id=$1', [account]);
  await assert.rejects(run('get_operation_requirements', { operationId: 'context-operation' }), { code: 'operation_unavailable' }, 'original opener loses discovery when leaving the Crew');
  await pool.query(`INSERT INTO crew_members (crew_id,account_id,name) VALUES ('context-crew',$1,'Context Carla')`, [account]);
  const crew = await run('get_crew', {}, only('social.read'));
  assert.equal(crew.crew.members.length, 2);
  assert.doesNotMatch(JSON.stringify(crew), /leader_account|account_id|foreign-car|987|4321|reward|"pot"/);
  const family = await run('get_family', {}, only('social.read'));
  assert.equal(family.extendedFamily.marriage.steward, 'Other Oliver');
  assert.doesNotMatch(JSON.stringify(family), /accountId|account_id|43210|98765|resources|cash|ammo|omr/);
  const familyResources = await run('get_group_resources', { group: 'family' });
  assert.equal(familyResources.resources.cash, 43210);
  assert.doesNotMatch(JSON.stringify(familyResources), /98765/);
  assert.equal((await run('get_alliances')).relations[0].active, true);

  const notifications = await run('get_notifications', {}, only('player.read'));
  assert.equal(notifications.events.length, 1);
  assert.equal(notifications.events[0].id, 'context-player-event');
  assert.doesNotMatch(JSON.stringify(await run('generate_brief_context')), /NEVER_EXPORT_SOLUTION|OTHER_ACCOUNT_SECRET|PRIVATE_PAYLOAD|foreign-event/);
  const publicWorld = await run('get_world_changes', {}, only('world.read'));
  assert.equal(publicWorld.events[0].id, 'context-public-world');
  assert.doesNotMatch(JSON.stringify(publicWorld), /context-player-event|UNPUBLISHED_DETAIL|crew_request|admin_oracle_private/);
  const recipe = (await run('get_crafting_recipes')).recipes.find((row) => row.id === 'recipe:hardened_steel');
  const missing = await run('get_missing_resources', { recipeId: recipe.id });
  assert.deepEqual(missing.missing, recipe.blockedBy);
  assert.equal(missing.available, recipe.available);
  assert((await run('get_crafting_path', { templateId: 'item:precision_lock_tool' })).recipes.length > 0);
  assert((await gateway.prepare('prepare_crafting_operation', account, { recipeId: 'recipe:car_salvage_basic', carId: 'context-car' }, full)).car);
  await assert.rejects(gateway.prepare('prepare_crafting_operation', account,
    { recipeId: 'recipe:car_salvage_basic', carId: 'foreign-car' }, full), { code: 'gateway_unavailable' });
  await assert.rejects(run('prepare_crafting_operation', { recipeId: 'recipe:hardened_steel' }), { code: 'gateway_confirmation_required' });
  assert.equal((await gateway.prepare('prepare_transaction', account, {}, full)).available, false);
  const actionable = await run('get_actionable_context', {}, only('player.read'));
  for (const key of ['immediate', 'solo', 'crew', 'family', 'mystery', 'crafting', 'territory', 'season', 'economic']) assert.deepEqual(actionable[key], []);
  assert.equal('best' in actionable, false);
  await assert.rejects(run('find_coordination_paths', {}, only('social.read')), { code: 'gateway_scope_required' });
  await assert.rejects(run('find_coordination_paths', { accountId: other }), { code: 'gateway_bad_input' });
  const authorizedKnowledge = [
    { id: 'own-clue', domain: 'clue', proposition: 'Own clue', value: 'known only to me', owned: true },
    { id: 'shared-clue', domain: 'clue', proposition: 'Shared clue', value: 'legitimately shared evidence', owned: false },
  ];
  const withKnowledge = createContextGateway({ pool, coordination: {
    async knowledgeBoard(actor, args) { assert.equal(actor, account); assert.equal(args.limit, 50); return { claims: authorizedKnowledge }; },
  } });
  const paths = await withKnowledge.execute('find_coordination_paths', account, { operationId: 'context-operation' }, only('social.read', 'coordination.read'));
  assert.equal(paths.paths.length, 4);
  assert(paths.paths.every((path) => path.readiness === 'unknown' && path.candidates.every((candidate) => candidate.eligibility === 'unknown')));
  assert.equal(paths.sharedKnowledge[0].id, 'shared-clue');
  assert.equal(paths.ownKnowledge[0].id, 'own-clue');
  assert.equal('ownInventory' in paths, false);
  assert.equal('ownCraftingOptions' in paths, false);
  assert.doesNotMatch(JSON.stringify(paths), /foreign-car|98765|"omr"|987|privateEvidence/);
  await assert.rejects(withKnowledge.execute('find_coordination_paths', account,
    { operationId: 'foreign-operation' }, only('social.read', 'coordination.read')), { code: 'operation_unavailable' });
  const fullPaths = await withKnowledge.execute('find_coordination_paths', account, { operationId: 'context-operation' }, full);
  assert.equal(fullPaths.ownInventory.equipment.cars[0].id, 'context-car');
  assert.doesNotMatch(JSON.stringify(fullPaths), /foreign-car|98765|987/);

  // Every published mission's preview must match its actual refusal/acceptance gate.
  // The fake query stops exactly at the first write, so no reward is executed here.
  const oldCooldown = process.env.MISSION_CD_MS;
  process.env.MISSION_CD_MS = '60000';
  try {
    for (const mission of MISSIONS) for (const high of [false, true]) for (const cooling of [false, true]) {
      const ch = { id: character, respect: high ? 1e9 : 0, muscle: high ? 10000 : 0,
        cunning: high ? 10000 : 0, speed: high ? 10000 : 0, trade_rep: high ? 1e9 : 0,
        gun: high ? GUNS.reduce((a, b) => a.fp > b.fp ? a : b).id : null,
        mission_at: cooling ? new Date(Date.now() + 60000) : null };
      const readiness = missionReadiness(ch, mission, { assets: [], gear: [] });
      const client = { async query(sql) { if (/^SELECT/.test(sql)) return { rows: [] }; throw Object.assign(new Error('mutation boundary'), { code: 'accepted_at_write' }); } };
      let refusal;
      try { await doMission(ch, mission.id, client, { owned: { assets: [], gear: [] } }); } catch (error) { refusal = error; }
      assert.equal(refusal.code, readiness.missing.length ? 'reqs' : readiness.cooldownSeconds ? 'cooldown' : 'accepted_at_write');
      assert.equal(readiness.available, refusal.code === 'accepted_at_write');
      if (refusal.code === 'reqs') assert.deepEqual(refusal.data.need, Object.fromEntries(readiness.missing.map(({ k, need }) => [k, need])));
    }
  } finally {
    if (oldCooldown === undefined) delete process.env.MISSION_CD_MS; else process.env.MISSION_CD_MS = oldCooldown;
  }

  const parameterless = CAPABILITIES.filter((entry) => ['READ', 'ANALYZE'].includes(entry.actionClass) && !entry.inputSchema.required?.length);
  for (const entry of parameterless) await run(entry.name);
  const after = (await pool.query('SELECT cash,energy,last_accrued_at FROM characters WHERE id=$1', [character])).rows[0];
  assert.deepEqual(after, before, 'READ/ANALYZE never accrue or persist character state');
  console.log('gateway context: scope isolation, owner isolation, hidden discoveries, bounded inputs, authoritative recipes and read-only previews passed');
} finally { await pool.end(); }
