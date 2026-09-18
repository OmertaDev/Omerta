// The Director's first campaign uses actual domain events, opposing Family
// custody, independent Crew evidence and conserved crafted-item inputs.
import assert from 'node:assert/strict';
import { dockFixture, ids, key } from './lib/director-support.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';

for (const branch of ['protected', 'intercepted', 'alternate_route']) {
  const fixture = await dockFixture(`dock_${branch}`);
  const { pool, actors, kernel, family, content } = fixture;
  try {
    const initial = await fixture.establish();
    assert.equal(initial.state, 'shortage');
    const established = (await pool.query('SELECT * FROM world_kernel_objects WHERE id=$1', [ids.object])).rows[0];
    assert.equal(established.controller_family_id, fixture.families.a.gangId);
    assert.equal((await pool.query("SELECT quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1 AND template_id='mat:wire'", [actors.aBoss])).rows[0].quantity, 1,
      'establishing the route spent one real wire unit; the remaining unit cannot provision a two-unit strategy');
    await assert.rejects(() => kernel.get(actors.outsider, ids.object), { code: 'world_unavailable' });
    if (branch === 'protected') {
      const before = (await pool.query('SELECT count(*)::int AS n FROM world_operations')).rows[0].n;
      await assert.rejects(() => family.create(actors.aBoss, { definitionId: ids.protectOperation }, key(), null,
        async () => { throw Object.assign(Error('Situation expired during admission'), { code: 'director_expired' }); }),
      { code: 'director_expired' });
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM world_operations')).rows[0].n, before,
        'a trusted admission rejection is atomic with operation creation');
      let admissions = 0;
      const createKey = key(), created = await family.create(actors.aBoss, { definitionId: ids.protectOperation }, createKey, null,
        async () => { admissions++; });
      assert.deepEqual(await family.create(actors.aBoss, { definitionId: ids.protectOperation }, createKey, null,
        async () => { throw Error('A completed exact replay must not re-admit'); }), created);
      assert.equal(admissions, 1);
      await family.command(actors.aBoss, created.operationId, 'cancel', {}, key());
    }
    const choice = content.branches.find((entry) => entry.state === branch);
    const prefix = branch === 'intercepted' ? 'b' : 'a';
    const itemId = branch === 'alternate_route' ? await fixture.alternateEvidence(prefix) : null;
    const operation = await fixture.prepare(choice.operationId, prefix, itemId);
    await assert.rejects(() => family.get(actors.outsider, operation.operationId), { code: 'coordination_operation_unavailable' });
    const executeKey = key();
    const result = await operation.command('organizer', 'execute', {}, executeKey);
    assert.equal(result.status, 'completed'); assert.equal(result.world.state, branch);
    assert.deepEqual(await operation.command('organizer', 'execute', {}, executeKey), result);
    await assert.rejects(() => operation.command('organizer', 'execute'), { code: 'coordination_operation_closed' });
    const world = await kernel.get(actors.outsider, ids.object);
    assert.equal(world.state, branch); assert.equal(world.revision, 2);
    assert.equal(world.controllerFamilyId, fixture.families[prefix].gangId,
      'the outcome records the actual resolving Family as canonical route controller');
    const events = (await pool.query('SELECT * FROM world_kernel_events WHERE object_id=$1 ORDER BY revision', [ids.object])).rows;
    assert.equal(events.length, 2); assert.equal(events[1].operation_id, operation.operationId);
    assert.equal(events[1].action_id, choice.actionId);
    const item = (await pool.query('SELECT state FROM item_instances WHERE id=$1', [operation.itemId])).rows[0];
    assert.equal(item.state, 'consumed');
    const wire = (await pool.query("SELECT quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1 AND template_id='mat:wire'", [operation.runner])).rows[0];
    assert.equal(Number(wire?.quantity || 0), 2 - choice.material, 'the authored strategy consumes conserved salvaged wire');
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM world_operation_capital WHERE operation_id=$1', [operation.operationId])).rows[0].n, 0,
      'the campaign creates no currency reward, source, sink or capital obligation');
    assert.equal(content.operations.some((entry) => entry.world.actionId === `settle_${branch}`), true,
      'every first-generation outcome supports a distinct canonical aftermath operation');
    assert.deepEqual(await familyOperationInvariants(pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
    assert.deepEqual(await worldKernelInvariants(pool), { ok: true, issues: [] });
    if (branch === 'alternate_route') {
      const crew = (await pool.query('SELECT crew_id FROM world_operations WHERE id=$1', [operation.operationId])).rows[0];
      assert.equal(crew.crew_id, fixture.crews.a.id);
      const members = (await pool.query('SELECT account_id FROM world_operation_roles WHERE operation_id=$1', [operation.operationId])).rows;
      assert.equal(new Set(members.map((entry) => entry.account_id)).size, 2, 'the peaceful route requires two actual Crew members');
      const aftermath = await fixture.prepare(ids.alternateAftermathOperation, prefix);
      const settled = await aftermath.command('organizer', 'execute');
      assert.equal(settled.world.state, 'settled'); assert.equal(settled.world.revision, 3);
    }
    console.log(`Dock War ${branch}: real domain branch, retry, custody and canonical history passed`);
  } finally { await fixture.cleanup(); }
}

{
  const fixture = await dockFixture('dock_opposition');
  try {
    await fixture.establish();
    const protection = await fixture.prepare(ids.protectOperation, 'a');
    const interception = await fixture.prepare(ids.interceptOperation, 'b');
    const results = await Promise.allSettled([protection.command('organizer', 'execute'), interception.command('organizer', 'execute')]);
    const succeeded = results.filter((result) => result.status === 'fulfilled');
    assert.equal(succeeded.length, 1, 'only one opposing operation may mutate the shared canonical route');
    const failedIndex = results.findIndex((result) => result.status === 'rejected');
    assert(['coordination_operation_not_ready', 'coordination_operation_requirements', 'contention', 'world_stale', '40P01', '40001']
      .includes(results[failedIndex].reason.code), `unexpected conflict failure: ${results[failedIndex].reason.code}`);
    const losing = [protection, interception][failedIndex];
    await losing.command('organizer', 'cancel');
    const returned = (await fixture.pool.query('SELECT state,owner_scope,owner_id FROM item_instances WHERE id=$1', [losing.itemId])).rows[0];
    assert.deepEqual(returned, { state: 'active', owner_scope: 'account', owner_id: losing.runner },
      'the losing Family can recover its intact committed equipment');
    assert.equal((await fixture.pool.query('SELECT count(*)::int AS n FROM world_kernel_events WHERE object_id=$1', [ids.object])).rows[0].n, 2);
    assert.deepEqual(await familyOperationInvariants(fixture.pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
    assert.deepEqual(await worldKernelInvariants(fixture.pool), { ok: true, issues: [] });
    console.log('Dock War opposition: concurrent Family operations, single canonical outcome and losing-side recovery passed');
  } finally { await fixture.cleanup(); }
}
