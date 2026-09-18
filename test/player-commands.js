import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createFurnaceLedger, FURNACE_IDS as ids } from '../src/content/furnace-ledger.js';
import { travel, withCharacter } from '../src/game.js';
import { commandDatabase, postgres, key, characterId, addPlayer, engineFor, findCommand,
  executeIssued, issueAndExecute } from './lib/player-command-support.js';

const database = await commandDatabase('security'); let pool = database.pool;
const content = createFurnaceLedger(); let engine = engineFor(pool, content);
const actor = 'command-owner', other = 'command-other';
const passed = [];
const check = (name) => { passed.push(name); console.log(`PASS ${name}`); };
const snapshot = (account = actor, options = {}) => engine.snapshot(account, options);
const move = (location) => withCharacter(pool, actor, (ch, client, h) => travel(ch, location, client, h));
const run = (type, parameters = {}, options = {}) => issueAndExecute(engine, actor, type, parameters, options);
const car = async () => {
  const id = key();
  await pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,'junker','stock',30)", [id, characterId(actor)]);
  return id;
};
async function economicState() {
  return {
    cars: (await pool.query('SELECT id FROM cars WHERE character_id=$1 ORDER BY id', [characterId(actor)])).rows,
    resources: (await pool.query("SELECT template_id,quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1 ORDER BY template_id", [actor])).rows,
    events: Number((await pool.query('SELECT count(*) AS n FROM item_events')).rows[0].n),
  };
}
try {
  await addPlayer(pool, actor); await addPlayer(pool, other);
  const first = await snapshot();
  assert.equal(first.commandSchemaVersion, 1);
  const required = ['commandId', 'commandType', 'subject', 'target', 'label', 'description', 'availability',
    'requirements', 'blockers', 'costs', 'committedResources', 'requiredKnowledge', 'requiredItems',
    'requiredRoles', 'requiredParticipants', 'authorization', 'executionIdentity', 'confirmation', 'resultContract'];
  for (const command of first.commands) {
    for (const property of required) assert(Object.hasOwn(command, property), `Command contract missing ${property}`);
    assert(['AVAILABLE', 'BLOCKED', 'LOCKED', 'IN_PROGRESS', 'EXPIRED', 'COMPLETED'].includes(command.availability));
  }
  assert(first.commands.length > 0); assert(first.opportunities.length > 0);
  check('stable versioned command contract and server-derived opportunities');

  for (const hidden of [ids.key, ids.impression, ids.preserveOperation, ids.exposeOperation,
    'beneath-the-quench-floor', 'deliveries-after-confiscation', 'docks.carbon-manifest', 'foundry.reversed-countermark']) {
    assert(!JSON.stringify(first).includes(hidden), `Hidden command metadata leaked ${hidden}`);
  }
  const initial = findCommand(first, 'mystery.start', { graphId: ids.inspection });
  await assert.rejects(() => executeIssued(engine, other, initial), { code: 'command_unavailable' });
  await assert.rejects(() => engine.execute(actor, { executionId: key(), confirmed: true }, key()), { code: 'bad_command_request' });
  await assert.rejects(() => engine.execute(actor, { executionId: initial.executionIdentity.executionId, confirmed: true }, key()), { code: 'bad_command_request' });
  for (const extra of [{ accountId: other }, { graphId: ids.epilogue }, { commandType: 'world.execute' },
    { parameters: { nodeId: ids.impression } }, { authorization: true }]) {
    await assert.rejects(() => engine.execute(actor, { executionId: initial.executionIdentity.executionId, confirmed: true, ...extra },
      initial.executionIdentity.executionId), { code: 'bad_command_request' });
  }
  check('hidden prerequisite privacy, account-bound issuance, opaque identity and request substitution denials');

  for (let offset = 0; offset < 16; offset++) {
    const current = initial.executionIdentity.executionId;
    const forged = current.slice(0, offset) + (current[offset] === 'a' ? 'b' : 'a') + current.slice(offset + 1);
    await assert.rejects(() => engine.execute(actor, { executionId: forged, confirmed: true }, forged), { code: 'command_unavailable' });
  }
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM mystery_instances')).rows[0].n), 0);
  check('bounded identity mutation fuzzing cannot manufacture authorization');

  const same = findCommand(await snapshot(), 'mystery.start', { graphId: ids.inspection });
  assert.equal(same.executionIdentity.executionId, initial.executionIdentity.executionId, 'unchanged snapshots must not mint independent retries');
  const started = await executeIssued(engine, actor, initial);
  assert.equal(started.status, 'COMPLETED');
  const duplicate = await executeIssued(engine, actor, initial);
  assert.equal(duplicate.replayed, true); assert.deepEqual(duplicate.result, started.result);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM mystery_instances WHERE authority_account_id=$1 AND graph_id=$2', [actor, ids.inspection])).rows[0].n), 1);
  check('stable issuance, duplicate, double click and durable replay');

  const complete = findCommand(await snapshot(actor, { mysteryGraphId: ids.inspection }), 'mystery.complete', { graphId: ids.inspection });
  await move('foundry');
  await assert.rejects(() => executeIssued(engine, actor, complete), { code: 'command_stale' });
  await move('docks');
  await pool.query("UPDATE accounts SET status='suspended' WHERE id=$1", [actor]);
  await assert.rejects(() => executeIssued(engine, actor, complete), { code: 'command_unavailable' });
  await pool.query("UPDATE accounts SET status='active' WHERE id=$1", [actor]);
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [characterId(actor)]);
  await assert.rejects(() => executeIssued(engine, actor, complete), { code: 'command_unavailable' });
  await pool.query('UPDATE characters SET alive=true WHERE id=$1', [characterId(actor)]);
  await executeIssued(engine, actor, findCommand(await snapshot(actor, { mysteryGraphId: ids.inspection }), 'mystery.complete', { graphId: ids.inspection }));
  check('stale location, revoked account authority and dead-character revalidation');

  const expiring = findCommand(await snapshot(), 'mystery.start', { graphId: ids.deduction });
  const expiryBoardId = expiring.executionIdentity.executionId.split('.')[0];
  const expiryBefore = (await pool.query('SELECT expires_at FROM player_command_boards WHERE id=$1', [expiryBoardId])).rows[0].expires_at;
  await pool.query('UPDATE player_command_boards SET expires_at=$2 WHERE id=$1', [expiryBoardId, new Date(Date.now() - 1000)]);
  await assert.rejects(() => executeIssued(engine, actor, expiring), { code: 'command_expired' });
  await pool.query('UPDATE player_command_boards SET expires_at=$2 WHERE id=$1', [expiryBoardId, expiryBefore]);
  check('expired unexecuted opportunity cannot mutate the world');

  await move('foundry');
  const consumedCar = await car();
  const salvage = findCommand(await snapshot(), 'item.salvage', { carId: consumedCar });
  if (salvage.confirmation.required) {
    const before = await economicState();
    await assert.rejects(() => executeIssued(engine, actor, salvage, false), { code: 'command_confirmation_required' });
    assert.deepEqual(await economicState(), before);
  }
  const beforeSalvage = await economicState();
  const salvaged = await executeIssued(engine, actor, salvage);
  assert.equal(salvaged.status, 'COMPLETED');
  const afterSalvage = await economicState();
  const lostResponseRetry = await executeIssued(engineFor(pool, content), actor, salvage);
  assert.equal(lostResponseRetry.replayed, true); assert.deepEqual(await economicState(), afterSalvage);
  assert(!afterSalvage.cars.some((entry) => entry.id === consumedCar));
  assert(!JSON.stringify((await snapshot()).commands).includes(consumedCar));
  check('confirmation, consumed asset removal and timeout retry without economic duplication');

  const removedCar = await car();
  const staleSalvage = findCommand(await snapshot(), 'item.salvage', { carId: removedCar });
  await pool.query('DELETE FROM cars WHERE id=$1', [removedCar]);
  const beforeStale = await economicState();
  await assert.rejects(() => executeIssued(engine, actor, staleSalvage), { code: 'command_stale' });
  assert.deepEqual(await economicState(), beforeStale);
  check('item consumed after projection denies execution without partial economy effects');

  if (postgres) {
    const concurrentCar = await car();
    const concurrent = findCommand(await snapshot(), 'item.salvage', { carId: concurrentCar });
    const before = await economicState();
    const responses = await Promise.allSettled(Array.from({ length: 8 }, () => executeIssued(engineFor(pool, content), actor, concurrent)));
    assert(responses.some((response) => response.status === 'fulfilled'));
    const retry = await executeIssued(engine, actor, concurrent); assert.equal(retry.replayed, true);
    const after = await economicState();
    for (const row of after.resources) {
      const delta = Number(row.quantity) - Number(before.resources.find((entry) => entry.template_id === row.template_id)?.quantity || 0);
      const expectedDelta = Number(afterSalvage.resources.find((entry) => entry.template_id === row.template_id)?.quantity || 0)
        - Number(beforeSalvage.resources.find((entry) => entry.template_id === row.template_id)?.quantity || 0);
      assert.equal(delta, expectedDelta, `Concurrent salvage duplicated ${row.template_id}`);
    }
    assert(!after.cars.some((entry) => entry.id === concurrentCar));
    assert(after.events > before.events);
    const success = responses.filter((response) => response.status === 'fulfilled');
    assert(success.filter((response) => response.value.replayed === false).length <= 1);
    check('eight PostgreSQL concurrent submissions, contention retry and one economic effect');

    const partialCar = await car();
    const partial = findCommand(await snapshot(), 'item.salvage', { carId: partialCar });
    const beforePartial = await economicState();
    await pool.query(`CREATE FUNCTION fail_command_item_event() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected item event failure'; END $$`);
    await pool.query('CREATE TRIGGER fail_command_item_event BEFORE INSERT ON item_events FOR EACH ROW EXECUTE FUNCTION fail_command_item_event()');
    try { await assert.rejects(() => executeIssued(engine, actor, partial), { code: 'P0001' }); }
    finally {
      await pool.query('DROP TRIGGER fail_command_item_event ON item_events');
      await pool.query('DROP FUNCTION fail_command_item_event()');
    }
    assert.deepEqual(await economicState(), beforePartial, 'native PostgreSQL rolls back all partial item effects and receipts');
    await executeIssued(engine, actor, partial);
    assert(!(await economicState()).cars.some((entry) => entry.id === partialCar));
    check('native domain partial failure rolls back and the original command safely retries');

    const feedbackCar = await car();
    const feedbackCommand = findCommand(await snapshot(), 'item.salvage', { carId: feedbackCar });
    await pool.query(`CREATE FUNCTION fail_command_projection() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected projection persistence failure'; END $$`);
    await pool.query('CREATE TRIGGER fail_command_projection BEFORE INSERT ON player_command_boards FOR EACH ROW EXECUTE FUNCTION fail_command_projection()');
    let feedbackFailed;
    try { feedbackFailed = await executeIssued(engine, actor, feedbackCommand); }
    finally {
      await pool.query('DROP TRIGGER fail_command_projection ON player_command_boards');
      await pool.query('DROP FUNCTION fail_command_projection()');
    }
    assert.equal(feedbackFailed.status, 'COMPLETED'); assert.equal(feedbackFailed.projection, null);
    assert.equal(feedbackFailed.feedback.refreshRequired, true);
    const committed = await economicState();
    const feedbackRetried = await executeIssued(engine, actor, feedbackCommand);
    assert.equal(feedbackRetried.replayed, true); assert(feedbackRetried.projection);
    assert.deepEqual(await economicState(), committed);
    check('post-commit projection failure reports committed success and reconciles without duplicate effects');

    for (const stage of ['snapshot', 'execution']) {
      const racingCar = await car();
      const racingCommand = findCommand(await snapshot(), 'item.salvage', { carId: racingCar });
      const beforeRace = await economicState();
      const beforeBoards = Number((await pool.query('SELECT count(*) AS n FROM player_command_boards')).rows[0].n);
      const heir = `command-${stage}-heir`; let injected = false, vehiclesRead = false;
      async function replaceCharacter() {
        injected = true;
        await pool.query('UPDATE characters SET alive=false WHERE id=$1', [characterId(actor)]);
        await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$1,1,'foundry')", [heir, actor]);
      }
      const racingPool = {
        async query(sql, parameters) {
          const result = await pool.query(sql, parameters);
          if (stage === 'execution' && vehiclesRead && !injected
            && sql === 'SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2') await replaceCharacter();
          return result;
        },
        async connect() {
          const client = await pool.connect();
          return { release: () => client.release(), async query(sql, parameters) {
            const result = await client.query(sql, parameters);
            if (String(sql).includes('FROM cars WHERE character_id=$1 AND model_id=')) {
              vehiclesRead = true;
              if (stage === 'snapshot' && !injected) await replaceCharacter();
            }
            return result;
          } };
        },
      };
      try {
        const racingEngine = engineFor(racingPool, content);
        if (stage === 'snapshot') await assert.rejects(() => racingEngine.snapshot(actor), { code: 'command_unavailable' });
        else await assert.rejects(() => executeIssued(racingEngine, actor, racingCommand), { code: 'crafting_unavailable' });
      } finally {
        await pool.query('UPDATE characters SET alive=false WHERE id=$1', [heir]);
        await pool.query('UPDATE characters SET alive=true WHERE id=$1', [characterId(actor)]);
      }
      assert.equal(injected, true); assert.deepEqual(await economicState(), beforeRace);
      assert.equal(Number((await pool.query('SELECT count(*) AS n FROM player_command_boards')).rows[0].n), beforeBoards);
      check(stage === 'snapshot' ? 'succession across composed snapshot reads refuses before any board is issued'
        : 'character replacement after final admission is denied by the locked native authority');
    }
  }

  await pool.end(); pool = database.reopen(); engine = engineFor(pool, content);
  const beforeRestartRetry = await economicState();
  const resumed = await executeIssued(engine, actor, salvage);
  assert.equal(resumed.replayed, true); assert.deepEqual(resumed.result, salvaged.result);
  assert.deepEqual(await economicState(), beforeRestartRetry);
  check('new database connection and engine restart preserve replay identity');

  if (postgres) {
    const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL);
    endpoint.searchParams.set('options', pool.options.options);
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import { buildServer } from './src/server.js';
      const app = await buildServer();
      try {
        const accountId = process.env.COMMAND_RESTART_ACCOUNT;
        const executionId = process.env.COMMAND_RESTART_ID;
        const token = app.jwt.sign({ sub: accountId, tv: 0 });
        const response = await app.inject({ method: 'POST', url: '/v1/commands/execute',
          headers: { authorization: 'Bearer ' + token, 'idempotency-key': executionId },
          payload: { executionId, confirmed: true } });
        const result = response.json();
        console.log('COMMAND_RESTART_RESULT ' + JSON.stringify({ statusCode: response.statusCode,
          status: result.status, replayed: result.replayed, executionId: result.executionId,
          locationId: result.projection?.player?.character?.locationId }));
      } finally { await app.close(); }
    `], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 45000,
      env: { ...process.env, DATABASE_URL: endpoint.toString(), COMMAND_RESTART_ACCOUNT: actor,
        COMMAND_RESTART_ID: salvage.executionIdentity.executionId, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on',
        COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on',
        COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
        JWT_SECRET: key() + key(), MARKET_SEED: key() + key(), MOD_KEY: key() + key(), SOCIAL_VERIFY_MODE: 'off' } });
    assert.equal(child.status, 0, child.error?.message || child.stderr || child.stdout);
    const output = child.stdout.split(/\r?\n/).find((line) => line.startsWith('COMMAND_RESTART_RESULT ')); assert(output);
    const restartedHttp = JSON.parse(output.slice('COMMAND_RESTART_RESULT '.length));
    assert.deepEqual(restartedHttp, { statusCode: 200, status: 'COMPLETED', replayed: true,
      executionId: salvage.executionIdentity.executionId, locationId: 'foundry' });
    assert.deepEqual(await economicState(), beforeRestartRetry);
    check('independent server process authenticates an HTTP replay against persisted PostgreSQL without new economic effects');

    const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
    await pool.query(schema); await pool.query(schema);
    const migrated = await executeIssued(engineFor(pool, content), actor, salvage);
    assert.equal(migrated.replayed, true); assert.deepEqual(migrated.result, salvaged.result);
    assert.deepEqual(await economicState(), beforeRestartRetry);
    check('populated PostgreSQL schema applies twice while preserving command and economic receipts');
  }

  for (let index = 0; index < 24; index++) await car();
  const bounded = await snapshot();
  assert.equal(bounded.vehicles.length, 20); assert.equal(bounded.vehiclesTruncated, true);
  assert(bounded.commands.length <= 128); assert(bounded.opportunities.length <= 80);
  assert(bounded.opportunities.every((entry, index, array) => index === 0 || array[index - 1].priority >= entry.priority));
  check('indexed entity window, command/opportunity caps and deterministic relevance ranking');
  console.log(`player-commands: ${passed.length} groups passed (${postgres ? 'PostgreSQL' : 'memory'})`);
} finally { await database.cleanup(pool); }
