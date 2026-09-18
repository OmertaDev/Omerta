// Complete the campaign through server-issued Player Commands. The initial
// community and route are fixtures created through their ordinary domain APIs.
import assert from 'node:assert/strict';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createDockWarDefinitions, DOCK_WAR_SITUATION_IDS } from '../src/director/dock-war.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { boostCar } from '../src/economy.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { dockFixture, ids } from './lib/director-support.js';
import { executeIssued, findCommand, issueAndExecute } from './lib/player-command-support.js';

for (const branch of ['protected', 'intercepted', 'alternate_route']) {
  const f = await dockFixture(`journey_${branch}`);
  const { pool, content, actors } = f;
  let at = Date.now();
  const director = createLivingWorldDirector({ pool, content, definitions: createDockWarDefinitions(content), mode: 'LIVE', clock: () => at });
  let engine = createPlayerCommandEngine({ pool, content, director, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const act = (account, type, parameters = {}, options = {}) => issueAndExecute(engine, account, type, parameters, options);
  const read = (account, options = {}) => engine.snapshot(account, options);
  const tick = async (seconds = 601) => { at += seconds * 1000; return director.tick(); };
  const sourced = new Set();
  async function learn(account, throughSituation = false) {
    let board = await read(account);
    if (!board.discovery.instances.some((entry) => entry.graphId === ids.coordination && !entry.historical)) {
      if (throughSituation) await act(account, 'situation.act', { actionId: 'investigate' });
      else await act(account, 'discovery.start', { graphId: ids.coordination });
    }
    for (let count = 0; count < 24; count++) {
      board = await read(account);
      const run = board.discovery.instances.find((entry) => entry.graphId === ids.coordination && !entry.historical);
      assert(run);
      const action = run.actions.find((entry) => entry.kind === 'complete') || run.actions.find((entry) => entry.kind === 'discover');
      if (!action) return;
      await act(account, 'discovery.act', { instanceId: run.id, actionId: action.id });
    }
    throw Error('Dock learning exceeded its authored bound');
  }
  async function share(account, proposition, kind = 'crew') {
    const board = await read(account);
    const claims = board.knowledge.claims.filter((entry) => entry.owned && entry.proposition === proposition);
    assert(claims.length, proposition);
    // The public board can contain independently sourced claims with the same
    // proposition. Deliberately share both owned clues, never choose by UUID order.
    let result;
    for (const claim of claims) result = await act(account, 'knowledge.share', { claimId: claim.id, kind });
    return result;
  }
  async function craft(account, minimumWire = 1) {
    await f.move(account, 'foundry');
    const supplies = await read(account);
    const wire = supplies.inventory.resources.find((entry) => entry.templateId === 'mat:wire')?.quantity || 0;
    if (!sourced.has(account) || wire < minimumWire) {
      const random = Math.random, realNow = Date.now;
      let acquired;
      // Advancing the simulated campaign period satisfies the existing vehicle
      // cooldown; it never resets that cooldown or inserts economic inventory.
      try {
        Math.random = () => 0.01; Date.now = () => Math.max(realNow(), at);
        acquired = await f.social(account, (ch, client, h) => boostCar(ch, client, h));
      } finally { Math.random = random; Date.now = realNow; }
      assert.equal(acquired.car?.model, 'junker');
      await act(account, 'item.salvage', { carId: acquired.car.id });
      sourced.add(account);
    }
    const { response } = await act(account, 'recipe.craft', { recipeId: ids.recipe });
    const item = response.feedback.inventoryChanges.find((entry) => entry.templateId === ids.key);
    assert(item, 'the existing crafting command creates a real provenanced route seal');
    return item.id;
  }
  async function mystery(account, kind) {
    return act(account, `mystery.${kind}`, { graphId: ids.evidence }, { mysteryGraphId: ids.evidence });
  }
  async function alternateEvidence() {
    for (const account of [actors.aBoss, actors.aRunner]) {
      await f.move(account, 'docks');
      await act(account, 'situation.act', { actionId: 'tide_ledger' });
      await mystery(account, 'complete'); await learn(account);
    }
    await craft(actors.aRunner);
    await mystery(actors.aRunner, 'discover'); await mystery(actors.aRunner, 'complete'); await learn(actors.aRunner);
    assert(!(await read(actors.aRunner)).knowledge.claims.some((entry) => entry.proposition === 'route.alternate'));
    await share(actors.aRunner, 'canal.crossing');
    await learn(actors.aBoss); await share(actors.aBoss, 'route.alternate');
    await f.move(actors.aRunner, 'docks');
  }
  async function prepare(actionId, definitionId, prefix, itemReady = false) {
    const boss = actors[`${prefix}Boss`], runner = actors[`${prefix}Runner`];
    const definition = content.operations.find((entry) => entry.id === definitionId); assert(definition);
    await f.move(boss, 'docks'); await learn(boss);
    await f.move(runner, 'docks'); await learn(runner);
    if (!itemReady) await craft(runner, definition.roles.flatMap((role) => role.requirements)
      .find((requirement) => requirement.templateId === 'mat:wire').quantity);
    await f.move(runner, 'docks');
    const created = await act(boss, 'situation.act', { actionId });
    const operationId = created.response.result.operationId; assert(operationId);
    assert.equal(created.response.projection.operations.selected.id, operationId, 'Director hands the player to the existing coordination board');
    const op = (account, action, input = {}) => act(account, `operation.${action}`, { operationId, ...input }, { operationId });
    await op(boss, 'publish');
    for (const role of definition.roles) await op(role.id === 'organizer' ? boss : runner, 'join', { roleId: role.id });
    for (const role of definition.roles) for (const requirement of role.requirements) {
      const account = role.id === 'organizer' ? boss : runner;
      await op(account, 'commit', { requirementId: requirement.id });
      await op(account, 'contribute', { requirementId: requirement.id });
    }
    await op(boss, 'approve');
    return { boss, runner, operationId, op };
  }
  try {
    await f.establish();
    const firstTick = await director.tick(); assert.equal(firstTick.selected.length, 1);
    assert.equal((await director.tick()).replayed, true);
    const openingId = firstTick.selected[0].situationId;
    const rumor = await read(actors.aRunner), uninformed = await read(actors.outsider);
    assert.equal(uninformed.situations.length, 0, 'outsiders cannot enumerate the hidden situation');
    assert(rumor.situations.some((entry) => entry.id === openingId));
    for (const hidden of ['The rival dock route is vulnerable', DOCK_WAR_SITUATION_IDS.opening, 'pressureInputs', 'consequenceContracts'])
      assert(!JSON.stringify(rumor).includes(hidden), `Rumor leaks ${hidden}`);
    await learn(actors.aRunner, true); await share(actors.aRunner, 'shipment.route');
    await learn(actors.bBoss, true);
    const protection = findCommand(await read(actors.aBoss), 'situation.act', { actionId: 'protect' });
    const interception = findCommand(await read(actors.bBoss), 'situation.act', { actionId: 'intercept' });
    assert.equal(protection.parameters.situationId, interception.parameters.situationId);
    assert.equal(protection.parameters.situationId, openingId, 'opponents act on one canonical situation');
    assert(!(await read(actors.aBoss)).commands.some((entry) => entry.commandType === 'situation.act' && entry.parameters.actionId === 'intercept'));
    assert(!(await read(actors.bBoss)).commands.some((entry) => entry.commandType === 'situation.act' && entry.parameters.actionId === 'protect'));

    const prefix = branch === 'intercepted' ? 'b' : 'a';
    if (branch === 'alternate_route') await alternateEvidence();
    const branchDefinition = content.branches.find((entry) => entry.state === branch);
    const operation = await prepare({ protected: 'protect', intercepted: 'intercept', alternate_route: 'alternate' }[branch],
      branchDefinition.operationId, prefix, branch === 'alternate_route');
    const executed = await operation.op(operation.boss, 'execute');
    assert.equal(executed.response.projection.worldObjects.find((entry) => entry.id === ids.object).state, branch);
    const replay = await executeIssued(engine, operation.boss, executed.command);
    assert.equal(replay.replayed, true);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM world_kernel_events WHERE object_id=$1', [ids.object])).rows[0].n, 2);
    const resolved = await tick();
    assert(resolved.transitions.some((entry) => entry.id === openingId && entry.kind === 'resolution'));
    // A declared quiet period precedes the next pressure-driven development.
    const nextTick = await tick();
    assert.equal(nextTick.selected.length, 1);
    const next = nextTick.selected[0];
    assert.equal(next.definitionId, DOCK_WAR_SITUATION_IDS[branch]);
    assert.equal(next.campaignId, firstTick.selected[0].campaignId);
    assert.notEqual(next.situationId, openingId);
    assert((await read(actors.outsider)).situations.some((entry) => entry.id === next.situationId), 'the aftermath becomes a public fact');
    const stored = (await pool.query('SELECT * FROM director_situations WHERE id=$1', [openingId])).rows[0];
    assert(stored.world_event_id, 'Director remembers the canonical event without copying world history');
    assert.equal(stored.terminal, true);

    // A restarted Director/Command Engine retains both the campaign and receipts.
    const restarted = createLivingWorldDirector({ pool, content, definitions: createDockWarDefinitions(content), mode: 'LIVE', clock: () => at });
    engine = createPlayerCommandEngine({ pool, content, director: restarted, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
    assert.equal((await restarted.tick()).replayed, true);
    const restoreDefinition = content.operations.find((entry) => entry.world.actionId === `settle_${branch}`);
    const restoration = await prepare('restore', restoreDefinition.id, prefix);
    const restored = await restoration.op(restoration.boss, 'execute');
    assert.equal(restored.response.projection.worldObjects.find((entry) => entry.id === ids.object).state, 'settled');
    await tick();
    assert.equal((await pool.query('SELECT status FROM director_campaigns WHERE id=$1', [next.campaignId])).rows[0].status, 'completed');
    assert.deepEqual(await worldKernelInvariants(pool), { ok: true, issues: [] });
    assert.deepEqual(await familyOperationInvariants(pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM world_operation_capital')).rows[0].n, 0);
    console.log(`director-journey ${branch}: commands, shared situation, knowledge, coordination, canonical consequences, second generation, restart and completion PASS`);
  } finally { await f.cleanup(); }
}
