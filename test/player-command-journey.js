// Two persistent player journeys. Only initial characters and garage randomness
// are fixtures; every learned claim, crafted item, role and consequence uses its
// production domain service, with playable actions issued by the Command Engine.
import assert from 'node:assert/strict';
import { travel, withCharacter } from '../src/game.js';
import { boostCar } from '../src/economy.js';
import { createCrew, inviteToCrew, acceptInvite, leaveCrew, CREW_FIRST_CHARACTER_LOCKS } from '../src/crew.js';
import { createGang, joinGang } from '../src/social.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { createFurnaceLedger, FURNACE_IDS as ids } from '../src/content/furnace-ledger.js';
import { commandDatabase, addPlayer, engineFor, findCommand, executeIssued, issueAndExecute } from './lib/player-command-support.js';

for (const branch of ['preserve', 'expose']) {
  const database = await commandDatabase(branch); let pool = database.pool;
  const content = createFurnaceLedger();
  const accounts = Object.fromEntries(['organizer', 'locksmith', 'supplier', 'researcher', 'outsider']
    .map((role) => [role, `${branch}-${role}`]));
  const names = Object.fromEntries(Object.keys(accounts).map((role) => [role, `${branch} ${role}`]));
  let engine, knowledge, kernel;
  function services() {
    engine = engineFor(pool, content);
    knowledge = createCoordinationService({ pool, registry: content.coordinationRegistry,
      enabled: true, knowledgeEnabled: true, sharingEnabled: true, prerequisitesEnabled: true });
    kernel = createWorldKernel({ pool, registry: content.registry, objects: content.objects,
      enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  }
  const social = (account, work, hooks) => withCharacter(pool, account, work, hooks);
  const move = (account, destination) => social(account, (ch, client, helpers) => travel(ch, destination, client, helpers));
  const act = (account, type, parameters = {}, options = {}) => issueAndExecute(engine, account, type, parameters, options);
  const start = (account, graphId) => act(account, 'mystery.start', { graphId });
  const mystery = (account, graphId, kind, optionId) => act(account, `mystery.${kind}`,
    { graphId, ...(optionId ? { optionId } : {}) }, { mysteryGraphId: graphId });
  const graph = coordinationGraphs(content.coordinationRegistry)[0], runs = new Map();
  async function learnAvailable(account) {
    if (!runs.has(account)) {
      const { response } = await act(account, 'discovery.start', { graphId: graph.id });
      assert(response.result.instanceId, 'discovery result identifies the created authorized run');
      runs.set(account, response.result.instanceId);
    }
    for (let step = 0; step < 16; step++) {
      const run = await knowledge.get(account, runs.get(account));
      const action = run.actions.find((entry) => entry.kind === 'complete') || run.actions.find((entry) => entry.kind === 'discover');
      if (!action) return run;
      if (action.kind === 'discover') assert(!Object.hasOwn(action, 'nodeId'), 'undiscovered source identity remains opaque');
      await act(account, 'discovery.act', { instanceId: run.id, actionId: action.id });
    }
    throw Error('Knowledge command bound exceeded');
  }
  async function claim(account, proposition) {
    const entry = (await knowledge.knowledgeBoard(account)).claims.find((value) => value.owned && value.proposition === proposition);
    assert(entry, `Missing authentic owned claim ${proposition}`); return entry;
  }
  async function share(account, source, recipient) {
    return act(account, 'knowledge.share', { claimId: source.id, kind: recipient ? 'family' : 'crew' });
  }
  async function acquireMaterials(account) {
    await move(account, 'foundry');
    const random = Math.random; let acquired;
    try { Math.random = () => 0.01; acquired = await social(account, (ch, client, helpers) => boostCar(ch, client, helpers)); }
    finally { Math.random = random; }
    assert.equal(acquired.car?.model, 'junker');
    const { response } = await act(account, 'item.salvage', { carId: acquired.car.id });
    assert.equal((await pool.query('SELECT id FROM cars WHERE id=$1', [acquired.car.id])).rows.length, 0);
    assert(response.projection.inventory.resources.some((entry) => entry.templateId === 'mat:scrap_steel' && entry.quantity >= 2));
  }
  try {
    services();
    for (const [role, account] of Object.entries(accounts)) await addPlayer(pool, account, names[role]);
    const firstCrew = await social(accounts.organizer, (ch, client, h) => createCrew(ch, 'Carbon Custodians', client, h));
    const secondCrew = await social(accounts.supplier, (ch, client, h) => createCrew(ch, 'Independent Witnesses', client, h));
    const family = await social(accounts.organizer, (ch, client, h) => createGang(ch, 'Carbon Family', 'CARB', client, h));
    for (const [leader, member, crew] of [['organizer', 'locksmith', firstCrew], ['supplier', 'researcher', secondCrew]]) {
      await social(accounts[leader], (ch, client, h) => inviteToCrew(ch, names[member], client, h), CREW_FIRST_CHARACTER_LOCKS);
      await social(accounts[member], (ch, client, h) => acceptInvite(ch, crew.id, client, h));
    }
    for (const role of ['locksmith', 'supplier', 'researcher']) await social(accounts[role], (ch, client, h) => joinGang(ch, family.gangId, client, h));
    const login = await engine.snapshot(accounts.organizer);
    assert.equal(login.commandSchemaVersion, 1);
    assert.equal(login.player.id, accounts.organizer);
    assert.equal(login.crew.id, firstCrew.id); assert.equal(login.family.id, family.gangId);
    assert(!JSON.stringify(login).includes(ids.impression), 'unknown lead prerequisites stay secret');
    assert(!JSON.stringify(login).includes(ids.key), 'undiscovered recipe output stays secret');
    assert(!login.commands.some((command) => command.commandType === 'operation.create'));
    assert(login.opportunities.length > 0);

    for (const role of ['organizer', 'locksmith', 'researcher']) {
      await start(accounts[role], ids.inspection);
      await mystery(accounts[role], ids.inspection, 'complete');
    }
    await learnAvailable(accounts.organizer); await learnAvailable(accounts.locksmith);
    const first = await claim(accounts.locksmith, 'seized-steel.redirected');
    const informed = await engine.snapshot(accounts.locksmith);
    assert(informed.opportunities.some((entry) => entry.kind === 'crafting' && entry.subject.id === ids.recipe),
      'learning the genuine source creates a formerly secret crafting opportunity');
    await share(accounts.locksmith, first);
    const sharedFamily = await share(accounts.locksmith, first, 'researcher');
    for (const role of ['locksmith', 'researcher', 'supplier']) await acquireMaterials(accounts[role]);

    const researcherView = await engine.snapshot(accounts.researcher);
    const revokedCraft = findCommand(researcherView, 'recipe.craft', { recipeId: ids.recipe });
    const readable = (await knowledge.knowledgeGet(accounts.locksmith, first.id)).claim;
    const grant = readable.grants.find((entry) => entry.kind === 'family'); assert(grant);
    await act(accounts.locksmith, 'knowledge.revoke', { claimId: first.id, grantId: grant.id });
    await assert.rejects(() => executeIssued(engine, accounts.researcher, revokedCraft), { code: 'command_stale' });
    const revokedView = await engine.snapshot(accounts.researcher);
    assert(!revokedView.commands.some((command) => command.commandType === 'recipe.craft' && command.availability === 'AVAILABLE'));
    assert.equal((await executeIssued(engine, accounts.locksmith, sharedFamily.command)).replayed, true);
    assert(!(await engine.snapshot(accounts.researcher)).knowledge.claims.some((entry) => entry.id === first.id),
      'replaying an old share receipt never restores a subsequently revoked grant');
    await share(accounts.locksmith, first, 'researcher');
    const beforeCraft = await engine.snapshot(accounts.locksmith);
    const crafted = await act(accounts.locksmith, 'recipe.craft', { recipeId: ids.recipe });
    const replayed = await executeIssued(engine, accounts.locksmith, crafted.command);
    assert.equal(replayed.replayed, true); assert.deepEqual(replayed.result, crafted.response.result);
    const newItems = crafted.response.projection.inventory.items.filter((item) => !beforeCraft.inventory.items.some((before) => before.id === item.id));
    assert.equal(newItems.length, 1); const itemId = newItems[0].id;
    await act(accounts.researcher, 'recipe.craft', { recipeId: ids.recipe });
    await mystery(accounts.locksmith, ids.inspection, 'discover'); await mystery(accounts.locksmith, ids.inspection, 'complete');
    await learnAvailable(accounts.locksmith);
    assert(!(await knowledge.knowledgeBoard(accounts.locksmith)).claims.some((entry) => entry.proposition === 'duplicate-accounts.location'),
      'one original player cannot corroborate its own two sources');
    await mystery(accounts.researcher, ids.inspection, 'discover'); await mystery(accounts.researcher, ids.inspection, 'complete');
    await learnAvailable(accounts.researcher);
    const secondClaim = await claim(accounts.researcher, 'seized-steel.redirected');
    await share(accounts.researcher, secondClaim, 'organizer');
    await move(accounts.organizer, 'foundry'); await learnAvailable(accounts.organizer);
    await claim(accounts.organizer, 'duplicate-accounts.location');
    await start(accounts.organizer, ids.deduction);
    await mystery(accounts.organizer, ids.deduction, 'discover');
    const choiceView = await engine.snapshot(accounts.organizer, { mysteryGraphId: ids.deduction });
    const oppositeChoice = findCommand(choiceView, 'mystery.choice', { optionId: branch === 'preserve' ? 'expose' : 'preserve' });
    await mystery(accounts.organizer, ids.deduction, 'choice', branch);
    await assert.rejects(() => executeIssued(engine, accounts.organizer, oppositeChoice), { code: 'command_stale' });
    await mystery(accounts.organizer, ids.deduction, 'complete');
    const chosen = content.manifest.branches.find((entry) => entry.optionId === branch);
    const opposite = content.manifest.branches.find((entry) => entry.optionId !== branch);
    const unlocked = await engine.snapshot(accounts.organizer);
    findCommand(unlocked, 'operation.create', { definitionId: chosen.operationId });
    assert(!JSON.stringify(unlocked.commands).includes(opposite.operationId));
    await start(accounts.organizer, ids.epilogue);
    const created = await act(accounts.organizer, 'operation.create', { definitionId: chosen.operationId });
    const operationId = created.response.result.operationId; assert(operationId);
    const operation = (role, action, parameters = {}) => act(accounts[role], `operation.${action}`,
      { operationId, ...parameters }, { operationId });
    await operation('organizer', 'publish');
    const definition = content.operations.find((entry) => entry.id === chosen.operationId);
    for (const role of definition.roles) await operation(role.id, 'join', { roleId: role.id });
    for (const role of definition.roles) for (const requirement of role.requirements) {
      await operation(role.id, 'commit', { requirementId: requirement.id });
      if (requirement.id === 'another_crew') {
        const old = findCommand(await engine.snapshot(accounts[role.id], { operationId }), 'operation.contribute', { requirementId: requirement.id });
        const oldShare = findCommand(await engine.snapshot(accounts.researcher), 'knowledge.share', { claimId: secondClaim.id, kind: 'crew' });
        await social(accounts.researcher, (ch, client, h) => leaveCrew(ch, client, h));
        await social(accounts.organizer, (ch, client, h) => inviteToCrew(ch, names.researcher, client, h), CREW_FIRST_CHARACTER_LOCKS);
        await social(accounts.researcher, (ch, client, h) => acceptInvite(ch, firstCrew.id, client, h));
        await assert.rejects(() => executeIssued(engine, accounts[role.id], old), { code: 'command_stale' });
        await assert.rejects(() => executeIssued(engine, accounts.researcher, oldShare), { code: 'command_stale' });
        await social(accounts.researcher, (ch, client, h) => leaveCrew(ch, client, h));
        await social(accounts.supplier, (ch, client, h) => inviteToCrew(ch, names.researcher, client, h), CREW_FIRST_CHARACTER_LOCKS);
        await social(accounts.researcher, (ch, client, h) => acceptInvite(ch, secondCrew.id, client, h));
      }
      await operation(role.id, 'contribute', { requirementId: requirement.id, ...(requirement.kind === 'item' ? { itemId } : {}) });
    }
    await operation('organizer', 'approve');
    const ready = await engine.snapshot(accounts.organizer, { operationId });
    assert.equal(ready.operations.selected.readiness.ready, true);
    const finalCommand = findCommand(ready, 'operation.execute', { operationId });
    const originalExpiry = (await pool.query('SELECT expires_at FROM world_operations WHERE id=$1', [operationId])).rows[0].expires_at;
    await pool.query('UPDATE world_operations SET expires_at=$2 WHERE id=$1', [operationId, new Date(Date.now() - 1000)]);
    await assert.rejects(() => executeIssued(engine, accounts.organizer, finalCommand), { code: 'command_stale' });
    const expired = await engine.snapshot(accounts.organizer, { operationId });
    assert(!expired.commands.some((command) => command.commandType === 'operation.execute' && command.availability === 'AVAILABLE'));
    await pool.query('UPDATE world_operations SET expires_at=$2 WHERE id=$1', [operationId, originalExpiry]);
    const executed = await executeIssued(engine, accounts.organizer, finalCommand);
    assert.equal(executed.status, 'COMPLETED'); assert(executed.feedback);
    const retry = await executeIssued(engine, accounts.organizer, finalCommand);
    assert.equal(retry.replayed, true); assert.deepEqual(retry.result, executed.result);
    assert(!retry.projection.commands.some((command) => command.commandType === 'operation.execute' && command.availability === 'AVAILABLE'));
    assert.equal((await kernel.get(accounts.outsider, ids.object)).state, chosen.worldState);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM world_kernel_events WHERE object_id=$1', [ids.object])).rows[0].n, 1);
    await mystery(accounts.organizer, ids.epilogue, 'discover'); await mystery(accounts.organizer, ids.epilogue, 'complete');
    await start(accounts.outsider, ids.epilogue);
    const after = await engine.snapshot(accounts.organizer, { mysteryGraphId: ids.epilogue });
    const outsider = await engine.snapshot(accounts.outsider, { mysteryGraphId: ids.epilogue });
    assert.equal(after.cases.selected.status, 'completed');
    assert(!outsider.commands.some((command) => command.commandType === 'mystery.complete' || command.commandType === 'mystery.discover'),
      'public consequence does not forge outsider participation');
    assert(!JSON.stringify(outsider).includes('beneath-the-quench-floor'));
    assert(after.knowledge.claims.length > outsider.knowledge.claims.length);
    assert(after.opportunities.length > 0);
    await pool.end(); pool = database.reopen(); services();
    const restarted = await executeIssued(engine, accounts.organizer, finalCommand);
    assert.equal(restarted.replayed, true); assert.deepEqual(restarted.result, executed.result);
    const beforeSharingReplay = Number((await pool.query('SELECT count(*) AS n FROM coordination_claim_grants')).rows[0].n);
    assert.equal((await executeIssued(engine, accounts.locksmith, sharedFamily.command)).replayed, true);
    assert.equal(Number((await pool.query('SELECT count(*) AS n FROM coordination_claim_grants')).rows[0].n), beforeSharingReplay);
    assert.equal((await engine.snapshot(accounts.organizer, { mysteryGraphId: ids.epilogue })).cases.selected.status, 'completed');
    assert.deepEqual(await familyOperationInvariants(pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
    assert.deepEqual(await worldKernelInvariants(pool), { ok: true, issues: [] });
    console.log(`player-command-journey ${branch}: personalized lead, discovery, hidden prerequisites, salvage, craft, knowledge revocation, Crew changes, roles, commitments, persistent branch, feedback, differential views and restart PASS`);
  } finally { await database.cleanup(pool); }
}
