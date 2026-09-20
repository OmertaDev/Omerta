// Reused from reviewed validation commit 36156ace3f4e4600badc8394a205d0e10432d227.
// Its historical results do not count: this harness must run at the candidate SHA.
// Real production entry points, real PostgreSQL barriers, real Linux SIGTERM.
// No source hooks or timer guesses. A blocked trigger proves the target SQL ran.
// Run only against a disposable local database; every scenario owns a schema.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const evidence = path.resolve(process.env.RC1_SHUTDOWN_EVIDENCE || 'docs/release/evidence/graceful-shutdown');
fs.mkdirSync(evidence, { recursive: true });
const report = { schemaVersion: 1, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  platform: process.platform, node: process.version, startedAt: new Date().toISOString(), scenarios: [], status: 'BLOCKED' };
const save = () => fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(report, null, 2) + '\n');
const probe = process.argv.includes('--probe-only');
if (process.platform !== 'linux' && !probe) {
  report.reason = 'Linux is required: Windows child.kill does not deliver POSIX SIGTERM.';
  save(); console.error(report.reason); process.exit(2);
}
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Set COORDINATION_TEST_DATABASE_URL to a disposable loopback PostgreSQL database');
const { campaignNetworkFixture } = await import('../test/lib/campaign-network-support.js');
const { findCommand, characterId } = await import('../test/lib/player-command-support.js');
const { createLivingWorldDirector } = await import('../src/director/runtime.js');
const { createCampaignNetworkDefinitions } = await import('../src/director/campaign-network.js');
const { familyOperationInvariants } = await import('../src/coordination/operation-invariants.js');
const { worldKernelInvariants } = await import('../src/world-kernel-invariants.js');
const { dayOf } = await import('../src/rules.js');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await check(); if (value) return value; await delay(50); }
  throw new Error(`Timeout waiting for ${label}`);
}
const sha = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const token = (account, secret) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: account, tv: 0, iat: Math.floor(Date.now() / 1000) })}`;
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`;
};
const physical = async (pool) => {
  const queries = {
    accounts: 'SELECT account_id,omr,staked,rewards,unbonding FROM account_persistent ORDER BY account_id',
    cash: 'SELECT id,cash,bank FROM characters ORDER BY id',
    inventory: 'SELECT * FROM item_instances ORDER BY id',
    resources: 'SELECT * FROM item_stacks ORDER BY owner_scope,owner_id,template_id,quality',
    provenance: 'SELECT * FROM item_events ORDER BY sequence',
    world: 'SELECT * FROM world_kernel_objects ORDER BY id',
    consequences: 'SELECT * FROM world_kernel_events ORDER BY object_id,revision',
    operations: "SELECT * FROM world_operations WHERE coordination_mode='family' ORDER BY id",
    commitments: 'SELECT * FROM world_operation_commitments ORDER BY operation_id,role_id,requirement_id',
  };
  const result = {};
  for (const [name, sql] of Object.entries(queries)) result[name] = (await pool.query(sql)).rows;
  return result;
};
const campaigns = async (pool) => {
  const result = {};
  for (const table of ['director_campaigns', 'director_situations', 'director_receipts', 'director_selections', 'director_clock'])
    result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY 1`)).rows;
  return result;
};
async function invariants(pool) {
  assert.deepEqual(await familyOperationInvariants(pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
  assert.deepEqual(await worldKernelInvariants(pool), { ok: true, issues: [] });
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM item_stacks WHERE quantity < 0')).rows[0].n, 0);
}

const scenarios = [
  { name: 'director-selection', kind: 'worker', table: 'director_selections', event: 'INSERT' },
  { name: 'campaign-progression', kind: 'worker', table: 'director_campaigns', event: 'UPDATE' },
  { name: 'world-kernel-mutation', table: 'world_kernel_objects', event: 'UPDATE' },
  { name: 'operation-resolution', table: 'world_operations', event: 'UPDATE', when: "NEW.status = 'completed'" },
  { name: 'item-consumption', table: 'item_instances', event: 'UPDATE', when: "NEW.state = 'consumed'" },
  { name: 'crafting', table: 'item_instances', event: 'INSERT', craft: true },
  { name: 'player-command', table: 'item_mutation_guards', event: 'UPDATE', when: 'NEW.result_json IS NOT NULL' },
  { name: 'consequence-generation', table: 'world_kernel_events', event: 'INSERT' },
  { name: 'scheduled-worker-processing', kind: 'scheduled', table: 'npc_wars', event: 'UPDATE', when: 'NEW.resolved = true' },
];

async function runScenario(spec, number) {
  const row = { name: spec.name, barrier: { table: spec.table, event: spec.event }, status: 'FAIL' };
  report.scenarios.push(row); save();
  const f = await campaignNetworkFixture(`rc1_shutdown_${number}`);
  const pool = f.pool, children = [];
  let blocker;
  const lockClass = 1901000 + number, targetKey = 1, heartbeatKey = 2;
  const namespace = (await pool.query('SELECT current_schema() AS name')).rows[0].name;
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
  const jwt = crypto.randomBytes(48).toString('hex');
  const env = { ...process.env, NODE_ENV: 'production', JWT_SECRET: jwt,
    MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'),
    SOCIAL_VERIFY_MODE: 'off', CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on',
    COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on',
    COORDINATION_ACCOUNT_IDS: Object.values(f.actors).join(','), DIRECTOR_ACCOUNT_IDS: Object.values(f.actors).join(','),
    LIVING_WORLD_DIRECTOR: 'LIMITED_COHORT', CHAIN_RPC_URL: '', CHAIN_ENABLED: 'off', INVITE_MODE: 'on',
    DRAIN_MS: '10000', PORT: String(18870 + number) };
  for (const name of ['RC1_SHUTDOWN_EVIDENCE', 'COORDINATION_TEST_DATABASE_URL', 'WORLD_KERNEL_TEST_DATABASE_URL']) delete env[name];
  for (const name of Object.keys(env)) if (/WEBHOOK|RPC_URL|PRIVATE_KEY/.test(name)) delete env[name];
  const origin = `http://127.0.0.1:${env.PORT}`;
  function child(kind) {
    const appName = `rc1_shutdown_${number}_${children.length}`;
    endpoint.searchParams.set('options', `-c search_path=${namespace} -c application_name=${appName} -c statement_timeout=15000 -c lock_timeout=8000 -c idle_in_transaction_session_timeout=30000`);
    const p = spawn(process.execPath, [`src/${kind}.js`], { env: { ...env, DATABASE_URL: endpoint.toString() }, stdio: ['ignore', 'pipe', 'pipe'] });
    const state = { p, appName, output: '', ended: null };
    children.push(state);
    for (const stream of [p.stdout, p.stderr]) stream.on('data', (data) => { state.output += data; });
    state.exit = new Promise((resolve) => p.once('exit', (code, signal) => { state.ended = { code, signal }; resolve(state.ended); }));
    p.once('error', (error) => { state.output += `\nSPAWN: ${error.message}`; });
    return state;
  }
  async function ready(p, marker) {
    await until(() => { assert(!p.ended, `Child exited before ${marker}: ${p.output}`); return p.output.includes(marker); }, marker);
  }
  const request = async (account, method, route, payload, executionId) => {
    const response = await fetch(origin + route, { method, headers: { authorization: `Bearer ${token(account, jwt)}`,
      'content-type': 'application/json', ...(executionId ? { 'idempotency-key': executionId } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(45000) });
    const body = await response.json();
    assert.equal(response.status, 200, `${method} ${route}: ${JSON.stringify(body)}`); return body;
  };
  async function trigger(name, table, event, key, when) {
    await pool.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      PERFORM pg_advisory_xact_lock(${lockClass}, ${key}); RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER ${name} AFTER ${event} ON ${table} FOR EACH ROW ${when ? `WHEN (${when})` : ''} EXECUTE FUNCTION ${name}()`);
  }
  async function waitBarrier() {
    const held = await until(async () => (await pool.query('SELECT pid FROM pg_locks WHERE locktype=\'advisory\' AND classid=$1 AND objid=$2 AND NOT granted', [lockClass, targetKey])).rows[0], `${spec.name} active SQL barrier`);
    row.blockedBackendPid = held.pid;
  }
  async function noLocks(p) {
    await until(async () => Number((await pool.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1', [p.appName])).rows[0].n) === 0,
      'terminated process sessions and locks released', 10000);
  }
  try {
    row.postgres = (await pool.query('SELECT version() AS version')).rows[0].version;
    // Initial account fixtures use season 1; production's separate season clock
    // must not reset them while the scenario targets another transaction.
    await pool.query('UPDATE characters SET season=$1', [Math.floor(dayOf() / 28)]);
    await f.networkEstablish();
    let operation;
    if (!spec.craft) operation = await f.networkPrepare('destroy_shipment');
    else await f.supplies(f.actors.aRunner, 2);
    if (spec.name === 'campaign-progression') {
      const director = createLivingWorldDirector({ pool, content: f.content, definitions: createCampaignNetworkDefinitions(f.content),
        // Populate via the same Director domain, then run the production cohort
        // mode. The distinct mode has its own tick replay domain, so a real
        // current-time tick can observe the committed operation immediately.
        mode: 'LIVE', accountIds: Object.values(f.actors) });
      assert((await director.tick()).selected.length > 0);
      await operation.command('organizer', 'execute');
    }
    if (spec.kind === 'scheduled') await pool.query(`INSERT INTO npc_wars(attacker_gang,npc_gang,ends_at,declared_by)
      VALUES($1,'zappa',now()-interval '1 minute',$2)`, [f.families.a.gangId, characterId(f.actors.aBoss)]);
    let first, command, account;
    if (!spec.kind) {
      first = child('server'); await ready(first, 'listening on');
      account = spec.craft ? f.actors.aRunner : operation.boss;
      const board = await request(account, 'GET', `/v1/commands${spec.craft ? '' : `?operationId=${operation.operationId}`}`);
      command = findCommand(board, spec.craft ? 'recipe.craft' : 'operation.execute', spec.craft ? { recipeId: f.ids.recipe } : { operationId: operation.operationId });
    }
    blocker = await pool.connect();
    await blocker.query('SELECT pg_advisory_lock($1,$2)', [lockClass, targetKey]);
    await trigger('rc1_target_barrier', spec.table, spec.event, targetKey, spec.when);
    if (spec.kind === 'worker') {
      // Keep unrelated hourly jobs behind their first write while the Director runs.
      await blocker.query('SELECT pg_advisory_lock($1,$2)', [lockClass, heartbeatKey]);
      await trigger('rc1_heartbeat_barrier', 'worker_heartbeat', 'UPDATE', heartbeatKey);
    }
    const before = await physical(pool), beforeCampaigns = await campaigns(pool);
    row.beforeHash = sha(before);
    let pending;
    if (spec.kind) first = child('worker');
    else {
      const executionId = command.executionIdentity.executionId;
      pending = request(account, 'POST', '/v1/commands/execute', { executionId, confirmed: true }, executionId);
      // The rejection is observed below; do not allow a network failure to become unhandled.
      pending.catch(() => {});
    }
    await waitBarrier();
    if (probe) {
      await blocker.query('SELECT pg_advisory_unlock($1,$2)', [lockClass, targetKey]);
      if (pending) assert.equal((await pending).status, 'COMPLETED');
      row.status = 'PROBE_ONLY'; row.note = 'SQL barrier reached; no Linux signal or recovery claim';
      return;
    }
    assert(first.p.kill('SIGTERM')); row.signal = 'SIGTERM';
    if (!spec.kind) {
      await ready(first, '[SIGTERM] draining');
      await blocker.query('SELECT pg_advisory_unlock($1,$2)', [lockClass, targetKey]);
      assert.equal((await pending).status, 'COMPLETED', 'in-flight HTTP command survives graceful drain');
      await until(() => first.ended, 'API drain exit', 15000);
      assert.deepEqual(first.ended, { code: 0, signal: null });
    } else {
      await until(() => first.ended, 'worker SIGTERM exit', 15000);
      assert.equal(first.ended.signal, 'SIGTERM');
      await noLocks(first);
      if (spec.kind === 'worker') {
        assert.deepEqual(await physical(pool), before, 'interrupted Director cannot mutate canonical resources');
        assert.deepEqual(await campaigns(pool), beforeCampaigns, 'all interrupted campaign writes roll back together');
      } else assert.equal((await pool.query('SELECT resolved FROM npc_wars WHERE attacker_gang=$1', [f.families.a.gangId])).rows[0].resolved, false);
      await blocker.query('SELECT pg_advisory_unlock($1,$2)', [lockClass, targetKey]);
    }
    await noLocks(first);
    await pool.query(`DROP TRIGGER rc1_target_barrier ON ${spec.table}`);
    await pool.query('DROP FUNCTION rc1_target_barrier()');
    const committed = await physical(pool);
    if (!spec.kind) {
      assert.notEqual(sha(committed), sha(before), 'the test must perform a real canonical mutation');
      const restarted = child('server'); await ready(restarted, 'listening on');
      const executionId = command.executionIdentity.executionId;
      const replay = await request(account, 'POST', '/v1/commands/execute', { executionId, confirmed: true }, executionId);
      assert.equal(replay.replayed, true);
      assert.deepEqual(await physical(pool), committed, 'restart replay cannot duplicate rewards, items, costs or world consequences');
      assert(restarted.p.kill('SIGTERM')); await until(() => restarted.ended, 'restarted API exit', 15000);
      assert.deepEqual(restarted.ended, { code: 0, signal: null });
      if (!spec.craft) assert.equal((await pool.query('SELECT count(*)::int AS n FROM world_kernel_events WHERE operation_id=$1', [operation.operationId])).rows[0].n, 1);
    } else {
      const restarted = child('worker');
      await until(async () => {
        assert(!restarted.ended, restarted.output);
        if (spec.kind === 'scheduled') return (await pool.query('SELECT resolved FROM npc_wars WHERE attacker_gang=$1', [f.families.a.gangId])).rows[0].resolved;
        return Number((await pool.query('SELECT count(*)::int AS n FROM director_selections')).rows[0].n) > beforeCampaigns.director_selections.length;
      }, 'recoverable work commits after restart');
      assert(restarted.p.kill('SIGTERM')); await until(() => restarted.ended, 'restarted worker exit', 15000); await noLocks(restarted);
      if (spec.kind === 'worker') assert.deepEqual(await physical(pool), before, 'Director recovery observes consequences without manufacturing resources');
      const recovered = await campaigns(pool);
      const again = child('worker');
      if (spec.kind === 'worker') await ready(again, '[director]');
      else await ready(again, 'vig + bond (real-value) invariants hold');
      assert(again.p.kill('SIGTERM')); await until(() => again.ended, 'duplicate worker exit', 15000); await noLocks(again);
      if (spec.kind === 'worker') {
        const repeated = await campaigns(pool);
        // A five-minute boundary may cross during startup; a fresh selection
        // receipt is legal, duplicate campaign transitions or resources are not.
        assert.deepEqual(repeated.director_campaigns, recovered.director_campaigns, 'second restart cannot duplicate campaign transitions');
        assert.deepEqual(repeated.director_situations, recovered.director_situations, 'second restart cannot duplicate situations or consequences');
        assert.deepEqual(await physical(pool), before, 'repeated observation leaves canonical state unchanged');
      }
    }
    await invariants(pool);
    row.afterHash = sha(await physical(pool)); row.status = 'PASS';
    console.log(`PASS ${spec.name}: barrier, SIGTERM, restart, replay and invariants`);
  } catch (error) { row.error = error.stack; throw error; }
  finally {
    for (const p of children) { if (!p.ended) p.p.kill('SIGKILL'); await p.exit; }
    if (blocker) { await blocker.query('SELECT pg_advisory_unlock_all()'); blocker.release(); }
    for (const [index, p] of children.entries()) fs.writeFileSync(path.join(evidence, `${spec.name}-${index}.log`), p.output);
    await f.cleanup(); save();
  }
}

try {
  const chosen = process.argv.find((arg) => arg.startsWith('--scenario='))?.slice('--scenario='.length);
  assert(!chosen || scenarios.some((entry) => entry.name === chosen), 'Unknown scenario');
  for (const [index, spec] of scenarios.entries()) if (!chosen || chosen === spec.name) await runScenario(spec, index);
  report.status = !probe && report.scenarios.length === scenarios.length && report.scenarios.every((entry) => entry.status === 'PASS') ? 'PASS' : 'BLOCKED';
  if (probe) report.reason = 'Probe validates setup only. Linux SIGTERM evidence remains required.';
} catch (error) { report.error = error.stack; console.error(error.stack); process.exitCode = 1; }
finally { report.finishedAt = new Date().toISOString(); save(); }
