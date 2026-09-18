// Native execution witnesses complement the model: conservation and recovery
// are asserted over existing domain rows, with no seeded stock or refunds.
import assert from 'node:assert/strict';
import { campaignNetworkFixture } from './lib/campaign-network-support.js';
import { postgres, key, findCommand, executeIssued } from './lib/player-command-support.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createCampaignNetworkDefinitions, CAMPAIGN_NETWORK_SITUATION_IDS } from '../src/director/campaign-network.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { leaveGang } from '../src/social.js';
import { leaveCrew } from '../src/crew.js';
import { consumeItem } from '../src/items.js';

const financial = async (pool) => ({
  cash: (await pool.query('SELECT id,cash,bank FROM characters ORDER BY id')).rows,
  tokens: (await pool.query('SELECT account_id,omr,staked,rewards,unbonding FROM account_persistent ORDER BY account_id')).rows,
});
const physical = async (pool) => ({
  ...await financial(pool),
  stacks: (await pool.query('SELECT * FROM item_stacks ORDER BY owner_scope,owner_id,template_id,quality')).rows,
  items: (await pool.query('SELECT * FROM item_instances ORDER BY id')).rows,
  provenance: (await pool.query('SELECT * FROM item_events ORDER BY sequence')).rows,
  world: (await pool.query('SELECT * FROM world_kernel_objects ORDER BY id')).rows,
  consequences: (await pool.query('SELECT * FROM world_kernel_events ORDER BY object_id,revision')).rows,
});
const wire = async (pool) => (await pool.query("SELECT quantity FROM item_stacks WHERE template_id='mat:wire' AND quality='standard'")).rows
  .reduce((sum, row) => sum + Number(row.quantity), 0);
const invariants = async (pool) => {
  assert.deepEqual(await familyOperationInvariants(pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
  assert.deepEqual(await worldKernelInvariants(pool), { ok: true, issues: [] });
};

{
  const f = await campaignNetworkFixture('network_competition');
  const definitions = createCampaignNetworkDefinitions(f.content);
  const make = () => createLivingWorldDirector({ pool: f.pool, content: f.content, definitions, mode: 'LIVE', clock: f.clock });
  try {
    await f.networkEstablish();
    const economicBeforeSelection = await physical(f.pool);
    const evaluations = await Promise.all([make().tick(), make().tick()]);
    assert.equal(evaluations.filter((entry) => !entry.replayed).length, 1);
    assert.deepEqual(await physical(f.pool), economicBeforeSelection, 'Concurrent Director workers cannot mint, consume or transfer anything');
    const opening = (await f.pool.query('SELECT * FROM director_situations WHERE definition_id=$1', [CAMPAIGN_NETWORK_SITUATION_IDS.shipment])).rows[0];
    assert(opening);

    // These ordinary Family operations remain domain-authorized independently
    // of the Director. Both contend on one World Kernel revision.
    const a = await f.networkPrepare('destroy_shipment');
    const b = await f.networkPrepare('intercept_shipment', { prefix: 'b' });
    const money = await financial(f.pool), stock = await wire(f.pool), keys = [key(), key()];
    const attempts = [a, b];
    const execute = (index) => attempts[index].command('organizer', 'execute', {}, keys[index]);
    const results = postgres ? await Promise.allSettled([execute(0), execute(1)])
      : [await execute(0).then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason })),
        await execute(1).then((value) => ({ status: 'fulfilled', value }), (reason) => ({ status: 'rejected', reason }))];
    assert.equal(results.filter((entry) => entry.status === 'fulfilled').length, 1);
    const winnerIndex = results.findIndex((entry) => entry.status === 'fulfilled'), loserIndex = 1 - winnerIndex;
    const winner = attempts[winnerIndex], loser = attempts[loserIndex];
    assert(['coordination_operation_not_ready', 'coordination_operation_requirements', 'contention', 'world_stale', '40P01', '40001']
      .includes(results[loserIndex].reason.code), results[loserIndex].reason.code);
    const sink = winner.definition.roles.flatMap((role) => role.requirements).find((entry) => entry.kind === 'resource').quantity;
    assert.equal(await wire(f.pool), stock - sink, 'Only the successful authoritative operation spends wire');
    assert.deepEqual(await financial(f.pool), money, 'Campaign operations have zero cash and OMR delta');
    const committed = await physical(f.pool);
    assert.deepEqual(await execute(winnerIndex), results[winnerIndex].value);
    assert.deepEqual(await physical(f.pool), committed, 'Exact successful replay cannot duplicate resources, consequences or rewards');
    const cancelKey = key();
    await loser.command('organizer', 'cancel', {}, cancelKey);
    const recovered = await physical(f.pool);
    await loser.command('organizer', 'cancel', {}, cancelKey);
    assert.deepEqual(await physical(f.pool), recovered, 'Exact cancellation replay cannot duplicate refunds');
    assert.equal(await wire(f.pool), stock - sink);
    const returned = (await f.pool.query('SELECT state,owner_id FROM item_instances WHERE id=$1', [loser.itemId])).rows[0];
    assert.deepEqual(returned, { state: 'active', owner_id: loser.runner });
    const spent = (await f.pool.query('SELECT state FROM item_instances WHERE id=$1', [winner.itemId])).rows[0];
    assert.equal(spent.state, 'consumed');
    const events = (await f.pool.query('SELECT operation_id FROM world_kernel_events WHERE object_id=$1 ORDER BY revision', [f.ids.object])).rows;
    assert.equal(events.length, 2); assert.equal(events[1].operation_id, winner.operationId);

    // An outage may delay observation past expiry; canonical event timestamps
    // still determine resolution and no recovery action rewrites physical state.
    f.advance(8 * 86400);
    const restarted = make(); await restarted.tick();
    assert.equal((await restarted.tick()).replayed, true);
    assert.deepEqual(await physical(f.pool), recovered, 'Late observation and worker restart preserve all canonical resource provenance');
    const terminal = (await f.pool.query('SELECT terminal,world_event_id FROM director_situations WHERE id=$1', [opening.id])).rows[0];
    assert(terminal.terminal); assert(terminal.world_event_id);
    await invariants(f.pool);
    console.log(`Campaign network: ${postgres ? 'native concurrent' : 'sequential memory'} contested operations, conserved provenance, refund replay and late restart PASS`);
  } finally { await f.cleanup(); }
}

{
  const f = await campaignNetworkFixture('network_membership');
  try {
    await f.networkEstablish();
    const operation = await f.networkPrepare('intercept_shipment', { prefix: 'b' });
    const engine = createPlayerCommandEngine({ pool: f.pool, content: f.content, enabled: true,
      knowledgeEnabled: true, sharingEnabled: true });
    const issued = findCommand(await engine.snapshot(operation.boss, { operationId: operation.operationId }),
      'operation.execute', { operationId: operation.operationId });
    await f.social(operation.runner, (character, client, hooks) => leaveGang(character, client, hooks));
    const before = await physical(f.pool);
    await assert.rejects(() => executeIssued(engine, operation.boss, issued), { code: 'command_stale' });
    await assert.rejects(() => operation.command('organizer', 'execute'), (error) =>
      ['coordination_operation_not_ready', 'coordination_operation_requirements'].includes(error.code));
    assert.deepEqual(await physical(f.pool), before, 'Membership loss before admission cannot consume promised items or mutate the route');
    await operation.command('organizer', 'cancel');
    assert.equal((await f.pool.query('SELECT state FROM item_instances WHERE id=$1', [operation.itemId])).rows[0].state, 'active');
    await invariants(f.pool);
    console.log('Campaign network: membership departure revalidation and domain custody recovery PASS');
  } finally { await f.cleanup(); }
}

{
  const f = await campaignNetworkFixture('network_stale_inputs');
  try {
    await f.networkEstablish();
    const director = createLivingWorldDirector({ pool: f.pool, content: f.content,
      definitions: createCampaignNetworkDefinitions(f.content), mode: 'LIVE', clock: f.clock });
    await director.tick();
    const engine = createPlayerCommandEngine({ pool: f.pool, content: f.content, director, enabled: true,
      knowledgeEnabled: true, sharingEnabled: true });
    const boss = f.actors.aBoss, runner = f.actors.aRunner;
    const rumor = findCommand(await engine.snapshot(runner), 'situation.act', { actionId: 'read_register' });
    await f.social(runner, (character, client, hooks) => leaveCrew(character, client, hooks));
    const departed = await physical(f.pool);
    await assert.rejects(() => executeIssued(engine, runner, rumor), { code: 'command_stale' });
    assert.deepEqual(await physical(f.pool), departed, 'Crew departure invalidates an issued private opportunity');

    const itemId = await f.networkCraft(runner, 2); await f.move(runner, 'docks');
    const operation = await f.family.create(boss, { definitionId: 'operation:canal_destroy_shipment' }, key());
    await f.family.command(boss, operation.operationId, 'publish', {}, key());
    await f.family.command(runner, operation.operationId, 'join', { roleId: 'runner' }, key());
    await f.family.command(runner, operation.operationId, 'commit', { requirementId: 'cargo_seal' }, key());
    const contribution = findCommand(await engine.snapshot(runner, { operationId: operation.operationId }),
      'operation.contribute', { operationId: operation.operationId, requirementId: 'cargo_seal', itemId });
    await f.tx((client) => consumeItem(client, { scope: 'account', id: runner }, itemId,
      'canonical competing item use before contribution', key()));
    const consumed = await physical(f.pool);
    await assert.rejects(() => executeIssued(engine, runner, contribution), { code: 'command_stale' });
    assert.deepEqual(await physical(f.pool), consumed, 'An item consumed elsewhere cannot be committed from a stale issued card');
    await f.family.command(boss, operation.operationId, 'cancel', {}, key());

    const expiring = findCommand(await engine.snapshot(boss), 'situation.act', { actionId: 'recover_shipment' });
    f.advance(3 * 86400);
    const expired = await physical(f.pool);
    await assert.rejects(() => executeIssued(engine, boss, expiring), (error) =>
      ['command_stale', 'director_unavailable'].includes(error.code));
    assert.deepEqual(await physical(f.pool), expired, 'A deadline passing after projection is rechecked before domain admission');
    await invariants(f.pool);
    console.log('Campaign network: issued Crew, item and deadline changes reject without partial effects PASS');
  } finally { await f.cleanup(); }
}

if (postgres) {
  const f = await campaignNetworkFixture('network_rollback');
  try {
    await f.networkEstablish();
    const operation = await f.networkPrepare('destroy_shipment');
    const engine = createPlayerCommandEngine({ pool: f.pool, content: f.content, enabled: true,
      knowledgeEnabled: true, sharingEnabled: true });
    const issued = findCommand(await engine.snapshot(operation.boss, { operationId: operation.operationId }),
      'operation.execute', { operationId: operation.operationId });
    const before = await physical(f.pool);
    await f.pool.query(`CREATE FUNCTION fail_network_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'isolated network event interruption'; END $$`);
    await f.pool.query('CREATE TRIGGER fail_network_event BEFORE INSERT ON world_kernel_events FOR EACH ROW EXECUTE FUNCTION fail_network_event()');
    try { await assert.rejects(() => executeIssued(engine, operation.boss, issued), { code: 'P0001' }); }
    finally {
      await f.pool.query('DROP TRIGGER fail_network_event ON world_kernel_events');
      await f.pool.query('DROP FUNCTION fail_network_event()');
    }
    assert.deepEqual(await physical(f.pool), before, 'Database interruption after material consumption rolls back custody, world state and provenance');
    const results = await Promise.allSettled([executeIssued(engine, operation.boss, issued), executeIssued(engine, operation.boss, issued)]);
    assert(results.some((entry) => entry.status === 'fulfilled'));
    const replay = await executeIssued(engine, operation.boss, issued); assert(replay.replayed);
    assert.equal(results.filter((entry) => entry.status === 'fulfilled' && entry.value.replayed === false).length, 1);
    assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM world_kernel_events WHERE operation_id=$1', [operation.operationId])).rows[0].n, 1);
    await invariants(f.pool);
    console.log('Campaign network: native transactional interruption, original issued retry and simultaneous duplicate commands PASS');
  } finally { await f.cleanup(); }
}
