// Recovery retains canonical consequences and catches up from real event history.
import assert from 'node:assert/strict';
import { dockFixture, ids, key } from './lib/director-support.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createDockWarDefinitions, DOCK_WAR_SITUATION_IDS } from '../src/director/dock-war.js';
import { boostCar } from '../src/economy.js';
import { salvageCar } from '../src/crafting.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';

async function scenario(tag, clockOffsetMs = 0) {
  const f = await dockFixture(tag);
  let at = Date.now() + clockOffsetMs;
  const director = createLivingWorldDirector({ pool: f.pool, content: f.content,
    definitions: createDockWarDefinitions(f.content), mode: 'LIVE', clock: () => at });
  const tick = async (seconds = 601) => { at += seconds * 1000; return director.tick(); };
  await f.establish();
  const opening = (await director.tick()).selected[0]; assert(opening);
  const protection = await f.prepare(ids.protectOperation);
  await protection.command('organizer', 'execute');
  return { f, director, tick, opening, now: () => at,
    async aftermath() {
      await tick();
      const selected = (await tick()).selected;
      assert.equal(selected.length, 1);
      assert.equal(selected[0].definitionId, DOCK_WAR_SITUATION_IDS.protected);
      return (await f.pool.query('SELECT * FROM director_situations WHERE id=$1', [selected[0].situationId])).rows[0];
    } };
}
const physical = async (pool) => ({
  objects: (await pool.query('SELECT * FROM world_kernel_objects ORDER BY id')).rows,
  events: (await pool.query('SELECT * FROM world_kernel_events ORDER BY object_id,revision')).rows,
  items: (await pool.query('SELECT * FROM item_instances ORDER BY id')).rows,
  stacks: (await pool.query('SELECT * FROM item_stacks ORDER BY owner_scope,owner_id,template_id,quality')).rows,
});
async function invariants(pool) {
  assert.deepEqual(await worldKernelInvariants(pool), { ok: true, issues: [] });
  assert.deepEqual(await familyOperationInvariants(pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
}
async function restoreProtected(s) {
  const runner = s.f.actors.aRunner;
  await s.f.move(runner, 'foundry');
  const realNow = Date.now, random = Math.random;
  let acquired;
  try {
    Date.now = () => Math.max(realNow(), s.now()) + 2 * 3600000; Math.random = () => 0.01;
    acquired = await s.f.social(runner, (ch, client, h) => boostCar(ch, client, h));
  } finally { Date.now = realNow; Math.random = random; }
  assert.equal(acquired.car?.model, 'junker');
  await s.f.tx((client) => salvageCar(client, { accountId: runner }, acquired.car.id, 'recipe:car_salvage_basic', key()));
  const itemId = await s.f.craft(runner);
  const restore = await s.f.prepare(ids.protectedAftermathOperation, 'a', itemId);
  const restored = await restore.command('organizer', 'execute');
  assert.equal(restored.world.state, 'settled'); assert.equal(restored.world.revision, 3);
  return restored;
}

{
  const s = await scenario('director_resume');
  try {
    const aftermath = await s.aftermath(), before = await physical(s.f.pool);
    await s.tick(Math.ceil((new Date(aftermath.expires_at).getTime() - s.now()) / 1000) + 1);
    const abandoned = (await s.f.pool.query('SELECT status FROM director_campaigns WHERE id=$1', [s.opening.campaignId])).rows[0];
    assert.equal(abandoned.status, 'abandoned');
    const expired = (await s.f.pool.query('SELECT terminal,outcome FROM director_situations WHERE id=$1', [aftermath.id])).rows[0];
    assert.deepEqual(expired, { terminal: true, outcome: 'expiry' });
    const resumed = (await s.tick()).selected;
    assert.equal(resumed.length, 1, 'the quiet period permits a bounded recovery campaign');
    assert.notEqual(resumed[0].campaignId, s.opening.campaignId);
    assert.equal(resumed[0].definitionId, DOCK_WAR_SITUATION_IDS.protected,
      'recovery resumes the unresolved protected aftermath instead of manufacturing another shortage');
    const receipt = (await s.f.pool.query("SELECT result_json FROM director_receipts WHERE kind='campaign_create' AND subject_id=$1",
      [resumed[0].campaignId])).rows[0];
    assert.equal(JSON.parse(receipt.result_json).recoveryOf, s.opening.campaignId);
    assert.deepEqual(await physical(s.f.pool), before, 'expiration and recovery preserve every canonical consequence and input ledger');
    const retry = await s.director.tick(); assert.equal(retry.replayed, true);
    assert.equal((await s.f.pool.query('SELECT count(*)::int AS n FROM director_campaigns')).rows[0].n, 2);
    await invariants(s.f.pool);
    console.log('Director recovery: expired aftermath resumes once after cooldown with durable recovery lineage');
  } finally { await s.f.cleanup(); }
}

{
  const s = await scenario('director_season');
  try {
    const aftermath = await s.aftermath(), before = await physical(s.f.pool);
    // Simulate the season authority advancing canonical character season. No
    // Director row, item, knowledge or world consequence is changed by this input.
    await s.f.pool.query('UPDATE characters SET season=season+1 WHERE alive=true');
    const changed = await s.tick();
    assert(changed.transitions.some((transition) => transition.id === aftermath.id && transition.kind === 'recovery'));
    const retired = (await s.f.pool.query('SELECT terminal,state,outcome FROM director_situations WHERE id=$1', [aftermath.id])).rows[0];
    assert.equal(retired.terminal, true); assert.equal(retired.outcome, 'recovery');
    assert.deepEqual(await physical(s.f.pool), before, 'season recovery never silently removes the completed protection or consumed inputs');
    await invariants(s.f.pool);
    console.log('Director recovery: season change records explicit recovery while preserving world consequences');
  } finally { await s.f.cleanup(); }
}

{
  const s = await scenario('director_catchup');
  try {
    await restoreProtected(s);
    const before = await physical(s.f.pool);
    // Both independent legitimate domain operations committed before the next
    // scheduler observation; canonical history contains their complete chain.
    await s.tick();
    const campaign = (await s.f.pool.query('SELECT status,node_id FROM director_campaigns WHERE id=$1', [s.opening.campaignId])).rows[0];
    assert.deepEqual(campaign, { status: 'completed', node_id: 'protected' },
      'the Director must catch up through both authenticated events, never abandon an already completed canonical campaign');
    assert.deepEqual(await physical(s.f.pool), before, 'catch-up reads history without repeating either physical operation');
    assert.equal((await s.f.pool.query('SELECT count(*)::int AS n FROM world_kernel_events WHERE object_id=$1', [ids.object])).rows[0].n, 3);
    await invariants(s.f.pool);
    console.log('Director recovery: multiple physical outcomes between evaluations catch up to canonical campaign completion');
  } finally { await s.f.cleanup(); }
}

for (const observedAftermath of [false, true]) {
  const tag = observedAftermath ? 'director_terminal_deadline' : 'director_chain_deadline';
  const s = await scenario(tag);
  try {
    const aftermath = observedAftermath ? await s.aftermath() : null;
    await restoreProtected(s);
    const campaign = (await s.f.pool.query('SELECT * FROM director_campaigns WHERE id=$1', [s.opening.campaignId])).rows[0];
    const physicalEvents = (await s.f.pool.query('SELECT id,action_id,occurred_at FROM world_kernel_events WHERE object_id=$1 AND revision>1 ORDER BY revision', [ids.object])).rows;
    assert.deepEqual(physicalEvents.map((event) => event.action_id), ['protect_shipment', 'settle_protected']);
    assert(physicalEvents.every((event) => new Date(event.occurred_at).getTime() < new Date(campaign.expires_at).getTime()),
      'canonical event timestamps prove both physical outcomes committed before the campaign deadline');
    if (aftermath) assert(new Date(physicalEvents[1].occurred_at).getTime() < new Date(aftermath.expires_at).getTime(),
      'the terminal follow-up also committed before its own situation deadline');
    const before = await physical(s.f.pool);
    const result = await s.tick(Math.ceil((new Date(campaign.expires_at).getTime() - s.now()) / 1000) + 1);
    assert(s.now() > new Date(campaign.expires_at).getTime(), 'the worker resumes only after the campaign deadline');
    const completed = (await s.f.pool.query('SELECT status,node_id FROM director_campaigns WHERE id=$1', [s.opening.campaignId])).rows[0];
    assert.deepEqual(completed, { status: 'completed', node_id: 'protected' }, observedAftermath
      ? 'a terminal outcome committed before its deadline remains completed when the worker observes it after campaign expiry'
      : 'two canonical outcomes committed before deadline must be caught up as completed after a worker outage');
    const terminal = (await s.f.pool.query('SELECT terminal,outcome,world_event_id FROM director_situations WHERE campaign_id=$1 AND node_id=$2',
      [s.opening.campaignId, 'protected'])).rows[0];
    assert(terminal?.terminal); assert.equal(terminal.outcome, 'settle');
    assert.equal(terminal.world_event_id, physicalEvents[1].id, 'the late completion records the actual terminal World Kernel event');
    assert.deepEqual(await physical(s.f.pool), before, 'late observation never replays, erases or refunds canonical effects');
    assert.equal((await s.director.tick()).replayed, true);
    assert.equal(result.selected.length, 0, 'already completed world work creates no active replacement campaign');
    await invariants(s.f.pool);
    console.log(`Director recovery: ${observedAftermath ? 'terminal follow-up' : 'complete canonical chain'} committed before deadline survives a late worker restart`);
  } finally { await s.f.cleanup(); }
}

{
  // An internal historical clock makes the deadline precede these real domain
  // events. No canonical event timestamp or Director database row is rewritten.
  const s = await scenario('director_late_outcome', -8 * 86400000);
  try {
    await restoreProtected(s);
    const campaign = (await s.f.pool.query('SELECT * FROM director_campaigns WHERE id=$1', [s.opening.campaignId])).rows[0];
    const events = (await s.f.pool.query('SELECT occurred_at FROM world_kernel_events WHERE object_id=$1 AND revision>1 ORDER BY revision', [ids.object])).rows;
    assert(events.every((event) => new Date(event.occurred_at).getTime() > new Date(campaign.expires_at).getTime()),
      'the real operation timestamps are strictly after the historical campaign deadline');
    const before = await physical(s.f.pool);
    const result = await s.tick(8 * 86400 + 1);
    const expired = (await s.f.pool.query('SELECT status FROM director_campaigns WHERE id=$1', [s.opening.campaignId])).rows[0];
    assert.equal(expired.status, 'abandoned', 'a genuinely late physical result is not retroactively credited as timely campaign completion');
    const opening = (await s.f.pool.query('SELECT outcome,world_event_id FROM director_situations WHERE id=$1', [s.opening.situationId])).rows[0];
    assert.equal(opening.outcome, 'expiry'); assert.equal(opening.world_event_id, null);
    assert.equal(result.selected.length, 0);
    assert.deepEqual(await physical(s.f.pool), before, 'missing a campaign deadline does not erase the real physical result or its costs');
    await invariants(s.f.pool);
    console.log('Director recovery: canonical outcomes committed after deadline remain late without erasing world consequences');
  } finally { await s.f.cleanup(); }
}

{
  const s = await scenario('director_unseen_aftermath');
  try {
    const campaign = (await s.f.pool.query('SELECT * FROM director_campaigns WHERE id=$1', [s.opening.campaignId])).rows[0];
    const event = (await s.f.pool.query("SELECT id,occurred_at FROM world_kernel_events WHERE object_id=$1 AND action_id='protect_shipment'", [ids.object])).rows[0];
    assert(new Date(event.occurred_at).getTime() < new Date(campaign.expires_at).getTime());
    const before = await physical(s.f.pool);
    await s.tick(Math.ceil((new Date(campaign.expires_at).getTime() - s.now()) / 1000) + 1);
    const abandoned = (await s.f.pool.query('SELECT status,node_id FROM director_campaigns WHERE id=$1', [s.opening.campaignId])).rows[0];
    assert.deepEqual(abandoned, { status: 'abandoned', node_id: 'protected' },
      'a timely physical branch remains the recovery destination when the worker first observes it after the campaign deadline');
    const opening = (await s.f.pool.query('SELECT terminal,outcome,world_event_id FROM director_situations WHERE id=$1', [s.opening.situationId])).rows[0];
    assert.deepEqual(opening, { terminal: true, outcome: 'protect', world_event_id: event.id });
    const next = await s.tick();
    assert.equal(next.selected.length, 1, 'the unresolved branch can resume after the declared quiet period');
    const resumed = next.selected[0];
    assert.equal(resumed.definitionId, DOCK_WAR_SITUATION_IDS.protected);
    assert.notEqual(resumed.campaignId, s.opening.campaignId);
    const receipt = (await s.f.pool.query("SELECT result_json FROM director_receipts WHERE kind='campaign_create' AND subject_id=$1", [resumed.campaignId])).rows[0];
    assert.equal(JSON.parse(receipt.result_json).recoveryOf, s.opening.campaignId);
    assert.deepEqual(await physical(s.f.pool), before, 'resuming an unobserved aftermath neither rewinds control nor repeats consumed inputs');
    assert.equal((await s.director.tick()).replayed, true);
    await invariants(s.f.pool);
    console.log('Director recovery: timely protection observed after campaign expiry preserves and resumes its unresolved aftermath');
  } finally { await s.f.cleanup(); }
}
