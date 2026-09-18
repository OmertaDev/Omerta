// Real-service fixtures: only initial accounts/characters are seeded. Knowledge,
// cars, salvage, crafted equipment, memberships and world outcomes use domains.
import assert from 'node:assert/strict';
import { commandDatabase, addPlayer, characterId, key } from './player-command-support.js';
import { withCharacter, travel } from '../../src/game.js';
import { boostCar } from '../../src/economy.js';
import { createCrew, inviteToCrew, acceptInvite, CREW_FIRST_CHARACTER_LOCKS } from '../../src/crew.js';
import { createGang, joinGang } from '../../src/social.js';
import { withItemTransaction } from '../../src/items.js';
import { createCraftingContext, craftWorldGraphRecipe, salvageCar } from '../../src/crafting.js';
import { createCoordinationService } from '../../src/coordination/runtime.js';
import { coordinationGraphs } from '../../src/coordination/graph.js';
import { createWorldKernel } from '../../src/world-kernel.js';
import { createFamilyOperations } from '../../src/coordination/operations.js';
import { createMysteryContext, startMystery, mysteryBoard, discoverNode, completeNode } from '../../src/mysteries.js';
import { createDockWarContent, DOCK_WAR_IDS as ids } from '../../src/content/dock-war.js';

export { key, characterId, ids };
export async function dockFixture(tag = 'dock') {
  const db = await commandDatabase(tag), pool = db.pool, content = createDockWarContent();
  const actors = Object.fromEntries(['aBoss', 'aRunner', 'bBoss', 'bRunner', 'outsider'].map((role) => [role, `${tag}-${role}`]));
  const names = Object.fromEntries(Object.keys(actors).map((role) => [role, `${tag} ${role}`]));
  const social = (account, work, hooks) => withCharacter(pool, account, work, hooks);
  const tx = (work) => withItemTransaction(pool, work);
  const move = (account, location) => social(account, (ch, client, h) => ch.loc === location
    ? { location } : travel(ch, location, client, h));
  const kernel = createWorldKernel({ pool, registry: content.registry, objects: content.objects,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const family = createFamilyOperations({ pool, registry: content.registry, kernel, definitions: content.operations,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true, prerequisitesEnabled: true });
  const knowledge = createCoordinationService({ pool, registry: content.coordinationRegistry,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true, prerequisitesEnabled: true });
  const crafting = createCraftingContext({ registry: content.registry, knowledgeEnabled: true,
    sharingEnabled: true, worldDefinitions: kernel.definitions });
  const context = (account) => createMysteryContext({ registry: content.registry, accountId: account,
    knowledgeEnabled: true, sharingEnabled: true, operationOutcomesEnabled: true, prerequisitesEnabled: true,
    worldDefinitions: kernel.definitions });
  const owner = (account) => ({ scope: 'character', id: characterId(account) });
  const graph = coordinationGraphs(content.coordinationRegistry)[0], runs = new Map(), salvaged = new Set();
  const crews = {}, families = {};
  for (const [role, account] of Object.entries(actors)) await addPlayer(pool, account, names[role]);
  for (const prefix of ['a', 'b']) {
    const boss = actors[`${prefix}Boss`], runner = actors[`${prefix}Runner`];
    crews[prefix] = await social(boss, (ch, client, h) => createCrew(ch, `Dock ${prefix} Crew`, client, h));
    families[prefix] = await social(boss, (ch, client, h) => createGang(ch, `Dock ${prefix} Family`, `${prefix.toUpperCase()}DCK`, client, h));
    await social(boss, (ch, client, h) => inviteToCrew(ch, names[`${prefix}Runner`], client, h), CREW_FIRST_CHARACTER_LOCKS);
    await social(runner, (ch, client, h) => acceptInvite(ch, crews[prefix].id, client, h));
    await social(runner, (ch, client, h) => joinGang(ch, families[prefix].gangId, client, h));
  }
  async function learn(account) {
    let run = runs.has(account) ? await knowledge.get(account, runs.get(account))
      : (await knowledge.create(account, graph.id, { expectedContentHash: graph.contentHash }, key())).instance;
    runs.set(account, run.id);
    for (let count = 0; count < 24; count++) {
      const action = run.actions.find((entry) => entry.kind === 'complete') || run.actions.find((entry) => entry.kind === 'discover');
      if (!action) return run;
      run = (await knowledge.act(account, run.id, { expectedRevision: run.revision, actionId: action.id }, key())).instance;
    }
    throw Error('Dock discovery exceeded its authored bound');
  }
  async function share(account, proposition, kind = 'crew', sourceRoot = null) {
    const claims = (await knowledge.knowledgeBoard(account)).claims;
    const claim = claims.find((entry) => entry.owned && entry.proposition === proposition
      && (!sourceRoot || entry.source.root === sourceRoot)); assert(claim, proposition);
    const current = (await knowledge.knowledgeGet(account, claim.id)).claim;
    const target = (await knowledge.knowledgeTargets(account)).targets.find((entry) => entry.kind === kind); assert(target);
    await knowledge.shareKnowledge(account, claim.id, { targetId: target.id, expectedAclRevision: current.aclRevision }, key());
    return claim.id;
  }
  async function acquireMaterials(account) {
    if (salvaged.has(account)) return;
    await move(account, 'foundry');
    const random = Math.random;
    let acquired;
    try { Math.random = () => 0.01; acquired = await social(account, (ch, client, h) => boostCar(ch, client, h)); }
    finally { Math.random = random; }
    assert.equal(acquired.car?.model, 'junker');
    await tx((client) => salvageCar(client, { accountId: account }, acquired.car.id, 'recipe:car_salvage_basic', key()));
    salvaged.add(account);
  }
  async function craft(account, craftKey = key()) {
    await move(account, 'foundry');
    const result = await tx((client) => craftWorldGraphRecipe(client, { accountId: account }, ids.recipe, craftKey, crafting));
    return result.outputs[0].id;
  }
  async function mysteryAction(account, kind) {
    const board = await mysteryBoard(pool, context(account), owner(account), ids.evidence);
    const action = board.actions.find((entry) => entry.kind === kind); assert(action, `${account}: ${kind}`);
    return tx((client) => (kind === 'discover' ? discoverNode : completeNode)(client, context(account), owner(account),
      ids.evidence, action.nodeId, { idempotencyKey: key(), ...(action.interactionId ? { interactionId: action.interactionId } : {}) }));
  }
  async function establish() {
    const account = actors.aBoss;
    await learn(account); await acquireMaterials(account);
    const itemId = await craft(account); await move(account, 'docks');
    const request = { objectId: ids.object, actionId: 'establish_route', itemId, expectedRevision: 0 }, executionKey = key();
    const receipt = await kernel.execute(account, request, executionKey);
    assert.deepEqual(await kernel.execute(account, request, executionKey), receipt);
    return receipt;
  }
  async function alternateEvidence(prefix = 'a') {
    const boss = actors[`${prefix}Boss`], runner = actors[`${prefix}Runner`];
    for (const account of [boss, runner]) {
      await move(account, 'docks'); await learn(account);
      await tx((client) => startMystery(client, context(account), owner(account), ids.evidence, 1));
      await mysteryAction(account, 'complete'); await learn(account);
    }
    await acquireMaterials(runner); const itemId = await craft(runner);
    await mysteryAction(runner, 'discover'); await mysteryAction(runner, 'complete'); await learn(runner);
    assert(!(await knowledge.knowledgeBoard(runner)).claims.some((entry) => entry.proposition === 'route.alternate'),
      'one original investigator cannot authenticate both independent evidence roots');
    await share(runner, 'canal.crossing', 'crew', 'foundry.survey-plate'); await learn(boss);
    await share(boss, 'route.alternate');
    await move(runner, 'docks');
    return itemId;
  }
  async function prepare(operationId, prefix = 'a', preparedItem = null) {
    const boss = actors[`${prefix}Boss`], runner = actors[`${prefix}Runner`];
    await move(boss, 'docks'); await learn(boss); await move(runner, 'docks'); await learn(runner);
    let itemId = preparedItem;
    if (!itemId) { await acquireMaterials(runner); itemId = await craft(runner); }
    await move(runner, 'docks');
    const created = await family.create(boss, { definitionId: operationId }, key());
    const operation = content.operations.find((entry) => entry.id === operationId);
    const people = { organizer: boss, runner };
    const command = (role, action, input = {}, commandKey = key()) => family.command(people[role], created.operationId, action, input, commandKey);
    await command('organizer', 'publish');
    for (const role of operation.roles) await command(role.id, 'join', { roleId: role.id });
    for (const role of operation.roles) for (const requirement of role.requirements) {
      await command(role.id, 'commit', { requirementId: requirement.id });
      await command(role.id, 'contribute', { requirementId: requirement.id, ...(requirement.kind === 'item' ? { itemId } : {}) });
    }
    await command('organizer', 'approve');
    assert.equal((await family.get(boss, created.operationId)).readiness.ready, true);
    return { ...created, command, itemId, boss, runner };
  }
  return { db, pool, content, actors, names, families, crews, kernel, family, knowledge, crafting, context, owner,
    tx, social, move, learn, share, acquireMaterials, craft, establish, alternateEvidence, prepare,
    cleanup: () => db.cleanup(pool) };
}
