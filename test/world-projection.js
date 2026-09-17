// End-to-end projection of real domain commands; presentation never owns game state.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { travel, withCharacter } from '../src/game.js';
import { createCrew, inviteToCrew, acceptInvite, leaveCrew, CREW_FIRST_CHARACTER_LOCKS } from '../src/crew.js';
import { createGang, joinGang, leaveGang, promoteMember } from '../src/social.js';
import { withItemTransaction } from '../src/items.js';
import { createCraftingContext, craftWorldGraphRecipe, salvageCar } from '../src/crafting.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { createCoordinationKnowledge } from '../src/coordination/knowledge.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_KNOWLEDGE_PILOT } from '../src/coordination/pilot.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createWorldKernelQuery } from '../src/world-kernel-query.js';
import { createWorldProjection } from '../src/world-projection.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS, WORLD_KERNEL_RECIPE } from '../src/content/world-kernel-pilot.js';
import { COORDINATION_OPERATION_PILOT } from '../src/content/coordination-operation-pilot.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
import { loadAndValidateGraphPackages } from '../src/worldgraph-validate.js';

const postgres = process.argv.includes('--postgres');
let pool, cleanup;
if (postgres) {
  assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit isolated PostgreSQL endpoint required');
  const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
  const { Pool } = await import('pg'), base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `projection_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace} -c lock_timeout=5000 -c statement_timeout=15000` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true }); registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool(); cleanup = () => pool.end(); dbCaps.skipLocked = false;
}
const key = () => crypto.randomUUID(), chId = (id) => `${id}-ch`;
const actors = Object.fromEntries(['organizer', 'locksmith', 'supplier', 'researcher'].map((role) => [role, `projection-${role}`]));
const boss = actors.organizer, a = actors.locksmith, b = actors.researcher, outsider = 'projection-outsider';
const policy = { enabled: true, knowledgeEnabled: true, sharingEnabled: true };
const crafting = createCraftingContext({ registry: WORLD_KERNEL_REGISTRY, ...policy });
const knowledgeCommands = createCoordinationService({ pool, registry: COORDINATION_KNOWLEDGE_PILOT, ...policy });
const graph = coordinationGraphs(COORDINATION_KNOWLEDGE_PILOT)[0], secret = WORLD_KERNEL_OBJECTS[0].knowledge[0];
function services(selectedPool = pool) {
  const kernel = createWorldKernel({ pool: selectedPool, registry: WORLD_KERNEL_REGISTRY, objects: WORLD_KERNEL_OBJECTS, ...policy });
  const knowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
  const query = createWorldKernelQuery({ pool: selectedPool, registry: WORLD_KERNEL_REGISTRY, knowledge });
  const operations = createFamilyOperations({ pool: selectedPool, registry: WORLD_KERNEL_REGISTRY, kernel,
    definitions: COORDINATION_OPERATION_PILOT, ...policy });
  return { operations, projection: createWorldProjection({ pool: selectedPool, query, kernel, knowledge,
    familyOperations: operations, crafting, recipeIds: [WORLD_KERNEL_RECIPE] }) };
}
const { operations, projection } = services();
const tx = (action) => withItemTransaction(pool, action);
const social = (accountId, action, hooks) => withCharacter(pool, accountId, action, hooks);
async function player(accountId) {
  await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [accountId]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [accountId]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash,muscle,cunning,speed) VALUES($1,$2,$2,1,'foundry',10000,100000,50,50,50)", [chId(accountId), accountId]);
}
async function salvage(accountId) {
  const car = key();
  await pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,'junker','stock',30)", [car, chId(accountId)]);
  await tx((client) => salvageCar(client, { accountId }, car, 'recipe:car_salvage_basic', key()));
}
async function discover(accountId) {
  await social(accountId, (ch, client, h) => travel(ch, 'docks', client, h));
  let instance = (await knowledgeCommands.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
  instance = (await knowledgeCommands.act(accountId, instance.id,
    { expectedRevision: instance.revision, actionId: instance.actions[0].id }, key())).instance;
  const action = instance.actions.find((entry) => entry.kind === 'discover');
  await knowledgeCommands.act(accountId, instance.id, { expectedRevision: instance.revision, actionId: action.id }, key());
  await social(accountId, (ch, client, h) => travel(ch, 'foundry', client, h));
  return (await knowledgeCommands.knowledgeBoard(accountId)).claims.find((claim) => claim.owned).id;
}
const recipe = (view) => view.recipes.find((entry) => entry.id === WORLD_KERNEL_RECIPE);
const hiddenKnowledge = (view, claimId) => {
  assert.equal(view.knowledge.claims.length, 0); assert.equal(view.worldObjects.length, 0);
  for (const value of [claimId, secret.contentHash, secret.domain, secret.proposition, secret.sourceRoot, secret.value.value]) {
    assert(!JSON.stringify(view).includes(value), `Unknowing projection disclosed ${value}`);
  }
  assert(recipe(view).missing.includes('knowledge')); assert.equal(recipe(view).canAttempt, false);
};
const trace = [];
function observedPool() {
  const record = (client) => async (sql, params) => { trace.push(sql); return client.query(sql, params); };
  return { query: record(pool), async connect() { const client = await pool.connect(); return { query: record(client), release: () => client.release() }; } };
}
async function state() {
  return Object.fromEntries(await Promise.all(['characters', 'crew_objectives', 'world_operations', 'world_operation_events',
    'coordination_claims', 'coordination_claim_grants', 'item_instances', 'item_stacks', 'world_kernel_objects',
    'world_kernel_events', 'item_mutation_guards', 'transactions'].map(async (table) => [table,
    (await pool.query(`SELECT * FROM ${table}`)).rows.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))])));
}
try {
  await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  for (const id of [...Object.values(actors), outsider]) await player(id);
  const crew = await social(boss, (ch, client, h) => createCrew(ch, 'Projection Crew', client, h));
  const family = await social(boss, (ch, client, h) => createGang(ch, 'Projection Family', 'PROJ', client, h));
  for (const id of [a, actors.supplier, b]) {
    await social(boss, (ch, client, h) => inviteToCrew(ch, id, client, h), CREW_FIRST_CHARACTER_LOCKS);
    await social(id, (ch, client, h) => acceptInvite(ch, crew.id, client, h));
    await social(id, (ch, client, h) => joinGang(ch, family.gangId, client, h));
  }
  const claimId = await discover(a); await salvage(b);
  assert.equal((await projection.snapshot(a)).knowledge.claims[0].id, claimId);
  hiddenKnowledge(await projection.snapshot(b), claimId); hiddenKnowledge(await projection.snapshot(outsider), claimId);
  async function shareCrew() {
    const target = (await knowledgeCommands.knowledgeTargets(a)).targets.find((entry) => entry.kind === 'crew');
    assert(target);
    const { claim } = await knowledgeCommands.knowledgeGet(a, claimId);
    return knowledgeCommands.shareKnowledge(a, claimId, { targetId: target.id, expectedAclRevision: claim.aclRevision }, key());
  }
  const shared = await shareCrew();
  let view = await projection.snapshot(b);
  assert.equal(view.knowledge.claims[0].id, claimId); assert.equal(view.knowledge.claims[0].owned, false);
  assert.equal(view.worldObjects[0].id, WORLD_KERNEL_OBJECTS[0].id); assert.equal(recipe(view).canAttempt, true);
  assert(!JSON.stringify(view).includes(secret.sourceRoot), 'Source roots are not part of player presentation');
  assert(!Object.hasOwn(view, 'nodes') && !Object.hasOwn(view, 'relationships'));
  hiddenKnowledge(await projection.snapshot(outsider), claimId);
  const ownedView = await projection.snapshot(a);
  assert.equal(ownedView.knowledge.claims[0].aclRevision, 1);
  assert.equal(ownedView.knowledge.claims[0].grants[0].kind, 'crew');
  await knowledgeCommands.revokeKnowledge(a, claimId, { grantId: shared.claim.grants[0].id, expectedAclRevision: 1 }, key());
  hiddenKnowledge(await projection.snapshot(b), claimId);
  await shareCrew();
  await social(b, (ch, client, h) => leaveCrew(ch, client, h), CREW_FIRST_CHARACTER_LOCKS);
  hiddenKnowledge(await projection.snapshot(b), claimId);
  await social(boss, (ch, client, h) => inviteToCrew(ch, b, client, h), CREW_FIRST_CHARACTER_LOCKS);
  await social(b, (ch, client, h) => acceptInvite(ch, crew.id, client, h));
  assert.equal(recipe(await projection.snapshot(b)).canAttempt, true);

  const operationId = (await operations.create(boss, { definitionId: COORDINATION_OPERATION_PILOT[0].id }, key())).operationId;
  const command = (role, action, input = {}) => operations.command(actors[role], operationId, action, input, key());
  await command('organizer', 'publish');
  for (const role of COORDINATION_OPERATION_PILOT[0].roles) await command(role.id, 'join', { roleId: role.id });
  await salvage(a); await salvage(actors.supplier);
  const item = (await tx((client) => craftWorldGraphRecipe(client, { accountId: a }, WORLD_KERNEL_RECIPE, key(), crafting))).outputs[0];
  const crafted = (await projection.snapshot(a)).inventory.items.find((entry) => entry.id === item.id);
  assert(crafted.provenance.some((event) => event.kind === 'created' && event.provenance === 'crafted'));
  assert(crafted.provenance.every((event) => Object.keys(event).every((name) => ['id', 'kind', 'provenance', 'occurredAt'].includes(name))));
  for (const role of COORDINATION_OPERATION_PILOT[0].roles) for (const requirement of role.requirements) {
    await command(role.id, 'commit', { requirementId: requirement.id });
  }
  const itemPlan = (await projection.snapshot(a, { operationId })).operations.selected.roles.find((role) => role.mine)
    .requirements.find((requirement) => requirement.kind === 'item').actions.find((action) => action.action === 'contribute');
  assert.equal(itemPlan.canAttempt, true); assert.equal(itemPlan.input.itemId, item.id);
  const selectedB = (await projection.snapshot(b, { operationId })).operations.selected;
  assert(selectedB.roles.find((role) => role.mine).requirements[0].actions.find((action) => action.action === 'contribute').canAttempt);
  assert(selectedB.roles.filter((role) => !role.mine).every((role) => role.requirements.every((requirement) => requirement.actions.length === 0)));
  for (const role of COORDINATION_OPERATION_PILOT[0].roles) for (const requirement of role.requirements) {
    await command(role.id, 'contribute', { requirementId: requirement.id, ...(requirement.kind === 'item' ? { itemId: item.id } : {}) });
  }
  await command('organizer', 'approve');
  const beforeRead = await state();
  const measured = services(observedPool()).projection;
  const ready = await measured.snapshot(boss, { operationId });
  assert.equal(ready.operations.selected.readiness.ready, true);
  assert(ready.operations.selected.actions.find((action) => action.action === 'execute').canAttempt);
  assert(!trace.some((sql) => /\bFOR (?:UPDATE|SHARE)\b|^\s*(?:INSERT|UPDATE|DELETE|ALTER|CREATE)\b/i.test(sql)), 'Aggregate only reads');
  assert.equal(trace.filter((sql) => /^BEGIN/.test(sql)).length, postgres ? 1 : 0);
  if (postgres) assert(trace.includes('BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY'));
  assert.equal(trace.filter((sql) => sql === 'SELECT * FROM coordination_claims WHERE id=$1').length, 1,
    'Recipe, world and every Family predicate share one authenticated claim union');
  assert.deepEqual(await state(), beforeRead, 'Projection does not accrue, create goals, mutate receipts or write readiness');
  assert.equal((await projection.snapshot(a, { operationId })).operations.selected.actions.find((action) => action.action === 'execute').canAttempt, false);
  await assert.rejects(projection.snapshot(outsider, { operationId }), { code: 'coordination_operation_unavailable' });
  const bInventory = (await projection.snapshot(b)).inventory, outsiderInventory = (await projection.snapshot(outsider)).inventory;
  const receipt = await command('organizer', 'execute'); assert.equal(receipt.status, 'completed');
  const done = await projection.snapshot(boss, { operationId });
  assert.equal(done.operations.selected.status, 'completed'); assert.equal(done.worldObjects[0].state, 'open');
  const publicView = await projection.snapshot(outsider);
  assert.equal(publicView.worldObjects[0].state, 'open'); assert.equal(publicView.knowledge.claims.length, 0);
  assert.deepEqual(publicView.inventory, outsiderInventory); assert.deepEqual((await projection.snapshot(b)).inventory, bInventory);
  assert(!JSON.stringify(publicView).includes(item.id)); assert(!JSON.stringify(publicView).includes(claimId));
  assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1', [item.id])).rows[0].state, 'consumed');
  const expiring = (await operations.create(boss, { definitionId: COORDINATION_OPERATION_PILOT[0].id }, key())).operationId;
  await pool.query('UPDATE world_operations SET expires_at=$2 WHERE id=$1', [expiring, new Date(Date.now() - 1000)]);
  const beforeExpiryRead = await state(), expired = await projection.snapshot(boss, { operationId: expiring });
  assert(expired.operations.selected.actions.find((action) => action.action === 'expire').canAttempt);
  assert.equal(expired.operations.selected.actions.find((action) => action.action === 'execute').canAttempt, false);
  assert.deepEqual(await state(), beforeExpiryRead, 'Expired projection never performs an implicit expiry mutation');

  // Public recipes cannot declassify hidden input or output definitions.
  const privateMaterial = 'mat:projection_secret_material', privateRecipe = 'recipe:projection_private_input';
  const privateOutput = 'recipe:projection_private_output';
  const privateRegistry = loadAndValidateGraphPackages([...PHASE1_WORLD_GRAPH_PACKAGES, {
    id: 'projection-private-entries', version: 1, season: 'core', dependsOn: ['core-materials'], nodes: [
      { id: privateMaterial, type: 'material', version: 1, visibility: 'hidden',
        metadata: { administratorSeeded: true, inventoryClass: 'stack', title: 'Unlisted material' } },
      { id: privateRecipe, type: 'recipe', version: 1, visibility: 'public', repeatability: 'repeatable',
        consumes: [{ templateId: privateMaterial, quantity: 1 }], produces: [{ templateId: 'mat:wire', quantity: 1 }] },
      { id: privateOutput, type: 'recipe', version: 1, visibility: 'public', repeatability: 'repeatable',
        consumes: [{ templateId: 'mat:wire', quantity: 2 }], produces: [{ templateId: privateMaterial, quantity: 1 }] },
    ],
  }]);
  const privateKnowledge = createCoordinationKnowledge({ enabled: true, sharingEnabled: true });
  const privateProjection = createWorldProjection({ pool,
    query: createWorldKernelQuery({ pool, registry: privateRegistry, knowledge: privateKnowledge }),
    kernel: createWorldKernel({ pool, registry: privateRegistry, objects: [], ...policy }), knowledge: privateKnowledge,
    crafting: createCraftingContext({ registry: privateRegistry, ...policy }), recipeIds: [privateRecipe, privateOutput] });
  const privateView = await privateProjection.snapshot(outsider);
  assert.deepEqual(privateView.recipes, []);
  for (const hidden of [privateMaterial, privateRecipe, privateOutput]) assert(!JSON.stringify(privateView).includes(hidden),
    'Unowned hidden crafting entries never enter aggregate cards');

  // Historical operation selection keeps its recovery authority, while current
  // Family membership independently determines the catalog and other instances.
  const historicalId = (await operations.create(boss, { definitionId: COORDINATION_OPERATION_PILOT[0].id }, key())).operationId;
  await operations.command(boss, historicalId, 'publish', {}, key());
  await operations.command(b, historicalId, 'join', { roleId: 'researcher' }, key());
  const information = COORDINATION_OPERATION_PILOT[0].roles.find((role) => role.id === 'researcher').requirements[0];
  await operations.command(b, historicalId, 'commit', { requirementId: information.id }, key());
  await social(b, (ch, client, h) => leaveCrew(ch, client, h), CREW_FIRST_CHARACTER_LOCKS);
  await social(b, (ch, client, h) => leaveGang(ch, client, h));
  await social(b, (ch, client, h) => createCrew(ch, 'New Projection Crew', client, h));
  const newFamily = await social(b, (ch, client, h) => createGang(ch, 'New Projection Family', 'NEWP', client, h));
  await social(outsider, (ch, client, h) => joinGang(ch, newFamily.gangId, client, h));
  await social(outsider, (ch, client, h) => createCrew(ch, 'New Officer Crew', client, h));
  await social(b, (ch, client, h) => promoteMember(ch, chId(outsider), 'underboss', client, h));
  const currentId = (await operations.create(outsider, { definitionId: COORDINATION_OPERATION_PILOT[0].id }, key())).operationId;
  const current = await projection.snapshot(b), historical = await projection.snapshot(b, { operationId: historicalId });
  assert.equal(historical.family.id, newFamily.gangId);
  assert.deepEqual(historical.operations.catalog, current.operations.catalog);
  assert(historical.operations.catalog.every((entry) => entry.canCreate));
  assert.deepEqual(historical.operations.instances, current.operations.instances);
  assert(historical.operations.instances.some((entry) => entry.id === currentId), 'A new Family peer operation remains in the current board');
  assert(historical.operations.instances.some((entry) => entry.id === historicalId), 'Historical own participation remains readable');
  const old = historical.operations.selected;
  assert.equal(old.id, historicalId);
  for (const name of ['publish', 'approve', 'execute', 'cancel']) assert.equal(old.actions.find((action) => action.action === name).canAttempt, false);
  assert(old.actions.find((action) => action.action === 'leave').canAttempt, 'A former member can recover their own seat');
  assert(old.roles.every((role) => role.actions.every((action) => !action.canAttempt)));
  const oldRequirement = old.roles.find((role) => role.mine).requirements[0];
  for (const name of ['commit', 'contribute']) assert.equal(oldRequirement.actions.find((action) => action.action === name).canAttempt, false);
  assert(oldRequirement.actions.find((action) => action.action === 'withdraw').canAttempt, 'Own historical promises can be withdrawn');
  console.log(`world-projection: real discovery/Crew sharing/crafting/Family resolution, safe cards and one read-only snapshot passed (${postgres ? 'PostgreSQL' : 'pg-mem'})`);
} finally { await cleanup(); }
