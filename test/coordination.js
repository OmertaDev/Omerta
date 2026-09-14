// In-memory integration proofs, plus explicit --postgres mode for real locks/rollback.
// This test never reads DATABASE_URL or connects to the live game.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { newDb, DataType } from 'pg-mem';
import { dbCaps, registerPgMemCompatibility } from '../src/db.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { createCoordinationRegistry, coordinationGraphs } from '../src/coordination/graph.js';
import { COORDINATION_PILOT } from '../src/coordination/pilot.js';

const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
let pool, cleanup;
if (process.argv.includes('--postgres')) {
  assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
  const { Pool } = await import('pg');
  const base = new Pool({ connectionString: endpoint.toString() });
  const namespace = `coordination_test_${crypto.randomBytes(8).toString('hex')}`;
  await base.query(`CREATE SCHEMA ${namespace}`);
  pool = new Pool({ connectionString: endpoint.toString(), options: `-c search_path=${namespace}` });
  cleanup = async () => { await pool.end(); await base.query(`DROP SCHEMA ${namespace} CASCADE`); await base.end(); };
  dbCaps.skipLocked = true;
} else {
  const mem = newDb({ noAstCoverageCheck: true });
  registerPgMemCompatibility(mem, DataType);
  const { Pool } = mem.adapters.createPg(); pool = new Pool();
  cleanup = () => pool.end(); dbCaps.skipLocked = false;
}

const tables = ['coordination_definitions', 'coordination_instances', 'coordination_events', 'coordination_commands'];
const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async (table) =>
  [table, (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
const rejects = (promise, code) => assert.rejects(promise, (error) => error.code === code, code);
const key = () => crypto.randomUUID();
const { contentHash: pilotHash, ...pilotSource } = coordinationGraphs(COORDINATION_PILOT)[0];
const service = (options = {}) => createCoordinationService({ pool, registry: COORDINATION_PILOT, enabled: true, ...options });
const player = async (id) => {
  await pool.query('INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ($1,$2,$3)', [id, 'test', id]);
  await pool.query('INSERT INTO characters (id, account_id, name, season) VALUES ($1,$2,$3,1)', [`${id}-ch`, id, id]);
  return id;
};
const start = (api, account, id = pilotSource.id, contentHash = pilotHash, idem = key()) =>
  api.create(account, id, { expectedContentHash: contentHash }, idem);
const act = (api, account, view, action, idem = key()) => api.act(account, view.id,
  { expectedRevision: view.revision, actionId: action.id }, idem);
const advance = (api, account, view, action = view.actions[0]) => act(api, account, view, action).then((result) => result.instance);

// A driver wrapper that fails before the Nth write; successful writes still register
// their inverses. A definitive failed COMMIT checks rollback after the final write.
function faultPool(nth, { loseCommit = false } = {}) {
  let writes = 0, fired = false;
  return { query: (...args) => pool.query(...args), async connect() {
    const client = await pool.connect();
    return { release: (...args) => client.release(...args), async query(sql, args) {
      if (!fired && (/^(INSERT|UPDATE|DELETE)\b/.test(sql.trim()) || sql === 'COMMIT')) {
        writes++;
        if (writes === nth || (loseCommit && sql === 'COMMIT')) {
          fired = true;
          if (loseCommit) { await client.query(sql, args); throw Error('lost commit acknowledgement'); }
          throw Object.assign(Error('injected rollback'), { code: '40001' });
        }
      }
      return client.query(sql, args);
    } };
  } };
}

try {
  await pool.query(schema);
  await pool.query(schema); // additive reapplication must preserve the new schema too.
  const a = await player('coord-a'), b = await player('coord-b');
  const api = service(), off = service({ enabled: false });
  const beforeEconomic = await pool.query('SELECT * FROM characters ORDER BY id');
  assert.deepEqual((await off.catalog(a)).graphs, []);
  await rejects(start(off, a), 'coordination_disabled');
  await rejects(start(service({ accountIds: [b] }), a), 'coordination_disabled');
  const createKey = key();
  let run = (await start(api, a, pilotSource.id, pilotHash, createKey)).instance;
  assert.equal(run.revision, 0);
  assert.equal(run.nodes.length, 1);
  assert.equal(run.nodes[0].id, 'envelope');
  for (const hidden of ['tide', 'seal', 'conclusion', 'owner_account_id', 'owner_character_id', 'requires', 'discover']) {
    assert(!JSON.stringify(run).includes(`"${hidden}"`), `${hidden} must not leak`);
  }
  const afterCreate = await snapshot();
  assert.equal((await start(api, a, pilotSource.id, pilotHash, createKey)).replayed, true);
  assert.deepEqual(await snapshot(), afterCreate);
  assert.equal((await start(api, a)).instance.id, run.id, 'one run per character and graph across keys');
  await rejects(api.get(b, run.id), 'coordination_unavailable');
  await rejects(api.get(b, 'invented'), 'coordination_unavailable');
  await rejects(api.cancel(b, run.id, { expectedRevision: 0 }, key()), 'coordination_unavailable');
  await rejects(api.act(a, run.id, { expectedRevision: 0, actionId: 'hidden-or-forged' }, key()), 'coordination_action_unavailable');
  await rejects(api.act(a, run.id, { expectedRevision: '0', actionId: run.actions[0].id }, key()), 'bad_coordination_request');
  await rejects(api.act(a, run.id, { expectedRevision: 0, actionId: run.actions[0].id, ownerId: b }, key()), 'bad_coordination_request');
  const actionKey = key(), initial = run;
  run = await advance(api, a, run);
  assert.equal(run.actions.filter((action) => action.kind === 'discover').length, 2);
  assert.equal(run.nodes.length, 1, 'discoverable hidden nodes stay hidden until acted on');
  await rejects(act(api, a, initial, initial.actions[0]), 'stale_coordination');
  const outcomes = await Promise.allSettled([
    act(api, a, run, run.actions[0], actionKey), act(api, a, run, run.actions[1]),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find((result) => result.status === 'rejected').reason.code, 'stale_coordination');
  const success = outcomes.find((result) => result.status === 'fulfilled').value;
  if (outcomes[0].status === 'fulfilled') {
    const snap = await snapshot();
    const replay = await act(api, a, run, run.actions[0], actionKey);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.instance, success.instance);
    assert.deepEqual(await snapshot(), snap);
    await rejects(act(api, a, run, run.actions[1], actionKey), 'coordination_key_reuse');
  }
  run = success.instance;
  while (run.status === 'active') {
    assert(run.actions.length, 'pilot must remain solvable');
    run = await advance(api, a, run);
  }
  assert.equal(run.status, 'completed'); assert.deepEqual(run.actions, []);
  const events = (await pool.query('SELECT * FROM coordination_events WHERE instance_id=$1 ORDER BY revision, ordinal', [run.id])).rows;
  assert.equal(events.filter((event) => event.event_type === 'coordination.completed').length, 1);
  assert.equal(events.length, 9, 'create + 3 discoveries + 4 completions + terminal lifecycle');
  assert.equal(new Set(events.map((event) => `${event.revision}:${event.ordinal}`)).size, events.length);
  for (const event of events) {
    assert.equal(event.content_hash, pilotHash); assert.equal(event.event_version, 1);
    const receipt = (await pool.query('SELECT * FROM coordination_commands WHERE command_id=$1', [event.correlation_id])).rows;
    assert.equal(receipt.length, 1, 'each event has one atomically stored command receipt');
  }
  assert.deepEqual((await pool.query('SELECT * FROM characters ORDER BY id')).rows, beforeEconomic.rows,
    'coordination does not accrue or change any character/economic state');
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM transactions')).rows[0].n), 0);
  assert.equal((await api.metrics()).events.find((event) => event.type === 'coordination.completed').total, 1);

  // Historical authority survives replacement only for read and cancellation.
  let other = (await start(api, b)).instance;
  await pool.query('UPDATE characters SET alive=false WHERE account_id=$1', [b]);
  assert.equal((await api.get(b, other.id)).historical, true);
  await rejects(act(api, b, other, other.actions[0]), 'coordination_unavailable');
  await pool.query('INSERT INTO characters (id, account_id, name, season) VALUES ($1,$2,$3,1)', ['coord-b-heir', b, 'Heir']);
  const historical = await off.get(b, other.id);
  assert.equal(historical.historical, true); assert.deepEqual(historical.actions, []);
  other = (await off.cancel(b, other.id, { expectedRevision: other.revision }, key())).instance;
  assert.equal(other.status, 'cancelled');
  const history = (await pool.query('SELECT * FROM coordination_instances WHERE id=$1', [other.id])).rows[0];
  assert.equal(history.owner_character_id, 'coord-b-ch');
  assert.equal((await pool.query("SELECT actor_character_id FROM coordination_events WHERE instance_id=$1 AND event_type='coordination.cancelled'", [other.id])).rows[0].actor_character_id, 'coord-b-heir');

  // Pinned definitions survive a service restart, successor registry and retirement.
  const c = await player('coord-c');
  const old = (await start(api, c)).instance;
  const v2 = createCoordinationRegistry([{ ...pilotSource, version: 2, title: 'Successor definition' }]);
  const successor = service({ registry: v2 });
  assert.equal((await successor.get(c, old.id)).graphVersion, 1);
  assert.equal((await advance(successor, c, old)).graphVersion, 1);
  const retired = service({ registry: createCoordinationRegistry([{ ...pilotSource, id: 'different-graph' }]) });
  assert.equal((await retired.get(c, old.id)).contentHash, pilotHash);
  await rejects(start(retired, c), 'coordination_unavailable');
  const changed = service({ registry: createCoordinationRegistry([{ ...pilotSource, title: 'Illegal replacement' }]) });
  const d = await player('coord-d');
  await rejects(start(changed, d, pilotSource.id, (await changed.catalog(d)).graphs[0].contentHash), 'coordination_version_conflict');

  // Server-derived level/location/time gates cannot be nominated by the request.
  const timedSource = { ...pilotSource, id: 'coordination-timed', nodes: [{
    id: 'finish', kind: 'terminal', title: 'Check the appointment', visibility: 'public',
    discover: { kind: 'always' }, requires: { kind: 'all', rules: [
      { kind: 'level_at_least', level: 2 }, { kind: 'at_district', districtId: 'foundry' },
      { kind: 'elapsed_at_least', seconds: 60 },
    ] },
  }] };
  const gated = service({ registry: createCoordinationRegistry([timedSource]) });
  let appointment = (await start(gated, d, timedSource.id, (await gated.catalog(d)).graphs[0].contentHash)).instance;
  assert.equal(appointment.actions.length, 0);
  await pool.query("UPDATE characters SET respect=10000, loc='foundry' WHERE account_id=$1", [d]);
  assert.equal((await gated.get(d, appointment.id)).actions.length, 0);
  await pool.query('UPDATE coordination_instances SET created_at=$2 WHERE id=$1', [appointment.id, new Date(Date.now() - 61_000)]);
  appointment = await gated.get(d, appointment.id);
  assert.equal(appointment.actions.length, 1);

  // Every create write/commit boundary rolls back exactly, including pg-mem inverses.
  for (let step = 1; step <= 5; step++) {
    const source = { ...pilotSource, id: `coordination-fault-${step}` };
    const registry = createCoordinationRegistry([source]), account = await player(`fault-${step}`);
    const faulty = service({ registry, pool: faultPool(step) });
    const snap = await snapshot();
    await rejects(start(faulty, account, source.id, coordinationGraphs(registry)[0].contentHash), 'contention');
    assert.deepEqual(await snapshot(), snap, `create write boundary ${step} restored exactly`);
  }
  for (let step = 1; step <= 5; step++) {
    // Terminal action has update, node event, lifecycle event, receipt, commit.
    const faulty = service({ registry: createCoordinationRegistry([timedSource]), pool: faultPool(step) });
    const snap = await snapshot();
    await rejects(act(faulty, d, appointment, appointment.actions[0]), 'contention');
    assert.deepEqual(await snapshot(), snap, `completion write boundary ${step} restored exactly`);
  }
  const lostKey = key(), faulty = service({ registry: createCoordinationRegistry([timedSource]), pool: faultPool(Infinity, { loseCommit: true }) });
  await rejects(act(faulty, d, appointment, appointment.actions[0], lostKey), 'content_commit_unknown');
  const committed = await snapshot();
  assert.equal((await act(gated, d, appointment, appointment.actions[0], lostKey)).replayed, true);
  assert.deepEqual(await snapshot(), committed, 'ambiguous commit resolves by receipt without re-execution');
  console.log(`coordination: ${dbCaps.skipLocked ? 'PostgreSQL' : 'pg-mem'} journey, visibility, replay, races, pins, historical recovery, zero-value and 10 rollback boundaries pass`);
} finally { await cleanup(); }
