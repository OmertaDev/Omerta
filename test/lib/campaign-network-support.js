// Canonical journey fixtures: social formation, acquisition, salvage, discovery,
// crafting and operations call their existing authorities. No stock is seeded.
import assert from 'node:assert/strict';
import { dockFixture, key } from './director-support.js';
import { issueAndExecute } from './player-command-support.js';
import { createCampaignNetworkContent, CAMPAIGN_NETWORK_IDS } from '../../src/content/campaign-network.js';
import { coordinationGraphs } from '../../src/coordination/graph.js';
import { boostCar } from '../../src/economy.js';
import { craftWorldGraphRecipe, salvageCar } from '../../src/crafting.js';
import { startMystery, mysteryBoard, discoverNode, completeNode } from '../../src/mysteries.js';

export async function campaignNetworkFixture(tag = 'network') {
  const f = await dockFixture(tag, createCampaignNetworkContent()), id = CAMPAIGN_NETWORK_IDS;
  const runs = new Map();
  let at = Date.now();
  const advance = (seconds = 601) => { at += seconds * 1000; return at; };
  async function learn(account, graphId = id.routeGraph, engine = null) {
    const graph = coordinationGraphs(f.content.coordinationRegistry).find((entry) => entry.id === graphId);
    const runKey = `${account}/${graphId}`;
    let run;
    if (engine) {
      let board = await engine.snapshot(account);
      run = board.discovery.instances.find((entry) => entry.graphId === graphId && !entry.historical);
      if (!run) {
        await issueAndExecute(engine, account, 'discovery.start', { graphId });
        board = await engine.snapshot(account); run = board.discovery.instances.find((entry) => entry.graphId === graphId && !entry.historical);
      }
    } else {
      run = runs.has(runKey) ? await f.knowledge.get(account, runs.get(runKey))
        : (await f.knowledge.create(account, graphId, { expectedContentHash: graph.contentHash }, key())).instance;
      runs.set(runKey, run.id);
    }
    for (let count = 0; count < 32; count++) {
      const action = run.actions.find((entry) => entry.kind === 'complete') || run.actions.find((entry) => entry.kind === 'discover');
      if (!action) return run;
      if (engine) {
        await issueAndExecute(engine, account, 'discovery.act', { instanceId: run.id, actionId: action.id });
        run = (await engine.snapshot(account)).discovery.instances.find((entry) => entry.id === run.id);
      } else run = (await f.knowledge.act(account, run.id, { expectedRevision: run.revision, actionId: action.id }, key())).instance;
    }
    throw Error('Campaign evidence exceeded its authored bound');
  }
  async function supplies(account, minimumWire = 1) {
    await f.move(account, 'foundry');
    for (let attempt = 0; attempt < 8; attempt++) {
      const rows = (await f.pool.query("SELECT template_id,quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1 AND quality='standard'", [account])).rows;
      const stock = (templateId) => Number(rows.find((row) => row.template_id === templateId)?.quantity || 0);
      if (stock('mat:wire') >= minimumWire && stock('mat:scrap_steel') >= 2 && stock('mat:salvage_parts') >= 1) return;
      const random = Math.random, now = Date.now;
      let acquisition;
      try {
        advance(3600); Math.random = () => 0.01; Date.now = () => at;
        acquisition = await f.social(account, (ch, client, hooks) => boostCar(ch, client, hooks));
      } finally { Math.random = random; Date.now = now; }
      assert.equal(acquisition.car?.model, 'junker');
      await f.tx((client) => salvageCar(client, { accountId: account }, acquisition.car.id, 'recipe:car_salvage_basic', key()));
    }
    throw Error('Canonical salvage could not fund the authored response');
  }
  async function craft(account, minimumWire = 1, engine = null) {
    await supplies(account, minimumWire);
    if (engine) {
      const { response } = await issueAndExecute(engine, account, 'recipe.craft', { recipeId: id.recipe });
      const output = response.feedback.inventoryChanges.find((entry) => entry.templateId === id.seal); assert(output);
      return output.id;
    }
    const output = await f.tx((client) => craftWorldGraphRecipe(client, { accountId: account }, id.recipe, key(), f.crafting));
    return output.outputs[0].id;
  }
  async function prepare(actionId, { prefix = 'a', engine = null, situationAction = null, preparedItem = null, existingOperationId = null } = {}) {
    const boss = f.actors[`${prefix}Boss`], runner = f.actors[`${prefix}Runner`];
    const definition = f.content.operations.find((entry) => entry.id === `operation:canal_${actionId}`); assert(definition, actionId);
    for (const account of [boss, runner]) { await f.move(account, 'docks'); await learn(account, id.routeGraph, engine); }
    if (['register_shipment', 'recover_shipment', 'intercept_shipment', 'destroy_shipment', 'redistribute_shipment'].includes(actionId)) await f.learn(boss);
    const wire = definition.roles.flatMap((role) => role.requirements).find((entry) => entry.kind === 'resource').quantity;
    const itemId = preparedItem || await craft(runner, wire, engine);
    await f.move(runner, 'docks');
    let operationId = existingOperationId;
    if (operationId) assert(!engine, 'A previously created fixture operation uses its existing domain commands');
    else if (engine) {
      const issued = await issueAndExecute(engine, boss, situationAction ? 'situation.act' : 'operation.create',
        situationAction ? { actionId: situationAction } : { definitionId: definition.id });
      operationId = issued.response.result.operationId;
    } else operationId = (await f.family.create(boss, { definitionId: definition.id }, key())).operationId;
    const people = { organizer: boss, runner };
    const command = (role, action, input = {}, commandKey = key()) => engine
      ? issueAndExecute(engine, people[role], `operation.${action}`, { operationId, ...input }, { operationId })
      : f.family.command(people[role], operationId, action, input, commandKey);
    await command('organizer', 'publish');
    for (const role of definition.roles) await command(role.id, 'join', { roleId: role.id });
    for (const role of definition.roles) for (const requirement of role.requirements) {
      await command(role.id, 'commit', { requirementId: requirement.id });
      await command(role.id, 'contribute', { requirementId: requirement.id, ...(!engine && requirement.kind === 'item' ? { itemId } : {}) });
    }
    await command('organizer', 'approve');
    assert.equal((await f.family.get(boss, operationId)).readiness.ready, true);
    return { operationId, command, boss, runner, itemId, definition };
  }
  async function establish() {
    await f.establish();
    const registered = await prepare('register_shipment');
    await registered.command('organizer', 'execute');
    return registered;
  }
  async function mystery(account, graphId, kind, engine = null) {
    if (engine) return issueAndExecute(engine, account, `mystery.${kind}`, { graphId }, { mysteryGraphId: graphId });
    if (kind === 'start') return f.tx((client) => startMystery(client, f.context(account), f.owner(account), graphId, 1));
    const board = await mysteryBoard(f.pool, f.context(account), f.owner(account), graphId);
    const action = board.actions.find((entry) => entry.kind === kind); assert(action, `${graphId}: ${kind}`);
    return f.tx((client) => (kind === 'discover' ? discoverNode : completeNode)(client, f.context(account), f.owner(account), graphId,
      action.nodeId, { idempotencyKey: key(), ...(action.interactionId ? { interactionId: action.interactionId } : {}) }));
  }
  async function publicTrail(prefix = 'a', engine = null) {
    const boss = f.actors[`${prefix}Boss`], runner = f.actors[`${prefix}Runner`];
    for (const account of [boss, runner]) {
      await f.move(account, 'docks'); await learn(account, id.routeGraph, engine);
      await mystery(account, id.informantEvidence, 'start', engine);
      await mystery(account, id.informantEvidence, 'complete', engine);
      await learn(account, id.intelligenceGraph, engine);
    }
    const itemId = await craft(runner, 1, engine);
    await mystery(runner, id.informantEvidence, 'discover', engine); await mystery(runner, id.informantEvidence, 'complete', engine);
    await learn(runner, id.intelligenceGraph, engine);
    assert(!(await f.knowledge.knowledgeBoard(runner)).claims.some((entry) => entry.proposition === 'disclosure.corroborated'),
      'One player reading both sources is not independent corroboration');
    await f.share(runner, 'disclosure.source', 'crew', 'foundry.printer-copy');
    await learn(boss, id.intelligenceGraph, engine);
    await f.share(boss, 'disclosure.corroborated');
    await f.move(runner, 'docks');
    return itemId;
  }
  return { ...f, ids: id, clock: () => at, advance, networkLearn: learn, supplies, networkCraft: craft,
    networkPrepare: prepare, networkEstablish: establish, networkMystery: mystery, publicTrail };
}
