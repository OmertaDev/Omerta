// Core inventory discovery, retained prerequisites and conserved recipe capacity.
// Native mode uses only an explicit loopback scratch endpoint and disposable schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { withCharacter } from '../src/game.js';
import { createCrew, leaveCrew } from '../src/crew.js';
import { createGang, leaveGang } from '../src/social.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';
import { createCraftingContext, craftWorldGraphRecipe, salvageCar, recipeCatalog, recipeCatalogForPlayer, planCraftingSnapshot } from '../src/crafting.js';
import { grantStack, consumeStack, createItem, withItemMutation, withItemRead, withItemTransaction, inventoryBoard } from '../src/items.js';
import { consumeOwnedCarForItemMutation } from '../src/economy.js';
import { normalizeRecipePolicy } from '../src/recipe-policy.js';
import { recipeScarcityAvailable, reserveRecipeScarcity } from '../src/recipe-scarcity.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { createCoordinationKnowledge } from '../src/coordination/knowledge.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { compileWorldObjects } from '../src/world-kernel.js';
import { createMysteryContext, mysteryDefinitionHash, startMystery, completeNode } from '../src/mysteries.js';

let pool, cleanup;
const postgres = process.argv.includes('--postgres');
if (postgres) {
  assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit WORLD_KERNEL_TEST_DATABASE_URL required');
  const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
  const { Pool } = await import('pg'), base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `recipe_policy_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace} -c lock_timeout=5000 -c statement_timeout=15000` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true }); registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}
const key = () => crypto.randomUUID(), owner = (id) => ({ scope: 'account', id }), chId = (id) => `${id}-ch`;
const reject = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0];
const claimRequirement = { contentHash: graph.contentHash, ...graph.nodes.find((n) => n.id === 'docks-source').claim };
const known = { adapter: 'knowledge', requirement: claimRequirement };
const template = (id, visibility = 'public') => ({ id, type: 'item_template', version: 1, visibility,
  metadata: { inventoryClass: 'unique', inert: true, tradeable: false, exportEligible: false } });
const recipe = (name, extra = {}) => ({ id: `recipe:policy_${name}`, type: 'recipe', version: 1, visibility: 'public',
  repeatability: 'repeatable', consumes: [{ templateId: 'mat:wire', quantity: 1 }],
  produces: [{ templateId: 'item:policy_output', quantity: 1 }], cashCost: 5, ...extra });
const packageFor = (nodes) => ({ id: 'recipe-policy-fixture', version: 1, season: 'core', dependsOn: ['core-materials', 'automotive-salvage'], nodes });
const registryFor = (nodes) => loadAndValidateGraphPackages([...PHASE1_WORLD_GRAPH_PACKAGES, packageFor(nodes)]);
const basicNodes = [template('item:policy_output'), template('item:policy_secret', 'hidden'), template('item:policy_tool')];
const mysteryPackage = { id: 'recipe-policy-mystery', version: 1, season: 'core', dependsOn: [], nodes: [
  { id: 'm:policy_complete', type: 'mystery_step', visibility: 'public', metadata: { terminal: true } },
] };
const mysteryRegistry = loadAndValidateGraphPackages([...PHASE1_WORLD_GRAPH_PACKAGES, mysteryPackage]);
const mysteryFact = { adapter: 'mystery_state', requirement: { graphId: mysteryPackage.id, graphVersion: 1,
  definitionHash: mysteryDefinitionHash(mysteryRegistry, mysteryPackage.id), nodeId: 'm:policy_complete', ownerScope: 'account', state: 'completed' } };
const facility = compileWorldObjects(registryFor(basicNodes), [{ id: 'facility:policy_workbench', type: 'facility', title: 'Workbench', locationId: 'docks',
  states: ['closed', 'open'], initialState: 'closed', publicStates: ['open'], knowledge: [claimRequirement],
  actions: [{ id: 'open', from: 'closed', to: 'open', itemTemplateId: 'item:policy_tool', materials: [] }] }])[0];
const legacyRecipe = recipe('legacy_replay'); delete legacyRecipe.cashCost;
const recipes = [
  ...['known', 'secret', 'partial'].map((mode) => recipe(mode, { discovery: { mode, requirements: [known] },
    produces: [{ templateId: 'item:policy_secret', quantity: 1 }] })),
  recipe('legacy_hidden', { produces: [{ templateId: 'item:policy_secret', quantity: 1 }] }),
  ...['crew', 'family'].map((mode) => recipe(mode, { discovery: { mode, requirements: [] } })),
  recipe('mystery', { discovery: { mode: 'mystery_unlocked', requirements: [mysteryFact] } }),
  recipe('tool', { produces: [{ templateId: 'item:policy_tool', quantity: 1 }] }),
  legacyRecipe,
  recipe('workbench', { conditions: [
    { adapter: 'location', value: 'docks' },
    { adapter: 'item_ownership', requirement: { templateId: 'item:policy_tool', provenance: 'crafted' } },
    { adapter: 'world_state', requirement: { objectId: facility.id, definitionHash: facility.contentHash, state: 'open' } },
  ] }),
  recipe('account_cap', { scarcity: { caps: [{ scope: 'account', period: 'lifetime', limit: 1 }] } }),
  recipe('global_cap', { scarcity: { caps: [{ scope: 'global', period: 'lifetime', limit: 1 }] } }),
  recipe('territory_cap', { scarcity: { caps: [{ scope: 'territory', period: 'day', limit: 1 }] } }),
  recipe('rollback', { scarcity: { caps: [{ scope: 'account', period: 'lifetime', limit: 10 }, { scope: 'global', period: 'lifetime', limit: 10 }] } }),
];
const registry = registryFor([...basicNodes, ...recipes]);
const context = createCraftingContext({ registry, knowledgeEnabled: true, sharingEnabled: true, worldDefinitions: [facility] });
const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
const api = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const craft = (accountId, name, requestKey = key(), selectedPool = pool, extra = {}) => withItemTransaction(selectedPool,
  (client) => craftWorldGraphRecipe(client, { ...extra, accountId }, `recipe:policy_${name}`, requestKey, context));
const catalog = (accountId, names) => withItemTransaction(pool, (client) => recipeCatalogForPlayer(client, accountId, context, names.map((name) => `recipe:policy_${name}`)));
async function project(accountId, names, selectedPool = pool) {
  return withItemRead(selectedPool, async (client) => {
    const plan = await planCraftingSnapshot(client, accountId, context, names.map((name) => `recipe:policy_${name}`));
    const snapshot = await knowledge.readSnapshot(client, { viewer: { accountId }, groups: plan.groups });
    return plan.render(snapshot);
  });
}
async function player(id) {
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash) VALUES($1,$2,$2,1,'docks',10000,100000)", [chId(id), id]);
  await withItemTransaction(pool, (client) => grantStack(client, owner(id), 'mat:wire', 100, 'standard', 'policy fixture', key()));
}
async function discover(id) {
  let instance = (await api.create(id, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  instance = (await api.act(id, instance.id, { expectedRevision: instance.revision, actionId: instance.actions[0].id }, key())).instance;
  await api.act(id, instance.id, { expectedRevision: instance.revision, actionId: instance.actions.find((a) => a.kind === 'discover').id }, key());
  return (await api.knowledgeBoard(id)).claims.find((claim) => claim.owned).id;
}
async function state() {
  return Object.fromEntries(await Promise.all(['characters', 'cars', 'item_stacks', 'item_instances', 'item_events', 'item_mutation_guards', 'transactions', 'world_recipe_usage']
    .map(async (table) => [table, (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
}
function observedPool({ failAfter, trace = [] } = {}) {
  let fired = false;
  return { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect(); return { release: () => client.release(), async query(sql, params) {
      trace.push(String(sql)); const result = await client.query(sql, params);
      if (!fired && failAfter?.test(String(sql))) { fired = true; throw Object.assign(Error('injected crafting failure'), { code: 'injected_crafting_failure' }); }
      return result;
    } };
  } };
}
function absentQuotaRacePool(recipeId) {
  let arrive = 0, release;
  const gate = new Promise((resolve) => { release = resolve; });
  return { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect(); return { release: () => client.release(), async query(sql, params) {
      const result = await client.query(sql, params);
      if (/SELECT used,updated_at FROM world_recipe_usage/.test(String(sql)) && params[0] === recipeId && !result.rows.length) {
        if (++arrive === 2) release();
        let timer;
        try { await Promise.race([gate, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Quota insert contenders did not both reach the observed SQL barrier')), 10000); })]); }
        finally { clearTimeout(timer); }
      }
      return result;
    } };
  } };
}
try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const id of ['policy-author', 'policy-reader', 'policy-other', 'policy-racer', 'policy-legacy']) await player(id);
  const author = 'policy-author', reader = 'policy-reader', other = 'policy-other';
  // These envelopes reproduce graphMutationAuthority at baseline a18c63c. Mint
  // actual V1 guards and conserved leaf effects through the old envelope, then
  // replay the upgraded adapters against the same database and receipts.
  const legacyAccount = 'policy-legacy', legacyCraftKey = key(), legacySalvageKey = key(), legacyCar = key();
  const legacyCraftIdentity = { packageId: 'recipe-policy-fixture', packageVersion: 1, recipeId: 'recipe:policy_legacy_replay', recipeVersion: 1 };
  const legacyCraftEnvelope = { ...legacyCraftIdentity,
    consumes: [{ templateId: 'mat:wire', quantity: 1, quality: 'standard' }],
    produces: [{ templateId: 'item:policy_output', quantity: 1, quality: 'standard' }], conditions: [], cashCost: 0 };
  const legacyCraftReceipt = await withItemTransaction(pool, (client) => withItemMutation(client, owner(legacyAccount), 'craft', legacyCraftKey,
    legacyCraftEnvelope, async (mutation) => ({ ok: true, kind: 'craft', recipe: legacyCraftIdentity, cashCost: 0, cashAfter: 100000,
      inputs: [await consumeStack(client, owner(legacyAccount), 'mat:wire', 1, 'standard', 'craft recipe:policy_legacy_replay input', mutation)],
      outputs: [await createItem(client, owner(legacyAccount), 'item:policy_output', 'crafted', mutation)] })));
  await pool.query("UPDATE characters SET loc='foundry' WHERE account_id=$1", [legacyAccount]);
  await pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,'junker','stock',30)", [legacyCar, chId(legacyAccount)]);
  const legacySalvageIdentity = { packageId: 'automotive-salvage', packageVersion: 1, recipeId: 'recipe:car_salvage_basic', recipeVersion: 1 };
  const legacySalvageEnvelope = { ...legacySalvageIdentity, consumes: [{ assetType: 'car', quantity: 1 }],
    produces: [{ templateId: 'mat:scrap_steel', quantity: 6, quality: 'standard' }, { templateId: 'mat:wire', quantity: 2, quality: 'standard' },
      { templateId: 'mat:salvage_parts', quantity: 2, quality: 'standard' }],
    conditions: [{ adapter: 'location', value: 'foundry' }, { adapter: 'owns_car', selector: { kind: 'carType', value: 'junker' } }], cashCost: 0, carId: legacyCar };
  const legacySalvageReceipt = await withItemTransaction(pool, (client) => withItemMutation(client, owner(legacyAccount), 'salvage_car', legacySalvageKey,
    legacySalvageEnvelope, async (mutation) => {
      const car = await consumeOwnedCarForItemMutation(client, { accountId: legacyAccount }, chId(legacyAccount), legacyCar, [{ kind: 'carType', value: 'junker' }]);
      const outputs = [];
      for (const output of legacySalvageEnvelope.produces) outputs.push(await grantStack(client, owner(legacyAccount), output.templateId,
        output.quantity, output.quality, 'recipe:car_salvage_basic output', mutation));
      return { ok: true, kind: 'salvage_car', recipe: legacySalvageIdentity, cashCost: 0, cashAfter: 100000,
        car, inputs: [{ assetType: 'car', quantity: 1, id: car.id }], outputs };
    }));
  for (const [requestKey, kind, request] of [[legacyCraftKey, 'craft', legacyCraftEnvelope], [legacySalvageKey, 'salvage_car', legacySalvageEnvelope]]) {
    const guard = (await pool.query('SELECT request_hash,envelope_version FROM item_mutation_guards WHERE idempotency_key=$1', [requestKey])).rows[0];
    assert.equal(guard.envelope_version, 1);
    assert.equal(guard.request_hash, crypto.createHash('sha256').update(JSON.stringify({ kind, owner: owner(legacyAccount), request })).digest('hex'));
  }
  const legacyBeforeReplay = await state();
  assert.deepEqual(await craft(legacyAccount, 'legacy_replay', legacyCraftKey), legacyCraftReceipt);
  assert.deepEqual(await withItemTransaction(pool, (client) => salvageCar(client, { accountId: legacyAccount }, legacyCar,
    'recipe:car_salvage_basic', legacySalvageKey, context)), legacySalvageReceipt);
  assert.deepEqual(await state(), legacyBeforeReplay, 'Upgrade replay preserves old effects, removed car, quota state and receipts');
  for (const explicitPolicy of [{ discovery: { mode: 'public', requirements: [] } }, { scarcity: { caps: [] } },
    { scarcity: { caps: [{ scope: 'account', period: 'lifetime', limit: 1 }] } }]) {
    const changed = createCraftingContext({ registry: registryFor([...basicNodes, ...recipes.map((entry) => entry.id === legacyCraftIdentity.recipeId
      ? { ...entry, ...explicitPolicy } : entry)]), worldDefinitions: [facility] });
    await reject(withItemTransaction(pool, (client) => craftWorldGraphRecipe(client, { accountId: legacyAccount },
      legacyCraftIdentity.recipeId, legacyCraftKey, changed)), 'idempotency_conflict');
    const changedSalvagePackages = structuredClone(PHASE1_WORLD_GRAPH_PACKAGES);
    Object.assign(changedSalvagePackages.find((pkg) => pkg.id === 'automotive-salvage').nodes
      .find((node) => node.id === legacySalvageIdentity.recipeId), explicitPolicy);
    const changedSalvage = createCraftingContext({ registry: loadAndValidateGraphPackages(changedSalvagePackages) });
    await reject(withItemTransaction(pool, (client) => salvageCar(client, { accountId: legacyAccount }, legacyCar,
      legacySalvageIdentity.recipeId, legacySalvageKey, changedSalvage)), 'idempotency_conflict');
  }
  assert.deepEqual(await state(), legacyBeforeReplay, 'Explicit new policy remains bound to its request and cannot reuse a historical key');
  console.log('recipe-policy: baseline V1 craft and salvage receipts replay across upgrade; explicit policy changes still conflict');
  const invalidPolicies = [
    { discovery: null }, { scarcity: null }, { discovery: { mode: 'secret', requirements: [] } },
    { discovery: { mode: 'public', requirements: [known] } }, { discovery: { mode: 'unknown', requirements: [] } },
    { discovery: { mode: 'mystery_unlocked', requirements: [known] } },
    { discovery: { mode: 'secret', requirements: new Array(1) } },
    { discovery: { mode: 'secret', requirements: [{ ...known, accountId: author }] } },
    { discovery: { mode: 'secret', requirements: [{ adapter: 'social', requirement: { relation: 'same_crew', subject: 'client' } }] } },
    { scarcity: { caps: [{ scope: 'global', period: 'day', limit: 0 }] } },
    { scarcity: { caps: [{ scope: 'global', period: 'day', limit: 1000001 }] } },
    { scarcity: { caps: [{ scope: 'global', period: 'day', limit: 1, subjectId: author }] } },
    { scarcity: { caps: [{ scope: 'global', period: 'day', limit: 1 }, { scope: 'global', period: 'day', limit: 2 }] } },
  ];
  for (const value of invalidPolicies) assert.throws(() => normalizeRecipePolicy(value), (error) => ['bad_recipe_policy', 'bad_world_prerequisite'].includes(error.code));
  assert.throws(() => createCraftingContext({ registry: registryFor([...basicNodes, recipes.find((r) => r.id === 'recipe:policy_tool'), recipe('bad_tool', {
    consumes: [{ templateId: 'item:policy_tool', quantity: 1 }], conditions: [{ adapter: 'item_ownership', requirement: { templateId: 'item:policy_tool', provenance: 'crafted' } }],
  })]) }), (error) => error.code === 'bad_recipe_policy');

  const names = ['known', 'secret', 'partial', 'legacy_hidden'];
  const before = await state(), unknown = await project(reader, names);
  assert.deepEqual(unknown, [{ id: 'recipe:policy_partial', title: 'recipe:policy_partial', discovered: false, canAttempt: false, missing: ['discovery'] }]);
  for (const hidden of [claimRequirement.contentHash, claimRequirement.sourceRoot, 'item:policy_secret', 'recipe:policy_secret', 'mat:wire']) assert(!JSON.stringify(unknown).includes(hidden));
  assert.deepEqual(await state(), before, 'Composed read never writes quota or economic rows');
  const forged = recipeCatalog({ character: { id: chId(author), loc: 'docks', cash: 100000 }, knowledge: new Set([JSON.stringify(claimRequirement)]),
    prerequisites: new Set(['forged']), inventory: await inventoryBoard(pool, owner(reader)) }, context);
  assert(!forged.some((r) => r.id === 'recipe:policy_secret'));
  await reject(craft(reader, 'secret', key(), pool, { discovered: true, knowledge: new Set([claimRequirement]), asOf: 0 }), 'recipe_unavailable');
  const claimId = await discover(author), target = (await api.knowledgeTargets(author, { characterName: reader })).targets.find((t) => t.kind === 'account');
  let claim = (await api.knowledgeGet(author, claimId)).claim;
  await api.shareKnowledge(author, claimId, { targetId: target.id, expectedAclRevision: claim.aclRevision }, key());
  const trace = [], learned = await project(reader, names, observedPool({ trace }));
  assert.equal(learned.length, 3); assert(learned.every((r) => r.canAttempt && r.produces[0].templateId === 'item:policy_secret'));
  assert(!learned.some((r) => r.id === 'recipe:policy_legacy_hidden'), 'Legacy public recipes cannot declassify hidden output templates');
  assert.equal((await catalog(reader, ['secret']))[0].available, true, 'Server catalog retains its authentic preview brand');
  assert.deepEqual(await catalog(reader, ['legacy_hidden']), [], 'Authoritative route catalog also forbids ungated hidden entries');
  assert(!trace.some((sql) => /FOR (UPDATE|SHARE)|INSERT|UPDATE world_recipe_usage/.test(sql)), 'Planner remains read-only');
  const replayKey = key(), receipt = await craft(reader, 'secret', replayKey);
  claim = (await api.knowledgeGet(author, claimId)).claim;
  await api.revokeKnowledge(author, claimId, { grantId: claim.grants[0].id, expectedAclRevision: claim.aclRevision }, key());
  assert.deepEqual(await project(reader, ['secret']), []); await reject(craft(reader, 'secret'), 'recipe_unavailable');
  assert.deepEqual(await craft(reader, 'secret', replayKey), receipt, 'Committed receipt survives later knowledge loss');
  console.log('recipe-policy: authentic discovery, redacted partial cards, hidden learned outputs, read parity and revoked replay pass');

  assert.deepEqual(await project(other, ['crew', 'family', 'mystery']), []);
  await withCharacter(pool, other, (ch, client, h) => createCrew(ch, 'Recipe Crew', client, h));
  await withCharacter(pool, other, (ch, client, h) => createGang(ch, 'Recipe Family', 'RECP', client, h));
  assert.equal((await project(other, ['crew', 'family'])).length, 2);
  await craft(other, 'crew'); await craft(other, 'family');
  await withCharacter(pool, other, (ch, client, h) => leaveCrew(ch, client, h));
  await withCharacter(pool, other, (ch, client, h) => leaveGang(ch, client, h));
  await reject(craft(other, 'crew'), 'recipe_unavailable'); await reject(craft(other, 'family'), 'recipe_unavailable');
  const mystery = createMysteryContext({ registry: mysteryRegistry, accountId: other });
  await withItemTransaction(pool, (client) => startMystery(client, mystery, owner(other), mysteryPackage.id, 1, key()));
  await reject(craft(other, 'mystery'), 'recipe_unavailable');
  await withItemTransaction(pool, (client) => completeNode(client, mystery, owner(other), mysteryPackage.id, 'm:policy_complete', { idempotencyKey: key() }));
  assert.equal((await project(other, ['mystery']))[0].canAttempt, true); await craft(other, 'mystery');
  await reject(craft(other, 'workbench'), 'recipe_requirements');
  await withItemTransaction(pool, (client) => createItem(client, owner(other), 'item:policy_tool', 'awarded', key()));
  await pool.query("INSERT INTO world_kernel_objects(id,definition_hash,state,object_kind,location_id) VALUES($1,$2,$3,'facility','docks')", [facility.id, facility.contentHash, 'open']);
  await reject(craft(other, 'workbench'), 'recipe_requirements');
  const toolReceipt = await craft(other, 'tool'), toolsBefore = (await inventoryBoard(pool, owner(other))).items.filter((i) => i.templateId === 'item:policy_tool');
  assert.equal((await project(other, ['workbench']))[0].canAttempt, true);
  await craft(other, 'workbench');
  assert.deepEqual((await inventoryBoard(pool, owner(other))).items.filter((i) => i.templateId === 'item:policy_tool'), toolsBefore, 'Retained crafted tool is not consumed');
  assert(toolReceipt.outputs.length === 1);
  await pool.query('UPDATE world_kernel_objects SET state=$2 WHERE id=$1', [facility.id, 'closed']);
  assert.equal((await project(other, ['workbench']))[0].canAttempt, false); await reject(craft(other, 'workbench'), 'recipe_requirements');
  console.log('recipe-policy: live Crew/Family membership, real mystery completion, retained crafted provenance and world facility state pass');

  const capKey = key(), capReceipt = await craft(author, 'account_cap', capKey), afterCap = await state();
  assert.deepEqual(await craft(author, 'account_cap', capKey), capReceipt); assert.deepEqual(await state(), afterCap);
  await reject(craft(author, 'account_cap'), 'recipe_exhausted');
  assert((await project(author, ['account_cap']))[0].missing.includes('scarcity'));
  await craft(reader, 'account_cap');
  await craft(author, 'territory_cap', key(), pool, { territory: 'client-forged', loc: 'client-forged', asOf: 0 });
  await reject(craft(reader, 'territory_cap'), 'recipe_exhausted');
  const territory = (await pool.query("SELECT subject_id FROM world_recipe_usage WHERE recipe_id='recipe:policy_territory_cap'")).rows;
  assert.deepEqual(territory.map((r) => r.subject_id), ['docks']);
  await pool.query("UPDATE characters SET loc='foundry' WHERE account_id=$1", [reader]); await craft(reader, 'territory_cap');

  // Deterministic clock boundary checks operate on the same quota helper used by craft.
  const timed = { id: 'recipe:policy_timed', ...normalizeRecipePolicy({ scarcity: { caps: [
    { scope: 'account', period: 'day', limit: 1 }, { scope: 'account', period: 'week', limit: 1 }, { scope: 'account', period: 'season', limit: 1 },
  ] } }) }, actor = { owner: owner(author), character: { loc: 'docks' } };
  await withItemTransaction(pool, (client) => reserveRecipeScarcity(client, timed, actor, 0));
  assert.equal(await recipeScarcityAvailable(pool, timed, actor, 86400000), false, 'Daily rollover cannot evade weekly/season capacity');
  assert.equal(await recipeScarcityAvailable(pool, timed, actor, 28 * 86400000), true);
  await withItemTransaction(pool, (client) => reserveRecipeScarcity(client, timed, actor, 28 * 86400000));
  // Native contenders both observe an absent row before either may INSERT, proving
  // the unique-key conflict path rather than hoping execution happens to overlap.
  const competingPool = postgres ? absentQuotaRacePool('recipe:policy_global_cap') : pool;
  const races = await Promise.allSettled([craft(author, 'global_cap', key(), competingPool), craft('policy-racer', 'global_cap', key(), competingPool)]);
  assert.equal(races.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(races.find((r) => r.status === 'rejected').reason.code, 'recipe_exhausted');
  assert.equal(Number((await pool.query("SELECT used FROM world_recipe_usage WHERE recipe_id='recipe:policy_global_cap'")).rows[0].used), 1);
  const sameKey = key(), same = await Promise.all([craft(other, 'rollback', sameKey), craft(other, 'rollback', sameKey)]);
  assert.deepEqual(same[0], same[1]);
  console.log(`recipe-policy: authoritative account/global/territory caps, period rollover and ${postgres ? 'native concurrent' : 'serialized'} duplicate debit pass`);

  for (const failAfter of [/INSERT INTO world_recipe_usage/, /UPDATE world_recipe_usage SET used=used\+1/, /INSERT INTO item_instances/, /INSERT INTO item_events/]) {
    const requestKey = key(), initial = await state();
    // A fresh actor counter exercises failed acknowledgement after the initial INSERT too.
    const selected = failAfter.source.startsWith('INSERT INTO world_recipe_usage') ? 'policy-racer' : other;
    await reject(craft(selected, 'rollback', requestKey, observedPool({ failAfter })), 'injected_crafting_failure');
    assert.deepEqual(await state(), initial, `Failure after ${failAfter} restores quota, inputs, cash, outputs and receipt`);
    await craft(selected, 'rollback', requestKey);
  }
  const restart = createCraftingContext({ registry, knowledgeEnabled: true, sharingEnabled: true, worldDefinitions: [facility] });
  await reject(withItemTransaction(pool, (client) => craftWorldGraphRecipe(client, { accountId: author }, 'recipe:policy_account_cap', key(), restart)), 'recipe_exhausted');
  console.log('recipe-policy: quota insert/update and late inventory failure compensation, retry and restart durability pass');
} finally { await cleanup(); }
