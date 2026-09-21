// Negative controls for source-pair evidence; temporary Git repositories only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync, fork } from 'node:child_process';
import { sourcePairIdentity, createPrivateOutput, validateMysteryResult, assertDurableMystery,
  stopSourcePairChild } from '../tools/rc1-source-pair.js';

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'omerta-pair-controls-'));
const repo = path.join(temporary, 'candidate'), previous = path.join(temporary, 'predecessor');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
let checks = 0;
const pass = () => checks++;
try {
  await fs.mkdir(path.join(repo, 'src'), { recursive: true });
  await fs.writeFile(path.join(repo, 'package-lock.json'), '{}\n');
  await fs.writeFile(path.join(repo, 'src/server.js'), 'export const version = 1;\n');
  git('init', '-q'); git('config', 'user.name', 'RC1 fixture'); git('config', 'user.email', 'rc1@example.invalid');
  git('config', 'core.autocrlf', 'false'); git('add', '.'); git('commit', '-qm', 'predecessor');
  const predecessor = git('rev-parse', 'HEAD');
  git('worktree', 'add', '--detach', previous, predecessor);
  await fs.writeFile(path.join(repo, 'src/server.js'), 'export const version = 2;\n');
  git('add', '.'); git('commit', '-qm', 'candidate');
  const identity = await sourcePairIdentity(repo);
  assert.equal(identity.source, git('rev-parse', 'HEAD')); assert(identity.sourceFiles.every((entry) => entry.accepted.includes(entry.sha256))); pass();
  git('update-index', '--assume-unchanged', 'src/server.js');
  await fs.writeFile(path.join(repo, 'src/server.js'), 'export const version = "uncommitted";\n');
  assert.equal(git('status', '--porcelain'), '');
  await assert.rejects(sourcePairIdentity(repo), /Source bytes differ from Git blob/); pass();
  await fs.writeFile(path.join(repo, 'src/server.js'), 'export const version = 2;\n');
  git('update-index', '--no-assume-unchanged', 'src/server.js');
  const alias = path.join(temporary, 'external-alias');
  await fs.symlink(repo, alias, 'junction');
  await assert.rejects(createPrivateOutput(path.join(alias, 'private-evidence'), [repo, previous]), /outside source checkouts/); pass();
  const allowed = await createPrivateOutput(path.join(temporary, 'private-evidence'), [repo, previous]);
  assert.equal(allowed, await fs.realpath(path.join(temporary, 'private-evidence'))); pass();
  await assert.rejects(createPrivateOutput(allowed, [repo, previous]), /EEXIST/); pass();

  const key = `${'a'.repeat(64)}.${'b'.repeat(64)}`, instanceId = crypto.randomUUID();
  const result = { schemaVersion: 1, executionId: key, status: 'COMPLETED', replayed: false,
    result: { instanceId }, feedback: { immediateResult: { status: 'COMPLETED', label: 'Open fixture' } } };
  validateMysteryResult(result, key, false); pass();
  for (const change of [{ schemaVersion: undefined }, { executionId: 'other' }, { status: undefined },
    { result: {} }, { feedback: {} }, { replayed: true }]) {
    assert.throws(() => validateMysteryResult({ ...result, ...change }, key, false)); pass();
  }
  assert.throws(() => validateMysteryResult({ replayed: false, feedback: {} }, key, false)); pass();
  const instance = { id: instanceId, authority_account_id: 'actor', graph_id: 'graph', owner_scope: 'character', owner_id: 'character' };
  const guard = { mutation_kind: 'mystery_action', owner_scope: 'character', owner_id: 'character',
    completed_at: '2026-01-01T00:00:00Z', result_json: JSON.stringify({ ok: true, instance: { id: instanceId } }) };
  const fakePool = (overrides = {}) => ({ async query(sql, params) {
    if (sql.includes('mystery_instances')) return { rows: overrides.instances ?? [instance] };
    if (sql.includes('characters')) return { rows: overrides.owners ?? [{ id: 'character' }] };
    assert.equal(params[0], `player-command:${crypto.createHash('sha256').update(JSON.stringify(key)).digest('hex')}`);
    return { rows: overrides.guards ?? [guard] };
  } });
  const receipt = { account: 'actor', graphId: 'graph', key, result };
  await assertDurableMystery(fakePool(), receipt); pass();
  for (const changes of [{ instances: [] }, { instances: [{ ...instance, authority_account_id: 'other' }] },
    { instances: [{ ...instance, graph_id: 'other' }] }, { owners: [] }, { guards: [] },
    { guards: [{ ...guard, completed_at: null }] },
    { guards: [{ ...guard, result_json: JSON.stringify({ ok: true, instance: { id: crypto.randomUUID() } }) }] }]) {
    await assert.rejects(assertDurableMystery(fakePool(changes), receipt)); pass();
  }

  const childFile = path.join(temporary, 'stubborn.cjs');
  await fs.writeFile(childFile, "process.on('message',()=>{});process.on('SIGTERM',()=>{});process.send('ready');setInterval(()=>{},1000);\n");
  const child = fork(childFile, [], { silent: true });
  const exit = new Promise((resolve) => child.once('close', (code, signal) => resolve({ code, signal })));
  await new Promise((resolve, reject) => { child.once('message', resolve); child.once('error', reject); });
  const stoppedAt = Date.now();
  await assert.rejects(stopSourcePairChild({ child, exit, label: 'stubborn' }, { graceMs: 30, termMs: 30, killMs: 2000 }), /shutdown failed/);
  assert(Date.now() - stoppedAt < 4000); assert((await exit).code !== 0); pass();

  // Real CLI, env-only options, deliberate early PostgreSQL refusal: artifacts
  // must exist despite failure before any application server is launched.
  const output = path.join(temporary, 'failed-run');
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/rc1-source-pair.js', import.meta.url))], {
    cwd: repo, encoding: 'utf8', timeout: 20000, env: { ...process.env,
      RC1_PAIR_PREDECESSOR_DIRECTORY: previous, RC1_PAIR_PREDECESSOR_SHA: predecessor,
      RC1_PAIR_OUTPUT: output, RC1_PAIR_DATABASE_URL: 'postgres://postgres@127.0.0.1:1/postgres' } });
  assert.equal(run.status, 1, run.stderr); assert.equal(run.error, undefined);
  const report = JSON.parse(await fs.readFile(path.join(output, 'result.json'), 'utf8'));
  assert.equal(report.status, 'FAIL'); assert.equal(report.phase, 'create-database');
  assert.equal(report.arguments.predecessor, predecessor);
  assert.equal(report.arguments.predecessorDirectory, await fs.realpath(previous));
  assert.equal(JSON.parse(await fs.readFile(path.join(output, 'run-reserved.json'), 'utf8')).status, 'RUNNING');
  assert.match(await fs.readFile(path.join(output, 'history.jsonl'), 'utf8'), /"status":"FAIL"/);
  const index = JSON.parse(await fs.readFile(path.join(output, 'sha256-index.json'), 'utf8'));
  for (const item of index) assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(output, item.file))).digest('hex'), item.sha256);
  pass();
  // Deliver the Node signal handler portably (Windows cannot deliver POSIX
  // SIGTERM semantics with child.kill). A socket stalls PG startup until abort.
  const interruptedOutput = path.join(temporary, 'interrupted-run'), wrapper = path.join(temporary, 'interrupt.mjs');
  await fs.writeFile(wrapper, `import net from 'node:net';
import fs from 'node:fs';
import { runSourcePair } from ${JSON.stringify(new URL('../tools/rc1-source-pair.js', import.meta.url).href)};
const sockets = new Set();
const server = net.createServer(socket => { sockets.add(socket); socket.on('error',()=>{}); });
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
process.env.RC1_PAIR_DATABASE_URL = 'postgres://postgres@127.0.0.1:'+server.address().port+'/postgres';
const timer = setInterval(() => {
  try { if(JSON.parse(fs.readFileSync(process.env.RC1_PAIR_OUTPUT+'/result.json')).phase==='create-database') {
    clearInterval(timer); process.emit('SIGTERM');
  } } catch {}
}, 20);
try { const result=await runSourcePair(); if(result.interruptedBy!=='SIGTERM'||result.status!=='FAIL') throw Error('Missing interruption failure'); process.exitCode=0; }
finally { clearInterval(timer); for(const socket of sockets) socket.destroy(); await new Promise(resolve=>server.close(resolve)); }
`);
  const interruptedRun = spawnSync(process.execPath, [wrapper], { cwd: repo, encoding: 'utf8', timeout: 20000,
    env: { ...process.env, RC1_PAIR_PREDECESSOR_DIRECTORY: previous, RC1_PAIR_PREDECESSOR_SHA: predecessor,
      RC1_PAIR_OUTPUT: interruptedOutput } });
  assert.equal(interruptedRun.status, 0, interruptedRun.stderr); assert.equal(interruptedRun.error, undefined);
  const interruptedReport = JSON.parse(await fs.readFile(path.join(interruptedOutput, 'result.json'), 'utf8'));
  assert.equal(interruptedReport.interruptedBy, 'SIGTERM'); assert.equal(interruptedReport.status, 'FAIL');
  assert(interruptedReport.endedAt); assert.match(await fs.readFile(path.join(interruptedOutput, 'history.jsonl'), 'utf8'), /"signal":"SIGTERM"/); pass();
  console.log(JSON.stringify({ test: 'source-pair evidence negative controls', checks, status: 'PASS',
    scope: 'Git identity, output containment, receipt schema/authority, forced child shutdown, signal handler and early failure retention; no native upgrade claim' }));
} finally {
  // This is our freshly created, absolute temporary fixture directory only.
  assert(path.dirname(temporary) === path.resolve(os.tmpdir()) && path.basename(temporary).startsWith('omerta-pair-controls-'));
  await fs.rm(temporary, { recursive: true, force: true });
}
