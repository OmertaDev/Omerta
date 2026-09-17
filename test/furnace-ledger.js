// Both authored branches through real domain services. Only initial characters
// are fixtures: cars are acquired by garage boost and all knowledge/items arise
// from their actual commands. Randomness is controlled only for that car roll.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { travel, withCharacter } from '../src/game.js';
import { boostCar } from '../src/economy.js';
import { createCrew, inviteToCrew, acceptInvite, leaveCrew, CREW_FIRST_CHARACTER_LOCKS } from '../src/crew.js';
import { createGang, joinGang } from '../src/social.js';
import { withItemTransaction } from '../src/items.js';
import { createCraftingContext, craftWorldGraphRecipe, salvageCar, recipeCatalogForPlayer } from '../src/crafting.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { createMysteryContext, startMystery, mysteryBoard, discoverNode, completeNode, commitChoice } from '../src/mysteries.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { createFurnaceLedger, FURNACE_IDS as ids } from '../src/content/furnace-ledger.js';

const postgres = process.argv.includes('--postgres');
const key = () => crypto.randomUUID();
async function database(branch) {
  if (postgres) {
    assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit isolated database URL required');
    const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
    assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
    const { Pool } = await import('pg'), base = new Pool({ connectionString: endpoint.toString() });
    const schema = `furnace_${branch}_${crypto.randomBytes(8).toString('hex')}`;
    await base.query(`CREATE SCHEMA ${schema}`);
    const reopen = () => new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${schema} -c lock_timeout=8000 -c statement_timeout=15000` });
    dbCaps.skipLocked = true;
    return { pool: reopen(), reopen, async cleanup(pool) { await pool.end(); await base.query(`DROP SCHEMA ${schema} CASCADE`); await base.end(); } };
  }
  const db = newDb({ noAstCoverageCheck: true }); registerPgMemCompatibility(db, DataType);
  const { Pool } = db.adapters.createPg(); dbCaps.skipLocked = false;
  return { pool: new Pool(), reopen: () => new Pool(), cleanup: (pool) => pool.end() };
}

for (const branch of ['preserve', 'expose']) {
  const db = await database(branch); let pool = db.pool;
  const content = createFurnaceLedger();
  const accounts = Object.fromEntries(['organizer', 'locksmith', 'supplier', 'researcher', 'outsider'].map((role) => [role, `${branch}-${role}`]));
  const names = Object.fromEntries(Object.keys(accounts).map((role) => [role, `${branch} ${role}`]));
  const character = (account) => `${account}-character`, owner = (account) => ({ scope: 'character', id: character(account) });
  const tx = (work) => withItemTransaction(pool, work);
  const social = (account, work, hooks) => withCharacter(pool, account, work, hooks);
  const move = (account, location) => social(account, (ch, client, helpers) => travel(ch, location, client, helpers));
  let kernel, family, knowledge, crafting;
  const services = () => {
    kernel = createWorldKernel({ pool, registry: content.registry, objects: content.objects, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
    family = createFamilyOperations({ pool, registry: content.registry, kernel, definitions: content.operations,
      enabled: true, knowledgeEnabled: true, sharingEnabled: true, prerequisitesEnabled: true });
    knowledge = createCoordinationService({ pool, registry: content.coordinationRegistry,
      enabled: true, knowledgeEnabled: true, sharingEnabled: true, prerequisitesEnabled: true });
    crafting = createCraftingContext({ registry: content.registry, knowledgeEnabled: true, sharingEnabled: true, worldDefinitions: kernel.definitions });
  };
  const context = (account) => createMysteryContext({ registry: content.registry, accountId: account,
    knowledgeEnabled: true, sharingEnabled: true, operationOutcomesEnabled: true, prerequisitesEnabled: true, worldDefinitions: kernel.definitions });
  const start = (account, graph) => tx((client) => startMystery(client, context(account), owner(account), graph, 1));
  const board = (account, graph) => mysteryBoard(pool, context(account), owner(account), graph);
  async function mysteryAction(account, graph, wantedKind, optionId) {
    const view = await board(account, graph);
    const action = view.actions?.find((entry) => entry.kind === wantedKind && (optionId === undefined || entry.optionId === optionId));
    assert(action, `${branch}: the server must expose an authorized ${wantedKind} action`);
    const options = { idempotencyKey: key(), ...(action.interactionId ? { interactionId: action.interactionId } : {}) };
    return tx((client) => action.kind === 'choice'
      ? commitChoice(client, context(account), owner(account), graph, action.nodeId, action.optionId, options)
      : (action.kind === 'discover' ? discoverNode : completeNode)(client, context(account), owner(account), graph, action.nodeId, options));
  }
  const graph = coordinationGraphs(content.coordinationRegistry)[0], runs = new Map();
  async function learnAvailable(account) {
    let run = runs.has(account) ? await knowledge.get(account, runs.get(account))
      : (await knowledge.create(account, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
    runs.set(account, run.id);
    for (let steps = 0; steps < 16; steps++) {
      const action = run.actions.find((entry) => entry.kind === 'complete') || run.actions.find((entry) => entry.kind === 'discover');
      if (!action) return run;
      if (action.kind === 'discover') assert(!Object.hasOwn(action, 'nodeId'), 'undiscovered source identities remain opaque');
      run = (await knowledge.act(account, run.id, { expectedRevision: run.revision, actionId: action.id }, key())).instance;
    }
    throw Error('knowledge action bound exceeded');
  }
  async function claim(account, proposition) {
    const claims = (await knowledge.knowledgeBoard(account)).claims;
    const entry = claims.find((value) => value.owned && value.proposition === proposition);
    assert(entry, `authentic owned claim ${proposition}`); return entry;
  }
  async function share(account, source, recipient = null) {
    const targets = (await knowledge.knowledgeTargets(account, recipient ? { characterName: names[recipient] } : {})).targets;
    const target = targets.find((entry) => entry.kind === (recipient ? 'account' : 'crew')); assert(target);
    const current = (await knowledge.knowledgeGet(account, source.id)).claim;
    return knowledge.shareKnowledge(account, source.id, { targetId: target.id, expectedAclRevision: current.aclRevision }, key());
  }
  async function acquireMaterials(account) {
    await move(account, 'foundry');
    const random = Math.random;
    let acquired;
    try { Math.random = () => 0.01; acquired = await social(account, (ch, client, helpers) => boostCar(ch, client, helpers)); }
    finally { Math.random = random; }
    assert.equal(acquired.car?.model, 'junker', 'bounded fixture roll uses the real garage acquisition path');
    const result = await tx((client) => salvageCar(client, { accountId: account }, acquired.car.id, 'recipe:car_salvage_basic', key()));
    assert(result);
    assert.equal((await pool.query('SELECT id FROM cars WHERE id=$1', [acquired.car.id])).rows.length, 0, 'salvage consumes the acquired car');
  }
  const craft = (account, requestKey = key()) => tx((client) => craftWorldGraphRecipe(client, { accountId: account }, ids.recipe, requestKey, crafting));
  const snapshot = async () => Object.fromEntries(await Promise.all(['characters', 'item_stacks', 'item_instances', 'item_events', 'item_mutation_guards',
    'world_operations', 'world_operation_events', 'world_operation_commitments', 'world_operation_contributions', 'world_operation_capital',
    'world_kernel_objects', 'world_kernel_events', 'world_recipe_usage', 'mystery_instances', 'mystery_node_state', 'mystery_choices'].map(async (table) =>
    [table, (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
  async function refuses(action, code) {
    const before = await snapshot(); await assert.rejects(action, { code });
    assert.deepEqual(await snapshot(), before, 'denial rolls back every affected domain and receipt');
  }
  try {
    await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')); services();
    for (const [role, account] of Object.entries(accounts)) {
      await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
      await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
      await pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash,muscle,cunning,speed) VALUES($1,$2,$3,1,'docks',10000,100000,50,50,50)",
        [character(account), account, names[role]]);
    }
    const firstCrew = await social(accounts.organizer, (ch, client, h) => createCrew(ch, 'Carbon Custodians', client, h));
    const secondCrew = await social(accounts.supplier, (ch, client, h) => createCrew(ch, 'Independent Witnesses', client, h));
    const made = await social(accounts.organizer, (ch, client, h) => createGang(ch, 'Carbon Family', 'CARB', client, h));
    for (const [leader, member, crew] of [['organizer', 'locksmith', firstCrew], ['supplier', 'researcher', secondCrew]]) {
      await social(accounts[leader], (ch, client, h) => inviteToCrew(ch, names[member], client, h), CREW_FIRST_CHARACTER_LOCKS);
      await social(accounts[member], (ch, client, h) => acceptInvite(ch, crew.id, client, h));
    }
    for (const role of ['locksmith', 'supplier', 'researcher']) await social(accounts[role], (ch, client, h) => joinGang(ch, made.gangId, client, h));
    assert.equal((await family.catalog(accounts.organizer)).definitions?.length ?? (await family.catalog(accounts.organizer)).operations?.length, 0,
      'Family catalog hides both branch blueprints before the deduction');
    await refuses(() => family.create(accounts.organizer, { definitionId: ids.preserveOperation }, key()), 'coordination_operation_unavailable');
    for (const role of ['organizer', 'locksmith', 'researcher']) {
      await start(accounts[role], ids.inspection);
      const before = await board(accounts[role], ids.inspection);
      assert(!JSON.stringify(before).includes(ids.impression), 'hidden crafted clue has no early reference');
      await mysteryAction(accounts[role], ids.inspection, 'complete');
    }
    await learnAvailable(accounts.organizer); await learnAvailable(accounts.locksmith);
    const first = await claim(accounts.locksmith, 'seized-steel.redirected');
    await share(accounts.locksmith, first); // The Crew grant is a deliberate command, never implicit visibility.
    await share(accounts.locksmith, first, 'researcher');
    const outsiderRecipes = await tx((client) => recipeCatalogForPlayer(client, accounts.outsider, crafting, [ids.recipe]));
    assert(!JSON.stringify(outsiderRecipes).includes(ids.key), 'secret recipe output stays private');
    for (const role of ['locksmith', 'researcher', 'supplier']) await acquireMaterials(accounts[role]);
    const readable = (await knowledge.knowledgeGet(accounts.locksmith, first.id)).claim;
    const grant = readable.grants.find((entry) => entry.kind === 'account' && entry.label === names.researcher); assert(grant);
    await knowledge.revokeKnowledge(accounts.locksmith, first.id, { grantId: grant.id, expectedAclRevision: readable.aclRevision }, key());
    await refuses(() => craft(accounts.researcher), 'recipe_unavailable');
    await share(accounts.locksmith, first, 'researcher');
    const craftKey = key(), crafted = await craft(accounts.locksmith, craftKey);
    assert.deepEqual(await craft(accounts.locksmith, craftKey), crafted, 'craft retries preserve one exact item');
    const itemId = crafted.outputs[0].id;
    await craft(accounts.researcher);
    await mysteryAction(accounts.locksmith, ids.inspection, 'discover'); await mysteryAction(accounts.locksmith, ids.inspection, 'complete');
    await learnAvailable(accounts.locksmith);
    assert(!(await knowledge.knowledgeBoard(accounts.locksmith)).claims.some((entry) => entry.proposition === 'duplicate-accounts.location'),
      'one original account collecting both source roots cannot corroborate itself');
    await mysteryAction(accounts.researcher, ids.inspection, 'discover'); await mysteryAction(accounts.researcher, ids.inspection, 'complete');
    await learnAvailable(accounts.researcher);
    const second = await claim(accounts.researcher, 'seized-steel.redirected');
    await share(accounts.researcher, second, 'organizer');
    await move(accounts.organizer, 'foundry'); await learnAvailable(accounts.organizer);
    const corroborated = await claim(accounts.organizer, 'duplicate-accounts.location');
    assert((await knowledge.knowledgeBoard(accounts.researcher)).claims.some((entry) => entry.proposition === 'duplicate-accounts.location'));
    await start(accounts.organizer, ids.deduction);
    await mysteryAction(accounts.organizer, ids.deduction, 'discover');
    await mysteryAction(accounts.organizer, ids.deduction, 'choice', branch);
    await refuses(() => tx((client) => commitChoice(client, context(accounts.organizer), owner(accounts.organizer), ids.deduction, ids.choice,
      branch === 'preserve' ? 'expose' : 'preserve', { idempotencyKey: key() })), 'choice_committed');
    await mysteryAction(accounts.organizer, ids.deduction, 'complete');
    const chosen = content.manifest.branches.find((entry) => entry.optionId === branch);
    const opposite = content.manifest.branches.find((entry) => entry.optionId !== branch);
    const deductionBoard = await board(accounts.organizer, ids.deduction);
    assert(!deductionBoard.actions.some((action) => action.nodeId === opposite.nodeId), 'irreversible choice removes the other branch controls');
    const catalog = await family.catalog(accounts.organizer);
    assert(JSON.stringify(catalog).includes(chosen.operationId)); assert(!JSON.stringify(catalog).includes(opposite.operationId));
    await refuses(() => family.create(accounts.organizer, { definitionId: opposite.operationId }, key()), 'coordination_operation_unavailable');
    await refuses(() => kernel.execute(accounts.organizer, { objectId: ids.object, actionId: `${branch}_archive`, itemId, expectedRevision: 0 }, key()), 'world_unavailable');
    await start(accounts.organizer, ids.epilogue);
    assert.equal((await board(accounts.organizer, ids.epilogue)).actions.length, 0, 'epilogue waits for authenticated operation and durable world state');
    const created = await family.create(accounts.organizer, { definitionId: chosen.operationId }, key());
    const command = (role, action, input = {}, commandKey = key()) => family.command(accounts[role], created.operationId, action, input, commandKey);
    await command('organizer', 'publish');
    const definition = content.operations.find((operation) => operation.id === chosen.operationId);
    for (const role of definition.roles) await command(role.id, 'join', { roleId: role.id });
    for (const role of definition.roles) for (const requirement of role.requirements) {
      await command(role.id, 'commit', { requirementId: requirement.id });
      if (requirement.id === 'another_crew') {
        await social(accounts.researcher, (ch, client, h) => leaveCrew(ch, client, h));
        await social(accounts.organizer, (ch, client, h) => inviteToCrew(ch, names.researcher, client, h), CREW_FIRST_CHARACTER_LOCKS);
        await social(accounts.researcher, (ch, client, h) => acceptInvite(ch, firstCrew.id, client, h));
        await refuses(() => command(role.id, 'contribute', { requirementId: requirement.id }), 'coordination_operation_requirements');
        await social(accounts.researcher, (ch, client, h) => leaveCrew(ch, client, h));
        await social(accounts.supplier, (ch, client, h) => inviteToCrew(ch, names.researcher, client, h), CREW_FIRST_CHARACTER_LOCKS);
        await social(accounts.researcher, (ch, client, h) => acceptInvite(ch, secondCrew.id, client, h));
      }
      await command(role.id, 'contribute', { requirementId: requirement.id, ...(requirement.kind === 'item' ? { itemId } : {}) });
    }
    await command('organizer', 'approve');
    assert.equal((await family.get(accounts.organizer, created.operationId)).readiness.ready, true);
    const executeKey = key(), result = await command('organizer', 'execute', {}, executeKey);
    assert.equal(result.status, 'completed');
    assert.deepEqual(await command('organizer', 'execute', {}, executeKey), result, 'operation retry returns exact committed receipt');
    assert.equal((await kernel.get(accounts.outsider, ids.object)).state, chosen.worldState, 'terminal world consequence becomes public');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM world_kernel_events WHERE object_id=$1', [ids.object])).rows[0].n, 1);
    await mysteryAction(accounts.organizer, ids.epilogue, 'discover'); await mysteryAction(accounts.organizer, ids.epilogue, 'complete');
    await start(accounts.outsider, ids.epilogue);
    assert.equal((await board(accounts.outsider, ids.epilogue)).actions.length, 0, 'public world state cannot forge participant history');
    const beforeRestart = await snapshot(); await pool.end(); pool = db.reopen(); services();
    assert.deepEqual(await snapshot(), beforeRestart);
    assert.deepEqual(await family.command(accounts.organizer, created.operationId, 'execute', {}, executeKey), result);
    assert.equal((await kernel.get(accounts.outsider, ids.object)).state, chosen.worldState);
    assert.equal((await board(accounts.organizer, ids.epilogue)).status, 'completed');
    assert.deepEqual(await familyOperationInvariants(pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
    assert.deepEqual(await worldKernelInvariants(pool), { ok: true, issues: [] });
    assert(corroborated.contentHash, 'epilogue does not replace the original learned claim');
    console.log(`furnace-ledger ${branch}: acquisition, hidden craft/clue, distinct original sources, Crew sharing, different-Crew Family roles, irreversible choice, collective consequence, replay/restart and outsider boundaries PASS`);
  } finally { await db.cleanup(pool); }
}
