// Scoped code upgrade/rollback rehearsal. Only a new loopback database is writable.
// The two source checkouts remain immutable; no existing database is restored over.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync, fork } from 'node:child_process';
import { Pool } from 'pg';
import { canonicalDatabaseSnapshot, canonicalJson, sha256 } from './rc1-native-proof.js';

const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const accounts = ['rc1-pair-predecessor', 'rc1-pair-candidate'];
const load = (file) => import(pathToFileURL(path.resolve(file)).href);
if (process.argv.includes('--child')) {
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
} else {
  const cwd = process.cwd();
  const previous = path.resolve(option('predecessor-directory') || '');
  assert(option('predecessor-directory'), '--predecessor-directory is required');
  const expectedPrevious = option('predecessor');
  assert(/^[a-f0-9]{40}$/.test(expectedPrevious || ''), '--predecessor must be a full Git SHA');
  const output = path.resolve(option('output') || '');
  assert(option('output'), '--output must identify new private storage outside both checkouts');
  for (const root of [cwd, previous]) {
    const relative = path.relative(await fs.realpath(root), output);
    assert(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Keep private evidence outside source checkouts');
  }
  const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
  async function identity(root) {
    assert.equal(git(root, 'status', '--porcelain', '--untracked-files=normal'), '', `Dirty source: ${root}`);
    const inventory = [];
    for (const file of git(root, 'ls-files', '-z').split('\0').filter(Boolean))
      inventory.push([file, sha256(await fs.readFile(path.join(root, file)))]);
    return { source: git(root, 'rev-parse', 'HEAD'), gitTree: git(root, 'rev-parse', 'HEAD^{tree}'),
      checkoutSha256: sha256(canonicalJson(inventory)), inventory,
      lockfileSha256: sha256(await fs.readFile(path.join(root, 'package-lock.json'))) };
  }
  const candidate = await identity(cwd), predecessor = await identity(previous);
  assert.equal(predecessor.source, expectedPrevious, 'Predecessor checkout mismatch');
  assert.equal(candidate.lockfileSha256, predecessor.lockfileSha256,
    'This rehearsal requires identical dependency lockfiles; install and attest separate dependencies otherwise');
  const endpoint = new URL(process.env.RC1_PAIR_DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Use a disposable loopback PostgreSQL instance');
  await fs.mkdir(output, { recursive: false, mode: 0o700 });
  const put = (name, value) => fs.writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const report = { format: 1, status: 'FAIL', scope: 'local fixture-assisted source-pair compatibility',
    candidate: candidate.source, predecessor: predecessor.source, startedAt: new Date().toISOString(),
    node: process.version, platform: process.platform, assertions: [],
    normalization: { excludedFields: ['schema_meta.applied_at'],
      excludedRows: 'Only world_command/completed/replayed:true telemetry observations matching an actual recorded replay, with empty consequences. Raw rows remain retained; non-replay telemetry remains compared.',
      reason: 'stampSchema updates this migration-observation timestamp on every bootstrap; schema hash and version remain compared.',
      retained: 'All other rows, values, sequences, generated IDs, deadlines, balances, state and receipts.' },
    receiptComparison: 'Compare durable result, execution identity, completion status and immediate result. The API recomputes projection/asOf and differential feedback on every replay; retain but do not require byte equality for that fresh view.',
    coverageExclusions: ['Not deployed Render recovery', 'No worker or Linux signal rehearsal in this tool',
      'Two fixture accounts and mystery.start only; not full resource or journey coverage',
      'No backup restore or recovery-point claim', 'Installed dependencies must independently match their lockfile'] };
  await put('candidate-source.json', candidate); await put('predecessor-source.json', predecessor);
  const admin = new Pool({ connectionString: endpoint.toString() });
  const database = `rc1_pair_${crypto.randomBytes(8).toString('hex')}`;
  await admin.query(`CREATE DATABASE ${database}`);
  endpoint.pathname = `/${database}`;
  const pool = new Pool({ connectionString: endpoint.toString() });
  report.database = { name: database, retainedForReproduction: true };
  const env = { ...process.env, DATABASE_URL: endpoint.toString(), RC1_PAIR_CHILD: 'isolated-loopback',
    NODE_ENV: 'test', JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'),
    MOD_KEY: crypto.randomBytes(32).toString('hex'), RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'on',
    CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on',
    COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '',
    LIVING_WORLD_DIRECTOR: 'DIRECTOR_DISABLED', CHAIN_ENABLED: 'off' };
  for (const key of Object.keys(env)) if (/WEBHOOK|RPC_URL|PRIVATE_KEY/.test(key)) delete env[key];
  await put('configuration.json', { flags: Object.fromEntries(Object.entries(env).filter(([key]) =>
    ['NODE_ENV', 'RATE_LIMIT', 'SOCIAL_VERIFY_MODE', 'INVITE_MODE', 'CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL',
      'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS',
      'LIVING_WORLD_DIRECTOR', 'CHAIN_ENABLED'].includes(key))),
    secrets: 'Fresh test-only random JWT_SECRET/MARKET_SEED/MOD_KEY shared across the four processes; values omitted',
    fixture: { accounts, helper: 'predecessor test/lib/player-command-support.js:addPlayer',
      measuredTransitions: 'Canonical HTTP Player Commands after initial fixtures' } });
  let running, count = 0;
  const children = [];
  async function start(root, fixture = false) {
    const label = `${++count}-${root === previous ? 'predecessor' : 'candidate'}`;
    const child = fork(fileURLToPath(import.meta.url), ['--child', ...(fixture ? ['--fixture'] : [])],
      { cwd: root, env, silent: true });
    let log = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { log += chunk; });
    const exit = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
    const state = { child, exit, label, log: () => log }; children.push(state); running = state;
    state.origin = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Bootstrap timed out: ${label}`)), 60000);
      child.once('message', ({ origin }) => { clearTimeout(timer); resolve(origin); });
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Bootstrap exited ${code}: ${log.slice(-3000)}`)); });
    });
    return state;
  }
  async function stop() {
    if (!running) return;
    const state = running; running = null;
    if (state.child.connected) state.child.send('close');
    const timer = setTimeout(() => state.child.kill(), 15000);
    const result = await state.exit; clearTimeout(timer);
    assert.equal(result.code, 0, `Child shutdown failed: ${state.label}`);
  }
  const token = (account) => {
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: account, tv: 0, iat: Math.floor(Date.now() / 1000) })}`;
    return `${body}.${crypto.createHmac('sha256', env.JWT_SECRET).update(body).digest('base64url')}`;
  };
  const request = async (account, method, route, payload, key) => {
    const response = await fetch(running.origin + route, { method,
      headers: { authorization: `Bearer ${token(account)}`, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(30000) });
    const value = await response.json(); assert.equal(response.status, 200, JSON.stringify(value)); return value;
  };
  const receipts = [], replays = [];
  async function execute(account) {
    const board = await request(account, 'GET', '/v1/commands');
    const command = board.commands.find((row) => row.commandType === 'mystery.start' && row.availability === 'AVAILABLE');
    assert(command, 'Expected ordinary issued mystery.start command');
    const key = command.executionIdentity.executionId, payload = { executionId: key, confirmed: true };
    const result = await request(account, 'POST', '/v1/commands/execute', payload, key);
    assert.equal(result.replayed, false);
    receipts.push({ account, key, payload, result });
    return result;
  }
  async function replayAll(label) {
    for (const receipt of receipts) {
      const result = await request(receipt.account, 'POST', '/v1/commands/execute', receipt.payload, receipt.key);
      assert.equal(result.replayed, true, label);
      replays.push({ label, account: receipt.account, result });
      for (const key of ['schemaVersion', 'executionId', 'status', 'result'])
        assert.deepEqual(result[key], receipt.result[key], `${label}: durable receipt ${key} changed`);
      assert.deepEqual(result.feedback.immediateResult, receipt.result.feedback.immediateResult, `${label}: completion feedback changed`);
    }
    report.assertions.push({ id: label, receipts: receipts.length, status: 'PASS' });
  }
  const normalized = (snapshot) => ({ tables: { ...snapshot.tables, schema_meta: snapshot.tables.schema_meta.map((row) =>
    row.replace(/("applied_at"\s*:\s*)"[^"]*"/, '$1"<bootstrap-observation>"')),
    telemetry: snapshot.tables.telemetry.filter((raw) => {
      const row = JSON.parse(raw), props = JSON.parse(row.props);
      if (row.event !== 'world_command' || props.phase !== 'completed' || props.replayed !== true) return true;
      assert(replays.some((replay) => replay.account === row.account_id && sha256(replay.result.executionId) === props.execution),
        'Unexplained replay observation');
      assert.deepEqual(props.consequences, [], 'Replay telemetry must not count a new consequence');
      return false;
    }) }, sequences: snapshot.sequences });
  async function snapshot(label) {
    if (running) await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Telemetry flush timed out')), 10000);
      running.child.once('message', (message) => { clearTimeout(timer); message === 'flushed' ? resolve() : reject(new Error('Invalid flush response')); });
      running.child.send('flush');
    });
    const raw = await canonicalDatabaseSnapshot(pool); await put(`${label}.json`, raw);
    const value = normalized(raw); const hash = sha256(canonicalJson(value));
    report.assertions.push({ id: label, stateSha256: hash, rawStateSha256: raw.stateSha256 }); return value;
  }
  const equal = (a, b, label) => {
    const changed = Object.keys(a.tables).filter((name) => canonicalJson(a.tables[name]) !== canonicalJson(b.tables[name]));
    assert(canonicalJson(a) === canonicalJson(b), `${label}; changed tables: ${changed.join(', ')}`);
    report.assertions.push({ id: label, status: 'PASS' });
  };
  try {
    report.postgres = (await pool.query('SELECT version() AS version')).rows[0].version;
    await start(previous, true); await snapshot('fixture'); await execute(accounts[0]);
    const oldCommitted = await snapshot('predecessor-committed'); await stop();
    await start(cwd); equal(oldCommitted, await snapshot('upgraded'), 'upgrade preserves acknowledged state');
    await replayAll('predecessor receipt after upgrade'); equal(oldCommitted, await snapshot('upgrade-replayed'), 'upgrade replay creates no new effect');
    await execute(accounts[1]); const newCommitted = await snapshot('candidate-committed'); await stop();
    await start(previous); equal(newCommitted, await snapshot('rolled-back'), 'rollback preserves acknowledged state');
    await replayAll('both receipts after rollback'); equal(newCommitted, await snapshot('rollback-replayed'), 'rollback replay creates no new effect'); await stop();
    await start(cwd); await replayAll('both receipts after second upgrade');
    equal(newCommitted, await snapshot('re-upgraded'), 'second upgrade preserves acknowledged state'); await stop();
    assert.deepEqual(await identity(cwd), candidate, 'Candidate bytes changed');
    assert.deepEqual(await identity(previous), predecessor, 'Predecessor bytes changed');
    report.status = 'PASS_SCOPED';
  } catch (error) {
    report.failure = { message: error.message.slice(0, 4000), stack: error.stack?.slice(0, 5000) }; process.exitCode = 1;
  } finally {
    try { await stop(); } catch (error) { report.shutdownFailure = error.message; report.status = 'FAIL'; process.exitCode = 1; }
    for (const child of children) await fs.writeFile(path.join(output, `${child.label}.log`), child.log(), { flag: 'wx', mode: 0o600 });
    await put('receipts.json', receipts); await put('replays.json', replays);
    await pool.end(); await admin.end(); report.endedAt = new Date().toISOString();
    report.durationMs = Date.parse(report.endedAt) - Date.parse(report.startedAt); await put('result.json', report);
    const files = (await fs.readdir(output)).sort(); const index = [];
    for (const file of files) index.push({ file, sha256: sha256(await fs.readFile(path.join(output, file))) });
    await put('sha256-index.json', index);
    console.log(JSON.stringify({ status: report.status, candidate: report.candidate, predecessor: report.predecessor,
      output, failure: report.failure?.message }));
  }
}
