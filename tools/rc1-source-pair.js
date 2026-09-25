// Scoped code upgrade/rollback rehearsal. Only a new loopback database is writable.
// The two source checkouts remain immutable; no existing database is restored over.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, fork } from 'node:child_process';
import { Pool } from 'pg';
import { canonicalDatabaseSnapshot, canonicalJson, sha256 } from './rc1-native-proof.js';
import { sourceInventory } from './rc1-qualification.mjs';

const option = (name, fallback) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? process.env[fallback];
const accounts = ['rc1-pair-predecessor', 'rc1-pair-candidate'];
const load = (file) => import(pathToFileURL(path.resolve(file)).href);
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const outside = (root, target) => { const relative = path.relative(root, target); return relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative); };

export async function sourcePairIdentity(root) {
  root = await fs.realpath(root);
  assert.equal(await fs.realpath(git(root, 'rev-parse', '--show-toplevel')), root, 'Use the Git checkout root');
  assert.equal(git(root, 'status', '--porcelain', '--untracked-files=normal'), '', `Dirty source: ${root}`);
  const source = git(root, 'rev-parse', 'HEAD'), prior = process.cwd();
  let expected;
  // sourceInventory performs synchronous Git calls. Restore cwd before any await.
  try { process.chdir(root); expected = sourceInventory(source); } finally { process.chdir(prior); }
  const sourceFiles = [];
  for (const file of expected.files) {
    const resolved = await fs.realpath(path.join(root, file.path));
    assert(!outside(root, resolved) && resolved !== root, `Source path escapes checkout: ${file.path}`);
    const actual = sha256(await fs.readFile(resolved));
    assert(file.accepted.includes(actual), `Source bytes differ from Git blob: ${file.path}`);
    sourceFiles.push({ ...file, sha256: actual });
  }
  const inventory = [];
  for (const file of git(root, 'ls-files', '-z').split('\0').filter(Boolean))
    inventory.push([file, sha256(await fs.readFile(path.join(root, file)))]);
  return { source, gitTree: expected.tree, checkoutSha256: sha256(canonicalJson(inventory)), inventory, sourceFiles,
    lockfileSha256: sha256(await fs.readFile(path.join(root, 'package-lock.json'))) };
}

// Only source-declared bootstrap differences are normalized. In particular a
// populated resident turn remains authority state and must compare exactly.
export function normalizeSourcePairBootstrap(snapshot, { schema, appVersion, predecessorSchema, candidateSchema }) {
  assert([predecessorSchema, candidateSchema].includes(schema), 'Snapshot schema is not one of the pinned source pair');
  const statement = 'ALTER TABLE population_state ADD COLUMN IF NOT EXISTS behaviour_turn JSONB;';
  const declaresTurn = text => text.replaceAll('\r\n', '\n').split('\n').includes(statement);
  const additiveTurn = !/\bbehaviour_turn\b/.test(predecessorSchema) && declaresTurn(candidateSchema);
  assert.equal(snapshot.tables.schema_meta.length, 1, 'Expected one source schema stamp');
  const stamp = JSON.parse(snapshot.tables.schema_meta[0]);
  assert.equal(stamp.id, 1); assert.equal(stamp.app_version, appVersion, 'Schema app version differs from booted source');
  assert.equal(stamp.schema_sha, sha256(schema).slice(0, 16), 'Schema stamp differs from booted source bytes');
  assert(typeof stamp.applied_at === 'string' && Number.isFinite(Date.parse(stamp.applied_at)), 'Invalid schema observation timestamp');
  stamp.schema_sha = '<validated-source-schema>'; stamp.applied_at = '<bootstrap-observation>';
  const population = snapshot.tables.population_state.map(raw => {
    const row = JSON.parse(raw);
    if (declaresTurn(schema)) assert(Object.hasOwn(row, 'behaviour_turn'), 'Declared resident turn column is missing');
    if (additiveTurn && Object.hasOwn(row, 'behaviour_turn') && row.behaviour_turn === null) delete row.behaviour_turn;
    return canonicalJson(row);
  });
  return { tables: { ...snapshot.tables, schema_meta: [canonicalJson(stamp)], population_state: population }, sequences: snapshot.sequences };
}

export async function createPrivateOutput(directory, roots) {
  const parent = await fs.realpath(path.dirname(path.resolve(directory)));
  const resolved = path.join(parent, path.basename(directory));
  const realRoots = await Promise.all(roots.map((root) => fs.realpath(root)));
  for (const root of realRoots) assert(outside(root, resolved), 'Keep private evidence outside source checkouts');
  await fs.mkdir(resolved, { recursive: false, mode: 0o700 });
  const real = await fs.realpath(resolved);
  for (const root of realRoots) assert(outside(root, real), 'Evidence path changed into a source checkout');
  assert.equal(real, resolved, 'Evidence path changed during creation');
  return real;
}

export function validateMysteryResult(result, key, replayed) {
  assert.match(key, /^[a-f0-9]{64}\.[a-f0-9]{64}$/);
  assert.equal(result?.schemaVersion, 1, 'Missing command schema');
  assert.equal(result.executionId, key, 'Response execution identity differs');
  assert.equal(result.status, 'COMPLETED', 'Command did not complete');
  assert.equal(result.replayed, replayed);
  assert(Object.hasOwn(result, 'result') && result.result !== null && typeof result.result === 'object'
    && !Array.isArray(result.result), 'Missing command result object');
  if (Object.hasOwn(result.result, 'instanceId')) assert.match(result.result.instanceId, /^[a-f0-9-]{36}$/, 'Invalid mystery instance');
  assert.equal(result.feedback?.immediateResult?.status, 'COMPLETED', 'Missing completion feedback');
  assert(typeof result.feedback.immediateResult.label === 'string' && result.feedback.immediateResult.label.length > 0);
}

export async function assertFreshMysteryStart(pool, account, graphId) {
  assert(typeof graphId === 'string' && graphId.length > 0);
  const rows = (await pool.query('SELECT id FROM mystery_instances WHERE authority_account_id=$1 AND graph_id=$2', [account, graphId])).rows;
  assert.equal(rows.length, 0, 'Fresh command must start with no matching mystery instance');
  return rows.length;
}

export async function assertDurableMystery(pool, receipt) {
  const { account, graphId, key, result } = receipt;
  assert(typeof graphId === 'string' && graphId.length > 0);
  const rows = (await pool.query('SELECT * FROM mystery_instances WHERE authority_account_id=$1 AND graph_id=$2', [account, graphId])).rows;
  assert.equal(rows.length, 1, 'Acknowledged command must create exactly one matching mystery instance');
  const instance = rows[0];
  if (Object.hasOwn(result.result, 'instanceId')) assert.equal(result.result.instanceId, instance.id, 'API mystery instance differs');
  assert.equal(instance.authority_account_id, account, 'Mystery authority differs');
  assert.equal(instance.graph_id, graphId, 'Mystery graph differs');
  assert.equal(instance.owner_scope, 'character');
  const owners = (await pool.query('SELECT id FROM characters WHERE id=$1 AND account_id=$2', [instance.owner_id, account])).rows;
  assert.equal(owners.length, 1, 'Mystery character is not owned by the actor');
  const guardKey = `player-command:${sha256(canonicalJson(key))}`;
  const guards = (await pool.query('SELECT * FROM item_mutation_guards WHERE idempotency_key=$1', [guardKey])).rows;
  assert.equal(guards.length, 1, 'Acknowledged durable mutation receipt is missing');
  const guard = guards[0];
  assert.equal(guard.mutation_kind, 'mystery_action');
  assert.equal(guard.owner_scope, 'character'); assert.equal(guard.owner_id, instance.owner_id);
  assert(guard.completed_at && guard.result_json, 'Mutation receipt is not complete');
  const durable = JSON.parse(guard.result_json);
  assert.equal(durable.ok, true); assert.equal(durable.instanceId, instance.id, 'Durable mystery instance differs');
  assert.deepEqual(durable.owner, { scope: instance.owner_scope, id: instance.owner_id }, 'Durable mystery owner differs');
  assert.equal(durable.graph?.id, instance.graph_id, 'Durable mystery graph differs');
  assert.equal(durable.graph.version, Number(instance.graph_version), 'Durable mystery graph version differs');
  return { instance, guard };
}

const waitFor = async (promise, ms) => {
  let timer;
  try { return await Promise.race([promise, new Promise((resolve) => { timer = setTimeout(() => resolve(null), ms); })]); }
  finally { clearTimeout(timer); }
};
export function stopSourcePairChild(state, { graceMs = 15000, termMs = 3000, killMs = 3000 } = {}) {
  if (state.stopping) return state.stopping;
  state.stopping = (async () => {
    if (state.child.connected) { try { state.child.send('close', () => {}); } catch { /* Exit will establish status. */ } }
    let result = await waitFor(state.exit, graceMs), forced = false;
    for (const [signal, timeout] of [['SIGTERM', termMs], ['SIGKILL', killMs]]) {
      if (result) break;
      forced = true; state.child.kill(signal); result = await waitFor(state.exit, timeout);
    }
    assert(result, `Child did not exit after SIGKILL: ${state.label}, pid=${state.child.pid}`);
    assert(!forced && result.code === 0 && result.signal === null,
      `Child shutdown failed: ${state.label}; forced=${forced}, code=${result.code}, signal=${result.signal}`);
    return result;
  })();
  return state.stopping;
}

async function childMain() {
  assert(process.send && process.env.RC1_PAIR_CHILD === 'isolated-loopback');
  const endpoint = new URL(process.env.DATABASE_URL);
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname));
  assert(/^\/rc1_pair_[a-f0-9]+$/.test(endpoint.pathname));
  const { buildServer } = await load('src/server.js');
  const app = await buildServer();
  if (process.argv.includes('--fixture')) {
    const { addPlayer } = await load('test/lib/player-command-support.js');
    for (const account of accounts) await addPlayer(app.pool, account);
  }
  const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  process.send({ origin });
  process.on('message', async (message) => {
    const { flushWorldTelemetry } = await load('src/world-telemetry.js');
    await flushWorldTelemetry(app.pool);
    if (message === 'flush') { process.send('flushed'); return; }
    assert.equal(message, 'close');
    await app.close(); await app.pool.end(); process.exit(0);
  });
}

export async function runSourcePair() {
  const cwd = await fs.realpath(process.cwd());
  const previousInput = option('predecessor-directory', 'RC1_PAIR_PREDECESSOR_DIRECTORY');
  const expectedPrevious = option('predecessor', 'RC1_PAIR_PREDECESSOR_SHA');
  const outputInput = option('output', 'RC1_PAIR_OUTPUT');
  assert(previousInput, '--predecessor-directory or RC1_PAIR_PREDECESSOR_DIRECTORY is required');
  assert(outputInput, '--output or RC1_PAIR_OUTPUT must identify new private storage');
  const previous = await fs.realpath(path.resolve(previousInput));
  const output = await createPrivateOutput(path.resolve(outputInput), [cwd, previous]);
  const put = (name, value) => syncFs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const update = (name, value) => {
    const temporary = path.join(output, `${name}.pending`);
    syncFs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
    syncFs.renameSync(temporary, path.join(output, name));
  };
  const report = { format: 1, status: 'RUNNING', scope: 'local fixture-assisted source-pair compatibility',
    phase: 'preflight', startedAt: new Date().toISOString(), node: process.version, platform: process.platform, assertions: [],
    arguments: { candidateDirectory: cwd, predecessorDirectory: previous, predecessor: expectedPrevious, output,
      supplied: { predecessorDirectory: previousInput, output: outputInput } },
    normalization: { excludedFields: ['schema_meta.applied_at'],
      validatedFields: ['schema_meta.schema_sha must equal the booted source schema bytes; app_version must equal its package version'],
      additiveFields: ['Only behaviour_turn:null may match an absent predecessor column, when the pinned predecessor has no declaration and the candidate has the exact nullable JSONB ADD COLUMN statement. Non-null turns remain compared.'],
      excludedRows: 'Only world_command/completed/replayed:true telemetry observations matching an actual recorded replay, with empty consequences. Raw rows remain retained; non-replay telemetry remains compared.',
      reason: 'stampSchema updates timestamp and source schema hash on bootstrap. Validate the source stamp before comparing data; retain both raw snapshots and source descriptors.',
      retained: 'All other rows, values, sequences, generated IDs, deadlines, balances, state and receipts.' },
    receiptComparison: 'Validate completed command schema and database instance/owner/graph/mutation receipt, then compare durable result, identity and immediate feedback. Fresh projection/asOf and differential feedback are retained but not byte-compared.',
    coverageExclusions: ['Not deployed Render recovery', 'No worker or Linux application-signal rehearsal in this tool',
      'Two fixture accounts and mystery.start only; not full resource or journey coverage',
      'No backup restore or recovery-point claim', 'Installed dependencies must independently match their lockfile'] };
  put('run-reserved.json', report); update('result.json', report);
  const event = (value) => syncFs.appendFileSync(path.join(output, 'history.jsonl'),
    JSON.stringify({ at: new Date().toISOString(), ...value }) + '\n', { mode: 0o600 });
  const phase = (value) => { report.phase = value; event({ phase: value }); update('result.json', report); };
  const receipts = [], replays = [], children = [];
  update('receipts.json', receipts); update('replays.json', replays);
  let candidate, predecessor, admin, pool, env, running, count = 0, requests = 0, hardStopTimer;
  const schemas = new Map();
  let predecessorSchema, candidateSchema;
  const abort = new AbortController();
  const interrupted = (promise) => {
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(abort.signal.reason);
      abort.signal.addEventListener('abort', onAbort, { once: true });
      Promise.resolve(promise).then(resolve, reject).finally(() => abort.signal.removeEventListener('abort', onAbort));
      if (abort.signal.aborted) onAbort();
    });
  };
  const failure = (error) => {
    report.status = 'FAIL'; process.exitCode = 1;
    report.failure ??= { message: String(error.message).slice(0, 4000), stack: error.stack?.slice(0, 5000) };
    update('result.json', report);
  };
  const onSignal = (signal) => {
    if (abort.signal.aborted) return;
    const error = new Error(`Source-pair interrupted by ${signal}`);
    report.interruptedBy = signal; failure(error); event({ signal }); abort.abort(error);
    for (const child of children) void stopSourcePairChild(child, { graceMs: 3000 }).catch(() => {});
    // Even a hung native call cannot keep an interrupted parent alive indefinitely.
    hardStopTimer = setTimeout(() => {
      report.hardStop = true; report.endedAt = new Date().toISOString(); report.status = 'FAIL';
      for (const child of children) { try { child.child.kill('SIGKILL'); } catch { /* Record PID below. */ } }
      report.children = children.map(({ label, child, result }) => ({ label, pid: child.pid, result: result || null }));
      update('result.json', report); process.exit(1);
    }, 30000);
  };
  const signalHandlers = Object.fromEntries(['SIGINT', 'SIGTERM'].map((signal) => [signal, () => onSignal(signal)]));
  for (const [signal, handler] of Object.entries(signalHandlers)) process.on(signal, handler);
  async function start(root, fixture = false) {
    abort.signal.throwIfAborted();
    const label = `${++count}-${root === previous ? 'predecessor' : 'candidate'}`;
    phase(`bootstrap-${label}`);
    const logPath = path.join(output, `${label}.log`);
    syncFs.writeFileSync(logPath, '', { flag: 'wx', mode: 0o600 });
    const child = fork(fileURLToPath(import.meta.url), ['--child', ...(fixture ? ['--fixture'] : [])], { cwd: root, env, silent: true });
    const state = { child, label, sourceRoot: root }; children.push(state); running = state;
    event({ kind: 'child-start', label, pid: child.pid, root, fixture });
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => syncFs.appendFileSync(logPath, chunk));
    state.exit = new Promise((resolve) => child.once('close', (code, signal) => {
      state.result = { code, signal }; event({ kind: 'child-exit', label, pid: child.pid, ...state.result }); resolve(state.result);
    }));
    state.origin = await interrupted(new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Bootstrap timed out: ${label}`)), 60000);
      const clear = () => { clearTimeout(timer); abort.signal.removeEventListener('abort', clear); };
      child.once('message', (message) => {
        clear();
        try { const url = new URL(message?.origin); assert.equal(url.hostname, '127.0.0.1'); resolve(url.origin); }
        catch (error) { reject(error); }
      });
      child.once('error', (error) => { clear(); reject(error); });
      child.once('exit', (code) => { clear(); reject(new Error(`Bootstrap exited ${code}: ${syncFs.readFileSync(logPath, 'utf8').slice(-3000)}`)); });
      abort.signal.addEventListener('abort', clear, { once: true });
    }));
    return state;
  }
  async function stop() {
    if (!running) return;
    const state = running; running = null; phase(`stop-${state.label}`);
    await stopSourcePairChild(state);
  }
  const token = (account) => {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: account, tv: 0, iat: Math.floor(Date.now() / 1000) })}`;
    return `${body}.${crypto.createHmac('sha256', env.JWT_SECRET).update(body).digest('base64url')}`;
  };
  const request = async (account, method, route, payload, key) => {
    abort.signal.throwIfAborted();
    const id = `request-${String(++requests).padStart(4, '0')}`;
    put(`${id}-start.json`, { account, method, route, payload, key, phase: report.phase, at: new Date().toISOString() });
    try {
      const response = await fetch(running.origin + route, { method,
        headers: { authorization: `Bearer ${token(account)}`, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
        ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]) });
      const body = await response.text();
      put(`${id}-response.json`, { status: response.status, body, at: new Date().toISOString() });
      assert.equal(response.status, 200, body);
      return JSON.parse(body);
    } catch (error) { put(`${id}-failure.json`, { message: error.message, at: new Date().toISOString() }); throw error; }
  };
  async function execute(account) {
    phase(`execute-${account}`);
    const board = await request(account, 'GET', '/v1/commands');
    const command = board.commands.find((row) => row.commandType === 'mystery.start' && row.availability === 'AVAILABLE');
    assert(command, 'Expected ordinary issued mystery.start command');
    const key = command.executionIdentity.executionId, payload = { executionId: key, confirmed: true };
    const graphId = command.parameters.graphId;
    const preCommandInstances = await interrupted(assertFreshMysteryStart(pool, account, graphId));
    put(`before-command-${receipts.length + 1}.json`, { account, graphId, preCommandInstances, key });
    const result = await request(account, 'POST', '/v1/commands/execute', payload, key);
    validateMysteryResult(result, key, false);
    const receipt = { account, graphId, preCommandInstances, key, payload, result };
    receipt.durable = await interrupted(assertDurableMystery(pool, receipt));
    receipts.push(receipt); update('receipts.json', receipts);
    return result;
  }
  async function replayAll(label) {
    phase(label);
    for (const receipt of receipts) {
      const result = await request(receipt.account, 'POST', '/v1/commands/execute', receipt.payload, receipt.key);
      replays.push({ label, account: receipt.account, result }); update('replays.json', replays);
      validateMysteryResult(result, receipt.key, true);
      const durable = await interrupted(assertDurableMystery(pool, { ...receipt, result }));
      assert.deepEqual(durable, receipt.durable, `${label}: durable database receipt changed`);
      for (const key of ['schemaVersion', 'executionId', 'status', 'result'])
        assert.deepEqual(result[key], receipt.result[key], `${label}: durable receipt ${key} changed`);
      assert.deepEqual(result.feedback.immediateResult, receipt.result.feedback.immediateResult, `${label}: completion feedback changed`);
    }
    report.assertions.push({ id: label, receipts: receipts.length, status: 'PASS' }); update('result.json', report);
  }
  const normalized = (snapshot) => {
    assert(running && schemas.has(running.sourceRoot), 'Missing active source schema binding');
    const value = normalizeSourcePairBootstrap(snapshot, { ...schemas.get(running.sourceRoot), predecessorSchema, candidateSchema });
    value.tables.telemetry = snapshot.tables.telemetry.filter((raw) => {
      const row = JSON.parse(raw), props = JSON.parse(row.props);
      if (row.event !== 'world_command' || props.phase !== 'completed' || props.replayed !== true) return true;
      assert(replays.some((replay) => replay.account === row.account_id && sha256(replay.result.executionId) === props.execution), 'Unexplained replay observation');
      assert.deepEqual(props.consequences, [], 'Replay telemetry must not count a new consequence'); return false;
    });
    return value;
  };
  async function snapshot(label) {
    phase(label);
    if (running) await interrupted(new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Telemetry flush timed out')), 10000);
      const clear = () => { clearTimeout(timer); abort.signal.removeEventListener('abort', clear); };
      running.child.once('message', (message) => { clear(); message === 'flushed' ? resolve() : reject(new Error('Invalid flush response')); });
      running.child.send('flush', (error) => { if (error) { clear(); reject(error); } });
      abort.signal.addEventListener('abort', clear, { once: true });
    }));
    const raw = await interrupted(canonicalDatabaseSnapshot(pool)); put(`${label}.json`, raw);
    const value = normalized(raw), hash = sha256(canonicalJson(value));
    report.assertions.push({ id: label, stateSha256: hash, rawStateSha256: raw.stateSha256 }); update('result.json', report); return value;
  }
  const equal = (a, b, label) => {
    const changed = Object.keys(a.tables).filter((name) => canonicalJson(a.tables[name]) !== canonicalJson(b.tables[name]));
    assert(canonicalJson(a) === canonicalJson(b), `${label}; changed tables: ${changed.join(', ')}`);
    report.assertions.push({ id: label, status: 'PASS' }); update('result.json', report);
  };
  try {
    assert(/^[a-f0-9]{40}$/.test(expectedPrevious || ''), '--predecessor must be a full Git SHA');
    candidate = await interrupted(sourcePairIdentity(cwd)); predecessor = await interrupted(sourcePairIdentity(previous));
    report.candidate = candidate.source; report.predecessor = predecessor.source;
    put('candidate-source.json', candidate); put('predecessor-source.json', predecessor);
    assert.equal(predecessor.source, expectedPrevious, 'Predecessor checkout mismatch');
    assert.equal(candidate.lockfileSha256, predecessor.lockfileSha256, 'This rehearsal requires identical dependency lockfiles; install and attest separate dependencies otherwise');
    const endpoint = new URL(process.env.RC1_PAIR_DATABASE_URL || '');
    assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Use a disposable loopback PostgreSQL instance');
    admin = new Pool({ connectionString: endpoint.toString(), connectionTimeoutMillis: 5000, query_timeout: 20000 });
    const database = `rc1_pair_${crypto.randomBytes(8).toString('hex')}`;
    report.database = { name: database, created: 'unknown until CREATE acknowledgement', retainedForReproduction: true };
    phase('create-database');
    await interrupted(admin.query(`CREATE DATABASE ${database}`)); report.database.created = true;
    endpoint.pathname = `/${database}`;
    pool = new Pool({ connectionString: endpoint.toString(), connectionTimeoutMillis: 5000, query_timeout: 20000 });
    env = { ...process.env, DATABASE_URL: endpoint.toString(), RC1_PAIR_CHILD: 'isolated-loopback',
      NODE_ENV: 'test', JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'),
      MOD_KEY: crypto.randomBytes(32).toString('hex'), RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'on',
      CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on',
      COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
      LIVING_WORLD_DIRECTOR: 'DIRECTOR_DISABLED', CHAIN_ENABLED: 'off' };
    for (const key of Object.keys(env)) if (/WEBHOOK|RPC_URL|PRIVATE_KEY/.test(key)) delete env[key];
    put('configuration.json', { arguments: report.arguments, candidate: candidate.source, predecessor: predecessor.source,
      database: { host: endpoint.hostname, port: endpoint.port || '5432', name: database },
      flags: Object.fromEntries(Object.entries(env).filter(([key]) =>
        ['NODE_ENV', 'RATE_LIMIT', 'SOCIAL_VERIFY_MODE', 'INVITE_MODE', 'CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL',
          'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS',
          'LIVING_WORLD_DIRECTOR', 'CHAIN_ENABLED'].includes(key))),
      secrets: 'Fresh test-only random JWT_SECRET/MARKET_SEED/MOD_KEY shared across the four processes; values omitted',
      fixture: { accounts, helper: 'predecessor test/lib/player-command-support.js:addPlayer', measuredTransitions: 'Canonical HTTP Player Commands after initial fixtures' } });
    report.postgres = (await interrupted(pool.query('SELECT version() AS version'))).rows[0].version;
    for (const [root, identity] of [[previous, predecessor], [cwd, candidate]]) {
      const schema = await fs.readFile(path.join(root, 'schema.sql'), 'utf8');
      const packageBytes = await fs.readFile(path.join(root, 'package.json'));
      assert.equal(sha256(schema), identity.inventory.find(([file]) => file === 'schema.sql')?.[1], 'Schema source bytes changed');
      assert.equal(sha256(packageBytes), identity.inventory.find(([file]) => file === 'package.json')?.[1], 'Package source bytes changed');
      schemas.set(root, { schema, appVersion: JSON.parse(packageBytes).version || '0.0.0' });
    }
    predecessorSchema = schemas.get(previous).schema; candidateSchema = schemas.get(cwd).schema;
    put('schema-comparison.json', { predecessor: { source: predecessor.source, schemaSha256: sha256(predecessorSchema), appVersion: schemas.get(previous).appVersion },
      candidate: { source: candidate.source, schemaSha256: sha256(candidateSchema), appVersion: schemas.get(cwd).appVersion }, normalization: report.normalization });
    await start(previous, true); await snapshot('fixture'); await execute(accounts[0]);
    const oldCommitted = await snapshot('predecessor-committed'); await stop();
    await start(cwd); equal(oldCommitted, await snapshot('upgraded'), 'upgrade preserves acknowledged state');
    await replayAll('predecessor receipt after upgrade'); equal(oldCommitted, await snapshot('upgrade-replayed'), 'upgrade replay creates no new effect');
    await execute(accounts[1]); const newCommitted = await snapshot('candidate-committed'); await stop();
    await start(previous); equal(newCommitted, await snapshot('rolled-back'), 'rollback preserves acknowledged state');
    await replayAll('both receipts after rollback'); equal(newCommitted, await snapshot('rollback-replayed'), 'rollback replay creates no new effect'); await stop();
    await start(cwd); await replayAll('both receipts after second upgrade');
    equal(newCommitted, await snapshot('re-upgraded'), 'second upgrade preserves acknowledged state'); await stop();
    assert.deepEqual(await interrupted(sourcePairIdentity(cwd)), candidate, 'Candidate bytes changed');
    assert.deepEqual(await interrupted(sourcePairIdentity(previous)), predecessor, 'Predecessor bytes changed');
    abort.signal.throwIfAborted(); report.status = 'PASS_SCOPED';
  } catch (error) { failure(error); }
  finally {
    for (const child of children) {
      try { await stopSourcePairChild(child); }
      catch (error) { report.shutdownFailures ??= []; report.shutdownFailures.push(error.message); failure(error); }
    }
    for (const connection of [pool, admin].filter(Boolean)) {
      try { assert(await waitFor(connection.end().then(() => true), 5000), 'Database close timed out'); }
      catch (error) { failure(error); }
    }
    report.children = children.map(({ label, child, result }) => ({ label, pid: child.pid, result: result || null }));
    report.endedAt = new Date().toISOString(); report.durationMs = Date.parse(report.endedAt) - Date.parse(report.startedAt);
    if (report.status === 'RUNNING') report.status = 'FAIL';
    event({ kind: 'finished', status: report.status }); update('result.json', report);
    const index = [];
    for (const file of (await fs.readdir(output)).sort()) index.push({ file, sha256: sha256(await fs.readFile(path.join(output, file))) });
    put('sha256-index.json', index);
    clearTimeout(hardStopTimer);
    for (const [signal, handler] of Object.entries(signalHandlers)) process.removeListener(signal, handler);
    console.log(JSON.stringify({ status: report.status, candidate: report.candidate, predecessor: report.predecessor, output, failure: report.failure?.message }));
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--child')) await childMain();
  else { await runSourcePair(); if (process.exitCode) process.exit(process.exitCode); }
}
